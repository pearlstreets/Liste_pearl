// Logique des menus : régimes, budget, restes, paquets, courses, fusion de liste.
import { INGREDIENTS, RECIPES } from './menus-fixtures';
import {
  generatePlan,
  swapMeal,
  lockMeal,
  setFree,
  lockedFromPlan,
  mealsByDay,
  eligibleRecipes,
} from '../lib/menus/planner';
import { buildShoppingList, toListItems, planFingerprint } from '../lib/menus/shopping';
import { normalizeProfile, personsFor } from '../lib/menus/profile';
import { dayNutrition } from '../lib/menus/nutrition';
import { scaleQty, formatQty, formatQtyText } from '../lib/menus/scaling';
import { searchRecipes, recipesByPantry, inSeason } from '../lib/menus/search';
import { estimateRecipeCost, formatEur } from '../lib/menus/pricing';
import { createRng, seasonOf } from '../lib/menus/util';

const base = (over = {}) => ({
  recipes: RECIPES,
  ingredients: INGREDIENTS,
  profile: { adults: 2, children: 0, ...over },
  seed: 7,
});
const ingredientsOf = (plan, id) => RECIPES.find((r) => r.id === id).ingredients.map((i) => i.key);

describe('profil', () => {
  test('valeurs par défaut et assainissement', () => {
    const p = normalizeProfile({ adults: 'x', budget: -5, diets: 'oups', slots: null });
    expect(p.adults).toBe(2);
    expect(p.budget).toBeNull();
    expect(p.diets).toEqual([]);
    expect(Object.keys(p.slots)).toHaveLength(14);
    expect(normalizeProfile(null).adults).toBe(2);
  });
  test('enfants 0,6 et cantine', () => {
    expect(personsFor({ adults: 2, children: 2 }, 1, 'soir')).toBeCloseTo(3.2);
    expect(personsFor({ adults: 2, children: 2, kidsCantine: true }, 1, 'midi')).toBe(2);
    expect(personsFor({ adults: 2, children: 2, kidsCantine: true }, 5, 'midi')).toBeCloseTo(3.2);
  });
});

describe('planificateur', () => {
  test('déterministe à graine égale, différent sinon', () => {
    const a = generatePlan(base());
    const b = generatePlan(base());
    expect(a).toEqual(b);
    const c = generatePlan({ ...base(), seed: 99 });
    expect(c.meals.map((m) => m.recipeId)).not.toEqual(a.meals.map((m) => m.recipeId));
  });
  test('14 repas par défaut, seuls les créneaux actifs', () => {
    expect(generatePlan(base()).meals).toHaveLength(14);
    const p = generatePlan(base({ slots: { '0-midi': true, '3-soir': true } }));
    expect(p.meals.map((m) => m.key)).toEqual(['0-midi', '3-soir']);
  });
  test('régimes strictement respectés', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = generatePlan({ ...base({ diets: ['vegan'] }), seed });
      for (const m of p.meals.filter((x) => x.recipeId)) {
        expect(RECIPES.find((r) => r.id === m.recipeId).tags).toContain('vegan');
      }
    }
  });
  test('exclusions d ingrédients et allergènes, même optionnels', () => {
    const p = generatePlan(base({ excludedIngredients: ['poulet', 'lactose', 'fruits-a-coque'] }));
    for (const m of p.meals.filter((x) => x.recipeId)) {
      const keys = ingredientsOf(p, m.recipeId);
      expect(keys).not.toContain('poulet');
      expect(keys).not.toContain('fromage');
      expect(keys).not.toContain('noix');
    }
    const el = eligibleRecipes(base({ excludedIngredients: ['gluten'] }));
    expect(el.all.find((r) => r.id === 'boeuf-pates')).toBeUndefined();
  });
  test('temps maximum respecté', () => {
    const p = generatePlan(base({ maxTimeMin: 25 }));
    for (const m of p.meals.filter((x) => x.recipeId)) {
      expect(RECIPES.find((r) => r.id === m.recipeId).timeMin).toBeLessThanOrEqual(25);
    }
  });
  test('seulement des plats (pas de dessert) dans les repas', () => {
    const p = generatePlan(base());
    expect(p.meals.some((m) => m.recipeId === 'tarte-dessert')).toBe(false);
  });
  test('variété : pas la même recette partout quand le catalogue le permet', () => {
    const p = generatePlan(base());
    const cooks = p.meals.filter((m) => m.recipeId && !m.leftoverOf).map((m) => m.recipeId);
    const maxRepeat = Math.max(...cooks.map((id) => cooks.filter((x) => x === id).length));
    expect(maxRepeat).toBeLessThanOrEqual(2);
  });
  test('catalogue vide, absent ou invalide : jamais d exception', () => {
    for (const recipes of [[], null, undefined, 'x', [null, 5, {}]]) {
      const p = generatePlan({ recipes, ingredients: null, profile: null, seed: 1 });
      expect(p.meals.every((m) => m.free && !m.recipeId)).toBe(true);
      expect(p.warnings.some((w) => w.code === 'no_recipes' || w.code === 'no_eligible')).toBe(
        true
      );
    }
    expect(() => generatePlan()).not.toThrow();
    expect(() => generatePlan(null)).not.toThrow();
  });
  test('régime impossible : repas libres et avertissement', () => {
    const p = generatePlan(base({ diets: ['halal-possible', 'vegan', 'sans-gluten'] }));
    expect(p.meals.every((m) => m.free)).toBe(true);
    expect(p.warnings.some((w) => w.code === 'no_eligible')).toBe(true);
  });
  test('peu de recettes : répétitions signalées', () => {
    const p = generatePlan(base({ diets: ['vegan'] }));
    expect(p.warnings.some((w) => w.code === 'few_recipes')).toBe(true);
    expect(p.meals.every((m) => m.recipeId)).toBe(true);
  });
  test('plus de créneaux : plan vide signalé', () => {
    const p = generatePlan(base({ slots: {} }));
    expect(p.meals).toEqual([]);
    expect(p.warnings.some((w) => w.code === 'no_slots')).toBe(true);
  });
});

