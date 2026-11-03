// Accompagnements de légumes (lib/menus/sides.js) : choix compatibles avec le profil et la saison, sideId posé
// et retiré sur un repas, persisté, synchronisé, compté dans les courses et les apports, plans anciens intacts.
const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v);
  }),
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k);
  }),
  multiRemove: jest.fn(async (ks) => {
    ks.forEach((k) => mockStore.delete(k));
  }),
}));

import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { resetHealthCache, vegGrams, isSide } from '../lib/menus/healthy';
import {
  needsSide,
  sideCandidates,
  setMealSide,
  carrySides,
  mealSide,
  sideIdOf,
  planSideIds,
  dayTotals,
  withSideNutrition,
  SIDE_VEG_MIN,
} from '../lib/menus/sides';
import { buildShoppingList } from '../lib/menus/shopping';
import { recipePortionScale } from '../lib/menus/needs';
import { recomputeCooking, lockMeal } from '../lib/menus/planner';
import { auditPlan, unsuitableMeals } from '../lib/menus/pool';
import { savePlan, loadPlan } from '../lib/menus/storage';
import { valeurValide } from '../lib/menus/sync';
import { seasonOf, SEASONS } from '../lib/menus/util';

let cat;
let ings;
let lowVeg; // plat principal pauvre en légumes
let richVeg; // plat principal riche en légumes

beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
  resetHealthCache();
  cat = getCatalog();
  ings = getIngredients();
  for (let start = 0; start < 20000 && (!lowVeg || !richVeg); start += 500) {
    for (const row of cat.rows(start, 500)) {
      const r = cat.getRow(row);
      if (!r || r.course !== 'plat' || isSide(r)) continue;
      const v = vegGrams(r, ings);
      if (!lowVeg && v < 40) lowVeg = r;
      if (!richVeg && v >= 200) richVeg = r;
      if (lowVeg && richVeg) break;
    }
  }
});
afterAll(() => {
  resetMenusCache();
  resetHealthCache();
});

const planWith = (meals) => ({ version: 1, seed: 1, weekStart: '2026-11-02', meals, warnings: [] });
const meal = (over = {}) => ({
  key: '1-soir',
  day: 1,
  slot: 'soir',
  recipeId: lowVeg.id,
  free: false,
  locked: false,
  leftoverOf: null,
  persons: 2,
  ...over,
});

describe('quand proposer un accompagnement', () => {
  test('plat pauvre en légumes : oui ; riche en légumes : non ; accompagnement, dessert : non', () => {
    expect(lowVeg).toBeTruthy();
    expect(richVeg).toBeTruthy();
    expect(needsSide(lowVeg, ings)).toBe(true);
    expect(needsSide(richVeg, ings)).toBe(false);
    expect(needsSide({ ...lowVeg, course: 'dessert' }, ings)).toBe(false);
    expect(needsSide({ ...lowVeg, sub: 'accompagnements' }, ings)).toBe(false);
    expect(needsSide(null, ings)).toBe(false);
    expect(needsSide({ id: 'perso', custom: true, ingredients: [] }, ings)).toBe(false);
  });
});

describe('choix des accompagnements', () => {
  test('2 ou 3 accompagnements riches en légumes, stables pour un même plat', () => {
    const a = sideCandidates(cat, ings, { month: 10 }, { forId: lowVeg.id });
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(3);
    for (const r of a) {
      expect(isSide(r)).toBe(true);
      expect(vegGrams(r, ings)).toBeGreaterThanOrEqual(SIDE_VEG_MIN);
    }
    const b = sideCandidates(cat, ings, { month: 10 }, { forId: lowVeg.id });
    expect(b.map((r) => r.id)).toEqual(a.map((r) => r.id));
  });

  test('de saison : en été, aucun accompagnement marqué d une autre saison seulement', () => {
    const a = sideCandidates(cat, ings, { month: 6 }, { forId: lowVeg.id });
    expect(a.length).toBeGreaterThanOrEqual(2);
    for (const r of a) {
      const own = r.tags.filter((t) => SEASONS.includes(t));
      if (own.length) expect(own).toContain(seasonOf(6));
    }
  });

  test('régime végan et sans gluten respectés', () => {
    for (const d of ['vegan', 'sans-gluten']) {
      const a = sideCandidates(cat, ings, { diets: [d], month: 1 }, { forId: lowVeg.id });
      expect(a.length).toBeGreaterThanOrEqual(2);
      for (const r of a) expect(r.tags).toContain(d);
    }
  });

  test('allergie et ingrédient écarté respectés (même verdict que le planificateur)', () => {
    const base = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id, n: 6 });
    // le légume principal de la première proposition est écarté
    const top = base[0].ingredients.find((l) => !(ings[l.key] && ings[l.key].pantry)).key;
    const a = sideCandidates(
      cat,
      ings,
      { month: 1, excludedIngredients: [top] },
      { forId: lowVeg.id }
    );
    expect(a.length).toBeGreaterThanOrEqual(1);
    for (const r of a) expect(r.ingredients.map((l) => l.key)).not.toContain(top);
    const g = sideCandidates(
      cat,
      ings,
      { month: 1, excludedIngredients: ['gluten', 'fruits-a-coque'] },
      { forId: lowVeg.id }
    );
    for (const r of g)
      for (const l of r.ingredients) {
        const al = (ings[l.key] && ings[l.key].allergens) || [];
        expect(al).not.toContain('gluten');
        expect(al).not.toContain('fruits-a-coque');
      }
  });

  test('déjà choisis ailleurs : exclus ; catalogue absent : aucun, sans erreur', () => {
    const a = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id });
    const b = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id, exclude: [a[0].id] });
    expect(b.map((r) => r.id)).not.toContain(a[0].id);
    expect(sideCandidates(null, null, null)).toEqual([]);
    expect(sideCandidates([], {}, {})).toEqual([]);
  });
});

