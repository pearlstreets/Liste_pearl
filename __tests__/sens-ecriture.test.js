// Sens d'écriture : droite à gauche pour l'arabe, rechargement unique, sans boucle.
import {
  langueEstRTL,
  decisionSens,
  appliquerSensEcriture,
  CLE_RECHARGEMENT,
  _reinitialiserPourTests,
} from '../lib/sensEcriture';

function fauxStockage(init = {}) {
  const data = { ...init };
  return {
    data,
    getItem: jest.fn(async (k) => (k in data ? data[k] : null)),
    setItem: jest.fn(async (k, v) => { data[k] = v; }),
    removeItem: jest.fn(async (k) => { delete data[k]; }),
  };
}

function fauxI18nManager(isRTL) {
  return { isRTL, allowRTL: jest.fn(), forceRTL: jest.fn() };
}

beforeEach(() => _reinitialiserPourTests());

describe('langueEstRTL', () => {
  test("l'arabe seul est de droite à gauche", () => {
    expect(langueEstRTL('ar')).toBe(true);
    expect(langueEstRTL('ar-SA')).toBe(true);
    for (const l of ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'sv', 'th']) {
      expect(langueEstRTL(l)).toBe(false);
    }
    expect(langueEstRTL(undefined)).toBe(false);
  });
});

describe('decisionSens', () => {
  test('recharge seulement si le sens effectif ne correspond pas', () => {
    expect(decisionSens('ar', false, null).recharger).toBe(true);
    expect(decisionSens('ar', true, null).recharger).toBe(false);
    expect(decisionSens('fr', true, null).recharger).toBe(true);
    expect(decisionSens('fr', false, null).recharger).toBe(false);
  });
  test('ne recharge pas deux fois vers le même sens (pas de boucle)', () => {
    expect(decisionSens('ar', false, 'rtl').recharger).toBe(false);
    expect(decisionSens('fr', true, 'ltr').recharger).toBe(false);
    // Une trace dans l'autre sens n'empêche pas le rechargement.
    expect(decisionSens('ar', false, 'ltr').recharger).toBe(true);
  });
});

describe('appliquerSensEcriture', () => {
  test("arabe sur une app gauche-droite : forceRTL(true) et un rechargement", async () => {
    const I18nManager = fauxI18nManager(false);
    const storage = fauxStockage();
    const recharger = jest.fn(async () => {});
    const r = await appliquerSensEcriture('ar', { I18nManager, storage, recharger });
    expect(r).toBe(true);
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(true);
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(storage.data[CLE_RECHARGEMENT]).toBe('rtl');
    // Second appel dans la même session : aucun nouveau rechargement.
    await appliquerSensEcriture('ar', { I18nManager, storage, recharger });
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  test('sens déjà bon : aucun rechargement, trace effacée', async () => {
    const I18nManager = fauxI18nManager(true);
    const storage = fauxStockage({ [CLE_RECHARGEMENT]: 'rtl' });
    const recharger = jest.fn(async () => {});
    const r = await appliquerSensEcriture('ar', { I18nManager, storage, recharger });
    expect(r).toBe(false);
    expect(recharger).not.toHaveBeenCalled();
    expect(storage.data[CLE_RECHARGEMENT]).toBeUndefined();
  });

  test('rechargement resté sans effet : on ne recharge plus', async () => {
    const I18nManager = fauxI18nManager(false);
    const storage = fauxStockage({ [CLE_RECHARGEMENT]: 'rtl' });
    const recharger = jest.fn(async () => {});
    const r = await appliquerSensEcriture('ar', { I18nManager, storage, recharger });
    expect(r).toBe(false);
    expect(recharger).not.toHaveBeenCalled();
  });

  test("retour au français depuis l'arabe : forceRTL(false) et un rechargement", async () => {
    const I18nManager = fauxI18nManager(true);
    const storage = fauxStockage();
    const recharger = jest.fn(async () => {});
    await appliquerSensEcriture('fr', { I18nManager, storage, recharger });
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(storage.data[CLE_RECHARGEMENT]).toBe('ltr');
  });

  test('langue gauche-droite sur app gauche-droite : rien ne change', async () => {
    const I18nManager = fauxI18nManager(false);
    const storage = fauxStockage();
    const recharger = jest.fn(async () => {});
    await appliquerSensEcriture('en', { I18nManager, storage, recharger });
    expect(recharger).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
