// Repères santé (lib/menus/healthy.js) : légumes par portion, plat équilibré, rapidité, cuisines du monde,
// colonnes du catalogue généré (mêmes réponses que les fonctions sur objets) et filtres de recherche.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getRecipes, getCatalog, getTexts, resetMenusCache } from '../lib/menus/recipes';
import { filterRecipes, searchRecipes } from '../lib/menus/search';
import { searchCatalog, filterMask } from '../lib/menus/searchIndex';
import { getCore, loadBlock } from '../lib/menus/catalog';
import { loadTitles, titleOf } from '../lib/menus/packs';
import {
  CUISINES,
  BALANCED,
  PLENTY_VEG,
  vegGrams,
  isBalanced,
  isQuick,
  isSide,
  isFried,
  cuisineOf,
  genHealth,
  genHealthAsync,
  genPasses,
  resetHealthCache,
  FLAG_BALANCED,
  matchHealth,
} from '../lib/menus/healthy';

const MARGE = process.env.CI ? 5 : 1;

beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
  resetHealthCache();
});
afterAll(() => {
  resetMenusCache();
  resetHealthCache();
});

const plat = (over = {}) => ({
  id: 'test-plat',
  course: 'plat',
  servings: 2,
  timeMin: 25,
  kcal: 520,
  protein: 28,
  tags: [],
  ingredients: [
    { key: 'courgette', qty: 300, unit: 'g' },
    { key: 'poulet-filet', qty: 300, unit: 'g' },
  ],
  ...over,
});

describe('légumes par portion', () => {
  test('grammes, pièces, cuillères ; fruits, herbes, ail, oignon, pomme de terre exclus', () => {
    const r = plat({
      ingredients: [
        { key: 'courgette', qty: 300, unit: 'g' },
        { key: 'tomate', qty: 2, unit: 'u' }, // 2 x 120 g
        { key: 'petits-pois', qty: 100, unit: 'g' }, // surgelé compté
        { key: 'oignon', qty: 1, unit: 'u' },
        { key: 'ail', qty: 2, unit: 'u' },
        { key: 'persil', qty: 1, unit: 'cs' },
        { key: 'citron', qty: 1, unit: 'u' },
        { key: 'pomme-de-terre', qty: 500, unit: 'g' },
        { key: 'epinard', qty: 200, unit: 'g', optional: true }, // facultatif : non compté
      ],
    });
    expect(vegGrams(r)).toBe(Math.round((300 + 240 + 100) / 2));
  });
  test('sans portions : 4 ; recette vide : 0', () => {
    expect(vegGrams({ ingredients: [{ key: 'carotte', qty: 400, unit: 'g' }] })).toBe(100);
    expect(vegGrams({})).toBe(0);
    expect(vegGrams(null)).toBe(0);
  });
});

describe('équilibré, rapide, accompagnement, friture', () => {
  test('plat équilibré : seuils', () => {
    expect(BALANCED).toEqual({ minVeg: 100, minProtein: 20, minKcal: 400, maxKcal: 750 });
    expect(isBalanced(plat(), undefined, 'Poulet aux courgettes')).toBe(true);
    expect(isBalanced(plat({ protein: 19 }), undefined, 'x')).toBe(false);
    expect(isBalanced(plat({ kcal: 399 }), undefined, 'x')).toBe(false);
    expect(isBalanced(plat({ kcal: 751 }), undefined, 'x')).toBe(false);
    const peu = plat({ ingredients: [{ key: 'courgette', qty: 150, unit: 'g' }] });
    expect(isBalanced(peu, undefined, 'x')).toBe(false); // 75 g par portion
  });
  test('jamais pour un dessert, un petit-déjeuner, un accompagnement ou une friture', () => {
    expect(isBalanced(plat({ course: 'dessert' }), undefined, 'x')).toBe(false);
    expect(isBalanced(plat({ course: 'petit-dejeuner' }), undefined, 'x')).toBe(false);
    expect(isBalanced(plat({ sub: 'accompagnements' }), undefined, 'x')).toBe(false);
    expect(isBalanced(plat(), undefined, 'Escalopes panées et courgettes')).toBe(false);
    expect(isBalanced(plat(), undefined, 'Beignets de courgettes')).toBe(false);
    expect(isFried(plat(), 'Frites au four et courgettes')).toBe(false);
    expect(isFried(plat(), 'Samoussas aux légumes au four')).toBe(false);
    expect(isFried(plat(), 'Tempura de légumes')).toBe(true);
  });
  test('rapide sur timeMin', () => {
    expect(isQuick({ timeMin: 20 })).toBe(true);
    expect(isQuick({ timeMin: 25 })).toBe(false);
    expect(isQuick({ timeMin: 25 }, 30)).toBe(true);
    expect(isQuick({})).toBe(false);
  });
  test('accompagnement', () => {
    expect(isSide({ sub: 'accompagnements' })).toBe(true);
    expect(isSide({ sub: 'viandes' })).toBe(false);
    expect(isSide(null)).toBe(false);
  });
});

