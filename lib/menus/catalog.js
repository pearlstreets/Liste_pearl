// Catalogue des recettes generees (data/menus/gen) : colonnes compactes, aucun objet recette cree en masse.
// Format : scripts/menus-gen/CONCEPTION.md sections 2 et 4. Ce module ne leve jamais : toute anomalie met le
// catalogue en etat "degraded" (aucune recette generee, les recettes ecrites a la main restent seules).
import { readInt } from './b64';
import { estObjet } from './util';
import { getGenSource } from './genSource';

export const GEN_PREFIX = 'g-';
const GEN_RE = /^g-([0-9a-z]+)$/;
const GENRE_NOM = ['', 'four', 'feu', 'repos']; // meme ordre que scripts/menus-gen/build-menus.js
const UNITS = ['g', 'ml', 'u', 'cs', 'cc'];
const REQUIRED = [
  'course',
  'sub',
  'family',
  'tags',
  'time',
  'diff',
  'kcal',
  'prot',
  'keep',
  'flags',
  'cost',
  'alg',
  'nIng',
  'nStep',
  'nPhr',
  'main1',
  'main2',
];
const MAX_ING = 512; // 9 bits d'index d'ingredient dans une ligne
export const LRU_SIZE = 600; // un plan materialise 350 a 430 recettes (liste courte et completions)
export const MAX_PAGE = 500;
// Ingredients qui ne caracterisent pas un plat (cf. dishProfile de variety.js).
const KEY_EXCLUDED = ['pomme-de-terre', 'carotte', 'courgette', 'tomate', 'epinard'];

export const nowMs = () =>
  typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/** true pour un identifiant au format des recettes generees (g-<base36>), sans verifier qu'il existe. */
export const isGeneratedId = (id) => typeof id === 'string' && GEN_RE.test(id);

/** Numero de case d'un identifiant g-..., ou -1 (forme canonique exigee : pas de zero de tete). */
export function rowFromId(id) {
  if (typeof id !== 'string') return -1;
  const m = GEN_RE.exec(id);
  if (!m || m[1].length > 8) return -1;
  const row = parseInt(m[1], 36);
  return Number.isInteger(row) && row.toString(36) === m[1] ? row : -1;
}
export const idFromRow = (row) => `${GEN_PREFIX}${row.toString(36)}`;

/* ------------------------------ construction du noyau ------------------------------ */

let core = null;

function degradedCore(reason) {
  return { status: 'degraded', reason, N: 0, alive: 0 };
}

/** Passe un noyau pret en etat degrade (anomalie decouverte plus tard, par exemple un bloc tronque). */
export function markDegraded(c, reason) {
  if (c && c.status === 'ready') {
    c.status = 'degraded';
    c.reason = reason;
    c.alive = 0;
  }
}

const typedFor = (w, n) =>
  w <= 1 ? new Uint8Array(n) : w === 2 ? new Uint16Array(n) : new Uint32Array(n);

/**
 * Prepare la construction en tranches : { steps:[fn], done:() => noyau }. Chaque tranche reste courte
 * (decodage de quelques colonnes). Aucune ne leve : l'echec est range dans le noyau.
 */
