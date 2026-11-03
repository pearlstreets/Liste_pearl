// Convives par repas (facultatif) : meal.eaters (ids de profile.members) ou meal.heads (sans personnes),
// portions, cibles, courses, planificateur et reports. Sans réglage : comme avant.
import { INGREDIENTS, RECIPES } from './menus-fixtures';
import { generatePlan, swapMeal, setMealGuests, carryGuests, guestsOf } from '../lib/menus/planner';
import { personsFor, headsFor, validHeads } from '../lib/menus/profile';
import { cleanEaters, membersAt, householdMealNeeds, mealTarget } from '../lib/menus/needs';
import { weekTargets } from '../lib/menus/nutrition';
import { buildShoppingList } from '../lib/menus/shopping';

const A = { id: 'a', name: 'Anne', age: 30, sex: 'f', heightCm: 165, weightKg: 60, activity: 'moderee' };
const B = { id: 'b', name: 'Bob', age: 35, sex: 'm', heightCm: 180, weightKg: 85, activity: 'elevee' };
const C = { id: 'c', name: 'Cléo', age: 6 };
const base = { slots: { '0-midi': true, '0-soir': true, '1-midi': true, '1-soir': true } };
const withMembers = { ...base, members: [A, B, C] };
const simple = { ...base, adults: 2, children: 1 };

const gen = (profile, extra = {}) =>
  generatePlan({ recipes: RECIPES, ingredients: INGREDIENTS, profile, seed: 7, ...extra });

describe('convives choisis', () => {
  test('cleanEaters : ids inconnus ignorés, liste vide ou inconnue = tout le foyer', () => {
    expect(cleanEaters(withMembers, ['b', 'zz'])).toEqual(['b']);
    expect(cleanEaters(withMembers, ['zz'])).toBeNull();
    expect(cleanEaters(withMembers, [])).toBeNull();
    expect(cleanEaters(withMembers, undefined)).toBeNull();
    expect(cleanEaters(withMembers, 'a')).toBeNull();
    expect(cleanEaters(withMembers, ['c', 'a'])).toEqual(['a', 'c']);
  });

  test('personsFor suit les convives, sans eux comme avant', () => {
    const tout = personsFor(withMembers, 0, 'soir');
    expect(personsFor(withMembers, 0, 'soir', {})).toBe(tout);
    expect(personsFor(withMembers, 0, 'soir', { eaters: ['zz'] })).toBe(tout);
    const seul = personsFor(withMembers, 0, 'soir', { eaters: ['a'] });
    expect(seul).toBeGreaterThan(0.5);
    expect(seul).toBeLessThan(tout);
    const deux = personsFor(withMembers, 0, 'soir', { eaters: ['a', 'c'] });
    expect(deux).toBeGreaterThan(seul);
    expect(deux).toBeLessThan(tout);
  });

  test('le choix prime sur la cantine', () => {
    const p = { ...withMembers, kidsCantine: true };
    expect(membersAt(p, 1, 'midi').map((m) => m.id)).toEqual(['a', 'b']);
    expect(membersAt(p, 1, 'midi', { eaters: ['c'] }).map((m) => m.id)).toEqual(['c']);
  });

  test('sans personnes : meal.heads', () => {
    expect(validHeads(3)).toBe(3);
    expect(validHeads(0)).toBeNull();
    expect(validHeads('x')).toBeNull();
    expect(validHeads(2.5)).toBeNull();
    expect(personsFor(simple, 0, 'soir', { heads: 1 })).toBe(1);
    expect(personsFor(simple, 0, 'soir', { heads: 5 })).toBeGreaterThan(personsFor(simple, 0, 'soir'));
    expect(personsFor(simple, 0, 'soir', { heads: 'abc' })).toBe(personsFor(simple, 0, 'soir'));
    expect(headsFor(withMembers, 0, 'soir', { eaters: ['a', 'c'] })).toEqual({
      heads: 2,
      adults: 1,
      children: 1,
    });
  });

  test('cibles : chacun avec ses infos', () => {
    const toutes = householdMealNeeds(withMembers, 0, 'soir');
    const a = householdMealNeeds(withMembers, 0, 'soir', { eaters: ['a'] });
    expect(a.count).toBe(1);
    expect(a.kcal).toBeLessThan(toutes.kcal);
    const t = mealTarget(withMembers, 0, 'soir', { eaters: ['b'] });
    expect(t.kcal).toBeGreaterThan(0);
    expect(mealTarget(simple, 0, 'soir', { eaters: ['b'] })).toBeNull();
    const plan = {
      meals: [{ key: '0-soir', day: 0, slot: 'soir', recipeId: RECIPES[0].id, eaters: ['a'] }],
    };
    const wt = weekTargets(plan, RECIPES, withMembers);
    expect(wt.days[0].members.map((m) => m.id)).toEqual(['a']);
  });
});

