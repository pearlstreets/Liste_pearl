// Fiche recette complète (lib/menus/ficheInfos.js) : allergènes réglementaires, ustensiles, difficulté,
// temps de préparation et de cuisson, valeurs pour 100 g, sur les recettes réelles (écrites à la main et
// générées) et sur quelques cas construits.
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
import {
  ALLERGENES_14,
  USTENSILES,
  ficheInfos,
  allergensOf,
  utensilsOf,
  difficultyOf,
  timesOf,
  per100Of,
  pantryOf,
  storageOf,
} from '../lib/menus/ficheInfos';
import fr from '../locales/fr.json';

const LANGS = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'pt', 'ru', 'sv', 'th', 'zh'];

let ING;
let FR;
let CAT;
beforeAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
  resetHealthCache();
  ING = getIngredients();
  FR = getTexts('fr');
  CAT = getCatalog();
});
afterAll(() => {
  resetMenusCache();
  resetHealthCache();
});

const legacy = (id) => getRecipes().find((r) => r.id === id);
const steps = (r) => FR.recipeSteps(r.id);
const infos = (r) => ficheInfos(r, { ingredients: ING, stepsFr: steps(r) });

describe('allergènes', () => {
  test('poulet rôti au citron : aucun des 14', () => {
    const r = legacy('poulet-roti-citron-pommes-de-terre');
    expect(allergensOf(r, ING)).toEqual({ contains: [], mayContain: [] });
  });

  test('tortillas au saumon fumé : gluten, poisson, lait dans l ordre réglementaire, lupin selon la marque', () => {
    const r = legacy('tortillas-saumon-fume-fromage-blanc');
    expect(allergensOf(r, ING).contains).toEqual(['gluten', 'poisson', 'lait']);
    expect(allergensOf(r, ING).mayContain).toContain('lupin');
  });

  test('arachide et mollusques séparés des fruits à coque et des crustacés', () => {
    const r = (keys) => ({ ingredients: keys.map((key) => ({ key, qty: 100, unit: 'g' })) });
    expect(allergensOf(r(['cacahuete']), ING).contains).toEqual(['arachide']);
    expect(allergensOf(r(['amande']), ING).contains).toEqual(['fruits-a-coque']);
    expect(allergensOf(r(['calamar']), ING).contains).toEqual(['mollusques']);
    expect(allergensOf(r(['crevette']), ING).contains).toEqual(['crustaces', 'sulfites']);
  });

  test('« peut contenir » : moutarde et curry ; jamais la noix de coco en fruit à coque', () => {
    const r = (keys) => ({ ingredients: keys.map((key) => ({ key, qty: 1, unit: 'cs' })) });
    expect(allergensOf(r(['moutarde']), ING)).toEqual({
      contains: ['moutarde', 'sulfites'],
      mayContain: ['gluten'],
    });
    expect(allergensOf(r(['lait-coco']), ING).mayContain).not.toContain('fruits-a-coque');
  });

  test('ingrédient absent de la base : rien d affirmé', () => {
    expect(
      allergensOf({ ingredients: [{ key: 'inconnu-xyz', qty: 1, unit: 'u' }] }, ING)
    ).toBeNull();
    expect(allergensOf({ ingredients: [] }, ING)).toBeNull();
  });
});

describe('ustensiles', () => {
  test('poulet rôti : four', () => {
    const r = legacy('poulet-roti-citron-pommes-de-terre');
    expect(utensilsOf(r, steps(r))).toEqual(['four']);
  });

  test('gratin d aubergines généré : four, plat à gratin, poêle', () => {
    const r = CAT.get('g-k9');
    expect(r).toBeTruthy();
    expect(utensilsOf(r, steps(r))).toEqual(['four', 'plat-four', 'poele']);
  });

  test('mots des étapes, dans l ordre d affichage', () => {
    const st = [
      'Faire chauffer le wok, puis égoutter les nouilles.',
      'Mixer la sauce et fouetter la crème dans un saladier.',
      'Râper le fromage. Les moules à la marinière sont servies chaudes.',
    ];
    expect(utensilsOf({}, st)).toEqual(['wok', 'mixeur', 'fouet', 'saladier', 'passoire', 'rape']);
    // « moules » seules (le coquillage), « fourchette », « sauce barbecue » : aucun ustensile
    expect(utensilsOf({}, ['Servir les moules avec une fourchette.'])).toEqual([]);
  });

  test('minuteur four sans le mot dans le texte', () => {
    expect(utensilsOf({ stepKinds: { 0: 'four' } }, ['Gratiner 10 min.'])).toEqual(['four']);
  });
});

describe('difficulté', () => {
  test('celle de la recette quand elle est connue', () => {
    expect(difficultyOf(legacy('poulet-roti-citron-pommes-de-terre'), [])).toBe(1);
    const dures = getRecipes().filter((r) => r.difficulty === 3);
    expect(dures.length).toBeGreaterThan(0);
    for (const r of dures) expect(difficultyOf(r, steps(r))).toBe(3);
  });

  test('déduite sinon : étapes, temps, techniques', () => {
    const court = ['Couper.', 'Mélanger.', 'Servir.'];
    expect(difficultyOf({ timeMin: 15 }, court)).toBe(1);
    expect(difficultyOf({ timeMin: 90 }, court)).toBe(2);
    expect(difficultyOf({ timeMin: 90 }, [...court, 'Monter les blancs en neige.'])).toBe(3);
    expect(difficultyOf({ timeMin: 20 }, Array(8).fill('Mélanger.'))).toBe(2);
    expect(difficultyOf({ timeMin: 20 }, [])).toBeNull();
  });
});