function builder(src) {
  const st = { c: null, failed: null, fields: [], cols: {} };
  const fail = (reason) => {
    if (!st.failed) st.failed = reason;
  };
  const steps = [];

  steps.push(() => {
    try {
      if (!src || !estObjet(src.meta) || !estObjet(src.hdr) || !src.loaders)
        return fail('source absente');
      const m = src.meta;
      const okInt = (v) => Number.isInteger(v) && v > 0;
      if (m.VERSION !== 1) return fail('version inconnue');
      if (!okInt(m.N) || !okInt(m.SHARD) || !okInt(m.PHRASE_CONT)) return fail('meta invalide');
      if (m.N > 262143) return fail('trop de cases');
      if (m.LINE_W !== 3 && m.LINE_W !== 4) return fail('largeur de ligne invalide');
      if (!Number.isInteger(m.PAIR_BITS) || m.PAIR_BITS < 1 || 9 + m.PAIR_BITS + 1 > 6 * m.LINE_W)
        return fail('PAIR_BITS invalide');
      if (!Array.isArray(m.FIELDS)) return fail('FIELDS invalide');
      const names = m.FIELDS.map((f) => f && f[0]);
      for (const r of REQUIRED) if (!names.includes(r)) return fail(`champ manquant : ${r}`);
      for (const [name, w] of m.FIELDS) {
        if (!Number.isInteger(w) || w < 1 || w > 4) return fail(`largeur invalide : ${name}`);
        if (typeof src.hdr[name] !== 'string' || src.hdr[name].length !== m.N * w)
          return fail(`colonne tronquee : ${name}`);
      }
      for (const k of ['COURSES', 'SUBS', 'TAGS'])
        if (!Array.isArray(m[k])) return fail(`${k} manquant`);
      for (const k of ['ING_KEYS', 'PAIRS', 'PHRASE_META', 'FAMILIES'])
        if (typeof m[k] !== 'string') return fail(`${k} manquant`);
      st.fields = m.FIELDS;
      const ING = m.ING_KEYS.split('\n');
      if (ING.length < 1 || ING.length > MAX_ING || ING.some((k) => !k))
        return fail('ING_KEYS invalide');
      const pairs = m.PAIRS.split('|');
      const pairQty = new Float64Array(pairs.length);
      const pairUnit = new Array(pairs.length);
      for (let i = 0; i < pairs.length; i++) {
        const cut = pairs[i].indexOf(':');
        const q = Number(pairs[i].slice(0, cut));
        const u = pairs[i].slice(cut + 1);
        if (cut < 1 || !(q > 0) || !UNITS.includes(u)) return fail('PAIRS invalide');
        pairQty[i] = q;
        pairUnit[i] = u;
      }
      if (pairs.length > 1 << m.PAIR_BITS) return fail('PAIRS trop long');
      const pm = m.PHRASE_META.split('|');
      const pGenre = new Uint8Array(pm.length);
      const pSec = new Uint32Array(pm.length);
      const pTemp = new Uint16Array(pm.length);
      for (let i = 0; i < pm.length; i++) {
        const p = pm[i].split(',');
        const g = Number(p[0]);
        const s = Number(p[1]);
        const t = Number(p[2]);
        if (p.length !== 3 || !(g >= 0 && g <= 3) || !(s >= 0) || !(t >= 0))
          return fail('PHRASE_META invalide');
        pGenre[i] = g;
        pSec[i] = s;
        pTemp[i] = t;
      }
      if (pm.length > m.PHRASE_CONT) return fail('trop de phrases');
      const nBlocks = Math.ceil(m.N / m.SHARD);
      if (src.loaders.NB_BLOCS !== undefined && src.loaders.NB_BLOCS !== nBlocks)
        return fail('nombre de blocs incoherent');
      st.c = {
        status: 'ready',
        reason: '',
        source: src,
        meta: m,
        N: m.N,
        SHARD: m.SHARD,
        nBlocks,
        LW: m.LINE_W,
        PAIR_BITS: m.PAIR_BITS,
        PHRASE_CONT: m.PHRASE_CONT,
        COURSES: m.COURSES,
        SUBS: m.SUBS,
        TAGS: m.TAGS,
        FAMILIES: m.FAMILIES.split('\n'),
        ING,
        pairQty,
        pairUnit,
        nPhrases: pm.length,
        pGenre,
        pSec,
        pTemp,
        cols: st.cols,
        alive: 0,
        lineStart: null,
        stepStart: null,
        blockLines: null,
        blockPhr: null,
        lines: new Array(nBlocks).fill(null),
        stepsBlk: new Array(nBlocks).fill(null),
        lru: new Map(),
      };
    } catch (_e) {
      fail('meta illisible');
    }
  });

  // Decodage des colonnes, en deux tranches.
  const decode = (from, to) => () => {
    if (st.failed || !st.c) return;
    try {
      const { N } = st.c;
      const hdr = src.hdr;
      for (let f = from; f < Math.min(to, st.fields.length); f++) {
        const [name, w] = st.fields[f];
        const col = typedFor(w, N);
        const s = hdr[name];
        for (let i = 0; i < N; i++) {
          const v = readInt(s, i * w, w);
          if (v < 0) return fail(`caractere invalide : ${name}`);
          col[i] = v;
        }
        st.cols[name] = col;
      }
    } catch (_e) {
      fail('decodage impossible');
    }
  };
  steps.push(decode(0, 9));
  steps.push(decode(9, 99));

  // Decalages cumules par bloc et controle d'integrite O(n).
  steps.push(() => {
    if (st.failed || !st.c) return;
    try {
      const c = st.c;
      const { N, SHARD, cols, ING, COURSES, SUBS } = c;
      for (const r of REQUIRED) if (!cols[r]) return fail(`colonne absente : ${r}`);
      const lineStart = new Uint32Array(N);
      const stepStart = new Uint32Array(N);
      const blockLines = new Array(c.nBlocks).fill(0);
      const blockPhr = new Array(c.nBlocks).fill(0);
      let alive = 0;
      let li = 0;
      let si = 0;
      for (let i = 0; i < N; i++) {
        if (i % SHARD === 0) {
          li = 0;
          si = 0;
        }
        lineStart[i] = li;
        stepStart[i] = si;
        const retired = (cols.flags[i] & 4) !== 0;
        li += cols.nIng[i];
        si += cols.nPhr[i];
        const b = (i / SHARD) | 0;
        blockLines[b] = li;
        blockPhr[b] = si;
        if (retired) continue;
        alive++;
        if (cols.course[i] >= COURSES.length || cols.sub[i] >= SUBS.length)
          return fail(`categorie invalide, case ${i}`);
        if (cols.main1[i] > ING.length || cols.main2[i] > ING.length)
          return fail(`ingredient principal invalide, case ${i}`);
        if (cols.nIng[i] < 1 || cols.nStep[i] < 1 || cols.nStep[i] > cols.nPhr[i])
          return fail(`comptes invalides, case ${i}`);
        if (cols.family[i] > c.FAMILIES.length) return fail(`famille invalide, case ${i}`);
      }
      c.lineStart = lineStart;
      c.stepStart = stepStart;
      c.blockLines = blockLines;
      c.blockPhr = blockPhr;
      c.alive = alive;
    } catch (_e) {
      fail('integrite impossible a verifier');
    }
  });

  return {
    steps,
    done() {
      if (st.failed || !st.c) return degradedCore(st.failed || 'echec');
      return st.c;
    },
  };
}

