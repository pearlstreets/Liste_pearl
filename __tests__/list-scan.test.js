// Scan de Ma Liste : appel du serveur (statuts, assainissement, jamais d'exception)
// et fusion des articles dans la liste (même règle que la saisie au clavier).

// Jeton d'accès valide (exp en 2100) : pas de rafraîchissement avant l'appel.
const mockJeton = 'e30.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64') + '.sig';
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(JSON.stringify({ access: mockJeton, refresh: 'r' }))),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/config', () => ({
  CONFIG: { API_URL: 'https://api.test/api/v1' },
  APP_HEADERS: {},
}));

jest.mock('../services/provenanceInstall', () => ({
  EN_TETE_PROVENANCE: 'X-Pearl-Provenance',
  provenanceInstallation: () => '',
}));

import { scanListPhoto, langueScan, assainirArticles } from '../services/listScan';
import { fusionnerArticles } from '../lib/fusionListe';

const reponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => (body === undefined ? Promise.reject(new Error('pas du JSON')) : Promise.resolve(body)),
});

afterEach(() => {
  delete global.fetch;
});

describe('scanListPhoto', () => {
  test('succès : appel multipart avec jeton et langue, articles assainis', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reponse(200, { items: [
      { name: '  Lait ', qty: 2, unit: 'u' },
      { name: 'Farine', qty: 500, unit: 'g' },
      { name: 'Eau', qty: 1.5, unit: 'l' },
      { name: 'Crème', qty: 20, unit: 'CL' },
      { name: 'Pain', qty: 0, unit: 'boite' },
      { name: '', qty: 1, unit: 'u' },
      { name: 42, qty: 1 },
      null,
      { name: 'x'.repeat(120), qty: -3 },
    ] })));
    const res = await scanListPhoto('file:///photo.jpg', 'fr-FR');
    expect(res.error).toBeUndefined();
    expect(res.items).toEqual([
      { name: 'Lait', qty: 2, unit: 'u' },
      { name: 'Farine', qty: 500, unit: 'g' },
      { name: 'Eau', qty: 1.5, unit: 'L' },
      { name: 'Crème', qty: 20, unit: 'cL' },
      { name: 'Pain', qty: 1, unit: 'u' },
      { name: 'x'.repeat(80), qty: 1, unit: 'u' },
    ]);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/users/list-scan/');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe(`Bearer ${mockJeton}`);
    expect(opts.headers['Content-Type']).toBeUndefined();
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get('lang')).toBe('fr');
  });

  test('401 : connexion demandée', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reponse(401, { detail: 'no' })));
    expect(await scanListPhoto('file:///p.jpg', 'fr')).toEqual({ error: 'login' });
  });

  test('403 compte pro ou admin : connexion avec un compte client demandée', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reponse(403, { code: 'customer_account_required' })));
    expect(await scanListPhoto('file:///p.jpg', 'fr')).toEqual({ error: 'login' });
  });

  test('429 : limite du jour', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reponse(429, { error: 'limit' })));
    expect(await scanListPhoto('file:///p.jpg', 'fr')).toEqual({ error: 'limit' });
  });

  test('400 : image refusée', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reponse(400, { error: 'image' })));
    expect(await scanListPhoto('file:///p.jpg', 'fr')).toEqual({ error: 'image' });
  });

  test('503 : indisponible', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reponse(503, { error: 'unavailable' })));
    expect(await scanListPhoto('file:///p.jpg', 'fr')).toEqual({ error: 'unavailable' });
  });

  test('exception réseau : network', async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    expect(await scanListPhoto('file:///p.jpg', 'fr')).toEqual({ error: 'network' });
  });

  test('réponses invalides : jamais d\'exception', async () => {
    const cas = [
      reponse(200, undefined),
      reponse(200, null),
      reponse(200, 'texte'),
      reponse(200, { items: 'non' }),
      reponse(502, undefined),
      null,
    ];
    for (const r of cas) {
      global.fetch = jest.fn(() => Promise.resolve(r));
      const res = await scanListPhoto('file:///p.jpg', 'fr');
      expect(res && typeof res).toBe('object');
      expect(res.error || res.items).toBeTruthy();
    }
    global.fetch = jest.fn(() => Promise.resolve(reponse(200, { items: [] })));
    expect(await scanListPhoto('file:///p.jpg', 'fr')).toEqual({ items: [] });
    expect(await scanListPhoto('', 'fr')).toEqual({ error: 'image' });
  });

  test('langue ramenée aux 13 langues, sinon en', () => {
    expect(langueScan('zh-Hans')).toBe('zh');
    expect(langueScan('pt_BR')).toBe('pt');
    expect(langueScan('ko')).toBe('en');
    expect(langueScan(undefined)).toBe('en');
    expect(assainirArticles('x')).toEqual([]);
  });
});

describe('fusionnerArticles', () => {
  const prev = [
    { id: 'a', name: 'Lait', qty: 1, unit: 'u', crossed: false, selected: false },
    { id: 'b', name: 'Farine', qty: 200, unit: 'g', crossed: false, selected: true },
  ];

  test('même nom (majuscules ignorées) et même unité : quantités additionnées', () => {
    const out = fusionnerArticles(prev, [{ name: 'lait', qty: 2, unit: 'u' }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ ...prev[0], qty: 3 });
    expect(prev[0].qty).toBe(1);
  });

  test('unité différente ou nouveau nom : nouvel article sélectionné', () => {
    const out = fusionnerArticles(prev, [
      { name: 'Farine', qty: 1, unit: 'kg' },
      { name: 'Oeufs', qty: 6, unit: 'u' },
    ]);
    expect(out).toHaveLength(4);
    expect(out[2]).toMatchObject({ name: 'Farine', qty: 1, unit: 'kg', crossed: false, selected: true });
    expect(out[3]).toMatchObject({ name: 'Oeufs', qty: 6, unit: 'u', crossed: false, selected: true });
    expect(out[2].id).not.toBe(out[3].id);
  });

  test('unité absente comptée comme u', () => {
    const out = fusionnerArticles([{ id: 'c', name: 'Pomme', qty: 2 }], [{ name: 'Pomme', qty: 1 }]);
    expect(out).toEqual([{ id: 'c', name: 'Pomme', qty: 3 }]);
  });
});
