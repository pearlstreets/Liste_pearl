// Menus x Pearl Streets : règle de correspondance, prix réels, cache partagé, restaurants autour.
const mockEmitter = new (require('events').EventEmitter)();
jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    emit: (...a) => mockEmitter.emit(...a),
    addListener: (e, f) => {
      mockEmitter.on(e, f);
      return { remove: () => mockEmitter.off(e, f) };
    },
  },
}));
jest.mock('../services/products', () => ({ getShopsByCategory: jest.fn() }));

import fs from 'fs';
import path from 'path';
import { getShopsByCategory } from '../services/products';
import { matchProduct, matchProducts, nameMatches, norm } from '../lib/matchProduct';
import { ingredientQueries, matchLines, nearbyShops, cleanName } from '../lib/menus/pearl';
import { loadShops, peekShops, resetShopsCache, subscribeShops, TTL_MS } from '../lib/shopsCache';
import { requestOpenShop, takePendingShop, onOpenShop } from '../lib/openShop';
import { toListItems } from '../lib/menus/shopping';
import { getTexts } from '../lib/menus/recipes';

const P = (id, name, price, extra = {}) => ({ id, name, price, ...extra });
const shop = (id, name, products, extra = {}) => ({ id, name, address: '', products, ...extra });

// Règle d'origine de buildInventory (App.js), recopiée pour prouver l'équivalence.
const ancienne = (itemName, products) =>
  (products || []).find((p) => {
    const inm = norm(itemName);
    const pn = norm(p.name);
    if (!pn || !inm) return false;
    if (pn === inm) return true;
    const ptok = pn.split(/\s+/).filter(Boolean);
    const itok = inm.split(/\s+/).filter(Boolean);
    if (itok.length >= 2 && itok.every((w) => ptok.includes(w))) return true;
    if (itok.length === 1 && inm.length >= 6 && ptok.includes(inm)) return true;
    return false;
  });

