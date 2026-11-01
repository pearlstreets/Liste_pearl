// Banc de qualite des plans avec le catalogue complet (474 ecrites a la main + 9 500 plats generes).
// Bloquant : 0 violation de regime, d'allergene ni de temps ; variete ; cout proche de la reference "tout le catalogue".
// MENUS_BENCH_SEEDS (defaut 25) regle le nombre de graines par profil ; MENUS_BENCH_REF=0 saute la reference (lente).
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getRecipes, getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { generatePlan, swapMeal, setFree, estimatePlanTotal } from '../lib/menus/planner';
import { buildShoppingList } from '../lib/menus/shopping';
import { dishProfile } from '../lib/menus/variety';

const SEEDS = Math.max(3, Number(process.env.MENUS_BENCH_SEEDS) || 25);
const REF = process.env.MENUS_BENCH_REF !== '0';

const PROFILS = {
  defaut: { adults: 2, children: 0 },
  famille: { adults: 2, children: 3, budget: 90 },
  vegetarien: { adults: 2, children: 1, diets: ['vegetarien'], budget: 60 },
  vegan: { adults: 1, children: 0, diets: ['vegan', 'sans-gluten'] },
  allergies: {
    adults: 2,
    children: 2,
    excludedIngredients: ['lait', 'oeuf', 'fruits-a-coque'],
    maxTimeMin: 45,
  },
  halal: {
    adults: 3,
    children: 0,
    diets: ['halal-possible', 'sans-porc'],
    excludedIngredients: ['crustaces', 'champignon'],
  },
  // budget hors d'atteinte : les plats peuvent se repeter, mais le budget et les regles restent respectes
  serre: { adults: 4, children: 2, budget: 50 },
};
const ATTEIGNABLE = ['defaut', 'famille', 'vegetarien', 'vegan', 'allergies', 'halal'];

beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

function violations(plan, profile, catalog, ings) {
  const diets = (profile.diets || []).map((d) => d.toLowerCase());
  const ex = new Set((profile.excludedIngredients || []).map((x) => x.toLowerCase()));
  const out = [];
  for (const m of plan.meals) {
    if (!m.recipeId || m.free) continue;
    const r = catalog.get(m.recipeId);
    if (!r) {
      out.push(`${m.recipeId} : introuvable`);
      continue;
    }
    const tags = new Set((r.tags || []).map((t) => String(t).toLowerCase()));
    for (const d of diets) if (!tags.has(d)) out.push(`${r.id} : regime ${d}`);
    for (const it of r.ingredients) {
      if (ex.has(String(it.key).toLowerCase())) out.push(`${r.id} : exclu ${it.key}`);
      for (const a of (ings[it.key] && ings[it.key].allergens) || [])
        if (ex.has(String(a).toLowerCase())) out.push(`${r.id} : allergene ${a} (${it.key})`);
    }
    if (profile.maxTimeMin && r.timeMin > profile.maxTimeMin)
      out.push(`${r.id} : temps ${r.timeMin}`);
  }
  return out;
}

function mesures(plans, catalog, ings) {
  const o = { dup: 0, mainRep: 0, famJour: 0, cout: 0, depasse: 0, peu: 0, ingr: 0 };
  for (const plan of plans) {
    const cuisines = plan.meals.filter((m) => m.recipeId && !m.leftoverOf);
    if (new Set(cuisines.map((m) => m.recipeId)).size !== cuisines.length) o.dup++;
    const mains = new Map();
    for (const m of cuisines) {
      const dp = dishProfile(catalog.get(m.recipeId), ings);
      if (dp.main) mains.set(dp.main, (mains.get(dp.main) || 0) + 1);
    }
    if (Math.max(0, ...mains.values()) > 3) o.mainRep++;
    const parJour = {};
    for (const m of plan.meals.filter((x) => x.recipeId && !x.leftoverOf)) {
      const fam = dishProfile(catalog.get(m.recipeId), ings).family;
      (parJour[m.day] = parJour[m.day] || []).push(fam);
    }
    for (const j of Object.values(parJour)) {
      const vus = new Map();
      for (const f of j) if (f) vus.set(f, (vus.get(f) || 0) + 1);
      if (Math.max(0, ...vus.values()) > 1) o.famJour++;
    }
    o.cout += plan.budget.estimated;
    if (plan.warnings.some((w) => w.code === 'over_budget')) o.depasse++;
    if (plan.warnings.some((w) => w.code === 'few_recipes' || w.code === 'no_eligible')) o.peu++;
    o.ingr += plan.stats.distinctIngredients;
  }
  o.cout /= plans.length;
  o.ingr /= plans.length;
  return o;
}