/** Noyau courant (peut etre null avant le premier appel). */
export function peekCore() {
  return core;
}

/** Noyau, construit au besoin de facon synchrone. Ne leve jamais. */
export function getCore() {
  if (core) return core;
  return initCatalog();
}

/** Construction synchrone, idempotente. */
export function initCatalog() {
  if (core) return core;
  let src = null;
  try {
    src = getGenSource();
  } catch (_e) {
    src = null;
  }
  const b = builder(src);
  for (const s of b.steps) s();
  core = b.done();
  return core;
}

/**
 * Construction en tranches : yieldFn() est attendu entre deux tranches (rend la main a l'interface).
 * Renvoie { core, slices:[ms] }. Ne leve jamais.
 */
export async function initCatalogAsync(yieldFn) {
  const slices = [];
  if (core) return { core, slices };
  let src = null;
  try {
    src = getGenSource();
  } catch (_e) {
    src = null;
  }
  const b = builder(src);
  for (const s of b.steps) {
    const t = nowMs();
    s();
    slices.push(nowMs() - t);
    if (typeof yieldFn === 'function') await yieldFn();
    if (core) return { core, slices }; // construit entre-temps par un appel synchrone
  }
  if (!core) core = b.done();
  return { core, slices };
}

/** Vide le noyau (tests, changement de source). */
export function resetCatalogCore() {
  core = null;
}

export function catalogStatus() {
  const c = core;
  return c
    ? { status: c.status, reason: c.reason || '', size: c.N, alive: c.alive }
    : { status: 'idle', reason: '', size: 0, alive: 0 };
}

/* ----------------------------- acces aux blocs de lignes et d'etapes ----------------------------- */

export function loadBlock(c, kind, b) {
  const cache = kind === 'lines' ? c.lines : c.stepsBlk;
  if (cache[b] !== null) return cache[b] || null;
  let text = null;
  try {
    text = kind === 'lines' ? c.source.loaders.lines(b) : c.source.loaders.steps(b);
  } catch (_e) {
    text = null;
  }
  const width = kind === 'lines' ? c.LW : 2;
  const expected = (kind === 'lines' ? c.blockLines[b] : c.blockPhr[b]) * width;
  if (typeof text !== 'string' || text.length !== expected) {
    cache[b] = false;
    markDegraded(c, `bloc ${kind}-${b} absent ou tronque`);
    return null;
  }
  cache[b] = text;
  return text;
}

