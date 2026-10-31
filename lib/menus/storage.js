// Stockage des menus (AsyncStorage). Lecture tolérante (JSON corrompu -> valeurs
// par défaut, jamais d'exception), écritures sérialisées (aucune course),
// enveloppe versionnée { v, data } avec migration.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { estObjet, arr, coupeTexte } from './util';
import { defaultProfile, normalizeProfile } from './profile';
import { SYNC_KEYS, LEGACY_STAMP, valeurValide } from './sync';
import { cleanMyRecipes, MY_RECIPE_ID } from './myRecipes';
import { cleanReminders, defaultReminders } from './reminders';
import { cleanBatch } from './batch';

export const SCHEMA_VERSION = 1;
export const MENUS_KEY = {
  profile: 'MENUS_PROFILE',
  plan: 'MENUS_PLAN',
  history: 'MENUS_HISTORY',
  favorites: 'MENUS_FAVORITES',
  notes: 'MENUS_NOTES',
  cooked: 'MENUS_COOKED',
  fridge: 'MENUS_FRIDGE',
  myRecipes: 'MENUS_MY_RECIPES',
  reminders: 'MENUS_REMINDERS',
  batch: 'MENUS_BATCH',
  applied: 'MENUS_LIST_APPLIED',
  meta: 'MENUS_META',
  sent: 'MENUS_SENT_PACKS',
  sync: 'MENUS_SYNC_STATE',
};
// À effacer à la déconnexion / suppression du compte.
export const MENUS_KEYS = Object.values(MENUS_KEY);

const HISTORY_MAX = 26;

/* ----------------------------- file d'écriture ----------------------------- */

