// Noyau du catalogue genere (lib/menus/catalog.js, packs.js, recipes.js) : decodage, facade, packs, mode degrade.
// Les donnees de test sont la fixture de 50 recettes (data/menus/gen-fixture) et, pour les comptes et les mesures,
// les vraies donnees francaises (data/menus/gen).
import { readInt } from '../lib/menus/b64';
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import {
  isGeneratedId,
  rowFromId,
  idFromRow,
  initCatalog,
  peekCore,
  phraseGroups,
  catalogStatus,
  LRU_SIZE,
  MAX_PAGE,
} from '../lib/menus/catalog';
import { loadedPackLangs, noStepsText, untitledText } from '../lib/menus/packs';
import {
  getRecipes,
  getRecipe,
  getCatalog,
  getRecipeIndex,
  getTexts,
  getIngredients,
  getCatalogStatus,
  preloadMenusData,
  resetMenusCache,
} from '../lib/menus/recipes';
import { indexRecipes } from '../lib/menus/util';
import { dishFamily, dishProfile } from '../lib/menus/variety';
import { generatePlan } from '../lib/menus/planner';
import { buildShoppingList } from '../lib/menus/shopping';
import { prepDays } from '../lib/menus/reminders';
import { dayNutrition } from '../lib/menus/nutrition';

const MARGE = process.env.CI ? 5 : 1;
const DASH = /[—–→←⇒⇔↔]/;

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
const ingredients = require('../data/menus/ingredients.json');

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

// Decodage independant (relit les colonnes avec readInt, sans passer par le noyau).
function colonnes(src) {
  const col = {};
  for (const [nom, w] of src.meta.FIELDS) {
    col[nom] = new Array(src.meta.N);
    for (let i = 0; i < src.meta.N; i++) col[nom][i] = readInt(src.hdr[nom], i * w, w);
  }
  return col;
}

describe('aller-retour champ par champ', () => {
  test.each([
    ['fixture', fixture, null],
    ['donnees francaises', reel, 500],
  ])('%s', (_nom, mk, echantillon) => {
    const src = mk();
    utiliser(src);
    const cat = getCatalog();
    const col = colonnes(src);
    const m = src.meta;
    const ING = m.ING_KEYS.split('\n');
    const PAIRS = m.PAIRS.split('|');
    const phrases = src.loaders.phrases('fr').split('\n');
    const PM = m.PHRASE_META.split('|').map((x) => x.split(',').map(Number));
    expect(cat.rowCount).toBe(m.N);
    const pas = echantillon ? Math.max(1, Math.floor(m.N / echantillon)) : 1;
    let verifiees = 0;
    for (let i = 0; i < m.N; i += pas) {
      if (col.flags[i] & 4) {
        expect(cat.get(idFromRow(i))).toBeUndefined();
        continue;
      }
      const r = cat.materialize(i);
      expect(r.id).toBe(`g-${i.toString(36)}`);
      expect(r.generated).toBe(true);
      expect(r.course).toBe(m.COURSES[col.course[i]]);
      expect(r.sub).toBe(m.SUBS[col.sub[i]]);
      expect(r.servings).toBe(col.serv ? col.serv[i] : 4);
      expect(r.timeMin).toBe(col.time[i] * 5);
      expect(r.difficulty).toBe(col.diff[i] + 1);
      expect(r.kcal).toBe(col.kcal[i] * 10);
      expect(r.protein).toBe(col.prot[i]);
      expect(r.keepDays).toBe(col.keep[i]);
      expect(r.leftoverOk).toBe((col.flags[i] & 1) !== 0);
      expect(r.freezable).toBe((col.flags[i] & 2) !== 0);
      expect(r.tags).toEqual(m.TAGS.filter((_t, k) => Math.floor(col.tags[i] / 2 ** k) % 2 === 1));
      expect(r.ingredients).toHaveLength(col.nIng[i]);
      for (const l of r.ingredients) {
        expect(ingredients[l.key]).toBeDefined();
        expect(l.qty).toBeGreaterThan(0);
        expect(['g', 'ml', 'u', 'cs', 'cc']).toContain(l.unit);
      }
      expect(r.family).toBe(col.family[i] ? m.FAMILIES.split('\n')[col.family[i] - 1] : null);
      expect(r.dp.mains).toEqual(
        [col.main1[i], col.main2[i]].filter((x) => x > 0).map((x) => ING[x - 1])
      );
      expect(r.dp.main).toBe(r.dp.mains[0] || null);
      expect(cat.costPP(i)).toBe(col.cost[i] / 10);
      // lignes : relues independamment
      const bloc = Math.floor(i / m.SHARD);
      let debut = 0;
      for (let j = bloc * m.SHARD; j < i; j++) debut += col.nIng[j];
      const texte = src.loaders.lines(bloc);
      r.ingredients.forEach((l, k) => {
        const v = readInt(texte, (debut + k) * m.LINE_W, m.LINE_W);
        expect(l.key).toBe(ING[v & 511]);
        const [q, u] = PAIRS[(v >> 9) & ((1 << m.PAIR_BITS) - 1)].split(':');
        expect(l.qty).toBe(Number(q));
        expect(l.unit).toBe(u);
        expect(!!l.optional).toBe(((v >> (9 + m.PAIR_BITS)) & 1) === 1);
      });
      // minuteurs, genres et four : coherents avec le dictionnaire de phrases
      const nbEtapes = Object.keys(r.stepTimers).length;
      expect(nbEtapes).toBeLessThanOrEqual(col.nStep[i]);
      for (const [k, sec] of Object.entries(r.stepTimers)) {
        expect(Number(k)).toBeLessThan(col.nStep[i]);
        expect(sec % 60).toBe(0);
        expect(['four', 'feu', 'repos']).toContain(r.stepKinds[k]);
      }
      expect(
        r.ovenTempC === 0 || (r.ovenTempC >= 100 && r.ovenTempC <= 280 && r.ovenTempC % 10 === 0)
      ).toBe(true);
      expect(PM.length).toBe(phrases.length);
      verifiees++;
    }
    expect(verifiees).toBeGreaterThan(40);
  });

  test('les cles d ingredients suivent ingredients.json', () => {
    utiliser(fixture());
    expect(getCatalog().ingredientKeys).toEqual(Object.keys(ingredients));
    utiliser(reel());
    expect(getCatalog().ingredientKeys).toEqual(Object.keys(ingredients));
  });
});

