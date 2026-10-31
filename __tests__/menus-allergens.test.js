import { cleanMyRecipe } from '../lib/menus/myRecipes';
import { findAllergens, recipeWarnings, restrictionsOf, ALLERGEN_WORDS } from '../lib/menus/allergens';

const rec = (ingredients, over = {}) =>
  cleanMyRecipe({ id: 'my-1', title: 'Plat', ingredients: ingredients.map((name) => ({ name, unit: 'u' })), steps: [], ...over });
const texts = { ingredientName: (k) => ({ tomate: 'Tomate' }[k] || k) };

describe('mots', () => {
  test.each([
    ['gluten', 'Farine de blé'],
    ['gluten', 'wheat flour'],
    ['gluten', 'Weizenmehl'],
    ['gluten', 'пшеничная мука'],
    ['gluten', '小麦粉'],
    ['lait', 'Crème fraîche'],
    ['lait', 'fresh butter'],
    ['lait', 'Schlagsahne'],
    ['lait', 'حليب'],
    ['oeuf', '2 œufs'],
    ['oeuf', 'eggs'],
    ['oeuf', 'ไข่ไก่'],
    ['poisson', 'filets de saumon'],
    ['poisson', 'canned tuna'],
    ['crustaces', 'fruits de mer'],
    ['crustaces', 'prawns'],
    ['soja', 'sauce soja'],
    ['soja', 'soy sauce'],
    ['sesame', 'graines de sésame'],
    ['sesame', 'tahini'],
    ['fruits-a-coque', 'noisettes'],
    ['fruits-a-coque', 'walnuts'],
    ['fruits-a-coque', 'peanut butter'],
    ['miel', 'Miel'],
    ['miel', 'honey'],
    ['porc', 'lardons'],
    ['porc', 'bacon'],
    ['viande', 'cuisses de poulet'],
  ])('%s : %s', (a, txt) => {
    expect(findAllergens(txt, [a])).toEqual([a]);
  });
  test('faux positifs évidents évités', () => {
    expect(findAllergens('tomate, courgette, poivron', ['gluten', 'lait', 'oeuf', 'poisson'])).toEqual([]);
    expect(findAllergens('', ['gluten'])).toEqual([]);
    expect(findAllergens(null, ['gluten'])).toEqual([]);
    expect(findAllergens('farine', ['inconnu'])).toEqual([]);
  });
  test('chaque allergène du profil a sa liste', () => {
    for (const a of ['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'soja', 'sesame', 'fruits-a-coque', 'miel'])
      expect(ALLERGEN_WORDS[a].words.size).toBeGreaterThan(0);
  });
});

describe('profil', () => {
  test('régimes traduits en interdits', () => {
    expect(restrictionsOf({ diets: ['vegan'] }).allergens).toEqual(expect.arrayContaining(['lait', 'oeuf', 'miel', 'viande']));
    expect(restrictionsOf({ diets: ['sans-porc'] }).allergens).toEqual(['porc']);
    expect(restrictionsOf({}).any).toBe(false);
  });
});

describe('avertissement', () => {
  test('profil sans restriction ou recette du catalogue : rien', () => {
    expect(recipeWarnings({ recipe: rec(['Farine']), profile: {} })).toBeNull();
    expect(recipeWarnings({ recipe: { id: 'a' }, profile: { excludedIngredients: ['gluten'] } })).toBeNull();
    expect(recipeWarnings()).toBeNull();
  });
  test('trouvé dans un nom, le titre ou une étape', () => {
    const p = { excludedIngredients: ['gluten'] };
    expect(recipeWarnings({ recipe: rec(['Farine']), profile: p }).allergens).toEqual(['gluten']);
    expect(recipeWarnings({ recipe: rec(['Tomate'], { title: 'Tarte au pain' }), profile: p }).found).toBe(true);
    expect(recipeWarnings({ recipe: rec(['Tomate'], { steps: ['Ajoutez la chapelure'] }), profile: p }).found).toBe(true);
  });
  test('rien de repéré : found false, la recette reste non vérifiée', () => {
    expect(recipeWarnings({ recipe: rec(['Tomate']), profile: { diets: ['vegan'] } })).toEqual({ allergens: [], ingredients: [], found: false });
  });
  test('allergène porté par la fiche de l ingrédient connu', () => {
    const r = cleanMyRecipe({ id: 'my-2', title: 'x', ingredients: [{ key: 'pate-x', name: 'Mélange', unit: 'u' }] });
    const w = recipeWarnings({ recipe: r, profile: { excludedIngredients: ['soja'] }, ingredients: { 'pate-x': { allergens: ['soja'] } } });
    expect(w.allergens).toEqual(['soja']);
  });
  test('ingrédient exclu par le profil', () => {
    const w = recipeWarnings({ recipe: rec(['Tomate']), profile: { excludedIngredients: ['tomate'] }, texts });
    expect(w.found).toBe(true);
    expect(w.ingredients).toEqual(['Tomate']);
  });
  test('textes illisibles : pas de plantage', () => {
    const w = recipeWarnings({ recipe: rec(['x']), profile: { excludedIngredients: ['y'] }, texts: { ingredientName: () => { throw new Error('x'); } } });
    expect(w.found).toBe(false);
  });
});

describe('relecture adverse', () => {
  test.each([
    ['crustaces', 'moules de bouchot'],
    ['crustaces', 'calamars'],
    ['crustaces', 'squid rings'],
    ['poisson', 'nuoc mam'],
    ['porc', 'feuilles de gélatine'],
  ])('%s dans %s', (a, txt) => {
    expect(findAllergens(txt, [a])).toContain(a);
  });

  test('la semoule et un oeuf à la coque ne sont pas des fruits de mer', () => {
    expect(findAllergens('semoule fine', ['crustaces'])).toEqual([]);
    expect(findAllergens('oeuf à la coque', ['crustaces'])).toEqual([]);
  });

  test('une recette personnelle aux moules alerte un profil végétarien', () => {
    const w = recipeWarnings({ recipe: rec(['moules']), profile: { diets: ['vegetarien'] }, ingredients: {}, texts });
    expect(JSON.stringify(w)).toContain('crustaces');
  });
});
