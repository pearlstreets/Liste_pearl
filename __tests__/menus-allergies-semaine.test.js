// Lot allergies et semaine : repas qui ne conviennent plus apres un changement de profil (B1), allergenes
// celeri, moutarde, lupin, sulfites (I2), variete de la semaine (I3), personnes affichees (carte et fiche).
import fs from 'fs';
import path from 'path';
import { generatePlan, replaceMeals, rejectReason, eligibleRecipes, swapMeal } from '../lib/menus/planner';
import { getRecipes, getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import {
  unsuitableMeals,
  recipeConflicts,
  restrictionSig,
  prepareElig,
} from '../lib/menus/pool';
import {
  ALLERGEN_CHOICES,
  ALLERGEN_WORDS,
  expandExclusions,
  findAllergens,
} from '../lib/menus/allergens';
import { headsFor, portionsForHeads, personsFor } from '../lib/menus/profile';

const ingredients = getIngredients();
const legacy = getRecipes();
const index = new Map(legacy.map((r) => [r.id, r]));
const WEEK = '2026-11-02';

const planFor = (profile, seed = 3) =>
  generatePlan({ recipes: legacy, ingredients, profile, seed, weekStart: WEEK });

describe('B1 : repas qui ne conviennent plus au profil', () => {
  const avant = { adults: 2, children: 0 };
  const plan = planFor(avant);
  const apres = { ...avant, excludedIngredients: ['lait', 'gluten'] };

  test('profil inchange : rien a signaler', () => {
    expect(unsuitableMeals(plan, { recipes: index, ingredients, profile: avant })).toEqual([]);
  });

  test('allergie ajoutee : les repas concernes sont detectes, eux seuls', () => {
    const bad = unsuitableMeals(plan, { recipes: index, ingredients, profile: apres });
    expect(bad.length).toBeGreaterThan(0);
    const badKeys = new Set(bad.map((b) => b.key));
    for (const m of plan.meals) {
      if (!m.recipeId) continue;
      const why = rejectReason(index.get(m.recipeId), ingredients, apres);
      const attendu = why === 'diet' || why === 'excluded';
      expect(`${m.key} ${badKeys.has(m.key)}`).toBe(`${m.key} ${attendu}`);
    }
  });

  test('regime ajoute : raison diet', () => {
    const bad = unsuitableMeals(plan, {
      recipes: index,
      ingredients,
      profile: { ...avant, diets: ['vegan'] },
    });
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.every((b) => b.reason === 'diet' || b.reason === 'excluded')).toBe(true);
  });

  test('derives : la moutarde exclue signale aussi la mayonnaise', () => {
    const r = legacy.find((x) => (x.ingredients || []).some((i) => i.key === 'mayonnaise'));
    if (!r) return;
    const p = { meals: [{ key: '0-midi', day: 0, slot: 'midi', recipeId: r.id }] };
    const bad = unsuitableMeals(p, {
      recipes: index,
      ingredients,
      profile: { excludedIngredients: ['moutarde'] },
    });
    expect(bad.map((b) => b.key)).toEqual(['0-midi']);
  });

  test('remplacement : seuls ces repas changent, et ils conviennent', () => {
    const bad = unsuitableMeals(plan, { recipes: index, ingredients, profile: apres });
    const next = replaceMeals({
      plan,
      keys: bad.map((b) => b.key),
      recipes: legacy,
      ingredients,
      profile: apres,
      seed: 7,
    });
    expect(unsuitableMeals(next, { recipes: index, ingredients, profile: apres })).toEqual([]);
    const touched = new Set(bad.map((b) => b.key));
    for (const m of plan.meals) {
      if (touched.has(m.key) || touched.has(m.leftoverOf)) continue;
      const n = next.meals.find((x) => x.key === m.key);
      expect(`${m.key} ${n.recipeId}`).toBe(`${m.key} ${m.recipeId}`);
    }
    expect(next.weekStart).toBe(plan.weekStart);
  });

  test('remplacement sans repas a remplacer : plan inchange', () => {
    expect(replaceMeals({ plan, keys: [], recipes: legacy, ingredients, profile: avant })).toBe(plan);
    expect(replaceMeals({ plan: null, keys: ['0-midi'] })).toBe(null);
  });

  test('recette personnelle confirmee pour ces restrictions : pas signalee, sauf si elles changent', () => {
    const perso = {
      id: 'mine-1',
      custom: true,
      title: 'Gratin au fromage',
      ingredients: [{ key: 'tomate', name: 'Fromage rape', qty: 100, unit: 'g' }],
      steps: [],
    };
    const recipes = new Map([...index, [perso.id, perso]]);
    const p1 = { excludedIngredients: ['lait'] };
    const meal = { key: '0-midi', day: 0, slot: 'midi', recipeId: perso.id, manual: true, locked: true };
    const ok = { meals: [{ ...meal, okFor: restrictionSig(p1) }] };
    expect(unsuitableMeals(ok, { recipes, ingredients, profile: p1 })).toEqual([]);
    const p2 = { excludedIngredients: ['lait', 'oeuf'] };
    expect(unsuitableMeals(ok, { recipes, ingredients, profile: p2 }).map((b) => b.reason)).toEqual([
      'custom',
    ]);
    // sans accord enregistre (ancien plan) : signale
    expect(unsuitableMeals({ meals: [meal] }, { recipes, ingredients, profile: p1 })).toHaveLength(1);
  });

  test('echange a la main : okFor garde dans le plan', () => {
    const perso = {
      id: 'mine-2',
      custom: true,
      title: 'Salade',
      ingredients: [{ key: 'tomate', name: 'Tomate', qty: 100, unit: 'g' }],
      steps: [],
    };
    const recipes = [...legacy, perso];
    const p1 = { adults: 2, excludedIngredients: ['lait'] };
    const base = generatePlan({ recipes, ingredients, profile: p1, seed: 1, weekStart: WEEK });
    const key = base.meals.find((m) => m.recipeId && !m.leftoverOf).key;
    const next = swapMeal({
      plan: base,
      mealKey: key,
      recipeId: perso.id,
      manual: true,
      okFor: restrictionSig(p1),
      recipes,
      ingredients,
      profile: p1,
    });
    const m = next.meals.find((x) => x.key === key);
    expect(m.manual).toBe(true);
    expect(m.okFor).toBe(restrictionSig(p1));
    // un echange suivant ne perd pas l'accord
    const other = next.meals.find((x) => x.recipeId && !x.leftoverOf && x.key !== key).key;
    const next2 = swapMeal({ plan: next, mealKey: other, recipes, ingredients, profile: p1, seed: 3 });
    expect(next2.meals.find((x) => x.key === key).okFor).toBe(restrictionSig(p1));
  });

  test('detail pour la fiche : allergenes, regimes et ingredients ecartes', () => {
    const r = legacy.find((x) => rejectReason(x, ingredients, { excludedIngredients: ['lait'] }));
    const c = recipeConflicts(r, ingredients, prepareElig({ excludedIngredients: ['lait'] }));
    expect(c.found).toBe(true);
    expect(c.allergens.length + c.ingredients.length).toBeGreaterThan(0);
    const ok = legacy.find((x) => !rejectReason(x, ingredients, { diets: ['vegan'] }));
    expect(recipeConflicts(ok, ingredients, { diets: ['vegan'] })).toBeNull();
    const viande = legacy.find((x) => rejectReason(x, ingredients, { diets: ['vegetarien'] }) === 'diet');
    expect(recipeConflicts(viande, ingredients, { diets: ['vegetarien'] }).diets).toEqual(['vegetarien']);
    const tomate = legacy.find((x) => (x.ingredients || []).some((i) => i.key === 'tomate'));
    expect(recipeConflicts(tomate, ingredients, { excludedIngredients: ['tomate'] }).ingredients).toContain(
      'tomate'
    );
    expect(recipeConflicts(null, ingredients, {})).toBeNull();
    expect(recipeConflicts({ id: 'x', custom: true }, ingredients, { diets: ['vegan'] })).toBeNull();
  });
});

