// Decouvrir sur le catalogue complet : pagination par 30, total reel, recettes relues d'abord sans recherche,
// restriction au foyer par masque, aucune materialisation en masse. Reproduit les appels de DiscoverScreen.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import {
  getRecipes,
  getCatalog,
  getRecipeIndex,
  getIngredients,
  getTexts,
  resetMenusCache,
} from '../lib/menus/recipes';
import { searchCatalog, pantryCatalog } from '../lib/menus/searchIndex';
import { eligibleCatalog, catalogActive } from '../lib/menus/pool';
import { getCore, idFromRow, LRU_SIZE } from '../lib/menus/catalog';
import { defaultProfile } from '../lib/menus/profile';

const PAGE = 30;
const fixture = () => ({
  meta: require('../data/menus/gen-fixture/meta.js'),
  hdr: require('../data/menus/gen-fixture/hdr.js'),
  loaders: require('../data/menus/gen-fixture/loaders.js'),
});
const reel = () => ({
  meta: require('../data/menus/gen/meta.js'),
  hdr: require('../data/menus/gen/hdr.js'),
  loaders: require('../data/menus/gen/loaders.js'),
});

beforeEach(() => {
  resetMenusCache();
  setGenSource(null);
  resetGenSource();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

// Meme enchainement que DiscoverScreen : tout le tri une fois, puis des fenetres de 30.
function liste(opts) {
  const cat = (opts && opts.catalog) || getCatalog();
  const t = getTexts('fr');
  const r = searchCatalog({
    lang: 'fr',
    titleOf: (x) => t.recipeTitle(x.id),
    ingredientNameOf: (k) => t.ingredientName(k),
    ...opts,
    catalog: cat,
  });
  return { total: r.total, refs: Array.from(r.refs), legacy: r.legacy };
}
const idAt = (res, v) => (v < 0 ? res.legacy[-v - 1].id : idFromRow(v));

describe('Decouvrir : pages sur le catalogue complet', () => {
  test('sans plafond de 150 : le total est le nombre reel et toutes les pages se suivent sans doublon', () => {
    setGenSource(fixture());
    const cat = getCatalog();
    expect(catalogActive(cat)).toBe(true);
    const res = liste({ shuffleSeed: '2026-0-1' });
    expect(res.total).toBe(cat.size);
    expect(res.total).toBeGreaterThan(150);
    expect(res.refs.length).toBe(res.total);
    const vus = new Set();
    for (let n = 0; n < res.total; n += PAGE) {
      for (const v of res.refs.slice(n, n + PAGE)) {
        const id = idAt(res, v);
        expect(vus.has(id)).toBe(false);
        vus.add(id);
      }
    }
    expect(vus.size).toBe(res.total);
  });

  test('sans recherche : les recettes relues passent en premier, puis les generees melangees (stable)', () => {
    setGenSource(fixture());
    const nb = getRecipes().length;
    const a = liste({ shuffleSeed: '2026-0-1' });
    const b = liste({ shuffleSeed: '2026-0-1' });
    const c = liste({ shuffleSeed: '2026-0-2' });
    expect(a.refs).toEqual(b.refs);
    expect(a.refs.slice(0, nb).every((v) => v < 0)).toBe(true);
    expect(a.refs.slice(nb).every((v) => v >= 0)).toBe(true);
    expect(c.refs.slice(nb)).not.toEqual(a.refs.slice(nb));
    expect([...c.refs.slice(nb)].sort((x, y) => x - y)).toEqual(
      [...a.refs.slice(nb)].sort((x, y) => x - y)
    );
  });

  test('une fenetre de 30 ne cree que 30 objets generes au plus', () => {
    setGenSource(fixture());
    const cat = getCatalog();
    const res = liste({ shuffleSeed: 'x' });
    const c = getCore();
    const avant = c.lru.size;
    for (const v of res.refs.slice(0, PAGE))
      if (v >= 0) expect(cat.getRow(v).id).toBe(idFromRow(v));
    expect(c.lru.size - avant).toBeLessThanOrEqual(PAGE);
  });

  test('pour mon foyer : le masque d eligibilite restreint les generees, les recettes perso restent', () => {
    setGenSource(fixture());
    const ings = getIngredients();
    const profile = { ...defaultProfile(), diets: ['vegan'] };
    const perso = { id: 'my-test', course: 'plat', custom: true, ingredients: [], tags: [] };
    const idx = getRecipeIndex({ extra: [perso] });
    const el = eligibleCatalog(idx, ings, profile);
    const tous = liste({ catalog: idx });
    const foyer = liste({
      catalog: idx,
      legacyList: [...el.legacyAll, ...[perso].filter((r) => !el.legacyAllIds.has(r.id))],
      allowedRows: el.gen.all,
    });
    expect(foyer.total).toBeLessThan(tous.total);
    for (const v of foyer.refs) if (v >= 0) expect(el.gen.all[v]).toBe(1);
    expect(foyer.refs.some((v) => v < 0 && foyer.legacy[-v - 1].id === 'my-test')).toBe(true);
  });

  test('favoris : un identifiant inconnu ou retire est ignore sans erreur', () => {
    setGenSource(fixture());
    const cat = getCatalog();
    const g0 = idFromRow(0);
    const res = liste({
      filters: { favoritesOnly: true, favorites: [g0, 'g-zzzzzz', 'g-', 'inconnu', 'g-1'] },
    });
    const ids = res.refs.map((v) => idAt(res, v)).sort();
    expect(ids).toEqual([g0, 'g-1'].filter((id) => cat.has(id)).sort());
  });

  test('mode frigo : fenetre de 40 avec le masque du foyer', () => {
    setGenSource(fixture());
    const ings = getIngredients();
    const cat = getCatalog();
    const el = eligibleCatalog(cat, ings, defaultProfile());
    const out = pantryCatalog({
      catalog: cat,
      legacyList: el.legacyAll,
      allowedRows: el.gen.all,
      ingredients: ings,
      have: ['poulet', 'riz', 'oignon', 'tomate'],
      limit: 40,
    });
    expect(out.items.length).toBeLessThanOrEqual(40);
    for (const it of out.items) {
      expect(it.recipe && it.recipe.id).toBeTruthy();
      const row = cat.rowOf(it.recipe.id);
      if (row >= 0) expect(el.gen.all[row]).toBe(1);
    }
  });

  test('donnees reelles : plus de 11 000 resultats, le cache d objets reste borne', () => {
    setGenSource(reel());
    const cat = getCatalog();
    expect(catalogActive(cat)).toBe(true);
    const res = liste({ shuffleSeed: 'reel' });
    expect(res.total).toBeGreaterThan(11000);
    const c = getCore();
    for (const v of res.refs.slice(0, 20 * PAGE)) if (v >= 0) cat.getRow(v);
    expect(c.lru.size).toBeLessThanOrEqual(LRU_SIZE);
  });
});

describe('Recette generee : ecran de recette et mode cuisine', () => {
  test('etapes reconstituees, minuteurs alignes sur les etapes, ingredients connus (donnees reelles)', () => {
    setGenSource(reel());
    const cat = getCatalog();
    const t = getTexts('fr');
    const ings = getIngredients();
    let avecMinuteur = 0;
    const n = cat.rowCount;
    for (let row = 0; row < n; row += 37) {
      const r = cat.getRow(row);
      if (!r) continue;
      const steps = t.recipeSteps(r.id);
      expect(steps.length).toBeGreaterThan(0);
      expect(t.recipeTitle(r.id).length).toBeGreaterThan(0);
      expect(r.ingredients.length).toBeGreaterThan(0);
      for (const l of r.ingredients) expect(ings[l.key]).toBeTruthy();
      for (const k of Object.keys(r.stepTimers)) {
        expect(Number(k)).toBeLessThan(steps.length);
        expect(r.stepTimers[k]).toBeGreaterThan(0);
        avecMinuteur++;
      }
    }
    expect(avecMinuteur).toBeGreaterThan(0);
  });

  test('identifiant inconnu : rien ne plante, titre de repli jamais vide', () => {
    setGenSource(reel());
    const cat = getCatalog();
    const t = getTexts('fr');
    expect(cat.get('g-zzzzzzzz')).toBeUndefined();
    expect(cat.has('g-')).toBe(false);
    expect(t.recipeTitle('g-zzzzzzzz').length).toBeGreaterThan(0);
    expect(t.recipeSteps('g-zzzzzzzz')).toEqual([]);
  });
});
