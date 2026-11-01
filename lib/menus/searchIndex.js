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
 * searchCatalog({ catalog, ingredients, lang, query, filters, limit, offset, titleOf, ingredientNameOf, shuffleSeed, diversify })
 * -> { total, refs:Int32Array, legacy:[recette] }
 * refs : fenetre [offset, offset + limit) des resultats triees ; une valeur >= 0 est un numero de case generee,
 * une valeur < 0 designe legacy[-valeur - 1] (recettes ecrites a la main et personnelles, deja filtrees et triees).
 * Ordre : pertinence decroissante ; a pertinence egale, recettes ecrites a la main (par id) puis cases generees
 * (par numero de case, ou melange stable si shuffleSeed est fourni et que la requete est vide).
 * diversify : avec une requete, les cases de meme score sont etalees par modele de titre et ingredient principal
 * (quasi-doublons ecartes, aucun resultat retire).
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
    let idx = null;
    if (words.length) {
      idx = buildTitleIndex(lang);
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
    if (o.diversify && words.length && sorted.length > 2) diversifyRuns(c, idx, sorted, acc);
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

/* ----------------------------------- diversite ----------------------------------- */

// Familles de titres de chaque case, en numeros, calculees une fois par index de langue puis gardees avec lui :
// pre = premier mot du titre normalise (Veloute..., Omelette...) ; tete = trois premiers mots (cuisses de poulet...,
// omelette aux epinards...) ; corps = cinq premiers mots (omelette aux lardons et au..., paves de saumon grilles curry...),
// qui reunit les variantes d'un meme plat dont seule la fin change ; suf = deux derniers mots (... au curry puree maison,
// ... et coco riz), qui reunit les variantes d'un meme modele dont seul le debut change (blancs, cuisses, escalopes...).
function familyKeys(c, idx) {
  if (idx.fam && idx.fam.pre.length === c.N) return idx.fam;
  const pre = new Int32Array(c.N);
  const tete = new Int32Array(c.N);
  const corps = new Int32Array(c.N);
  const suf = new Int32Array(c.N);
  const ids = new Map();
  const idOf = (w) => {
    let id = ids.get(w);
    if (id === undefined) {
      id = ids.size;
      ids.set(w, id);
    }
    return id;
  };
  for (let b = 0; b < idx.blocks.length; b++) {
    const blk = idx.blocks[b];
    if (!blk) continue;
    const count = blk.starts.length - 1;
    const base = b * c.SHARD;
    const s0 = blk.blob;
    for (let i = 0; i < count; i++) {
      let s = blk.starts[i];
      let e = Math.min(blk.starts[i + 1] - 1, s0.length);
      while (s < e && s0.charCodeAt(s) === 32) s++;
      while (e > s && s0.charCodeAt(e - 1) === 32) e--;
      let p = s;
      const finPre = Math.min(e, s + 16);
      while (p < finPre && s0.charCodeAt(p) !== 32) p++;
      pre[base + i] = idOf('p' + s0.slice(s, p));
      // fin du troisieme puis du cinquieme mot
      let h = s;
      let h3 = e;
      for (let mots = 0; h < e && mots < 5; mots++) {
        while (h < e && s0.charCodeAt(h) === 32) h++;
        while (h < e && s0.charCodeAt(h) !== 32) h++;
        if (mots === 2) h3 = h;
      }
      tete[base + i] = idOf('h' + s0.slice(s, Math.min(h3, s + 40)));
      corps[base + i] = idOf('c' + s0.slice(s, Math.min(h, s + 60)));
      // debut de l'avant-dernier mot
      let q = e;
      while (q > s && s0.charCodeAt(q - 1) !== 32) q--;
      if (q > s) {
        q--;
        while (q > s && s0.charCodeAt(q - 1) !== 32) q--;
      }
      suf[base + i] = idOf('s' + s0.slice(Math.max(q, e - 40), e));
    }
  }
  idx.fam = { pre, tete, corps, suf, n: ids.size };
  return idx.fam;
}

// Etalement de arr[a, b) : les cases de chaque famille (keyOf) sont reparties regulierement sur tout le groupe
// (les m cases d une famille tombent a 1/m d ecart l une de l autre), au lieu d une grande famille regroupee en fin de liste.
// Appele de la famille la plus fine a la plus large : chaque passe garde l'etalement des precedentes a l'interieur de ses familles.
function etaler(arr, a, b, keyOf, size, seen, slot, cnt, src) {
  const n = b - a;
  for (let i = a; i < b; i++) size[keyOf[arr[i]]]++;
  cnt.fill(0, 0, n + 1);
  for (let i = a; i < b; i++) {
    const k = keyOf[arr[i]];
    // Rang tourne et position decalee d'une quantite propre a la famille (nombres d'or et plastique) : deux familles de
    // meme structure ne presentent pas leurs variantes dans le meme ordre case a case, et une petite famille peut
    // paraitre des le debut du groupe au lieu d'attendre la position 1/2 de sa taille.
    const m = size[k];
    // valeurs positives : | 0 tronque comme Math.floor, sans appel de fonction dans la boucle
    const r = (seen[k]++ + ((((k * 0.6180339887) % 1) * m) | 0)) % m;
    let at = (((r + ((k * 0.7548776662) % 1)) / m) * n) | 0;
    if (at >= n) at = n - 1;
    slot[i - a] = at;
    cnt[at + 1]++;
  }
  for (let i = a; i < b; i++) {
    size[keyOf[arr[i]]] = 0;
    seen[keyOf[arr[i]]] = 0;
  }
  // tri par denombrement de la position visee (lineaire, stable : a position egale, l'ordre actuel est garde)
  for (let i = 1; i <= n; i++) cnt[i] += cnt[i - 1];
  for (let i = 0; i < n; i++) src[cnt[slot[i]]++] = arr[a + i];
  for (let i = 0; i < n; i++) arr[a + i] = src[i];
}

// Fenetre courte : la case retenue vient des toutes prochaines, l'etalement regulier est garde (une grande fenetre
// epuiserait vite les petites familles en tete et regrouperait la plus grande en fin de liste).
const DIV_WINDOW = 24;
const DIV_AVANCE = 6; // une case ne passe jamais plus de DIV_AVANCE places avant sa position etalee
const DIV_MEMO = 4; // cases precedentes dont on evite de repeter le modele
// Penalites d'une case selon les precedentes. Meme modele (trois ou cinq premiers mots, deux derniers) ou meme
// ingredient principal que la case juste avant pese plus que tout le reste reuni : retenu seulement faute d'autre choix.
const P_VOISIN = 1000;
const P_PRE = 40; // meme premier mot que la case juste avant
const P_MODELE = 6; // meme modele qu'une des DIV_MEMO precedentes

// Choix glouton sur tout arr[a, b) (liste chainee, retrait en temps constant) : a chaque place, la premiere case
// de penalite nulle parmi les suivantes (au plus DIV_WINDOW, pas plus de DIV_AVANCE places en avance), sinon la moins
// penalisee (la plus haute a egalite).
function eviterVoisins(arr, a, b, f, main) {
  const { pre, tete, corps, suf } = f;
  const n = b - a;
  const val = arr.slice(a, b);
  // Cases restantes : nxt[i] = suivante (-1 en fin) ; la tete de liste est la case fictive n.
  const END = n;
  const nxt = new Int32Array(n + 1);
  for (let i = 0; i < n - 1; i++) nxt[i] = i + 1;
  nxt[n - 1] = -1;
  nxt[END] = 0;
  // Familles des DIV_MEMO dernieres cases placees (indice 0 = la derniere) ; -1 = aucune.
  const hs = new Int32Array(DIV_MEMO).fill(-1);
  const ht = new Int32Array(DIV_MEMO).fill(-1);
  const hc = new Int32Array(DIV_MEMO).fill(-1);
  let hp = -1;
  let hm = -1;
  for (let p = a; p < b; p++) {
    let best = -1;
    let bestPrev = END;
    let bestPen = 1e9;
    let prev = END;
    let cur = nxt[END];
    const limite = p - a + DIV_AVANCE;
    for (let k = 0; cur >= 0 && k < DIV_WINDOW && (k === 0 || cur <= limite); k++) {
      const row = val[cur];
      const sf = suf[row];
      const tf = tete[row];
      const cf = corps[row];
      const mn = main[row]; // 0 : pas d'ingredient principal connu, jamais compte comme le meme
      let pen = 0;
      if (sf === hs[0]) pen += P_VOISIN;
      if (tf === ht[0] || cf === hc[0]) pen += P_VOISIN;
      if (mn && mn === hm) pen += P_VOISIN;
      if (pre[row] === hp) pen += P_PRE;
      for (let d = 1; d < DIV_MEMO && pen < bestPen; d++)
        if (sf === hs[d] || tf === ht[d] || cf === hc[d]) pen += P_MODELE;
      if (pen < bestPen) {
        best = cur;
        bestPrev = prev;
        bestPen = pen;
        if (pen === 0) break;
      }
      prev = cur;
      cur = nxt[cur];
    }
    nxt[bestPrev] = nxt[best];
    const row = val[best];
    arr[p] = row;
    for (let d = DIV_MEMO - 1; d > 0; d--) {
      hs[d] = hs[d - 1];
      ht[d] = ht[d - 1];
      hc[d] = hc[d - 1];
    }
    hs[0] = suf[row];
    ht[0] = tete[row];
    hc[0] = corps[row];
    hp = pre[row];
    hm = main[row];
  }
}

/**
 * Quasi-doublons ecartes sur toute la liste : a pertinence egale (meme score), les variantes d'un meme modele de titre
 * (blancs, cuisses, escalopes... au curry, puree maison ; omelette aux lardons, au jambon... et au chevre) et d'un
 * meme ingredient principal ne se suivent plus tant qu'il reste d'autres familles dans le groupe.
 * 1) chaque famille etalee regulierement sur tout le groupe, de la plus fine (deux derniers mots) a la plus large
 * (premier mot) en passant par l'ingredient principal ; 2) choix glouton a fenetre courte qui separe les voisins
 * restants (borne : taille du groupe x DIV_WINDOW).
 * Simple permutation de chaque groupe de meme score : aucun resultat retire, ordre des scores inchange.
 */
function diversifyRuns(c, idx, sorted, acc) {
  if (!idx) return;
  const f = familyKeys(c, idx);
  const main = c.cols.main1;
  const n = sorted.length;
  const size = new Int32Array(Math.max(f.n, c.ING.length) + 2);
  const seen = new Int32Array(size.length);
  const slot = new Int32Array(n);
  const cnt = new Int32Array(n + 1);
  const src = new Int32Array(n);
  let a = 0;
  while (a < n) {
    const s = acc[sorted[a]];
    let b = a + 1;
    while (b < n && acc[sorted[b]] === s) b++;
    if (b - a > 2) {
      etaler(sorted, a, b, f.suf, size, seen, slot, cnt, src);
      etaler(sorted, a, b, f.corps, size, seen, slot, cnt, src);
      etaler(sorted, a, b, f.tete, size, seen, slot, cnt, src);
      etaler(sorted, a, b, main, size, seen, slot, cnt, src);
      etaler(sorted, a, b, f.pre, size, seen, slot, cnt, src);
      eviterVoisins(sorted, a, b, f, main);
    }
    a = b;
  }
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
