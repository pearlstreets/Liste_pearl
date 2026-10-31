// Rappels des menus : calendrier, réglages corrompus, sauvegarde, module natif simulé ou absent.
const fs = require('fs');
const path = require('path');

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
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../services/api', () => ({
  getTokens: jest.fn(async () => null),
  apiJsonWithStatus: jest.fn(async () => ({ ok: false, status: 500 })),
}));
jest.mock('../services/secureStorage', () => ({
  getSecureItem: jest.fn(async () => null),
}));

const mockCal = new Map();
let mockPerm;
let mockLast;
let mockReponse;
const mockNotif = {
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly', DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'defaut',
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => mockPerm),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () =>
    [...mockCal.keys()].map((identifier) => ({ identifier }))
  ),
  cancelScheduledNotificationAsync: jest.fn(async (id) => {
    mockCal.delete(id);
  }),
  scheduleNotificationAsync: jest.fn(async (n) => {
    mockCal.set(n.identifier, n);
    return n.identifier;
  }),
  addNotificationResponseReceivedListener: jest.fn((fn) => {
    mockReponse = fn;
    return { remove: jest.fn() };
  }),
  getLastNotificationResponseAsync: jest.fn(async () => mockLast),
};
jest.mock('expo-notifications', () => mockNotif, { virtual: true });

const {
  buildReminderSchedule,
  cleanReminders,
  defaultReminders,
  needsPrep,
  prepDays,
  reminderTarget,
  toTriggerWeekday,
  REMINDER_PLAN_ID,
  REMINDER_SHOP_ID,
} = require('../lib/menus/reminders');
const storage = require('../lib/menus/storage');
const { mergeData, SYNC_KEYS } = require('../lib/menus/sync');
const service = require('../services/menuReminders');

const INGREDIENTS = {
  poulet: { aisle: 'viandes-poissons' },
  crevette: { aisle: 'surgeles', allergens: ['crustaces'] },
  riz: { aisle: 'epicerie' },
};
const VIANDE = { id: 'r-viande', timeMin: 30, ingredients: [{ key: 'poulet' }] };
const CREVETTE = { id: 'r-crevette', timeMin: 20, ingredients: [{ key: 'crevette' }] };
const LONGUE = { id: 'r-longue', timeMin: 61, ingredients: [{ key: 'riz' }] };
const SIMPLE = { id: 'r-simple', timeMin: 60, ingredients: [{ key: 'riz' }, { key: 'libre|x' }] };
const recipeById = new Map([VIANDE, CREVETTE, LONGUE, SIMPLE].map((r) => [r.id, r]));
const t = (k, o) => (o && o.recipes ? `${k}:${o.recipes}` : k);
const texts = { recipeTitle: (id) => `Titre ${id}` };

// Lundi 2 novembre 2026.
const plan = (meals) => ({ weekStart: '2026-11-02', meals });
const repas = (key, recipeId, extra = {}) => ({ key, recipeId, ...extra });
const LUNDI_MATIN = new Date(2026, 10, 2, 8, 0, 0);

const actifs = () => ({
  plan: { on: true, weekday: 6, hour: 10, minute: 0 },
  shop: { on: true, weekday: 5, hour: 9, minute: 30 },
  prep: { on: true },
});

describe('réglages', () => {
  it('sont désactivés par défaut, dimanche et samedi à 10 h', () => {
    expect(defaultReminders()).toEqual({
      plan: { on: false, weekday: 6, hour: 10, minute: 0 },
      shop: { on: false, weekday: 5, hour: 10, minute: 0 },
      prep: { on: false },
    });
  });

  it('ignorent toute valeur corrompue sans lever', () => {
    for (const v of [null, 3, 'x', [], { plan: 'oui' }, { prep: 1, shop: { on: 'true' } }])
      expect(cleanReminders(v)).toEqual(defaultReminders());
    expect(cleanReminders({ plan: { on: true, weekday: 9, hour: 25, minute: -1 } }).plan).toEqual({
      on: true,
      weekday: 6,
      hour: 10,
      minute: 0,
    });
  });

  it('convertissent le jour vers le déclencheur (1 = dimanche)', () => {
    expect(toTriggerWeekday(0)).toBe(2);
    expect(toTriggerWeekday(5)).toBe(7);
    expect(toTriggerWeekday(6)).toBe(1);
  });
});

