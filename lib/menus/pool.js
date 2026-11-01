// Eligibilite par colonnes, liste courte du solveur, echantillonnage, audit : les algorithmes du catalogue genere.
// Format et budgets : scripts/menus-gen/CONCEPTION.md sections 5 et 8.3.
// Aucun objet recette n'est cree en masse : tout se calcule sur les colonnes (tableaux types) ; un objet n'est
// materialise que pour la liste courte, une page ou une recette ouverte. Aucune fonction ne leve.
import { estObjet, estNombre, arr, hashSeed, seasonOf, parseMealKey } from './util';
import { normalizeProfile, CHILD_FACTOR } from './profile';
import { estimateRecipeCost } from './pricing';
import { dishProfile, dishFamily } from './variety';
import { Catalog, getCore, rowFromId, idFromRow, loadBlock } from './catalog';
import { readInt } from './b64';
import { expandExclusions, recipeWarnings, DERIVES_ALLERGENE, DERIVES_ALIMENT } from './allergens';

export const POOL_PLAN = 240; // taille de la liste courte d'un plan
export const POOL_SWAP = 140; // taille de la liste courte d'un echange
export const POOL_ALL = 300; // en dessous, la liste courte est tout le catalogue (comportement des tableaux)
export const COMPLETION_MAX = 40; // recettes ajoutees par creneau (ingredients deja achetes)

const BUCKET_TOP = 4; // meilleures recettes par (famille, type de proteine)
const MAX_PER_MAIN = 6; // diversite : au plus 6 recettes par ingredient principal
const MAX_PER_FAMILY = 25; // et 25 par famille
const AFFINITY_FAMILIES = 6;
const AFFINITY_MAX = 40;
const CHEAP_PLAN = 20;
const CHEAP_BUDGET = 40;
const RELUE_BONUS = 4; // petite priorite des recettes ecrites a la main et relues
const SEASON_NAMES = ['hiver', 'printemps', 'ete', 'automne'];
const NEUTRE_CLS = 0;
// Case allergie -> tag de regime equivalent (les doutes du build ne sont que dans les tags).
const ALLERGEN_DIET_TAG = {
  gluten: 'sans-gluten',
  lait: 'sans-lactose',
  porc: 'sans-porc',
  'fruits-a-coque': 'sans-fruits-a-coque',
};
// Derives des exclusions (ingredients douteux d'un allergene, derives d'un aliment) : table unique de allergens.js.

/* ------------------------------ eligibilite (profil prepare) ------------------------------ */

const lower = (x) => String(x).toLowerCase();

/** Profil normalise UNE fois, avec ses regimes et exclusions en minuscules. */
export function prepareElig(profile) {
  const p = normalizeProfile(profile);
  const x = expandExclusions(p.excludedIngredients);
  return {
    p,
    diets: p.diets.map(lower),
    ex: new Set(p.excludedIngredients.map(lower)),
    alg: x.allergens, // allergenes refuses (exclusions et familles des aliments exclus)
    keys: x.keys, // cles d'ingredients refusees (exclusions et leurs derives)
  };
}

/** Signature de l'eligibilite : regimes tries, exclusions triees, temps maximum. */
export function eligSig(e) {
  return [[...e.diets].sort().join(','), [...e.ex].sort().join(','), e.p.maxTimeMin || 0].join('|');
}

/** Signature des seules restrictions alimentaires (regimes et exclusions), sans le temps ni le placard. */
export function restrictionSig(profile) {
  const e = profile && profile.p && profile.diets ? profile : prepareElig(profile);
  return [[...e.diets].sort().join(','), [...e.ex].sort().join(',')].join('|');
}

/** Signature d'un profil pour les listes courtes (eligibilite plus placard). */
export function profileSig(profile) {
  const e = profile && profile.p && profile.diets ? profile : prepareElig(profile);
  return `${eligSig(e)}|${[...e.p.pantry].sort().join(',')}`;
}

/**
 * Pourquoi une recette (objet) est refusee : 'invalid' | 'custom' | 'diet' | 'excluded' | 'time' | null.
 * Identique a rejectReason de planner.js, mais le profil est deja prepare.
 */
export function rejectWith(recipe, ingredients, e) {
  const p = e.p;
  if (!estObjet(recipe) || typeof recipe.id !== 'string' || !recipe.id) return 'invalid';
  const list = arr(recipe.ingredients).filter((i) => estObjet(i) && i.key);
  if (list.length === 0) return 'invalid';
  if (recipe.custom && (p.diets.length > 0 || p.excludedIngredients.length > 0)) return 'custom';
  if (e.diets.length) {
    const tags = new Set(arr(recipe.tags).map(lower));
    for (const d of e.diets) if (!tags.has(d)) return 'diet';
  }
  if (e.ex.size) {
    const alg = e.alg || e.ex;
    const keys = e.keys || e.ex;
    if (recipe.generated) {
      // meme exigence que les masques du catalogue : case allergie au moins aussi stricte que le regime
      const tg = new Set(arr(recipe.tags).map(lower));
      for (const x of alg) {
        const need = ALLERGEN_DIET_TAG[x];
        if (need && !tg.has(need)) return 'excluded';
      }
    }
    for (const it of list) {
      if (keys.has(lower(it.key))) return 'excluded';
      const ing = ingredients ? ingredients[it.key] : null;
      for (const a of arr(ing && ing.allergens)) if (alg.has(lower(a))) return 'excluded';
    }
  }
  if (p.maxTimeMin && estNombre(Number(recipe.timeMin)) && Number(recipe.timeMin) > p.maxTimeMin)
    return 'time';
  return null;
}

