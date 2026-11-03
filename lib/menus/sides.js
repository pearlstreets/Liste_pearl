// Accompagnements de légumes (facultatifs) et apports du jour de la semaine.
// Module pur, ne lève jamais. Un repas de la semaine peut porter `sideId` : identifiant d'une recette
// d'accompagnement (chaîne). Les anciennes versions l'ignorent ; une recette disparue est ignorée.
import {
  estObjet,
  arr,
  round2,
  hashString,
  seasonOf,
  SEASONS,
  parseMealKey,
  indexRecipes,
} from './util';
import { getCore } from './catalog';
import { genHealth, healthOf, isSide, FLAG_SIDE, BALANCED, QUICK_MAX } from './healthy';
import { prepareElig, rejectWith, eligibleCatalog } from './pool';
import * as needsMod from './needs';

/** En dessous de ce poids de légumes par portion, un plat principal peut recevoir un accompagnement. */
export const SIDE_VEG_MIN = BALANCED.minVeg;
/** Nombre d'accompagnements proposés. */
export const SIDES_SHOWN = 3;

/** Le plat (principal, du catalogue) a-t-il moins de SIDE_VEG_MIN g de légumes par portion ? */
export function needsSide(recipe, ingredients) {
  try {
    if (!estObjet(recipe) || recipe.custom || isSide(recipe)) return false;
    if (recipe.course && recipe.course !== 'plat') return false;
    const h = healthOf(recipe, ingredients);
    return !!h && h.veg < SIDE_VEG_MIN;
  } catch {
    return false;
  }
}

// Lignes du catalogue généré marquées accompagnement (calculées une fois par colonnes santé).
let sideRowsCache = null;
function sideRows(ingredients) {
  const h = genHealth(ingredients);
  if (!h) return [];
  if (sideRowsCache && sideRowsCache.h === h) return sideRowsCache.rows;
  const rows = [];
  for (let i = 0; i < h.flags.length; i++) if (h.flags[i] & FLAG_SIDE) rows.push(i);
  sideRowsCache = { h, rows };
  return rows;
}

// 2 : de saison (marqué), 1 : toute l'année, 0 : hors saison.
function seasonRank(tagNames, season) {
  if (!season) return 1;
  const own = tagNames.filter((x) => SEASONS.includes(x));
  if (own.length === 0) return 1;
  return own.includes(season) ? 2 : 0;
}

/**
 * Accompagnements de légumes pour un plat : recettes d'accompagnement (catalogue généré et recettes écrites à
 * la main marquées accompagnement) qui respectent régimes, allergies et exclusions du profil (même verdict
 * que le planificateur), de saison d'abord, rapides de préférence, variés d'un plat à l'autre.
 * opts : { forId, month (0-11, sinon profile.month, sinon mois courant), exclude (Set ou tableau d'id), n }.
 * -> tableau de recettes (objets), au plus n. Jamais d'exception.
 */
export function sideCandidates(recipes, ingredients, profile, opts = {}) {
  try {
    const ings = estObjet(ingredients) ? ingredients : {};
    const n = Math.max(1, Math.min(6, Number(opts.n) || SIDES_SHOWN));
    const month =
      opts.month !== undefined && opts.month !== null
        ? opts.month
        : estObjet(profile) && profile.month !== null && profile.month !== undefined
          ? profile.month
          : new Date().getMonth();
    const season = seasonOf(month);
    const exclude = new Set(opts.exclude instanceof Set ? opts.exclude : arr(opts.exclude));
    const forId = String(opts.forId || '');
    if (forId) exclude.add(forId);
    const e = prepareElig(profile);
    const idx = indexRecipes(recipes);
    const cands = []; // { id, row, obj, season, quick, veg, h }
    // Recettes écrites à la main (et personnelles marquées accompagnement).
    const list =
      recipes && typeof recipes.values === 'function' && !(recipes instanceof Map)
        ? recipes.values()
        : recipes instanceof Map
          ? [...recipes.values()]
          : arr(recipes);
    for (const r of list) {
      if (!estObjet(r) || !isSide(r) || exclude.has(r.id)) continue;
      const why = rejectWith(r, ings, e);
      if (why && why !== 'time') continue;
      cands.push({
        id: r.id,
        row: -1,
        obj: r,
        season: seasonRank(arr(r.tags), season),
        quick: Number(r.timeMin) > 0 && Number(r.timeMin) <= QUICK_MAX ? 1 : 0,
        veg: healthOf(r, ings).veg,
      });
    }
    // Catalogue généré : colonnes seulement, objets construits pour les retenus.
    const rows = sideRows(ings);
    const c = getCore();
    if (
      rows.length &&
      c &&
      c.status === 'ready' &&
      recipes &&
      typeof recipes.getRow === 'function'
    ) {
      const el = eligibleCatalog(recipes, ings, e);
      const h = genHealth(ings);
      const seasonBits = {};
      for (const sName of SEASONS) {
        const k = c.TAGS.indexOf(sName);
        seasonBits[sName] = k >= 0 ? 1 << k : 0;
      }
      let anyBits = 0;
      for (const sName of SEASONS) anyBits |= seasonBits[sName];
      const want = season ? seasonBits[season] : 0;
      for (const row of rows) {
        const id = recipes.idOf ? recipes.idOf(row) : '';
        if (!id || exclude.has(id) || !el.allows(id)) continue;
        const tg = c.cols.tags[row];
        const own = tg & anyBits;
        const sr = !season || !own ? 1 : own & want ? 2 : 0;
        const time = c.cols.time[row] * 5;
        cands.push({
          id,
          row,
          obj: null,
          season: sr,
          quick: time > 0 && time <= QUICK_MAX ? 1 : 0,
          veg: h.veg[row] || 0,
        });
      }
    }
    // Hors saison seulement s'il n'y a rien d'autre ; peu de légumes écartés si possible.
    let pool = cands.filter((x) => x.season > 0);
    if (pool.length < n) pool = cands;
    const rich = pool.filter((x) => x.veg >= SIDE_VEG_MIN);
    if (rich.length >= n) pool = rich;
    const mix = (x) => hashString(`${forId}|${x.id}`);
    pool.sort(
      (a, b) =>
        b.season - a.season || b.quick - a.quick || (mix(a) < mix(b) ? -1 : mix(a) > mix(b) ? 1 : 0)
    );
    const out = [];
    for (const x of pool) {
      if (out.length >= n) break;
      const r = x.obj || (x.row >= 0 ? recipes.getRow(x.row) : null) || idx.get(x.id);
      if (estObjet(r) && r.id) out.push(r);
    }
    return out;
  } catch {
    return [];
  }
}