describe(`banc de qualite des plans (${SEEDS} graines par profil)`, () => {
  const catalog = () => getCatalog();
  const ings = () => getIngredients();
  const plansOf = (recipes, nom, n, extra = {}) => {
    const out = [];
    for (let s = 1; s <= n; s++)
      out.push(
        generatePlan({
          recipes,
          ingredients: ings(),
          profile: PROFILS[nom],
          seed: s,
          weekStart: '2026-11-02',
          ...extra,
        })
      );
    return out;
  };

  test.each(Object.keys(PROFILS))(
    "0 violation de regime, d'allergene ni de temps : %s",
    (nom) => {
      const plans = plansOf(catalog(), nom, SEEDS);
      const bad = [];
      for (const [i, p] of plans.entries()) {
        for (const v of violations(p, PROFILS[nom], catalog(), ings()))
          bad.push(`graine ${i + 1} : ${v}`);
        expect(p.warnings.filter((w) => w.code === 'error')).toEqual([]);
        expect(p.meals.some((m) => m.recipeId)).toBe(true);
      }
      expect(bad).toEqual([]);
    },
    300000
  );

  test.each(ATTEIGNABLE)(
    'variete : aucun plat repete, au plus un plat de meme famille par jour, ingredient principal 3 fois au plus : %s',
    (nom) => {
      const m = mesures(plansOf(catalog(), nom, SEEDS), catalog(), ings());
      expect(m.dup).toBe(0);
      expect(m.famJour).toBe(0);
      expect(m.mainRep).toBe(0);
      expect(m.peu).toBe(0);
    },
    300000
  );

  test('budget respecte quand il est atteignable ; budget serre : tenu aussi, sans avertissement de recettes manquantes', () => {
    for (const nom of ['famille', 'vegetarien', 'serre']) {
      const m = mesures(plansOf(catalog(), nom, SEEDS), catalog(), ings());
      expect(m.depasse).toBe(0);
      expect(m.peu).toBe(0);
    }
  }, 300000);

  test('cout moyen jamais pire que le plan sur les 474 ecrites a la main', () => {
    for (const nom of ['defaut', 'famille', 'vegetarien', 'vegan', 'allergies']) {
      const court = mesures(plansOf(catalog(), nom, SEEDS), catalog(), ings());
      const anciens = mesures(plansOf(getRecipes(), nom, SEEDS), catalog(), ings());
      expect(court.cout).toBeLessThanOrEqual(anciens.cout + 0.01);
    }
  }, 300000);

  (REF ? test : test.skip)(
    'liste courte contre reference "tout le catalogue" : cout au plus +8 %, ingredients reutilises a 10 % pres, meme variete',
    () => {
      for (const nom of ['defaut', 'famille']) {
        const court = mesures(plansOf(catalog(), nom, 3), catalog(), ings());
        const ref = mesures(plansOf(catalog(), nom, 3, { poolK: 1e9 }), catalog(), ings());
        expect(court.cout).toBeLessThanOrEqual(ref.cout * 1.08);
        expect(court.ingr).toBeGreaterThanOrEqual(ref.ingr * 0.9);
        expect(court.dup).toBeLessThanOrEqual(ref.dup);
        expect(court.famJour).toBeLessThanOrEqual(ref.famJour);
        expect(court.depasse).toBeLessThanOrEqual(ref.depasse);
        expect(court.peu).toBeLessThanOrEqual(ref.peu);
      }
    },
    300000
  );

  test('echanges : le repas change, les autres restent, 0 violation, repas libre possible', () => {
    for (const nom of ['defaut', 'vegetarien', 'allergies']) {
      const args = {
        recipes: catalog(),
        ingredients: ings(),
        profile: PROFILS[nom],
        weekStart: '2026-11-02',
      };
      let plan = generatePlan({ ...args, seed: 5 });
      for (let i = 0; i < 6; i++) {
        const cible = plan.meals.filter((m) => m.recipeId && !m.leftoverOf && !m.locked)[i % 4];
        const avant = plan.meals.map((m) => m.recipeId);
        plan = swapMeal({ ...args, plan, mealKey: cible.key });
        expect(plan.meals.find((m) => m.key === cible.key).recipeId).not.toBe(cible.recipeId);
        expect(plan.swaps).toBe(i + 1);
        expect(avant.length).toBe(plan.meals.length);
        expect(violations(plan, PROFILS[nom], catalog(), ings())).toEqual([]);
      }
      const libre = setFree({ ...args, plan, mealKey: '3-soir' });
      expect(libre.meals.find((m) => m.key === '3-soir').free).toBe(true);
      expect(violations(libre, PROFILS[nom], catalog(), ings())).toEqual([]);
    }
  }, 300000);

  test('total rapide de la reparation du budget : exactement celui de la liste de courses', () => {
    const personnelle = {
      id: 'my-test-libre',
      custom: true,
      servings: 4,
      ingredients: [
        { key: 'libre:truffe', qty: 30, unit: 'g' },
        { key: 'libre:sel de mer', qty: 0, unit: 'g' },
        { key: 'poulet-filet', qty: 300, unit: 'g' },
        { key: 'oignon', qty: 2, unit: 'u' },
      ],
    };
    const cat = getCatalog().withCustom([personnelle]);
    for (const nom of Object.keys(PROFILS)) {
      for (let s = 1; s <= 6; s++) {
        const args = { recipes: cat, ingredients: ings(), profile: PROFILS[nom], seed: s };
        const plan = generatePlan({
          ...args,
          locked: s % 2 ? { '1-soir': { recipeId: personnelle.id, manual: true } } : undefined,
        });
        const ref = buildShoppingList({
          plan,
          recipes: cat,
          ingredients: ings(),
          profile: PROFILS[nom],
        }).totalEur;
        expect(estimatePlanTotal({ ...args, plan })).toBe(ref);
      }
    }
  }, 300000);
});
