// Correctifs de sécurité du 19/10/2026 : rafraîchissement des jetons (route
// client, rotation), déconnexion, changement de mot de passe serveur seul,
// effacement des données locales, mise à jour du profil en PUT, comptes de
// démonstration hors du bundle de production.

const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => { mockStore.set(k, v); }),
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  removeItem: jest.fn(async (k) => { mockStore.delete(k); }),
  multiRemove: jest.fn(async (ks) => { ks.forEach((k) => mockStore.delete(k)); }),
  multiSet: jest.fn(async (pairs) => { pairs.forEach(([k, v]) => mockStore.set(k, v)); }),
  getAllKeys: jest.fn(async () => Array.from(mockStore.keys())),
}));
jest.mock('../services/config', () => ({ CONFIG: { API_URL: 'https://api.test/api/v1' } }));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const jwt = (expSecondsFromNow) =>
  `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;

const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let api;
let auth;
let profile;

beforeEach(() => {
  jest.resetModules();
  mockStore.clear();
  global.fetch = jest.fn();
  api = require('../services/api');
  auth = require('../services/auth');
  profile = require('../services/profile');
});

describe('rafraîchissement des jetons', () => {
  test('passe par /token/refresh/ et enregistre le refresh tourné', async () => {
    const fresh = jwt(3600);
    await api.saveTokens(jwt(-10), 'R1');
    global.fetch
      .mockResolvedValueOnce(jsonRes(200, { access: fresh, refresh: 'R2' }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    await api.apiGet('/users/x/');
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/api/v1/token/refresh/');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ refresh: 'R1' });
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${fresh}`);
    const saved = await api.getTokens();
    expect(saved.access).toBe(fresh);
    expect(saved.refresh).toBe('R2');
    expect(global.fetch.mock.calls.some(([u]) => String(u).includes('/admin/refresh-token/'))).toBe(false);
  });

  test('deux appels en parallèle ne rafraîchissent qu une fois', async () => {
    const fresh = jwt(3600);
    await api.saveTokens(jwt(-10), 'R1');
    global.fetch.mockImplementation(async (url) =>
      String(url).endsWith('/token/refresh/')
        ? jsonRes(200, { access: fresh, refresh: 'R2' })
        : jsonRes(200, { ok: true })
    );
    await Promise.all([api.apiGet('/a/'), api.apiGet('/b/')]);
    const refreshCalls = global.fetch.mock.calls.filter(([u]) => String(u).endsWith('/token/refresh/'));
    expect(refreshCalls).toHaveLength(1);
  });

  test('refresh refusé : la requête part sans en-tête et rien n est écrasé', async () => {
    await api.saveTokens(jwt(-10), 'R1');
    global.fetch
      .mockResolvedValueOnce(jsonRes(401, { detail: 'Token is blacklisted' }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    await api.apiGet('/users/x/');
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect((await api.getTokens()).refresh).toBe('R1');
  });
});

describe('déconnexion', () => {
  test('envoie refresh ET refresh_token', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    global.fetch.mockResolvedValueOnce(jsonRes(200, { status: true }));
    await auth.logoutUser();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/users/logout/');
    expect(JSON.parse(opts.body)).toEqual({ refresh: 'R1', refresh_token: 'R1' });
    expect(await api.getTokens()).toBeNull();
  });

  test('jeton d accès expiré : le refresh tourné est révoqué aussi', async () => {
    await api.saveTokens(jwt(-10), 'R1');
    global.fetch
      .mockResolvedValueOnce(jsonRes(200, { access: jwt(3600), refresh: 'R2' }))
      .mockResolvedValueOnce(jsonRes(200, { status: true }))
      .mockResolvedValueOnce(jsonRes(200, { status: true }));
    await auth.logoutUser();
    const logouts = global.fetch.mock.calls.filter(([u]) => u.endsWith('/users/logout/'));
    expect(logouts.map(([, o]) => JSON.parse(o.body).refresh_token)).toEqual(['R1', 'R2']);
    expect(await api.getTokens()).toBeNull();
  });
});

describe('changement de mot de passe', () => {
  test('PUT avec confirm_password, nouvelle paire enregistrée', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    const newAccess = jwt(3600);
    global.fetch.mockResolvedValueOnce(
      jsonRes(200, { status: true, access_token: newAccess, refresh_token: 'R9' })
    );
    const res = await auth.updatePassword('Ancien1!', 'Nouveau1!');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/users/update-password/');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({
      old_password: 'Ancien1!',
      new_password: 'Nouveau1!',
      confirm_password: 'Nouveau1!',
    });
    expect(res.status).toBe(true);
    expect(await api.getTokens()).toMatchObject({ access: newAccess, refresh: 'R9' });
  });

  test('échec serveur : jetons inchangés', async () => {
    const access = jwt(3600);
    await api.saveTokens(access, 'R1');
    global.fetch.mockResolvedValueOnce(
      jsonRes(400, { status: false, errors: { old_password: ['Old password is incorrect.'] } })
    );
    const res = await auth.updatePassword('faux', 'Nouveau1!');
    expect(res.status).toBe(false);
    expect(await api.getTokens()).toMatchObject({ access, refresh: 'R1' });
  });
});

