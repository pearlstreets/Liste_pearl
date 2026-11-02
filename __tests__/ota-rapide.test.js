const mockUpdates = {
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(async () => {}),
};
jest.mock('expo-updates', () => mockUpdates, { virtual: true });

let mockClavier = false;
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Keyboard: { isVisible: () => mockClavier },
}));

let mockCuisine = false;
jest.mock('../services/cookAlerts', () => ({ cookScreenOpen: () => mockCuisine }));

import {
  verifierEtRecharger,
  demarrerOtaRapide,
  marquerPaiement,
  rechargementPossible,
  _resetOtaRapidePourTests,
  DELAI_MAX_MS,
  INTERVALLE_MIN_MS,
} from '../services/otaRapide';

const disponible = () => {
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
  mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
};

function faussesAppState() {
  let ecouteur = null;
  return {
    addEventListener: jest.fn((_e, f) => {
      ecouteur = f;
      return { remove: jest.fn() };
    }),
    emettre: (etat) => ecouteur && ecouteur(etat),
  };
}

const vider = () => new Promise((r) => jest.requireActual('timers').setImmediate(r));

beforeEach(() => {
  global.__DEV__ = false;
  mockUpdates.isEnabled = true;
  mockClavier = false;
  mockCuisine = false;
  jest.clearAllMocks();
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
  mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: false });
  _resetOtaRapidePourTests();
  jest.useRealTimers();
});

describe('verifierEtRecharger', () => {
  test('mise à jour rapide : recharge', async () => {
    disponible();
    await expect(verifierEtRecharger()).resolves.toBe('recharge');
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  test('aucune mise à jour : ni téléchargement ni rechargement', async () => {
    await expect(verifierEtRecharger()).resolves.toBe('aucune');
    expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  test('mode cuisine ouvert : pas de rechargement', async () => {
    disponible();
    mockCuisine = true;
    await expect(verifierEtRecharger()).resolves.toBe('bloque');
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  test('paiement en cours : pas de rechargement, puis possible après fermeture', async () => {
    disponible();
    marquerPaiement('paiement-carte', true);
    await expect(verifierEtRecharger()).resolves.toBe('bloque');
    marquerPaiement('paiement-carte', false);
    expect(rechargementPossible()).toBe(true);
  });

  test('clavier ouvert : pas de rechargement', async () => {
    disponible();
    mockClavier = true;
    await expect(verifierEtRecharger()).resolves.toBe('bloque');
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  test('plus de 5 s : abandon, pas de rechargement', async () => {
    jest.useFakeTimers();
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    let finir;
    mockUpdates.fetchUpdateAsync.mockReturnValue(new Promise((r) => (finir = r)));
    const p = verifierEtRecharger();
    await jest.advanceTimersByTimeAsync(DELAI_MAX_MS + 10);
    await expect(p).resolves.toBe('trop-lent');
    finir({ isNew: true });
    await Promise.resolve();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  test('erreur réseau : aucun plantage', async () => {
    mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error('réseau'));
    await expect(verifierEtRecharger()).resolves.toBe('aucune');
  });

  test('développement ou updates désactivé : sans effet', async () => {
    global.__DEV__ = true;
    await expect(verifierEtRecharger()).resolves.toBe('indisponible');
    global.__DEV__ = false;
    mockUpdates.isEnabled = false;
    await expect(verifierEtRecharger()).resolves.toBe('indisponible');
    expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  test('une seule vérification à la fois', async () => {
    let finir;
    mockUpdates.checkForUpdateAsync.mockReturnValue(new Promise((r) => (finir = r)));
    const p1 = verifierEtRecharger();
    await expect(verifierEtRecharger()).resolves.toBe('occupe');
    finir({ isAvailable: false });
    await expect(p1).resolves.toBe('aucune');
  });
});

describe('demarrerOtaRapide', () => {
  test('vérifie au lancement, une seule fois même si appelé deux fois', async () => {
    const AS = faussesAppState();
    demarrerOtaRapide(AS);
    demarrerOtaRapide(AS);
    await vider();
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(AS.addEventListener).toHaveBeenCalledTimes(1);
  });

  test('retour au premier plan : seulement après plus de 30 min en arrière-plan', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    jest.setSystemTime(new Date('2026-11-03T08:00:00Z'));
    const AS = faussesAppState();
    demarrerOtaRapide(AS);
    await vider();
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

    // 10 min en fond : rien.
    AS.emettre('background');
    jest.setSystemTime(Date.now() + 10 * 60 * 1000);
    AS.emettre('active');
    await vider();
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

    // Plus de 30 min en fond : nouvelle vérification, et rechargement si prête.
    disponible();
    AS.emettre('background');
    jest.setSystemTime(Date.now() + INTERVALLE_MIN_MS + 1000);
    AS.emettre('active');
    await vider();
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(2);
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  test('retour au premier plan en mode cuisine : téléchargée mais pas rechargée', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    jest.setSystemTime(new Date('2026-11-03T08:00:00Z'));
    const AS = faussesAppState();
    demarrerOtaRapide(AS);
    await vider();
    disponible();
    mockCuisine = true;
    AS.emettre('background');
    jest.setSystemTime(Date.now() + INTERVALLE_MIN_MS + 1000);
    AS.emettre('active');
    await vider();
    expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });
});
