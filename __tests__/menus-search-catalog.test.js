// Recherche et mode frigo sur le catalogue genere (lib/menus/searchIndex.js) : equivalence avec searchRecipes,
// recipesByPantry et filterRecipes, index normalise, pagination, fusion avec les recettes ecrites a la main et personnelles.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import {
  getRecipes,
  getCatalog,
  getIngredients,
  getTexts,
  resetMenusCache,
} from '../lib/menus/recipes';
import { searchRecipes, scoreRecipes, filterRecipes, recipesByPantry } from '../lib/menus/search';
import {
  searchCatalog,
  pantryCatalog,
  buildTitleIndex,
  buildSearchIndex,
  resultRecipes,
  filterMask,
} from '../lib/menus/searchIndex';
import { loadTitleBlock } from '../lib/menus/packs';
import { getCore, rowFromId } from '../lib/menus/catalog';
import { norm, createRng } from '../lib/menus/util';

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
const DASH = /[\u2014\u2013\u2192\u2190\u21D2\u21D4\u2194]/;

// Source de test avec des titres CJK, thai et cyrillique (sans ni avec espaces) en plus du francais.
function sourceMultilingue() {
  const base = fixture();
  const fr = base.loaders.titles;
  const N = base.meta.N;
  const synth = {
    ja: (i) => `鶏肉のカレー${i % 7}`,
    th: (i) => `แกงไก่${i % 5} สูตร${i % 3}`,
    ru: (i) => `Курица с рисом ${i % 6} и овощами`,
  };
  return {
    ...base,
    loaders: {
      ...base.loaders,
      LANGS: ['fr', 'ja', 'th', 'ru'],
      titles(lang, b) {
        if (!synth[lang]) return fr(lang, b);
        return Array.from({ length: N }, (_, i) => synth[lang](i)).join('\n');
      },
    },
  };
}