describe('identifiants', () => {
  test('forme et reversibilite', () => {
    expect(isGeneratedId('g-0')).toBe(true);
    expect(isGeneratedId('g-9ix')).toBe(true);
    expect(isGeneratedId('my-abc')).toBe(false);
    expect(isGeneratedId('poulet-roti')).toBe(false);
    expect(isGeneratedId(null)).toBe(false);
    for (const c of [0, 1, 35, 36, 1295, 11580]) expect(rowFromId(idFromRow(c))).toBe(c);
    for (const bad of [
      'g-',
      'g-01',
      'g-00',
      'g-A',
      'g--1',
      'g-1.5',
      'g-zzzzzzzzzz',
      'g_1',
      5,
      undefined,
    ])
      expect(rowFromId(bad)).toBe(-1);
  });

  test('resolution : generee, inconnue, hors plage, ancien identifiant', () => {
    utiliser(fixture());
    const cat = getCatalog();
    const n = cat.rowCount;
    expect(cat.get('g-0').id).toBe('g-0');
    expect(cat.has(idFromRow(n - 1))).toBe(true);
    expect(cat.has(idFromRow(n))).toBe(false);
    expect(cat.get('g-zzzz')).toBeUndefined();
    expect(cat.get('g-01')).toBeUndefined();
    expect(cat.get(undefined)).toBeUndefined();
    const vieux = getRecipes()[0];
    expect(cat.get(vieux.id)).toBe(vieux);
    expect(getRecipe(vieux.id)).toBe(vieux);
    expect(getRecipe('g-1').id).toBe('g-1');
    expect(getRecipe('zzz')).toBeNull();
    expect(cat.size).toBe(getRecipes().length + n);
  });

  test('une case retiree n existe plus (get, has, taille, titre)', () => {
    const base = fixture();
    const flags = base.hdr.flags.split('');
    const w = base.meta.FIELDS.find((f) => f[0] === 'flags')[1];
    expect(w).toBe(1);
    const v = readInt(base.hdr.flags, 3, 1);
    flags[3] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[v | 4];
    const src = { ...base, hdr: { ...base.hdr, flags: flags.join('') } };
    utiliser(src);
    const cat = getCatalog();
    expect(cat.has('g-3')).toBe(false);
    expect(cat.get('g-3')).toBeUndefined();
    expect(cat.rowOf('g-3')).toBe(-1);
    expect(cat.getRow(3)).toBeNull();
    expect(cat.size).toBe(getRecipes().length + base.meta.N - 1);
    expect(cat.rows(0, 10)).not.toContain(3);
    expect(getTexts('fr').recipeTitle('g-3')).toBe('Recette');
    expect(getTexts('fr').recipeSteps('g-3')).toEqual([]);
  });
});