describe('temps de préparation et de cuisson', () => {
  test('poulet rôti : 50 min au four sur 75', () => {
    const r = legacy('poulet-roti-citron-pommes-de-terre');
    expect(timesOf(r, steps(r))).toEqual({ total: 75, prep: 25, cook: 50, rest: 0 });
  });

  test('étapes menées en parallèle : pas de répartition', () => {
    const r = CAT.get('g-2f3');
    expect(steps(r).join(' ')).toMatch(/Pendant ce temps/);
    expect(timesOf(r, steps(r))).toBeNull();
  });

  test('cuisson sans minuteur : pas de répartition', () => {
    const r = { timeMin: 30, stepTimers: { 1: 600 }, stepKinds: { 1: 'feu' } };
    expect(
      timesOf(r, ['Faire cuire les pâtes selon le paquet.', 'Laisser mijoter 10 min.'])
    ).toBeNull();
    expect(timesOf(r, ['Couper les légumes.', 'Laisser mijoter 10 min.'])).toEqual({
      total: 30,
      prep: 20,
      cook: 10,
      rest: 0,
    });
  });
});

describe('valeurs pour 100 g', () => {
  test('gratin d aubergines : rapport kcal et protéines au poids cru d une portion', () => {
    const r = CAT.get('g-k9');
    const p = per100Of(r, steps(r));
    expect(p).toEqual({ kcal: 120, protein: 4.4, portionG: 430 });
  });

  test('calcul sur une recette construite', () => {
    const r = {
      kcal: 300,
      protein: 15,
      servings: 2,
      ingredients: [
        { key: 'courgette', qty: 2, unit: 'u' }, // 500 g
        { key: 'feta', qty: 200, unit: 'g' },
        { key: 'huile-olive', qty: 2, unit: 'cs' }, // 30 g
        { key: 'oeuf', qty: 2, unit: 'u' }, // 100 g
        { key: 'persil', qty: 1, unit: 'u', optional: true },
      ],
    };
    // 830 g pour 2 : 415 g par portion
    expect(per100Of(r, ['Couper.', 'Cuire 10 min à la poêle.'])).toEqual({
      kcal: 72,
      protein: 3.6,
      portionG: 420,
    });
  });

  test('inconnu : pâtes qui gonflent, eau ajoutée, pièce sans poids, étapes absentes', () => {
    const pates = CAT.get('g-23y');
    expect(per100Of(pates, steps(pates))).toBeNull();
    const soupe = CAT.get('g-94');
    expect(per100Of(soupe, steps(soupe))).toBeNull();
    const poulet = legacy('poulet-roti-citron-pommes-de-terre');
    expect(per100Of(poulet, steps(poulet))).toBeNull(); // citron à la pièce
    expect(per100Of(CAT.get('g-k9'), [])).toBeNull();
  });
});

describe('toutes les recettes (474 écrites à la main et 11 581 générées)', () => {
  test('chaque partie est cohérente ou absente', () => {
    const all = [...getRecipes()];
    const c = getCore();
    for (let row = 0; row < c.N; row++) {
      const r = CAT.getRow(row);
      if (r) all.push(r);
    }
    expect(all.length).toBe(12055);
    const UT = USTENSILES.map((u) => u[0]);
    const n = { alg: 0, times: 0, per100: 0, ut: 0 };
    for (const r of all) {
      const f = infos(r);
      if (f.allergens) {
        n.alg++;
        for (const a of [...f.allergens.contains, ...f.allergens.mayContain])
          expect(ALLERGENES_14).toContain(a);
        for (const a of f.allergens.mayContain) expect(f.allergens.contains).not.toContain(a);
      }
      if (f.times) {
        n.times++;
        expect(f.times.prep + f.times.cook + f.times.rest).toBe(r.timeMin);
        expect(f.times.prep).toBeGreaterThanOrEqual(5);
      }
      if (f.per100) {
        n.per100++;
        expect(f.per100.kcal).toBeGreaterThanOrEqual(10);
        expect(f.per100.kcal).toBeLessThanOrEqual(900);
      }
      if (f.utensils.length) n.ut++;
      for (const u of f.utensils) expect(UT).toContain(u);
      expect(f.difficulty).toBe(r.difficulty);
      for (const k of f.pantry) expect(ING[k].pantry).toBe(true);
    }
    // toutes les recettes du catalogue ont des ingrédients connus de la base
    expect(n.alg).toBe(all.length);
    expect(n.times).toBeGreaterThan(5000);
    expect(n.per100).toBeGreaterThan(1500);
    expect(n.ut).toBeGreaterThan(10000);
  });
});

describe('placard et conservation', () => {
  test('poulet rôti', () => {
    const r = legacy('poulet-roti-citron-pommes-de-terre');
    expect(pantryOf(r, ING)).toEqual(['herbes', 'huile-olive', 'sel', 'poivre']);
    expect(storageOf(r)).toEqual({ fridgeDays: 3, freezable: false });
    expect(storageOf({ ...r, leftoverOk: false })).toBeNull();
  });
});

describe('textes', () => {
  test('les 13 langues ont les mêmes clés, sans tiret cadratin ni flèche', () => {
    const keys = (o, p = '') =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]
      );
    const base = keys(fr.menus.fiche).filter((k) => !/_(zero|one|two|few|many|other)$/.test(k));
    for (const k of ALLERGENES_14) expect(base).toContain(`allergen.${k}`);
    for (const [k] of USTENSILES) expect(base).toContain(`utensil.${k}`);
    for (const l of LANGS) {
      const m = require(`../locales/${l}.json`).menus.fiche;
      const ks = keys(m);
      for (const k of base) expect(ks).toContain(k);
      expect(JSON.stringify(m)).not.toMatch(/[—–→⇒]/);
    }
  });
});
