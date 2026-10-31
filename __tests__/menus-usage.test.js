// Mesure d'usage anonyme : liste fermée, file bornée, envoi sans identité, jamais d'erreur.
const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v);
  }),
}));
jest.mock('../services/api', () => ({ BASE_URL: 'https://api.test/api/v1' }));

const charger = () => {
  let mod;
  jest.isolateModules(() => {
    mod = require('../services/menusUsage');
  });
  return mod;
};
const etat = () => JSON.parse(mockStore.get('MENUS_USAGE') || 'null');
const reponse = (status) => jest.fn(async () => ({ status }));

let u;
beforeEach(() => {
  mockStore.clear();
  u = charger();
  global.fetch = reponse(204);
});
afterEach(async () => {
  await u.setMenusUsageEnabled(true); // arrête le minuteur en attente
});

describe('collecte', () => {
  test('actif par défaut, liste fermée', async () => {
    expect(await u.isMenusUsageEnabled()).toBe(true);
    await u.trackMenusUsage('plan_genere', 'fr');
    await u.trackMenusUsage('autre', 'fr');
    expect(etat().queue).toEqual([{ event: 'plan_genere', lang: 'fr' }]);
  });

  test('rien que l événement et la langue, langue ramenée à sa base', async () => {
    await u.trackMenusUsage('courses_envoyees', 'pt-BR');
    await u.trackMenusUsage('courses_envoyees', 'xx');
    await u.trackMenusUsage('courses_envoyees', null);
    expect(etat().queue.map((x) => x.lang)).toEqual(['pt', 'en', 'en']);
    expect(Object.keys(etat().queue[0]).sort()).toEqual(['event', 'lang']);
  });

  test('écritures simultanées : aucune perdue', async () => {
    await Promise.all([1, 2, 3, 4, 5].map(() => u.trackMenusUsage('plan_genere', 'fr')));
    expect(etat().queue).toHaveLength(5);
  });

  test('file bornée, les plus anciens tombent', async () => {
    await u.trackMenusUsage('courses_envoyees', 'fr');
    for (let i = 0; i < u.USAGE_QUEUE_MAX; i++) await u.trackMenusUsage('plan_genere', 'de');
    const q = etat().queue;
    expect(q).toHaveLength(u.USAGE_QUEUE_MAX);
    expect(q.some((x) => x.event === 'courses_envoyees')).toBe(false);
  });

  test('stockage abîmé : repart proprement', async () => {
    mockStore.set('MENUS_USAGE', '{pas du json');
    await u.trackMenusUsage('plan_genere', 'fr');
    expect(etat().queue).toHaveLength(1);
    mockStore.set('MENUS_USAGE', JSON.stringify({ queue: [{ event: 'pirate', lang: 'fr' }, 3] }));
    await u.trackMenusUsage('plan_genere', 'fr');
    expect(etat().queue).toEqual([{ event: 'plan_genere', lang: 'fr' }]);
  });
});

describe('retour la semaine suivante', () => {
  const LUNDI = new Date(2026, 10, 2, 10);
  const MEME_SEMAINE = new Date(2026, 10, 8, 20);
  const SUIVANTE = new Date(2026, 10, 9, 8);
  const DEUX_APRES = new Date(2026, 10, 23, 8);

  const retours = () =>
    (etat().queue || []).filter((x) => x.event === 'retour_semaine_suivante').length;

  test('première visite : pas de retour', async () => {
    await u.noteMenusVisit('fr', LUNDI);
    expect(retours()).toBe(0);
  });

  test('semaine ISO suivante : une seule fois', async () => {
    await u.noteMenusVisit('fr', LUNDI);
    await u.noteMenusVisit('fr', MEME_SEMAINE);
    expect(retours()).toBe(0);
    await u.noteMenusVisit('fr', SUIVANTE);
    await u.noteMenusVisit('fr', SUIVANTE);
    expect(retours()).toBe(1);
  });

  test('semaine sautée : pas de retour', async () => {
    await u.noteMenusVisit('fr', LUNDI);
    await u.noteMenusVisit('fr', DEUX_APRES);
    expect(retours()).toBe(0);
  });
});

describe('envoi', () => {
  test('sans jeton ni identité, corps limité aux événements', async () => {
    await u.trackMenusUsage('plan_genere', 'fr');
    await u.flushMenusUsage();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/users/list-menus/usage/');
    expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(opts.credentials).toBe('omit');
    expect(JSON.parse(opts.body)).toEqual({ events: [{ event: 'plan_genere', lang: 'fr' }] });
    expect(etat().queue).toEqual([]);
  });

  test('file vide : aucun appel', async () => {
    await u.flushMenusUsage();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([[429], [500], [503]])('%i : gardé pour plus tard, sans nouvel essai', async (code) => {
    global.fetch = reponse(code);
    await u.trackMenusUsage('plan_genere', 'fr');
    await u.flushMenusUsage();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(etat().queue).toHaveLength(1);
  });

  test.each([[400], [413]])('%i : lot abandonné', async (code) => {
    global.fetch = reponse(code);
    await u.trackMenusUsage('plan_genere', 'fr');
    await u.flushMenusUsage();
    expect(etat().queue).toEqual([]);
  });

  test('hors ligne : aucune exception, file gardée', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('réseau');
    });
    await u.trackMenusUsage('plan_genere', 'fr');
    await expect(u.flushMenusUsage()).resolves.toBeUndefined();
    expect(etat().queue).toHaveLength(1);
  });

  test('événement arrivé pendant l envoi : conservé', async () => {
    let lacher;
    global.fetch = jest.fn(
      () =>
        new Promise((r) => {
          lacher = () => r({ status: 204 });
        })
    );
    await u.trackMenusUsage('plan_genere', 'fr');
    const f = u.flushMenusUsage();
    await new Promise((r) => setTimeout(r, 0));
    await u.trackMenusUsage('courses_envoyees', 'fr');
    lacher();
    await f;
    expect(etat().queue).toEqual([{ event: 'courses_envoyees', lang: 'fr' }]);
  });

  test('passage en arrière-plan : envoi, abonnement unique', async () => {
    const appState = { addEventListener: jest.fn(() => ({ remove: jest.fn() })) };
    u.startMenusUsage(appState);
    u.startMenusUsage(appState);
    expect(appState.addEventListener).toHaveBeenCalledTimes(1);
    await u.trackMenusUsage('plan_genere', 'fr');
    appState.addEventListener.mock.calls[0][1]('active');
    expect(global.fetch).not.toHaveBeenCalled();
    appState.addEventListener.mock.calls[0][1]('background');
    await u.flushMenusUsage();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('désactivation', () => {
  test('purge la file et plus rien ne part', async () => {
    await u.trackMenusUsage('plan_genere', 'fr');
    await u.setMenusUsageEnabled(false);
    expect(await u.isMenusUsageEnabled()).toBe(false);
    expect(etat()).toEqual({ enabled: false, queue: [], lastWeek: null, returnWeek: null });
    await u.trackMenusUsage('plan_genere', 'fr');
    await u.noteMenusVisit('fr');
    await u.flushMenusUsage();
    expect(etat().queue).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