describe('cuisines du monde', () => {
  const r = (keys) => ({ id: 'x', ingredients: keys.map((key) => ({ key, qty: 1, unit: 'u' })) });
  test.each([
    ['Pad thaï aux crevettes', [], 'asie'],
    ['Wok de bœuf aux poivrons', [], 'asie'],
    ['Poulet tikka masala', [], 'inde'],
    ['Dahl de lentilles aux carottes', [], 'inde'],
    ["Tajine d'agneau à la patate douce", [], 'maghreb-orient'],
    ['Taboulé frais à la menthe', [], 'maghreb-orient'],
    ['Risotto aux champignons', [], 'italie'],
    ['Spaghettis carbonara', [], 'italie'],
    ['Paella au poulet et au chorizo', [], 'espagne-portugal'],
    ['Moussaka simplifiée', [], 'grece'],
    ['Salade grecque', [], 'grece'],
    ['Blanquette de veau et riz', [], 'france'],
    ['Ratatouille provençale', [], 'france'],
    ['Chili con carne généreux', [], 'ameriques'],
    ['Tacos mexicains à garnir', [], 'ameriques'],
    ['Mafé de bœuf à la cacahuète', [], 'afrique'],
    // ingrédient signature
    ['Poulet mijoté aux légumes', ['nuoc-mam', 'poulet-filet'], 'asie'],
    ['Agneau aux carottes', ['ras-el-hanout', 'agneau'], 'maghreb-orient'],
  ])('%s', (title, keys, expected) => {
    expect(cuisineOf(r(keys), title)).toBe(expected);
  });
  test.each([
    // pièges relevés : mieux vaut aucune cuisine qu'un faux classement
    ['Saumon laqué au miel et au soja', ['saumon', 'miel', 'sauce-soja', 'sesame']],
    ['Gratin de courgettes au chèvre', ['courgette', 'chevre']],
    ['Quiche aux poireaux et au chèvre', ['poireau', 'pate-brisee']],
    ['Velouté de carottes au cumin', ['carotte', 'cumin']],
    ['Salade de betterave, pomme et feta', ['betterave', 'pomme', 'feta']],
    ['Quiche à la feta et aux olives noires', ['feta', 'olives', 'oeuf']],
    ['Côtes de porc au curry, tagliatelles', ['cotes-porc', 'curry', 'pates']],
    ['Bowl riz, poulet, patate douce rôtie, sauce tahini', ['tahini', 'riz', 'patate-douce']],
    ['Poulet thaï à la marocaine', []], // deux cuisines au même niveau : fusion
    ['Poulet rôti au citron', ['poulet-filet', 'citron']],
    // essai réel du 03/11 : un mot seul ou un accompagnement ne fait pas une cuisine
    ["Carpaccio d'ananas au citron vert et à la menthe", ['ananas', 'citron-vert', 'sucre', 'menthe']],
    ['Carpaccio de betterave, poire et chèvre', ['betterave', 'poire', 'chevre', 'noix']],
    ['Blancs de poulet à la moutarde, polenta crémeuse', ['poulet-filet', 'moutarde', 'polenta']],
    ['Blancs de poulet au miel et au thym, polenta crémeuse', ['poulet-filet', 'miel', 'polenta']],
    ['Salade de roquette à la mozzarella, avocat et maïs', ['roquette', 'mozzarella', 'avocat', 'mais']],
    [
      'Salade de roquette à la mozzarella, carottes râpées et raisins secs',
      ['roquette', 'mozzarella', 'carotte', 'raisins-secs'],
    ],
    ['Salade de roquette à la mozzarella, pomme et céleri', ['roquette', 'mozzarella', 'pomme']],
    ['Tourte épinards et ricotta', ['pate-feuilletee', 'epinard-surgele', 'ricotta', 'parmesan']],
    [
      'Bouchées feuilletées aux tomates cerises et à la mozzarella',
      ['pate-feuilletee', 'tomate-cerise', 'mozzarella', 'basilic'],
    ],
  ])('aucune cuisine : %s', (title, keys) => {
    expect(cuisineOf(r(keys), title)).toBeNull();
  });
  test('accompagnement : la cuisine vient du plat, pas de la polenta ; vrais plats italiens gardés', () => {
    expect(
      cuisineOf(r(['cotes-porc', 'curry', 'polenta']), 'Côtes de porc au curry, polenta crémeuse')
    ).not.toBe('italie');
    expect(cuisineOf(r([]), 'Carpaccio de boeuf, parmesan et roquette')).toBe('italie');
    expect(cuisineOf(r(['polenta']), 'Polenta crémeuse aux champignons')).toBe('italie');
    expect(cuisineOf(r(['polenta', 'parmesan']), 'Bâtonnets de polenta croustillants au parmesan')).toBe(
      'italie'
    );
    expect(cuisineOf(r(['aubergine', 'mozzarella']), "Gratin d'aubergines à la parmesane")).toBe('italie');
    expect(
      cuisineOf(r(['tomate', 'mozzarella', 'basilic']), 'Salade de tomates, mozzarella et basilic')
    ).toBe('italie');
  });
  test("l'adjectif l'emporte sur le plat : « Lasagnes à la mexicaine »", () => {
    expect(cuisineOf(r([]), 'Lasagnes à la mexicaine')).toBe('ameriques');
  });
  test('474 : titre français lu dans le pack, une cuisine connue ou null', () => {
    const list = getRecipes();
    const t = getTexts('fr');
    const byTitle = (s) => list.find((x) => t.recipeTitle(x.id) === s);
    const pad = byTitle('Pad thaï aux crevettes');
    if (pad) expect(cuisineOf(pad)).toBe('asie');
    const counts = {};
    for (const x of list) {
      const c = cuisineOf(x);
      expect(c === null || CUISINES.includes(c)).toBe(true);
      counts[c] = (counts[c] || 0) + 1;
    }
    for (const c of ['asie', 'inde', 'maghreb-orient', 'italie', 'france', 'ameriques'])
      expect(counts[c]).toBeGreaterThan(5);
    expect(counts.null).toBeGreaterThan(list.length / 3);
  });
});

