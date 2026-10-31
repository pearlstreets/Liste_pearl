jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map();
  return {
    __esModule: true,
    default: {
      getItem: async (k) => (mockStore.has(k) ? mockStore.get(k) : null),
      setItem: async (k, v) => {
        mockStore.set(k, v);
      },
      removeItem: async (k) => {
        mockStore.delete(k);
      },
      multiRemove: async (ks) => ks.forEach((k) => mockStore.delete(k)),
    },
  };
});
jest.mock('../services/secureStorage', () => ({ getSecureItem: async () => null, setSecureItem: async () => {} }), { virtual: false });

import AsyncStorage from '@react-native-async-storage/async-storage';
import { INGREDIENTS, RECIPES } from './menus-fixtures';
import {
  cleanMyRecipe,
  cleanMyRecipes,
  mergeMyRecipes,
  normalizeUnit,
  parseQty,
  freeKeyOf,
  buildNameIndex,
  matchIngredientKey,
  emptyDraft,
  draftFromRecipe,
  draftFromImport,
  validateDraft,
  recipeFromDraft,
  withMyTexts,
  photosToUpload,
} from '../lib/menus/myRecipes';
import {
  MENUS_KEY,
  MENUS_KEYS,
  saveMyRecipe,
  loadMyRecipes,
  deleteMyRecipe,
  setMyRecipePhotoUrl,
} from '../lib/menus/storage';
import { SYNC_KEYS, mergeFirstLogin } from '../lib/menus/sync';
import { buildShoppingList, toListItems } from '../lib/menus/shopping';
import { estimateRecipeCost } from '../lib/menus/pricing';
import { scaleIngredients } from '../lib/menus/scaling';
import { lineTexts } from '../lib/menus/lineText';
import { generatePlan, swapMeal, rejectReason, lockedFromPlan } from '../lib/menus/planner';
import { searchRecipes } from '../lib/menus/search';
import { getTexts } from '../lib/menus/recipes';
import { freeLabel, isFreeKey } from '../lib/menus/util';

const textsFr = {
  ingredientName: (k) => ({ poulet: 'Poulet', riz: 'Riz', tomate: 'Tomate' }[k] || k),
  recipeTitle: (id) => `T ${id}`,
  recipeSteps: () => ['base'],
};
const mine = (over = {}) =>
  cleanMyRecipe({
    id: 'my-1',
    title: 'Mon plat',
    servings: 2,
    timeMin: 20,
    ingredients: [
      { key: 'libre:tofu fume', name: 'Tofu fumé', qty: 200, unit: 'g' },
      { key: 'libre:sel', name: 'Sel', qty: null, unit: 'u' },
      { key: 'riz', name: 'Riz', qty: 100, unit: 'g' },
    ],
    steps: ['Cuire'],
    updatedAt: 5,
    ...over,
  });
const plan1 = (recipes, n = 2) => ({
  meals: recipes.map((r, i) => ({ key: `${i}-midi`, day: i, slot: 'midi', recipeId: r.id, persons: n })),
});

describe('nettoyage', () => {
  test('données corrompues ignorées sans exception', () => {
    for (const bad of [null, 3, 'x', {}, { id: 'pasbon', title: 'a', ingredients: [{ name: 'b' }] }, { id: 'my-a' }, { id: 'my-a', title: 'a', ingredients: [] }])
      expect(cleanMyRecipe(bad)).toBeNull();
    expect(cleanMyRecipes('x')).toEqual([]);
    expect(cleanMyRecipes([null, 1, mine()])).toHaveLength(1);
  });
  test('base64, data:, file: et chemins temporaires refusés', () => {
    const r = mine({
      photoUrl: 'data:image/jpeg;base64,AAAA',
      photoFile: 'file:///tmp/x.jpg',
    });
    expect(r.photoUrl).toBeNull();
    expect(r.photoFile).toBeNull();
    expect(mine({ photoFile: '../../etc/x.jpg' }).photoFile).toBeNull();
    expect(mine({ photoUrl: 'http://x.fr/a.jpg' }).photoUrl).toBeNull();
    expect(mine({ photoFile: 'menus-photos/ab.jpg', photoUrl: 'https://x.fr/a.jpg' })).toMatchObject({
      photoFile: 'menus-photos/ab.jpg',
      photoUrl: 'https://x.fr/a.jpg',
    });
  });
  test('tags toujours vides, même si la donnée en invente', () => {
    expect(mine({ tags: ['vegan'] }).tags).toEqual([]);
  });
  test('quantités et unités', () => {
    expect(parseQty('1,5')).toBe(1.5);
    expect(parseQty('1/2')).toBe(0.5);
    expect(parseQty('1 1/2')).toBe(1.5);
    expect(parseQty('½')).toBe(0.5);
    expect(parseQty('un peu')).toBeNull();
    expect(parseQty(-2)).toBeNull();
    expect(parseQty(NaN)).toBeNull();
    expect(normalizeUnit('grammes')).toBe('g');
    expect(normalizeUnit('tbsp')).toBe('cs');
    expect(normalizeUnit('Cuillère à café')).toBe('cc');
    expect(normalizeUnit('L')).toBe('l');
    expect(normalizeUnit('botte')).toBe('u');
    expect(normalizeUnit(undefined)).toBe('u');
  });
  test('fusion : par id, le plus récent gagne, sans perte', () => {
    const r = mergeMyRecipes([mine({ title: 'Vieux', updatedAt: 1 })], [mine({ title: 'Neuf', updatedAt: 9 }), mine({ id: 'my-2' })]);
    expect(r.map((x) => x.title).sort()).toEqual(['Mon plat', 'Neuf']);
    expect(mergeMyRecipes(null, 'x')).toEqual([]);
  });
});

