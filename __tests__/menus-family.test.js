// Semaine partagée en famille : réglage, lecture de la réponse du serveur, accès sans compte.
import { cleanFamilyShare, cleanSharedWeeks, defaultFamilyShare } from '../lib/menus/sharedWeek';
import { SYNC_KEYS, SYNC_SHAPES, mergeSync } from '../lib/menus/sync';
import { MENUS_KEY } from '../lib/menus/storage';
import { fetchSharedWeeks } from '../services/sharedMenus';
import { apiJsonWithStatus, getTokens } from '../services/api';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
  multiRemove: jest.fn(async () => {}),
}));
jest.mock('../services/api', () => ({
  apiJsonWithStatus: jest.fn(),
  getTokens: jest.fn(),
}));

const SEMAINE = {
  name: 'Maman',
  week: {
    week_start: '2026-11-02',
    meals: [
      { key: '0-midi', free: false, recipe_id: 'boeuf', persons: 4 },
      { key: '0-soir', free: true, recipe_id: null, persons: null },
      {
        key: '1-soir',
        free: false,
        recipe_id: null,
        persons: 2,
        title: 'Tarte',
        photo: 'https://a.test/p.webp',
      },
    ],
  },
};

describe('réglage familyShare', () => {
  test('coupé par défaut, seul true exact active', () => {
    expect(defaultFamilyShare()).toEqual({ enabled: false });
    expect(cleanFamilyShare({ enabled: true })).toEqual({ enabled: true });
    for (const v of [null, undefined, 1, 'true', {}, { enabled: 'true' }, { enabled: 1 }])
      expect(cleanFamilyShare(v)).toEqual({ enabled: false });
  });

  test('part avec la synchronisation', () => {
    expect(SYNC_KEYS).toContain('familyShare');
    expect(SYNC_SHAPES.familyShare({ enabled: true })).toBe(true);
    expect(MENUS_KEY.familyShare).toBe('MENUS_FAMILY_SHARE');
  });
});

describe('conflit entre deux téléphones sur familyShare', () => {
  const fusion = (local, distant) =>
    mergeSync(
      { familyShare: { u: local.u, v: { enabled: local.on } } },
      { familyShare: { u: distant.u, v: { enabled: distant.on } } },
      { dirty: { familyShare: true }, base: { familyShare: 1 } }
    );

  test('couper gagne même avec une horloge en retard', () => {
    const r = fusion({ u: 100, on: false }, { u: 200, on: true });
    expect(r.data.familyShare.v).toEqual({ enabled: false });
    expect(r.data.familyShare.u).toBeGreaterThan(200);
    expect(r.toApply).toContain('familyShare');
    expect(r.toPush).toContain('familyShare');
  });

  test('couper gagne aussi quand il vient du serveur', () => {
    const r = fusion({ u: 100, on: true }, { u: 200, on: false });
    expect(r.data.familyShare.v).toEqual({ enabled: false });
  });

  test('sans conflit, rallumer reste possible', () => {
    const r = mergeSync(
      { familyShare: { u: 300, v: { enabled: true } } },
      { familyShare: { u: 200, v: { enabled: false } } },
      { dirty: { familyShare: true }, base: { familyShare: 200 } }
    );
    expect(r.data.familyShare.v).toEqual({ enabled: true });
  });
});

describe('cleanSharedWeeks', () => {
  test('deux proches au même pseudo gardent chacun leur clé', () => {
    const [a, b] = cleanSharedWeeks({ weeks: [SEMAINE, SEMAINE] });
    expect(a.id).not.toBe(b.id);
  });

  test('garde les trois formes de repas', () => {
    expect(cleanSharedWeeks({ weeks: [SEMAINE] })).toEqual([
      {
        id: 0,
        name: 'Maman',
        weekStart: '2026-11-02',
        meals: [
          {
            key: '0-midi',
            day: 0,
            slot: 'midi',
            free: false,
            recipeId: 'boeuf',
            persons: 4,
            title: '',
            photo: '',
          },
          { key: '0-soir', day: 0, slot: 'soir', free: true },
          {
            key: '1-soir',
            day: 1,
            slot: 'soir',
            free: false,
            recipeId: null,
            persons: 2,
            title: 'Tarte',
            photo: 'https://a.test/p.webp',
          },
        ],
      },
    ]);
  });

  test('photo non https écartée', () => {
    const w = JSON.parse(JSON.stringify(SEMAINE));
    w.week.meals[2].photo = 'http://a.test/p.webp';
    expect(cleanSharedWeeks({ weeks: [w] })[0].meals[2].photo).toBe('');
  });

  test.each([
    [null],
    [{}],
    [{ weeks: 'x' }],
    [{ weeks: [null, 3, { name: 'A' }, { name: 'A', week: null }] }],
    [{ weeks: [{ name: '', week: SEMAINE.week }] }],
    [{ weeks: [{ name: 'A', week: { week_start: 'demain', meals: [] } }] }],
    [{ weeks: [{ name: 'A', week: { week_start: '2026-11-02', meals: [] } }] }],
    [
      {
        weeks: [{ name: 'A', week: { week_start: '2026-11-02', meals: [{ key: '9-nuit' }, 'x'] } }],
      },
    ],
  ])('réponse sans rien à montrer %#', (p) => {
    expect(cleanSharedWeeks(p)).toEqual([]);
  });
});

describe('fetchSharedWeeks', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sans compte : aucun appel réseau', async () => {
    getTokens.mockResolvedValue(null);
    expect(await fetchSharedWeeks()).toEqual([]);
    expect(apiJsonWithStatus).not.toHaveBeenCalled();
  });

  test('avec compte : semaines lues', async () => {
    getTokens.mockResolvedValue({ access: 'a' });
    apiJsonWithStatus.mockResolvedValue({ ok: true, status: 200, data: { weeks: [SEMAINE] } });
    expect(await fetchSharedWeeks()).toHaveLength(1);
    expect(apiJsonWithStatus.mock.calls[0].slice(0, 2)).toEqual([
      'GET',
      '/users/list-menus/shared/',
    ]);
  });

  test('hors ligne ou erreur serveur : rien, sans exception', async () => {
    getTokens.mockResolvedValue({ access: 'a' });
    apiJsonWithStatus.mockRejectedValueOnce(new Error('réseau'));
    expect(await fetchSharedWeeks()).toEqual([]);
    apiJsonWithStatus.mockResolvedValueOnce({ ok: false, status: 500, data: null });
    expect(await fetchSharedWeeks()).toEqual([]);
    getTokens.mockRejectedValueOnce(new Error('coffre'));
    expect(await fetchSharedWeeks()).toEqual([]);
  });
});
