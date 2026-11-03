// Push en envoi direct (services/pushDirect.js) : enregistrement du téléphone,
// autorisation, jeton renouvelé, retrait et révocations en attente, module
// natif simulé ou absent.

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
}));

const mockRN = { Platform: { OS: 'android' } };
jest.mock('react-native', () => mockRN);

const mockApi = { apiJsonWithStatus: jest.fn() };
jest.mock('../services/api', () => mockApi);
jest.mock('../i18n', () => ({ __esModule: true, default: { language: 'fr', t: (k) => `t:${k}` } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.16' } },
}));

let mockEnvIos = 'production';
jest.mock(
  'expo-application',
  () => ({ getIosPushNotificationServiceEnvironmentAsync: jest.fn(async () => mockEnvIos) }),
  { virtual: true }
);

let mockPerm;
let mockJeton;
let mockSurJeton;
const mockNotif = {
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(async () => mockPerm),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  setNotificationChannelAsync: jest.fn(async () => null),
  getDevicePushTokenAsync: jest.fn(async () => mockJeton),
  addPushTokenListener: jest.fn((fn) => {
    mockSurJeton = fn;
    return { remove: jest.fn() };
  }),
};
jest.mock('expo-notifications', () => mockNotif, { virtual: true });

const push = require('../services/pushDirect');

const ok = (data) => ({ ok: true, status: 200, data });
const appelsPost = () => mockApi.apiJsonWithStatus.mock.calls.filter((c) => c[0] === 'POST');
const appelsDelete = () => mockApi.apiJsonWithStatus.mock.calls.filter((c) => c[0] === 'DELETE');

beforeEach(() => {
  mockStore.clear();
  mockRN.Platform.OS = 'android';
  mockEnvIos = 'production';
  mockPerm = { status: 'granted', granted: true };
  mockJeton = { type: 'android', data: 'JETON-A' };
  mockSurJeton = null;
  jest.clearAllMocks();
  mockApi.apiJsonWithStatus.mockImplementation(async (method) =>
    method === 'POST'
      ? ok({ onesignal_player_id: 'fcm:cle-a' })
      : { ok: true, status: 204, data: null }
  );
  push._resetPushDirectForTests();
});

