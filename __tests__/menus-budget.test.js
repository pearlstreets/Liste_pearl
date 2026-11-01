// Budget de la semaine : tenu des qu'il est atteignable avec le catalogue ; sinon le plan le moins cher trouve est
// rendu et signale (budget.unreachable, budget.minimum, avertissement budget_unreachable).
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getRecipes, getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { generatePlan, swapMeal, estimatePlanTotal } from '../lib/menus/planner';

beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

const BUDGETS = [15, 25, 40];
const FOYERS = [1, 2, 3, 4, 5];
const SEEDS = [1, 2, 3];

// Sans echeance (repairMs: 0) : le resultat ne depend pas de la charge de la machine.
const plan = (recipes, budget, adults, seed, extra = {}) =>
  generatePlan({
    recipes,
    ingredients: getIngredients(),
    profile: { adults, budget, ...extra },
    seed,
    weekStart: '2026-11-02',
    repairMs: 0,
  });

function coherent(p, budget, repas = 14) {
  const b = p.budget;
  const codes = p.warnings.map((w) => w.code);
  expect(codes).not.toContain('error');
  expect(b.target).toBe(budget);
  if (b.within) {
    expect(b.estimated).toBeLessThanOrEqual(budget);
    expect(b.unreachable).toBe(false);
    expect(b.minimum).toBeNull();
    expect(codes).not.toContain('over_budget');
    expect(codes).not.toContain('budget_unreachable');
  } else {
    // hors d'atteinte : le plan rendu est le moins cher trouve
    expect(b.unreachable).toBe(true);
    expect(b.minimum).toBeGreaterThan(budget);
    expect(b.estimated).toBe(b.minimum);
    expect(codes).toContain('over_budget');
    const w = p.warnings.find((x) => x.code === 'budget_unreachable');
    expect(w).toEqual({ code: 'budget_unreachable', budget, minimum: b.minimum });
  }
  expect(p.meals.filter((m) => m.recipeId && !m.free).length).toBe(repas);
}

describe('budget avec le catalogue complet', () => {
  test.each(BUDGETS)(
    'budget %d EUR, foyer de 1 a 5 : tenu ou signale hors d atteinte',
    (budget) => {
      for (const adults of FOYERS)
        for (const seed of SEEDS) coherent(plan(getCatalog(), budget, adults, seed), budget);
    },
    300000
  );

  test('15 EUR pour 1 personne et 40 EUR jusqu a 4 personnes : toujours tenus', () => {
    for (const seed of SEEDS) {
      expect(plan(getCatalog(), 15, 1, seed).budget.within).toBe(true);
      for (const adults of [1, 2, 3, 4])
        expect(plan(getCatalog(), 40, adults, seed).budget.within).toBe(true);
      expect(plan(getCatalog(), 25, 1, seed).budget.within).toBe(true);
    }
  }, 300000);

  test('15 EUR pour 5 personnes : hors d atteinte, plan le moins cher rendu', () => {
    const p = plan(getCatalog(), 15, 5, 1);
    expect(p.budget.unreachable).toBe(true);
    // aucun plan de la graine ne fait mieux que le minimum annonce de plus de quelques euros
    for (const seed of [2, 3, 4]) {
      const q = generatePlan({
        recipes: getCatalog(),
        ingredients: getIngredients(),
        profile: { adults: 5 },
        seed,
        repairMs: 0,
      });
      expect(q.budget.estimated).toBeGreaterThan(p.budget.minimum - 0.01);
    }
  }, 300000);

  test('budget atteignable : la contrainte la plus basse de plusieurs graines est tenue (pas de depassement aleatoire)', () => {
    // minimum du foyer de 2, puis un budget juste au-dessus : tenu a chaque graine
    const min = plan(getCatalog(), 1, 2, 1).budget.minimum;
    expect(min).toBeGreaterThan(1);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const p = plan(getCatalog(), Math.ceil(min + 0.5), 2, seed);
      expect(p.budget.within).toBe(true);
    }
  }, 300000);

  test('meme graine, meme plan (le plan le moins cher est garde par profil)', () => {
    const a = plan(getCatalog(), 15, 3, 7);
    const b = plan(getCatalog(), 15, 3, 7);
    expect(b.meals.map((m) => m.recipeId)).toEqual(a.meals.map((m) => m.recipeId));
    expect(b.budget).toEqual(a.budget);
  }, 300000);

  test('total annonce = liste de courses ; echange : budget hors d atteinte toujours signale', () => {
    const args = {
      recipes: getCatalog(),
      ingredients: getIngredients(),
      profile: { adults: 4, budget: 15 },
      seed: 3,
      repairMs: 0,
    };
    const p = generatePlan(args);
    expect(estimatePlanTotal({ ...args, plan: p })).toBe(p.budget.estimated);
    const key = p.meals.find((m) => m.recipeId && !m.leftoverOf).key;
    const s = swapMeal({ ...args, plan: p, mealKey: key });
    expect(s.budget.unreachable).toBe(true);
    expect(s.budget.minimum).toBe(p.budget.minimum);
    // budget releve au-dessus du minimum : l'echange ne pretend plus que le budget est hors d'atteinte
    const s2 = swapMeal({ ...args, profile: { adults: 4, budget: 500 }, plan: p, mealKey: key });
    expect(s2.budget.unreachable).toBe(false);
    expect(s2.budget.minimum).toBeNull();
  }, 300000);

  test('sans budget : rien n est signale', () => {
    const p = generatePlan({
      recipes: getCatalog(),
      ingredients: getIngredients(),
      profile: { adults: 2 },
      seed: 1,
    });
    expect(p.budget.unreachable).toBeNull();
    expect(p.budget.minimum).toBeNull();
    expect(p.warnings.map((w) => w.code)).not.toContain('budget_unreachable');
  });

  test('repas verrouilles gardes par la recherche du moins cher', () => {
    const base = plan(getCatalog(), 15, 3, 2);
    const locked = base.meals.find((m) => m.recipeId && !m.leftoverOf && m.key !== '0-midi');
    const p = generatePlan({
      recipes: getCatalog(),
      ingredients: getIngredients(),
      profile: { adults: 3, budget: 15 },
      seed: 2,
      repairMs: 0,
      locked: { '0-midi': { free: true }, [locked.key]: locked.recipeId },
    });
    expect(p.meals.find((m) => m.key === '0-midi').free).toBe(true);
    expect(p.meals.find((m) => m.key === locked.key).recipeId).toBe(locked.recipeId);
    coherent(p, 15, 13);
  }, 300000);
});

describe('budget avec les 474 recettes ecrites a la main', () => {
  test.each(BUDGETS)(
    'budget %d EUR, foyer de 1 a 5 : tenu ou signale hors d atteinte',
    (budget) => {
      for (const adults of FOYERS) coherent(plan(getRecipes(), budget, adults, 1), budget);
    },
    300000
  );
});