let chain = Promise.resolve();
function enqueue(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/* ------------------------------- validations ------------------------------- */

const cleanPlan = (v) => {
  if (!estObjet(v) || !Array.isArray(v.meals)) return null;
  const meals = v.meals.filter((m) => estObjet(m) && /^[0-6]-(midi|soir)$/.test(String(m.key)));
  return { ...v, meals, warnings: arr(v.warnings) };
};
const cleanIds = (v) =>
  arr(v)
    .filter((x) => typeof x === 'string' && x)
    .filter((x, i, a) => a.indexOf(x) === i);
const cleanNotes = (v) => {
  const out = {};
  if (estObjet(v))
    for (const [k, t] of Object.entries(v))
      if (typeof t === 'string' && t.trim()) out[k] = coupeTexte(t, 2000);
  return out;
};
const cleanCooked = (v) => {
  const out = {};
  if (estObjet(v)) {
    for (const [k, e] of Object.entries(v)) {
      if (!estObjet(e)) continue;
      const c = Math.max(0, Math.floor(Number(e.count) || 0));
      if (c > 0) out[k] = { count: c, last: Number(e.last) || 0 };
    }
  }
  return out;
};
const cleanApplied = (v) => {
  const out = {};
  if (estObjet(v)) for (const [k, l] of Object.entries(v)) out[k] = cleanIds(l).slice(-20);
  return out;
};
const cleanMeta = (v) => (estObjet(v) ? { onboarded: !!v.onboarded } : { onboarded: false });
const cleanSent = (v) => {
  const out = {};
  if (!estObjet(v)) return out;
  for (const [id, m] of Object.entries(v)) {
    if (!estObjet(m)) continue;
    const o = {};
    for (const [k, n] of Object.entries(m)) {
      const x = Math.floor(Number(n));
      if (Number.isFinite(x) && x > 0) o[k] = x;
    }
    out[id] = o;
  }
  return out;
};
const cleanHistory = (v) => arr(v).map(cleanPlan).filter(Boolean).slice(-HISTORY_MAX);
// État de la sauvegarde : compte propriétaire des données locales, horodatage et "à envoyer" par clé.
const defaultSync = () => ({ owner: null, stamps: {}, base: {}, dirty: {}, lastSyncAt: 0 });
const cleanSync = (v) => {
  const out = defaultSync();
  if (!estObjet(v)) return out;
  if (typeof v.owner === 'string' && v.owner) out.owner = v.owner;
  if (Number.isFinite(v.lastSyncAt)) out.lastSyncAt = v.lastSyncAt;
  for (const k of SYNC_KEYS) {
    if (estObjet(v.stamps) && Number.isFinite(v.stamps[k]) && v.stamps[k] > 0)
      out.stamps[k] = v.stamps[k];
    if (estObjet(v.base) && Number.isFinite(v.base[k])) out.base[k] = v.base[k];
    if (estObjet(v.dirty) && v.dirty[k]) out.dirty[k] = true;
  }
  return out;
};

// Une entrée par clé : valeur par défaut, nettoyage, migration (de la version `from` vers SCHEMA_VERSION).
const SPEC = {
  profile: { def: () => defaultProfile(), clean: (v) => normalizeProfile(v) },
  plan: { def: () => null, clean: cleanPlan },
  history: { def: () => [], clean: cleanHistory },
  favorites: { def: () => [], clean: cleanIds },
  notes: { def: () => ({}), clean: cleanNotes },
  cooked: { def: () => ({}), clean: cleanCooked },
  fridge: { def: () => [], clean: cleanIds },
  myRecipes: { def: () => [], clean: cleanMyRecipes },
  reminders: { def: defaultReminders, clean: cleanReminders },
  batch: { def: () => null, clean: cleanBatch },
  applied: { def: () => ({}), clean: cleanApplied },
  meta: { def: () => ({ onboarded: false }), clean: cleanMeta },
  sent: { def: () => ({}), clean: cleanSent },
  sync: { def: defaultSync, clean: cleanSync },
};

// Migrations : version -> fonction(data) qui rend la donnée de la version suivante.
// v0 = valeur nue sans enveloppe (jamais écrite par cette version, prévue pour les essais).
const MIGRATIONS = { 0: (d) => d };

function migrate(from, data) {
  let v = Number.isInteger(from) ? from : 0;
  let d = data;
  while (v < SCHEMA_VERSION) {
    const fn = MIGRATIONS[v];
    try {
      d = fn ? fn(d) : d;
    } catch {
      return undefined;
    }
    v++;
  }
  return d;
}

async function readRaw(name) {
  const spec = SPEC[name];
  try {
    const raw = await AsyncStorage.getItem(MENUS_KEY[name]);
    if (raw === null || raw === undefined || raw === '') return spec.def();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return spec.def();
    }
    let data = parsed;
    if (estObjet(parsed) && Number.isInteger(parsed.v) && 'data' in parsed) {
      if (parsed.v > SCHEMA_VERSION) return spec.def(); // écrit par une version plus récente : on ne touche pas
      data = migrate(parsed.v, parsed.data);
    } else {
      data = migrate(0, parsed);
    }
    if (data === undefined || data === null) return spec.def();
    const c = spec.clean(data);
    return c === null || c === undefined ? spec.def() : c;
  } catch {
    return spec.def();
  }
}