describe('catalogue généré : colonnes', () => {
  test('colonnes = fonctions sur la recette matérialisée (300 cases)', () => {
    const h = genHealth();
    const c = getCore();
    expect(h).toBeTruthy();
    expect(h.veg).toBeInstanceOf(Uint16Array);
    expect(h.cuisine).toBeInstanceOf(Uint8Array);
    expect(h.veg.length).toBe(c.N);
    const cat = getCatalog();
    let vus = 0;
    for (let row = 0; row < c.N && vus < 300; row += 37) {
      const rec = cat.getRow(row);
      if (!rec) continue;
      vus++;
      expect(vegGrams(rec)).toBe(h.veg[row]);
      expect(isBalanced(rec)).toBe((h.flags[row] & FLAG_BALANCED) !== 0);
      const title = titleOf(row, 'fr');
      // chemin objet (titre donné) et chemin colonnes : même cuisine
      expect(cuisineOf(rec, title)).toBe(cuisineOf(rec));
      expect(isSide(rec)).toBe(rec.sub === 'accompagnements');
    }
    expect(vus).toBeGreaterThan(250);
  });
  test('accompagnements jamais équilibrés, plats équilibrés nombreux', () => {
    const h = genHealth();
    const c = getCore();
    const side = c.SUBS.indexOf('accompagnements');
    let bal = 0;
    for (let i = 0; i < c.N; i++) {
      if (c.cols.sub[i] === side) expect(h.flags[i] & FLAG_BALANCED).toBe(0);
      if (h.flags[i] & FLAG_BALANCED) bal++;
    }
    expect(bal).toBeGreaterThan(1000);
  });
  test(`calcul par colonnes en moins de ${50 * MARGE} ms (titres et lignes déjà chargés)`, () => {
    const c = getCore();
    loadTitles('fr');
    for (let b = 0; b < c.nBlocks; b++) loadBlock(c, 'lines', b);
    const ts = [];
    for (let k = 0; k < 3; k++) {
      resetHealthCache();
      const t0 = Date.now();
      genHealth();
      ts.push(Date.now() - t0);
    }
    expect(Math.min(...ts)).toBeLessThan(50 * MARGE);
  });
  test('version par tranches : même résultat, annulable', async () => {
    resetHealthCache();
    const ref = genHealth();
    resetHealthCache();
    let tranches = 0;
    const h = await genHealthAsync(undefined, { yieldFn: async () => tranches++ });
    expect(tranches).toBe(getCore().nBlocks);
    expect(Array.from(h.veg)).toEqual(Array.from(ref.veg));
    expect(Array.from(h.cuisine)).toEqual(Array.from(ref.cuisine));
    resetHealthCache();
    expect(await genHealthAsync(undefined, { cancelled: () => true })).toBeNull();
  });
});