describe('restes', () => {
  const plan = generatePlan({ ...base(), seed: 3 });
  test('le midi suivant sert le reste, lié et sans nouvelle cuisson', () => {
    const lefts = plan.meals.filter((m) => m.leftoverOf);
    expect(lefts.length).toBeGreaterThan(0);
    expect(lefts.length).toBeLessThanOrEqual(3);
    for (const l of lefts) {
      const src = plan.meals.find((m) => m.key === l.leftoverOf);
      expect(src.slot).toBe('soir');
      expect(l.slot).toBe('midi');
      expect(l.day).toBe(src.day + 1);
      expect(l.recipeId).toBe(src.recipeId);
      expect(RECIPES.find((r) => r.id === src.recipeId).leftoverOk).toBe(true);
      expect(src.cookPersons).toBeCloseTo(src.persons + l.persons);
      expect(l.cookPersons).toBeUndefined();
    }
  });
  test('les restes n ajoutent pas de courses (on cuisine double une fois)', () => {
    const lefts = plan.meals.filter((m) => m.leftoverOf);
    const withDouble = buildShoppingList({
      plan,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: { adults: 2 },
    });
    const asCooked = {
      meals: plan.meals.map((m) => ({ ...m, leftoverOf: null, cookPersons: undefined })),
    };
    const naive = buildShoppingList({
      plan: asCooked,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: { adults: 2 },
    });
    expect(lefts.length).toBeGreaterThan(0);
    expect(withDouble.consumedEur).toBeLessThanOrEqual(naive.consumedEur + 0.01);
  });
  test('désactivable', () => {
    const p = generatePlan(base({ useLeftovers: false }));
    expect(p.meals.some((m) => m.leftoverOf)).toBe(false);
  });
  test('pas de restes si le midi suivant est verrouillé', () => {
    const first = generatePlan({ ...base(), seed: 3 });
    const l = first.meals.find((m) => m.leftoverOf);
    const key = l.key;
    const p = generatePlan({ ...base(), seed: 3, locked: { [key]: 'riz-courgette' } });
    expect(p.meals.find((m) => m.key === key).leftoverOf).toBeNull();
    expect(p.meals.find((m) => m.key === key).recipeId).toBe('riz-courgette');
  });
});

