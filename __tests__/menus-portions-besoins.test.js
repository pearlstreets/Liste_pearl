// Portions ajustées aux besoins (mode personnalisé) et passage Simple / Personnalisé : Courses, budget,
// cartes et apports suivent toujours le mode et le foyer actuels, convives choisis gardés.
import { INGREDIENTS, RECIPES } from './menus-fixtures';
import { generatePlan, setMealGuests, budgetStatus, recomputeCooking } from '../lib/menus/planner';
import { personsFor, mealsForProfile, normalizeProfile } from '../lib/menus/profile';
import {
  recipePortionScale,
  portionTarget,
  mealTarget,
  SCALE_MIN,
  SCALE_MAX,
} from '../lib/menus/needs';
import { buildShoppingList } from '../lib/menus/shopping';
import { dayTotals } from '../lib/menus/sides';
import { weekTargets } from '../lib/menus/nutrition';

const LEA = {
  id: 'lea',
  name: 'Léa',
  age: 32,
  sex: 'f',
  heightCm: 165,
  weightKg: 60,
  activity: 'elevee',
  goal: 'perdre',
};
const TOM = {
  id: 'tom',
  name: 'Tom',
  age: 28,
  sex: 'm',
  heightCm: 180,
  weightKg: 78,
  goal: 'prendre',
};
const slots = { '0-midi': true, '0-soir': true, '1-midi': true, '1-soir': true, '2-soir': true };
const perso = normalizeProfile({ mode: 'perso', members: [LEA, TOM], slots });
const simple = normalizeProfile({ ...perso, mode: 'simple' });

const gen = (profile) =>
  generatePlan({ recipes: RECIPES, ingredients: INGREDIENTS, profile, seed: 11 });
const total = (plan, profile) =>
  buildShoppingList({ plan, recipes: RECIPES, ingredients: INGREDIENTS, profile, fitNeeds: true })
    .totalEur;
const byId = new Map(RECIPES.map((r) => [r.id, r]));

describe('portion ajustée aux besoins', () => {
  test('recipePortionScale : cible / kcal de la recette, bornée, 1 sans personnes', () => {
    const t = portionTarget(perso);
    expect(t.kcal).toBe(730);
    expect(recipePortionScale(perso, { kcal: 480 })).toBe(1.5);
    expect(recipePortionScale(perso, { kcal: 730 })).toBe(1);
    expect(recipePortionScale(perso, { kcal: 100 })).toBe(SCALE_MAX);
    expect(recipePortionScale(perso, { kcal: 3000 })).toBe(SCALE_MIN);
    expect(recipePortionScale(perso, { kcal: 0 })).toBe(1);
    expect(recipePortionScale(perso, null)).toBe(1);
    expect(recipePortionScale(simple, { kcal: 480 })).toBe(1);
  });

  test('la cible par portion est la même pour chaque convive (ajustement par recette)', () => {
    const lea = mealTarget(perso, 0, 'soir', { eaters: ['lea'] }).kcal;
    const tom = mealTarget(perso, 0, 'soir', { eaters: ['tom'] }).kcal;
    expect(Math.abs(lea - tom)).toBeLessThanOrEqual(20);
  });

  test('chaque repas servi approche la cible de chaque personne', () => {
    const plan = gen(perso);
    const wt = weekTargets(plan, RECIPES, perso);
    let vus = 0;
    for (const d of wt.days)
      for (const m of d.meals) {
        if (!m.recipeId) continue;
        const s = recipePortionScale(perso, byId.get(m.recipeId));
        if (s === SCALE_MIN || s === SCALE_MAX) continue;
        for (const row of m.members) {
          vus++;
          expect(Math.abs(row.kcal - row.targetKcal) / row.targetKcal).toBeLessThan(0.08);
        }
      }
    expect(vus).toBeGreaterThan(0);
  });

  test('apports du jour (portion servie) proches de la cible des repas prévus', () => {
    const plan = gen(perso);
    for (const d of dayTotals(plan, RECIPES, perso)) {
      if (!d.meals || !d.target) continue;
      const brut = plan.meals
        .filter((m) => m.day === d.day && m.recipeId && !m.free)
        .map((m) => byId.get(m.recipeId));
      if (brut.some((r) => [SCALE_MIN, SCALE_MAX].includes(recipePortionScale(perso, r)))) continue;
      expect(Math.abs(d.kcal - d.target.kcal) / d.target.kcal).toBeLessThan(0.06);
    }
  });

  test('Courses aux portions ajustées, sans effet en mode simple', () => {
    const plan = gen(perso);
    const brut = buildShoppingList({
      plan,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: perso,
    });
    const fit = buildShoppingList({
      plan,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: perso,
      fitNeeds: true,
    });
    const qty = (sh) => sh.lines.reduce((t, l) => t + (Number(l.qty) || 0), 0);
    expect(qty(fit)).not.toBe(qty(brut));
    const ps = gen(simple);
    expect(total(ps, simple)).toBe(
      buildShoppingList({ plan: ps, recipes: RECIPES, ingredients: INGREDIENTS, profile: simple })
        .totalEur
    );
  });

  test('budget affiché = total des Courses (mode personnalisé)', () => {
    const plan = gen(perso);
    const b = budgetStatus({ plan, recipes: RECIPES, ingredients: INGREDIENTS, profile: perso });
    expect(b.estimated).toBe(total(plan, perso));
  });
});

describe('passage Simple / Personnalisé', () => {
  const key = '0-soir';
  const avecLea = () =>
    setMealGuests({
      plan: gen(perso),
      profile: perso,
      mealKey: key,
      eaters: ['lea'],
      recipes: RECIPES,
      ingredients: INGREDIENTS,
    });
  const refresh = (plan, profile) => ({
    ...plan,
    meals: recomputeCooking(mealsForProfile(plan.meals, profile)),
  });

  test('en simple : portions du foyer simple, convives gardés sur le repas', () => {
    const p1 = avecLea();
    const m1 = p1.meals.find((m) => m.key === key);
    expect(m1.persons).toBe(personsFor(perso, 0, 'soir', { eaters: ['lea'] }));
    const p2 = refresh(p1, simple);
    const m2 = p2.meals.find((m) => m.key === key);
    expect(m2.persons).toBe(2);
    expect(m2.eaters).toEqual(['lea']);
    for (const m of p2.meals)
      if (m.day !== undefined) expect(m.persons).toBe(personsFor(simple, m.day, m.slot, m));
    // Courses et budget concordent avec le foyer simple
    const b = budgetStatus({
      plan: p2,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: simple,
    });
    expect(b.estimated).toBe(total(p2, simple));
    // retour en personnalisé : Léa seule retrouvée
    const p3 = refresh(p2, perso);
    expect(p3.meals.find((m) => m.key === key).persons).toBe(m1.persons);
    const b3 = budgetStatus({
      plan: p3,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: perso,
    });
    expect(b3.estimated).toBe(total(p3, perso));
  });

  test('sans refresh, les Courses gardaient les portions du mode personnalisé (défaut corrigé)', () => {
    const p1 = avecLea();
    const b = budgetStatus({
      plan: p1,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: simple,
    });
    expect(total(refresh(p1, simple), simple)).toBe(b.estimated);
  });
});