describe('facade', () => {
  test('values ne renvoie jamais les generees, pas d iteration complete, pages bornees', () => {
    utiliser(reel());
    const cat = getCatalog();
    const vals = cat.values();
    expect(vals).toHaveLength(getRecipes().length);
    expect(vals.some((r) => r.generated)).toBe(false);
    expect(cat[Symbol.iterator]).toBeUndefined();
    expect(cat.rows(0, 100000)).toHaveLength(MAX_PAGE);
    expect(cat.rows(cat.rowCount - 3, 100)).toHaveLength(3);
    expect(cat.rows(-5, 'x')).toEqual([]);
    expect(peekCore().lru.size).toBe(0);
  });

  test('init ne cree aucun objet recette ; le cache est borne a 300 et rend le meme objet', () => {
    utiliser(reel());
    initCatalog();
    expect(peekCore().lru.size).toBe(0);
    const cat = getCatalog();
    const a = cat.getRow(10);
    expect(cat.getRow(10)).toBe(a);
    for (let i = 0; i < LRU_SIZE + 150; i++) cat.getRow(20 + i);
    expect(peekCore().lru.size).toBe(LRU_SIZE);
    expect(cat.getRow(10)).not.toBe(a); // sorti du cache, reconstruit a l identique
    expect(cat.getRow(10)).toEqual(a);
  });

  test('recettes personnelles : prioritaires, comptees, facade partagee sans extra', () => {
    utiliser(fixture());
    const base = getCatalog();
    expect(getRecipeIndex()).toBe(base);
    expect(getRecipeIndex({ extra: [] })).toBe(base);
    const perso = {
      id: 'my-1',
      title: 'Mon plat',
      ingredients: [{ key: 'sel', qty: 1, unit: 'g' }],
    };
    const idx = getRecipeIndex({ extra: [perso, null, { id: 5 }, 'x'] });
    expect(idx.get('my-1')).toBe(perso);
    expect(idx.has('my-1')).toBe(true);
    expect(base.has('my-1')).toBe(false);
    expect(idx.size).toBe(base.size + 1);
    expect(idx.values()).toHaveLength(getRecipes().length + 1);
    const vieux = getRecipes()[0];
    const remplace = { ...vieux, kcal: 1 };
    expect(getRecipeIndex({ extra: [remplace] }).get(vieux.id)).toBe(remplace);
    expect(getRecipeIndex({ extra: [remplace] }).size).toBe(base.size);
  });

  test('indexRecipes accepte la facade telle quelle, et garde Map, tableau, objet', () => {
    utiliser(fixture());
    const cat = getCatalog();
    expect(indexRecipes(cat)).toBe(cat);
    const m = new Map([['a', { id: 'a' }]]);
    expect(indexRecipes(m)).toBe(m);
    expect(indexRecipes([{ id: 'a' }, null, { id: 'b' }]).size).toBe(2);
    expect(indexRecipes({ x: { id: 'x' } }).get('x').id).toBe('x');
    expect(indexRecipes(null).size).toBe(0);
  });

  test('famille et profil de variete des recettes generees', () => {
    utiliser(fixture());
    const cat = getCatalog();
    let avecFamille = 0;
    for (const i of cat.rows(0, 50)) {
      const r = cat.getRow(i);
      expect(dishFamily(r)).toBe(r.family);
      expect(dishProfile(r, ingredients)).toBe(r.dp);
      if (r.family) avecFamille++;
    }
    expect(avecFamille).toBeGreaterThan(5);
    // les recettes ecrites a la main gardent la regle sur l identifiant
    expect(dishFamily({ id: 'gratin-dauphinois', ingredients: [] })).toBe('gratin');
    expect(dishFamily({ id: 'g-5', generated: true })).toBeNull();
    expect(
      dishProfile(
        { id: 'poulet-roti', ingredients: [{ key: 'cuisse-poulet', qty: 1000, unit: 'g' }] },
        ingredients
      ).main
    ).toBe('cuisse-poulet');
  });
});