describe('I2 : celeri, moutarde, lupin, sulfites', () => {
  const NOUVEAUX = ['celeri', 'moutarde', 'lupin', 'sulfites'];

  test('proposes au profil et reconnus dans les textes', () => {
    for (const a of NOUVEAUX) {
      expect(ALLERGEN_CHOICES).toContain(a);
      expect(ALLERGEN_WORDS[a]).toBeDefined();
    }
    expect(findAllergens('Ajoutez une cuillere de moutarde de Dijon', ['moutarde'])).toEqual(['moutarde']);
    expect(findAllergens('Senfkörner', ['moutarde'])).toEqual(['moutarde']);
    expect(findAllergens('Un verre de vin blanc', ['sulfites'])).toEqual(['sulfites']);
    expect(findAllergens('Quelques raisins secs', ['sulfites'])).toEqual(['sulfites']);
    expect(findAllergens('Farine de lupin', ['lupin'])).toEqual(['lupin']);
    expect(findAllergens('Céleri-rave râpé', ['celeri'])).toEqual(['celeri']);
    expect(findAllergens('Tomates et basilic', NOUVEAUX)).toEqual([]);
  });

  test('table des derives', () => {
    const k = (x) => expandExclusions([x]).keys;
    expect([...k('celeri')]).toEqual(expect.arrayContaining(['celeri-branche', 'celeri-rave', 'bouillon']));
    expect([...k('moutarde')]).toEqual(expect.arrayContaining(['moutarde', 'mayonnaise', 'sauce-barbecue']));
    expect([...k('lupin')]).toEqual(expect.arrayContaining(['pain-burger', 'pain-mie']));
    expect([...k('sulfites')]).toEqual(
      expect.arrayContaining(['vin-blanc', 'vin-rouge', 'vinaigre', 'biere', 'cidre', 'raisins-secs'])
    );
    for (const a of NOUVEAUX) for (const key of k(a)) if (key !== a) expect(ingredients[key]).toBeDefined();
  });

  test('aucune recette admise ne contient un derive exclu', () => {
    for (const a of NOUVEAUX) {
      const keys = expandExclusions([a]).keys;
      const { all } = eligibleRecipes({ recipes: legacy, ingredients, profile: { excludedIngredients: [a] } });
      for (const r of all)
        for (const i of r.ingredients || []) expect(`${a} ${r.id} ${keys.has(i.key)}`).toBe(`${a} ${r.id} false`);
    }
  });

  test('libelles dans les 13 langues', () => {
    const dir = path.join(__dirname, '..', 'locales');
    const langues = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(langues).toHaveLength(13);
    for (const f of langues) {
      const al = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).menus.allergens;
      for (const a of ALLERGEN_CHOICES) expect(`${f} ${a} ${typeof al[a]}`).toBe(`${f} ${a} string`);
    }
    const lire = (l) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')).menus.allergens;
    expect(lire('fr').crustaces).toBe('Crustacés et mollusques');
    expect(lire('fr')['fruits-a-coque']).toBe('Fruits à coque et arachides');
    expect(lire('ru').crustaces).toBe('Ракообразные и моллюски');
  });
});