describe('sauvegarde', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(MENUS_KEY.myRecipes);
  });
  test('la clé part avec la sauvegarde du compte', () => {
    expect(SYNC_KEYS).toContain('myRecipes');
    expect(MENUS_KEYS).toContain('MENUS_MY_RECIPES');
  });
  test('première connexion : recettes des deux côtés conservées', () => {
    const r = mergeFirstLogin(
      { myRecipes: { u: 2, v: [mine({ id: 'my-a' })] } },
      { myRecipes: { u: 1, v: [mine({ id: 'my-b' })] } }
    );
    expect(r.data.myRecipes.v.map((x) => x.id).sort()).toEqual(['my-a', 'my-b']);
  });
  test('ajout, remplacement, suppression', async () => {
    await saveMyRecipe(mine());
    await saveMyRecipe(mine({ title: 'Renommé' }));
    expect((await loadMyRecipes()).map((r) => r.title)).toEqual(['Renommé']);
    await deleteMyRecipe('my-1');
    expect(await loadMyRecipes()).toEqual([]);
  });
  test('stockage corrompu : liste vide, pas de plantage', async () => {
    await AsyncStorage.setItem(MENUS_KEY.myRecipes, '{pas du json');
    expect(await loadMyRecipes()).toEqual([]);
  });
  test('adresse de photo posée seulement si la photo est restée la même', async () => {
    await saveMyRecipe(mine({ photoFile: 'menus-photos/b.jpg' }));
    await setMyRecipePhotoUrl('my-1', 'https://x.fr/old.jpg', 'menus-photos/a.jpg');
    expect((await loadMyRecipes())[0].photoUrl).toBeNull();
    await setMyRecipePhotoUrl('my-1', 'https://x.fr/ok.jpg', 'menus-photos/b.jpg');
    const l = await loadMyRecipes();
    expect(l[0].photoUrl).toBe('https://x.fr/ok.jpg');
    expect(photosToUpload(l)).toEqual([]);
  });
});

describe('brouillon', () => {
  const idx = buildNameIndex(INGREDIENTS, [textsFr]);
  test('rapprochement strict avec le catalogue', () => {
    expect(matchIngredientKey('poulet', idx)).toBe('poulet');
    expect(matchIngredientKey('Tomates', idx)).toBe('tomate');
    expect(matchIngredientKey('poule', idx)).toBeNull();
  });
  test('nom inconnu = clé libre, deux graphies = même clé', () => {
    const r = recipeFromDraft(
      {
        ...emptyDraft(),
        title: 'A',
        ingredients: [
          { name: 'Crème de Yuzu', qty: '2', unit: 'cs' },
          { name: 'Riz', qty: '100', unit: 'g' },
        ],
      },
      { nameIndex: idx, now: 7, idGen: () => 'my-x' }
    );
    expect(isFreeKey(r.ingredients[0].key)).toBe(true);
    expect(r.ingredients[0].key).toBe(freeKeyOf('creme de  yuzu'));
    expect(r.ingredients[1].key).toBe('riz');
    expect(r.updatedAt).toBe(7);
  });
  test('validation', () => {
    expect(validateDraft(emptyDraft()).errors).toEqual(['title', 'ingredients']);
    expect(recipeFromDraft(emptyDraft())).toBeNull();
    expect(validateDraft(null).ok).toBe(false);
  });
  test('édition aller-retour sans perte', () => {
    const r = mine();
    const back = recipeFromDraft(draftFromRecipe(r), { nameIndex: new Map(), now: 9 });
    expect(back.ingredients).toEqual(r.ingredients);
    expect(back.id).toBe(r.id);
  });
  test('import : formulaire pré-rempli, données folles ignorées', () => {
    const d = draftFromImport(
      {
        title: 'Tarte',
        servings: 6,
        time_min: 45,
        ingredients: [{ name: 'Farine', qty: 250, unit: 'grammes' }, { qty: 1 }, 'x', { name: 'Sel', qty: null, unit: null }],
        steps: ['Mélanger', 3, ''],
        image_url: 'data:image/png;base64,AAA',
        source_url: 'https://x.fr/tarte',
      },
      emptyDraft()
    );
    expect(d.title).toBe('Tarte');
    expect(d.servings).toBe(6);
    expect(d.ingredients).toEqual([
      { name: 'Farine', qty: '250', unit: 'g' },
      { name: 'Sel', qty: '', unit: 'u' },
    ]);
    expect(d.steps).toEqual(['Mélanger']);
    expect(d.photoUrl).toBeNull();
    expect(draftFromImport(null, emptyDraft()).title).toBe('');
  });
  test('textes : recette perso et catalogue', () => {
    const t = withMyTexts(textsFr, [mine()]);
    expect(t.recipeTitle('my-1')).toBe('Mon plat');
    expect(t.recipeTitle('r')).toBe('T r');
    expect(t.recipeSteps('my-1')).toEqual(['Cuire']);
    expect(t.ingredientName('libre:tofu fume')).toBe('Tofu fumé');
    expect(t.ingredientName('libre:tofu fume|u')).toBe('Tofu fumé');
    expect(freeLabel('libre:abc|m')).toBe('abc');
    expect(getTexts('fr').ingredientName('libre:abc|m')).toBe('abc');
  });
});