describe('filtres de recherche', () => {
  test('sans filtre santé : résultats inchangés', () => {
    const list = getRecipes();
    expect(filterRecipes(list, { course: 'plat', balanced: false, cuisine: null })).toEqual(
      filterRecipes(list, { course: 'plat' })
    );
    const c = getCore();
    expect(Array.from(filterMask(c, { course: 'plat', minVeg: 0 }))).toEqual(
      Array.from(filterMask(c, { course: 'plat' }))
    );
  });
  test('474 : balanced, minVeg, cuisine', () => {
    const list = getRecipes();
    const bal = filterRecipes(list, { balanced: true });
    expect(bal.length).toBeGreaterThan(50);
    for (const r of bal) expect(isBalanced(r)).toBe(true);
    const veg = filterRecipes(list, { minVeg: PLENTY_VEG });
    for (const r of veg) expect(vegGrams(r)).toBeGreaterThanOrEqual(PLENTY_VEG);
    const it = filterRecipes(list, { cuisine: 'italie' });
    expect(it.length).toBeGreaterThan(10);
    for (const r of it) expect(cuisineOf(r)).toBe('italie');
    expect(filterRecipes(list, { cuisine: 'inconnue' })).toEqual([]);
    expect(searchRecipes(list, { query: 'risotto', filters: { cuisine: 'italie' } }).length).toBe(
      searchRecipes(list, { query: 'risotto' }).length
    );
  });
  test('catalogue : searchCatalog combine recherche et filtres santé', () => {
    const c = getCore();
    const h = genHealth();
    const f = { balanced: true, cuisine: 'asie', maxTimeMin: 30 };
    const mask = filterMask(c, f);
    let n = 0;
    for (let i = 0; i < c.N; i++)
      if (mask[i]) {
        n++;
        expect(genPasses(h, i, f)).toBe(true);
        expect(c.cols.time[i] * 5).toBeLessThanOrEqual(30);
      }
    expect(n).toBeGreaterThan(50);
    const res = searchCatalog({ catalog: getCatalog(), lang: 'fr', query: 'wok', filters: f });
    expect(res.total).toBeGreaterThan(0);
    const cat = getCatalog();
    for (const v of Array.from(res.refs).slice(0, 40)) {
      const rec = v < 0 ? res.legacy[-v - 1] : cat.getRow(v);
      expect(matchHealth(rec, f)).toBe(true);
    }
    expect(filterMask(c, { cuisine: 'inconnue' }).some((x) => x === 1)).toBe(false);
  });
});