describe('budget', () => {
  test('signale l écart quand le budget est intenable', () => {
    const p = generatePlan(base({ budget: 5 }));
    expect(p.budget.within).toBe(false);
    expect(p.budget.gap).toBeGreaterThan(0);
    expect(p.warnings.some((w) => w.code === 'over_budget')).toBe(true);
  });
  test('un budget serré fait baisser le total, un budget large ne produit aucun avertissement', () => {
    const free = generatePlan(base());
    const tight = generatePlan(base({ budget: Math.floor(free.budget.estimated * 0.6) }));
    expect(tight.budget.estimated).toBeLessThanOrEqual(free.budget.estimated);
    const wide = generatePlan(base({ budget: 500 }));
    expect(wide.warnings.some((w) => w.code === 'over_budget')).toBe(false);
    expect(wide.budget.within).toBe(true);
  });
});

describe('paquets et courses', () => {
  const plan = generatePlan(base());
  const list = buildShoppingList({
    plan,
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    profile: { adults: 2 },
  });
  test('agrège par ingrédient, arrondit au paquet', () => {
    const keys = list.lines.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of list.lines) {
      const pk = INGREDIENTS[l.key].pack;
      expect(l.packs).toBeGreaterThanOrEqual(1);
      expect(l.packs * pk.qty).toBeGreaterThanOrEqual(l.qty - 1e-6);
      expect((l.packs - 1) * pk.qty).toBeLessThan(l.qty);
      expect(l.usedIn.length).toBeGreaterThan(0);
      expect(l.estimatedEur).toBeGreaterThan(0);
    }
  });
  test('placard exclu par défaut, inclus à la demande', () => {
    expect(list.lines.some((l) => l.key === 'sel' || l.key === 'huile')).toBe(false);
    const withPantry = buildShoppingList({
      plan,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: { adults: 2 },
      includePantry: true,
    });
    expect(
      withPantry.lines.some((l) => l.key === 'sel') ||
        !plan.meals.some((m) => m.recipeId === 'poulet-riz')
    ).toBe(true);
  });
  test('placard du profil soustrait', () => {
    const l2 = buildShoppingList({
      plan,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: { adults: 2, pantry: ['riz', 'oignon'] },
    });
    expect(l2.lines.some((l) => l.key === 'riz' || l.key === 'oignon')).toBe(false);
    expect(
      l2.skipped.some((s) => s.key === 'riz' || s.key === 'oignon') ||
        !list.lines.some((l) => l.key === 'riz')
    ).toBe(true);
  });
  test('mise à l échelle des personnes', () => {
    const single = {
      meals: [{ key: '0-soir', day: 0, slot: 'soir', recipeId: 'poulet-riz', persons: 4 }],
    };
    const l4 = buildShoppingList({
      plan: single,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: {},
    });
    expect(l4.lines.find((l) => l.key === 'poulet').qty).toBe(500);
    const double = { meals: [{ ...single.meals[0], persons: 8 }] };
    expect(
      buildShoppingList({
        plan: double,
        recipes: RECIPES,
        ingredients: INGREDIENTS,
        profile: {},
      }).lines.find((l) => l.key === 'poulet').qty
    ).toBe(1000);
    const two = { meals: [{ ...single.meals[0], persons: 2 }] };
    const l2 = buildShoppingList({
      plan: two,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: {},
    });
    expect(l2.lines.find((l) => l.key === 'poulet').qty).toBe(250);
    expect(l2.lines.find((l) => l.key === 'poulet').packs).toBe(1);
  });
  test('reste d un paquet réutilisé : deux repas, un seul paquet', () => {
    const two = {
      meals: [
        { key: '0-soir', day: 0, slot: 'soir', recipeId: 'poulet-riz', persons: 2 },
        { key: '1-soir', day: 1, slot: 'soir', recipeId: 'poulet-courgette', persons: 2 },
      ],
    };
    const l = buildShoppingList({
      plan: two,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: {},
    });
    const poulet = l.lines.find((x) => x.key === 'poulet');
    expect(poulet.qty).toBe(500);
    expect(poulet.packs).toBe(1);
    expect(l.consumedEur).toBeLessThanOrEqual(l.totalEur);
    expect(l.wasteEur).toBeGreaterThanOrEqual(0);
  });
  test('ingrédient inconnu, recette inconnue, plan absent : pas d exception', () => {
    const odd = {
      meals: [
        { key: '0-soir', day: 0, slot: 'soir', recipeId: 'poulet-riz', persons: 4 },
        { key: '1-soir', recipeId: 'fantome' },
      ],
    };
    const l = buildShoppingList({ plan: odd, recipes: RECIPES, ingredients: {}, profile: {} });
    expect(l.lines.length).toBeGreaterThan(0);
    expect(l.missingRecipes).toEqual(['fantome']);
    expect(buildShoppingList().lines).toEqual([]);
    expect(buildShoppingList({ plan: null, recipes: null }).totalEur).toBe(0);
  });
  test('empreinte stable', () => {
    expect(planFingerprint(list.lines)).toBe(list.fingerprint);
    expect(
      buildShoppingList({
        plan,
        recipes: RECIPES,
        ingredients: INGREDIENTS,
        profile: { adults: 2 },
      }).fingerprint
    ).toBe(list.fingerprint);
  });
  test('prix : estimations en euros', () => {
    const c = estimateRecipeCost(RECIPES[0], INGREDIENTS, 4);
    expect(c.total).toBeGreaterThan(0);
    expect(formatEur(12.5, 'fr')).toBe('12,50 €');
    expect(formatEur(12.5, 'en')).toBe('€12.50');
    expect(formatEur(NaN, 'fr')).toBe('0,00 €');
  });
});

