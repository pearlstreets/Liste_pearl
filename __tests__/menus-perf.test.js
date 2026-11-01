// Performance des menus : les 474 recettes ecrites a la main (chemin tableau) et le catalogue complet
// (474 + environ 11 600 generees). Budgets de scripts/menus-gen/CONCEPTION.md section 8.3 (V8, multiplies par 5 si CI).
import fs from 'fs';
import path from 'path';
import { generatePlan, swapMeal, eligibleRecipes } from '../lib/menus/planner';
import { searchRecipes, recipesByPantry } from '../lib/menus/search';
import { buildShoppingList } from '../lib/menus/shopping';
import {
  getRecipes,
  getCatalog,
  getIngredients,
  getTexts,
  preloadMenusData,
  resetMenusCache,
} from '../lib/menus/recipes';
import { eligibleCatalog, sampleMains, buildPool, POOL_PLAN } from '../lib/menus/pool';
import {
  searchCatalog,
  pantryCatalog,
  buildTitleIndex,
  resetSearchIndex,
} from '../lib/menus/searchIndex';
import { proposeBatch } from '../lib/menus/batch';
import { initCatalog } from '../lib/menus/catalog';

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
const f = (m) =>
  `moy ${m.moy.toFixed(1)} ms, p95 ${m.p95.toFixed(1)} ms, max ${m.max.toFixed(1)} ms`;

const PROFILS = {
  defaut: { adults: 2, children: 0 },
  famille: { adults: 2, children: 3, budget: 90 },
  vegetarien: { adults: 2, children: 1, diets: ['vegetarien'], budget: 60 },
  vegan: { adults: 1, children: 0, diets: ['vegan', 'sans-gluten'] },
};

describe('performance avec les recettes ecrites a la main (chemin tableau)', () => {
  const recipes = getRecipes();
  const ingredients = getIngredients();

  test('le tableau contient environ 350 recettes ecrites a la main', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(330);
  });

  test.each(Object.keys(PROFILS))('plan bien sous 300 ms : %s', (nom) => {
    const profile = PROFILS[nom];
    const m = mesure(
      (i) => generatePlan({ recipes, ingredients, profile, seed: i + 1, weekStart: '2026-11-02' }),
      30
    );
    console.log(`plan (tableau) ${nom} : ${f(m)}`);
    expect(m.moy).toBeLessThan(150 * MARGE);
    expect(m.p95).toBeLessThan(300 * MARGE);
  });

  test('échange, liste de courses et admissibilité', () => {
    const args = {
      recipes,
      ingredients,
      profile: PROFILS.famille,
      seed: 3,
      weekStart: '2026-11-02',
    };
    const plan = generatePlan(args);
    const repas = plan.meals.filter((x) => x.recipeId);
    const s = mesure((i) => swapMeal({ ...args, plan, mealKey: repas[i % repas.length].key }), 20);
    const c = mesure(() => buildShoppingList({ plan, ingredients, recipes }), 20);
    const e = mesure(() => eligibleRecipes(args), 20);
    console.log(`échange (tableau) : ${f(s)}\ncourses : ${f(c)}\nadmissibles : ${f(e)}`);
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
    const fr = mesure(
      () => recipesByPantry(recipes, ['oeuf', 'tomate', 'riz', 'oignon'], { ingredients }),
      20
    );
    console.log(`recherche (tableau) : ${f(m)}\nfrigo : ${f(fr)}`);
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
    console.log(
      `analyse JSON ${(octets / 1024).toFixed(0)} Ko : ${f(m)}\npremier accès : ${premier.toFixed(1)} ms`
    );
    expect(m.max).toBeLessThan(100 * MARGE);
    expect(premier).toBeLessThan(100 * MARGE);
  });
});