/* ------------------------------------ repas de la semaine ------------------------------------ */

/** Le repas peut-il porter un accompagnement ? (repas cuisiné ou reste, pas un repas libre) */
const sideable = (m) => estObjet(m) && !!m.recipeId && !m.free && !!parseMealKey(m.key);

/** Identifiant d'accompagnement d'un repas, ou null (valeur invalide ignorée). */
export function sideIdOf(meal) {
  return sideable(meal) && typeof meal.sideId === 'string' && meal.sideId ? meal.sideId : null;
}

/** Recette d'accompagnement d'un repas, ou null (recette disparue : null, sans erreur). */
export function mealSide(meal, recipes) {
  const id = sideIdOf(meal);
  if (!id) return null;
  try {
    const idx = indexRecipes(recipes);
    const r = idx.get(id);
    return estObjet(r) ? r : null;
  } catch {
    return null;
  }
}

/** Accompagnements déjà choisis dans la semaine (Set d'identifiants). */
export function planSideIds(plan) {
  const out = new Set();
  for (const m of arr(plan && plan.meals)) {
    const id = sideIdOf(m);
    if (id) out.add(id);
  }
  return out;
}

/**
 * Pose (sideId chaîne) ou retire (null) l'accompagnement du repas `key`. Plan rendu tel quel si rien ne
 * change, si le repas n'existe pas ou s'il est libre.
 */
export function setMealSide(plan, key, sideId) {
  if (!estObjet(plan) || !Array.isArray(plan.meals)) return plan;
  const want = typeof sideId === 'string' && sideId ? sideId : null;
  let changed = false;
  const meals = plan.meals.map((m) => {
    if (!estObjet(m) || m.key !== key) return m;
    if (want && !sideable(m)) return m;
    const cur = typeof m.sideId === 'string' && m.sideId ? m.sideId : null;
    if (cur === want && (want || m.sideId === undefined)) return m;
    changed = true;
    const next = { ...m };
    if (want) next.sideId = want;
    else delete next.sideId;
    return next;
  });
  return changed ? { ...plan, meals } : plan;
}

/**
 * Le planificateur reconstruit les repas sans `sideId` : on le reporte du plan précédent sur chaque repas
 * qui garde la même recette au même moment. Plan suivant rendu tel quel si rien n'est à reporter.
 */
export function carrySides(prev, next) {
  if (!estObjet(next) || !Array.isArray(next.meals) || !estObjet(prev)) return next;
  const before = new Map();
  for (const m of arr(prev.meals)) {
    const id = sideIdOf(m);
    if (id) before.set(m.key, { recipeId: m.recipeId, sideId: id });
  }
  if (before.size === 0) return next;
  let changed = false;
  const meals = next.meals.map((m) => {
    if (!sideable(m) || sideIdOf(m)) return m;
    const b = before.get(m.key);
    if (!b || b.recipeId !== m.recipeId) return m;
    changed = true;
    return { ...m, sideId: b.sideId };
  });
  return changed ? { ...next, meals } : next;
}

/* --------------------------------------- apports du jour --------------------------------------- */

/**
 * Cible d'une portion pour un repas : { kcal, protein } ou null sans personnes renseignées. mealTarget
 * (needs.js, objectif de chacun compris) quand il existe, sinon les besoins du foyer par portion.
 */