/** Ingredient principal d'une recette ecrite a la main (cle) : la viande ou le poisson le plus lourd, sinon le premier hors placard. */
export function mainKeyOf(recipe, ings) {
  let best = null;
  let bestQty = -1;
  for (const it of arr(recipe.ingredients)) {
    if (!estObjet(it) || !it.key || it.optional) continue;
    const ing = ings[it.key];
    if (ing && ing.aisle === 'viandes-poissons' && Number(it.qty) > bestQty) {
      best = it.key;
      bestQty = Number(it.qty);
    }
  }
  if (best) return best;
  for (const it of arr(recipe.ingredients)) {
    if (estObjet(it) && it.key && !(ings[it.key] && ings[it.key].pantry)) return it.key;
  }
  return null;
}

/* ------------------------------ index et donnees derivees du noyau ------------------------------ */

const ready = (c) => !!c && c.status === 'ready' && c.alive > 0;

/** true si `recipes` est une facade Catalog dont le catalogue genere est utilisable. */
export function catalogActive(recipes) {
  if (!(recipes instanceof Catalog)) return false;
  try {
    return ready(getCore());
  } catch (_e) {
    return false;
  }
}

/** Donnees par ingredient (index du noyau) : type de proteine, placard, perissable, indice par cle. Cachees par table d'ingredients. */
export function ingInfo(c, ings) {
  if (c.ingInfo && c.ingInfo.ings === ings) return c.ingInfo;
  const n = c.ING.length;
  const cls = new Uint8Array(n); // 0 vegetal, 1 viande, 2 poisson ou crustace
  const pantry = new Uint8Array(n);
  const perish = new Uint8Array(n);
  const idx = new Map();
  for (let i = 0; i < n; i++) {
    const key = c.ING[i];
    idx.set(key, i + 1);
    const f = ings ? ings[key] : null;
    if (!f) continue;
    if (f.pantry) pantry[i] = 1;
    if (
      f.aisle === 'fruits-legumes' ||
      f.aisle === 'viandes-poissons' ||
      f.aisle === 'cremerie' ||
      f.aisle === 'boulangerie'
    )
      perish[i] = 1;
    if (f.aisle === 'viandes-poissons') {
      const al = arr(f.allergens).map(lower);
      cls[i] = al.includes('poisson') || al.includes('crustaces') ? 2 : 1;
    }
  }
  c.ingInfo = { ings, cls, pantry, perish, idx };
  return c.ingInfo;
}

/**
 * Construction par blocs de l'index inverse ingredient -> cases (cases non retirees, une fois par case).
 * Etat gardé sur le noyau (c.invBuild) : un appel synchrone peut reprendre une construction commencee en tranches.
 * step() lit un bloc de lignes ; renvoie false tant qu'il en reste, true une fois c.inv renseigne (null si illisible).
 */
function invBuilder(c) {
  if (c.invBuild) return c.invBuild;
  const nIng = c.ING.length;
  const { N, cols } = c;
  let total = 0;
  for (let i = 0; i < N; i++) if (!(cols.flags[i] & 4)) total += cols.nIng[i];
  const st = {
    b: 0,
    t: 0,
    tIdx: new Uint16Array(total),
    tRow: new Uint32Array(total),
    count: new Uint32Array(nIng + 1),
    last: new Int32Array(nIng).fill(-1),
    step() {
      try {
        const { SHARD, lineStart, LW } = c;
        if (this.b >= c.nBlocks) return this.finish();
        const b = this.b;
        const text = loadBlock(c, 'lines', b);
        if (!text) {
          c.inv = null;
          return true;
        }
        const end = Math.min(N, (b + 1) * SHARD);
        const { tIdx, tRow, count, last } = this;
        let t = this.t;
        for (let i = b * SHARD; i < end; i++) {
          if (cols.flags[i] & 4) continue;
          const n = cols.nIng[i];
          const s0 = lineStart[i];
          for (let k = 0; k < n; k++) {
            const v = readInt(text, (s0 + k) * LW, LW);
            if (v < 0) {
              c.inv = null;
              return true;
            }
            const ix = v & 511;
            if (ix >= nIng || last[ix] === i) continue;
            last[ix] = i;
            tIdx[t] = ix;
            tRow[t] = i;
            t++;
            count[ix + 1]++;
          }
        }
        this.t = t;
        this.b++;
        return this.b >= c.nBlocks ? this.finish() : false;
      } catch (_e) {
        c.inv = null;
        return true;
      }
    },
    finish() {
      const { tIdx, tRow, count, t } = this;
      const start = new Uint32Array(nIng + 1);
      for (let i = 0; i < nIng; i++) start[i + 1] = start[i] + count[i + 1];
      const rows = new Uint32Array(t);
      const fill = start.slice(0, nIng);
      for (let k = 0; k < t; k++) rows[fill[tIdx[k]]++] = tRow[k];
      c.inv = { start, rows };
      return true;
    },
  };
  c.invBuild = st;
  return st;
}

/** Index inverse ingredient -> cases, construit a la demande. null si un bloc est illisible. */
export function ingredientIndex(c) {
  if (c.inv !== undefined) return c.inv;
  try {
    const st = invBuilder(c);
    while (c.inv === undefined) st.step();
  } catch (_e) {
    c.inv = null;
  }
  c.invBuild = null;
  return c.inv;
}