describe('préparation la veille', () => {
  it('retient viande, poisson ou fruits de mer, ou plus de 60 minutes strictement', () => {
    expect(needsPrep(VIANDE, INGREDIENTS)).toBe(true);
    expect(needsPrep(CREVETTE, INGREDIENTS)).toBe(true);
    expect(needsPrep(LONGUE, INGREDIENTS)).toBe(true);
    expect(needsPrep(SIMPLE, INGREDIENTS)).toBe(false);
    expect(needsPrep(null, INGREDIENTS)).toBe(false);
  });

  it('prévient à 19 h la veille, un seul rappel par jour', () => {
    const d = prepDays({
      plan: plan([repas('2-midi', 'r-viande'), repas('2-soir', 'r-longue')]),
      recipeById,
      ingredients: INGREDIENTS,
      now: LUNDI_MATIN,
    });
    expect(d).toHaveLength(1);
    expect(d[0].day).toBe('2026-11-04');
    expect(d[0].at).toEqual(new Date(2026, 10, 3, 19, 0, 0));
    expect(d[0].meals).toHaveLength(2);
  });

  it('ignore restes, soirs libres, recettes inconnues, veilles passées et plan corrompu', () => {
    const ctx = { recipeById, ingredients: INGREDIENTS, now: LUNDI_MATIN };
    expect(
      prepDays({
        ...ctx,
        plan: plan([
          repas('3-midi', 'r-viande', { leftoverOf: '2-soir' }),
          repas('3-soir', 'r-viande', { free: true }),
          repas('4-soir', 'inconnue'),
          repas('0-soir', 'r-viande'),
          repas('zzz', 'r-viande'),
          null,
        ]),
      })
    ).toEqual([]);
    expect(prepDays({ ...ctx, plan: null })).toEqual([]);
    expect(prepDays({ ...ctx, plan: { weekStart: 'x', meals: 'y' } })).toEqual([]);
  });

  it('prépare le lundi le dimanche soir qui précède', () => {
    const d = prepDays({
      plan: plan([repas('0-soir', 'r-viande')]),
      recipeById,
      ingredients: INGREDIENTS,
      now: new Date(2026, 10, 1, 8, 0, 0),
    });
    expect(d[0].at).toEqual(new Date(2026, 10, 1, 19, 0, 0));
  });
});

describe('calendrier', () => {
  const base = { recipeById, ingredients: INGREDIENTS, texts, t, now: LUNDI_MATIN };

  it('est vide par défaut', () => {
    expect(
      buildReminderSchedule({
        ...base,
        reminders: defaultReminders(),
        plan: plan([repas('2-soir', 'r-viande')]),
      })
    ).toEqual([]);
  });

  it('contient les trois rappels, avec des identifiants stables et la bonne destination', () => {
    const faire = () =>
      buildReminderSchedule({
        ...base,
        reminders: actifs(),
        plan: plan([repas('2-soir', 'r-viande')]),
      });
    const a = faire();
    expect(a.map((x) => x.identifier)).toEqual([
      REMINDER_PLAN_ID,
      REMINDER_SHOP_ID,
      'menus-rappel-veille-2026-11-04',
    ]);
    expect(faire().map((x) => x.identifier)).toEqual(a.map((x) => x.identifier));
    expect(a[0].trigger).toEqual({ type: 'weekly', weekday: 1, hour: 10, minute: 0 });
    expect(a[1].trigger).toEqual({ type: 'weekly', weekday: 7, hour: 9, minute: 30 });
    expect(a[1].content.data.target).toBe('shop');
    expect(a[2].content.body).toBe('reminders.prepBody:Titre r-viande');
    expect(a[2].content.data).toMatchObject({ recipeId: 'r-viande', mealKey: '2-soir' });
  });

  it('ouvre la semaine, sans recette précise, quand plusieurs recettes sont concernées', () => {
    const [p] = buildReminderSchedule({
      ...base,
      reminders: { prep: { on: true } },
      plan: plan([repas('2-midi', 'r-viande'), repas('2-soir', 'r-longue')]),
    });
    expect(p.content.data.recipeId).toBeUndefined();
    expect(p.content.body).toBe('reminders.prepBody:Titre r-viande, Titre r-longue');
  });
});