describe('mode degrade : le catalogue ne leve jamais', () => {
  const verifier = (raison) => {
    const cat = getCatalog();
    expect(() => initCatalog()).not.toThrow();
    expect(catalogStatus().status).toBe('degraded');
    expect(getCatalogStatus()).toBe('degraded');
    if (raison) expect(catalogStatus().reason).toContain(raison);
    expect(cat.get('g-0')).toBeUndefined();
    expect(cat.has('g-0')).toBe(false);
    expect(cat.size).toBe(getRecipes().length);
    expect(cat.values()).toHaveLength(getRecipes().length);
    expect(cat.rows(0, 10)).toEqual([]);
    expect(cat.column('kcal')).toBeNull();
    expect(getTexts('fr').recipeTitle('g-0')).toBe('Recette');
    expect(getTexts('fr').recipeSteps('g-0')).toEqual([]);
    const vieux = getRecipes()[0];
    expect(cat.get(vieux.id)).toBe(vieux);
    expect(getTexts('fr').recipeTitle(vieux.id)).toBeTruthy();
  };

  test.each([
    ['source absente', () => ({}), 'source absente'],
    [
      'colonne tronquee',
      () => {
        const s = fixture();
        return { ...s, hdr: { ...s.hdr, kcal: s.hdr.kcal.slice(0, -2) } };
      },
      'tronquee',
    ],
    [
      'caractere invalide',
      () => {
        const s = fixture();
        return { ...s, hdr: { ...s.hdr, time: '!' + s.hdr.time.slice(1) } };
      },
      'invalide',
    ],
    [
      'N incoherent',
      () => {
        const s = fixture();
        return { ...s, meta: { ...s.meta, N: s.meta.N + 1 } };
      },
      'tronquee',
    ],
    [
      'version inconnue',
      () => {
        const s = fixture();
        return { ...s, meta: { ...s.meta, VERSION: 2 } };
      },
      'version',
    ],
    [
      'champ manquant',
      () => {
        const s = fixture();
        return { ...s, meta: { ...s.meta, FIELDS: s.meta.FIELDS.filter((f) => f[0] !== 'cost') } };
      },
      'manquant',
    ],
    [
      'ING_KEYS vide',
      () => {
        const s = fixture();
        return { ...s, meta: { ...s.meta, ING_KEYS: '' } };
      },
      'ING_KEYS',
    ],
    [
      'PAIRS invalide',
      () => {
        const s = fixture();
        return { ...s, meta: { ...s.meta, PAIRS: 'abc' } };
      },
      'PAIRS',
    ],
    [
      'blocs incoherents',
      () => {
        const s = fixture();
        return { ...s, loaders: { ...s.loaders, NB_BLOCS: 9 } };
      },
      'blocs',
    ],
  ])('%s', (_nom, mk, raison) => {
    utiliser(mk());
    verifier(raison);
  });

  test('module de donnees qui leve (require impossible)', () => {
    utiliser({
      ...fixture(),
      loaders: {
        ...fixture().loaders,
        lines: () => {
          throw new Error('absent');
        },
      },
    });
    const cat = getCatalog();
    expect(cat.get('g-1')).toBeUndefined();
    expect(catalogStatus().status).toBe('degraded');
    expect(cat.has('g-1')).toBe(false);
  });

  test('bloc de lignes tronque : degrade a la premiere lecture', () => {
    const s = fixture();
    utiliser({ ...s, loaders: { ...s.loaders, lines: (k) => s.loaders.lines(k).slice(0, -3) } });
    const cat = getCatalog();
    expect(catalogStatus().status === 'degraded').toBe(false);
    expect(cat.get('g-1')).toBeUndefined();
    expect(catalogStatus().status).toBe('degraded');
    expect(cat.has('g-2')).toBe(false);
  });

  test('titres francais incoherents : degrade', () => {
    const s = fixture();
    utiliser({
      ...s,
      loaders: {
        ...s.loaders,
        titles: (l, k) => s.loaders.titles(l, k).split('\n').slice(0, -1).join('\n'),
      },
    });
    expect(getTexts('fr').recipeTitle('g-1')).toBe('Recette');
    expect(catalogStatus().status).toBe('degraded');
  });

  test('preloadMenusData ne rejette jamais et rend degrade', async () => {
    utiliser({});
    const r = await preloadMenusData('fr');
    expect(r.status).toBe('degraded');
  });
});

