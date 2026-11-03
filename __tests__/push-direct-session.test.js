// Notifications de commande, côté session : en-tête X-Platform sur toutes les
// requêtes (origine de la commande lue par le serveur), retrait du téléphone
// à la déconnexion et avant la suppression du compte, révocations en
// attente qui survivent à l'effacement des données.

const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v);
  }),
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k);
  }),
  multiRemove: jest.fn(async (ks) => {
    ks.forEach((k) => mockStore.delete(k));
  }),
  multiSet: jest.fn(async (pairs) => {
    pairs.forEach(([k, v]) => mockStore.set(k, v));
  }),
  getAllKeys: jest.fn(async () => Array.from(mockStore.keys())),
}));
jest.mock('../services/config', () => ({
  CONFIG: {
    API_URL: 'https://api.test/api/v1',
    DELIVERY_API_URL: 'https://api.test/api/v1/delivery',
  },
  APP_HEADERS: { 'X-Platform': 'liste' },
}));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const jwt = (expSecondsFromNow) =>
  `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
const jsonRes = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const enTete = (appel) => (appel[1] && appel[1].headers) || {};

let api;
let auth;
let delivery;

beforeEach(() => {
  jest.resetModules();
  mockStore.clear();
  global.fetch = jest.fn(async () => jsonRes(200, { status: true }));
  api = require('../services/api');
  auth = require('../services/auth');
  delivery = require('../services/delivery');
});

describe('en-tête X-Platform: liste', () => {
  test('apiFetch, avec et sans session', async () => {
    await api.apiGet('/users/profile/');
    await api.saveTokens(jwt(3600), 'R1');
    await api.apiPost('/users/order/create/', {});
    expect(global.fetch).toHaveBeenCalledTimes(2);
    global.fetch.mock.calls.forEach((c) => expect(enTete(c)['X-Platform']).toBe('liste'));
  });

  test('refreshTokens', async () => {
    global.fetch.mockResolvedValueOnce(jsonRes(200, { access: jwt(3600), refresh: 'R2' }));
    await api.refreshTokens('R1');
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/api/v1/token/refresh/');
    expect(enTete(global.fetch.mock.calls[0])['X-Platform']).toBe('liste');
  });

  test('deliveryFetch (création de course, suivi)', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    await delivery.getDeliveryStatus('local-1');
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/api/v1/delivery/status/local-1/');
    expect(enTete(global.fetch.mock.calls[0])['X-Platform']).toBe('liste');
  });
});

describe('session et téléphone enregistré', () => {
  test('déconnexion : retrait du téléphone AVANT /users/logout/ et l effacement des jetons', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('pushDirect.cleAppareil', 'fcm:cle-a');
    let jetonsAuRetrait = null;
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('/notifications/device-tokens/current/')) {
        jetonsAuRetrait = await api.getTokens();
        return jsonRes(204, null);
      }
      return jsonRes(200, { status: true });
    });
    await auth.logoutUser({ menusFlushed: true });
    const urls = global.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe(
      'https://api.test/api/v1/notifications/device-tokens/current/?player_id=fcm%3Acle-a'
    );
    expect(global.fetch.mock.calls[0][1].method).toBe('DELETE');
    expect(urls[1]).toBe('https://api.test/api/v1/users/logout/');
    expect(jetonsAuRetrait).not.toBeNull();
    expect(await api.getTokens()).toBeNull();
    expect(mockStore.has('pushDirect.cleAppareil')).toBe(false);
  });

  test('déconnexion hors ligne : retrait en attente, gardé après l effacement des données', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('pushDirect.cleAppareil', 'fcm:cle-a');
    global.fetch.mockImplementation(async () => {
      throw new Error('Network request failed');
    });
    await auth.logoutUser({ menusFlushed: true });
    await auth.clearLocalUserData({ menusFlushed: true });
    expect(JSON.parse(mockStore.get('pushDirect.revocationsEnAttente'))).toEqual(['fcm:cle-a']);
  });

  test('suppression du compte : téléphone retiré AVANT, session encore valable', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('pushDirect.cleAppareil', 'fcm:cle-a');
    let jetonsAuRetrait = null;
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('/notifications/device-tokens/current/')) {
        jetonsAuRetrait = await api.getTokens();
        return jsonRes(204, null);
      }
      return jsonRes(200, { status: true, message: 'ok' });
    });
    const res = await auth.deleteAccount();
    expect(res.success).toBe(true);
    const urls = global.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([
      'https://api.test/api/v1/notifications/device-tokens/current/?player_id=fcm%3Acle-a',
      'https://api.test/api/v1/users/delete-user/',
    ]);
    expect(jetonsAuRetrait).not.toBeNull();
    expect(mockStore.has('pushDirect.cleAppareil')).toBe(false);
    expect(mockStore.has('pushDirect.revocationsEnAttente')).toBe(false);
  });

  test('suppression du compte, retrait hors ligne : rejoué plus tard, gardé après l effacement', async () => {
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('pushDirect.cleAppareil', 'fcm:cle-a');
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('/notifications/device-tokens/current/')) {
        throw new Error('Network request failed');
      }
      return jsonRes(200, { status: true, message: 'ok' });
    });
    const res = await auth.deleteAccount();
    expect(res.success).toBe(true);
    expect(JSON.parse(mockStore.get('pushDirect.revocationsEnAttente'))).toEqual(['fcm:cle-a']);
  });

  const simulerPushDirect = (ordre) => {
    jest.doMock('../services/pushDirect', () => ({
      retirerAppareil: jest.fn(async () => {
        ordre.push('retrait');
      }),
      enregistrerAppareil: jest.fn(async () => {
        ordre.push('enregistrement');
      }),
    }));
    auth = require('../services/auth');
  };

  test.each([
    [
      'refusée',
      async () =>
        jsonRes(403, { status: false, message: 'Only customer accounts can delete their account.' }),
    ],
    [
      'réseau coupé',
      async () => {
        throw new Error('Network request failed');
      },
    ],
  ])('suppression %s : téléphone enregistré de nouveau', async (_nom, reponse) => {
    const ordre = [];
    simulerPushDirect(ordre);
    await api.saveTokens(jwt(3600), 'R1');
    global.fetch.mockImplementation(async (url) => {
      ordre.push(String(url).replace('https://api.test/api/v1', ''));
      return reponse();
    });
    const res = await auth.deleteAccount();
    expect(res.success).toBe(false);
    expect(ordre[0]).toBe('retrait');
    expect(ordre[ordre.length - 1]).toBe('enregistrement');
    expect(ordre.filter((x) => x === 'enregistrement')).toHaveLength(1);
    jest.dontMock('../services/pushDirect');
  });

  test('suppression réussie : aucun nouvel enregistrement', async () => {
    const ordre = [];
    simulerPushDirect(ordre);
    await api.saveTokens(jwt(3600), 'R1');
    global.fetch.mockResolvedValue(jsonRes(200, { status: true, message: 'ok' }));
    const res = await auth.deleteAccount();
    expect(res.success).toBe(true);
    expect(ordre).toEqual(['retrait']);
    jest.dontMock('../services/pushDirect');
  });
});
