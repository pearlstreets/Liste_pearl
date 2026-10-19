// Options (déclinaisons) d'une fiche et écarts de stock d'une course
// (décision du 03/10/2026) : lecture des options, plafond, champs envoyés à
// create-order, application des `adjusted_items` / `excluded_items` et des
// refus 409. Aucune de ces fonctions ne doit lever sur une forme inattendue.

import {
  lireCustomizationOptions,
  optionsDeLaFiche,
  stockDeclinaison,
  optionDOffice,
  ficheEpuisee,
  plafonner,
  varianteDeLOption,
  champsVariante,
  champsVariantePanier,
  cleVariante,
  ecartsDeStock,
  appliquerEcarts,
  refusDeStock,
  appliquerRefus,
} from '../lib/variantes';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(JSON.stringify({ access: 'tok', refresh: 'r' }))),
  removeItem: jest.fn(),
}));

jest.mock('../services/config', () => ({
  CONFIG: {
    API_URL: 'https://api.test/api/v1',
    DELIVERY_API_URL: 'https://api.test/api/v1/delivery',
  },
}));

jest.mock('../services/api', () => ({
  apiGet: jest.fn(),
  // services/delivery.js lit les jetons par la fonction commune (stockage chiffré).
  getTokens: jest.fn(() => Promise.resolve({ access: 'tok', refresh: 'r' })),
  refreshTokens: jest.fn(() => Promise.resolve(null)),
}));

const multi = (rows, categories = ['Taille']) => ({
  customizationOptions: { variant: 'multi', variants: { categories, rows } },
});

describe('optionsDeLaFiche', () => {
  test('source sans customizationOptions : inconnu (undefined)', () => {
    expect(optionsDeLaFiche({ id: 1, name: 'x' })).toBeUndefined();
    expect(optionsDeLaFiche(null)).toBeUndefined();
    expect(optionsDeLaFiche('texte')).toBeUndefined();
  });

  test('produit simple ou fiche non "multi" : aucune option', () => {
    expect(optionsDeLaFiche({ customizationOptions: null }).options).toEqual([]);
    expect(optionsDeLaFiche({ customizationOptions: {} }).options).toEqual([]);
    expect(
      optionsDeLaFiche({
        customizationOptions: { variant: 'single', variants: { rows: [{ id: 1, title: 'M' }] } },
      }).options
    ).toEqual([]);
  });

  test('stock lu comme le serveur : vide = non suivi, 0 = épuisée, nombre = plafond', () => {
    const o = optionsDeLaFiche(
      multi([
        { id: 'a', title: 'S', quantity: '' },
        { id: 'b', title: 'M', quantity: '0' },
        { id: 'c', title: 'L', quantity: '3' },
        { id: 'd', title: 'XL', quantity: 2 },
        { id: 'e', title: 'XXL', quantity: '1,9' },
      ])
    );
    expect(o.libelle).toBe('Taille');
    expect(o.options.map((x) => [x.id, x.title, x.stock])).toEqual([
      ['a', 'S', null],
      ['b', 'M', 0],
      ['c', 'L', 3],
      ['d', 'XL', 2],
      ['e', 'XXL', 1],
    ]);
  });

  test('chaîne JSON, titres vides écartés, doublons de titre : la première ligne', () => {
    const co = JSON.stringify({
      variant: 'MULTI',
      variants: {
        categories: ['Couleur', 'Taille'],
        rows: [
          { id: 1, title: 'Rouge / M', quantity: '1' },
          { id: 2, title: '' },
          { id: 3, title: 'Rouge / M', quantity: '9' },
          { title: 'Bleu / M' },
        ],
      },
    });
    const o = optionsDeLaFiche({ customizationOptions: co });
    expect(o.libelle).toBe('Couleur / Taille');
    expect(o.options).toEqual([
      { id: '1', title: 'Rouge / M', stock: 1 },
      { id: null, title: 'Bleu / M', stock: null },
    ]);
  });

  test('format à plat variantCategories + variantRows', () => {
    const o = optionsDeLaFiche({
      customizationOptions: {
        variant: 'multi',
        variantCategories: ['Taille'],
        variantRows: [{ id: 7, title: 'M', quantity: '4' }],
      },
    });
    expect(o.options).toEqual([{ id: '7', title: 'M', stock: 4 }]);
  });

  test('JSON illisible : aucune option, sans lever', () => {
    expect(lireCustomizationOptions('{pas du json')).toBeNull();
    expect(optionsDeLaFiche({ customizationOptions: '{pas du json' }).options).toEqual([]);
  });
});