describe('destination', () => {
  it('refuse une donnée étrangère et assainit le reste', () => {
    expect(reminderTarget(null)).toBeNull();
    expect(reminderTarget({ source: 'autre', target: 'shop' })).toBeNull();
    expect(reminderTarget({ source: 'menus', target: 'x', recipeId: 3 })).toEqual({
      target: 'week',
      recipeId: null,
      mealKey: null,
    });
  });
});

describe('sauvegarde sur le compte', () => {
  it('fait partie des clés sauvegardées, la permission non', () => {
    expect(SYNC_KEYS).toContain('reminders');
    expect(SYNC_KEYS.join(' ')).not.toMatch(/permission/i);
  });

  it('fusionne au plus récent et écarte une entrée illisible', () => {
    const ancien = { u: 1, v: defaultReminders() };
    const recent = { u: 2, v: actifs() };
    expect(mergeData({ reminders: ancien }, { reminders: recent }).data.reminders).toEqual(recent);
    expect(
      mergeData({ reminders: { u: 3, v: 'x' } }, { reminders: recent }).data.reminders
    ).toEqual(recent);
  });

  it('relit sans lever une valeur corrompue du stockage', async () => {
    mockStore.set(storage.MENUS_KEY.reminders, '{pas du json');
    await expect(storage.loadReminders()).resolves.toEqual(defaultReminders());
    mockStore.set(storage.MENUS_KEY.reminders, JSON.stringify({ v: 1, data: [1] }));
    await expect(storage.loadReminders()).resolves.toEqual(defaultReminders());
  });
});

