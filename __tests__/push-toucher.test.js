// Toucher d'une notification de commande (services/pushToucher.js) : lecture
// des données selon la plateforme, rappels et mode cuisine ignorés,
// dédoublonnage, destination en attente, recherche de la commande locale.

const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v);
  }),
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k);
  }),
}));

const mockEcoutes = new Map();
const mockRN = {
  Platform: { OS: 'android' },
  DeviceEventEmitter: {
    addListener: jest.fn((nom, fn) => {
      if (!mockEcoutes.has(nom)) mockEcoutes.set(nom, new Set());
      mockEcoutes.get(nom).add(fn);
      return { remove: () => mockEcoutes.get(nom).delete(fn) };
    }),
    emit: jest.fn((nom, ...args) => {
      (mockEcoutes.get(nom) || new Set()).forEach((fn) => fn(...args));
    }),
  },
};
jest.mock('react-native', () => mockRN);

let mockReponse;
let mockLast = null;
const mockNotif = {
  DEFAULT_ACTION_IDENTIFIER: 'defaut',
  addNotificationResponseReceivedListener: jest.fn((fn) => {
    mockReponse = fn;
    return { remove: jest.fn() };
  }),
  getLastNotificationResponseAsync: jest.fn(async () => mockLast),
  clearLastNotificationResponseAsync: jest.fn(async () => null),
};
jest.mock('expo-notifications', () => mockNotif, { virtual: true });

const toucher = require('../services/pushToucher');

const reponse = (requete, action = 'defaut') => ({
  actionIdentifier: action,
  notification: { date: 1, request: { identifier: 'id-1', ...requete } },
});
const donnees = (extra = {}) => ({
  app: 'liste',
  route: 'commande',
  msg_key: 'user_order_accepted',
  order_id: '77',
  external_order_id: 'ORD-77',
  client_order_id: '',
  notification_id: '501',
  ...extra,
});
const flush = () => new Promise((r) => setTimeout(r, 0));

let navPret;
const navRef = { isReady: () => navPret, navigate: jest.fn() };

beforeEach(async () => {
  mockStore.clear();
  mockEcoutes.clear();
  mockLast = null;
  jest.clearAllMocks();
  toucher._resetPushToucherForTests();
  await flush();
  navPret = true;
  toucher.brancherNavigation(navRef);
  toucher.definirConnexion(true);
});

const ouvertures = () =>
  mockRN.DeviceEventEmitter.emit.mock.calls.filter((c) => c[0] === toucher.EVENEMENT_OUVRIR);

describe('lecture des données', () => {
  test('content.data', () => {
    expect(toucher.donneesPushListe({ content: { data: donnees() } }).order_id).toBe('77');
  });
  test('iOS : trigger.payload quand content.data est vide', () => {
    const d = toucher.donneesPushListe({
      content: { data: {} },
      trigger: { payload: donnees({ order_id: '8' }) },
    });
    expect(d.order_id).toBe('8');
  });
  test('Android : trigger.remoteMessage.data', () => {
    const d = toucher.donneesPushListe({
      content: { data: null },
      trigger: { remoteMessage: { data: donnees({ order_id: '9' }) } },
    });
    expect(d.order_id).toBe('9');
  });
  test('rappels des menus, mode cuisine et autre app : ignorés', () => {
    expect(
      toucher.donneesPushListe({ content: { data: { source: 'menus', app: 'liste' } } })
    ).toBeNull();
    expect(
      toucher.donneesPushListe({ content: { data: { cuisine: true, app: 'liste' } } })
    ).toBeNull();
    expect(toucher.donneesPushListe({ content: { data: { route: 'OrderDetail/3' } } })).toBeNull();
    expect(toucher.donneesPushListe(null)).toBeNull();
  });
});