describe('fusion avec une liste existante', () => {
  const lignes = [
    { key: 'riz', qty: 600, unit: 'g', packs: 1 },
    { key: 'poulet', qty: 800, unit: 'g', packs: 2 },
  ];
  const nom = (l) => ({ riz: 'Riz', poulet: 'Poulet' })[l.key];
  let n = 0;
  const idGen = () => `id${++n}`;
  test('format exact des nouveaux articles', () => {
    const r = toListItems(lignes, nom, [], { idGen });
    expect(r.items).toEqual([
      { id: 'id1', name: 'Riz', qty: 1, unit: 'u', crossed: false, selected: true },
      { id: 'id2', name: 'Poulet', qty: 2, unit: 'u', crossed: false, selected: true },
    ]);
    expect(r.added).toBe(2);
  });
  test('même nom (casse) et même unité : on additionne', () => {
    const exist = [
      { id: 'a', name: 'riz', qty: 2, unit: 'u', crossed: true, selected: false },
      { id: 'b', name: 'Riz', qty: 1, unit: 'kg', crossed: false, selected: true },
    ];
    const r = toListItems(lignes, nom, exist, { idGen });
    expect(r.items.find((i) => i.id === 'a')).toEqual({
      id: 'a',
      name: 'riz',
      qty: 3,
      unit: 'u',
      crossed: false, // ré-ajouté depuis Menus : de nouveau à acheter, pris en compte dans Produits
      selected: true,
    });
    expect(r.items.find((i) => i.id === 'b').qty).toBe(1); // autre unité : intact
    expect(r.items.filter((i) => i.name.toLowerCase() === 'riz')).toHaveLength(2);
    expect(r.merged).toBe(1);
  });
  test('deuxième appel avec la même empreinte : aucun doublon', () => {
    const first = toListItems(lignes, nom, [], { idGen });
    const second = toListItems(lignes, nom, first.items, {
      idGen,
      appliedFingerprints: [first.fingerprint],
    });
    expect(second.alreadyApplied).toBe(true);
    expect(second.items).toEqual(first.items);
  });
  test('entrées bizarres sans exception, existants non modifiés', () => {
    const exist = [{ id: 'a', name: 'Riz', qty: 1, unit: 'u' }];
    const copy = JSON.parse(JSON.stringify(exist));
    expect(() => toListItems(null, null, null)).not.toThrow();
    expect(toListItems(null, null, 'x').items).toEqual([]);
    toListItems(lignes, nom, exist, { idGen });
    expect(exist).toEqual(copy);
    expect(
      toListItems(
        lignes,
        () => {
          throw new Error('x');
        },
        [],
        { idGen }
      ).items.map((i) => i.name)
    ).toEqual(['riz', 'poulet']);
  });
});

