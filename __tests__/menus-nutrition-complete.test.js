// Tableau de valeurs nutritionnelles de la fiche (nutritionOf, lib/menus/ficheInfos.js) : table Ciqual de
// l'Anses (data/menus/nutrients.json). Couverture sur les 12 055 recettes, recettes réelles comparées à un
// calcul fait à la main, recette personnelle, ingrédient inconnu, garde-fou des 25 %.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import {
  getRecipes,
  getCatalog,
  getTexts,
  getIngredients,
  resetMenusCache,
} from '../lib/menus/recipes';
import { getCore } from '../lib/menus/catalog';
import { resetHealthCache } from '../lib/menus/healthy';
import { ficheInfos, nutritionOf, per100Of, NUTRIMENTS } from '../lib/menus/ficheInfos';

const NUT = require('../data/menus/nutrients.json');

let FR;
let CAT;
let ING;
beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
  resetHealthCache();
  FR = getTexts('fr');
  CAT = getCatalog();
  ING = getIngredients();
});
afterAll(() => {
  resetMenusCache();
  resetHealthCache();
});

const legacy = (id) => getRecipes().find((r) => r.id === id);
const steps = (r) => FR.recipeSteps(r.id);
const nut = (r) => nutritionOf(r, NUT, steps(r));

describe('couverture sur toutes les recettes', () => {
  test('part avec tableau et par nutriment', () => {
    const all = [...getRecipes()];
    const c = getCore();
    for (let row = 0; row < c.N; row++) {
      const r = CAT.getRow(row);
      if (r) all.push(r);
    }
    expect(all.length).toBe(12055);
    const n = { tab: 0, per100: 0 };
    const par = Object.fromEntries(NUTRIMENTS.map((k) => [k, 0]));
    for (const r of all) {
      const f = nut(r);
      if (!f) continue;
      n.tab++;
      for (const k of NUTRIMENTS) if (f.perPortion[k] !== null) par[k]++;
      // énergie et protéines : celles de la recette, comme le reste de l'application
      expect(f.perPortion.kcal).toBe(Math.round(r.kcal));
      expect(f.perPortion.kj).toBe(Math.round(r.kcal * 4.184));
      for (const k of NUTRIMENTS) {
        const v = f.perPortion[k];
        if (v !== null) expect(v).toBeGreaterThanOrEqual(0);
      }
      if (f.perPortion.satures !== null && f.perPortion.lipides !== null)
        expect(f.perPortion.satures).toBeLessThanOrEqual(f.perPortion.lipides + 0.1);
      if (f.perPortion.sucres !== null)
        expect(f.perPortion.sucres).toBeLessThanOrEqual(f.perPortion.glucides + 0.1);
      const p100 = per100Of(r, steps(r));
      if (f.per100) {
        n.per100++;
        expect(p100).not.toBeNull();
        expect(f.per100.kcal).toBe(p100.kcal);
      } else expect(p100).toBeNull();
    }
    // mesuré le 03/11/2026 : 11 660 recettes (96,7 %), dont 2 239 avec la colonne pour 100 g ; lipides
    // 8 988, saturés 8 819, glucides 11 660, sucres 10 613, fibres 8 071, sel 9 282
    expect(n.tab / all.length).toBeGreaterThan(0.95);
    expect(n.per100).toBeGreaterThan(2000);
    expect(par.glucides).toBe(n.tab);
    expect(par.proteines).toBe(n.tab);
    expect(par.lipides / n.tab).toBeGreaterThan(0.75);
    expect(par.satures / n.tab).toBeGreaterThan(0.74);
    expect(par.sucres / n.tab).toBeGreaterThan(0.9);
    expect(par.fibres / n.tab).toBeGreaterThan(0.68);
    expect(par.sel / n.tab).toBeGreaterThan(0.78);
  });
});