async function writeRaw(name, value) {
  try {
    await AsyncStorage.setItem(MENUS_KEY[name], JSON.stringify({ v: SCHEMA_VERSION, data: value }));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------ sauvegarde : traces ------------------------------ */

let syncListener = null;
/** Appelé après chaque écriture locale d'une clé sauvegardée (envoi différé). */
export function setMenusSyncListener(fn) {
  syncListener = typeof fn === 'function' ? fn : null;
}

const writeListeners = new Set();
/** fn(clés) après chaque écriture locale d'une clé sauvegardée. Rend la fonction de désabonnement. */
export function onMenusLocalWrite(fn) {
  writeListeners.add(fn);
  return () => writeListeners.delete(fn);
}
function emitLocalWrite(names) {
  for (const fn of [...writeListeners]) {
    try {
      fn(names);
    } catch {}
  }
}

// Note l'horodatage de la clé et la marque "à envoyer". Toujours appelée dans la file d'écriture.
async function noteLocalWrite(names) {
  const list = names.filter((n) => SYNC_KEYS.includes(n));
  if (list.length === 0) return;
  const st = await readRaw('sync');
  const now = Date.now();
  for (const n of list) {
    // Toujours après l'horodatage connu, même si l'horloge de l'appareil retarde.
    st.stamps[n] = Math.max(now, (st.stamps[n] || 0) + 1);
    st.dirty[n] = true;
  }
  await writeRaw('sync', st);
  try {
    if (syncListener) syncListener();
  } catch {}
  emitLocalWrite(list);
}

const read = (name) => enqueue(() => readRaw(name));
// Lecture + modification + écriture d'un seul tenant (pas de course entre deux appels).
const update = (name, mutator) =>
  enqueue(async () => {
    const cur = await readRaw(name);
    let next;
    try {
      next = mutator(cur);
    } catch {
      return { ok: false, value: cur };
    }
    const clean = SPEC[name].clean(next);
    const value = clean === undefined ? SPEC[name].def() : clean;
    const ok = await writeRaw(name, value);
    if (ok && JSON.stringify(value) !== JSON.stringify(cur)) await noteLocalWrite([name]);
    return { ok, value: clean };
  });

/* --------------------------------- profil --------------------------------- */

export const loadProfile = () => read('profile');
/** Fusionne un profil complet ou partiel dans le profil enregistré. Rend le profil écrit. */
export async function saveProfile(patch) {
  const r = await update('profile', (cur) =>
    normalizeProfile({ ...cur, ...(estObjet(patch) ? patch : {}) })
  );
  return r.value;
}

/* ----------------------------- plan et historique ----------------------------- */

export const loadPlan = () => read('plan');
export async function savePlan(plan) {
  const c = cleanPlan(plan);
  if (!c) return false;
  return (await update('plan', () => c)).ok;
}
export async function clearPlan() {
  return enqueue(async () => {
    try {
      const had = await AsyncStorage.getItem(MENUS_KEY.plan);
      await AsyncStorage.removeItem(MENUS_KEY.plan);
      if (had !== null && had !== undefined) await noteLocalWrite(['plan']);
      return true;
    } catch {
      return false;
    }
  });
}

export const loadHistory = () => read('history');
/** Ajoute un plan à l'historique (le même plan, même semaine et même empreinte, est remplacé). */
export async function pushHistory(plan, now = Date.now()) {
  const c = cleanPlan(plan);
  if (!c) return false;
  return (
    await update('history', (cur) => {
      const entry = { ...c, savedAt: now };
      const rest = cur.filter(
        (p) => !((p.weekStart || null) === (c.weekStart || null) && p.fingerprint === c.fingerprint)
      );
      return [...rest, entry].slice(-HISTORY_MAX);
    })
  ).ok;
}

/* ---------------------------- favoris, notes, cuisinées ---------------------------- */

export const loadFavorites = () => read('favorites');
export async function toggleFavorite(id) {
  if (typeof id !== 'string' || !id) return null;
  let now = false;
  const r = await update('favorites', (cur) => {
    now = !cur.includes(id);
    return now ? [...cur, id] : cur.filter((x) => x !== id);
  });
  return r.ok ? now : null;
}

export const loadNotes = () => read('notes');
export async function setNote(id, text) {
  if (typeof id !== 'string' || !id) return false;
  return (
    await update('notes', (cur) => {
      const next = { ...cur };
      const t = typeof text === 'string' ? text.trim() : '';
      if (t) next[id] = t;
      else delete next[id];
      return next;
    })
  ).ok;
}

export const loadCooked = () => read('cooked');
export async function markCooked(id, when = Date.now()) {
  if (typeof id !== 'string' || !id) return false;
  return (
    await update('cooked', (cur) => ({
      ...cur,
      [id]: { count: ((cur[id] && cur[id].count) || 0) + 1, last: when },
    }))
  ).ok;
}

/** Produits que l'on a chez soi (recherche "ce que j'ai"). */
export const loadBatch = () => read('batch');
export async function saveBatch(session) {
  return (await update('batch', () => session)).value;
}
export const loadReminders = () => read('reminders');
export async function saveReminders(reminders) {
  return (await update('reminders', () => reminders)).value;
}

export const loadFridge = () => read('fridge');
export async function saveFridge(keys) {
  return (await update('fridge', () => cleanIds(keys))).ok;
}

/* ------------------------------ recettes personnelles ------------------------------ */

export const loadMyRecipes = () => read('myRecipes');
/** Ajoute ou remplace une recette. Rend { ok, list }. */
export async function saveMyRecipe(recipe) {
  const propre = cleanMyRecipes([recipe]);
  if (propre.length === 0) return { ok: false, list: await read('myRecipes') };
  const r = await update('myRecipes', (cur) => {
    const i = cur.findIndex((x) => x.id === propre[0].id);
    if (i < 0) return [...cur, propre[0]];
    const next = [...cur];
    next[i] = propre[0];
    return next;
  });
  return { ok: r.ok, list: r.value || [] };
}
export async function deleteMyRecipe(id) {
  if (typeof id !== 'string' || !MY_RECIPE_ID.test(id)) return { ok: false, list: [] };
  const r = await update('myRecipes', (cur) => cur.filter((x) => x.id !== id));
  return { ok: r.ok, list: r.value || [] };
}
/** Photo envoyée au compte : l'adresse est retenue, sauf si la photo a changé entre-temps. */
export async function setMyRecipePhotoUrl(id, url, file) {
  const r = await update('myRecipes', (cur) =>
    cur.map((x) => (x.id === id && x.photoFile === file ? { ...x, photoUrl: url } : x))
  );
  return { ok: r.ok, list: r.value || [] };
}

/* ------------------- empreintes déjà envoyées vers une liste ------------------- */

export const loadApplied = () => read('applied');
export async function hasApplied(listId, fingerprint) {
  const all = await read('applied');
  return arr(all[String(listId)]).includes(fingerprint);
}
export async function markApplied(listId, fingerprint) {
  if (!fingerprint) return false;
  return (
    await update('applied', (cur) => {
      const k = String(listId);
      return { ...cur, [k]: [...arr(cur[k]).filter((f) => f !== fingerprint), fingerprint] };
    })
  ).ok;
}

/* ------------- présentation faite, paquets déjà envoyés par liste ------------- */

export const loadMeta = () => read('meta');
export async function setMeta(patch) {
  return (await update('meta', (cur) => ({ ...cur, ...(estObjet(patch) ? patch : {}) }))).value;
}
/** Paquets déjà envoyés vers une liste : { cléIngrédient: nombre de paquets }. */
export async function loadSent(listId) {
  const all = await read('sent');
  return estObjet(all[String(listId)]) ? all[String(listId)] : {};
}
/** Retient le plus grand nombre de paquets envoyé par ingrédient (on ne retire jamais d'une liste). */
export async function markSent(listId, packsByKey) {
  return (
    await update('sent', (cur) => {
      const k = String(listId);
      const prev = estObjet(cur[k]) ? cur[k] : {};
      const next = { ...prev };
      for (const [key, n] of Object.entries(estObjet(packsByKey) ? packsByKey : {}))
        next[key] = Math.max(Number(prev[key]) || 0, Math.floor(Number(n)) || 0);
      return { ...cur, [k]: next };
    })
  ).ok;
}

async function removeKeys(keys) {
  if (typeof AsyncStorage.multiRemove === 'function') await AsyncStorage.multiRemove(keys);
  else for (const k of keys) await AsyncStorage.removeItem(k);
}

/** Efface toutes les données des menus (déconnexion, suppression du compte). */
export async function clearAllMenus() {
  return enqueue(async () => {
    try {
      await removeKeys(MENUS_KEYS);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * "Tout réinitialiser" demandé par l'utilisateur. Sur un compte, l'effacement est horodaté pour
 * partir aussi sur le compte (sinon tout reviendrait à la lecture suivante). Sans compte, simple
 * effacement local : rien ne doit toucher un compte rejoint plus tard.
 */
export async function resetAllMenus() {
  return enqueue(async () => {
    try {
      const { owner } = await readRaw('sync');
      if (!owner) {
        await removeKeys(MENUS_KEYS);
        emitLocalWrite(SYNC_KEYS);
        return true;
      }
      await removeKeys(MENUS_KEYS.filter((k) => k !== MENUS_KEY.sync));
      await noteLocalWrite(SYNC_KEYS);
      return true;
    } catch {
      return false;
    }
  });
}

/* ---------------------------- sauvegarde : échanges ---------------------------- */

export const readSyncState = () => read('sync');

// Donnée brute d'une clé, undefined si elle est illisible ou écrite par une version plus récente.
function dataOf(raw) {
  try {
    const p = JSON.parse(raw);
    if (estObjet(p) && Number.isInteger(p.v) && 'data' in p)
      return p.v > SCHEMA_VERSION ? undefined : p.data;
    return p;
  } catch {
    return undefined;
  }
}

/** Photographie { state, entries } des clés sauvegardées, d'un seul tenant dans la file. */
export function readSyncSnapshot() {
  return enqueue(async () => {
    const state = await readRaw('sync');
    const entries = {};
    for (const k of SYNC_KEYS) {
      let raw;
      try {
        raw = await AsyncStorage.getItem(MENUS_KEY[k]);
      } catch {
        continue;
      }
      const absent = raw === null || raw === undefined || raw === '';
      const u = state.stamps[k];
      if (absent) {
        if (u) entries[k] = { u, v: null }; // effacement explicite
        continue;
      }
      const data = dataOf(raw);
      if (data === null) {
        if (u) entries[k] = { u, v: null }; // session de cuisine terminée, par exemple
        continue;
      }
      if (data === undefined || !valeurValide(k, data)) continue;
      entries[k] = { u: u || LEGACY_STAMP, v: await readRaw(k) };
    }
    return { state, entries };
  });
}

/**
 * Écrit le résultat d'une fusion et rattache les données locales au compte `owner`. Une clé
 * modifiée depuis la photographie (`stamps`) n'est pas touchée : la saisie récente gagne.
 * Rend { ok, applied: clés écrites, filled: celles qui ont une valeur }.
 */
export function applySyncEntries({ owner, entries, stamps, dirty }) {
  return enqueue(async () => {
    const res = { ok: false, applied: [], filled: [], skipped: [] };
    try {
      const st = await readRaw('sync');
      if (st.owner && st.owner !== owner) return res;
      const seen = estObjet(stamps) ? stamps : {};
      const push = arr(dirty);
      for (const [k, e] of Object.entries(estObjet(entries) ? entries : {})) {
        if (!SYNC_KEYS.includes(k) || !estObjet(e)) continue;
        if ((st.stamps[k] || 0) !== (seen[k] || 0)) {
          res.skipped.push(k);
          continue;
        }
        if (e.v === null) {
          await AsyncStorage.removeItem(MENUS_KEY[k]);
        } else {
          const clean = SPEC[k].clean(e.v);
          if (clean === null || clean === undefined) continue;
          if (!(await writeRaw(k, clean))) continue;
          res.filled.push(k);
        }
        st.stamps[k] = e.u;
        if (push.includes(k)) st.dirty[k] = true;
        else {
          delete st.dirty[k];
          st.base[k] = e.u;
        }
        res.applied.push(k);
      }
      st.owner = owner;
      res.ok = await writeRaw('sync', st);
      return res;
    } catch {
      return res;
    }
  });
}

/** Le compte a reçu ces versions : une clé modifiée entre-temps reste "à envoyer". */
export function confirmSyncSent({ owner, sent, at = Date.now() }) {
  return enqueue(async () => {
    const st = await readRaw('sync');
    if (st.owner !== owner) return false;
    for (const [k, u] of Object.entries(estObjet(sent) ? sent : {})) {
      if (!SYNC_KEYS.includes(k) || !Number.isFinite(u)) continue;
      st.base[k] = u; // le compte porte cette version, même si la clé a changé ici depuis
      if ((st.stamps[k] || LEGACY_STAMP) !== u) continue;
      st.stamps[k] = u;
      delete st.dirty[k];
    }
    st.lastSyncAt = at;
    return writeRaw('sync', st);
  });
}