describe('modifications du plan', () => {
  const plan = generatePlan(base());
  const args = (extra) => ({
    plan,
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    profile: { adults: 2 },
    ...extra,
  });
  test('swapMeal change seulement ce repas, en respectant les règles', () => {
    const key = plan.meals.find(
      (m) =>
        m.recipeId &&
        !m.leftoverOf &&
        m.slot === 'soir' &&
        !plan.meals.some((x) => x.leftoverOf === m.key)
    ).key;
    const before = plan.meals.find((m) => m.key === key).recipeId;
    const next = swapMeal(args({ mealKey: key }));
    expect(next.meals.find((m) => m.key === key).recipeId).not.toBe(before);
    for (const m of plan.meals.filter((x) => x.key !== key)) {
      expect(next.meals.find((x) => x.key === m.key).recipeId).toBe(m.recipeId);
    }
    const veg = swapMeal({
      ...args({ mealKey: key }),
      profile: { adults: 2, diets: ['vegan'] },
      recipeId: 'poulet-riz',
    });
    expect(veg).toBe(plan); // refusé : hors régime
  });
  test('swapMeal avec une recette choisie', () => {
    const key = plan.meals[0].key;
    const next = swapMeal(args({ mealKey: key, recipeId: 'riz-courgette' }));
    expect(next.meals.find((m) => m.key === key).recipeId).toBe('riz-courgette');
  });
  test('swapMeal sur une clé inconnue ou un plan absent : inchangé', () => {
    expect(swapMeal(args({ mealKey: '9-nuit' }))).toBe(plan);
    expect(() => swapMeal({})).not.toThrow();
    expect(() => swapMeal(null)).not.toThrow();
  });
  test('lockMeal et lockedFromPlan, puis regénération avec verrous', () => {
    const key = '2-soir';
    const locked = lockMeal(plan, key, true);
    expect(locked.meals.find((m) => m.key === key).locked).toBe(true);
    expect(plan.meals.find((m) => m.key === key).locked).toBe(false);
    const re = generatePlan({ ...base(), seed: 1234, locked: lockedFromPlan(locked) });
    expect(re.meals.find((m) => m.key === key).recipeId).toBe(
      locked.meals.find((m) => m.key === key).recipeId
    );
    expect(re.meals.find((m) => m.key === key).locked).toBe(true);
    expect(
      lockMeal({ plan: locked, mealKey: key, locked: false }).meals.find((m) => m.key === key)
        .locked
    ).toBe(false);
  });
  test('verrou hors régime ou inconnu : ignoré avec avertissement', () => {
    const p = generatePlan({
      ...base({ diets: ['vegan'] }),
      locked: { '0-soir': 'poulet-riz', '1-soir': 'inconnu' },
    });
    expect(p.meals.find((m) => m.key === '0-soir').recipeId).not.toBe('poulet-riz');
    expect(p.warnings.filter((w) => w.code === 'lock_invalid')).toHaveLength(2);
  });
  test('setFree puis retour à une recette', () => {
    const key = '3-soir';
    const f = setFree(args({ mealKey: key }));
    const m = f.meals.find((x) => x.key === key);
    expect(m.free).toBe(true);
    expect(m.recipeId).toBeNull();
    const shop = buildShoppingList({
      plan: f,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: { adults: 2 },
    });
    expect(shop.totalEur).toBeLessThanOrEqual(plan.budget.estimated + 1e-6);
    const back = setFree({ ...args({ mealKey: key }), plan: f, free: false });
    expect(back.meals.find((x) => x.key === key).free).toBe(false);
    expect(back.meals.find((x) => x.key === key).recipeId).toBeTruthy();
  });
  test('un reste dont la source change est recalculé', () => {
    const p = generatePlan({ ...base(), seed: 3 });
    const l = p.meals.find((m) => m.leftoverOf);
    const next = swapMeal({
      plan: p,
      mealKey: l.leftoverOf,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: { adults: 2 },
    });
    const nl = next.meals.find((m) => m.key === l.key);
    if (nl.leftoverOf)
      expect(nl.recipeId).toBe(next.meals.find((m) => m.key === nl.leftoverOf).recipeId);
    else expect(nl.recipeId).toBeTruthy();
  });
  test('mealsByDay', () => {
    const d = mealsByDay(plan);
    expect(d).toHaveLength(7);
    expect(d[0].midi.key).toBe('0-midi');
    expect(mealsByDay(null)).toHaveLength(7);
  });
});