describe('portions et prix', () => {
  test('mise à l échelle, ingrédient sans quantité conservé', () => {
    const l = scaleIngredients(mine(), 4, { lang: 'fr' });
    expect(l[0].qty).toBe(400);
    expect(l[1]).toMatchObject({ amount: '', displayUnit: '' });
  });
  test('coût : aucun prix inventé, inconnus comptés', () => {
    const c = estimateRecipeCost(mine(), INGREDIENTS, 2);
    expect(c.unpriced).toBe(2);
    const seul = estimateRecipeCost(
      mine({ ingredients: [{ key: 'libre:tofu', name: 'Tofu', qty: 200, unit: 'g' }] }),
      INGREDIENTS,
      2
    );
    expect(seul.total).toBe(0);
  });
});

describe('courses', () => {
  test('ligne libre à son nom, sans prix, et total qui le dit', () => {
    const r = mine();
    const sh = buildShoppingList({ plan: plan1([r]), recipes: [r], ingredients: INGREDIENTS, profile: {} });
    const tofu = sh.lines.find((l) => l.key === 'libre:tofu fume');
    expect(tofu).toMatchObject({ free: true, priceKnown: false, estimatedEur: 0, consumedEur: 0, qty: 200 });
    expect(sh.lines.find((l) => l.key === 'libre:sel')).toMatchObject({ free: true, noQty: true, qty: 0 });
    expect(sh.unpricedCount).toBe(2);
    expect(sh.lines.find((l) => l.key === 'riz').free).toBeFalsy();
    const sansLibre = sh.lines.filter((l) => !l.free).reduce((a, l) => a + l.estimatedEur, 0);
    expect(sh.totalEur).toBeCloseTo(sansLibre, 2);
  });
  test('libres identiques regroupés entre deux recettes', () => {
    const a = mine();
    const b = mine({ id: 'my-2', ingredients: [{ key: 'libre:tofu fume', name: 'tofu  FUMÉ', qty: 100, unit: 'g' }] });
    const sh = buildShoppingList({ plan: plan1([a, b]), recipes: [a, b], ingredients: INGREDIENTS, profile: {} });
    expect(sh.lines.filter((l) => l.key.startsWith('libre:tofu'))).toHaveLength(1);
    expect(sh.lines.find((l) => l.key === 'libre:tofu fume').qty).toBe(300);
  });
  test('deux familles d unités : deux lignes', () => {
    const a = mine({ ingredients: [{ key: 'libre:x', name: 'X', qty: 100, unit: 'g' }] });
    const b = mine({ id: 'my-2', ingredients: [{ key: 'libre:x', name: 'X', qty: 2, unit: 'u' }] });
    const sh = buildShoppingList({ plan: plan1([a, b]), recipes: [a, b], ingredients: INGREDIENTS, profile: {} });
    expect(sh.lines.map((l) => l.key).sort()).toEqual(['libre:x', 'libre:x|u']);
  });
  test('un sans quantité et un avec : une ligne avec la quantité', () => {
    const a = mine({ ingredients: [{ key: 'libre:x', name: 'X', unit: 'u' }] });
    const b = mine({ id: 'my-2', ingredients: [{ key: 'libre:x', name: 'X', qty: 100, unit: 'g' }] });
    const sh = buildShoppingList({ plan: plan1([a, b]), recipes: [a, b], ingredients: INGREDIENTS, profile: {} });
    expect(sh.lines).toHaveLength(1);
    expect(sh.lines[0]).toMatchObject({ qty: 100, unit: 'g', noQty: false });
  });
  test('catalogue connu sans quantité : ligne, sans prix', () => {
    const a = mine({ ingredients: [{ key: 'riz', name: 'Riz', unit: 'u' }] });
    const sh = buildShoppingList({ plan: plan1([a]), recipes: [a], ingredients: INGREDIENTS, profile: {} });
    expect(sh.lines[0]).toMatchObject({ key: 'riz', free: true, noQty: true, estimatedEur: 0 });
  });
  test('recette du plan supprimée : signalée, pas de plantage', () => {
    const sh = buildShoppingList({ plan: plan1([{ id: 'my-disparue' }]), recipes: [], ingredients: INGREDIENTS, profile: {} });
    expect(sh.missingRecipes).toContain('my-disparue');
  });
  test('texte de ligne et envoi vers une liste', () => {
    const t = (k) => k;
    expect(lineTexts({ key: 'libre:sel', free: true, noQty: true, qty: 0, unit: 'u' }, t)).toEqual({ qtyText: '', packText: '' });
    expect(lineTexts({ key: 'libre:x', free: true, qty: 200, unit: 'g' }, t, { lang: 'fr' }).packText).toBe('');
    const r = toListItems(
      [{ key: 'libre:sel', free: true, noQty: true, qty: 0, packs: 1 }],
      () => 'Sel',
      [],
      { idGen: () => 'a' }
    );
    expect(r.items[0].name).toBe('Sel');
  });
});