function utiliser(src) {
  resetMenusCache();
  setGenSource(src);
}
beforeEach(() => {
  resetMenusCache();
  setGenSource(null);
  resetGenSource();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

// Cases generees materialisees : [[case, recette]].
function toutes(cat) {
  const c = getCore();
  const out = [];
  for (let i = 0; i < c.N; i++) {
    const r = cat.materialize(i);
    if (r) out.push([i, r]);
  }
  return out;
}

// Mots de requete tires de vrais titres, d'ingredients et d'etiquettes, avec accents et casse variees.
function requetes(n, graine, titres, noms) {
  const rng = createRng(graine);
  const mots = [];
  for (const t of titres) for (const w of norm(t).split(' ')) if (w.length > 1) mots.push(w);
  const tags = ['vegan', 'sans gluten', 'rapide', 'enfants', 'four', 'ete', 'leger', 'batch'];
  const accents = [
    'crème',
    'Épinards',
    'ŒUF',
    'Pâtes',
    'ÉCHALOTE',
    'Gratiné',
    'zzz',
    'p',
    'a',
    'e',
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = 1 + Math.floor(rng() * 3);
    const parts = [];
    for (let j = 0; j < k; j++) {
      const u = rng();
      if (u < 0.5) {
        const w = mots[Math.floor(rng() * mots.length)];
        parts.push(w.slice(0, 1 + Math.floor(rng() * w.length)));
      } else if (u < 0.7)
        parts.push(noms[Math.floor(rng() * noms.length)].slice(0, 2 + Math.floor(rng() * 5)));
      else if (u < 0.82) parts.push(tags[Math.floor(rng() * tags.length)]);
      else parts.push(accents[Math.floor(rng() * accents.length)]);
    }
    out.push(parts.join(' '));
  }
  return out;
}

const trier = (liste) => liste.sort((a, b) => b.s - a.s || a.row - b.row).map((x) => x.row);

describe('index de titres normalises', () => {
  test('chaque ligne du bloc vaut norm(titre) aux espaces de bord pres (donnees francaises)', () => {
    utiliser(reel());
    const idx = buildTitleIndex('fr');
    const c = getCore();
    const t = getTexts('fr');
    expect(idx.blocks).toHaveLength(c.nBlocks);
    let verifie = 0;
    for (let b = 0; b < c.nBlocks; b++) {
      const { blob, starts } = idx.blocks[b];
      const count = starts.length - 1;
      expect(blob[0]).toBe('\n');
      for (let i = 0; i < count; i++) {
        const row = b * c.SHARD + i;
        const ligne = blob.slice(starts[i], starts[i + 1] - 1);
        expect(ligne.includes('\n')).toBe(false);
        if (ligne.trim() !== norm(t.recipeTitle('g-' + row.toString(36)))) {
          // une case retiree n'a pas de titre : seule exception admise
          expect(c.cols.flags[row] & 4).toBeTruthy();
        } else verifie++;
      }
    }
    expect(verifie).toBeGreaterThan(c.alive - 1);
  });

  test('index asynchrone en tranches, annulable', async () => {
    utiliser(reel());
    let tranches = 0;
    const idx = await buildSearchIndex('fr', {
      yieldFn: () => {
        tranches++;
        return Promise.resolve();
      },
    });
    expect(idx.done).toBe(true);
    // une tranche par bloc de titres, puis une par bloc de lignes d'ingredients (index inverse, sauf apres le dernier)
    expect(tranches).toBe(getCore().nBlocks * 2 - 1);
    expect(getCore().inv).toBeTruthy();
    resetMenusCache();
    setGenSource(reel());
    expect(await buildSearchIndex('fr', { cancelled: () => true })).toBeNull();
  });
});

describe('equivalence avec searchRecipes', () => {
  test('recettes ecrites a la main : meme liste et meme ordre (sur 474 + perso, 200 requetes)', () => {
    utiliser(fixture());
    const legacy = getRecipes();
    const t = getTexts('fr');
    const cat = getCatalog();
    const titres = legacy.slice(0, 80).map((r) => t.recipeTitle(r.id));
    const noms = Object.keys(getIngredients()).map((k) => t.ingredientName(k));
    for (const q of requetes(200, 'leg', titres, noms)) {
      const o = {
        query: q,
        titleOf: (r) => t.recipeTitle(r.id),
        ingredientNameOf: (k) => t.ingredientName(k),
      };
      const attendu = searchRecipes(legacy, o).map((r) => r.id);
      const res = searchCatalog({ catalog: cat, lang: 'fr', ...o });
      expect(res.legacy.map((r) => r.id)).toEqual(attendu);
    }
  });

  test('cases generees (fixture, 200 requetes) : memes cases, meme ordre que scoreRecipes', () => {
    utiliser(fixture());
    const cat = getCatalog();
    const gen = toutes(cat);
    const t = getTexts('fr');
    const noms = Object.keys(getIngredients()).map((k) => t.ingredientName(k));
    const titres = gen.map(([, r]) => t.recipeTitle(r.id));
    for (const q of requetes(200, 'gen', titres, noms)) {
      const o = {
        query: q,
        titleOf: (r) => t.recipeTitle(r.id),
        ingredientNameOf: (k) => t.ingredientName(k),
      };
      const attendu = trier(
        scoreRecipes(
          gen.map(([, r]) => r),
          o
        ).map((x) => ({ s: x.s, row: rowFromId(x.r.id) }))
      );
      const res = searchCatalog({ catalog: cat, lang: 'fr', ...o });
      const rows = Array.from(res.refs).filter((v) => v >= 0);
      expect(rows).toEqual(attendu);
      expect(res.total).toBe(res.legacy.length + attendu.length);
    }
  });

  test('catalogue complet (60 requetes) : meme liste, avec accents, majuscules et mots multiples', () => {
    utiliser(reel());
    const cat = getCatalog();
    const gen = toutes(cat);
    const t = getTexts('fr');
    const noms = Object.keys(getIngredients()).map((k) => t.ingredientName(k));
    const titres = gen.slice(0, 600).map(([, r]) => t.recipeTitle(r.id));
    const liste = [
      'p',
      'po',
      'pou',
      'poulet',
      'poulet riz',
      'chevre',
      'lentilles corail',
      'zzz',
      'Crème',
      'ÉPINARDS',
      'oeuf',
      'vegan',
      'sans gluten',
      'a',
    ];
    for (const q of [...liste, ...requetes(46, 'full', titres, noms)]) {
      const o = {
        query: q,
        titleOf: (r) => t.recipeTitle(r.id),
        ingredientNameOf: (k) => t.ingredientName(k),
      };
      const attendu = trier(
        scoreRecipes(
          gen.map(([, r]) => r),
          o
        ).map((x) => ({ s: x.s, row: rowFromId(x.r.id) }))
      );
      const res = searchCatalog({ catalog: cat, lang: 'fr', ...o });
      expect(Array.from(res.refs).filter((v) => v >= 0)).toEqual(attendu);
    }
  }, 240000);

  test.each(['ja', 'th', 'ru'])(
    'langue sans espaces ou non latine (%s) : meme resultat que searchRecipes',
    (lang) => {
      utiliser(sourceMultilingue());
      const cat = getCatalog();
      const gen = toutes(cat);
      const titreDe = (r) => {
        const i = rowFromId(r.id);
        return {
          ja: `鶏肉のカレー${i % 7}`,
          th: `แกงไก่${i % 5} สูตร${i % 3}`,
          ru: `Курица с рисом ${i % 6} и овощами`,
        }[lang];
      };
      const requetesLang = {
        ja: ['鶏', '鶏肉', 'カレー', 'レー3', '鶏肉 カレー', 'xyz', '肉の'],
        th: ['แกง', 'ไก่1', 'สูตร', 'สูตร2', 'ไก่ สูตร', 'ก', 'พ'],
        ru: ['кур', 'рис', 'с', 'ри', 'курица рис', 'овощ', 'ов', 'zzz'],
      }[lang];
      for (const q of requetesLang) {
        const o = { query: q, titleOf: titreDe, ingredientNameOf: (k) => String(k) };
        const attendu = trier(
          scoreRecipes(
            gen.map(([, r]) => r),
            o
          ).map((x) => ({ s: x.s, row: rowFromId(x.r.id) }))
        );
        const res = searchCatalog({ catalog: cat, lang, ...o });
        expect(Array.from(res.refs).filter((v) => v >= 0)).toEqual(attendu);
      }
    }
  );

  test("repli sur le francais quand la langue n'a pas de titres", () => {
    const f = fixture();
    utiliser({ ...f, loaders: { ...f.loaders, LANGS: ['fr'] } }); // source francais seul
    const cat = getCatalog();
    const a = searchCatalog({ catalog: cat, lang: 'fr', query: 'poulet' });
    const b = searchCatalog({ catalog: cat, lang: 'de', query: 'poulet' });
    expect(Array.from(b.refs)).toEqual(Array.from(a.refs));
    expect(a.total).toBeGreaterThan(0);
  });
});

describe('filtres par colonnes', () => {
  test('memes cases que filterRecipes (course, etiquettes, temps, kcal, proteines, difficulte, saison, mois, exclusions, favoris)', () => {
    utiliser(reel());
    const cat = getCatalog();
    const gen = toutes(cat);
    const c = getCore();
    const favoris = new Set([
      'g-0',
      'g-5',
      'g-zz',
      'g-' + (c.N - 1).toString(36),
      'g-' + (c.N + 4).toString(36),
      'g-abc12345',
      'crepes-faciles',
      'g-05',
    ]);
    const cas = [
      {},
      { course: 'plat' },
      { course: 'dessert', tags: ['vegetarien'] },
      { course: 'inconnu' },
      { tags: ['vegan', 'sans-gluten'] },
      { tags: ['tag-inconnu'] },
      { maxTimeMin: 20 },
      { maxKcal: 400, minProtein: 20 },
      { maxDifficulty: 1 },
      { season: 'ete' },
      { season: 'hiver', tags: ['rapide'] },
      { month: 6 },
      { month: 0, course: 'plat' },
      { excludedIngredients: ['oignon', 'ail'] },
      { excludedIngredients: ['inconnu'] },
      { favoritesOnly: true, favorites: favoris },
      { favoritesOnly: true, favorites: [] },
      {
        course: 'plat',
        tags: ['enfants'],
        maxTimeMin: 30,
        excludedIngredients: ['champignon'],
        month: 3,
      },
    ];
    const objets = gen.map(([, r]) => r);
    for (const f of cas) {
      const attendu = filterRecipes(objets, f)
        .map((r) => rowFromId(r.id))
        .sort((a, b) => a - b);
      const mask = filterMask(c, f);
      const rows = [];
      for (let i = 0; i < c.N; i++) if (mask[i]) rows.push(i);
      expect(rows).toEqual(attendu);
    }
  }, 120000);

  test("recherche avec filtres : les filtres s'appliquent avant le texte", () => {
    utiliser(fixture());
    const cat = getCatalog();
    const res = searchCatalog({
      catalog: cat,
      lang: 'fr',
      query: 'a',
      filters: { course: 'dessert' },
    });
    for (const v of res.refs) {
      const r = v < 0 ? res.legacy[-v - 1] : cat.getRow(v);
      expect(r.course).toBe('dessert');
    }
  });
});

describe('pagination, fusion et ordre', () => {
  test('pages de 30 : aucune duplication, total correct, memes resultats que la liste complete', () => {
    utiliser(reel());
    const cat = getCatalog();
    const complet = searchCatalog({ catalog: cat, lang: 'fr', query: '' });
    expect(complet.total).toBe(complet.refs.length);
    expect(complet.total).toBe(cat.size);
    const vus = new Set();
    const concat = [];
    for (let off = 0; off < complet.total; off += 30) {
      const page = searchCatalog({ catalog: cat, lang: 'fr', query: '', limit: 30, offset: off });
      expect(page.total).toBe(complet.total);
      expect(page.refs.length).toBe(Math.min(30, complet.total - off));
      for (const v of page.refs) {
        const cle = v < 0 ? 'l' + (-v - 1) : 'g' + v;
        expect(vus.has(cle)).toBe(false);
        vus.add(cle);
        concat.push(v);
      }
    }
    expect(vus.size).toBe(complet.total);
    expect(concat).toEqual(Array.from(complet.refs));
    // au-dela de la fin
    const fin = searchCatalog({
      catalog: cat,
      lang: 'fr',
      query: '',
      limit: 30,
      offset: complet.total + 50,
    });
    expect(fin.refs.length).toBe(0);
  }, 60000);

  test("sans requete : recettes ecrites a la main d'abord, puis les cases ; melange stable par graine", () => {
    utiliser(reel());
    const cat = getCatalog();
    const n = cat.legacyCount;
    const a = searchCatalog({ catalog: cat, lang: 'fr', query: '' });
    expect(Array.from(a.refs.slice(0, n)).every((v) => v < 0)).toBe(true);
    expect(Array.from(a.refs.slice(n)).every((v) => v >= 0)).toBe(true);
    const s1 = searchCatalog({ catalog: cat, lang: 'fr', query: '', shuffleSeed: 7 });
    const s2 = searchCatalog({ catalog: cat, lang: 'fr', query: '', shuffleSeed: 7 });
    const s3 = searchCatalog({ catalog: cat, lang: 'fr', query: '', shuffleSeed: 8 });
    expect(Array.from(s2.refs)).toEqual(Array.from(s1.refs));
    expect(Array.from(s3.refs)).not.toEqual(Array.from(s1.refs));
    expect(Array.from(s1.refs.slice(0, n)).every((v) => v < 0)).toBe(true);
    expect(new Set(s1.refs).size).toBe(s1.refs.length);
    expect(
      Array.from(s1.refs)
        .slice(n)
        .sort((x, y) => x - y)
    ).toEqual(Array.from(a.refs).slice(n));
  });

  test('fusion avec les recettes personnelles : trouvees, par score', () => {
    utiliser(fixture());
    const perso = {
      id: 'my-poulet-maison',
      custom: true,
      servings: 4,
      timeMin: 25,
      tags: [],
      ingredients: [{ key: 'poulet-filet', qty: 300, unit: 'g' }],
    };
    const cat = getCatalog().withCustom([perso]);
    const t = getTexts('fr');
    const res = searchCatalog({
      catalog: cat,
      lang: 'fr',
      query: 'poulet',
      titleOf: (r) => (r.id === perso.id ? 'Poulet maison' : t.recipeTitle(r.id)),
      ingredientNameOf: (k) => t.ingredientName(k),
    });
    expect(res.legacy.some((r) => r.id === perso.id)).toBe(true);
    const objets = resultRecipes(res, cat);
    expect(objets.length).toBe(res.refs.length);
    expect(objets.map((r) => r.id)).toContain(perso.id);
    // meme ordre que searchRecipes sur le tableau des recettes ecrites a la main et personnelles
    const attendu = searchRecipes([...getRecipes(), perso], {
      query: 'poulet',
      titleOf: (r) => (r.id === perso.id ? 'Poulet maison' : t.recipeTitle(r.id)),
      ingredientNameOf: (k) => t.ingredientName(k),
    });
    expect(res.legacy.map((r) => r.id)).toEqual(attendu.map((r) => r.id));
  });

  test('catalogue degrade : seules les recettes ecrites a la main sont renvoyees', () => {
    utiliser({ meta: {}, hdr: {}, loaders: {} });
    const cat = getCatalog();
    const res = searchCatalog({ catalog: cat, lang: 'fr', query: 'poulet' });
    expect(Array.from(res.refs).every((v) => v < 0)).toBe(true);
    expect(res.total).toBe(res.legacy.length);
    const p = pantryCatalog({
      catalog: cat,
      ingredients: getIngredients(),
      have: ['poulet-filet', 'riz'],
    });
    expect(p.total).toBeGreaterThan(0);
  });
});

describe('mode frigo', () => {
  const sacs = [
    ['oeuf', 'tomate', 'riz', 'oignon'],
    ['poulet-filet', 'creme', 'champignon'],
    ['pates', 'tomate-concassee', 'basilic', 'ail'],
    ['lentilles', 'carotte', 'oignon', 'lardons'],
    ['saumon'],
    ['inconnu-total'],
    [],
  ];

  test('recettes ecrites a la main : identique a recipesByPantry (score, couverture, listes), 50 requetes', () => {
    utiliser({ meta: {}, hdr: {}, loaders: {} }); // catalogue degrade : seules les 474
    const cat = getCatalog();
    const ings = getIngredients();
    const legacy = getRecipes();
    const rng = createRng('frigo');
    const cles = Object.keys(ings);
    for (let q = 0; q < 50; q++) {
      const have =
        q < sacs.length
          ? sacs[q]
          : Array.from(
              { length: 1 + Math.floor(rng() * 8) },
              () => cles[Math.floor(rng() * cles.length)]
            );
      const toUseUp = have.filter(() => rng() < 0.3);
      const opts = {
        ingredients: ings,
        toUseUp,
        minCoverage: q % 3 ? undefined : 0.2,
        filters: q % 4 ? undefined : { maxTimeMin: 40 },
      };
      const attendu = recipesByPantry(legacy, have, opts);
      const res = pantryCatalog({ catalog: cat, have, ...opts });
      expect(res.total).toBe(attendu.length);
      expect(res.items.map((x) => ({ ...x, recipe: x.recipe.id }))).toEqual(
        attendu.map((x) => ({ ...x, recipe: x.recipe.id }))
      );
    }
  }, 60000);

  test('cases generees (fixture, 80 requetes) : memes cases, memes scores et listes', () => {
    utiliser(fixture());
    const cat = getCatalog();
    const gen = toutes(cat);
    const objets = gen.map(([, r]) => r);
    const ings = getIngredients();
    const rng = createRng('frigo-gen');
    const cles = Object.keys(ings);
    for (let q = 0; q < 80; q++) {
      const have = Array.from(
        { length: 1 + Math.floor(rng() * 10) },
        () => cles[Math.floor(rng() * cles.length)]
      );
      const toUseUp = have.filter(() => rng() < 0.3);
      const opts = { ingredients: ings, toUseUp, minCoverage: q % 3 ? undefined : 0.2 };
      const attendu = recipesByPantry(objets, have, opts)
        .map((x) => ({ ...x, row: rowFromId(x.recipe.id), recipe: undefined }))
        .sort((a, b) => b.score - a.score || a.row - b.row);
      const res = pantryCatalog({ catalog: cat, have, ...opts });
      const mien = res.items
        .filter((x) => x.recipe.generated)
        .map((x) => ({ ...x, row: rowFromId(x.recipe.id), recipe: undefined }));
      expect(mien).toEqual(attendu);
    }
  });

  test('catalogue complet : memes cases et memes scores (sacs types), pagination et fusion', () => {
    utiliser(reel());
    const cat = getCatalog();
    const gen = toutes(cat);
    const objets = gen.map(([, r]) => r);
    const ings = getIngredients();
    for (const have of sacs.slice(0, 4)) {
      const opts = { ingredients: ings, toUseUp: have.slice(0, 1) };
      const attendu = recipesByPantry(objets, have, opts)
        .map((x) => ({ ...x, row: rowFromId(x.recipe.id), recipe: undefined }))
        .sort((a, b) => b.score - a.score || a.row - b.row);
      const res = pantryCatalog({ catalog: cat, have, ...opts });
      const mien = res.items
        .filter((x) => x.recipe.generated)
        .map((x) => ({ ...x, row: rowFromId(x.recipe.id), recipe: undefined }));
      expect(mien).toEqual(attendu);
      expect(res.total).toBe(attendu.length + recipesByPantry(getRecipes(), have, opts).length);
      // scores decroissants sur la liste fusionnee
      for (let i = 1; i < res.items.length; i++)
        expect(res.items[i - 1].score).toBeGreaterThanOrEqual(res.items[i].score);
      // pages
      const p1 = pantryCatalog({ catalog: cat, have, ...opts, limit: 20, offset: 0 });
      const p2 = pantryCatalog({ catalog: cat, have, ...opts, limit: 20, offset: 20 });
      expect(p1.items.length).toBe(Math.min(20, res.total));
      expect([...p1.items, ...p2.items].map((x) => x.recipe.id)).toEqual(
        res.items.slice(0, 40).map((x) => x.recipe.id)
      );
    }
  }, 120000);
});

describe('textes', () => {
  test("les modules de recherche n'ajoutent aucun tiret long ni fleche", () => {
    const fs = require('fs');
    const path = require('path');
    for (const f of ['pool.js', 'searchIndex.js', 'planner.js', 'batch.js', 'search.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'menus', f), 'utf8');
      expect(DASH.test(src)).toBe(false);
    }
  });

  test('loadTitleBlock : le bloc garde son texte (titleBlockText)', () => {
    utiliser(fixture());
    expect(loadTitleBlock('fr', 0)).toBe(true);
    const { titleBlockText } = require('../lib/menus/packs');
    expect(typeof titleBlockText('fr', 0)).toBe('string');
    expect(titleBlockText('de', 0)).toBeNull();
  });
});