/** Prechauffe l'index inverse un bloc a la fois, en rendant la main entre deux blocs (ne leve jamais). */
export async function warmIngredientIndex({ yieldFn, cancelled } = {}) {
  try {
    const c = getCore();
    if (!c || c.status !== 'ready' || c.inv !== undefined) return;
    const st = invBuilder(c);
    while (c.inv === undefined) {
      if (typeof cancelled === 'function' && cancelled()) return;
      st.step();
      if (c.inv === undefined && typeof yieldFn === 'function') await yieldFn();
    }
    c.invBuild = null;
  } catch (_e) {
    /* l'index se construira a la demande */
  }
}

/** Index inverse ingredient principal (main1, main2) -> cases ; instantane (deux colonnes). */
export function mainIndex(c) {
  if (c.mainInv) return c.mainInv;
  const nIng = c.ING.length;
  const { N, cols } = c;
  const count = new Uint32Array(nIng + 1);
  for (let i = 0; i < N; i++) {
    if (cols.flags[i] & 4) continue;
    const a = cols.main1[i];
    const b = cols.main2[i];
    if (a > 0 && a <= nIng) count[a]++;
    if (b > 0 && b <= nIng && b !== a) count[b]++;
  }
  const start = new Uint32Array(nIng + 1);
  for (let i = 0; i < nIng; i++) start[i + 1] = start[i] + count[i + 1];
  const rows = new Uint32Array(start[nIng]);
  const fill = start.slice(0, nIng);
  for (let i = 0; i < N; i++) {
    if (cols.flags[i] & 4) continue;
    const a = cols.main1[i];
    const b = cols.main2[i];
    if (a > 0 && a <= nIng) rows[fill[a - 1]++] = i;
    if (b > 0 && b <= nIng && b !== a) rows[fill[b - 1]++] = i;
  }
  c.mainInv = { start, rows };
  return c.mainInv;
}

/** Cases contenant l'ingredient (index 0..n-1 de ING_KEYS), ou null si l'index est indisponible. */
export function rowsOfIngredient(c, ingIdx) {
  const inv = ingredientIndex(c);
  return inv && ingIdx >= 0 && ingIdx < c.ING.length
    ? inv.rows.subarray(inv.start[ingIdx], inv.start[ingIdx + 1])
    : null;
}

const tagBit = (c, name) => {
  const k = c.TAGS.indexOf(name);
  return k >= 0 ? 1 << k : 0;
};
const seasonMask = (c) => {
  let m = 0;
  for (const s of SEASON_NAMES) m |= tagBit(c, s);
  return m;
};

/* ------------------------------ eligibilite des cases generees ------------------------------ */

function genEligibility(c, ings, e, fallback) {
  const sig = eligSig(e) + (fallback ? '|fb' : '');
  const cache = c.genElig || (c.genElig = []);
  for (let i = 0; i < cache.length; i++) {
    if (cache[i].sig === sig && cache[i].ings === ings) {
      const hit = cache[i];
      if (i !== 0) {
        cache.splice(i, 1);
        cache.unshift(hit);
      }
      return hit;
    }
  }
  const { N, cols } = c;
  const algKeys = Array.isArray(c.meta.ALG_KEYS) ? c.meta.ALG_KEYS : [];
  let dm = 0;
  let dietImpossible = false;
  for (const d of e.diets) {
    const k = c.TAGS.indexOf(d);
    if (k < 0) dietImpossible = true;
    else dm |= 1 << k;
  }
  // Exclusions : masque d'allergenes pour les noms connus, marquage par ingredient pour le reste.
  let am = 0;
  let xm = 0; // tags de regime exiges par les cases allergie
  const alg = e.alg || e.ex;
  const keys = e.keys || e.ex;
  for (const x of alg) {
    const k = algKeys.indexOf(x);
    if (k >= 0) am |= 1 << k;
    // une case allergie est au moins aussi stricte que le regime correspondant : les doutes du build
    // (charcuteries, moutarde, merguez, texte des etapes) ne sont que dans les tags de regime
    const tg = ALLERGEN_DIET_TAG[x];
    if (tg) {
      const kt = c.TAGS.indexOf(tg);
      if (kt >= 0) xm |= 1 << kt;
    }
  }
  // cles refusees (exclusions et derives) : ingredients a exclure par leur cle
  const marked = [];
  if (e.ex.size) {
    for (let i = 0; i < c.ING.length; i++) {
      const key = c.ING[i];
      const f = ings ? ings[key] : null;
      const lk = lower(key);
      let hit = false;
      if (keys.has(lk)) {
        // une cle qui est aussi un nom d'allergene de sa propre fiche (lait) est deja couverte par le masque
        const covered =
          alg.has(lk) &&
          algKeys.indexOf(lk) >= 0 &&
          arr(f && f.allergens).some((a) => lower(a) === lk);
        hit = !covered;
      }
      if (!hit) {
        for (const a of arr(f && f.allergens)) {
          const la = lower(a);
          if (alg.has(la) && algKeys.indexOf(la) < 0) {
            hit = true;
            break;
          }
        }
      }
      if (hit) marked.push(i);
    }
  }
  let exRow = null;
  if (marked.length) {
    const inv = ingredientIndex(c);
    if (inv) {
      exRow = new Uint8Array(N);
      for (const ix of marked)
        for (let k = inv.start[ix]; k < inv.start[ix + 1]; k++) exRow[inv.rows[k]] = 1;
    } else {
      // index indisponible (bloc illisible) : par prudence aucune recette generee n'est admise
      dietImpossible = true;
    }
  }
  const maxT = e.p.maxTimeMin || 0;
  const side = c.SUBS.indexOf('accompagnements');
  const all = new Uint8Array(N);
  const mainsTmp = new Uint32Array(N);
  const rejected = { diet: 0, excluded: 0, time: 0 };
  let nAll = 0;
  let nMains = 0;
  for (let i = 0; i < N; i++) {
    if (cols.flags[i] & 4) continue;
    if (dietImpossible || (cols.tags[i] & dm) !== dm) {
      rejected.diet++;
      continue;
    }
    if ((am && cols.alg[i] & am) || (xm && (cols.tags[i] & xm) !== xm) || (exRow && exRow[i])) {
      rejected.excluded++;
      continue;
    }
    if (maxT && cols.time[i] * 5 > maxT) {
      rejected.time++;
      continue;
    }
    all[i] = 1;
    nAll++;
    const co = cols.course[i];
    // Les accompagnements sont de course entree depuis le build ; la garde sur la categorie reste par securite
    // (anciennes donnees).
    if ((co === 0 && cols.sub[i] !== side) || (fallback && co === 1)) mainsTmp[nMains++] = i;
  }
  const rows = mainsTmp.slice(0, nMains);
  const info = ingInfo(c, ings);
  const cost = new Uint16Array(nMains);
  const time = new Uint16Array(nMains);
  const prot = new Uint16Array(nMains);
  const tags = new Uint32Array(nMains);
  const fam = new Uint8Array(nMains);
  const cls = new Uint8Array(nMains);
  const main1 = new Uint16Array(nMains);
  const main2 = new Uint16Array(nMains);
  for (let g = 0; g < nMains; g++) {
    const r = rows[g];
    cost[g] = cols.cost[r];
    time[g] = cols.time[r] * 5;
    prot[g] = cols.prot[r];
    tags[g] = cols.tags[r];
    fam[g] = cols.family[r];
    const m1 = cols.main1[r];
    main1[g] = m1;
    main2[g] = cols.main2[r];
    cls[g] = m1 > 0 ? info.cls[m1 - 1] : NEUTRE_CLS;
  }
  const out = {
    sig,
    ings,
    all,
    nAll,
    rows,
    nMains,
    rejected,
    cost,
    time,
    prot,
    tags,
    fam,
    cls,
    main1,
    main2,
  };
  cache.unshift(out);
  if (cache.length > 4) cache.pop();
  return out;
}