/** Groupes de phrases d'une case : [[idPhrase,...], ...] (une liste par etape), ou null. */
export function phraseGroups(c, row) {
  if (!c || c.status !== 'ready' || !(row >= 0 && row < c.N) || c.cols.flags[row] & 4) return null;
  const text = loadBlock(c, 'steps', (row / c.SHARD) | 0);
  if (!text) return null;
  const n = c.cols.nPhr[row];
  const start = c.stepStart[row];
  const groups = [];
  let cur = [];
  for (let k = 0; k < n; k++) {
    const v = readInt(text, (start + k) * 2, 2);
    if (v < 0) {
      markDegraded(c, `etapes illisibles, case ${row}`);
      return null;
    }
    const cont = v >= c.PHRASE_CONT;
    const id = cont ? v - c.PHRASE_CONT : v;
    if (id >= c.nPhrases) {
      markDegraded(c, `phrase inconnue, case ${row}`);
      return null;
    }
    cur.push(id);
    if (!cont) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** Lignes d'ingredients d'une case : [{ key, qty, unit, optional? }], ou null. */
export function ingredientLines(c, row) {
  const text = loadBlock(c, 'lines', (row / c.SHARD) | 0);
  if (!text) return null;
  const n = c.cols.nIng[row];
  const start = c.lineStart[row];
  const pairMask = (1 << c.PAIR_BITS) - 1;
  const out = new Array(n);
  for (let k = 0; k < n; k++) {
    const v = readInt(text, (start + k) * c.LW, c.LW);
    if (v < 0) {
      markDegraded(c, `lignes illisibles, case ${row}`);
      return null;
    }
    const key = c.ING[v & 511];
    const p = (v >> 9) & pairMask;
    if (!key || p >= c.pairQty.length) {
      markDegraded(c, `ligne invalide, case ${row}`);
      return null;
    }
    const line = { key, qty: c.pairQty[p], unit: c.pairUnit[p] };
    if ((v >> (9 + c.PAIR_BITS)) & 1) line.optional = true;
    out[k] = line;
  }
  return out;
}

/** Recette complete (meme forme qu'une entree de recipes.json, plus family, dp, sub, generated), ou null. */
function build(c, row) {
  const col = c.cols;
  const ingredients = ingredientLines(c, row);
  const groups = ingredients ? phraseGroups(c, row) : null;
  if (!ingredients || !groups) return null;
  const stepTimers = {};
  const stepKinds = {};
  let oven = 0;
  groups.forEach((g, k) => {
    let best = -1;
    for (const id of g) {
      if (c.pTemp[id] > oven) oven = c.pTemp[id];
      if (c.pGenre[id] > 0 && c.pSec[id] > 0 && (best < 0 || c.pSec[id] > c.pSec[best])) best = id;
    }
    if (best >= 0) {
      stepTimers[k] = c.pSec[best];
      stepKinds[k] = GENRE_NOM[c.pGenre[best]];
    }
  });
  const tagMask = col.tags[row];
  const tags = [];
  for (let k = 0; k < c.TAGS.length; k++) if ((tagMask >> k) & 1) tags.push(c.TAGS[k]);
  const f = col.family[row];
  const family = f > 0 ? c.FAMILIES[f - 1] : null;
  const flags = col.flags[row];
  const mains = [col.main1[row], col.main2[row]].filter((x) => x > 0).map((x) => c.ING[x - 1]);
  return {
    id: idFromRow(row),
    course: c.COURSES[col.course[row]],
    sub: c.SUBS[col.sub[row]],
    servings: 4,
    timeMin: col.time[row] * 5,
    difficulty: col.diff[row] + 1,
    tags,
    kcal: col.kcal[row] * 10,
    protein: col.prot[row],
    leftoverOk: (flags & 1) !== 0,
    keepDays: col.keep[row],
    freezable: (flags & 2) !== 0,
    ingredients,
    stepTimers,
    stepKinds,
    ovenTempC: oven,
    family,
    dp: {
      family,
      main: mains[0] || null,
      mains,
      key: mains.filter((k) => !KEY_EXCLUDED.includes(k)),
    },
    generated: true,
  };
}

/* --------------------------------------- facade --------------------------------------- */

const legacyMaps = new WeakMap();
function legacyMapOf(list) {
  let m = legacyMaps.get(list);
  if (!m) {
    m = new Map();
    for (const r of list) if (r && typeof r.id === 'string') m.set(r.id, r);
    legacyMaps.set(list, m);
  }
  return m;
}

/**
 * Catalog : facade d'acces aux recettes (get, has, size) compatible avec indexRecipes.
 * Resolution : recettes personnelles, puis recettes ecrites a la main, puis recettes generees.
 * values() ne renvoie JAMAIS les recettes generees (liste fermee : ecrites a la main + personnelles) ;
 * les generees se lisent par identifiant, par case ou par page bornee (rows). Aucune iteration complete.
 */
export class Catalog {
  /** legacy : tableau (ou fonction qui le renvoie) des recettes ecrites a la main. custom : Map id -> recette. */
  constructor(legacy, custom) {
    this._legacy = legacy;
    this._custom = custom instanceof Map ? custom : new Map();
  }

  _list() {
    const l = typeof this._legacy === 'function' ? this._legacy() : this._legacy;
    return Array.isArray(l) ? l : [];
  }

  _core() {
    return getCore();
  }

  /** Meme catalogue avec des recettes personnelles (objets valides uniquement). */
  withCustom(list) {
    const m = new Map();
    for (const r of Array.isArray(list) ? list : [])
      if (estObjet(r) && typeof r.id === 'string' && r.id) m.set(r.id, r);
    return new Catalog(this._legacy, m);
  }

  get custom() {
    return this._custom;
  }

  get status() {
    return this._core().status;
  }

  /** Comptes : ecrites a la main + personnelles + generees non retirees. */
  get size() {
    const lm = legacyMapOf(this._list());
    let extra = 0;
    for (const id of this._custom.keys()) if (!lm.has(id)) extra++;
    return lm.size + extra + this._core().alive;
  }

  get legacyCount() {
    return legacyMapOf(this._list()).size;
  }

  /** Numero de case de l'identifiant g-... existant et non retire, sinon -1. */
  rowOf(id) {
    const row = rowFromId(id);
    if (row < 0) return -1;
    const c = this._core();
    return c.status === 'ready' && row < c.N && !(c.cols.flags[row] & 4) ? row : -1;
  }

  idOf(row) {
    return Number.isInteger(row) && row >= 0 ? idFromRow(row) : '';
  }

  has(id) {
    if (typeof id !== 'string') return false;
    if (this._custom.has(id) || legacyMapOf(this._list()).has(id)) return true;
    return this.rowOf(id) >= 0;
  }

  get(id) {
    if (typeof id !== 'string') return undefined;
    const own = this._custom.get(id);
    if (own) return own;
    const old = legacyMapOf(this._list()).get(id);
    if (old) return old;
    const row = this.rowOf(id);
    return row >= 0 ? this.getRow(row) || undefined : undefined;
  }

  /** Recette d'une case (cache de 600 objets), ou null. */
  getRow(row) {
    const c = this._core();
    if (
      c.status !== 'ready' ||
      !Number.isInteger(row) ||
      row < 0 ||
      row >= c.N ||
      c.cols.flags[row] & 4
    )
      return null;
    const hit = c.lru.get(row);
    if (hit) {
      c.lru.delete(row);
      c.lru.set(row, hit);
      return hit;
    }
    const r = build(c, row);
    if (!r) return null;
    c.lru.set(row, r);
    if (c.lru.size > LRU_SIZE) c.lru.delete(c.lru.keys().next().value);
    return r;
  }

  /** Objet neuf (hors cache) : pour les tests d'aller-retour. */
  materialize(row) {
    const c = this._core();
    if (
      c.status !== 'ready' ||
      !Number.isInteger(row) ||
      row < 0 ||
      row >= c.N ||
      c.cols.flags[row] & 4
    )
      return null;
    return build(c, row);
  }

  /** Recettes ecrites a la main puis personnelles (tableau neuf). Jamais les recettes generees. */
  values() {
    const lm = legacyMapOf(this._list());
    const out = [];
    for (const [id, r] of lm) if (!this._custom.has(id)) out.push(r);
    for (const r of this._custom.values()) out.push(r);
    return out;
  }

  /** Page bornee de numeros de cases non retirees : au plus MAX_PAGE a partir de start. */
  rows(start = 0, count = 100) {
    const c = this._core();
    if (c.status !== 'ready') return [];
    const out = [];
    const n = Math.max(0, Math.min(MAX_PAGE, Math.floor(count) || 0));
    for (let i = Math.max(0, Math.floor(start) || 0); i < c.N && out.length < n; i++)
      if (!(c.cols.flags[i] & 4)) out.push(i);
    return out;
  }

  /** Colonne brute (lecture seule par convention) : course, sub, family, tags, time, kcal, cost, alg, main1... */
  column(name) {
    const c = this._core();
    return c.status === 'ready' && c.cols[name] ? c.cols[name] : null;
  }

  /** Cout par personne en euros (hors placard), lu dans la colonne cost ; 0 si inconnu. */
  costPP(row) {
    const c = this._core();
    return c.status === 'ready' && row >= 0 && row < c.N ? c.cols.cost[row] / 10 : 0;
  }

  get rowCount() {
    return this._core().N;
  }

  get ingredientKeys() {
    const c = this._core();
    return c.status === 'ready' ? c.ING : [];
  }
}
