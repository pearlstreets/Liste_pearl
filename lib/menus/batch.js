// Cuisine en lot : de 2 à 5 recettes préparées en une session. Pur : ni stockage, ni réseau, ni React.
// Une session enregistrée ne garde que le choix et les cases cochées ; tout le reste (temps, ordre,
// préparations, dates) est recalculé à chaque ouverture, dans la langue et avec les recettes du moment.
import { estObjet, arr, round2, indexRecipes, FAM_UNIT, isFreeKey, parseMealKey } from './util';
import { addDaysISO, parseISO } from './weeks';
import { recipeNeeds, buildShoppingList, isPantryKey } from './shopping';
import { eligibleRecipes } from './planner';

export const MIN_RECIPES = 2;
export const MAX_RECIPES = 5;

const OVEN_SLOTS = 2; // plats dans le four en même temps
const OVEN_TEMP_GAP = 20; // au-delà, deux plats ne partagent pas le four
const BURNERS = 3; // feux utilisés en même temps
const ATTENDED_MIN = 6; // une cuisson courte se surveille, elle occupe les mains
const START_MIN = 2; // lancer une cuisson longue occupe les mains
const PREP_SHARE = 0.4; // part du temps actif passée à éplucher et couper
const SHARED_SAVING_MIN = 1; // gain par recette quand un ingrédient est préparé en une fois
const DEFAULT_TIME_MIN = 30;

const UNKNOWN_KEEP_DAYS = 2; // recette personnelle : on reste prudent
const MAX_KEEP_DAYS = 14;
const FREEZER_DAYS = 90;
const MAX_PERSONS = 50;
const MAX_DONE = 300;

const MEAL_KEY = /^[0-6]-(midi|soir)$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------ conservation ------------------------------ */

/** Jours au réfrigérateur : valeur de la recette, sinon une durée courte. */
export function keepDaysOf(recipe) {
  const n = estObjet(recipe) ? recipe.keepDays : null;
  return Number.isInteger(n) && n >= 1 && n <= MAX_KEEP_DAYS ? n : UNKNOWN_KEEP_DAYS;
}

/** Seul un `true` explicite autorise le congélateur. */
export const isFreezable = (recipe) => estObjet(recipe) && recipe.freezable === true;

/** Dates limites d'une recette cuisinée ce jour-là. freezerUntil = null : ne pas congeler. */
export function storageInfo(recipe, cookedOn) {
  const iso = ISO.test(String(cookedOn)) && parseISO(cookedOn) ? cookedOn : null;
  const keepDays = keepDaysOf(recipe);
  const freezable = isFreezable(recipe);
  return {
    keepDays,
    freezable,
    fridgeUntil: iso ? addDaysISO(iso, keepDays) : null,
    freezerUntil: iso && freezable ? addDaysISO(iso, FREEZER_DAYS) : null,
  };
}

/* ------------------------------ préparations ------------------------------ */

const PEEL_CHOP = new Set(['oignon', 'ail', 'echalote', 'poireau']);
const CHOP = new Set(['persil', 'coriandre', 'basilic', 'menthe', 'ciboulette']);
const PEEL_CUT = new Set([
  'carotte',
  'pomme-de-terre',
  'patate-douce',
  'courge',
  'betterave',
  'pomme',
  'poire',
  'banane',
  'orange',
  'mangue',
  'gingembre',
]);
const CUT_MEAT = new Set([
  'poulet-filet',
  'cuisse-poulet',
  'dinde-escalope',
  'porc-filet',
  'boeuf-paleron',
  'agneau',
  'jambon-blanc',
  'saumon',
  'cabillaud',
  'colin',
]);
const KIND_ORDER = ['peelChop', 'peelCut', 'washCut', 'chop', 'cut', 'prepare'];

/** Geste à faire sur un ingrédient, ou null s'il n'y a rien à préparer à l'avance. */
export function prepKind(key, ing) {
  if (isFreeKey(key)) return 'prepare';
  if (PEEL_CHOP.has(key)) return 'peelChop';
  if (CHOP.has(key)) return 'chop';
  if (PEEL_CUT.has(key)) return 'peelCut';
  if (CUT_MEAT.has(key)) return 'cut';
  return ing && ing.aisle === 'fruits-legumes' ? 'washCut' : null;
}

