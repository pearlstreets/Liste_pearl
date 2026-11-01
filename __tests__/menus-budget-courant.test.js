// Jauge de la semaine : budget et foyer ACTUELS (reglages changes apres la composition) sans recomposer les repas,
// et minimum annonce stable (le plus bas trouve, rien tant que la recherche du moins cher n'est pas finie).
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { generatePlan, budgetStatus, refineCheapest } from '../lib/menus/planner';

beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

const ingredients = () => getIngredients();
const gen = (recipes, profile, seed, repairMs) =>
  generatePlan({ recipes, ingredients: ingredients(), profile, seed, weekStart: '2026-11-02', repairMs });

// Poursuit la recherche comme l'ecran (un depart par appel) jusqu'a la fin.
const finir = (args) => {
  let n = 0;
  while (!refineCheapest(args) && n < 50) n++;
  return n;
};

describe('budgetStatus : jauge a jour sans recomposer', () => {
  test('budget releve dans les reglages : plus de depassement ni de ligne orange', () => {
    const recipes = getCatalog();
    const p0 = { adults: 2, children: 2, budget: 20 };
    const plan = gen(recipes, p0, 7, 0);
    expect(plan.budget.within).toBe(false);
    const s = budgetStatus({ plan, recipes, ingredients: ingredients(), profile: { ...p0, budget: 60 } });
    expect(s.target).toBe(60);
    expect(s.estimated).toBe(plan.budget.estimated);
    expect(s.over).toBe(false);
    expect(s.unreachable).toBe(false);
    expect(s.minimum).toBeNull();
  });

  test('budget toujours depasse : minimum connu, jamais plus haut que le plan', () => {
    const recipes = getCatalog();
    const p0 = { adults: 2, children: 2, budget: 20 };
    const plan = gen(recipes, p0, 8, 0);
    const args = { plan, recipes, ingredients: ingredients(), profile: { ...p0, budget: 15 } };
    finir(args);
    const s = budgetStatus(args);
    expect(s.over).toBe(true);
    expect(s.searching).toBe(false);
    expect(s.unreachable).toBe(true);
    expect(s.minimum).toBeGreaterThan(15);
    expect(s.minimum).toBeLessThanOrEqual(s.estimated);
  });

  test('foyer change : estimation au foyer actuel, memes plats', () => {
    const recipes = getCatalog();
    const plan = gen(recipes, { adults: 2, children: 0 }, 9, 0);
    const s1 = budgetStatus({ plan, recipes, ingredients: ingredients(), profile: { adults: 2 } });
    const s4 = budgetStatus({ plan, recipes, ingredients: ingredients(), profile: { adults: 4 } });
    expect(s1.estimated).toBe(plan.budget.estimated);
    expect(s4.estimated).toBeGreaterThan(s1.estimated);
  });

  test('recherche coupee : rien annonce tant qu elle n est pas finie, puis le meilleur, stable', () => {
    resetMenusCache();
    const recipes = getCatalog();
    // foyer et budget propres a ce test : memoire de recherche neuve
    const profile = { adults: 2, children: 2, budget: 12, maxTimeMin: 45 };
    let tick = 0;
    const plan = generatePlan({
      recipes,
      ingredients: ingredients(),
      profile,
      seed: 3,
      weekStart: '2026-11-02',
      repairMs: 1,
      clock: () => (tick += 1000),
    });
    const args = { plan, recipes, ingredients: ingredients(), profile };
    const s0 = budgetStatus(args);
    expect(s0.over).toBe(true);
    if (s0.searching) {
      expect(s0.minimum).toBeNull();
      expect(s0.unreachable).toBe(false);
    }
    finir(args);
    const s1 = budgetStatus(args);
    expect(s1.searching).toBe(false);
    // recomposer reprend le meilleur memorise : le minimum annonce ne monte jamais
    const again = gen(recipes, profile, 4, 0);
    const s2 = budgetStatus({ ...args, plan: again });
    if (s1.unreachable) {
      expect(s2.minimum).toBeLessThanOrEqual(s1.minimum);
      expect(again.budget.estimated).toBeLessThanOrEqual(s1.minimum + 0.01);
    }
  });

  test('rapide : budgetStatus et un pas de refineCheapest', () => {
    const recipes = getCatalog();
    const profile = { adults: 3, children: 1, budget: 18 };
    const plan = gen(recipes, profile, 11);
    const args = { plan, recipes, ingredients: ingredients(), profile };
    let a = performance.now();
    budgetStatus(args);
    const tStatus = performance.now() - a;
    let pas = 0;
    a = performance.now();
    let fin = refineCheapest(args);
    const tPas = performance.now() - a;
    while (!fin && pas < 50) {
      fin = refineCheapest(args);
      pas++;
    }
    a = performance.now();
    budgetStatus(args);
    const tStatus2 = performance.now() - a;
    // eslint-disable-next-line no-console
    console.log(`status ${tStatus.toFixed(1)} ms, pas ${tPas.toFixed(1)} ms, status apres ${tStatus2.toFixed(1)} ms`);
    const M = process.env.CI ? 5 : 1;
    expect(tStatus2).toBeLessThan(60 * M);
  });
});

describe('plan le moins cher garde par profil', () => {
  test('minimum annonce : jamais plus haut qu un plan deja trouve, quelle que soit la graine', () => {
    const recipes = getCatalog();
    const profile = { adults: 2, budget: 1 };
    const mins = [1, 2, 3, 4].map((seed) => gen(recipes, profile, seed, 0).budget.minimum);
    for (const v of mins) expect(v).toBeLessThanOrEqual(mins[0] + 0.001);
    expect(new Set(mins).size).toBe(1);
  });
});