describe('choix et plafond', () => {
  test('une seule option non épuisée : prise d’office', () => {
    expect(optionDOffice([{ id: '1', title: 'Unique', stock: null }])).toEqual({
      id: '1',
      title: 'Unique',
      stock: null,
    });
    expect(optionDOffice([{ id: '1', title: 'Unique', stock: 0 }])).toBeNull();
    expect(optionDOffice([{ title: 'S' }, { title: 'M' }])).toBeNull();
    expect(optionDOffice(undefined)).toBeNull();
  });

  test('fiche épuisée = toutes les options à 0', () => {
    expect(ficheEpuisee([{ stock: 0 }, { stock: 0 }])).toBe(true);
    expect(ficheEpuisee([{ stock: 0 }, { stock: null }])).toBe(false);
    expect(ficheEpuisee([])).toBe(false);
  });

  test('plafonner : jamais au-delà du stock, jamais sous 1', () => {
    expect(plafonner(5, 2)).toBe(2);
    expect(plafonner(1, 3)).toBe(1);
    expect(plafonner(4, null)).toBe(4);
    expect(plafonner(4, undefined)).toBe(4);
    expect(plafonner(0, 3)).toBe(1);
    expect(stockDeclinaison({ quantity: true })).toBeNull();
  });
});

describe('option envoyée à create-order', () => {
  test('variant_id + variant { id, title }', () => {
    const v = varianteDeLOption({ id: '12', title: 'M', stock: 3 });
    expect(v).toEqual({ id: '12', title: 'M' });
    expect(champsVariante(v)).toEqual({ variant_id: '12', variant: { id: '12', title: 'M' } });
  });

  test('option sans id : titre seul ; sans option : rien', () => {
    expect(champsVariante({ id: null, title: 'Bleu' })).toEqual({
      variant: { id: null, title: 'Bleu' },
    });
    expect(champsVariante(undefined)).toEqual({});
    expect(champsVariante({})).toEqual({});
    expect(cleVariante(undefined)).toBe('');
    expect(cleVariante({ id: 5, title: 'x' })).toBe('id:5');
    expect(cleVariante({ title: 'Bleu' })).toBe('t:Bleu');
  });
});

describe('écarts de stock de la réponse', () => {
  test('ancienne réponse ou listes vides : null', () => {
    expect(ecartsDeStock(null)).toBeNull();
    expect(ecartsDeStock({ status: 'success' })).toBeNull();
    expect(ecartsDeStock({ adjusted_items: [], excluded_items: [] })).toBeNull();
    expect(ecartsDeStock({ adjusted_items: 'x', excluded_items: [null, 3] })).toBeNull();
  });

  test('quantité ajustée, article épuisé, autres articles inchangés', () => {
    const items = [
      { productId: 10, name: 'T-shirt', qty: 3, variant: { id: 'm', title: 'M' } },
      { productId: 10, name: 'T-shirt', qty: 1, variant: { id: 'l', title: 'L' } },
      { productId: 11, name: 'Mug', qty: 2 },
      { name: 'Pain', qty: 1 },
      { productId: 12, name: 'Bol', qty: 1 },
    ];
    const ecarts = ecartsDeStock({
      adjusted_items: [
        {
          product_id: 10,
          name: 'T-shirt',
          requested_qty: 3,
          qty: 2,
          variant: { id: 'm', title: 'M' },
        },
      ],
      excluded_items: [{ product_id: 11, name: 'Mug', requested_qty: 2, reason: 'out_of_stock' }],
    });
    const { commandes, exclus, lignes } = appliquerEcarts(items, ecarts);
    expect(commandes.map((it) => [it.name, it.qty, it.variant && it.variant.title])).toEqual([
      ['T-shirt', 2, 'M'],
      ['T-shirt', 1, 'L'],
      ['Pain', 1, undefined],
      ['Bol', 1, undefined],
    ]);
    expect(exclus).toEqual([items[2]]);
    expect(lignes).toEqual([
      { type: 'adjusted', name: 'T-shirt', variant: 'M', qty: 2, requested: 3 },
      { type: 'removed', name: 'Mug', variant: '', qty: 0, requested: 2 },
    ]);
  });

  test('sans écarts : la liste telle quelle', () => {
    const items = [{ productId: 1, qty: 1 }];
    expect(appliquerEcarts(items, null)).toEqual({ commandes: items, exclus: [], lignes: [] });
    expect(appliquerEcarts(undefined, null).commandes).toEqual([]);
  });
});