/** Préparations groupées par ingrédient, quantités cumulées, les plus partagées d'abord. */
export function groupPreps(entries, ingredients, profile) {
  const groups = new Map();
  for (const entry of arr(entries)) {
    if (!estObjet(entry) || !estObjet(entry.recipe)) continue;
    const { recipe, persons } = entry;
    for (const n of recipeNeeds(recipe, persons, ingredients, { includeOptional: true })) {
      const kind = prepKind(n.key, n.ing);
      if (!kind || isPantryKey(n.key, n.ing, profile, false)) continue;
      const id = `prep:${n.key}|${n.fam}`;
      if (!groups.has(id))
        groups.set(id, {
          id,
          key: n.key,
          kind,
          amt: 0,
          fam: n.fam,
          unit: FAM_UNIT[n.fam] || 'u',
          recipes: [],
        });
      const g = groups.get(id);
      g.amt = round2(g.amt + (Number(n.amt) || 0));
      if (!g.recipes.includes(recipe.id)) g.recipes.push(recipe.id);
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.recipes.length - a.recipes.length ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );
}

/* --------------------------------- temps --------------------------------- */

const positive = (x) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function stepCountOf(recipe, stepsOf) {
  let texts = [];
  try {
    texts = arr(typeof stepsOf === 'function' ? stepsOf(recipe.id) : recipe.steps);
  } catch {
    texts = [];
  }
  if (texts.length) return texts.length;
  const idx = Object.keys(estObjet(recipe.stepTimers) ? recipe.stepTimers : {})
    .map(Number)
    .filter((i) => Number.isInteger(i) && i >= 0);
  return idx.length ? Math.max(...idx) + 1 : 1;
}

/**
 * Étapes d'une recette. Une étape avec minuteur a sa durée ; le temps actif restant de la recette
 * (timeMin moins les cuissons) se partage entre les épluchages (hasPrep) et les étapes sans minuteur.
 */
export function recipeTasks(recipe, stepsOf, hasPrep) {
  const count = stepCountOf(recipe, stepsOf);
  const timers = estObjet(recipe.stepTimers) ? recipe.stepTimers : {};
  const kinds = estObjet(recipe.stepKinds) ? recipe.stepKinds : {};
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const min = positive(timers[String(i)]) / 60;
    tasks.push({
      recipeId: recipe.id,
      stepIndex: i,
      timerSec: Math.round(min * 60),
      kind: min ? kinds[String(i)] || 'feu' : 'main',
      min,
    });
  }
  const last = tasks[tasks.length - 1];
  const tail = last.kind === 'repos' ? last : null; // repos final : il se fait sans vous
  const timed = tasks.reduce((n, x) => (x === tail ? n : n + x.min), 0);
  const timeMin = positive(recipe.timeMin) || DEFAULT_TIME_MIN;
  const manual = tasks.filter((x) => x.kind === 'main');
  const active = Math.max(manual.length, timeMin - timed);
  const prepMin = hasPrep ? Math.round(active * PREP_SHARE) : 0;
  const each = manual.length ? Math.max(1, (active - prepMin) / manual.length) : 0;
  for (const x of tasks) {
    if (x.kind === 'main') {
      x.min = each;
      x.hands = each;
    } else if (x === tail) {
      x.hands = 1;
    } else if (x.kind === 'repos') {
      x.hands = 1;
    } else {
      x.hands = x.min <= ATTENDED_MIN ? x.min : START_MIN;
    }
  }
  return { tasks, prepMin, tail: tail ? tail.min : 0, timeMin };
}

function placeFree(task, recipe, running) {
  if (task.kind === 'feu') return running.filter((r) => r.res === 'feu').length < BURNERS;
  if (task.kind !== 'four') return true;
  const oven = running.filter((r) => r.res === 'four');
  if (oven.length >= OVEN_SLOTS) return false;
  const temp = positive(recipe.ovenTempC);
  return oven.every((r) => (!temp && !r.temp) || Math.abs(temp - r.temp) <= OVEN_TEMP_GAP);
}

/**
 * Déroulé : un seul cuisinier, mais le four et les feux continuent sans lui. À chaque instant, la
 * recette qui a le plus de travail restant passe d'abord. Rend les étapes datées et l'heure de fin.
 */