/* ------------------------------ eligibilite complete (ecrites a la main + generees) ------------------------------ */

const famIdOf = (c, name) => {
  if (!name) return 0;
  const k = c.FAMILIES.indexOf(name);
  if (k >= 0) return k + 1;
  const extra = c.extraFam || (c.extraFam = new Map());
  if (!extra.has(name)) extra.set(name, c.FAMILIES.length + 1 + extra.size);
  return extra.get(name);
};

/**
 * Eligibilite du catalogue pour un profil : { p, e, M, L, mainCount, rejected, allows(id), ... }.
 * Entrees (plats) numerotees : 0..L-1 = recettes ecrites a la main (objets, par identifiant), puis L.. = cases generees.
 * Mis en cache par facade, profil et table d'ingredients (4 profils). Ne leve pas.
 */
export function eligibleCatalog(cat, ingredients, profile) {
  const c = getCore();
  const ings = estObjet(ingredients) ? ingredients : {};
  const e = profile && profile.p && profile.diets ? profile : prepareElig(profile);
  const sig = eligSig(e);
  const slot = cat.__elig || (cat.__elig = []);
  for (let i = 0; i < slot.length; i++) {
    if (slot[i].sig === sig && slot[i].ings === ings && slot[i].core === c) {
      const hit = slot[i];
      if (i !== 0) {
        slot.splice(i, 1);
        slot.unshift(hit);
      }
      return hit;
    }
  }
  const rejected = { invalid: 0, diet: 0, excluded: 0, time: 0 };
  const sorted = cat
    .values()
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const legacyAll = [];
  for (const r of sorted) {
    const why = rejectWith(r, ings, e);
    if (why) rejected[why] = (rejected[why] || 0) + 1;
    else legacyAll.push(r);
  }
  let legacyMains = legacyAll.filter((r) => !r.course || r.course === 'plat');
  let fallback = false;
  let gen = genEligibility(c, ings, e, false);
  if (legacyMains.length === 0 && gen.nMains === 0) {
    fallback = true;
    legacyMains = legacyAll.filter((r) => r.course !== 'dessert' && r.course !== 'petit-dejeuner');
    gen = genEligibility(c, ings, e, true);
  }
  rejected.diet += gen.rejected.diet;
  rejected.excluded += gen.rejected.excluded;
  rejected.time += gen.rejected.time;

  const L = legacyMains.length;
  const G = gen.nMains;
  const M = L + G;
  const info = ingInfo(c, ings);
  const cost = new Uint16Array(M);
  const time = new Uint16Array(M);
  const prot = new Uint16Array(M);
  const tags = new Uint32Array(M);
  const fam = new Uint8Array(M);
  const cls = new Uint8Array(M);
  const main1 = new Uint16Array(M);
  const main2 = new Uint16Array(M);
  const legacyIndex = new Map();
  for (let i = 0; i < L; i++) {
    const r = legacyMains[i];
    legacyIndex.set(r.id, i);
    const dp = dishProfile(r, ings);
    const per = estimateRecipeCost(r, ings, r.servings || 4).perPerson;
    cost[i] = Math.max(0, Math.min(4095, Math.round(per * 10)));
    time[i] = estNombre(Number(r.timeMin)) ? Number(r.timeMin) : 30;
    prot[i] = Number(r.protein) > 0 ? Math.round(Number(r.protein)) : 0;
    let tm = 0;
    for (const t of arr(r.tags)) tm |= tagBit(c, t);
    tags[i] = tm;
    fam[i] = famIdOf(c, dp.family);
    const m1 = dp.main ? info.idx.get(dp.main) || 0 : 0;
    main1[i] = m1;
    main2[i] = dp.mains && dp.mains[1] ? info.idx.get(dp.mains[1]) || 0 : 0;
    cls[i] = m1 > 0 ? info.cls[m1 - 1] : NEUTRE_CLS;
  }
  cost.set(gen.cost, L);
  time.set(gen.time, L);
  prot.set(gen.prot, L);
  tags.set(gen.tags, L);
  fam.set(gen.fam, L);
  cls.set(gen.cls, L);
  main1.set(gen.main1, L);
  main2.set(gen.main2, L);
  const entryOfRow = new Int32Array(c.N).fill(-1);
  for (let g = 0; g < G; g++) entryOfRow[gen.rows[g]] = L + g;
  const legacyAllIds = new Set(legacyAll.map((r) => r.id));

  const el = {
    sig,
    ings,
    core: c,
    e,
    p: e.p,
    cat,
    L,
    G,
    M,
    legacyAll,
    legacyMains,
    legacyIndex,
    legacyAllIds,
    gen,
    fallback,
    cost,
    time,
    prot,
    tags,
    fam,
    cls,
    main1,
    main2,
    entryOfRow,
    mainCount: M,
    rejected,
    scratch: null,
    cheapOrder: null,
    /** true si la recette (tout type de repas) est admise par le profil. */
    allows(id) {
      if (typeof id !== 'string') return false;
      if (legacyAllIds.has(id)) return true;
      const row = rowFromId(id);
      return row >= 0 && row < c.N && gen.all[row] === 1;
    },
    /** Numero d'entree d'un identifiant de plat admis, ou -1. */
    entryOf(id) {
      if (typeof id !== 'string') return -1;
      const k = legacyIndex.get(id);
      if (k !== undefined) return k;
      const row = rowFromId(id);
      return row >= 0 && row < c.N ? entryOfRow[row] : -1;
    },
    idOfEntry(en) {
      return en < L ? legacyMains[en].id : idFromRow(gen.rows[en - L]);
    },
    rowOfEntry(en) {
      return en < L ? -1 : gen.rows[en - L];
    },
    objOfEntry(en) {
      return en < L ? legacyMains[en] : cat.getRow(gen.rows[en - L]);
    },
  };
  slot.unshift(el);
  if (slot.length > 4) slot.pop();
  return el;
}