describe('sideId sur un repas de la semaine', () => {
  test('ajouté puis retiré, plan inchangé si rien ne change', () => {
    const side = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id })[0];
    const p0 = planWith([meal(), meal({ key: '2-midi', day: 2, slot: 'midi', free: true, recipeId: null })]);
    const p1 = setMealSide(p0, '1-soir', side.id);
    expect(p1).not.toBe(p0);
    expect(p1.meals[0].sideId).toBe(side.id);
    expect(p0.meals[0].sideId).toBeUndefined();
    expect(sideIdOf(p1.meals[0])).toBe(side.id);
    expect(mealSide(p1.meals[0], cat).id).toBe(side.id);
    expect(planSideIds(p1).has(side.id)).toBe(true);
    expect(setMealSide(p1, '1-soir', side.id)).toBe(p1);
    // repas libre ou inconnu : rien
    expect(setMealSide(p0, '2-midi', side.id)).toBe(p0);
    expect(setMealSide(p0, '6-soir', side.id)).toBe(p0);
    const p2 = setMealSide(p1, '1-soir', null);
    expect('sideId' in p2.meals[0]).toBe(false);
    expect(setMealSide(p0, '1-soir', null)).toBe(p0);
    expect(setMealSide(null, '1-soir', 'x')).toBe(null);
  });

  test('courses : ingrédients de l accompagnement aux portions du repas, retirés avec lui', () => {
    const side = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id })[0];
    const p0 = planWith([meal({ persons: 3, cookPersons: 3 })]);
    const p1 = setMealSide(p0, '1-soir', side.id);
    const sh0 = buildShoppingList({ plan: p0, recipes: cat, ingredients: ings, profile: {} });
    const sh1 = buildShoppingList({ plan: p1, recipes: cat, ingredients: ings, profile: {} });
    expect(sh1.fingerprint).not.toBe(sh0.fingerprint);
    const sideOnly = buildShoppingList({
      plan: planWith([meal({ recipeId: side.id, persons: 3, cookPersons: 3 })]),
      recipes: cat,
      ingredients: ings,
      profile: {},
    });
    for (const l of sideOnly.lines) {
      const got = sh1.lines.find((x) => x.key === l.key);
      expect(got).toBeTruthy();
      expect(got.usedIn).toContain(side.id);
    }
    expect(sh1.missingRecipes).toEqual([]);
    const back = buildShoppingList({
      plan: setMealSide(p1, '1-soir', null),
      recipes: cat,
      ingredients: ings,
      profile: {},
    });
    expect(back.fingerprint).toBe(sh0.fingerprint);
    // repas libre : son ancien sideId n'achète rien
    const free = buildShoppingList({
      plan: planWith([{ ...p1.meals[0], free: true }]),
      recipes: cat,
      ingredients: ings,
      profile: {},
    });
    expect(free.lines).toEqual([]);
  });

  test('plan ancien sans sideId : courses et apports identiques', () => {
    const p0 = planWith([meal(), meal({ key: '3-midi', day: 3, slot: 'midi', recipeId: richVeg.id })]);
    const a = buildShoppingList({ plan: p0, recipes: cat, ingredients: ings, profile: {} });
    const b = buildShoppingList({
      plan: JSON.parse(JSON.stringify(p0)),
      recipes: cat,
      ingredients: ings,
      profile: {},
    });
    expect(b).toEqual(a);
    const d = dayTotals(p0, cat, {});
    expect(d[1].kcal).toBe(Math.round(lowVeg.kcal));
    expect(d[1].target).toBeNull();
    expect(d[3].meals).toBe(1);
  });

  test('sideId vers une recette disparue ou invalide : toléré, repas gardé', () => {
    const p = planWith([meal({ sideId: 'g-zzzzzzzz' }), meal({ key: '4-soir', day: 4, sideId: 42 })]);
    expect(mealSide(p.meals[0], cat)).toBeNull();
    expect(sideIdOf(p.meals[1])).toBeNull();
    const sh = buildShoppingList({ plan: p, recipes: cat, ingredients: ings, profile: {} });
    expect(sh.missingRecipes).toEqual([]);
    expect(sh.lines.length).toBeGreaterThan(0);
    expect(() => dayTotals(p, cat, {})).not.toThrow();
    expect(recomputeCooking(p.meals).length).toBe(2);
    expect(auditPlan(p, { recipes: cat, ingredients: ings, profile: {} })).toEqual([]);
    expect(() =>
      unsuitableMeals(p, { recipes: cat, ingredients: ings, profile: {}, texts: null })
    ).not.toThrow();
    // retirer un sideId invalide le nettoie
    expect('sideId' in setMealSide(p, '4-soir', null).meals[1]).toBe(false);
  });

  test('gardé par recomputeCooking et lockMeal, reporté après un changement de plan', () => {
    const side = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id })[0];
    const p1 = setMealSide(planWith([meal()]), '1-soir', side.id);
    expect(recomputeCooking(p1.meals)[0].sideId).toBe(side.id);
    expect(lockMeal(p1, '1-soir', true).meals[0].sideId).toBe(side.id);
    // le planificateur reconstruit les repas sans sideId : report sur le même repas, même recette
    const rebuilt = planWith([meal({ swaps: 1 })]);
    expect(carrySides(p1, rebuilt).meals[0].sideId).toBe(side.id);
    // recette changée ou repas libre : pas de report
    const changed = planWith([meal({ recipeId: richVeg.id })]);
    expect(carrySides(p1, changed)).toBe(changed);
    const freed = planWith([meal({ free: true })]);
    expect(carrySides(p1, freed)).toBe(freed);
    // retrait volontaire : le plan suivant n'a plus rien à reporter
    expect(carrySides(planWith([meal()]), rebuilt)).toBe(rebuilt);
    expect(carrySides(null, rebuilt)).toBe(rebuilt);
  });

  test('persisté et synchronisé', async () => {
    const side = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id })[0];
    const p1 = setMealSide(planWith([meal()]), '1-soir', side.id);
    expect(valeurValide('plan', p1)).toBe(true);
    await savePlan(p1);
    const back = await loadPlan();
    expect(back.meals[0].sideId).toBe(side.id);
    expect(back.meals[0].recipeId).toBe(lowVeg.id);
  });
});