// Calculs faits à la main avec les valeurs Ciqual pour 100 g de data/menus/nutrients.json, 4 portions.
describe('recettes réelles, calcul à la main', () => {
  test('pâtes au pesto et courgettes', () => {
    // pâtes 400 g, pesto 100 g, courgette 300 g, tomate cerise 200 g, huile 1 cs = 15 g (1 015 g)
    // lipides 7,16 + 35,4 + 0,78 + 0,52 + 14,985 = 58,845 / 4 = 14,7
    // sucres 8,48 + 3,2 + 5,37 + 9,6 = 26,65 / 4 = 6,7 ; sel 0,12 + 2,64 + 0,06 + 0,02 = 2,84 / 4 = 0,71
    // huile sans protéines ni sel : 15 g sur 1 015 (1,5 %), la ligne reste
    const f = nut(legacy('pates-pesto-courgettes'));
    expect(f.perPortion).toEqual({
      kj: 2510,
      kcal: 600,
      lipides: 14.7,
      satures: 2.1,
      glucides: 71.6,
      sucres: 6.7,
      fibres: 5,
      proteines: 22,
      sel: 0.71,
    });
    expect(f.per100).toBeNull();
  });

  test('pâtes aux petits pois : sel hors du seuil, fibres de la crème inconnues', () => {
    // seuil sur 400 + 300 + 150 + 80 = 930 g ; crème sans fibres : 150 / 930 = 16 % non couverts
    // sel : 0,12 + 0,27 + 0,105 + 0,6 + 1 cc de sel (5 g x 97,8 %) = 5,985 / 4 = 1,5
    // lipides 7,16 + 1,32 + 46,05 + 22,88 = 77,41 / 4 = 19,4
    const f = nut(legacy('pates-petits-pois-fromage'));
    expect(f.perPortion.fibres).toBeNull();
    expect(f.perPortion.sel).toBe(1.5);
    expect(f.perPortion.lipides).toBe(19.4);
  });

  test('tartiflette : poivre hors du seuil mais compté', () => {
    // crème sans fibres : 100 g sur 1 550 (6,5 %), la ligne reste
    // fibres 18 + 0,68 + 2,6 + 5 g de poivre x 25,7 % = 22,565 / 4 = 5,6
    const f = nut(legacy('tartiflette-gourmande'));
    expect(f.perPortion.fibres).toBe(5.6);
    expect(f.perPortion.satures).toBe(20.8);
    expect(f.perPortion.kcal).toBe(780);
  });

  test('quesadillas : tortilla à la pièce (60 g)', () => {
    // 8 tortillas = 480 g ; lipides 39,36 + 2,425 + 42,9 + 2,352 + 0,39 + 5 g de cumin x 22,3 % = 88,54
    const f = nut(legacy('quesadillas-haricots-fromage'));
    expect(f.perPortion.lipides).toBe(22.1);
    expect(f.perPortion.fibres).toBe(10.7);
  });

  test('pommes de terre farcies : colonne pour 100 g sur le poids de per100Of', () => {
    // salade 1 pièce = 250 g ; portion 1 645 / 4 = 411,25 g
    // lipides 1,8 + 9,78 + 0,052 + 22,88 + 0,25 = 34,762 / 4 = 8,69 ; pour 100 g 8,69 / 4,1125 = 2,1
    // kcal pour 100 g 430 / 4,1125 = 105 (439 kJ) ; protéines 18 / 4,1125 = 4,4
    const r = legacy('pommes-de-terre-farcies-fromage-blanc');
    const f = nut(r);
    expect(f.perPortion.lipides).toBe(8.7);
    expect(f.per100).toEqual({
      kj: 439,
      kcal: 105,
      lipides: 2.1,
      satures: 1.3,
      glucides: 10.7,
      sucres: 1.2,
      fibres: 1.3,
      proteines: 4.4,
      sel: 0.37,
    });
    expect(per100Of(r, steps(r)).kcal).toBe(105);
  });
});