/** Liste des plats admis de la partie ecrite a la main (objets), triee par identifiant. */
export const legacyMainsOf = (el) => el.legacyMains;

/* ------------------------------ tris par cout ------------------------------ */

/**
 * Entrees triees par cout (colonne cost) croissant puis numero : Uint32Array, cache dans l'eligibilite.
 */
function cheapOrder(el) {
  if (el.cheapOrder) return el.cheapOrder;
  const M = el.M;
  // M peut depasser 16384 (14 bits du numero d'entree) : tri classique
  if (M > 16384) {
    const idx = new Uint32Array(M);
    for (let i = 0; i < M; i++) idx[i] = i;
    const arrIdx = Array.from(idx);
    arrIdx.sort((a, b) => el.cost[a] - el.cost[b] || a - b);
    el.cheapOrder = Uint32Array.from(arrIdx);
    return el.cheapOrder;
  }
  const keys = new Uint32Array(M);
  for (let i = 0; i < M; i++) keys[i] = el.cost[i] * 16384 + i;
  keys.sort();
  const out = new Uint32Array(M);
  for (let i = 0; i < M; i++) out[i] = keys[i] & 16383;
  el.cheapOrder = out;
  return out;
}

/**
 * Les n entrees les moins cheres, au plus `perMain` par ingredient principal (0 = sans limite)
 * et `perBucket` par (famille, type de proteine) (0 = sans limite).
 */
export function cheapest(el, n, { perMain = 0, perBucket = 0, skip } = {}) {
  const order = cheapOrder(el);
  const out = [];
  const mainCnt = perMain ? new Uint8Array(65536) : null;
  const buckCnt = perBucket ? new Uint8Array(1024) : null;
  for (let k = 0; k < order.length && out.length < n; k++) {
    const en = order[k];
    if (skip && skip[en]) continue;
    if (mainCnt) {
      const m = el.main1[en];
      if (m > 0 && mainCnt[m] >= perMain) continue;
    }
    if (buckCnt) {
      const b = (el.fam[en] * 3 + el.cls[en]) & 1023;
      if (buckCnt[b] >= perBucket) continue;
    }
    if (mainCnt && el.main1[en] > 0) mainCnt[el.main1[en]]++;
    if (buckCnt) buckCnt[(el.fam[en] * 3 + el.cls[en]) & 1023]++;
    out.push(en);
  }
  return out;
}

/* ------------------------------ liste courte ------------------------------ */