describe('refus 409 de stock', () => {
  test('autres erreurs : null', () => {
    expect(refusDeStock(null)).toBeNull();
    expect(refusDeStock(new Error('réseau'))).toBeNull();
    expect(refusDeStock({ status: 500, body: { reason: 'out_of_stock' } })).toBeNull();
    expect(refusDeStock({ status: 409, body: { reason: 'autre' } })).toBeNull();
    expect(refusDeStock({ status: 409, body: null })).toBeNull();
  });

  test('« Épuisé » : articles épuisés décochés mais gardés dans la liste', () => {
    const refus = refusDeStock({
      status: 409,
      body: {
        message: 'Épuisé',
        reason: 'out_of_stock',
        epuise: true,
        adjusted_items: [],
        excluded_items: [
          {
            product_id: 5,
            name: 'Vase',
            requested_qty: 1,
            reason: 'out_of_stock',
            variant: { id: 'b', title: 'Bleu' },
          },
        ],
      },
    });
    expect(refus.epuise).toBe(true);
    const items = [
      { productId: 5, name: 'Vase', qty: 1, variant: { id: 'b', title: 'Bleu' } },
      { productId: 5, name: 'Vase', qty: 1, variant: { id: 'r', title: 'Rouge' } },
    ];
    const res = appliquerRefus(items, { 0: true, 1: false }, refus);
    expect(res.items).toEqual(items);
    expect(res.selected).toEqual({ 0: false, 1: false });
    expect(res.noms).toEqual(['Vase']);
  });

  test('« Cet article vient d’être vendu. » : quantités ramenées à ce qui reste', () => {
    const refus = refusDeStock({
      status: 409,
      body: {
        message: "Cet article vient d'être vendu.",
        reason: 'out_of_stock',
        shortages: [
          { product_id: 7, requested: 3, available: 1 },
          { product_id: 8, requested: 1, available: 0 },
        ],
      },
    });
    expect(refus.epuise).toBe(false);
    const items = [
      { productId: 7, name: 'Bougie', qty: 3 },
      { productId: 8, name: 'Savon', qty: 1 },
      { productId: 9, name: 'Thé', qty: 2 },
    ];
    const res = appliquerRefus(items, { 0: true, 1: true, 2: true }, refus);
    expect(res.items.map((it) => it.qty)).toEqual([1, 1, 2]);
    expect(res.selected).toEqual({ 0: true, 1: false, 2: true });
    expect(res.noms).toEqual(['Bougie', 'Savon']);
  });
});

describe('createDeliveryOrder', () => {
  const { createDeliveryOrder } = require('../services/delivery');

  afterEach(() => {
    delete global.fetch;
  });

  test('envoie variant_id et variant pour un article à option', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ status: 'success' }) })
    );
    await createDeliveryOrder({
      id: 1,
      items: [
        { productId: 10, companyId: 3, name: 'T-shirt', qty: 2, variant: { id: 'm', title: 'M' } },
        { productId: 11, companyId: 3, name: 'Mug', qty: 1 },
      ],
    });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.items[0]).toEqual(
      expect.objectContaining({ product_id: 10, variant_id: 'm', variant: { id: 'm', title: 'M' } })
    );
    expect(body.items[1].variant_id).toBeUndefined();
    expect(body.items[1].variant).toBeUndefined();
  });

  test('un 409 porte son statut et son corps', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Épuisé', reason: 'out_of_stock', epuise: true }),
      })
    );
    await expect(createDeliveryOrder({ id: 2, items: [] })).rejects.toMatchObject({
      status: 409,
      body: { reason: 'out_of_stock' },
    });
  });
});