export function mealTargetOf(profile, day, slot, meal) {
  try {
    if (typeof needsMod.mealTarget === 'function') {
      const t = needsMod.mealTarget(profile, day, slot, meal);
      return t && t.kcal > 0
        ? { kcal: Math.round(t.kcal), protein: Math.round(t.protein || 0) }
        : null;
    }
    const n = needsMod.householdMealNeeds(profile, day, slot, meal);
    return n && n.perPortionKcal > 0
      ? { kcal: Math.round(n.perPortionKcal), protein: Math.round(n.perPortionProtein || 0) }
      : null;
  } catch {
    return null;
  }
}

/**
 * Apports et cibles par jour, accompagnements compris :
 * [{ day, kcal, protein, meals, target: { kcal, protein } | null }] (7 jours).
 * kcal et protein : par personne (portion de référence servie, ajustée aux besoins des personnes renseignées :
 * recipePortionScale), somme des repas du jour dont la recette est connue (recettes personnelles sans valeurs :
 * non comptées). target : besoins des personnes renseignées pour les
 * repas prévus ce jour-là (repas libres exclus), null sans personnes renseignées.
 * members : ce que chaque personne renseignée mange réellement ce jour-là face à SA cible, repas où elle est
 * présente seulement (convives, cantine) : [{ id, name, n (rang dans le foyer, 1 = première), kcal, protein,
 * targetKcal, targetProtein }] ; mangé = (portion servie + accompagnement) x portionFactor, cible = besoins du jour
 * x part du repas. household : somme de members ({ kcal, protein, targetKcal, targetProtein }) ou null.
 * Vides (members [], household null) sans personnes renseignées (mode simple compris).
 */
export function dayTotals(plan, recipes, profile) {
  const days = [];
  for (let d = 0; d < 7; d++)
    days.push({
      day: d,
      kcal: 0,
      protein: 0,
      meals: 0,
      target: null,
      members: [],
      household: null,
    });
  try {
    const idx = indexRecipes(recipes);
    // Portion servie : ajustée aux besoins des personnes renseignées (comme la liste de courses).
    const pt = needsMod.portionTarget(profile);
    const rank = new Map(needsMod.activeMembers(profile).map((mb, i) => [mb.id, i + 1]));
    for (const m of arr(plan && plan.meals)) {
      if (!sideable(m)) continue;
      const pk = parseMealKey(m.key);
      const day = days[pk.day];
      const r = idx.get(m.recipeId);
      const k = Number(r && r.kcal) || 0;
      if (!(k > 0)) continue;
      const sc = pt ? needsMod.recipePortionScale(profile, r, pt) : 1;
      day.meals++;
      day.kcal += k * sc;
      day.protein += (Number(r.protein) || 0) * sc;
      const side = mealSide(m, idx);
      const sideK = side ? Number(side.kcal) || 0 : 0;
      const sideP = side ? Number(side.protein) || 0 : 0;
      day.kcal += sideK;
      day.protein += sideP;
      if (rank.size) {
        const share = needsMod.mealShare(pk.slot);
        const servedK = k * sc + sideK;
        const servedP = (Number(r.protein) || 0) * sc + sideP;
        for (const mb of needsMod.membersAt(profile, pk.day, pk.slot, m)) {
          const f = needsMod.portionFactor(mb);
          const n = needsMod.memberNeeds(mb);
          let row = day.members.find((x) => x.id === mb.id);
          if (!row) {
            row = {
              id: mb.id,
              name: mb.name,
              n: rank.get(mb.id) || 0,
              kcal: 0,
              protein: 0,
              targetKcal: 0,
              targetProtein: 0,
            };
            day.members.push(row);
          }
          row.kcal += servedK * f;
          row.protein += servedP * f;
          row.targetKcal += n.kcal * share;
          row.targetProtein += n.protein * share;
        }
      }
      const need = mealTargetOf(profile, pk.day, pk.slot, m);
      if (need) {
        const t = day.target || { kcal: 0, protein: 0 };
        t.kcal += need.kcal;
        t.protein += need.protein;
        day.target = t;
      }
    }
    for (const d of days) {
      d.kcal = Math.round(d.kcal);
      d.protein = Math.round(d.protein);
      if (d.target)
        d.target = { kcal: Math.round(d.target.kcal), protein: Math.round(d.target.protein) };
      if (d.members.length) {
        d.members.sort((a, b) => a.n - b.n);
        const h = { kcal: 0, protein: 0, targetKcal: 0, targetProtein: 0 };
        for (const row of d.members) {
          for (const key of ['kcal', 'protein', 'targetKcal', 'targetProtein']) {
            h[key] += row[key];
            row[key] = Math.round(row[key]);
          }
        }
        for (const key of Object.keys(h)) h[key] = Math.round(h[key]);
        d.household = h;
      }
    }
  } catch {
    /* jamais bloquant */
  }
  return days;
}

/** Plat et accompagnement réunis, par portion : { kcal, protein } (jamais NaN). */
export function withSideNutrition(recipe, side) {
  return {
    kcal: Math.round((Number(recipe && recipe.kcal) || 0) + (Number(side && side.kcal) || 0)),
    protein: round2((Number(recipe && recipe.protein) || 0) + (Number(side && side.protein) || 0)),
  };
}
