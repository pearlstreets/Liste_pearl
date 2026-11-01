// Recherche et mode frigo sur le catalogue genere : index de titres pre-normalise par langue, filtres par colonnes.
// Meme semantique que searchRecipes / recipesByPantry (search.js) : debut de mot du titre 10, titre contenant 6,
// ingredient 3, etiquette 2, ET sur tous les mots. Les resultats sont des numeros de cases (pas d'objets) ;
// les recettes ecrites a la main et personnelles passent par search.js et sont fusionnees par score.
import { estObjet, arr, norm, normBlob, seasonOf, SEASONS, hashSeed } from './util';
import { readInt } from './b64';
import { getCore, loadBlock } from './catalog';
import { loadTitleBlock, titleBlockText } from './packs';
import { scoreRecipes, recipesByPantry } from './search';
import { rowsOfIngredient, ingInfo, warmIngredientIndex } from './pool';

const indexes = {}; // langue -> { lang, blocks:[{ blob, starts }], ingNorm, ingFn }
let building = null;

/** Vide les index de recherche (tests, changement de source). */
export function resetSearchIndex() {
  for (const l of Object.keys(indexes)) delete indexes[l];
  building = null;
}

/** Libere les index des langues autres que celle gardee. */
export function releaseSearchIndex(keep) {
  for (const l of Object.keys(indexes)) if (l !== keep) delete indexes[l];
}

function buildBlock(c, lang, b) {
  // Titres de la langue, sinon du francais (repli bloc par bloc).
  let text = null;
  for (const l of lang === 'fr' ? ['fr'] : [lang, 'fr']) {
    if (loadTitleBlock(l, b)) {
      text = titleBlockText(l, b);
      if (text) break;
    }
  }
  const count = b < c.nBlocks - 1 ? c.SHARD : c.N - b * c.SHARD;
  const starts = new Int32Array(count + 1);
  if (!text) return { blob: '\n', starts };
  // Une seule normalisation par bloc ; le saut de ligne qui precede chaque titre permet de reconnaitre un debut de mot.
  const blob = '\n' + normBlob(text);
  let pos = 1;
  for (let i = 0; i < count; i++) {
    starts[i] = pos;
    const nx = blob.indexOf('\n', pos);
    pos = nx < 0 ? blob.length + 1 : nx + 1;
  }
  starts[count] = pos;
  return { blob, starts };
}

/** Index de titres de la langue, construit d'un bloc (2048 titres) a la fois. yieldFn() est attendu entre deux blocs. */
export async function buildSearchIndex(lang, { yieldFn, cancelled } = {}) {
  const c = getCore();
  if (c.status !== 'ready') return null;
  const hit = indexes[lang];
  if (hit && hit.done) return hit;
  const idx = {
    lang,
    blocks: new Array(c.nBlocks).fill(null),
    ingNorm: null,
    ingFn: null,
    done: false,
    core: c,
  };
  building = idx;
  for (let b = 0; b < c.nBlocks; b++) {
    if (building !== idx || (typeof cancelled === 'function' && cancelled())) return null;
    idx.blocks[b] = buildBlock(c, lang, b);
    if (typeof yieldFn === 'function') await yieldFn();
  }
  idx.done = true;
  releaseSearchIndex(lang);
  indexes[lang] = idx;
  // index inverse des ingredients (frappe d'un nom d'ingredient, mode frigo) : prechauffe bloc par bloc
  await warmIngredientIndex({ yieldFn, cancelled });
  return idx;
}

/** Index synchrone (construit en une fois si besoin). */
export function buildTitleIndex(lang) {
  const c = getCore();
  if (c.status !== 'ready') return null;
  const hit = indexes[lang];
  if (hit && hit.done && hit.core === c) return hit;
  const idx = { lang, blocks: [], ingNorm: null, ingFn: null, done: true, core: c };
  for (let b = 0; b < c.nBlocks; b++) idx.blocks.push(buildBlock(c, lang, b));
  releaseSearchIndex(lang);
  indexes[lang] = idx;
  return idx;
}

/* ----------------------------------- filtres par colonnes ----------------------------------- */

const tagBit = (c, name) => {
  const k = c.TAGS.indexOf(name);
  return k >= 0 ? 1 << k : 0;
};

