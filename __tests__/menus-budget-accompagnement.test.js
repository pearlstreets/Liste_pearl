// Budget de la semaine et accompagnements choisis (meal.sideId) : le budget estime (fastTotal : estimatePlanTotal,
// budgetStatus, plan.budget) compte l'accompagnement comme la liste de courses (memes convives, portions de la
// recette sans ajustement), en mode Personnalise (portions ajustees, convives choisis) comme en mode Simple.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { generatePlan, estimatePlanTotal, budgetStatus, setMealGuests } from '../lib/menus/planner';
import { buildShoppingList } from '../lib/menus/shopping';
import { sideCandidates, setMealSide } from '../lib/menus/sides';

beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

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

const courses = (plan, profile) =>
  buildShoppingList({
    plan,
    recipes: getCatalog(),
    ingredients: getIngredients(),
    profile,
    fitNeeds: true,
  }).totalEur;

// Plan de la semaine avec des convives choisis et un accompagnement sur trois repas (dont un reste s'il y en a).
function planAvecAccompagnements(profile, guests) {
  const cat = getCatalog();
  const ings = getIngredients();
  let plan = generatePlan({
    recipes: cat,
    ingredients: ings,
    profile,
    seed: 7,
    weekStart: '2026-11-02',
    repairMs: 0,
  });
  const cooked = plan.meals.filter((m) => m.recipeId && !m.free && !m.leftoverOf);
  plan = setMealGuests({
    plan,
    profile,
    mealKey: cooked[0].key,
    ...guests,
    recipes: cat,
    ingredients: ings,
  });
  const withLeft = plan.meals.find((m) => plan.meals.some((x) => x.leftoverOf === m.key));
  const picks = [cooked[0], cooked[1], withLeft || cooked[2]];
  for (const m of picks) {
    const side = sideCandidates(cat, ings, { ...profile, month: 11 }, { forId: m.recipeId })[0];
    expect(side).toBeTruthy();
    plan = setMealSide(plan, m.key, side.id);
    const left = plan.meals.find((x) => x.leftoverOf === m.key);
    if (left) plan = setMealSide(plan, left.key, side.id);
  }
  return plan;
}

function concordent(profile, guests) {
  const plan = planAvecAccompagnements(profile, guests);
  const sansAcc = { ...plan, meals: plan.meals.map(({ sideId, ...m }) => m) };
  const args = { plan, recipes: getCatalog(), ingredients: getIngredients(), profile };
  const total = courses(plan, profile);
  // l'accompagnement coute quelque chose : sans lui, les Courses baissent
  expect(total).toBeGreaterThan(courses(sansAcc, profile));
  expect(estimatePlanTotal(args)).toBeCloseTo(total, 2);
  expect(budgetStatus(args).estimated).toBeCloseTo(total, 2);
  expect(estimatePlanTotal({ ...args, plan: sansAcc })).toBeCloseTo(courses(sansAcc, profile), 2);
}

describe('budget et Courses concordent avec un accompagnement choisi', () => {
  test('mode Personnalise : portions ajustees aux besoins, convives choisis', () => {
    concordent({ mode: 'perso', members: [LEA, TOM], budget: 80 }, { eaters: ['lea'] });
  });
  test('mode Simple : convives choisis', () => {
    concordent(
      { mode: 'simple', members: [LEA, TOM], adults: 2, children: 1, budget: 80 },
      { heads: 5 }
    );
  });
});