describe('getProductOptions', () => {
  const { apiGet } = require('../services/api');
  const { getProductOptions } = require('../services/products');

  beforeEach(() => apiGet.mockReset());

  test('lues dans les produits de la boutique, sinon dans la fiche', async () => {
    apiGet.mockImplementation((url) => {
      if (url.startsWith('/users/company/41/')) {
        return Promise.resolve({
          products: [{ id: 1, ...multi([{ id: 'a', title: 'S', quantity: '2' }]) }],
          folders: [{ products: [{ id: 2, customizationOptions: null }] }],
        });
      }
      if (url.startsWith('/users/product-purchase/3/')) {
        return Promise.resolve({ data: multi([{ id: 'z', title: 'Bleu', quantity: '0' }]) });
      }
      return Promise.reject(new Error('inattendu'));
    });
    expect((await getProductOptions(1, 41)).options).toEqual([{ id: 'a', title: 'S', stock: 2 }]);
    expect((await getProductOptions(2, 41)).options).toEqual([]);
    expect((await getProductOptions(3, 41)).options).toEqual([
      { id: 'z', title: 'Bleu', stock: 0 },
    ]);
    // La boutique n'est lue qu'une fois (gardée 60 s).
    expect(apiGet.mock.calls.filter(([u]) => u.startsWith('/users/company/41/'))).toHaveLength(1);
  });

  test('rien de lisible : null (l’article part sans option)', async () => {
    apiGet.mockImplementation(() => Promise.reject(new Error('hors ligne')));
    expect(await getProductOptions(9, 77)).toBeNull();
    expect(await getProductOptions(null, 77)).toBeNull();
  });
});

describe('retrait : option envoyée à /users/cart/add/', () => {
  test('selected_variant { id, title } ; sans option : rien', () => {
    expect(champsVariantePanier({ id: '12', title: 'M' })).toEqual({
      selected_variant: { id: '12', title: 'M' },
    });
    expect(champsVariantePanier({ id: null, title: 'Bleu' })).toEqual({
      selected_variant: { id: null, title: 'Bleu' },
    });
    expect(champsVariantePanier(undefined)).toEqual({});
  });
});

describe('getMarketplaceOrderStatuses', () => {
  const { apiGet } = require('../services/api');
  const { getMarketplaceOrderStatuses } = require('../services/orders');

  beforeEach(() => apiGet.mockReset());

  test('lit les vraies commandes (apiGet importé)', async () => {
    apiGet.mockResolvedValue({
      data: [{ orders: [{ order_id: 'A1', status: 'Refunded', is_refunded: true }] }],
    });
    const map = await getMarketplaceOrderStatuses();
    expect(apiGet).toHaveBeenCalledWith('/users/orders-new/');
    expect(map.A1).toEqual(expect.objectContaining({ status: 'refunded', is_refunded: true }));
  });
});

describe('getShopsByCategory : options servies par la liste', () => {
  const { apiGet } = require('../services/api');
  const { getShopsByCategory } = require('../services/products');

  beforeEach(() => apiGet.mockReset());

  test('customizationOptions présent : options lues ; absent : undefined (relues à l’ajout)', async () => {
    apiGet.mockResolvedValueOnce({
      count: 3,
      results: [
        {
          id: 1,
          name: 'T-shirt',
          price: 10,
          company_id: 4,
          ...multi([
            { id: 's', title: 'S', quantity: '' },
            { id: 'm', title: 'M', quantity: '0' },
          ]),
        },
        { id: 2, name: 'Bol', price: 5, company_id: 4, customizationOptions: {} },
        { id: 3, name: 'Mug', price: 6, company_id: 4 },
      ],
    });
    const [shop] = await getShopsByCategory('product_purchase', { pages: 1, pageSize: 100 });
    const parId = Object.fromEntries(shop.products.map((p) => [p.id, p.options]));
    expect(parId[1].options).toEqual([
      { id: 's', title: 'S', stock: null },
      { id: 'm', title: 'M', stock: 0 },
    ]);
    expect(parId[2].options).toEqual([]);
    expect(parId[3]).toBeUndefined();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