describe('enregistrement', () => {
  test('Android : corps complet vers la route directe, clé gardée', async () => {
    await push.enregistrerAppareil();
    expect(appelsPost()).toHaveLength(1);
    const [, route, corps] = appelsPost()[0];
    expect(route).toBe('/notifications/device-tokens/direct/');
    expect(corps).toEqual({
      app_kind: 'liste',
      platform: 'android',
      provider: 'fcm',
      push_token: 'JETON-A',
      app_version: '1.0.16',
      langue: 'fr',
    });
    expect(mockStore.get(push.CLE_APPAREIL)).toBe('fcm:cle-a');
    // Canal des commandes créé avant l'envoi, nom traduit.
    expect(mockNotif.setNotificationChannelAsync).toHaveBeenCalledWith(
      'commandes',
      expect.objectContaining({
        importance: 4,
        sound: 'default',
        name: 't:notifications.channelOrders',
      })
    );
  });

  test('iPhone : apns en production, apns_sandbox en développement', async () => {
    mockRN.Platform.OS = 'ios';
    mockJeton = { type: 'ios', data: 'APNS-1' };
    await push.enregistrerAppareil();
    expect(appelsPost()[0][2]).toEqual(
      expect.objectContaining({ platform: 'ios', provider: 'apns' })
    );
    expect(mockNotif.setNotificationChannelAsync).not.toHaveBeenCalled();

    mockStore.clear();
    jest.clearAllMocks();
    push._resetPushDirectForTests();
    mockEnvIos = 'development';
    await push.enregistrerAppareil();
    expect(appelsPost()[0][2].provider).toBe('apns_sandbox');
  });

  test('autorisation refusée : aucun appel, jamais de demande ici', async () => {
    mockPerm = { status: 'denied', granted: false, canAskAgain: true };
    await push.enregistrerAppareil();
    expect(mockApi.apiJsonWithStatus).not.toHaveBeenCalled();
    expect(mockNotif.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('jeton inchangé : pas de second envoi, langue changée avec force : renvoyé', async () => {
    await push.enregistrerAppareil();
    await push.enregistrerAppareil();
    expect(appelsPost()).toHaveLength(1);
    await push.enregistrerAppareil({ force: true });
    expect(appelsPost()).toHaveLength(2);
  });

  test('une seule promesse en vol', async () => {
    const a = push.enregistrerAppareil();
    const b = push.enregistrerAppareil();
    expect(a).toBe(b);
    await a;
    expect(appelsPost()).toHaveLength(1);
  });

  test('jeton renouvelé : replaces_player_id et retrait de l ancienne clé', async () => {
    await push.enregistrerAppareil();
    expect(typeof mockSurJeton).toBe('function');
    mockApi.apiJsonWithStatus.mockImplementation(async (method) =>
      method === 'POST'
        ? ok({ onesignal_player_id: 'fcm:cle-b' })
        : { ok: true, status: 204, data: null }
    );
    await mockSurJeton({ type: 'android', data: 'JETON-B' });
    const dernier = appelsPost()[1][2];
    expect(dernier.push_token).toBe('JETON-B');
    expect(dernier.replaces_player_id).toBe('fcm:cle-a');
    expect(appelsDelete()[0][1]).toBe(
      '/notifications/device-tokens/current/?player_id=fcm%3Acle-a'
    );
    expect(mockStore.get(push.CLE_APPAREIL)).toBe('fcm:cle-b');
  });
});

describe('autorisation', () => {
  test('demandée une seule fois, avec les options iOS des rappels', async () => {
    mockPerm = { status: 'undetermined', granted: false, canAskAgain: true };
    mockNotif.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied', granted: false });
    expect(await push.demanderPermission()).toBe(false);
    expect(mockNotif.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    // Nouveau lancement : la demande n'est pas refaite.
    push._resetPushDirectForTests();
    expect(await push.demanderPermission()).toBe(false);
    expect(mockNotif.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  test('déjà accordée : aucune demande', async () => {
    expect(await push.demanderPermission()).toBe(true);
    expect(mockNotif.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('retrait', () => {
  const avecCle = async () => {
    await push.enregistrerAppareil();
    jest.clearAllMocks();
  };

  test.each([
    [204, true],
    [404, false],
  ])('statut %s : fait, rien en attente', async (statut, okFlag) => {
    await avecCle();
    mockApi.apiJsonWithStatus.mockResolvedValueOnce({ ok: okFlag, status: statut, data: null });
    await push.retirerAppareil();
    const [, route, corps, opts] = appelsDelete()[0];
    expect(route).toBe('/notifications/device-tokens/current/?player_id=fcm%3Acle-a');
    expect(corps).toBeUndefined();
    expect(opts).toEqual({ timeoutMs: 4000 });
    expect(mockStore.has(push.CLE_REVOCATIONS)).toBe(false);
    expect(mockStore.has(push.CLE_APPAREIL)).toBe(false);
    expect(mockStore.has(push.CLE_DERNIER_JETON)).toBe(false);
  });

  test('500 puis délai dépassé : révocation en attente, rejouée au prochain enregistrement', async () => {
    await avecCle();
    mockApi.apiJsonWithStatus.mockResolvedValueOnce({ ok: false, status: 500, data: null });
    await push.retirerAppareil();
    expect(JSON.parse(mockStore.get(push.CLE_REVOCATIONS))).toEqual(['fcm:cle-a']);
    expect(mockStore.has(push.CLE_APPAREIL)).toBe(false);

    // Nouvel essai qui échoue encore (délai) : la clé reste en attente.
    mockApi.apiJsonWithStatus.mockImplementation(async (method) => {
      if (method === 'DELETE') throw new Error('Aborted');
      return ok({ onesignal_player_id: 'fcm:cle-a' });
    });
    await push.enregistrerAppareil();
    expect(JSON.parse(mockStore.get(push.CLE_REVOCATIONS))).toEqual(['fcm:cle-a']);

    // Réseau revenu : rejouée AVANT l'envoi du jeton, puis oubliée.
    jest.clearAllMocks();
    mockApi.apiJsonWithStatus.mockImplementation(async (method) =>
      method === 'POST'
        ? ok({ onesignal_player_id: 'fcm:cle-a' })
        : { ok: true, status: 204, data: null }
    );
    await push.enregistrerAppareil({ force: true });
    const ordre = mockApi.apiJsonWithStatus.mock.calls.map((c) => c[0]);
    expect(ordre).toEqual(['DELETE', 'POST']);
    expect(mockStore.has(push.CLE_REVOCATIONS)).toBe(false);
  });

  test('sans clé : aucun appel', async () => {
    await push.retirerAppareil();
    expect(mockApi.apiJsonWithStatus).not.toHaveBeenCalled();
  });

  test('oublierAppareilLocal : clé effacée sans appel réseau', async () => {
    await avecCle();
    await push.oublierAppareilLocal();
    expect(mockApi.apiJsonWithStatus).not.toHaveBeenCalled();
    expect(mockStore.has(push.CLE_APPAREIL)).toBe(false);
    expect(mockStore.has(push.CLE_DERNIER_JETON)).toBe(false);
  });
});

describe('sans module natif', () => {
  test('web : rien ne lève, rien n est envoyé', async () => {
    mockRN.Platform.OS = 'web';
    await expect(push.enregistrerAppareil()).resolves.toBeUndefined();
    await expect(push.demanderPermission()).resolves.toBe(false);
    await expect(push.retirerAppareil()).resolves.toBeUndefined();
    await expect(push.oublierAppareilLocal()).resolves.toBeUndefined();
    expect(mockApi.apiJsonWithStatus).not.toHaveBeenCalled();
  });

  test('module natif qui lève : rien ne lève', async () => {
    mockNotif.getDevicePushTokenAsync.mockRejectedValueOnce(new Error('Play Services absent'));
    await expect(push.enregistrerAppareil()).resolves.toBeUndefined();
    mockNotif.getPermissionsAsync.mockRejectedValueOnce(new Error('natif'));
    await expect(push.demanderPermission()).resolves.toBe(false);
    mockApi.apiJsonWithStatus.mockRejectedValueOnce(new Error('réseau'));
    await expect(push.enregistrerAppareil()).resolves.toBeUndefined();
  });

  test('les noms de clés restent hors du ménage de la déconnexion', () => {
    for (const k of [
      push.CLE_APPAREIL,
      push.CLE_DERNIER_JETON,
      push.CLE_REVOCATIONS,
      push.CLE_PERMISSION_DEMANDEE,
    ]) {
      expect(
        k.startsWith('SG_ITEMS__') || k.startsWith('USER_') || k.startsWith('__SECURE__')
      ).toBe(false);
    }
  });
});
