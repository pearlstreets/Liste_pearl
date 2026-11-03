// Stockage des menus (AsyncStorage). Lecture tolérante (JSON corrompu -> valeurs
// par défaut, jamais d'exception), écritures sérialisées (aucune course),
// enveloppe versionnée { v, data } avec migration.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { estObjet, arr, coupeTexte } from './util';
import { defaultProfile, normalizeProfile, cleanPrefs } from './profile';
import { SYNC_KEYS, LEGACY_STAMP, valeurValide } from './sync';
import { cleanMyRecipes, MY_RECIPE_ID } from './myRecipes';
import { cleanReminders, defaultReminders } from './reminders';
import { cleanFamilyShare, defaultFamilyShare } from './sharedWeek';
import { cleanBatch } from './batch';
import { cleanMembers } from './needs';

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
  myRecipesDeleted: 'MENUS_MY_RECIPES_DELETED',
  reminders: 'MENUS_REMINDERS',
  familyShare: 'MENUS_FAMILY_SHARE',
  batch: 'MENUS_BATCH',
  household: 'MENUS_HOUSEHOLD',
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
// Recettes personnelles supprimées : { id: date }, les 500 plus récentes.
const cleanDeleted = (v) => {
  if (!estObjet(v)) return {};
  const l = Object.entries(v).filter(
    ([id, t]) => MY_RECIPE_ID.test(id) && Number.isFinite(t) && t > 0
  );
  l.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(l.slice(0, 500));
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

// Personnes du foyer { members } (needs.js), préférences des menus { prefs } (profile.js), mode 'simple'|'perso'
// et marques de suppression { membersDeleted: { id: date } }, rangés hors du profil : voir household dans sync.js.
// prefs, mode et membersDeleted n'existent qu'une fois posés.
const defaultHousehold = () => ({ members: [] });
const cleanMembersDeleted = (v) => {
  if (!estObjet(v)) return {};
  const l = Object.entries(v).filter(
    ([id, t]) => typeof id === 'string' && id && id.length <= 40 && Number.isFinite(t) && t > 0
  );
  l.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(l.slice(0, 200));
};
const cleanHousehold = (v) => {
  const o = estObjet(v) ? v : {};
  const out = { members: cleanMembers(o.members) };
  if (estObjet(o.prefs)) out.prefs = cleanPrefs(o.prefs);
  if (o.mode === 'simple' || o.mode === 'perso') out.mode = o.mode;
  const marques = cleanMembersDeleted(o.membersDeleted);
  if (Object.keys(marques).length) out.membersDeleted = marques;
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
  myRecipesDeleted: { def: () => ({}), clean: cleanDeleted },
  reminders: { def: defaultReminders, clean: cleanReminders },
  familyShare: { def: defaultFamilyShare, clean: cleanFamilyShare },
  batch: { def: () => null, clean: cleanBatch },
  household: { def: defaultHousehold, clean: cleanHousehold },
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

// Lecture détaillée : { ok, value, why }. ok:false = donnée présente mais illisible ici
// ('error' : lecture impossible, par exemple ligne trop grande sous Android ; 'future' : écrite
// par une version plus récente ; 'corrupt' : JSON ou forme invalide). value = valeur par défaut.
async function readEntry(name) {
  const spec = SPEC[name];
  const illisible = (why) => ({ ok: false, value: spec.def(), why });
  let raw;
  try {
    raw = await AsyncStorage.getItem(MENUS_KEY[name]);
  } catch {
    return illisible('error');
  }
  try {
    if (raw === null || raw === undefined || raw === '') return { ok: true, value: spec.def() };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return illisible('corrupt');
    }
    let data = parsed;
    if (estObjet(parsed) && Number.isInteger(parsed.v) && 'data' in parsed) {
      if (parsed.v > SCHEMA_VERSION) return illisible('future'); // écrit par une version plus récente : on ne touche pas
      data = migrate(parsed.v, parsed.data);
    } else {
      data = migrate(0, parsed);
    }
    if (data === undefined) return illisible('corrupt');
    if (data === null) return { ok: true, value: spec.def() };
    if (SYNC_KEYS.includes(name) && !valeurValide(name, data)) return illisible('corrupt');
    const c = spec.clean(data);
    return { ok: true, value: c === null || c === undefined ? spec.def() : c };
  } catch {
    return illisible('corrupt');
  }
}

async function readRaw(name) {
  return (await readEntry(name)).value;
}

async function writeRaw(name, value) {
  try {
    await AsyncStorage.setItem(MENUS_KEY[name], JSON.stringify({ v: SCHEMA_VERSION, data: value }));
    return true;
  } catch {
    return false;
  }
}

// Plusieurs clés d'un seul AsyncStorage.multiSet (valeur et état de sauvegarde ensemble).
async function writeMany(pairs) {
  const items = pairs.map(([name, value]) => [
    MENUS_KEY[name],
    JSON.stringify({ v: SCHEMA_VERSION, data: value }),
  ]);
  try {
    if (typeof AsyncStorage.multiSet === 'function') await AsyncStorage.multiSet(items);
    else for (const [k, v] of items) await AsyncStorage.setItem(k, v);
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

// Horodate les clés et les marque "à envoyer" dans l'état `st` (sans l'écrire).
function stampLocalWrite(st, list) {
  const now = Date.now();
  for (const n of list) {
    // Toujours après l'horodatage connu, même si l'horloge de l'appareil retarde.
    st.stamps[n] = Math.max(now, (st.stamps[n] || 0) + 1);
    st.dirty[n] = true;
  }
}
function afterLocalWrite(list) {
  try {
    if (syncListener) syncListener();
  } catch {}
  emitLocalWrite(list);
}

// Note l'horodatage de la clé et la marque "à envoyer". Toujours appelée dans la file d'écriture.
async function noteLocalWrite(names) {
  const list = names.filter((n) => SYNC_KEYS.includes(n));
  if (list.length === 0) return;
  const st = await readRaw('sync');
  stampLocalWrite(st, list);
  await writeRaw('sync', st);
  afterLocalWrite(list);
}

const read = (name) => enqueue(() => readRaw(name));
// Lecture + modification + écriture d'un seul tenant (pas de course entre deux appels).
const update = (name, mutator) =>
  enqueue(async () => {
    const lu = await readEntry(name);
    const cur = lu.value;
    if (!lu.ok && lu.why !== 'corrupt') return { ok: false, value: cur };
    if (!lu.ok && SYNC_KEYS.includes(name)) {
      // Clé corrompue d'un appareil rattaché à un compte : la copie du compte la réparera au
      // prochain passage ; l'écraser ici la remplacerait sur le compte.
      const st = await readEntry('sync');
      if (!st.ok || st.value.owner) return { ok: false, value: cur };
    }
    let next;
    try {
      next = mutator(cur);
    } catch {
      return { ok: false, value: cur };
    }
    const clean = SPEC[name].clean(next);
    const value = clean === undefined ? SPEC[name].def() : clean;
    const changed = JSON.stringify(value) !== JSON.stringify(cur);
    if (!changed || !SYNC_KEYS.includes(name)) {
      const ok = await writeRaw(name, value);
      if (ok && changed) await noteLocalWrite([name]);
      return { ok, value: clean };
    }
    // Valeur et "à envoyer" d'un seul tenant : une app tuée entre les deux ne perd pas l'envoi.
    const st = await readRaw('sync');
    stampLocalWrite(st, [name]);
    const ok = await writeMany([
      [name, value],
      ['sync', st],
    ]);
    if (ok) afterLocalWrite([name]);
    return { ok, value: clean };
  });

/* --------------------------------- profil --------------------------------- */

// Le profil enregistré ne contient jamais members ni prefs : ils vivent sous la clé household (qu'une ancienne
// version ne réécrit pas), et loadProfile / saveProfile les rejoignent au profil en mémoire.
const sansMembres = (p) => {
  if (!estObjet(p) || !('members' in p || 'prefs' in p || 'mode' in p || 'dormant' in p)) return p;
  const { members: _m, prefs: _p, mode: _o, dormant: _d, ...reste } = p;
  return reste;
};
const joindre = (profil, foyer) =>
  normalizeProfile({
    ...sansMembres(profil),
    members: foyer ? foyer.members : [],
    ...(foyer && foyer.prefs ? { prefs: foyer.prefs } : {}),
    ...(foyer && foyer.mode ? { mode: foyer.mode } : {}),
  });

export async function loadProfile() {
  const p = await read('profile');
  let h = await read('household');
  if (estObjet(p) && (Array.isArray(p.members) || 'prefs' in p)) {
    // Profil écrit avec ses personnes (essais d'avant la clé household) : déplacées sans perte.
    const membres = Array.isArray(p.members) && p.members.length && !h.members.length;
    const prefs = estObjet(p.prefs) && !h.prefs;
    if (membres || prefs) {
      const r = await update('household', (cur) => ({
        ...cur,
        ...(membres ? { members: p.members } : {}),
        ...(prefs ? { prefs: p.prefs } : {}),
      }));
      if (!r.ok) return normalizeProfile(p);
      h = r.value;
    }
    const r = await update('profile', (cur) => sansMembres(cur));
    if (!r.ok) return joindre(p, h);
  }
  return joindre(p, h);
}

/** Fusionne un profil complet ou partiel dans le profil enregistré. Rend le profil écrit (avec ses personnes). */
export async function saveProfile(patch) {
  const pt = estObjet(patch) ? patch : {};
  let h = await read('household');
  const aMembres = Array.isArray(pt.members);
  const aMode = pt.mode === 'simple' || pt.mode === 'perso';
  if (aMembres || 'prefs' in pt || aMode) {
    const r = await update('household', (cur) => {
      const next = { ...cur };
      if (aMembres) {
        // Une personne retirée laisse une marque de suppression (date) : une fusion avec un autre appareil
        // ne la ramène pas (sync.js). Une personne qui revient (même identifiant) efface sa marque.
        const liste = cleanMembers(pt.members);
        const gardes = new Set(liste.map((m) => m.id));
        const marques = { ...cur.membersDeleted };
        const maintenant = Date.now();
        for (const m of cur.members) if (!gardes.has(m.id)) marques[m.id] = maintenant;
        for (const id of gardes) delete marques[id];
        next.members = liste;
        next.membersDeleted = marques;
      }
      // préférences partielles fusionnées dans celles déjà réglées
      if ('prefs' in pt)
        next.prefs = { ...(cur && cur.prefs), ...(estObjet(pt.prefs) ? pt.prefs : {}) };
      if (aMode) next.mode = pt.mode;
      return next;
    });
    if (r.ok) h = r.value;
  }
  // Adultes et enfants découlent des personnes ; le profil est écrit sans elles.
  const r = await update('profile', (cur) =>
    sansMembres(
      normalizeProfile({
        ...sansMembres(cur),
        ...sansMembres(pt),
        members: h.members,
        ...(h.mode ? { mode: h.mode } : {}),
      })
    )
  );
  return joindre(r.value, h);
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
export const loadFamilyShare = () => read('familyShare');
export async function saveFamilyShare(value) {
  return (await update('familyShare', () => value)).value;
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
  // Marque de suppression d'abord : une fusion avec un autre appareil ne ramène pas la recette.
  await update('myRecipesDeleted', (cur) => ({ ...cur, [id]: Date.now() }));
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
// Envois comptés par liste ET par semaine : les courses d'une nouvelle semaine repartent de zéro.
const sentKey = (listId, week) => (week ? String(listId) + '@' + String(week) : String(listId));
/** Paquets déjà envoyés vers une liste (pour une semaine) : { cléIngrédient: nombre de paquets }. */
export async function loadSent(listId, week) {
  const all = await read('sent');
  const k = sentKey(listId, week);
  if (estObjet(all[k])) return all[k];
  // Envois enregistrés avant le comptage par semaine : repris tels quels.
  return week && estObjet(all[String(listId)]) ? all[String(listId)] : {};
}
/** Retient le plus grand nombre de paquets envoyé par ingrédient (on ne retire jamais d'une liste). */
export async function markSent(listId, packsByKey, week) {
  return (
    await update('sent', (all) => {
      const k = sentKey(listId, week);
      const cur = { ...all };
      // Une seule semaine gardée par liste : les semaines passées sont oubliées.
      if (week)
        for (const id of Object.keys(cur)) if (id !== k && id.startsWith(String(listId) + '@')) delete cur[id];
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
      const foyer = await readRaw('household');
      await removeKeys(MENUS_KEYS.filter((k) => k !== MENUS_KEY.sync));
      // Personnes effacées : marquées supprimées, sinon une fusion avec le compte les ramènerait (sync.js).
      if (foyer.members.length) {
        const marques = { ...foyer.membersDeleted };
        for (const m of foyer.members) marques[m.id] = Date.now();
        await writeRaw('household', { members: [], membersDeleted: marques });
      }
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