function noiseOf(key, seedInt) {
  let h = Math.imul((key + 1) | 0, 0x9e3779b1) ^ seedInt;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Score statique de chaque entree (colonnes seules). Renvoie un Float32Array (tampon reutilise). */
function staticScores(el, seedInt, profile) {
  const { M, L, cost, time, tags, prot } = el;
  const c = el.core;
  const sc =
    el.scratch && el.scratch.length === M ? el.scratch : (el.scratch = new Float32Array(M));
  // profil COURANT (budget, enfants, mois) : l'eligibilite en cache garde celui du premier appel
  const p = profile || el.p;
  const persons = Math.max(1, p.adults + p.children * CHILD_FACTOR);
  const budget = !!p.budget;
  const kids = p.children > 0;
  const bEnf = tagBit(c, 'enfants');
  const bEco = tagBit(c, 'economique');
  const bRap = tagBit(c, 'rapide');
  const seasonBits = seasonMask(c);
  const season = seasonOf(p.month);
  const sBit = season ? tagBit(c, season) : 0;
  const k = (budget ? 3.2 : 1.6) * persons * 0.1;
  const genRows = el.gen.rows;
  for (let i = 0; i < M; i++) {
    const t = tags[i];
    let s = -cost[i] * k;
    if (kids && t & bEnf) s += 3;
    if (budget && t & bEco) s += 2;
    if (t & bRap) s += 1;
    s -= time[i] * 0.1;
    if (sBit) {
      const own = t & seasonBits;
      if (own) s += own & sBit ? 3 : -6;
    }
    s += prot[i] * 0.04;
    s += noiseOf(i < L ? i : genRows[i - L] + 65536, seedInt) * 6;
    if (i < L) s += RELUE_BONUS;
    sc[i] = s;
  }
  return sc;
}

/**
 * Liste courte : entrees choisies par colonnes, stratifiee (famille x type de proteine), avec plafond de diversite,
 * affinite (ingredients principaux de la semaine ou des meilleures lignes) et recettes economiques.
 * opts : { seed, K, forced:[entree], weekMains:[index d'ingredient + 1], cheap, profile (profil courant : budget, enfants, mois) }
 * -> { entries:[entree], flag:Uint8Array(M) }. Deterministe : le rng est dedie (graine + ':pool').
 */
export function buildPool(el, opts = {}) {
  const { M, L } = el;
  const K = opts.K || POOL_PLAN;
  const flag = new Uint8Array(M);
  if (M <= POOL_ALL || K >= M) {
    const entries = [];
    for (let i = 0; i < M; i++) {
      flag[i] = 1;
      entries.push(i);
    }
    return { entries, flag };
  }
  const c = el.core;
  const seedStr =
    String(opts.seed === undefined || opts.seed === null ? 'pearl' : opts.seed) + ':pool';
  const seedInt = hashSeed(seedStr);
  const prof = opts.profile && typeof opts.profile === 'object' ? opts.profile : el.p;
  const sc = staticScores(el, seedInt, prof);
  const nIng = c.ING.length;
  const mainCnt = new Uint8Array(nIng + 2);
  const famCnt = new Uint8Array(256);
  const entries = [];
  const add = (en, force) => {
    if (flag[en]) return false;
    if (!force) {
      if (entries.length >= K) return false;
      const m = el.main1[en];
      if (m > 0 && mainCnt[m] >= MAX_PER_MAIN) return false;
      if (famCnt[el.fam[en]] >= MAX_PER_FAMILY && el.fam[en] > 0) return false;
    }
    flag[en] = 1;
    const m = el.main1[en];
    if (m > 0 && mainCnt[m] < 255) mainCnt[m]++;
    if (famCnt[el.fam[en]] < 255) famCnt[el.fam[en]]++;
    entries.push(en);
    return true;
  };

  for (const en of arr(opts.forced)) if (en >= 0 && en < M) add(en, true);

  // 1. Seaux stratifies : les meilleures de chaque (famille, type de proteine).
  const nBuckets = (c.FAMILIES.length + 1 + (c.extraFam ? c.extraFam.size : 0)) * 3;
  const top = new Int32Array(nBuckets * BUCKET_TOP).fill(-1);
  for (let i = 0; i < M; i++) {
    const b = (el.fam[i] * 3 + el.cls[i]) * BUCKET_TOP;
    const s = sc[i];
    let j = BUCKET_TOP - 1;
    if (top[b + j] >= 0 && sc[top[b + j]] >= s) continue;
    while (j > 0 && (top[b + j - 1] < 0 || sc[top[b + j - 1]] < s)) {
      top[b + j] = top[b + j - 1];
      j--;
    }
    top[b + j] = i;
  }
  const bestOfBucket = [];
  for (let b = 0; b < nBuckets; b++) {
    const first = top[b * BUCKET_TOP];
    if (first >= 0) bestOfBucket.push(first);
  }
  for (let r = 0; r < BUCKET_TOP; r++)
    for (let b = 0; b < nBuckets; b++) {
      const en = top[b * BUCKET_TOP + r];
      if (en >= 0) add(en, false);
    }

  // 2. Affinite : ingredients principaux de la semaine, sinon des 6 meilleures lignes de familles differentes.
  let seeds = arr(opts.weekMains).filter((x) => x > 0);
  if (seeds.length === 0) {
    const firsts = bestOfBucket.slice().sort((a, b) => sc[b] - sc[a] || a - b);
    const seenFam = new Set();
    for (const en of firsts) {
      if (seenFam.size >= AFFINITY_FAMILIES) break;
      const f = el.fam[en];
      if (f > 0 && seenFam.has(f)) continue;
      seenFam.add(f);
      if (el.main1[en] > 0) seeds.push(el.main1[en]);
      if (el.main2[en] > 0) seeds.push(el.main2[en]);
    }
  }
  if (seeds.length) {
    const seedSet = new Set(seeds);
    const inv = mainIndex(c);
    const cand = [];
    for (const s of seedSet) {
      if (s > nIng) continue;
      for (let k = inv.start[s - 1]; k < inv.start[s]; k++) {
        const en = el.entryOfRow[inv.rows[k]];
        if (en >= 0 && !flag[en]) cand.push(en);
      }
    }
    for (let i = 0; i < L; i++)
      if (!flag[i] && (seedSet.has(el.main1[i]) || seedSet.has(el.main2[i]))) cand.push(i);
    cand.sort((a, b) => sc[b] - sc[a] || a - b);
    let added = 0;
    let last = -1;
    for (const en of cand) {
      if (added >= AFFINITY_MAX) break;
      if (en === last) continue;
      last = en;
      if (add(en, false)) added++;
    }
  }

  // 3. Economiques : les moins chers, au plus un par seau.
  const nCheap = opts.cheap || (prof.budget ? CHEAP_BUDGET : CHEAP_PLAN);
  for (const en of cheapest(el, nCheap * 3, { perBucket: 1 })) {
    if (entries.length >= K) break;
    add(en, false);
  }

  // 4. Complement par score (histogramme, puis tri d'un petit groupe), avec les memes plafonds.
  for (let round = 0; round < 3 && entries.length < K; round++) {
    const need = K - entries.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < M; i++) {
      if (flag[i]) continue;
      if (sc[i] < lo) lo = sc[i];
      if (sc[i] > hi) hi = sc[i];
    }
    if (!(hi >= lo)) break;
    const BINS = 128;
    const width = (hi - lo) / BINS || 1;
    const hist = new Uint32Array(BINS + 1);
    for (let i = 0; i < M; i++) if (!flag[i]) hist[Math.min(BINS, ((sc[i] - lo) / width) | 0)]++;
    let acc = 0;
    let cut = BINS;
    const want = round === 2 ? M : need * (round === 0 ? 3 : 20);
    for (; cut >= 0; cut--) {
      acc += hist[cut];
      if (acc >= want) break;
    }
    const cand = [];
    for (let i = 0; i < M; i++)
      if (!flag[i] && Math.min(BINS, ((sc[i] - lo) / width) | 0) >= Math.max(0, cut)) cand.push(i);
    cand.sort((a, b) => sc[b] - sc[a] || a - b);
    for (const en of cand) {
      if (entries.length >= K) break;
      add(en, false);
    }
  }
  return { entries, flag };
}

