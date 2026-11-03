// « Changer » un repas : les idées proposées suivent les règles de la génération pour ce créneau (temps rapide en
// semaine, nombre de repas plaisir, base féculente au plafond ou la veille ou le lendemain) et ont des bases
// différentes entre elles.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getRecipes, getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { generatePlan, slotIdeas, eligibleRecipes } from '../lib/menus/planner';
import { mealTraits, isTreat } from '../lib/menus/variety';
import { isFried } from '../lib/menus/healthy';
import { createRng } from '../lib/menus/util';

const PROFIL = { adults: 2, children: 0, prefs: { quick: 30, treats: 1 } };

beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

const plaisir = (r) => isTreat(r, isFried(r));

// Semaine de l'essai réel : pâtes lundi soir et mercredi midi, un repas plaisir vendredi soir ; on change mardi midi.
function semaine(recipes, ings) {
  const { mains } = eligibleRecipes({ recipes: getRecipes(), ingredients: ings, profile: PROFIL });
  const pates = mains.filter((r) => mealTraits(r).base === 'pates' && !plaisir(r));
  const treat = mains.find((r) => plaisir(r));
  expect(pates.length).toBeGreaterThanOrEqual(2);
  expect(treat).toBeTruthy();
  const plan = generatePlan({ recipes, ingredients: ings, profile: PROFIL, seed: 3 });
  const pose = { '0-soir': pates[0].id, '2-midi': pates[1].id, '4-soir': treat.id };
  plan.meals = plan.meals.map((m) =>
    pose[m.key] ? { ...m, recipeId: pose[m.key], free: false, leftoverOf: null } : m
  );
  // aucun autre plat de pâtes ni plaisir dans la semaine, hors ceux posés
  plan.meals = plan.meals.map((m) => {
    if (pose[m.key] || m.key === '1-midi' || !m.recipeId) return m;
    const r = getRecipes().find((x) => x.id === m.recipeId) || null;
    return r && (mealTraits(r).base === 'pates' || plaisir(r))
      ? { ...m, recipeId: null, free: true, leftoverOf: null }
      : m;
  });
  return plan;
}

describe.each([
  ['recettes écrites à la main', () => getRecipes()],
  ['catalogue complet', () => getCatalog()],
])('Changer mardi midi (%s)', (_nom, source) => {
  test('3 idées qui respectent la semaine, bases différentes', () => {
    const recipes = source();
    const ings = getIngredients();
    const plan = semaine(recipes, ings);
    const auMenu = new Set(plan.meals.map((m) => m.recipeId).filter(Boolean));
    for (let g = 1; g <= 5; g++) {
      const ideas = slotIdeas({
        plan,
        mealKey: '1-midi',
        recipes,
        ingredients: ings,
        profile: PROFIL,
        n: 3,
        rng: createRng(g),
      });
      expect(ideas).toHaveLength(3);
      const bases = new Set();
      for (const r of ideas) {
        expect(auMenu.has(r.id)).toBe(false);
        expect(mealTraits(r).base).not.toBe('pates'); // pâtes la veille et le lendemain
        expect(Number(r.timeMin) || 30).toBeLessThanOrEqual(30); // rapide 30 min en semaine
        expect(plaisir(r)).toBe(false); // un seul repas plaisir voulu, déjà placé
        bases.add(mealTraits(r).base || `id:${r.id}`);
      }
      expect(bases.size).toBe(3);
    }
  });
});

test('repas inconnu : aucune idée, jamais d exception', () => {
  expect(
    slotIdeas({ plan: { meals: [] }, mealKey: 'x', recipes: getRecipes(), ingredients: {} })
  ).toEqual([]);
});