export function scheduleTasks(plans, startMin = 0) {
  const lanes = plans.map((p) => ({ ...p, i: 0, readyAt: startMin }));
  const running = [];
  const out = [];
  let cookFree = startMin;
  let t = startMin;
  let end = startMin;
  const remaining = (l) => l.tasks.slice(l.i).reduce((n, x) => n + x.min, 0);
  for (let guard = 0; guard < 2000; guard++) {
    if (lanes.every((l) => l.i >= l.tasks.length)) break;
    for (let k = running.length - 1; k >= 0; k--) if (running[k].end <= t) running.splice(k, 1);
    const ready =
      cookFree <= t
        ? lanes
            .filter(
              (l) =>
                l.i < l.tasks.length && l.readyAt <= t && placeFree(l.tasks[l.i], l.recipe, running)
            )
            .sort((a, b) => remaining(b) - remaining(a))
        : [];
    if (ready.length) {
      const l = ready[0];
      const task = l.tasks[l.i];
      const isTail = task.kind === 'repos' && l.i === l.tasks.length - 1;
      const stop = t + (isTail ? task.hands : Math.max(task.min, task.hands));
      cookFree = t + task.hands;
      l.readyAt = stop;
      l.i += 1;
      if (task.kind === 'four' || task.kind === 'feu')
        running.push({ end: stop, res: task.kind, temp: positive(l.recipe.ovenTempC) });
      end = Math.max(end, stop);
      out.push({
        id: `${task.recipeId}#${task.stepIndex}`,
        recipeId: task.recipeId,
        stepIndex: task.stepIndex,
        kind: task.kind,
        timerSec: task.timerSec,
        startMin: Math.round(t),
        endMin: Math.ceil(stop),
      });
      continue;
    }
    const next = [
      cookFree,
      ...running.map((r) => r.end),
      ...lanes.filter((l) => l.i < l.tasks.length).map((l) => l.readyAt),
    ].filter((x) => x > t);
    if (!next.length) break;
    t = Math.min(...next);
  }
  return { steps: out, endMin: Math.ceil(end) };
}

/* ------------------------------ session ------------------------------ */

function cleanItem(v) {
  if (!estObjet(v) || typeof v.recipeId !== 'string' || !v.recipeId) return null;
  const p = Number(v.persons);
  return {
    recipeId: v.recipeId,
    persons: Number.isFinite(p) && p > 0 ? Math.min(MAX_PERSONS, Math.round(p)) : 1,
    mealKeys: arr(v.mealKeys).filter((k) => typeof k === 'string' && MEAL_KEY.test(k)),
  };
}

function cleanItems(list) {
  const out = new Map();
  for (const v of arr(list)) {
    const it = cleanItem(v);
    if (!it) continue;
    const prev = out.get(it.recipeId);
    if (prev) {
      prev.persons = Math.min(MAX_PERSONS, prev.persons + it.persons);
      prev.mealKeys = [...new Set([...prev.mealKeys, ...it.mealKeys])];
    } else if (out.size < MAX_RECIPES) out.set(it.recipeId, it);
  }
  return [...out.values()];
}

/** Lecture tolérante : une session illisible vaut « pas de session », jamais une exception. */
export function cleanBatch(v) {
  if (!estObjet(v) || typeof v.id !== 'string' || !v.id) return null;
  const items = cleanItems(v.items);
  if (items.length === 0) return null;
  const done = {};
  if (estObjet(v.done)) {
    for (const k of Object.keys(v.done).slice(0, MAX_DONE))
      if (v.done[k] === true && !['__proto__', 'constructor', 'prototype'].includes(k))
        done[k] = true;
  }
  const date = (x) => (typeof x === 'string' && ISO.test(x) && parseISO(x) ? x : null);
  return {
    id: v.id,
    createdOn: date(v.createdOn),
    cookedOn: date(v.cookedOn),
    weekStart: date(v.weekStart),
    items,
    done,
  };
}

