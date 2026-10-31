// Chargeur paresseux : données absentes, repli sur le français, mémoïsation.
jest.mock(
  '../data/menus/recipes.json',
  () => [
    { id: 'a-b', ingredients: [{ key: 'x', qty: 1, unit: 'g' }] },
    { id: 'sans-ingredients' },
    null,
  ],
  { virtual: true }
);
jest.mock('../data/menus/ingredients.json', () => ({ x: { aisle: 'epicerie' } }), {
  virtual: true,
});
jest.mock(
  '../data/menus/i18n/fr.json',
  () => ({ recipes: { 'a-b': { title: 'Titre FR', steps: ['un'] } }, ingredients: { x: 'Iks' } }),
  { virtual: true }
);
jest.mock(
  '../data/menus/i18n/en.json',
  () => ({ recipes: { 'a-b': { title: 'Title EN' } }, ingredients: {} }),
  { virtual: true }
);

import {
  getRecipes,
  getRecipe,
  getIngredients,
  getTexts,
  normalizeLang,
  resetMenusCache,
} from '../lib/menus/recipes';

beforeEach(() => resetMenusCache());

test('recettes invalides écartées, mémoïsées', () => {
  const r = getRecipes();
  expect(r.map((x) => x.id)).toEqual(['a-b']);
  expect(getRecipes()).toBe(r);
  expect(getRecipe('a-b')).toBe(r[0]);
  expect(getRecipe('zzz')).toBeNull();
  expect(getIngredients().x.aisle).toBe('epicerie');
});
test('langue : repli champ par champ sur le français', () => {
  const en = getTexts('en-GB');
  expect(en.recipeTitle('a-b')).toBe('Title EN');
  expect(en.recipeSteps('a-b')).toEqual(['un']);
  expect(en.ingredientName('x')).toBe('Iks');
  expect(en.recipeTitle('autre-plat')).toBe('autre plat');
});
test('langue sans fichier : français', () => {
  const de = getTexts('de');
  expect(de.recipeTitle('a-b')).toBe('Titre FR');
  expect(getTexts('klingon').lang).toBe('fr');
});
test('codes de langue', () => {
  expect(normalizeLang('zh-Hans')).toBe('zh');
  expect(normalizeLang('JP')).toBe('ja');
  expect(normalizeLang(null)).toBe('fr');
});