describe('packs de titres et de phrases', () => {
  test('francais : un titre par case, jamais d identifiant, ni tiret long ni fleche', () => {
    const s = fixture();
    utiliser(s);
    const fr = getTexts('fr');
    const lignes = s.loaders.titles('fr', 0).split('\n');
    expect(lignes).toHaveLength(s.meta.N);
    lignes.forEach((t, i) => {
      expect(fr.recipeTitle(`g-${i.toString(36)}`)).toBe(t);
      expect(DASH.test(t)).toBe(false);
    });
  });

  test('etapes : phrases d une meme etape reunies, autant d etapes que de la colonne', () => {
    const s = fixture();
    utiliser(s);
    const cat = getCatalog();
    const fr = getTexts('fr');
    const nStep = colonnes(s).nStep;
    const phrases = s.loaders.phrases('fr').split('\n');
    for (let i = 0; i < s.meta.N; i++) {
      const etapes = fr.recipeSteps(`g-${i.toString(36)}`);
      expect(etapes).toHaveLength(nStep[i]);
      for (const e of etapes) {
        expect(e.trim()).not.toBe('');
        expect(DASH.test(e)).toBe(false);
      }
    }
    // premiere etape de la case 0 : formee de phrases du dictionnaire
    const e0 = fr.recipeSteps('g-0')[0];
    expect(phrases.some((p) => e0.startsWith(p))).toBe(true);
    expect(cat.get('g-0').stepTimers).toBeDefined();
  });

  test('langue sans pack : repli sur le francais, "Recette" localise pour une case inconnue', () => {
    const f = fixture();
    utiliser({ ...f, loaders: { ...f.loaders, LANGS: ['fr'] } }); // source francais seul : les autres langues n'ont pas de pack
    const fr = getTexts('fr');
    expect(getTexts('de').recipeTitle('g-2')).toBe(fr.recipeTitle('g-2'));
    expect(getTexts('de').recipeSteps('g-2')).toEqual(fr.recipeSteps('g-2'));
    expect(getTexts('ja').recipeTitle('g-zzzz')).toBe('レシピ');
    expect(getTexts('ru').recipeTitle('g-zzzz')).toBe('Рецепт');
    expect(getTexts('en').recipeTitle('g-9999')).toBe('Recipe');
    expect(getTexts('klingon').recipeTitle('g-9999')).toBe('Recette');
    expect(getTexts('de').recipeTitle('plat-inconnu')).toBe('plat inconnu');
    expect(getTexts('de').recipeSteps('plat-inconnu')).toEqual([]);
  });

  function sourceAvecAnglais({ trou } = {}) {
    const s = fixture();
    const appels = { titres: [], phrases: [] };
    const fr = (k) => s.loaders.titles('fr', k);
    const loaders = {
      ...s.loaders,
      LANGS: ['fr', 'en'],
      titles: (l, k) => {
        appels.titres.push(l);
        if (l === 'en')
          return fr(k)
            .split('\n')
            .map((t, i) => (i === trou ? '' : `EN ${t}`))
            .join('\n');
        return fr(k);
      },
      phrases: (l) => {
        appels.phrases.push(l);
        const p = s.loaders.phrases('fr').split('\n');
        return (l === 'en' ? p.map((t, i) => (i === 0 ? '' : `EN ${t}`)) : p).join('\n');
      },
    };
    return { src: { ...s, loaders }, appels };
  }

  test('titres : langue, puis francais lu seulement au premier manque', () => {
    const { src, appels } = sourceAvecAnglais({ trou: 4 });
    utiliser(src);
    const en = getTexts('en');
    expect(en.recipeTitle('g-1')).toMatch(/^EN /);
    expect(appels.titres.includes('fr')).toBe(false);
    expect(en.recipeTitle('g-4')).toBe(getTexts('fr').recipeTitle('g-4'));
    expect(appels.titres.includes('fr')).toBe(true);
    expect(en.recipeTitle('g-4')).not.toMatch(/^EN /);
  });

  test('phrases : repli phrase par phrase, francais lu au premier manque seulement', () => {
    const { src, appels } = sourceAvecAnglais();
    utiliser(src);
    const c = peekCore() || (initCatalog(), peekCore());
    const utilise0 = (row) => phraseGroups(c, row).flat().includes(0);
    const rows = getCatalog().rows(0, 50);
    const sans = rows.find((r) => !utilise0(r));
    const avec = rows.find((r) => utilise0(r));
    expect(sans).toBeDefined();
    expect(avec).toBeDefined();
    const en = getTexts('en');
    const etapesSans = en.recipeSteps(idFromRow(sans));
    expect(etapesSans.every((e) => e.includes('EN '))).toBe(true);
    expect(appels.phrases.includes('fr')).toBe(false);
    const etapesAvec = en.recipeSteps(idFromRow(avec)).join(' ');
    expect(appels.phrases.includes('fr')).toBe(true);
    const phrase0 = fixture().loaders.phrases('fr').split('\n')[0];
    expect(etapesAvec).toContain(phrase0);
    expect(DASH.test(etapesAvec)).toBe(false);
  });

  test('recette sans aucune phrase lisible : texte "etapes indisponibles" localise', () => {
    const s = fixture();
    const vides = s.loaders
      .phrases('fr')
      .split('\n')
      .map(() => '')
      .join('\n');
    utiliser({ ...s, loaders: { ...s.loaders, phrases: () => vides } });
    expect(getTexts('fr').recipeSteps('g-0')).toEqual(['Étapes indisponibles.']);
    expect(getTexts('ja').recipeSteps('g-0')).toEqual(['手順は利用できません。']);
    expect(getTexts('fr').recipeSteps('g-zzzz')).toEqual([]);
    for (const l of [
      'fr',
      'en',
      'de',
      'es',
      'it',
      'pt',
      'nl',
      'ru',
      'zh',
      'ja',
      'ar',
      'sv',
      'th',
    ]) {
      expect(DASH.test(noStepsText(l) + untitledText(l))).toBe(false);
      expect(noStepsText(l).length).toBeGreaterThan(3);
      expect(untitledText(l).length).toBeGreaterThan(1);
    }
  });

  test('changement de langue : preload libere l ancien pack', async () => {
    const { src } = sourceAvecAnglais();
    utiliser(src);
    await preloadMenusData('en', { background: false });
    expect(loadedPackLangs().titles).toContain('en');
    await preloadMenusData('fr', { background: false });
    expect(loadedPackLangs().titles).not.toContain('en');
    expect(loadedPackLangs().titles).toContain('fr');
  });
});