/**
 * Masque des cases (non retirees) qui passent les filtres de filterRecipes. Uint8Array(N), 1 = retenue.
 * Memes regles que filterRecipes (search.js) sur les colonnes.
 */
export function filterMask(c, filters) {
  const f = estObjet(filters) ? filters : {};
  const { N, cols } = c;
  const mask = new Uint8Array(N);
  let need = 0;
  let impossible = false;
  for (const t of arr(f.tags)) {
    const b = tagBit(c, t);
    if (!b) impossible = true;
    need |= b;
  }
  let seasonBits = 0;
  for (const s of SEASONS) seasonBits |= tagBit(c, s);
  const fSeason = f.season ? tagBit(c, f.season) : 0;
  const month = f.month !== undefined && f.month !== null ? seasonOf(f.month) : null;
  const monthBit = month ? tagBit(c, month) : 0;
  const hasMonth = f.month !== undefined && f.month !== null;
  const course = f.course ? c.COURSES.indexOf(f.course) : -1;
  const maxT = f.maxTimeMin ? Number(f.maxTimeMin) : 0;
  const maxD = f.maxDifficulty ? Number(f.maxDifficulty) : 0;
  const maxK = f.maxKcal ? Number(f.maxKcal) : 0;
  const minP = f.minProtein ? Number(f.minProtein) : 0;
  let favRows = null;
  if (f.favoritesOnly) {
    const fav = f.favorites instanceof Set ? f.favorites : new Set(arr(f.favorites));
    favRows = new Uint8Array(N);
    for (const id of fav) {
      if (typeof id !== 'string' || id.slice(0, 2) !== 'g-') continue;
      const row = parseInt(id.slice(2), 36);
      if (Number.isInteger(row) && row >= 0 && row < N && 'g-' + row.toString(36) === id)
        favRows[row] = 1;
    }
  }
  let exRow = null;
  const ex = arr(f.excludedIngredients).map(String);
  if (ex.length) {
    exRow = new Uint8Array(N);
    for (const key of ex) {
      const ix = c.ING.indexOf(key);
      if (ix < 0) continue;
      const rows = rowsOfIngredient(c, ix);
      if (rows) for (let k = 0; k < rows.length; k++) exRow[rows[k]] = 1;
    }
  }
  if (impossible || (f.favoritesOnly && !favRows)) return mask;
  for (let i = 0; i < N; i++) {
    if (cols.flags[i] & 4) continue;
    if (course >= 0 && cols.course[i] !== course) continue;
    if (f.course && course < 0) continue;
    const t = cols.tags[i];
    if (need && (t & need) !== need) continue;
    const own = t & seasonBits;
    if (f.season && own && !(t & fSeason)) continue;
    if (hasMonth && month && own && !(t & monthBit)) continue;
    if (maxT && cols.time[i] * 5 > maxT) continue;
    if (maxD && cols.diff[i] + 1 > maxD) continue;
    if (maxK && cols.kcal[i] * 10 > maxK) continue;
    if (minP && !(cols.prot[i] >= minP)) continue;
    if (exRow && exRow[i]) continue;
    if (favRows && !favRows[i]) continue;
    mask[i] = 1;
  }
  return mask;
}

/* ----------------------------------- recherche ----------------------------------- */