describe('matchProduct : même règle que App.js', () => {
  const prods = [
    P(1, 'Eau de parfum'),
    P(2, 'Pain au chocolat'),
    P(3, 'Baguette tradition'),
    P(4, 'Pâtes torsades bio'),
    P(5, 'Filet de poulet fermier'),
    P(6, 'Eau'),
    P(7, 'Oignons jaunes'),
    P(8, 'Œufs frais'),
  ];
  const noms = ['eau', 'pain', 'baguette', 'Baguette', 'pates', 'poulet filet', 'filet de poulet', 'oignons', 'oignon', 'oeufs', 'Eau', '', '  ', 'tradition baguette', 'torsades'];
  test.each(noms)('identique à l\'ancienne règle pour %p', (n) => {
    expect(matchProduct(n, prods)).toBe(ancienne(n, prods));
  });
  test('mot court : seulement en égalité exacte', () => {
    expect(matchProduct('eau', prods).id).toBe(6);
    expect(matchProduct('pain', prods)).toBeUndefined();
  });
  test('plusieurs noms : le premier qui trouve gagne, ordre respecté', () => {
    expect(matchProduct(['blanc de poulet', 'filet de poulet'], prods).id).toBe(5);
    expect(matchProduct(['rien', 'oignons'], prods).id).toBe(7);
    expect(matchProduct([], prods)).toBeUndefined();
  });
  test('matchProducts et nameMatches', () => {
    expect(matchProducts(['oignons', 'eau'], prods).map((p) => p.id)).toEqual([6, 7]);
    expect(nameMatches('filet de poulet', 'Filet de poulet fermier')).toBe(true);
    expect(nameMatches('pain', 'Pain au chocolat')).toBe(false);
  });
  test('App.js utilise la fonction partagée', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
    expect(app).toMatch(/from "\.\/lib\/matchProduct"/);
    expect(app).toMatch(/matchProduct\(/);
    expect(app).toMatch(/loadShops\('product_purchase'/);
  });
});

describe('noms français et synonymes', () => {
  test('nom français nettoyé', () => {
    expect(cleanName('Ail (gousse)')).toBe('ail');
    expect(cleanName('Œuf')).toBe('oeuf');
    expect(cleanName("Huile d'olive")).toBe('huile d olive');
  });
  test('poulet / filet de poulet', () => {
    const q = ingredientQueries('poulet-filet', 'Filet de poulet');
    expect(q[0]).toBe('filet de poulet');
    expect(q).toContain('blanc de poulet');
    expect(q).not.toContain('poulet');
  });
  test('pluriel simple et ligature', () => {
    expect(ingredientQueries('oeuf', 'Œuf')).toEqual(expect.arrayContaining(['oeuf', 'oeufs']));
    expect(ingredientQueries('oignon', 'Oignon')).toContain('oignons');
  });
  test('le nom vient du français quelle que soit la langue affichée', () => {
    const fr = getTexts('fr');
    const en = getTexts('en');
    expect(en.ingredientName('poulet-filet')).not.toBe(fr.ingredientName('poulet-filet'));
    expect(ingredientQueries('poulet-filet', fr.ingredientName('poulet-filet'))[0]).toBe('filet de poulet');
  });
  test('toutes les clés d\'ingrédient donnent au moins une requête', () => {
    const fr = require('../data/menus/i18n/fr.json').ingredients;
    for (const [k, v] of Object.entries(fr)) expect(ingredientQueries(k, v).length).toBeGreaterThan(0);
  });
});

describe('matchLines : prix réels, jamais inventés', () => {
  const fr = (k) => getTexts('fr').ingredientName(k);
  const lines = [
    { key: 'poulet-filet', packs: 2 },
    { key: 'oignon', packs: 1 },
    { key: 'riz', packs: 1 },
    { key: 'curcuma', packs: 1 },
  ];
  const shops = [
    shop(1, 'Primeur A', [P(11, 'Oignons jaunes', 1.5), P(12, 'Riz basmati', 2.9), P(13, 'Pommes', 2)]),
    shop(2, 'Boucherie B', [P(21, 'Filet de poulet fermier', 8.9), P(22, 'Oignon', 1.2), P(23, 'Blanc de poulet', 9.5)]),
    shop(3, 'Resto C', [P(31, 'Filet de poulet sur place', 5, { surPlaceSeul: true }), P(32, 'Oignon rouge', 0)]),
  ];
  const r = matchLines(lines, shops, fr);
  test('par ligne : nombre de boutiques et prix le plus bas', () => {
    expect(r.byKey.oignon.count).toBe(2);
    expect(r.byKey.oignon.min).toBe(1.2);
    expect(r.byKey['poulet-filet'].count).toBe(1);
    expect(r.byKey['poulet-filet'].min).toBe(8.9);
  });
  test('plat au seul sur place et prix nul exclus', () => {
    expect(r.byKey['poulet-filet'].offers.map((o) => o.shop.id)).toEqual([2]);
    expect(r.byKey.oignon.offers.some((o) => o.shop.id === 3)).toBe(false);
  });
  test('sans correspondance : rien d\'inventé', () => {
    expect(r.byKey.curcuma).toBeUndefined();
    expect(r.byKey.riz).toBeUndefined(); // "riz" trop court pour un produit "Riz basmati"
    expect(r.covered).toEqual(['poulet-filet', 'oignon']);
  });
  test('total réel = paquets x prix le plus bas, seulement sur les articles trouvés', () => {
    expect(r.totalReal).toBe(Math.round((2 * 8.9 + 1.2) * 100) / 100);
  });
  test('boutiques qui couvrent le plus', () => {
    expect(r.best[0].shop.id).toBe(2);
    expect(r.best[0].count).toBe(2);
    expect(r.best[1].shop.id).toBe(1);
  });
  test('catalogue absent, vide ou hors ligne : résultat vide sans erreur', () => {
    for (const s of [null, undefined, [], [shop(9, 'X', [])], 'x']) {
      const e = matchLines(lines, s, fr);
      expect(e.covered).toEqual([]);
      expect(e.totalReal).toBe(0);
      expect(e.best).toEqual([]);
    }
    expect(matchLines([], shops, fr).covered).toEqual([]);
    expect(matchLines(null, shops, fr).covered).toEqual([]);
  });
  test('la langue d\'affichage ne change rien : on part toujours du nom français', () => {
    const viaEn = matchLines(lines, shops, (k) => fr(k));
    expect(viaEn.covered).toEqual(r.covered);
  });
});

describe('cache partagé des boutiques', () => {
  beforeEach(() => {
    resetShopsCache();
    getShopsByCategory.mockReset();
  });
  const data = [shop(1, 'A', [P(1, 'Oignon', 1)])];
  test('une seule requête pour plusieurs demandes simultanées', async () => {
    getShopsByCategory.mockResolvedValue(data);
    const [a, b, c] = await Promise.all([loadShops('product_purchase'), loadShops('product_purchase'), loadShops('product_purchase', { timeoutMs: 5000 })]);
    expect(getShopsByCategory).toHaveBeenCalledTimes(1);
    expect(a).toBe(data);
    expect(b).toBe(data);
    expect(c).toBe(data);
    await loadShops('product_purchase');
    expect(getShopsByCategory).toHaveBeenCalledTimes(1); // données récentes : aucune requête
    expect(peekShops('product_purchase')).toBe(data);
  });
  test('force relit ; catégories séparées', async () => {
    getShopsByCategory.mockResolvedValue(data);
    await loadShops('product_purchase');
    await loadShops('product_purchase', { force: true });
    await loadShops('food_drink');
    expect(getShopsByCategory).toHaveBeenCalledTimes(3);
  });
  test('donnée périmée : relue', async () => {
    getShopsByCategory.mockResolvedValue(data);
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now');
    spy.mockReturnValue(now);
    await loadShops('product_purchase');
    spy.mockReturnValue(now + TTL_MS + 1);
    await loadShops('product_purchase');
    spy.mockRestore();
    expect(getShopsByCategory).toHaveBeenCalledTimes(2);
  });
  test('hors ligne : rejet, rien en cache, puis reprise', async () => {
    getShopsByCategory.mockRejectedValueOnce(new Error('offline'));
    await expect(loadShops('product_purchase')).rejects.toThrow();
    expect(peekShops('product_purchase')).toBeNull();
    getShopsByCategory.mockResolvedValueOnce(data);
    await expect(loadShops('product_purchase')).resolves.toBe(data);
  });
  test('réponse vide : ne remplace pas une donnée connue', async () => {
    getShopsByCategory.mockResolvedValueOnce(data).mockResolvedValueOnce([]);
    await loadShops('product_purchase');
    await loadShops('product_purchase', { force: true });
    expect(peekShops('product_purchase')).toBe(data);
  });
  test('délai dépassé : rejet, la requête continue et alimente le cache', async () => {
    let done;
    getShopsByCategory.mockReturnValue(new Promise((res) => (done = res)));
    const seen = jest.fn();
    subscribeShops('product_purchase', seen);
    await expect(loadShops('product_purchase', { timeoutMs: 10 })).rejects.toThrow('timeout');
    done(data);
    await new Promise((r) => setTimeout(r, 5));
    expect(seen).toHaveBeenCalledWith(data);
    expect(peekShops('product_purchase')).toBe(data);
  });
});

describe('ouverture de la fiche boutique', () => {
  test('demande gardée tant que l\'onglet n\'est pas monté, prise une seule fois', () => {
    expect(requestOpenShop({ id: 7, name: 'Chez Paul' })).toBe(true);
    expect(takePendingShop().id).toBe(7);
    expect(takePendingShop()).toBeNull();
  });
  test('onglet monté : l\'événement déclenche la prise', () => {
    const got = [];
    const off = onOpenShop(() => got.push(takePendingShop()));
    requestOpenShop({ id: 8, name: 'B' });
    off();
    requestOpenShop({ id: 9, name: 'C' });
    expect(got.map((s) => s.id)).toEqual([8]);
    takePendingShop();
  });
  test('boutique sans id refusée', () => {
    expect(requestOpenShop(null)).toBe(false);
    expect(requestOpenShop({ name: 'x' })).toBe(false);
  });
});

describe('Soir libre : restaurants autour', () => {
  const rest = [
    shop(1, 'Chez Lou', [], { address: '12 rue des Lilas 75011 Paris' }),
    shop(2, 'Traiteur Zed', [], { address: '3 avenue Foch, Lyon' }),
    shop(3, 'Bistro Ana', [], { address: '8 rue X, 75011 Paris' }),
    shop(4, 'Le Port', [], { address: '1 quai, 13002 Marseille' }),
  ];
  test('code postal ou ville connus : boutiques de la zone, code postal d\'abord', () => {
    const r = nearbyShops(rest, { city: 'Paris', postalCode: '75011' });
    expect(r.map((s) => s.id)).toEqual([3, 1]);
  });
  test('ville seule', () => {
    expect(nearbyShops(rest, { city: 'Lyon' }).map((s) => s.id)).toEqual([2]);
  });
  test('position inconnue ou liste vide : rien, sans erreur', () => {
    expect(nearbyShops(rest, null)).toEqual([]);
    expect(nearbyShops(rest, { city: '', postalCode: '' })).toEqual([]);
    expect(nearbyShops(null, { city: 'Paris' })).toEqual([]);
    expect(nearbyShops([], { city: 'Paris' })).toEqual([]);
  });
  test('pas de ville partielle : "Paris" ne trouve pas "Parisot"', () => {
    expect(nearbyShops([shop(5, 'X', [], { address: '2 rue, Parisot' })], { city: 'Paris' })).toEqual([]);
  });
});

describe('articles ajoutés : pris en compte dans l\'onglet Produits', () => {
  const lines = [{ key: 'poulet-filet', packs: 1, qty: 1 }];
  const nameOf = () => 'Chicken fillet';
  const matchOf = () => ['filet de poulet', 'blanc de poulet'];
  test('nouvel article : selected true, noms français gardés', () => {
    const r = toListItems(lines, nameOf, [], { matchOf, force: true, idGen: () => 'i1' });
    expect(r.items[0]).toMatchObject({ name: 'Chicken fillet', selected: true, crossed: false, matchNames: ['filet de poulet', 'blanc de poulet'], matchFor: 'Chicken fillet' });
  });
  test('article existant décoché ou barré : de nouveau à acheter', () => {
    const ex = [{ id: 'a', name: 'chicken fillet', qty: 1, unit: 'u', crossed: true, selected: false }];
    const r = toListItems(lines, nameOf, ex, { matchOf, force: true });
    expect(r.merged).toBe(1);
    expect(r.items[0]).toMatchObject({ qty: 2, selected: true, crossed: false });
  });
  test('sans matchOf : comportement d\'avant', () => {
    const r = toListItems(lines, nameOf, [], { force: true, idGen: () => 'i' });
    expect(r.items[0].matchNames).toBeUndefined();
  });
  test('App.js ne transmet les noms français que si le nom n\'a pas changé', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
    expect(app).toMatch(/it\.matchFor === it\.name/);
  });
});

