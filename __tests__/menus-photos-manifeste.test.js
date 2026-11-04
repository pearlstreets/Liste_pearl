// Manifeste distant des photos : bitset, JSON invalide, ancien manifeste gardé, identifiant absent.
const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v);
  }),
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
}));

const {
  parseManifest,
  serializeManifest,
  hasRecipePhoto,
  hasIngredientPhoto,
  remoteRecipePhotoUri,
  remoteIngredientSource,
  getManifest,
  setManifest,
  resetManifest,
  MANIFEST_URL,
} = require('../lib/menus/photoManifest');
const {
  refreshManifest,
  loadStoredManifest,
  resetManifestService,
  MANIFEST_KEY,
  REFRESH_MS,
} = require('../services/photoManifest');
const { encoderBitset } = require('../scripts/menus-photos/manifeste');
const { distinctPhotoRecipes } = require('../lib/menus/photoUrls');

const N = 11581;
const ROWS = [0, 5, 6, 37, 4095, N - 1];
const BON = {
  v: 1,
  genN: N,
  gen: encoderBitset(ROWS, N),
  recettes: ['ratatouille', 'quiche-lorraine'],
  ingredients: ['tomate', 'pomme-de-terre'],
};
const gid = (r) => 'g-' + r.toString(36);

const rep =
  (corps, ok = true) =>
  async () => ({ ok, text: async () => corps });

beforeEach(() => {
  mockStore.clear();
  resetManifest();
  resetManifestService();
});

describe('bitset des recettes générées', () => {
  test('exactement les cases écrites, sans décalage', () => {
    const m = parseManifest(BON);
    expect(m).not.toBeNull();
    expect(BON.gen).toHaveLength(Math.ceil(N / 6));
    for (const r of ROWS) expect(hasRecipePhoto(m, gid(r))).toBe(true);
    for (const r of [1, 4, 7, 36, 38, 4094, 4096, N - 2])
      expect(hasRecipePhoto(m, gid(r))).toBe(false);
    let n = 0;
    for (let r = 0; r < N; r++) if (hasRecipePhoto(m, gid(r))) n++;
    expect(n).toBe(ROWS.length);
  });

  test('cases hors catalogue ou mal écrites : jamais de photo', () => {
    const m = parseManifest(BON);
    expect(hasRecipePhoto(m, gid(N))).toBe(false);
    expect(hasRecipePhoto(m, 'g-05')).toBe(false); // zéro en tête : pas l'écriture canonique
    expect(hasRecipePhoto(m, 'g-')).toBe(false);
    expect(hasRecipePhoto(m, 'g-ZZ')).toBe(false);
    expect(hasRecipePhoto(m, null)).toBe(false);
    expect(hasRecipePhoto(null, gid(0))).toBe(false);
  });

  test('le bitset reste une chaîne : aucun travail sur les 11 581 au chargement', () => {
    const m = parseManifest(JSON.stringify(BON));
    expect(typeof m.gen).toBe('string');
    expect(Object.keys(m).sort()).toEqual(['gen', 'genN', 'ingredients', 'recettes', 'v']);
  });
});

describe('JSON invalide', () => {
  test.each([
    ['texte illisible', '{pas du json'],
    ['vide', ''],
    ['null', 'null'],
    ['tableau', '[]'],
    ['sans version', JSON.stringify({ gen: '', recettes: [] })],
    ['version texte', JSON.stringify({ ...BON, v: '1' })],
    ['bitset hors alphabet', JSON.stringify({ ...BON, gen: 'AB*C' })],
    ['bitset non texte', JSON.stringify({ ...BON, gen: 12 })],
    ['recettes non tableau', JSON.stringify({ ...BON, recettes: 'ratatouille' })],
    ['page html', '<html>Erreur</html>'],
  ])('%s : refusé', (_nom, raw) => {
    expect(parseManifest(raw)).toBeNull();
  });

  test('identifiants douteux ignorés, le reste gardé', () => {
    const m = parseManifest({ v: 1, recettes: ['ok', '../x', 'A b', 3], ingredients: ['tomate'] });
    expect([...m.recettes]).toEqual(['ok']);
    expect(m.genN).toBe(0);
  });

  test('« version » accepté comme « v » (manifeste.js du dépôt)', () => {
    expect(parseManifest({ version: 2, gen: '', recettes: [], ingredients: [] }).v).toBe(2);
  });
});