describe('programmation', () => {
  const i18n = {
    language: 'fr',
    t: (k) => k,
    on: jest.fn(),
    off: jest.fn(),
  };
  const planFutur = () => {
    const lundi = new Date();
    lundi.setDate(lundi.getDate() + 14);
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
    const p2 = (n) => String(n).padStart(2, '0');
    return {
      weekStart: `${lundi.getFullYear()}-${p2(lundi.getMonth() + 1)}-${p2(lundi.getDate())}`,
      meals: [repas('2-soir', 'poulet-roti-citron-pommes-de-terre')],
    };
  };

  beforeEach(async () => {
    service._resetMenuRemindersForTests();
    mockStore.clear();
    mockCal.clear();
    mockPerm = { status: 'granted', granted: true };
    mockLast = null;
    mockReponse = null;
    jest.clearAllMocks();
  });

  it('ne programme rien et ne demande rien tant que tout est désactivé', async () => {
    await service.startMenuReminders(null, i18n);
    expect(mockNotif.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockNotif.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('ne laisse aucun doublon après plusieurs reprogrammations', async () => {
    await storage.saveReminders(actifs());
    await storage.savePlan(planFutur());
    await service.startMenuReminders(null, i18n);
    await service.refreshMenuReminders();
    await service.refreshMenuReminders();
    expect([...mockCal.keys()]).toHaveLength(3);
    const n = mockCal.get(REMINDER_PLAN_ID);
    expect(n.trigger).toMatchObject({ type: 'weekly', channelId: 'menus-rappels' });
    expect(mockNotif.setNotificationChannelAsync).toHaveBeenCalled();
  });

  it('retire ce qui n est plus voulu sans toucher aux autres notifications', async () => {
    mockCal.set('autre-notification', {});
    await storage.saveReminders(actifs());
    await service.startMenuReminders(null, i18n);
    await storage.saveReminders({ ...actifs(), shop: { on: false } });
    await service.refreshMenuReminders();
    expect(mockCal.has(REMINDER_SHOP_ID)).toBe(false);
    expect(mockCal.has(REMINDER_PLAN_ID)).toBe(true);
    expect(mockCal.has('autre-notification')).toBe(true);
  });

  it('ne programme rien sur un appareil sans permission, même rappel activé sur le compte', async () => {
    mockPerm = { status: 'denied', granted: false, canAskAgain: false };
    await storage.saveReminders(actifs());
    await service.startMenuReminders(null, i18n);
    expect(mockCal.size).toBe(0);
    expect(mockNotif.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reprogramme après une écriture du plan', async () => {
    jest.useFakeTimers();
    try {
      await storage.saveReminders({ prep: { on: true } });
      await service.startMenuReminders(null, i18n);
      expect(mockCal.size).toBe(0);
      await storage.savePlan(planFutur());
      await jest.advanceTimersByTimeAsync(service.REFRESH_DELAY_MS + 10);
      await service.refreshMenuReminders();
      expect(mockCal.size).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('annule tout à la déconnexion, et ne garde pas d écoute active pour rien', async () => {
    mockCal.set('autre-notification', {});
    await storage.saveReminders(actifs());
    await service.startMenuReminders(null, i18n);
    await service.cancelMenuReminders();
    expect([...mockCal.keys()]).toEqual(['autre-notification']);
  });

  it('une erreur native n atteint jamais l appelant', async () => {
    await storage.saveReminders(actifs());
    mockNotif.scheduleNotificationAsync.mockRejectedValueOnce(new Error('natif'));
    mockNotif.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('natif'));
    await expect(service.startMenuReminders(null, i18n)).resolves.toBeUndefined();
    mockNotif.getPermissionsAsync.mockRejectedValueOnce(new Error('natif'));
    await expect(service.getMenuReminderPermission()).resolves.toMatchObject({
      available: false,
      granted: false,
    });
  });

  it('garde la destination d une notification touchée, une seule fois', async () => {
    const reponse = {
      actionIdentifier: 'defaut',
      notification: {
        date: 12,
        request: {
          identifier: REMINDER_SHOP_ID,
          content: { data: { source: 'menus', target: 'shop' } },
        },
      },
    };
    mockLast = reponse;
    const ouvert = jest.fn();
    service.onMenuReminderOpen(ouvert);
    await service.startMenuReminders(null, i18n);
    await Promise.resolve();
    mockReponse(reponse); // lancement à froid : même réponse par les deux chemins
    expect(ouvert).toHaveBeenCalledTimes(1);
    expect(service.hasPendingMenuReminder()).toBe(true);
    expect(service.takePendingMenuReminder()).toMatchObject({ target: 'shop' });
    expect(service.takePendingMenuReminder()).toBeNull();
  });

  it('ignore une notification qui ne vient pas des rappels', async () => {
    await service.startMenuReminders(null, i18n);
    mockReponse({ notification: { request: { identifier: 'x', content: { data: {} } } } });
    mockReponse(null);
    expect(service.hasPendingMenuReminder()).toBe(false);
  });
});

describe('module natif absent', () => {
  it('rend tout sans effet, sans jamais lever', async () => {
    jest.resetModules();
    jest.doMock(
      'expo-notifications',
      () => {
        throw new Error('Cannot find native module');
      },
      { virtual: true }
    );
    const s = require('../services/menuReminders');
    await expect(s.startMenuReminders(null, { t: (k) => k })).resolves.toBeUndefined();
    await expect(s.refreshMenuReminders()).resolves.toBeUndefined();
    await expect(s.cancelMenuReminders()).resolves.toBeUndefined();
    await expect(s.getMenuReminderPermission()).resolves.toMatchObject({ available: false });
    await expect(s.requestMenuReminderPermission()).resolves.toMatchObject({ granted: false });
    jest.dontMock('expo-notifications');
  });
});

describe('textes', () => {
  const LANGS = 'fr en de es it pt nl ru zh ja ar sv th'.split(' ');
  const lire = (l) =>
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', `${l}.json`), 'utf8'));

  it('existent dans les 13 langues, sans tiret cadratin ni flèche', () => {
    const cles = Object.keys(lire('fr').menus.reminders).sort();
    for (const l of LANGS) {
      const r = lire(l).menus.reminders;
      expect(Object.keys(r).sort()).toEqual(cles);
      for (const v of Object.values(r)) {
        expect(v.trim()).not.toBe('');
        expect(v).not.toMatch(/[—→]/);
      }
      expect(r.prepBody).toContain('{{recipes}}');
    }
  });
});