describe('textes dans les 13 langues', () => {
  const LANGS = ['fr', 'en', 'de', 'es', 'it', 'nl', 'pt', 'sv', 'ja', 'zh', 'th', 'ru', 'ar'];
  const BASES = ['line', 'summary'];
  const PLURALS = {
    fr: ['one', 'other'], en: ['one', 'other'], de: ['one', 'other'], es: ['one', 'other'], it: ['one', 'other'],
    nl: ['one', 'other'], pt: ['one', 'other'], sv: ['one', 'other'], ja: ['other'], zh: ['other'], th: ['other'],
    ru: ['one', 'few', 'many', 'other'], ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
  };
  const SIMPLE = ['realNote', 'coverTitle', 'coverItem', 'recipeTitle', 'freeCta'];
  test.each(LANGS)('%s : clés complètes, variables, sans tiret cadratin ni flèche', (lg) => {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', `${lg}.json`), 'utf8')).menus.pearl;
    for (const b of BASES) for (const f of PLURALS[lg]) expect(typeof d[`${b}_${f}`]).toBe('string');
    for (const k of SIMPLE) expect(typeof d[k]).toBe('string');
    for (const [k, v] of Object.entries(d)) {
      expect(v.trim().length).toBeGreaterThan(0);
      expect(v).not.toMatch(/[—–→←⇒]/);
      if (k.startsWith('line_')) expect(v).toContain('{{price}}');
      if (k.startsWith('summary_')) expect(v).toContain('{{total}}');
    }
    expect(d.coverItem).toEqual(expect.stringContaining('{{count}}'));
    expect(d.coverItem).toEqual(expect.stringContaining('{{total}}'));
    expect(d.coverItem).toEqual(expect.stringContaining('{{price}}'));
  });
  test('mêmes clés dans les 13 langues pour les formes de base', () => {
    const fr = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'fr.json'), 'utf8')).menus.pearl;
    expect(Object.keys(fr).sort()).toEqual([...SIMPLE, 'line_one', 'line_other', 'summary_one', 'summary_other'].sort());
  });
});
