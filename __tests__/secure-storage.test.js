// Jetons, compte et profil dans le stockage chiffré (expo-secure-store) :
// migration depuis AsyncStorage sans déconnexion, repli si le stockage chiffré
// échoue, effacement à la déconnexion et après une réinstallation.

const mockStore = new Map();
const mockSecure = new Map();
const mockFlags = { available: true, failSet: false };

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => { mockStore.set(k, v); }),
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  removeItem: jest.fn(async (k) => { mockStore.delete(k); }),
  multiRemove: jest.fn(async (ks) => { ks.forEach((k) => mockStore.delete(k)); }),
  multiSet: jest.fn(async (pairs) => { pairs.forEach(([k, v]) => mockStore.set(k, v)); }),
  getAllKeys: jest.fn(async () => Array.from(mockStore.keys())),
}));
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  isAvailableAsync: jest.fn(async () => mockFlags.available),
  getItemAsync: jest.fn(async (k) => (mockSecure.has(k) ? mockSecure.get(k) : null)),
  setItemAsync: jest.fn(async (k, v) => {
    if (mockFlags.failSet) throw new Error('keystore');
    mockSecure.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k) => { mockSecure.delete(k); }),
}));
jest.mock('../services/config', () => ({ CONFIG: { API_URL: 'https://api.test/api/v1' } }));

const TOKENS = JSON.stringify({ access: 'A1', refresh: 'R1', savedAt: 1 });

let api;
let auth;
let storage;

beforeEach(() => {
  jest.resetModules();
  mockStore.clear();
  mockSecure.clear();
  mockFlags.available = true;
  mockFlags.failSet = false;
  global.fetch = jest.fn();
  api = require('../services/api');
  auth = require('../services/auth');
  storage = require('../services/secureStorage');
});

test('migration : jetons repris de AsyncStorage, recopiés chiffrés, ancienne copie effacée', async () => {
  mockStore.set('MARKETPLACE_TOKENS', TOKENS);
  expect(await api.getTokens()).toMatchObject({ access: 'A1', refresh: 'R1' });
  expect(mockSecure.get('MARKETPLACE_TOKENS')).toBe(TOKENS);
  expect(mockStore.has('MARKETPLACE_TOKENS')).toBe(false);
  expect(await api.getTokens()).toMatchObject({ refresh: 'R1' });
});

test('enregistrement : chiffré seulement', async () => {
  await api.saveTokens('A2', 'R2');
  expect(JSON.parse(mockSecure.get('MARKETPLACE_TOKENS'))).toMatchObject({ access: 'A2', refresh: 'R2' });
  expect(mockStore.has('MARKETPLACE_TOKENS')).toBe(false);
});

test('échec du stockage chiffré : repli AsyncStorage, personne n est déconnecté', async () => {
  mockStore.set('MARKETPLACE_TOKENS', TOKENS);
  mockFlags.failSet = true;
  expect(await api.getTokens()).toMatchObject({ refresh: 'R1' });
  expect(mockStore.get('MARKETPLACE_TOKENS')).toBe(TOKENS);
  await api.saveTokens('A3', 'R3');
  expect(await api.getTokens()).toMatchObject({ access: 'A3', refresh: 'R3' });
});

test('stockage chiffré absent (web) : AsyncStorage comme avant', async () => {
  mockFlags.available = false;
  await api.saveTokens('A4', 'R4');
  expect(mockSecure.size).toBe(0);
  expect(await api.getTokens()).toMatchObject({ refresh: 'R4' });
});

test('réinstallation : les restes du trousseau sont effacés', async () => {
  mockSecure.set('MARKETPLACE_TOKENS', TOKENS);
  expect(await api.getTokens()).toBeNull();
  expect(mockStore.get('PEARL_SECURE_STORE_INSTALL')).toBe('1');
});

test('installation déjà repérée : la session chiffrée est gardée', async () => {
  mockStore.set('PEARL_SECURE_STORE_INSTALL', '1');
  mockSecure.set('MARKETPLACE_TOKENS', TOKENS);
  expect(await api.getTokens()).toMatchObject({ refresh: 'R1' });
});

test('une migration en cours n écrase pas un jeton tourné entre-temps', async () => {
  mockStore.set('MARKETPLACE_TOKENS', TOKENS);
  const read = api.getTokens();
  const save = api.saveTokens('A5', 'R5');
  await Promise.all([read, save]);
  expect(await api.getTokens()).toMatchObject({ access: 'A5', refresh: 'R5' });
  expect(mockStore.has('MARKETPLACE_TOKENS')).toBe(false);
});

test('valeur de plus de 2 Ko gardée dans AsyncStorage', async () => {
  const big = JSON.stringify({ photo: 'x'.repeat(3000) });
  await storage.setSecureItem('KEY_PROFILE', big);
  expect(mockSecure.has('KEY_PROFILE')).toBe(false);
  expect(await storage.getSecureItem('KEY_PROFILE')).toBe(big);
});

test('déconnexion et effacement : copies chiffrées retirées', async () => {
  await api.saveTokens('A6', 'R6');
  await storage.setSecureItem('KEY_AUTH', '{"id":1}');
  await storage.setSecureItem('KEY_PROFILE', '{"phone":"0600000000"}');
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: true }) });
  await auth.logoutUser();
  expect(mockSecure.has('MARKETPLACE_TOKENS')).toBe(false);
  expect(mockSecure.has('KEY_AUTH')).toBe(false);
  await auth.clearLocalUserData();
  expect(mockSecure.has('KEY_PROFILE')).toBe(false);
});

test('envoi de fichier : jeton expiré rafraîchi, sans Content-Type JSON', async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
  const jwt = (s) => `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + s })}.sig`;
  const fresh = jwt(3600);
  await api.saveTokens(jwt(-10), 'R1');
  global.fetch
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access: fresh, refresh: 'R2' }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: true }) });
  await api.apiUpload('/users/update-profile/?id=1', new FormData(), 'PUT');
  const [, opts] = global.fetch.mock.calls[1];
  expect(opts.method).toBe('PUT');
  expect(opts.headers.Authorization).toBe(`Bearer ${fresh}`);
  expect(opts.headers['Content-Type']).toBeUndefined();
  expect(opts.multipart).toBeUndefined();
});