describe('I3 : variete de la semaine', () => {
  let catalog;
  beforeAll(() => {
    resetMenusCache();
    catalog = getCatalog();
  });
  afterAll(() => resetMenusCache());

  const verifier = (plan, nom) => {
    const parJour = new Map();
    const fois = new Map();
    for (const m of plan.meals) {
      if (!m.recipeId || m.free) continue;
      fois.set(m.recipeId, (fois.get(m.recipeId) || 0) + 1);
      if (!parJour.has(m.day)) parJour.set(m.day, []);
      parJour.get(m.day).push(m);
    }
    for (const [d, ms] of parJour) {
      const ids = ms.filter((m) => !m.leftoverOf).map((m) => m.recipeId);
      const tous = ms.map((m) => m.recipeId);
      expect(`${nom} jour ${d} ${new Set(tous).size}`).toBe(`${nom} jour ${d} ${tous.length}`);
      expect(new Set(ids).size).toBe(ids.length);
    }
    return Math.max(0, ...fois.values());
  };

  test('jamais le meme plat deux fois le meme jour (budgets serres et sans budget)', () => {
    const profils = [
      { adults: 2, children: 2, budget: 20 },
      { adults: 4, children: 0, diets: ['vegan', 'sans-gluten'], budget: 60 },
      { adults: 2, children: 2, diets: ['vegan', 'sans-gluten'], budget: 60 },
      { adults: 2, children: 0 },
    ];
    for (const [i, profile] of profils.entries())
      for (const seed of [1, 2])
        verifier(
          generatePlan({ recipes: catalog, ingredients, profile, seed, weekStart: WEEK }),
          `profil ${i} graine ${seed}`
        );
  });

  test('budget presque tenu : petit depassement plutot que de repeter un plat plus de 2 fois', () => {
    const profile = { adults: 4, children: 0, diets: ['vegan', 'sans-gluten'], budget: 60 };
    for (const seed of [1, 2, 3]) {
      // repairMs 0 : recherche complete, sans echeance (resultat independant de la vitesse de la machine)
      const plan = generatePlan({ recipes: catalog, ingredients, profile, seed, weekStart: WEEK, repairMs: 0 });
      expect(verifier(plan, `graine ${seed}`)).toBeLessThanOrEqual(2);
      expect(plan.budget.estimated).toBeLessThanOrEqual(60 + Math.max(2, 60 * 0.05));
    }
  });

  test('budget atteignable sans repetition : tenu', () => {
    const profile = { adults: 2, children: 3, budget: 90 };
    const plan = generatePlan({ recipes: catalog, ingredients, profile, seed: 5, weekStart: WEEK });
    expect(plan.budget.within).toBe(true);
    expect(verifier(plan, 'famille')).toBeLessThanOrEqual(2);
  });
});