describe('apports du jour', () => {
  test('accompagnement compté, cible avec personnes renseignées', () => {
    const side = sideCandidates(cat, ings, { month: 1 }, { forId: lowVeg.id })[0];
    const p1 = setMealSide(planWith([meal()]), '1-soir', side.id);
    const members = [
      { name: 'A', age: 35, sex: 'f', heightCm: 165, weightKg: 60, activity: 'moderee' },
      { name: 'B', age: 38, sex: 'm', heightCm: 180, weightKg: 80, activity: 'moderee' },
    ];
    const d = dayTotals(p1, cat, { members });
    // plat servi à la portion ajustée aux besoins des personnes, accompagnement à sa portion
    const sc = recipePortionScale({ members }, lowVeg);
    expect(d[1].kcal).toBe(Math.round(lowVeg.kcal * sc + side.kcal));
    expect(d[1].protein).toBe(Math.round(lowVeg.protein * sc + side.protein));
    // sans personnes renseignées : portion de la recette telle quelle
    const ws = withSideNutrition(lowVeg, side);
    expect(dayTotals(p1, cat, {})[1].kcal).toBe(ws.kcal);
    expect(d[1].target).not.toBeNull();
    expect(d[1].target.kcal).toBeGreaterThan(300);
    expect(d[0].meals).toBe(0);
  });
});