describe('performance avec le catalogue complet (474 + generees)', () => {
  let catalog;
  let ingredients;
  beforeAll(() => {
    resetMenusCache();
    catalog = getCatalog();
    ingredients = getIngredients();
  });
  afterAll(() => resetMenusCache());

  test('le catalogue contient plus de 11 000 recettes', () => {
    expect(catalog.size).toBeGreaterThanOrEqual(11000);
  });

  test('chargement : initCatalog, titres et etapes du premier acces', async () => {
    resetMenusCache();
    const a = performance.now();
    initCatalog();
    const init = performance.now() - a;
    const b = performance.now();
    const t = getTexts('fr');
    t.recipeTitle('g-1');
    t.recipeSteps('g-1');
    const premier = performance.now() - b;
    resetMenusCache();
    const c = performance.now();
    const rapport = await preloadMenusData('fr', { background: false });
    const preload = performance.now() - c;
    console.log(
      `initCatalog ${init.toFixed(1)} ms ; premier titre + etapes ${premier.toFixed(1)} ms ; ` +
        `preloadMenusData ${preload.toFixed(1)} ms (plus longue tranche ${rapport.maxSliceMs.toFixed(1)} ms)`
    );
    expect(rapport.status).toBe('ready');
    expect(init).toBeLessThan(30 * MARGE);
    expect(premier).toBeLessThan(60 * MARGE);
    expect(rapport.maxSliceMs).toBeLessThan(50 * MARGE);
    catalog = getCatalog();
  });

  test('admissibilite par colonnes : a froid et en cache', () => {
    const profil = {
      adults: 2,
      diets: ['sans-gluten'],
      excludedIngredients: ['lait', 'champignon'],
      maxTimeMin: 60,
    };
    const a = performance.now();
    const el = eligibleCatalog(catalog, ingredients, profil);
    const froid = performance.now() - a;
    const cache = mesure(() => eligibleCatalog(catalog, ingredients, profil), 50);
    const autres = mesure(
      (i) => eligibleCatalog(catalog, ingredients, { adults: 2, maxTimeMin: 20 + i }),
      20
    );
    console.log(
      `eligible() a froid ${froid.toFixed(1)} ms (${el.M} plats) ; en cache ${f(cache)} ; autres profils ${f(autres)}`
    );
    expect(froid).toBeLessThan(40 * MARGE);
    expect(cache.max).toBeLessThan(3 * MARGE);
    expect(autres.p95).toBeLessThan(40 * MARGE);
  });

  test('liste courte et suggestions', () => {
    const el = eligibleCatalog(catalog, ingredients, PROFILS.defaut);
    const p = mesure((i) => buildPool(el, { seed: i, K: POOL_PLAN }), 30);
    const s = mesure(() => sampleMains(el, { n: 3 }), 50);
    console.log(`liste courte : ${f(p)} ; suggestions : ${f(s)}`);
    expect(p.p95).toBeLessThan(30 * MARGE);
    expect(s.p95).toBeLessThan(10 * MARGE);
  });

  test.each(Object.keys(PROFILS))('plan bien sous 300 ms : %s', (nom) => {
    const profile = PROFILS[nom];
    generatePlan({ recipes: catalog, ingredients, profile, seed: 99 }); // premier plan : chargement des blocs
    const m = mesure(
      (i) =>
        generatePlan({
          recipes: catalog,
          ingredients,
          profile,
          seed: i + 1,
          weekStart: '2026-11-02',
        }),
      30
    );
    console.log(`plan (catalogue) ${nom} : ${f(m)}`);
    expect(m.moy).toBeLessThan(150 * MARGE);
    expect(m.p95).toBeLessThan(300 * MARGE);
  });

  test('échange (p95 sous 100 ms), liste de courses et cuisine en lot', () => {
    const args = {
      recipes: catalog,
      ingredients,
      profile: PROFILS.famille,
      seed: 3,
      weekStart: '2026-11-02',
    };
    const plan = generatePlan(args);
    const repas = plan.meals.filter((x) => x.recipeId);
    const s = mesure((i) => swapMeal({ ...args, plan, mealKey: repas[i % repas.length].key }), 30);
    const c = mesure(() => buildShoppingList({ plan, ingredients, recipes: catalog }), 20);
    const b = mesure(
      () => proposeBatch({ recipes: catalog, ingredients, profile: PROFILS.defaut, count: 5 }),
      10
    );
    console.log(`échange (catalogue) : ${f(s)}\ncourses : ${f(c)}\ncuisine en lot : ${f(b)}`);
    expect(s.p95).toBeLessThan(100 * MARGE);
    expect(c.max).toBeLessThan(100 * MARGE);
    expect(b.p95).toBeLessThan(60 * MARGE);
  });

  test('recherche fluide à chaque frappe : index de titres, requetes, frigo', () => {
    resetSearchIndex();
    const a = performance.now();
    buildTitleIndex('fr');
    const index = performance.now() - a;
    const t = getTexts('fr');
    const mots = ['p', 'po', 'pou', 'poulet', 'poulet riz', 'chevre', 'lentilles corail', 'zzz'];
    const base = {
      catalog,
      lang: 'fr',
      ingredientNameOf: (k) => t.ingredientName(k),
      titleOf: (r) => t.recipeTitle(r.id),
    };
    searchCatalog({ ...base, query: 'p', limit: 30 }); // premier appel : index inverse des ingredients
    const m = mesure(
      (i) => searchCatalog({ ...base, query: mots[i % mots.length], limit: 30 }),
      80
    );
    const unLettre = mesure(() => searchCatalog({ ...base, query: 'p', limit: 30 }), 30);
    const fr = mesure(
      () =>
        pantryCatalog({
          catalog,
          ingredients,
          have: ['oeuf', 'tomate', 'riz', 'oignon'],
          limit: 30,
        }),
      20
    );
    console.log(
      `index ${index.toFixed(1)} ms ; recherche : ${f(m)} ; lettre p : ${f(unLettre)} ; frigo : ${f(fr)}`
    );
    expect(index).toBeLessThan(120 * MARGE);
    expect(unLettre.max).toBeLessThan(30 * MARGE);
    expect(m.max).toBeLessThan(30 * MARGE);
    expect(fr.max).toBeLessThan(50 * MARGE);
  });
});
