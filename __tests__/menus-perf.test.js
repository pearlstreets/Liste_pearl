// Performance des menus sur le vrai catalogue (environ 350 recettes) : plan, échange, recherche, chargement.
import fs from 'fs';
import path from 'path';
import { generatePlan, swapMeal, eligibleRecipes } from '../lib/menus/planner';
import { searchRecipes, recipesByPantry } from '../lib/menus/search';
import { buildShoppingList } from '../lib/menus/shopping';
import { getRecipes, getIngredients, getTexts, resetMenusCache } from '../lib/menus/recipes';

// CI : machine lente et code instrumente par --coverage, seuils elargis.
const MARGE = process.env.CI ? 5 : 1;

const mesure = (fn, n) => {
  const t = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    fn(i);
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  return { moy: t.reduce((s, v) => s + v, 0) / n, p95: t[Math.floor(n * 0.95)], max: t[n - 1] };
};
const f = (m) => `moy ${m.moy.toFixed(1)} ms, p95 ${m.p95.toFixed(1)} ms, max ${m.max.toFixed(1)} ms`;

const PROFILS = {
  defaut: { adults: 2, children: 0 },
  famille: { adults: 2, children: 3, budget: 90 },
  vegetarien: { adults: 2, children: 1, diets: ['vegetarien'], budget: 60 },
  vegan: { adults: 1, children: 0, diets: ['vegan', 'sans-gluten'] },
};

describe('performance avec le vrai catalogue', () => {
  const recipes = getRecipes();
  const ingredients = getIngredients();

  test('le catalogue contient environ 350 recettes', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(330);
  });

  test.each(Object.keys(PROFILS))('plan bien sous 300 ms : %s', (nom) => {
    const profile = PROFILS[nom];
    const m = mesure(
      (i) => generatePlan({ recipes, ingredients, profile, seed: i + 1, weekStart: '2026-11-02' }),
      30
    );
    console.log(`plan ${nom} : ${f(m)}`);
    expect(m.moy).toBeLessThan(150 * MARGE);
    expect(m.p95).toBeLessThan(300 * MARGE);
  });

  test('échange, liste de courses et admissibilité', () => {
    const args = { recipes, ingredients, profile: PROFILS.famille, seed: 3, weekStart: '2026-11-02' };
    const plan = generatePlan(args);
    const repas = plan.meals.filter((x) => x.recipeId);
    const s = mesure((i) => swapMeal({ ...args, plan, mealKey: repas[i % repas.length].key }), 20);
    const c = mesure(() => buildShoppingList({ plan, ingredients, recipes }), 20);
    const e = mesure(() => eligibleRecipes(args), 20);
    console.log(`échange : ${f(s)}\ncourses : ${f(c)}\nadmissibles : ${f(e)}`);
    expect(s.p95).toBeLessThan(300 * MARGE);
    expect(c.max).toBeLessThan(100 * MARGE);
    expect(e.max).toBeLessThan(50 * MARGE);
  });

  test('recherche fluide à chaque frappe', () => {
    const t = getTexts('fr');
    const opts = (query) => ({
      query,
      titleOf: (r) => t.recipeTitle(r.id),
      ingredientNameOf: (k) => t.ingredientName(k),
    });
    const mots = ['p', 'po', 'pou', 'poulet', 'poulet riz', 'chevre', 'lentilles corail', 'zzz'];
    const m = mesure((i) => searchRecipes(recipes, opts(mots[i % mots.length])), 80);
    const fr = mesure(() => recipesByPantry(recipes, ['oeuf', 'tomate', 'riz', 'oignon'], { ingredients }), 20);
    console.log(`recherche : ${f(m)}\nfrigo : ${f(fr)}`);
    expect(m.max).toBeLessThan(50 * MARGE);
    expect(fr.max).toBeLessThan(50 * MARGE);
  });

  test('chargement : catalogue et langue en moins de 100 ms', () => {
    const dir = path.join(__dirname, '..', 'data', 'menus');
    const lit = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
    const brut = ['recipes.json', 'ingredients.json', 'i18n/fr.json', 'i18n/ar.json'].map(lit);
    const octets = brut.reduce((s, x) => s + Buffer.byteLength(x), 0);
    const m = mesure(() => brut.forEach((x) => JSON.parse(x)), 20);
    resetMenusCache();
    const a = performance.now();
    getRecipes();
    getIngredients();
    const texts = getTexts('ar');
    texts.recipeTitle('crepes-faciles');
    const premier = performance.now() - a;
    console.log(`analyse JSON ${(octets / 1024).toFixed(0)} Ko : ${f(m)}\npremier accès : ${premier.toFixed(1)} ms`);
    expect(m.max).toBeLessThan(100 * MARGE);
    expect(premier).toBeLessThan(100 * MARGE);
  });
});
