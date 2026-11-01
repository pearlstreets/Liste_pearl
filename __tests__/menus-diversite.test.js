// Quasi-doublons dans la recherche (option diversify de searchCatalog) : a pertinence egale, les variantes d'un meme
// modele de titre et d'un meme ingredient principal passent a tour de role ; aucun resultat retire, scores dans l'ordre.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getCatalog, getTexts, resetMenusCache } from '../lib/menus/recipes';
import { searchCatalog, resetSearchIndex } from '../lib/menus/searchIndex';
import { scoreRecipes } from '../lib/menus/search';
import { getCore, rowFromId } from '../lib/menus/catalog';
import { norm } from '../lib/menus/util';

const reel = () => ({
  meta: require('../data/menus/gen/meta.js'),
  hdr: require('../data/menus/gen/hdr.js'),
  loaders: require('../data/menus/gen/loaders.js'),
});
const MARGE = process.env.CI ? 5 : 1;

let cat;
let t;
let c;
beforeAll(() => {
  resetMenusCache();
  resetGenSource();
  setGenSource(reel());
  cat = getCatalog();
  t = getTexts('fr');
  c = getCore();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

const base = () => ({
  catalog: cat,
  lang: 'fr',
  titleOf: (r) => t.recipeTitle(r.id),
  ingredientNameOf: (k) => t.ingredientName(k),
});
const gen = (res) => Array.from(res.refs).filter((v) => v >= 0);
const modele = (row) => norm(t.recipeTitle(cat.getRow(row).id)).split(' ')[0];
const principal = (row) => c.cols.main1[row];

// Sur les n premieres cases : paires voisines de meme modele ou de meme ingredient, et plus grande famille.
function mesureFamilles(rows, n = 30) {
  const r = rows.slice(0, n);
  let voisins = 0;
  let doublons = 0;
  const parModele = new Map();
  const parPrincipal = new Map();
  for (let i = 0; i < r.length; i++) {
    const m = modele(r[i]);
    const p = principal(r[i]);
    parModele.set(m, (parModele.get(m) || 0) + 1);
    parPrincipal.set(p, (parPrincipal.get(p) || 0) + 1);
    if (i > 0 && (m === modele(r[i - 1]) || p === principal(r[i - 1]))) voisins++;
    if (i > 0 && m === modele(r[i - 1]) && p === principal(r[i - 1])) doublons++;
  }
  return {
    voisins,
    doublons,
    maxModele: Math.max(...parModele.values()),
    maxPrincipal: Math.max(...parPrincipal.values()),
  };
}

const REQUETES = ['saumon fume', 'curry', 'epinards', 'poulet', 'quiche', 'veloute', 'p', 'tarte'];

describe('recherche diversifiee', () => {
  test("sans l'option : ordre inchange (meme ordre que scoreRecipes)", () => {
    const a = searchCatalog({ ...base(), query: 'curry' });
    const b = searchCatalog({ ...base(), query: 'curry', diversify: false });
    expect(Array.from(b.refs)).toEqual(Array.from(a.refs));
  });

  test.each(REQUETES)('%s : memes resultats, scores dans le meme ordre, rien de cache', (q) => {
    const a = searchCatalog({ ...base(), query: q });
    const d = searchCatalog({ ...base(), query: q, diversify: true });
    expect(d.total).toBe(a.total);
    expect(d.refs.length).toBe(a.refs.length);
    expect([...d.refs].sort((x, y) => x - y)).toEqual([...a.refs].sort((x, y) => x - y));
    expect(d.legacy.map((r) => r.id)).toEqual(a.legacy.map((r) => r.id));
    // le score de chaque position est le meme : seule la place dans un groupe de meme score change
    const scores = new Map(
      scoreRecipes(
        gen(a).map((row) => cat.getRow(row)),
        { query: q, titleOf: base().titleOf, ingredientNameOf: base().ingredientNameOf }
      ).map((x) => [rowFromId(x.r.id), x.s])
    );
    const sa = gen(a).map((row) => scores.get(row));
    const sd = gen(d).map((row) => scores.get(row));
    expect(sd).toEqual(sa);
  });

  test('pages de 30 : la concatenation redonne la liste complete diversifiee', () => {
    const complet = searchCatalog({ ...base(), query: 'saumon', diversify: true });
    const concat = [];
    for (let off = 0; off < complet.total; off += 30)
      concat.push(
        ...searchCatalog({ ...base(), query: 'saumon', diversify: true, limit: 30, offset: off })
          .refs
      );
    expect(concat).toEqual(Array.from(complet.refs));
  });

  test('moins de quasi-doublons voisins sur le premier ecran (avant / apres)', () => {
    const lignes = [];
    let avantV = 0;
    let apresV = 0;
    let avantD = 0;
    let apresD = 0;
    for (const q of REQUETES) {
      const av = mesureFamilles(gen(searchCatalog({ ...base(), query: q })));
      const ap = mesureFamilles(gen(searchCatalog({ ...base(), query: q, diversify: true })));
      avantV += av.voisins;
      apresV += ap.voisins;
      avantD += av.doublons;
      apresD += ap.doublons;
      lignes.push(
        `${q} : voisins meme modele ET meme ingredient ${av.doublons} / ${ap.doublons}, ` +
          `meme modele OU meme ingredient ${av.voisins} / ${ap.voisins}, ` +
          `plus grand modele ${av.maxModele} / ${ap.maxModele}, ` +
          `plus grand ingredient ${av.maxPrincipal} / ${ap.maxPrincipal} (sur 30)`
      );
      expect(ap.doublons).toBeLessThanOrEqual(av.doublons);
      expect(ap.voisins).toBeLessThanOrEqual(av.voisins);
      expect(ap.maxModele).toBeLessThanOrEqual(av.maxModele);
    }
    console.log(
      'avant / apres\n' +
        lignes.join('\n') +
        `\nTOTAL meme modele ET meme ingredient ${avantD} / ${apresD} ; OU ${avantV} / ${apresV}`
    );
    expect(apresD).toBeLessThan(avantD / 4);
    expect(apresV).toBeLessThan(avantV);
  });

  test('curry rouge, vert, jaune... de poulet et quiche, cake, tarte au saumon fume ne se suivent plus', () => {
    const d = gen(searchCatalog({ ...base(), query: 'saumon fume', diversify: true }));
    const titres = d.slice(0, 12).map((row) => t.recipeTitle(cat.getRow(row).id));
    // les 12 premieres cases n'ont pas deux fois de suite le meme modele de titre
    for (let i = 1; i < titres.length; i++)
      expect(norm(titres[i]).split(' ')[0]).not.toBe(norm(titres[i - 1]).split(' ')[0]);
  });

  test('cout par frappe : diversifier reste negligeable', () => {
    resetSearchIndex();
    const o = base();
    searchCatalog({ ...o, query: 'p', diversify: true }); // index de titres et des modeles
    const mots = ['p', 'po', 'pou', 'poulet', 'poulet riz', 'saumon', 'curry', 'epinards'];
    const mesure = (div) => {
      const tps = [];
      for (let k = 0; k < 3; k++)
        for (const q of mots) {
          const a = performance.now();
          searchCatalog({ ...o, query: q, limit: 30, diversify: div });
          tps.push(performance.now() - a);
        }
      tps.sort((x, y) => x - y);
      return { moy: tps.reduce((s, v) => s + v, 0) / tps.length, max: tps[tps.length - 1] };
    };
    mesure(false);
    const avant = mesure(false);
    const apres = mesure(true);
    console.log(
      `recherche par frappe : avant moy ${avant.moy.toFixed(1)} ms max ${avant.max.toFixed(1)} ms ; ` +
        `apres moy ${apres.moy.toFixed(1)} ms max ${apres.max.toFixed(1)} ms`
    );
    expect(apres.max).toBeLessThan(30 * MARGE);
  });
});