/**
 * Recettes hors liste courte partageant les ingredients les plus presents des courses deja prevues.
 * keyIdx : indices d'ingredient + 1 (les 3 plus presents) ; offset tire par l'appelant ; renvoie des entrees.
 */
export function completionEntries(el, pool, keyIdx, offsetRand, max = COMPLETION_MAX) {
  const c = el.core;
  const nIng = c.ING.length;
  const set = new Set(keyIdx.filter((k) => k > 0 && k <= nIng));
  if (set.size === 0) return [];
  const inv = mainIndex(c);
  const cand = [];
  for (const k of set)
    for (let j = inv.start[k - 1]; j < inv.start[k]; j++) {
      const en = el.entryOfRow[inv.rows[j]];
      if (en >= 0 && !pool.flag[en]) cand.push(en);
    }
  for (let i = 0; i < el.L; i++)
    if (!pool.flag[i] && (set.has(el.main1[i]) || set.has(el.main2[i]))) cand.push(i);
  if (cand.length === 0) return [];
  cand.sort((a, b) => a - b);
  const uniq = [];
  for (let i = 0; i < cand.length; i++) if (i === 0 || cand[i] !== cand[i - 1]) uniq.push(cand[i]);
  if (uniq.length <= max) return uniq;
  const off = Math.floor(offsetRand * uniq.length) % uniq.length;
  const out = [];
  for (let i = 0; i < max; i++) out.push(uniq[(off + i) % uniq.length]);
  return out;
}

/* ------------------------------ echantillonnage (suggestions) ------------------------------ */

/**
 * Tire n plats admis au hasard (echantillonnage par reservoir, sans copie ni melange) hors `exclude` (ids),
 * en preferant la saison quand au moins n sont de saison. Renvoie des objets (n au plus decodes).
 * opts : { n, exclude:Set|array d'ids, month, rng }
 */