describe('toucher', () => {
  test('abonné au chargement : écouteur et dernière réponse', () => {
    expect(mockNotif.addNotificationResponseReceivedListener).toHaveBeenCalled();
    expect(mockNotif.getLastNotificationResponseAsync).toHaveBeenCalled();
  });

  test('ouvre le Profil, range la commande et l oublie système', async () => {
    await mockReponse(reponse({ content: { data: donnees() } }));
    expect(navRef.navigate).toHaveBeenCalledWith('profile');
    expect(ouvertures()).toHaveLength(1);
    expect(mockNotif.clearLastNotificationResponseAsync).toHaveBeenCalled();
    expect(toucher.prendreCommandeAOuvrir()).toEqual({
      route: 'commande',
      client_order_id: '',
      external_order_id: 'ORD-77',
    });
    expect(toucher.prendreCommandeAOuvrir()).toBeNull();
  });

  test('rappel touché : rien, la dernière réponse du système est gardée', async () => {
    await mockReponse(reponse({ content: { data: { source: 'menus', kind: 'plan' } } }));
    expect(navRef.navigate).not.toHaveBeenCalled();
    expect(mockNotif.clearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  test('action autre que le toucher simple : ignorée', async () => {
    await mockReponse(reponse({ content: { data: donnees() } }, 'autre'));
    expect(navRef.navigate).not.toHaveBeenCalled();
  });

  test('même toucher deux fois en moins de 5 min : une ouverture, même après rechargement', async () => {
    await mockReponse(reponse({ content: { data: donnees() } }));
    await mockReponse(reponse({ content: { data: donnees() } }));
    expect(navRef.navigate).toHaveBeenCalledTimes(1);
    // Rechargement du JS : la mémoire est vide, le stockage se souvient.
    toucher._resetPushToucherForTests();
    toucher.brancherNavigation(navRef);
    toucher.definirConnexion(true);
    await mockReponse(reponse({ content: { data: donnees() } }));
    expect(navRef.navigate).toHaveBeenCalledTimes(1);
  });

  test('après 5 min, le même toucher est de nouveau traité', async () => {
    mockStore.set(
      toucher.CLE_DERNIER_TAP,
      JSON.stringify({ cle: '501', at: Date.now() - toucher.DUREE_DERNIER_TAP - 1 })
    );
    await mockReponse(reponse({ content: { data: donnees() } }));
    expect(navRef.navigate).toHaveBeenCalledTimes(1);
  });

  test('attente tant que la navigation n est pas prête ou la session pas chargée', async () => {
    navPret = false;
    toucher.definirConnexion(false);
    await mockReponse(reponse({ content: { data: donnees() } }));
    expect(navRef.navigate).not.toHaveBeenCalled();
    navPret = true;
    toucher.consommerDestination();
    expect(navRef.navigate).not.toHaveBeenCalled();
    toucher.definirConnexion(true);
    toucher.consommerDestination();
    expect(navRef.navigate).toHaveBeenCalledTimes(1);
    toucher.consommerDestination();
    expect(navRef.navigate).toHaveBeenCalledTimes(1);
  });

  test('destination expirée après 120 s', async () => {
    navPret = false;
    const maintenant = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(maintenant);
    await mockReponse(reponse({ content: { data: donnees() } }));
    spy.mockReturnValue(maintenant + toucher.DUREE_DESTINATION + 1);
    navPret = true;
    toucher.consommerDestination();
    spy.mockRestore();
    expect(navRef.navigate).not.toHaveBeenCalled();
  });

  test('USER_DATA_CLEARED : destination oubliée', async () => {
    navPret = false;
    await mockReponse(reponse({ content: { data: donnees() } }));
    mockRN.DeviceEventEmitter.emit('USER_DATA_CLEARED');
    navPret = true;
    toucher.consommerDestination();
    expect(navRef.navigate).not.toHaveBeenCalled();
  });

  test('route inconnue : le Profil seul', async () => {
    await mockReponse(reponse({ content: { data: donnees({ route: 'ailleurs' }) } }));
    expect(navRef.navigate).toHaveBeenCalledWith('profile');
    expect(ouvertures()).toHaveLength(0);
    expect(toucher.prendreCommandeAOuvrir()).toBeNull();
  });

  test('lancement à froid : dernière réponse ouverte une fois la session chargée', async () => {
    mockLast = reponse({ content: { data: donnees({ notification_id: '900' }) } });
    toucher._resetPushToucherForTests();
    await flush();
    await flush();
    toucher.brancherNavigation(navRef);
    toucher.definirConnexion(true);
    toucher.consommerDestination();
    expect(navRef.navigate).toHaveBeenCalledWith('profile');
  });
});

describe('recherche de la commande locale', () => {
  const historique = [
    { id: 'local-1', marketplaceOrderIds: ['ORD-1', 'ORD-2'] },
    { id: 'local-2', marketplaceOrderIds: [42] },
  ];
  beforeEach(() => {
    mockStore.set('KEY_ORDER_HISTORY', JSON.stringify(historique));
  });

  test('client_order_id d abord', async () => {
    expect(
      (await toucher.trouverCommande({ client_order_id: 'local-2', external_order_id: 'ORD-1' })).id
    ).toBe('local-2');
  });
  test('sinon external_order_id dans marketplaceOrderIds', async () => {
    expect(
      (await toucher.trouverCommande({ client_order_id: '', external_order_id: 'ORD-2' })).id
    ).toBe('local-1');
    expect(
      (await toucher.trouverCommande({ client_order_id: 'inconnu', external_order_id: '42' })).id
    ).toBe('local-2');
  });
  test('introuvable ou historique illisible : null', async () => {
    expect(
      await toucher.trouverCommande({ client_order_id: 'x', external_order_id: 'y' })
    ).toBeNull();
    mockStore.set('KEY_ORDER_HISTORY', '{pas du json');
    expect(await toucher.trouverCommande({ external_order_id: 'ORD-1' })).toBeNull();
  });
});