describe('identifiant absent : aucune adresse distante', () => {
  test('sans manifeste : rien', () => {
    expect(getManifest()).toBeNull();
    expect(remoteRecipePhotoUri({ id: 'ratatouille' })).toBeNull();
    expect(remoteIngredientSource('tomate')).toBeNull();
  });

  test('avec manifeste : seulement ce qu il liste', () => {
    setManifest(parseManifest(BON));
    expect(remoteRecipePhotoUri({ id: 'ratatouille' })).toBe(
      'https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/v1/ratatouille.webp'
    );
    expect(remoteRecipePhotoUri({ id: gid(37) })).toBe(
      `https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/v1/${gid(37)}.webp`
    );
    expect(remoteRecipePhotoUri({ id: 'tarte-tatin' })).toBeNull();
    expect(remoteRecipePhotoUri({ id: gid(1) })).toBeNull();
    expect(remoteRecipePhotoUri({ id: 'ratatouille', custom: true })).toBeNull();
    expect(remoteIngredientSource('tomate')).toEqual({
      uri: 'https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/v1/ingredients/tomate.webp',
    });
    expect(remoteIngredientSource('oignon')).toBeNull();
    expect(remoteIngredientSource('oignon', getManifest(), { oignon: 7 })).toBe(7);
    expect(hasIngredientPhoto(getManifest(), 'toString')).toBe(false);
  });

  test('vignettes de l historique : seulement les recettes listées', () => {
    setManifest(parseManifest(BON));
    const rs = [{ id: 'tarte-tatin' }, { id: 'ratatouille' }, { id: gid(0) }, { id: gid(2) }];
    expect(distinctPhotoRecipes(rs, {}, 5, remoteRecipePhotoUri).map((r) => r.id)).toEqual([
      'ratatouille',
      gid(0),
    ]);
  });
});

describe('téléchargement et dernier bon manifeste', () => {
  test('réponse valide : prise et gardée sur le téléphone', async () => {
    const f = jest.fn(rep(JSON.stringify(BON)));
    expect(await refreshManifest({ fetchImpl: f, now: 1000 })).toBe(true);
    expect(f.mock.calls[0][0]).toBe(MANIFEST_URL);
    expect(hasRecipePhoto(getManifest(), 'ratatouille')).toBe(true);
    expect(parseManifest(mockStore.get(MANIFEST_KEY))).toEqual(getManifest());
  });

  test('JSON invalide, erreur HTTP ou réseau : l ancien manifeste reste, en mémoire et gardé', async () => {
    await refreshManifest({ fetchImpl: rep(JSON.stringify(BON)), now: 1000 });
    const garde = mockStore.get(MANIFEST_KEY);
    const avant = getManifest();
    expect(await refreshManifest({ force: true, fetchImpl: rep('{cassé'), now: 2000 })).toBe(false);
    expect(await refreshManifest({ force: true, fetchImpl: rep('', false), now: 3000 })).toBe(
      false
    );
    const panne = async () => {
      throw new Error('hors ligne');
    };
    expect(await refreshManifest({ force: true, fetchImpl: panne, now: 4000 })).toBe(false);
    expect(getManifest()).toBe(avant);
    expect(mockStore.get(MANIFEST_KEY)).toBe(garde);
  });

  test('hors ligne au démarrage : le manifeste gardé sert', async () => {
    mockStore.set(MANIFEST_KEY, serializeManifest(parseManifest(BON)));
    await loadStoredManifest();
    expect(hasRecipePhoto(getManifest(), gid(4095))).toBe(true);
  });

  test('manifeste gardé illisible : rien ne casse, aucune photo distante', async () => {
    mockStore.set(MANIFEST_KEY, 'n importe quoi');
    await loadStoredManifest();
    expect(getManifest()).toBeNull();
    expect(remoteRecipePhotoUri({ id: 'ratatouille' })).toBeNull();
  });

  test('au plus un téléchargement toutes les 30 min', async () => {
    const f = jest.fn(rep(JSON.stringify(BON)));
    await refreshManifest({ fetchImpl: f, now: 1000 });
    expect(await refreshManifest({ fetchImpl: f, now: 1000 + REFRESH_MS - 1 })).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
    await refreshManifest({ fetchImpl: f, now: 1000 + REFRESH_MS });
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('nouveau manifeste : le gardé ne repasse pas par-dessus', async () => {
    mockStore.set(MANIFEST_KEY, serializeManifest(parseManifest({ v: 1, recettes: ['ancienne'] })));
    await refreshManifest({ fetchImpl: rep(JSON.stringify(BON)), now: 1000 });
    expect(hasRecipePhoto(getManifest(), 'ratatouille')).toBe(true);
    expect(hasRecipePhoto(getManifest(), 'ancienne')).toBe(false);
  });
});