function lineOf(starts, count, pos) {
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Noms d'ingredients normalises (nom dans la langue + cle), mis en cache par langue et par fonction de nom.
function ingredientNorms(c, idx, nameOf) {
  if (idx.ingNorm && idx.ingFn === nameOf) return idx.ingNorm;
  const out = new Array(c.ING.length);
  for (let i = 0; i < out.length; i++) {
    let n = '';
    try {
      n = norm(nameOf(c.ING[i]));
    } catch {
      n = '';
    }
    out[i] = n + ' ' + norm(c.ING[i]);
  }
  idx.ingNorm = out;
  idx.ingFn = nameOf;
  return out;
}

/** Points d'un mot pour chaque case : 10, 6, 3, 2 ou 0 (Uint8Array(N)). */
function wordScores(c, idx, w, alive, nameOf) {
  const ws = new Uint8Array(c.N);
  // titre
  for (let b = 0; b < idx.blocks.length; b++) {
    const blk = idx.blocks[b];
    if (!blk || blk.blob.length < 2) continue;
    const count = blk.starts.length - 1;
    const base = b * c.SHARD;
    let pos = blk.blob.indexOf(w);
    while (pos >= 0) {
      const line = lineOf(blk.starts, count, pos);
      const row = base + line;
      const prev = blk.blob.charCodeAt(pos - 1);
      if (prev === 32 || prev === 10) {
        ws[row] = 10;
        pos = blk.blob.indexOf(w, blk.starts[line + 1]); // ligne suivante
        continue;
      }
      if (ws[row] < 6) ws[row] = 6;
      pos = blk.blob.indexOf(w, pos + 1);
    }
  }
  // ingredients : tout nom ou cle qui contient le mot
  const names = ingredientNorms(c, idx, nameOf);
  for (let i = 0; i < names.length; i++) {
    if (names[i].indexOf(w) < 0) continue;
    const rows = rowsOfIngredient(c, i);
    if (!rows) continue;
    for (let k = 0; k < rows.length; k++) if (ws[rows[k]] === 0) ws[rows[k]] = 3;
  }
  // etiquettes
  let tm = 0;
  for (let k = 0; k < c.TAGS.length; k++) if (norm(c.TAGS[k]).indexOf(w) >= 0) tm |= 1 << k;
  if (tm) {
    const tags = c.cols.tags;
    for (let i = 0; i < c.N; i++) if (ws[i] === 0 && alive[i] && tags[i] & tm) ws[i] = 2;
  }
  return ws;
}

/**
 * searchCatalog({ catalog, ingredients, lang, query, filters, limit, offset, titleOf, ingredientNameOf, shuffleSeed })
 * -> { total, refs:Int32Array, legacy:[recette] }
 * refs : fenetre [offset, offset + limit) des resultats triees ; une valeur >= 0 est un numero de case generee,
 * une valeur < 0 designe legacy[-valeur - 1] (recettes ecrites a la main et personnelles, deja filtrees et triees).
 * Ordre : pertinence decroissante ; a pertinence egale, recettes ecrites a la main (par id) puis cases generees
 * (par numero de case, ou melange stable si shuffleSeed est fourni et que la requete est vide).
 * titleOf(recette) / ingredientNameOf(cle) servent aux recettes ecrites a la main ; ingredientNameOf aussi aux ingredients generes.
 */
export function searchCatalog(opts = {}) {
  const o = estObjet(opts) ? opts : {};
  const catalog = o.catalog;
  const c = getCore();
  const limit = o.limit > 0 ? Math.floor(o.limit) : 0;
  const offset = o.offset > 0 ? Math.floor(o.offset) : 0;
  const lang = o.lang || 'fr';
  const nameOf =
    typeof o.ingredientNameOf === 'function'
      ? o.ingredientNameOf
      : (k) => String(k).replace(/-/g, ' ');
  const words = norm(o.query).split(' ').filter(Boolean);

  // Recettes ecrites a la main et personnelles.
  // legacyList : liste deja restreinte (par exemple aux recettes admises par le foyer) a la place de catalog.values().
  const legacySrc = Array.isArray(o.legacyList)
    ? o.legacyList
    : catalog && typeof catalog.values === 'function'
      ? catalog.values()
      : null;
  const legacyScored = legacySrc ? scoreRecipes(legacySrc, o) : [];
  legacyScored.sort((a, b) => b.s - a.s || (a.r.id < b.r.id ? -1 : 1));
  const legacy = legacyScored.map((x) => x.r);

  // Cases generees.
  let rows = new Int32Array(0);
  let genScores = null;
  if (c.status === 'ready' && c.alive > 0) {
    const alive = filterMask(c, o.filters);
    // allowedRows : Uint8Array(N), 1 = case admise (eligibilite du foyer) ; les autres sont ecartees.
    if (o.allowedRows && o.allowedRows.length === c.N)
      for (let i = 0; i < c.N; i++) if (alive[i] && !o.allowedRows[i]) alive[i] = 0;
    const acc = new Uint16Array(c.N);
    if (words.length) {
      const idx = buildTitleIndex(lang);
      for (const w of words) {
        const ws = wordScores(c, idx, w, alive, nameOf);
        for (let i = 0; i < c.N; i++) {
          if (!alive[i]) continue;
          if (ws[i] === 0) alive[i] = 0;
          else acc[i] += ws[i];
        }
      }
    }
    const maxScore = words.length * 10;
    const cnt = new Uint32Array(maxScore + 2);
    let total = 0;
    for (let i = 0; i < c.N; i++)
      if (alive[i]) {
        cnt[acc[i]]++;
        total++;
      }
    // positions par score decroissant
    const startAt = new Uint32Array(maxScore + 2);
    let run = 0;
    for (let s = maxScore; s >= 0; s--) {
      startAt[s] = run;
      run += cnt[s];
    }
    const sorted = new Int32Array(total);
    const fill = startAt.slice();
    for (let i = 0; i < c.N; i++) if (alive[i]) sorted[fill[acc[i]]++] = i;
    if (words.length === 0 && o.shuffleSeed !== undefined && o.shuffleSeed !== null) {
      const seed = hashSeed(o.shuffleSeed);
      const key = (r) => {
        let h = Math.imul((r + 1) | 0, 0x9e3779b1) ^ seed;
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
        return (h ^ (h >>> 13)) >>> 0;
      };
      // Cle de melange et numero de case emballes dans un seul nombre : tri numerique natif, sans comparateur.
      const packed = new Float64Array(sorted.length);
      for (let i = 0; i < sorted.length; i++) packed[i] = key(sorted[i]) * (c.N + 1) + sorted[i];
      packed.sort();
      for (let i = 0; i < sorted.length; i++) sorted[i] = packed[i] % (c.N + 1);
    }
    rows = sorted;
    genScores = acc;
  }

  // Fusion : score decroissant, recettes ecrites a la main d'abord a score egal.
  const total = legacy.length + rows.length;
  const from = Math.min(offset, total);
  const to = limit ? Math.min(total, from + limit) : total;
  const refs = new Int32Array(to - from);
  let li = 0;
  let gi = 0;
  for (let n = 0; n < to; n++) {
    let takeLegacy;
    if (li >= legacy.length) takeLegacy = false;
    else if (gi >= rows.length) takeLegacy = true;
    else takeLegacy = legacyScored[li].s >= genScores[rows[gi]];
    const v = takeLegacy ? -++li : rows[gi++];
    if (n >= from) refs[n - from] = v;
  }
  return { total, refs, legacy };
}

/** Objets d'une fenetre de resultats (au plus la taille de la fenetre). */
export function resultRecipes(result, catalog) {
  const out = [];
  if (!result) return out;
  for (const v of result.refs) {
    const r = v < 0 ? result.legacy[-v - 1] : catalog.getRow(v);
    if (r) out.push(r);
  }
  return out;
}

/* ----------------------------------- mode frigo ----------------------------------- */

// Lecture legere des lignes d'une case : appelle fn(indexIngredient, optionnel).
function eachLine(c, row, fn) {
  const text = loadBlock(c, 'lines', (row / c.SHARD) | 0);
  if (!text) return false;
  const n = c.cols.nIng[row];
  const s = c.lineStart[row];
  const pairBits = c.PAIR_BITS;
  for (let k = 0; k < n; k++) {
    const v = readInt(text, (s + k) * c.LW, c.LW);
    if (v < 0) return false;
    fn(v & 511, (v >> (9 + pairBits)) & 1);
  }
  return true;
}

/**
 * pantryCatalog({ catalog, ingredients, have:[cles], toUseUp:[cles], filters, limit, offset, minCoverage })
 * -> { total, items:[{ recipe, score, coverage, have, missing, uses }] } (fenetre limit/offset, objets seulement pour la fenetre)
 * Meme formule que recipesByPantry ; les cases generees sont evaluees a partir des seules cases qui contiennent
 * au moins un ingredient possede (index inverse).
 */
export function pantryCatalog(opts = {}) {
  const o = estObjet(opts) ? opts : {};
  const catalog = o.catalog;
  const ings = estObjet(o.ingredients) ? o.ingredients : {};
  const c = getCore();
  const limit = o.limit > 0 ? Math.floor(o.limit) : 0;
  const offset = o.offset > 0 ? Math.floor(o.offset) : 0;
  const minCov = typeof o.minCoverage === 'number' ? o.minCoverage : 0.4;
  const haveKeys = arr(o.have);
  const useKeys = arr(o.toUseUp);

  const legacySrc = Array.isArray(o.legacyList)
    ? o.legacyList
    : catalog && typeof catalog.values === 'function'
      ? catalog.values()
      : null;
  const legacy = legacySrc
    ? recipesByPantry(legacySrc, haveKeys, { ...o, ingredients: ings, limit: 0 })
    : [];

  // Cases generees.
  const gen = []; // { row, score, coverage }
  if (c.status === 'ready' && c.alive > 0) {
    const info = ingInfo(c, ings);
    const have = new Uint8Array(c.ING.length);
    const useUp = new Uint8Array(c.ING.length);
    const touched = [];
    const mark = new Uint8Array(c.N);
    const pass = filterMask(c, o.filters);
    if (o.allowedRows && o.allowedRows.length === c.N)
      for (let i = 0; i < c.N; i++) if (pass[i] && !o.allowedRows[i]) pass[i] = 0;
    for (const k of haveKeys) {
      const ix = c.ING.indexOf(k);
      if (ix >= 0) have[ix] = 1;
    }
    for (const k of useKeys) {
      const ix = c.ING.indexOf(k);
      if (ix >= 0) useUp[ix] = 1;
    }
    for (let ix = 0; ix < have.length; ix++) {
      if (!have[ix]) continue;
      const rows = rowsOfIngredient(c, ix);
      if (!rows) continue;
      for (let k = 0; k < rows.length; k++) {
        const r = rows[k];
        if (!mark[r] && pass[r]) {
          mark[r] = 1;
          touched.push(r);
        }
      }
    }
    touched.sort((a, b) => a - b);
    for (const row of touched) {
      let tot = 0;
      let got = 0;
      let hv = 0;
      let ms = 0;
      let uses = 0;
      const ok = eachLine(c, row, (ix, optional) => {
        if (optional || info.pantry[ix]) return;
        const w = (info.perish[ix] ? 2 : 1) * (useUp[ix] ? 2 : 1);
        tot += w;
        if (have[ix]) {
          got += w;
          hv++;
          if (useUp[ix]) uses++;
        } else ms++;
      });
      if (!ok || tot === 0) continue;
      const coverage = got / tot;
      if (coverage < minCov || hv === 0) continue;
      const score = coverage * 100 + uses * 15 - ms * 4 - c.cols.time[row] * 5 * 0.05;
      gen.push({
        row,
        score: Math.round(score * 100) / 100,
        coverage: Math.round(coverage * 100) / 100,
      });
    }
    gen.sort((a, b) => b.score - a.score || a.row - b.row);
  }

  // Fusion et fenetre.
  const total = legacy.length + gen.length;
  const from = Math.min(offset, total);
  const to = limit ? Math.min(total, from + limit) : total;
  const items = [];
  let li = 0;
  let gi = 0;
  for (let n = 0; n < to; n++) {
    let takeLegacy;
    if (li >= legacy.length) takeLegacy = false;
    else if (gi >= gen.length) takeLegacy = true;
    else takeLegacy = legacy[li].score >= gen[gi].score;
    if (takeLegacy) {
      const it = legacy[li++];
      if (n >= from) items.push(it);
    } else {
      const g = gen[gi++];
      if (n >= from) items.push(describeGen(c, catalog, ings, g, haveKeys, useKeys));
    }
  }
  return { total, items };
}

function describeGen(c, catalog, ings, g, haveKeys, useKeys) {
  const have = new Set(haveKeys);
  const useUp = new Set(useKeys);
  const hv = [];
  const ms = [];
  const uses = [];
  eachLine(c, g.row, (ix, optional) => {
    const key = c.ING[ix];
    const ing = ings[key];
    if (optional || (ing && ing.pantry)) return;
    if (have.has(key)) {
      hv.push(key);
      if (useUp.has(key)) uses.push(key);
    } else ms.push(key);
  });
  return {
    recipe: catalog.getRow(g.row),
    score: g.score,
    coverage: g.coverage,
    have: hv,
    missing: ms,
    uses,
  };
}