describe('preloadMenusData', () => {
  test('tranches courtes avec rendu de la main, memoisee, ready', async () => {
    utiliser(fixture());
    let rendus = 0;
    const p = preloadMenusData('fr', {
      yieldFn: async () => {
        rendus++;
      },
      background: false,
    });
    expect(preloadMenusData('fr')).toBe(p);
    const r = await p;
    expect(r.status).toBe('ready');
    expect(r.lang).toBe('fr');
    expect(rendus).toBeGreaterThanOrEqual(4);
    expect(r.slices.length).toBeGreaterThanOrEqual(5);
    expect(r.maxSliceMs).toBeLessThan(50 * MARGE);
    expect(getCatalogStatus()).toBe('ready');
    expect(getIngredients().sel).toBeDefined();
  });

  test('langue inconnue : normalisee, jamais d exception', async () => {
    utiliser(fixture());
    const r = await preloadMenusData('xx-YY', { background: false });
    expect(r.lang).toBe('fr');
    expect(r.status).toBe('ready');
  });

  test('mesures sur les vraies donnees francaises', async () => {
    utiliser(reel());
    const r = await preloadMenusData('fr', { background: false });
    expect(r.status).toBe('ready');
    const det = Object.fromEntries(r.slices.map((x) => [x.label, +x.ms.toFixed(1)]));
    console.log(
      `preload fr : total ${r.ms.toFixed(1)} ms, plus longue tranche ${r.maxSliceMs.toFixed(1)} ms`,
      JSON.stringify(det)
    );
    expect(r.maxSliceMs).toBeLessThan(40 * MARGE);
    const cat = getCatalog();
    const a = performance.now();
    const t = getTexts('fr').recipeTitle('g-1k');
    const s = getTexts('fr').recipeSteps('g-1k');
    const first = performance.now() - a;
    console.log(`premier titre + etapes (phrases a froid) : ${first.toFixed(1)} ms`);
    expect(t).not.toBe('Recette');
    expect(s.length).toBeGreaterThan(2);
    expect(first).toBeLessThan(30 * MARGE);
    const b = performance.now();
    for (let i = 0; i < 1000; i++) cat.materialize(i * 11);
    const per = (performance.now() - b) / 1000;
    console.log(`reconstitution d une recette : ${(per * 1000).toFixed(0)} us`);
    expect(per).toBeLessThan(0.5 * MARGE);
  });

  test('initCatalog a froid sur les vraies donnees', () => {
    utiliser(reel());
    const a = performance.now();
    initCatalog();
    const ms = performance.now() - a;
    console.log(`initCatalog (${peekCore().N} cases) : ${ms.toFixed(1)} ms`);
    expect(catalogStatus().status).toBe('ready');
    expect(ms).toBeLessThan(30 * MARGE);
  });

  test('tas ajoute par le catalogue et le pack francais', () => {
    utiliser(reel());
    const heap = () => process.memoryUsage().heapUsed;
    if (typeof global.gc === 'function') global.gc();
    const avant = heap();
    initCatalog();
    getTexts('fr').recipeTitle('g-1');
    getTexts('fr').recipeSteps('g-1');
    const apres = heap();
    console.log(`tas ajoute (jest, sans gc force) : ${((apres - avant) / 1048576).toFixed(1)} Mo`);
    expect(apres - avant).toBeLessThan(6 * 1048576 * 3); // plafond large : les modules de chaines sont comptes ici
  });
});