/** Nouvelle session. items : [{ recipeId, persons, mealKeys }]. null hors de 2 à 5 recettes. */
export function newSession({ items, today, weekStart, id } = {}) {
  const list = cleanItems(items);
  if (list.length < MIN_RECIPES) return null;
  return cleanBatch({
    id: id || `batch-${today || 'x'}-${list.map((i) => i.recipeId).join('+').length}`,
    createdOn: today,
    cookedOn: null,
    weekStart: weekStart || null,
    items: list,
    done: {},
  });
}

function mealDate(weekStart, key) {
  const m = parseMealKey(key);
  return weekStart && m ? addDaysISO(weekStart, m.day) : null;
}

/**
 * Session prête à afficher. Une recette supprimée depuis sort du calcul et est signalée dans
 * `missing` ; les cases déjà cochées des autres recettes restent justes.
 * -> { items, missing, prep, steps, storage, prepMin, totalMin, sequentialMin, restMin }
 */
export function buildSession({ session, recipes, ingredients, profile, stepsOf, today } = {}) {
  const s = cleanBatch(session);
  const empty = {
    items: [],
    missing: [],
    prep: [],
    steps: [],
    storage: [],
    prepMin: 0,
    totalMin: 0,
    sequentialMin: 0,
    restMin: 0,
  };
  if (!s) return empty;
  const idx = indexRecipes(recipes);
  const ings = estObjet(ingredients) ? ingredients : {};
  const items = s.items.filter((i) => idx.has(i.recipeId));
  const missing = s.items.filter((i) => !idx.has(i.recipeId)).map((i) => i.recipeId);
  const entries = items.map((i) => ({ recipe: idx.get(i.recipeId), persons: i.persons }));
  const prep = groupPreps(entries, ings, profile);
  const withPrep = new Set(prep.flatMap((g) => g.recipes));
  const plans = entries.map((e) => ({
    recipe: e.recipe,
    ...recipeTasks(e.recipe, stepsOf, withPrep.has(e.recipe.id)),
  }));
  const allPrep = plans.reduce((n, p) => n + p.prepMin, 0);
  const shared = prep.reduce((n, g) => n + (g.recipes.length - 1) * SHARED_SAVING_MIN, 0);
  const prepMin = Math.max(Math.max(0, ...plans.map((p) => p.prepMin)), allPrep - shared);
  const { steps, endMin } = scheduleTasks(plans, prepMin);
  const on = s.cookedOn || today;
  const planned = s.weekStart || null;
  return {
    items,
    missing,
    prep,
    steps,
    storage: items.map((i) => {
      const info = storageInfo(idx.get(i.recipeId), on);
      const late = i.mealKeys
        .map((key) => ({ key, date: mealDate(planned, key) }))
        .filter((m) => m.date && info.fridgeUntil && m.date > info.fridgeUntil);
      return {
        recipeId: i.recipeId,
        ...info,
        lateMeals: late,
        mustFreeze: late.length > 0 && info.freezable,
        tooLate: late.length > 0 && !info.freezable,
      };
    }),
    prepMin,
    totalMin: endMin,
    sequentialMin: plans.reduce((n, p) => n + p.timeMin, 0),
    restMin: Math.round(Math.max(0, ...plans.map((p) => p.tail))),
  };
}

/** Ordre à suivre : préparations, puis cuissons. */
export const followIds = (view) => [
  ...arr(view && view.prep).map((g) => g.id),
  ...arr(view && view.steps).map((x) => x.id),
];

/** Où en est la session. nextIndex = première case non cochée, pour reprendre au bon endroit. */
export function sessionProgress(view, session) {
  const ids = followIds(view);
  const done = estObjet(session) && estObjet(session.done) ? session.done : {};
  const count = ids.filter((id) => done[id] === true).length;
  const next = ids.findIndex((id) => done[id] !== true);
  return {
    done: count,
    total: ids.length,
    nextIndex: next < 0 ? 0 : next,
    complete: ids.length > 0 && count === ids.length,
  };
}

/** Coche ou décoche une étape. La première case cochée fixe le jour de cuisson, base des dates. */
export function setStepDone(session, stepId, value, today) {
  if (!estObjet(session) || !stepId) return session;
  const done = { ...(estObjet(session.done) ? session.done : {}) };
  if (value === false) delete done[stepId];
  else done[stepId] = true;
  return { ...session, done, cookedOn: session.cookedOn || today || null };
}

/* ------------------------------ semaine et courses ------------------------------ */