describe('effacement des données locales', () => {
  test('retire jetons, profil, listes, anciennes copies ; garde langue et devise', async () => {
    const seed = {
      MARKETPLACE_TOKENS: '{}', KEY_AUTH: '{}', KEY_PROFILE: '{}', KEY_ORDER_HISTORY: '[1]',
      KEY_ACCOUNTS: '[{"password":"x"}]', SG_LISTS: '[1]', SG_ACTIVE_LIST: 'l2',
      SG_ITEMS__l2: '[1]', USER_a_b_DATA: '{}', __SECURE__k: '{}', PEARL_DRIVER_EARNINGS: '[1]',
      SG_ITEMS: '[1]', KEY_CART: '[1]', KEY_FAVS: '[1]', KEY_FAV_PRODUCTS: '[1]',
      APP_LANGUAGE: 'fr', APP_CURRENCY: 'EUR',
    };
    Object.entries(seed).forEach(([k, v]) => mockStore.set(k, v));
    await auth.clearLocalUserData();
    ['MARKETPLACE_TOKENS', 'KEY_AUTH', 'KEY_PROFILE', 'KEY_ORDER_HISTORY', 'KEY_ACCOUNTS', 'SG_LISTS',
      'SG_ACTIVE_LIST', 'SG_ITEMS__l2', 'USER_a_b_DATA', '__SECURE__k', 'PEARL_DRIVER_EARNINGS']
      .forEach((k) => expect(mockStore.has(k)).toBe(false));
    ['SG_ITEMS', 'KEY_CART', 'KEY_FAVS', 'KEY_FAV_PRODUCTS'].forEach((k) => expect(mockStore.get(k)).toBe('[]'));
    expect(mockStore.get('APP_LANGUAGE')).toBe('fr');
    expect(mockStore.get('APP_CURRENCY')).toBe('EUR');
  });

  test('suppression du compte : données locales effacées', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('KEY_PROFILE', '{}');
    mockStore.set('SG_ITEMS__l2', '[1]');
    global.fetch.mockResolvedValueOnce(jsonRes(200, { status: true, message: 'ok' }));
    const res = await auth.deleteAccount();
    expect(res.success).toBe(true);
    expect(mockStore.has('MARKETPLACE_TOKENS')).toBe(false);
    expect(mockStore.has('KEY_PROFILE')).toBe(false);
    expect(mockStore.has('SG_ITEMS__l2')).toBe(false);
  });

  test('ancien registre de comptes purgé', async () => {
    mockStore.set('KEY_ACCOUNTS', '[{"password":"x"}]');
    await auth.purgeLegacyLocalAccounts();
    expect(mockStore.has('KEY_ACCOUNTS')).toBe(false);
  });
});

describe('profil', () => {
  test('mise à jour en PUT avec ?id du compte', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('KEY_AUTH', JSON.stringify({ id: 42 }));
    global.fetch.mockImplementation(async () => jsonRes(200, { status: true }));
    await profile.updateProfile({ prenom: 'A', nom: 'B', pseudo: 'abcd', email: 'a@b.fr' });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/users/update-profile/?id=42');
    expect(opts.method).toBe('PUT');
  });

  test('photo de profil envoyée en PUT avec ?id', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('KEY_AUTH', JSON.stringify({ id: 42 }));
    global.FormData = class { append() {} };
    global.fetch.mockResolvedValueOnce(jsonRes(200, { status: true }));
    await profile.uploadProfilePhoto('file:///p.jpg');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/users/update-profile/?id=42');
    expect(opts.method).toBe('PUT');
  });

  test('sans compte connecté : aucun appel', async () => {
    const res = await profile.updateProfile({ prenom: 'A' });
    expect(res.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('comptes de démonstration', () => {
  test('aucun compte chargé hors développement', () => {
    const prev = global.__DEV__;
    global.__DEV__ = false;
    jest.resetModules();
    const { SEED_ACCOUNTS, DEFAULT_SEED_ACCOUNT } = require('../lib/seedAccounts');
    expect(SEED_ACCOUNTS).toEqual([]);
    expect(DEFAULT_SEED_ACCOUNT).toBeNull();
    global.__DEV__ = prev;
  });
});