describe('compatibilite avec les algorithmes existants', () => {
  const profil = { adults: 2, children: 0 };
  const ings = () => getIngredients();

  test('generatePlan : la facade donne le meme plan que le tableau des memes recettes', () => {
    utiliser(fixture());
    const facade = getRecipeIndex({ extra: [] });
    // Profil restrictif : le catalogue admis tient dans la liste courte, qui est alors tout le catalogue.
    const profilVegan = { adults: 2, children: 0, diets: ['vegan'] };
    const generees = [];
    for (let i = 0; i < facade.rowCount; i++) {
      const r = facade.materialize(i);
      // Les accompagnements ne sont pas des plats pour le planificateur (course entree dans la conception).
      if (r) generees.push(r.sub === 'accompagnements' ? { ...r, course: 'entree' } : r);
    }
    const tableau = [...getRecipes(), ...generees];
    const args = { ingredients: ings(), profile: profilVegan, seed: 7, weekStart: '2026-11-02' };
    const a = generatePlan({ ...args, recipes: tableau });
    const b = generatePlan({ ...args, recipes: facade });
    expect(b.meals.map((m) => m.recipeId)).toEqual(a.meals.map((m) => m.recipeId));
    // Profil large : la facade planifie aussi des recettes generees, de facon deterministe.
    const large = { ...args, profile: profil, recipes: facade };
    expect(generatePlan(large).meals.map((m) => m.recipeId)).toEqual(
      generatePlan(large).meals.map((m) => m.recipeId)
    );
  });

  test('liste de courses, nutrition, rappels : recette generee resolue ; id g- inconnu sans exception', () => {
    utiliser(fixture());
    const idx = getRecipeIndex({ extra: [] });
    const plan = {
      weekStart: '2099-01-05',
      meals: [
        { key: '0-midi', day: 0, slot: 'midi', recipeId: 'g-2', persons: 4 },
        { key: '1-midi', day: 1, slot: 'midi', recipeId: 'g-zzzz', persons: 2 },
        { key: '2-midi', day: 2, slot: 'midi', recipeId: 'g-3', persons: 2 },
      ],
    };
    const sh = buildShoppingList({ plan, recipes: idx, ingredients: ings(), profile: profil });
    expect(sh.lines.length).toBeGreaterThan(0);
    expect(sh.missingRecipes).toContain('g-zzzz');
    expect(sh.missingRecipes).not.toContain('g-2');
    expect(() => dayNutrition(plan, idx)).not.toThrow();
    expect(() =>
      prepDays({ plan, recipeById: idx, ingredients: ings(), now: new Date('2098-12-01') })
    ).not.toThrow();
    expect(idx.get('g-zzzz')).toBeUndefined();
    // sans le catalogue (tableau seul), les memes repas sont signales manquants, sans exception
    const sh2 = buildShoppingList({
      plan,
      recipes: getRecipes(),
      ingredients: ings(),
      profile: profil,
    });
    expect(sh2.missingRecipes).toContain('g-2');
  });
});