export function sampleMains(el, opts = {}) {
  const n = Math.max(0, Math.floor(opts.n === undefined ? 3 : opts.n));
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  if (n === 0 || el.M === 0) return [];
  const c = el.core;
  const exclude = opts.exclude instanceof Set ? opts.exclude : new Set(arr(opts.exclude));
  const ex = new Uint8Array(el.M);
  for (const id of exclude) {
    const en = el.entryOf(id);
    if (en >= 0) ex[en] = 1;
  }
  const season = seasonOf(opts.month === undefined ? el.p.month : opts.month);
  const sBit = season ? tagBit(c, season) : 0;
  const seasonBits = seasonMask(c);
  const resAll = [];
  const resSea = [];
  let seenAll = 0;
  let seenSea = 0;
  for (let i = 0; i < el.M; i++) {
    if (ex[i]) continue;
    seenAll++;
    if (resAll.length < n) resAll.push(i);
    else {
      const j = Math.floor(rng() * seenAll);
      if (j < n) resAll[j] = i;
    }
    const own = el.tags[i] & seasonBits;
    if (!sBit || !own || own & sBit) {
      seenSea++;
      if (resSea.length < n) resSea.push(i);
      else {
        const j = Math.floor(rng() * seenSea);
        if (j < n) resSea[j] = i;
      }
    }
  }
  const pick = sBit && seenSea >= n ? resSea : resAll;
  const out = [];
  for (const en of pick) {
    const o = el.objOfEntry(en);
    if (o) out.push(o);
  }
  // melange de la petite liste retenue (l'ordre du reservoir n'est pas aleatoire pour les premiers elements)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------ audit d'un plan sauvegarde ------------------------------ */

/**
 * auditPlan(plan, { recipes, ingredients, profile }) -> [{ key, recipeId, reason }] : repas dont la recette
 * ne respecte plus le profil (regime, exclusion, temps). Les recettes inconnues, les repas libres et les repas
 * poses a la main (manual) sont ignores. Ne leve pas.
 */
export function auditPlan(plan, { recipes, ingredients, profile } = {}) {
  const out = [];
  try {
    const e = prepareElig(profile);
    const ings = estObjet(ingredients) ? ingredients : {};
    const verdict = new Map();
    for (const m of arr(plan && plan.meals)) {
      if (!estObjet(m) || !m.recipeId || m.free || m.manual || !parseMealKey(m.key)) continue;
      if (!verdict.has(m.recipeId)) {
        const r = recipes && typeof recipes.get === 'function' ? recipes.get(m.recipeId) : null;
        verdict.set(m.recipeId, r ? rejectWith(r, ings, e) : null);
      }
      const why = verdict.get(m.recipeId);
      if (why) out.push({ key: m.key, recipeId: m.recipeId, reason: why });
    }
  } catch (_e) {
    /* jamais bloquant */
  }
  return out;
}

/* ------------------------------ repas qui ne conviennent plus au profil ------------------------------ */

/**
 * Pourquoi une recette du catalogue (ecrite a la main ou generee) ne convient pas au profil, avec le detail :
 * { diets:[regimes manquants], allergens:[allergenes refuses], ingredients:[cles d'ingredients ecartees],
 *   found:true }, ou null si elle convient (meme verdict que l'eligibilite des plans, rejectWith, hors temps).
 * Les recettes personnelles relevent de recipeWarnings (allergens.js). Ne leve pas.
 */
export function recipeConflicts(recipe, ingredients, profile) {
  try {
    if (!estObjet(recipe) || recipe.custom) return null;
    const ings = estObjet(ingredients) ? ingredients : {};
    const e = profile && profile.p && profile.diets ? profile : prepareElig(profile);
    const why = rejectWith(recipe, ings, e);
    if (why !== 'diet' && why !== 'excluded') return null;
    const tags = new Set(arr(recipe.tags).map(lower));
    const diets = e.diets.filter((d) => !tags.has(d));
    const allergens = new Set();
    const keys = new Set();
    // aliments ecartes par le profil et leurs derives (sans les doutes des allergenes)
    const aliments = new Set();
    for (const x of e.ex) {
      aliments.add(x);
      for (const k of arr(DERIVES_ALIMENT[x])) aliments.add(k);
    }
    for (const it of arr(recipe.ingredients)) {
      if (!estObjet(it) || !it.key) continue;
      const k = lower(it.key);
      const ing = ings[it.key];
      for (const a of arr(ing && ing.allergens)) if (e.alg.has(lower(a))) allergens.add(lower(a));
      for (const a of e.alg) if (arr(DERIVES_ALLERGENE[a]).includes(k)) allergens.add(a);
      if (aliments.has(k)) keys.add(it.key);
    }
    if (recipe.generated)
      for (const x of e.alg) {
        const need = ALLERGEN_DIET_TAG[x];
        if (need && !tags.has(need)) allergens.add(x);
      }
    // un ingredient qui porte le nom d'un allergene deja cite (lait) n'est pas repete
    const ingredients2 = [...keys].filter((k) => !allergens.has(lower(k)));
    return { diets, allergens: [...allergens], ingredients: ingredients2, found: true };
  } catch (_e) {
    return null;
  }
}

/**
 * unsuitableMeals(plan, { recipes, ingredients, profile, texts }) -> [{ key, recipeId, reason }] : repas de la
 * semaine qui ne conviennent plus aux allergies, regimes ou exclusions du profil (le temps de preparation n'est
 * pas une raison). Meme logique que l'eligibilite (rejectWith, table des derives). Restes compris. Une recette
 * personnelle posee a la main n'est signalee que si quelque chose d'interdit y est repere, et pas quand ce
 * repas a ete accepte pour ces memes restrictions (okFor). Repas libres et recettes inconnues ignores. Ne leve pas.
 */
export function unsuitableMeals(plan, { recipes, ingredients, profile, texts } = {}) {
  const out = [];
  try {
    const e = prepareElig(profile);
    if (!e.diets.length && !e.ex.size) return out;
    const sig = restrictionSig(e);
    const ings = estObjet(ingredients) ? ingredients : {};
    const verdict = new Map();
    for (const m of arr(plan && plan.meals)) {
      if (!estObjet(m) || !m.recipeId || m.free || !parseMealKey(m.key)) continue;
      if (m.manual && m.okFor === sig) continue;
      if (!verdict.has(m.recipeId)) {
        const r = recipes && typeof recipes.get === 'function' ? recipes.get(m.recipeId) : null;
        let why = null;
        if (r && r.custom) {
          const w = recipeWarnings({ recipe: r, profile: e.p, ingredients: ings, texts });
          why = w && w.found ? 'custom' : null;
        } else if (r) {
          const x = rejectWith(r, ings, e);
          why = x === 'diet' || x === 'excluded' ? x : null;
        }
        verdict.set(m.recipeId, why);
      }
      const why = verdict.get(m.recipeId);
      if (why) out.push({ key: m.key, recipeId: m.recipeId, reason: why });
    }
  } catch (_e) {
    /* jamais bloquant */
  }
  return out;
}

export { dishFamily };