/** Repas de la semaine à cuisiner, regroupés par recette (déjà préparés, restes et libres exclus). */
export function planBatchMeals(plan, recipeById) {
  const out = new Map();
  for (const m of arr(plan && plan.meals)) {
    if (!estObjet(m) || !m.recipeId || m.free || m.leftoverOf || m.batchOf) continue;
    if (!(recipeById && recipeById.has(m.recipeId))) continue;
    const persons = Number(m.cookPersons) || Number(m.persons) || 1;
    const prev = out.get(m.recipeId);
    if (prev) {
      prev.persons += persons;
      prev.mealKeys.push(m.key);
    } else out.set(m.recipeId, { recipeId: m.recipeId, persons, mealKeys: [m.key] });
  }
  return [...out.values()];
}

/** Recettes qui se gardent bien et partagent le plus d'ingrédients, selon le profil. */
export function proposeBatch({ recipes, ingredients, profile, count = 3, chosen } = {}) {
  const ings = estObjet(ingredients) ? ingredients : {};
  const keysOf = (r) =>
    arr(r.ingredients)
      .map((i) => i && i.key)
      .filter((k) => k && !(ings[k] && ings[k].pantry));
  const pool = eligibleRecipes({ recipes, ingredients: ings, profile })
    .mains.filter((r) => !r.custom && (isFreezable(r) || keepDaysOf(r) >= 3))
    .map((r) => ({
      r,
      keys: keysOf(r),
      base: (arr(r.tags).includes('batch') ? 3 : 0) + (isFreezable(r) ? 2 : 0) + keepDaysOf(r) / 4,
    }));
  const picked = arr(chosen).filter((x) => typeof x === 'string');
  const seen = new Set(
    picked.flatMap((id) => {
      const e = pool.find((p) => p.r.id === id);
      return e ? e.keys : [];
    })
  );
  const out = [];
  const max = Math.min(Math.max(0, count), MAX_RECIPES - picked.length);
  while (out.length < max) {
    let best = null;
    let bestScore = -Infinity;
    for (const p of pool) {
      if (picked.includes(p.r.id) || out.includes(p.r.id)) continue;
      const score = p.base + p.keys.filter((k) => seen.has(k)).length;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (!best) break;
    out.push(best.r.id);
    for (const k of best.keys) seen.add(k);
  }
  return out;
}

/** Lignes de courses de la session, au format de la liste de la semaine. */
export function sessionLines({ session, recipes, ingredients, profile } = {}) {
  const s = cleanBatch(session);
  if (!s) return [];
  const idx = indexRecipes(recipes);
  const meals = s.items
    .filter((i) => idx.has(i.recipeId))
    .map((i, n) => ({
      key: `${n}-midi`,
      day: n,
      slot: 'midi',
      recipeId: i.recipeId,
      persons: i.persons,
    }));
  if (meals.length === 0) return [];
  return buildShoppingList({ plan: { meals }, recipes, ingredients, profile }).lines || [];
}

/** Repas de ce plan liés à la session (même semaine, même recette). */
export function linkedMealKeys(plan, session) {
  const s = cleanBatch(session);
  if (!s || !estObjet(plan) || !s.weekStart || plan.weekStart !== s.weekStart) return [];
  const out = [];
  for (const it of s.items) {
    for (const k of it.mealKeys) {
      const m = arr(plan.meals).find((x) => estObjet(x) && x.key === k);
      if (m && m.recipeId === it.recipeId && !m.free && !m.leftoverOf) out.push(k);
    }
  }
  return out;
}

/** Marque ces repas « déjà préparés » (value = false pour annuler). Le plan rendu est neuf. */
export function setMealsPrepared(plan, session, value = true) {
  if (!estObjet(plan) || !Array.isArray(plan.meals)) return plan;
  const s = cleanBatch(session);
  if (!s) return plan;
  const keys = new Set(linkedMealKeys(plan, s));
  if (keys.size === 0) return plan;
  return {
    ...plan,
    meals: plan.meals.map((m) => {
      if (!estObjet(m) || !keys.has(m.key)) return m;
      const { batchOf: _ignore, ...rest } = m;
      return value === false ? rest : { ...rest, batchOf: s.id };
    }),
  };
}