describe('nutrition, échelle, recherche', () => {
  test('nutrition par jour', () => {
    const plan = generatePlan(base());
    const n = dayNutrition(plan, RECIPES);
    expect(n.days).toHaveLength(7);
    expect(n.days[0].kcal).toBe(1200);
    expect(n.avgKcal).toBe(1200);
    expect(dayNutrition(null, null).avgKcal).toBe(0);
  });
  test('échelle lisible', () => {
    expect(scaleQty(200, 4, 2)).toBe(100);
    expect(formatQty(1500, 'g')).toEqual({ amount: '1,5', unit: 'kg', value: 1.5 });
    expect(formatQty(1500, 'g', { lang: 'en' }).amount).toBe('1.5');
    expect(formatQty(990, 'g').unit).toBe('kg');
    expect(formatQty(250, 'ml')).toEqual({ amount: '250', unit: 'ml', value: 250 });
    expect(formatQty(0.5, 'u').amount).toBe('½');
    expect(formatQty(1.5, 'cs').amount).toBe('1 ½');
    expect(formatQty(0.25, 'cc').amount).toBe('¼');
    expect(formatQtyText(2, 'u')).toBe('2');
    expect(formatQtyText(1200, 'ml')).toBe('1,2 l');
    expect(formatQty(NaN, 'g').amount).toBe('0');
  });
  test('recherche sans accents ni casse', () => {
    const titles = { 'poulet-riz': 'Poulet rôti au riz', 'saumon-riz': 'Saumon et riz' };
    const titleOf = (r) => titles[r.id] || r.id;
    const out = searchRecipes(RECIPES, { query: 'POULÉT rôti', titleOf });
    expect(out.map((r) => r.id)).toEqual(['poulet-riz']);
    expect(searchRecipes(RECIPES, { query: 'courgette', limit: 3 })).toHaveLength(3);
    expect(searchRecipes(RECIPES, { query: 'zzzz' })).toEqual([]);
    expect(searchRecipes(null)).toEqual([]);
  });
  test('filtres', () => {
    const f = (filters) => searchRecipes(RECIPES, { filters }).map((r) => r.id);
    expect(f({ tags: ['vegan'] }).sort()).toEqual([
      'lentilles-tomate',
      'riz-courgette',
      'soupe-hiver',
    ]);
    expect(f({ course: 'dessert' })).toEqual(['tarte-dessert']);
    expect(f({ maxTimeMin: 15 }).sort()).toEqual(['omelette-fromage', 'salade-noix']);
    expect(f({ excludedIngredients: ['fromage'] })).not.toContain('gratin-pates');
  });
  test('saison', () => {
    expect(seasonOf(0)).toBe('hiver');
    expect(seasonOf(6)).toBe('ete');
    expect(seasonOf(13)).toBeNull();
    const soupe = RECIPES.find((r) => r.id === 'soupe-hiver');
    expect(inSeason(soupe, 0)).toBe(true);
    expect(inSeason(soupe, 6)).toBe(false);
    expect(inSeason(RECIPES[0], 6)).toBe(true);
  });
  test('ce que j ai chez moi, anti-gaspi', () => {
    const out = recipesByPantry(RECIPES, ['courgette', 'oeuf', 'fromage'], {
      ingredients: INGREDIENTS,
      toUseUp: ['courgette'],
    });
    expect(out[0].recipe.id).toBe('omelette-fromage');
    expect(out[0].missing).toEqual([]);
    expect(out[0].uses).toEqual(['courgette']);
    expect(recipesByPantry(RECIPES, [], { ingredients: INGREDIENTS })).toEqual([]);
    expect(recipesByPantry(null, null)).toEqual([]);
  });
  test('rng déterministe', () => {
    const a = createRng('x');
    const b = createRng('x');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
