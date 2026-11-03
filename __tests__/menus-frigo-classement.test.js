// Recettes avec ce que j'ai : classement par nombre d'ingredients manquants, placard compte present,
// filtres respectes, liste courte de l'envoi (seulement le manquant), et rapidite sur tout le catalogue.
import { getRecipes, getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { recipesByPantry, spreadSimilar } from '../lib/menus/search';
import { pantryCatalog, titleKeys } from '../lib/menus/searchIndex';
import { titleOf } from '../lib/menus/packs';
import { rowFromId } from '../lib/menus/catalog';
import { recipeListLines } from '../lib/menus/recipeList';

const MARGE = process.env.CI ? 5 : 1;
const have = [
  'oeuf',
  'tomate',
  'riz',
  'oignon',
  'poulet-filet',
  'creme',
  'champignon',
  'pates',
  'carotte',
  'lardons',
];

afterAll(() => resetMenusCache());

describe('frigo : classement par manquants (recettes ecrites a la main)', () => {
  const recipes = getRecipes();
  const ingredients = getIngredients();
  const base = { ingredients, byMissing: true, maxMissing: 5 };

  test('sans option : comportement d avant (tri par score)', () => {
    const a = recipesByPantry(recipes, have, { ingredients });
    for (let i = 1; i < a.length; i++) expect(a[i - 1].score).toBeGreaterThanOrEqual(a[i].score);
  });

  test('ceux qui n ont rien a acheter d abord, puis 1, 2... ; plafond respecte', () => {
    const r = recipesByPantry(recipes, have, base);
    expect(r.length).toBeGreaterThan(0);
    for (let i = 1; i < r.length; i++)
      expect(r[i].missing.length).toBeGreaterThanOrEqual(r[i - 1].missing.length);
    expect(Math.max(...r.map((x) => x.missing.length))).toBeLessThanOrEqual(5);
    for (const x of r) for (const k of x.missing) expect(have).not.toContain(k);
  });

  test('un ingredient du placard n est plus jamais manquant', () => {
    const r0 = recipesByPantry(recipes, have, { ...base, limit: 0 });
    const cible = r0.find((x) => x.missing.length > 0);
    const k = cible.missing[0];
    const r1 = recipesByPantry(recipes, have, { ...base, limit: 0, basics: [k] });
    for (const x of r1) expect(x.missing).not.toContain(k);
    const m = r1.find((x) => x.recipe.id === cible.recipe.id);
    expect(m.missing.length).toBe(cible.missing.length - 1);
  });

  test('filtres : temps maximal respecte', () => {
    const r = recipesByPantry(recipes, have, { ...base, filters: { maxTimeMin: 20 } });
    for (const x of r) expect(x.recipe.timeMin).toBeLessThanOrEqual(20);
  });

  test('l envoi ne garde que les produits manquants', () => {
    const r = recipesByPantry(recipes, have, base).find((x) => x.missing.length > 0);
    const out = recipeListLines({
      recipe: r.recipe,
      persons: 4,
      recipes,
      ingredients,
      profile: {},
      keys: r.missing,
    });
    expect(out.lines.length).toBeGreaterThan(0);
    for (const l of out.lines) {
      expect(r.missing).toContain(l.key);
      expect(have).not.toContain(l.key);
    }
  });
});

describe('frigo : plats presque identiques espaces', () => {
  const it = (id, ms, score, sig) => ({ id, ms, score, sig });
  const run = (list, o) =>
    spreadSimilar(
      list,
      (x) => x.ms,
      (x) => x.sig,
      o
    ).map((x) => x.id);

  test('meme signature espacee, groupes de manquants jamais melanges', () => {
    const list = [
      it('a1', 0, 98, ['d:wok de poulet']),
      it('a2', 0, 98, ['d:wok de poulet']),
      it('a3', 0, 97, ['d:wok de poulet']),
      it('b1', 0, 96, ['d:veloute de tomates']),
      it('c1', 0, 95, ['d:salade de riz']),
      it('d1', 1, 90, ['d:wok de poulet']),
      it('e1', 1, 89, ['d:gratin']),
    ];
    expect(run(list)).toEqual(['a1', 'b1', 'c1', 'a2', 'a3', 'd1', 'e1']);
  });

  test('jamais un plat bien moins bien classe remonte pour varier', () => {
    const list = [
      it('a1', 0, 98, ['d:wok de poulet']),
      it('a2', 0, 97, ['d:wok de poulet']),
      it('z1', 0, 40, ['d:soupe']),
    ];
    expect(run(list)).toEqual(['a1', 'a2', 'z1']);
  });

  test('cle forte (seule la sauce change) : doublon recule, dans son groupe, sans faire monter un plat bien moins bon', () => {
    const list = [
      it('w1', 0, 98, ['d:wok de poulet', 'h:1+2+3']),
      it('n1', 0, 98, ['d:nouilles sautees', 'h:1+2+3']),
      it('w2', 0, 98, ['d:wok de poulet', 'h:1+2+3']),
      it('z1', 0, 75, ['d:soupe']),
      it('y1', 0, 70, ['d:gratin']),
      it('x1', 1, 20, ['d:tarte']),
    ];
    expect(run(list, { strong: 'h:' })).toEqual(['w1', 'z1', 'y1', 'n1', 'w2', 'x1']);
    // plus de 30 points d'ecart : le doublon garde sa place
    const loin = list.map((x) => (x.id === 'z1' || x.id === 'y1' ? { ...x, score: x.score - 40 } : x));
    expect(run(loin, { strong: 'h:' })).toEqual(['w1', 'n1', 'w2', 'z1', 'y1', 'x1']);
    // sans cle forte : comportement d avant
    expect(run(list)).toEqual(['w1', 'n1', 'w2', 'z1', 'y1', 'x1']);
  });

  test('cles de titre : debut et fin', () => {
    expect(titleKeys('Blancs de poulet au curry, riz')).toEqual([
      'd:blancs de poulet',
      'f:au curry riz',
    ]);
    expect(titleKeys('Penne aux lardons et aux petits pois')[1]).toBe(
      titleKeys('Spaghetti aux lardons et aux petits pois')[1]
    );
    expect(titleKeys('')).toBeNull();
  });
});

describe('frigo : catalogue complet', () => {
  let catalog;
  let ingredients;
  beforeAll(() => {
    resetMenusCache();
    catalog = getCatalog();
    ingredients = getIngredients();
  });

  test('meme classement sur le catalogue, fenetre coherente', () => {
    const o = { catalog, ingredients, have, byMissing: true, maxMissing: 5 };
    const r = pantryCatalog({ ...o, limit: 60 });
    expect(r.total).toBeGreaterThan(60);
    expect(r.items.length).toBe(60);
    for (let i = 1; i < r.items.length; i++)
      expect(r.items[i].missing.length).toBeGreaterThanOrEqual(r.items[i - 1].missing.length);
    for (const x of r.items) {
      expect(x.missing.length).toBeLessThanOrEqual(5);
      expect(x.recipe && x.recipe.id).toBeTruthy();
    }
    const p2 = pantryCatalog({ ...o, limit: 20, offset: 20 });
    expect(p2.items.map((x) => x.recipe.id)).toEqual(r.items.slice(20, 40).map((x) => x.recipe.id));
  });

  test('essai reel : le haut du classement n enchaine pas le meme plat', () => {
    for (const h of [have, ['poulet-filet', 'poivron', 'oignon', 'riz', 'sauce-soja']]) {
      const items = pantryCatalog({
        catalog,
        ingredients,
        have: h,
        byMissing: true,
        maxMissing: 5,
        limit: 12,
      }).items;
      const heads = items.map((x) => {
        const row = rowFromId(x.recipe.id);
        const k = row >= 0 ? titleKeys(titleOf(row, 'fr')) : null;
        return k ? k[0] : x.recipe.id;
      });
      // haut du classement (8 premiers) : jamais trois fois de suite le meme debut de titre
      // (avant : six « Velouté de tomates ... » d'affilée)
      for (let i = 2; i < 8; i++)
        if (items[i].missing.length === items[i - 2].missing.length)
          expect(heads[i] === heads[i - 1] && heads[i] === heads[i - 2]).toBe(false);
      for (let i = 1; i < items.length; i++)
        expect(items[i].missing.length).toBeGreaterThanOrEqual(items[i - 1].missing.length);
    }
  });

  test('essai reel : frigo oignon, carotte, poivron, tomate, poulet, courgette : top 8 varie', () => {
    const h = ['oignon', 'carotte', 'poivron', 'tomate', 'poulet-filet', 'courgette'];
    const o = { catalog, ingredients, have: h, byMissing: true, maxMissing: 5 };
    for (const filters of [{ maxTimeMin: 30, balanced: true }, {}]) {
      const items = pantryCatalog({ ...o, filters, limit: 60 }).items;
      const titles = items.map((x) => {
        const row = rowFromId(x.recipe.id);
        return row >= 0 ? titleOf(row, 'fr') : x.recipe.id;
      });
      // avant : places 5 a 8 = wok ou nouilles au poulet, poivrons, oignon, seule la sauce changeait
      const woks = titles
        .slice(0, 8)
        .filter((t) =>
          /^(wok de poulet|nouilles sautees au poulet)/i.test(
            t.normalize('NFD').replace(/[̀-ͯ]/g, '')
          )
        );
      expect(woks.length).toBeLessThanOrEqual(1);
      for (let i = 1; i < items.length; i++)
        expect(items[i].missing.length).toBeGreaterThanOrEqual(items[i - 1].missing.length);
    }
  });

  test('placard : le manquant disparait aussi pour les recettes generees', () => {
    const o = { catalog, ingredients, have, byMissing: true, maxMissing: 5, limit: 200 };
    const k = pantryCatalog(o).items.find((x) => x.missing.length > 0).missing[0];
    const sans = pantryCatalog({ ...o, basics: [k] }).items;
    for (const x of sans) expect(x.missing).not.toContain(k);
  });

  test('frigo de 10 ingredients sur tout le catalogue : sous 100 ms', () => {
    const o = { catalog, ingredients, have, byMissing: true, maxMissing: 5, limit: 60 };
    pantryCatalog(o); // chauffe : index inverse
    const t = [];
    for (let i = 0; i < 10; i++) {
      const a = performance.now();
      pantryCatalog(o);
      t.push(performance.now() - a);
    }
    t.sort((x, y) => x - y);
    console.log(`frigo 10 ingredients : mediane ${t[5].toFixed(1)} ms, max ${t[9].toFixed(1)} ms`);
    expect(t[9]).toBeLessThan(100 * MARGE);
  });
});