describe('plan et sécurité alimentaire', () => {
  const cat = RECIPES;
  const a = mine();
  const all = [...cat, a];
  const gen = (profile) => generatePlan({ recipes: all, ingredients: INGREDIENTS, profile: { adults: 2, ...profile }, seed: 3 });
  test('avec régime ou allergie : refusée des plans automatiques', () => {
    expect(rejectReason(a, INGREDIENTS, { diets: ['vegetarien'] })).toBe('custom');
    expect(rejectReason(a, INGREDIENTS, { excludedIngredients: ['gluten'] })).toBe('custom');
    expect(rejectReason(a, INGREDIENTS, {})).toBeNull();
  });
  test('sur 30 tirages, jamais seule dans un plan si le profil est restreint', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generatePlan({ recipes: all, ingredients: INGREDIENTS, profile: { adults: 2, excludedIngredients: ['lait'] }, seed });
      expect(p.meals.some((m) => m.recipeId === a.id)).toBe(false);
    }
  });
  test('ajout à la main : accepté, gardé en régénération, et marqué', () => {
    const profile = { adults: 2, excludedIngredients: ['lait'] };
    const p = gen(profile);
    const key = p.meals.find((m) => m.recipeId).key;
    const base = { plan: p, mealKey: key, recipeId: a.id, recipes: all, ingredients: INGREDIENTS, profile, seed: 1 };
    expect(swapMeal(base).meals.find((m) => m.key === key).recipeId).not.toBe(a.id);
    const n = swapMeal({ ...base, manual: true });
    const m = n.meals.find((x) => x.key === key);
    expect(m).toMatchObject({ recipeId: a.id, manual: true });
    const locked = lockedFromPlan(n);
    const again = generatePlan({ recipes: all, ingredients: INGREDIENTS, profile, seed: 8, locked });
    expect(again.meals.find((x) => x.key === key).recipeId).toBe(a.id);
  });
  test('recette supprimée ensuite : le repas reste, plan et échange ne plantent pas', () => {
    const profile = { adults: 2 };
    const p = gen({ excludedIngredients: ['lait'] });
    const key = p.meals.find((m) => m.recipeId).key;
    const n = swapMeal({ plan: p, mealKey: key, recipeId: a.id, manual: true, recipes: all, ingredients: INGREDIENTS, profile });
    const sans = swapMeal({ plan: n, mealKey: key, recipes: cat, ingredients: INGREDIENTS, profile, seed: 2 });
    expect(sans.meals.find((m) => m.key === key).recipeId).not.toBe(a.id);
  });
  test('recherche par titre et ingrédient libre', () => {
    const t = withMyTexts(textsFr, [a]);
    const opts = { titleOf: (r) => t.recipeTitle(r.id), ingredientNameOf: (k) => t.ingredientName(k) };
    expect(searchRecipes([a], { query: 'mon plat', ...opts }).length).toBe(1);
    expect(searchRecipes([a], { query: 'tofu', ...opts }).length).toBe(1);
  });
});