describe('plan et courses', () => {
  test('sans réglage : aucun champ ajouté', () => {
    const plan = gen(withMembers);
    expect(plan.meals.every((m) => m.eaters === undefined && m.heads === undefined)).toBe(true);
  });

  test('setMealGuests : portions, refus de la liste vide, retrait quand tout le foyer', () => {
    const plan = gen(withMembers);
    const m0 = plan.meals.find((m) => m.recipeId && !m.leftoverOf);
    const un = setMealGuests({ plan, profile: withMembers, mealKey: m0.key, eaters: ['a'] });
    const m1 = un.meals.find((m) => m.key === m0.key);
    expect(m1.eaters).toEqual(['a']);
    expect(m1.persons).toBeLessThan(m0.persons);
    expect(guestsOf(withMembers, m1)).toEqual({ eaters: ['a'] });
    expect(setMealGuests({ plan: un, profile: withMembers, mealKey: m0.key, eaters: [] })).toBe(un);
    expect(setMealGuests({ plan: un, profile: withMembers, mealKey: m0.key, eaters: ['zz'] })).toBe(
      un
    );
    const tous = setMealGuests({
      plan: un,
      profile: withMembers,
      mealKey: m0.key,
      eaters: ['a', 'b', 'c'],
    });
    const m2 = tous.meals.find((m) => m.key === m0.key);
    expect(m2.eaters).toBeUndefined();
    expect(m2.persons).toBe(m0.persons);
    expect(setMealGuests({ plan, profile: withMembers, mealKey: 'nope', eaters: ['a'] })).toBe(plan);
  });

  test('les courses suivent les convives', () => {
    const plan = gen(withMembers);
    const m0 = plan.meals.find((m) => m.recipeId && !m.leftoverOf && !m.free);
    const un = setMealGuests({ plan, profile: withMembers, mealKey: m0.key, eaters: ['a'] });
    const args = { recipes: RECIPES, ingredients: INGREDIENTS, profile: withMembers };
    const avant = buildShoppingList({ ...args, plan });
    const apres = buildShoppingList({ ...args, plan: un });
    const qty = (sh) => sh.lines.reduce((t, l) => t + l.qty, 0);
    expect(qty(apres)).toBeLessThan(qty(avant));
  });

  test('sans personnes : nombre de personnes du repas', () => {
    const plan = gen(simple);
    const m0 = plan.meals.find((m) => m.recipeId && !m.leftoverOf);
    const un = setMealGuests({ plan, profile: simple, mealKey: m0.key, heads: 1 });
    expect(un.meals.find((m) => m.key === m0.key)).toMatchObject({ heads: 1, persons: 1 });
    expect(setMealGuests({ plan, profile: simple, mealKey: m0.key, heads: 0 })).toBe(plan);
  });

  test('changer le plat ou régénérer garde les convives', () => {
    const plan0 = gen(withMembers);
    const key = plan0.meals.find((m) => m.recipeId && !m.leftoverOf).key;
    const plan = setMealGuests({ plan: plan0, profile: withMembers, mealKey: key, eaters: ['b'] });
    const args = { recipes: RECIPES, ingredients: INGREDIENTS, profile: withMembers };
    const sw = swapMeal({ ...args, plan, mealKey: key });
    const m = sw.meals.find((x) => x.key === key);
    expect(m.eaters).toEqual(['b']);
    expect(m.persons).toBe(personsFor(withMembers, m.day, m.slot, { eaters: ['b'] }));
    const regen = gen(withMembers, { seed: 99, eaters: plan });
    expect(regen.meals.find((x) => x.key === key).eaters).toEqual(['b']);
    const sans = gen(withMembers, { seed: 99 });
    const rep = carryGuests(plan, sans, withMembers);
    const r = rep.meals.find((x) => x.key === key);
    expect(r.eaters).toEqual(['b']);
    expect(r.persons).toBe(personsFor(withMembers, r.day, r.slot, { eaters: ['b'] }));
    expect(carryGuests(plan0, sans, withMembers)).toBe(sans);
  });

  test('ids supprimés du foyer : ignorés, jamais d exception', () => {
    const plan0 = gen(withMembers);
    const key = plan0.meals.find((m) => m.recipeId && !m.leftoverOf).key;
    const plan = setMealGuests({ plan: plan0, profile: withMembers, mealKey: key, eaters: ['c'] });
    const sansC = { ...base, members: [A, B] };
    const sw = swapMeal({
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: sansC,
      plan,
      mealKey: key,
    });
    expect(sw.meals.find((x) => x.key === key).eaters).toBeUndefined();
    expect(() =>
      buildShoppingList({ plan, recipes: RECIPES, ingredients: INGREDIENTS, profile: sansC })
    ).not.toThrow();
  });

  test('setMealGuests recalcule le budget estimé quand les recettes sont données', () => {
    const plan = gen({ ...withMembers, budget: 200 });
    const m = plan.meals.find((x) => x.recipeId && !x.leftoverOf && !x.free);
    const out = setMealGuests({
      plan,
      profile: { ...withMembers, budget: 200 },
      mealKey: m.key,
      eaters: ['a'],
      recipes: RECIPES,
      ingredients: INGREDIENTS,
    });
    expect(out.budget.estimated).toBeLessThanOrEqual(plan.budget.estimated);
    expect(out.budget.target).toBe(200);
    const sans = setMealGuests({ plan, profile: withMembers, mealKey: m.key, eaters: ['a'] });
    expect(sans.budget).toEqual(plan.budget);
  });
});
