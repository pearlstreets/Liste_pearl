// Mode cuisine : nom du canal Android et alarmes refaits au changement de langue.
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  multiRemove: jest.fn(async () => {}),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Vibration: { vibrate: jest.fn() },
}));
jest.mock('../services/api', () => ({
  getTokens: jest.fn(async () => null),
  apiJsonWithStatus: jest.fn(async () => ({ ok: false, status: 500 })),
}));
jest.mock('../services/secureStorage', () => ({
  getSecureItem: jest.fn(async () => null),
}));

function fauxNatif() {
  const sched = [];
  const nat = {
    scheduleNotificationAsync: jest.fn(async (x) => sched.push(x.identifier)),
    cancelScheduledNotificationAsync: jest.fn(async (id) => {
      const i = sched.indexOf(id);
      if (i >= 0) sched.splice(i, 1);
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () =>
      sched.map((identifier) => ({ identifier }))
    ),
    getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
    setNotificationChannelAsync: jest.fn(async () => {}),
    AndroidImportance: { HIGH: 4 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  };
  return { nat, sched };
}

describe('mode cuisine, langue de l app', () => {
  beforeEach(() => jest.resetModules());

  test('le canal est renommé quand la langue change, pas recréé sinon', async () => {
    const { nat } = fauxNatif();
    jest.doMock('expo-notifications', () => nat, { virtual: true });
    const a = require('../services/cookAlerts');
    a._resetCookAlertsForTests();
    await a.scheduleCookAlarms([{ id: 'eau', inSec: 60, title: 'L’eau bout', body: 'b' }], 'Cuisine', 'g');
    await a.scheduleCookAlarms([{ id: 'eau', inSec: 120, title: 'L’eau bout', body: 'b' }], 'Cuisine', 'g');
    expect(nat.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    await a.scheduleCookAlarms([{ id: 'eau', inSec: 120, title: 'Water boils', body: 'b' }], 'Cooking', 'g');
    expect(nat.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
    expect(nat.setNotificationChannelAsync.mock.calls[1][1].name).toBe('Cooking');
  });

  test('mêmes alarmes dans une autre langue : reprogrammées avec les nouveaux textes', async () => {
    const { nat, sched } = fauxNatif();
    jest.doMock('expo-notifications', () => nat, { virtual: true });
    const a = require('../services/cookAlerts');
    a._resetCookAlertsForTests();
    await a.scheduleCookAlarms([{ id: 'eau', inSec: 300, title: 'Minuteur terminé', body: 'Pâtes' }], 'Cuisine', 'g');
    expect(nat.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    // Même appel, même langue : rien n'est refait.
    await a.scheduleCookAlarms([{ id: 'eau', inSec: 300, title: 'Minuteur terminé', body: 'Pâtes' }], 'Cuisine', 'g');
    expect(nat.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    await a.scheduleCookAlarms([{ id: 'eau', inSec: 300, title: 'Timer done', body: 'Pasta' }], 'Cooking', 'g');
    expect(nat.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(nat.scheduleNotificationAsync.mock.calls[1][0].content.title).toBe('Timer done');
    expect(sched).toEqual(['cuisine-g:eau']);
  });
});
