// L'index réunit toute l'API sans conflit de noms.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
const api = require('../lib/menus');

test('API exportée', () => {
  for (const n of [
    'generatePlan',
    'swapMeal',
    'lockMeal',
    'setFree',
    'buildShoppingList',
    'toListItems',
    'dayNutrition',
    'formatQty',
    'searchRecipes',
    'recipesByPantry',
    'loadPlan',
    'MENUS_KEYS',
    'addToList',
    'getRecipes',
    'getTexts',
    'seasonOf',
    'personsFor',
  ]) {
    expect(api[n]).toBeDefined();
  }
});
