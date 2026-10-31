// Stockage des menus (AsyncStorage). Lecture tolérante (JSON corrompu -> valeurs
// par défaut, jamais d'exception), écritures sérialisées (aucune course),
// enveloppe versionnée { v, data } avec migration.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { estObjet, arr } from './util';
import { defaultProfile, normalizeProfile } from './profile';

export const SCHEMA_VERSION = 1;
export const MENUS_KEY = {
  profile: 'MENUS_PROFILE',
  plan: 'MENUS_PLAN',
  history: 'MENUS_HISTORY',
  favorites: 'MENUS_FAVORITES',
  notes: 'MENUS_NOTES',
  cooked: 'MENUS_COOKED',
  fridge: 'MENUS_FRIDGE',
  applied: 'MENUS_LIST_APPLIED',
  meta: 'MENUS_META',
  sent: 'MENUS_SENT_PACKS',
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
      if (typeof t === 'string' && t.trim()) out[k] = t.slice(0, 2000);
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

// Une entrée par clé : valeur par défaut, nettoyage, migration (de la version `from` vers SCHEMA_VERSION).
const SPEC = {
  profile: { def: () => defaultProfile(), clean: (v) => normalizeProfile(v) },
  plan: { def: () => null, clean: cleanPlan },
  history: { def: () => [], clean: cleanHistory },
  favorites: { def: () => [], clean: cleanIds },
  notes: { def: () => ({}), clean: cleanNotes },
  cooked: { def: () => ({}), clean: cleanCooked },
  fridge: { def: () => [], clean: cleanIds },
  applied: { def: () => ({}), clean: cleanApplied },
  meta: { def: () => ({ onboarded: false }), clean: cleanMeta },
  sent: { def: () => ({}), clean: cleanSent },
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
    const ok = await writeRaw(name, clean === undefined ? SPEC[name].def() : clean);
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
      await AsyncStorage.removeItem(MENUS_KEY.plan);
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
export const loadFridge = () => read('fridge');
export async function saveFridge(keys) {
  return (await update('fridge', () => cleanIds(keys))).ok;
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

/** Efface toutes les données des menus (déconnexion, suppression du compte). */
export async function clearAllMenus() {
  return enqueue(async () => {
    try {
      if (typeof AsyncStorage.multiRemove === 'function')
        await AsyncStorage.multiRemove(MENUS_KEYS);
      else for (const k of MENUS_KEYS) await AsyncStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  });
}