describe('personnes : carte et fiche disent la meme chose', () => {
  const foyer = { adults: 2, children: 2 };
  test('tetes affichees, portions enfants gardees', () => {
    expect(headsFor(foyer, 0, 'soir')).toEqual({ heads: 4, adults: 2, children: 2 });
    expect(portionsForHeads(foyer, 0, 'soir', 4)).toBe(personsFor(foyer, 0, 'soir'));
    expect(portionsForHeads(foyer, 0, 'soir', 4)).toBe(3.2);
    expect(portionsForHeads(foyer, 0, 'soir', 5)).toBe(4.2);
    expect(portionsForHeads(foyer, 0, 'soir', 3)).toBe(2.6);
    expect(portionsForHeads(foyer, 0, 'soir', 1)).toBe(1);
    expect(headsFor(foyer, null, null).heads).toBe(4);
  });
  test('cantine : enfants absents le midi en semaine', () => {
    const p = { ...foyer, kidsCantine: true };
    expect(headsFor(p, 1, 'midi')).toEqual({ heads: 2, adults: 2, children: 0 });
    expect(portionsForHeads(p, 1, 'midi', 2)).toBe(personsFor(p, 1, 'midi'));
    expect(headsFor({ adults: 0, children: 2 }, 0, 'soir').heads).toBe(2);
    expect(portionsForHeads({ adults: 0, children: 2 }, 0, 'soir', 2)).toBe(1.2);
  });
});