describe('cas construits', () => {
  const base = {
    id: 'essai',
    servings: 2,
    kcal: 500,
    protein: 20,
    ingredients: [
      { key: 'pates', qty: 200, unit: 'g' },
      { key: 'huile-olive', qty: 2, unit: 'cs' },
    ],
  };
  // Ciqual : 200 g x 3,36 + 30 g x 9 = 942 kcal / 2 = 471 kcal par portion

  test('recette personnelle : rien', () => {
    expect(nutritionOf({ ...base, custom: true }, NUT, [])).toBeNull();
    expect(
      ficheInfos({ ...base, custom: true }, { ingredients: ING, stepsFr: [] }).nutrition
    ).toBeNull();
  });

  test('sans kcal, sans table ou recette invalide : rien, jamais d exception', () => {
    expect(nutritionOf({ ...base, kcal: 0 }, NUT, [])).toBeNull();
    expect(nutritionOf(base, null, [])).toBeNull();
    expect(nutritionOf(base, { valeurs: 3 }, [])).toBeNull();
    expect(nutritionOf(null, NUT, [])).toBeNull();
    expect(nutritionOf({ ...base, ingredients: 'x' }, NUT, [])).toBeNull();
  });

  test('ficheInfos charge la table seule', () => {
    const f = ficheInfos(base, { ingredients: ING, stepsFr: [] });
    expect(f.nutrition.perPortion.kcal).toBe(500);
    expect(
      ficheInfos(base, { ingredients: ING, stepsFr: [], nutrients: null }).nutrition
    ).toBeNull();
  });

  test('ligne facultative exclue', () => {
    const r = {
      ...base,
      ingredients: [...base.ingredients, { key: 'beurre', qty: 500, unit: 'g', optional: true }],
    };
    expect(nutritionOf(r, NUT, [])).toEqual(nutritionOf(base, NUT, []));
  });

  test('ingrédient inconnu de la table : non couvert', () => {
    // 20 g inconnus sur 250 g (8 %) : les lignes restent
    const petit = {
      ...base,
      ingredients: [...base.ingredients, { key: 'ingredient-inconnu', qty: 20, unit: 'g' }],
    };
    expect(nutritionOf(petit, NUT, []).perPortion.lipides).not.toBeNull();
    // 100 g inconnus sur 330 g (30 %) : ni énergie Ciqual fiable ni tableau
    const gros = {
      ...base,
      ingredients: [...base.ingredients, { key: 'ingredient-inconnu', qty: 100, unit: 'g' }],
    };
    expect(nutritionOf(gros, NUT, [])).toBeNull();
    // pièce sans poids connu : comptée 100 g non couverts
    const piece = {
      ...base,
      ingredients: [...base.ingredients, { key: 'poulet-filet', qty: 1, unit: 'u' }],
    };
    expect(nutritionOf(piece, NUT, [])).toBeNull();
  });

  test('garde-fou : kcal Ciqual à plus de 25 % de celles de la recette', () => {
    // écart rapporté aux kcal de la recette : |471 - kcal| / kcal
    expect(nutritionOf({ ...base, kcal: 471 / 0.76 }, NUT, [])).not.toBeNull();
    expect(nutritionOf({ ...base, kcal: 471 / 0.74 }, NUT, [])).toBeNull();
    expect(nutritionOf({ ...base, kcal: 471 / 1.24 }, NUT, [])).not.toBeNull();
    expect(nutritionOf({ ...base, kcal: 471 / 1.4 }, NUT, [])).toBeNull();
  });

  test('seuil jugé nutriment par nutriment', () => {
    // huile d'olive sans protéines ni sel dans Ciqual : 30 g sur 230 (13 %), sel non affiché
    const f = nutritionOf(base, NUT, []);
    expect(f.perPortion.sel).toBeNull();
    expect(f.perPortion.lipides).toBe(Math.round(((200 * 1.79 + 30 * 99.9) / 100 / 2) * 10) / 10);
    expect(f.perPortion.proteines).toBe(20);
  });
});
