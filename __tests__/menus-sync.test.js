// Sauvegarde des menus sur le compte : fusion, conflit, hors ligne, changement de compte,
// données corrompues, déconnexion.
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

let mockAuth = null;
const mockServer = { version: 0, data: {}, offline: false, puts: [], gets: 0, onPut: null };
jest.mock('../services/secureStorage', () => ({
  getSecureItem: jest.fn(async () => (mockAuth ? JSON.stringify(mockAuth) : null)),
  setSecureItem: jest.fn(async () => {}),
  removeSecureItem: jest.fn(async () => {}),
  removeSecureItems: jest.fn(async () => {}),
  SECURE_KEYS: [],
}));
jest.mock('../services/api', () => ({
  getTokens: jest.fn(async () => (mockAuth ? { access: 'a', refresh: 'r' } : null)),
  apiJsonWithStatus: jest.fn(async (method, _path, body) => {
    if (mockServer.offline) throw new Error('hors ligne');
    const etat = () => ({
      version: mockServer.version,
      updated_at: null,
      data: JSON.parse(JSON.stringify(mockServer.data)),
    });
    if (method === 'GET') {
      mockServer.gets++;
      return { ok: true, status: 200, data: etat() };
    }
    mockServer.puts.push(JSON.parse(JSON.stringify(body)));
    if (mockServer.onPut) {
      const r = mockServer.onPut(body, etat);
      if (r) return r;
    }
    if (body.base_version !== mockServer.version) return { ok: false, status: 409, data: etat() };
    mockServer.version += 1;
    mockServer.data = JSON.parse(JSON.stringify(body.data));
    return { ok: true, status: 200, data: etat() };
  }),
}));

import { apiJsonWithStatus } from '../services/api';
import {
  SYNC_KEYS,
  LEGACY_STAMP,
  mergeData,
  mergeFirstLogin,
  mergeSync,
  entreeValide,
  lireEtatServeur,
} from '../lib/menus/sync';
import {
  MENUS_KEY,
  MENUS_KEYS,
  clearAllMenus,
  clearPlan,
  loadFavorites,
  loadFridge,
  loadHistory,
  loadNotes,
  loadPlan,
  markApplied,
  readSyncSnapshot,
  readSyncState,
  resetAllMenus,
  saveFridge,
  savePlan,
  setMeta,
  setNote,
  toggleFavorite,
  applySyncEntries,
} from '../lib/menus/storage';
import {
  flushMenusSync,
  loadMenusSyncStatus,
  onMenusRemoteChange,
  requestMenusSync,
  resetMenusSyncSession,
  startMenusSync,
  _resetMenusSyncForTests,
  PUSH_DELAY_MS,
} from '../services/menusSync';

const plan = (over = {}) => ({
  weekStart: '2026-10-26',
  fingerprint: 'fp1',
  meals: [{ key: '0-midi', recipeId: 'r1' }],
  ...over,
});
const until = async (fn) => {
  for (let i = 0; i < 50 && !fn(); i++) await new Promise((r) => setTimeout(r, 2));
};

beforeEach(() => {
  mockStore.clear();
  mockAuth = null;
  Object.assign(mockServer, { version: 0, data: {}, offline: false, puts: [], gets: 0, onPut: null });
  apiJsonWithStatus.mockClear();
  _resetMenusSyncForTests();
});

describe('fusion', () => {
  test('le plus récent gagne, clé par clé', () => {
    const r = mergeData(
      { favorites: { u: 20, v: ['a'] }, notes: { u: 5, v: { x: 'local' } } },
      { favorites: { u: 10, v: ['b'] }, notes: { u: 9, v: { x: 'compte' } } }
    );
    expect(r.data.favorites.v).toEqual(['a']);
    expect(r.data.notes.v).toEqual({ x: 'compte' });
    expect(r.toPush).toEqual(['favorites']);
    expect(r.toApply).toEqual(['notes']);
  });
  test('une clé absente d un côté n est jamais effacée', () => {
    const r = mergeData({ fridge: { u: 1, v: ['a'] } }, { notes: { u: 1, v: { x: 'y' } } });
    expect(Object.keys(r.data).sort()).toEqual(['fridge', 'notes']);
    expect(r.toPush).toEqual(['fridge']);
    expect(r.toApply).toEqual(['notes']);
  });
  test('à égalité le serveur gagne et rien ne repart', () => {
    const r = mergeData({ fridge: { u: 7, v: ['a'] } }, { fridge: { u: 7, v: ['b'] } });
    expect(r.data.fridge.v).toEqual(['b']);
    expect(r.toPush).toEqual([]);
    expect(r.toApply).toEqual([]);
  });
  test('une clé inconnue du compte est conservée, jamais écrite localement', () => {
    const r = mergeData({}, { futureCle: { u: 3, v: [{ id: 'x' }] } });
    expect(r.data.futureCle.v).toEqual([{ id: 'x' }]);
    expect(r.toApply).toEqual([]);
  });
  test('un effacement explicite plus récent se propage', () => {
    const r = mergeData({ plan: { u: 9, v: null } }, { plan: { u: 2, v: plan() } });
    expect(r.data.plan.v).toBeNull();
    expect(r.toPush).toEqual(['plan']);
  });
  test('applied et sent ne sont pas sauvegardés', () => {
    expect(SYNC_KEYS).toEqual(
      expect.arrayContaining(['profile', 'plan', 'history', 'favorites', 'notes', 'cooked', 'fridge'])
    );
    expect(SYNC_KEYS).not.toContain('applied');
    expect(SYNC_KEYS).not.toContain('sent');
  });
  test('première fusion : favoris, notes, cuisinées, frigo et historique additionnés', () => {
    const r = mergeFirstLogin(
      {
        favorites: { u: 50, v: ['local'] },
        notes: { u: 50, v: { a: 'L', c: 'L' } },
        cooked: { u: 50, v: { r: { count: 1, last: 9 } } },
        fridge: { u: 50, v: ['x'] },
        history: { u: 50, v: [plan({ fingerprint: 'h1', savedAt: 2 })] },
      },
      {
        favorites: { u: 10, v: ['compte'] },
        notes: { u: 10, v: { a: 'C', b: 'C' } },
        cooked: { u: 10, v: { r: { count: 4, last: 3 } } },
        fridge: { u: 10, v: ['y'] },
        history: { u: 10, v: [plan({ fingerprint: 'h2', savedAt: 1 })] },
      }
    );
    expect(r.data.favorites.v.sort()).toEqual(['compte', 'local']);
    expect(r.data.notes.v).toEqual({ a: 'L', b: 'C', c: 'L' });
    expect(r.data.cooked.v.r).toEqual({ count: 4, last: 9 });
    expect(r.data.fridge.v.sort()).toEqual(['x', 'y']);
    expect(r.data.history.v.map((p) => p.fingerprint)).toEqual(['h2', 'h1']);
    expect(r.toPush).toContain('favorites');
    expect(r.toApply).toContain('favorites');
    expect(r.data.favorites.u).toBe(51);
  });
  test('première fusion : un effacement local ne retire rien du compte', () => {
    const r = mergeFirstLogin({ plan: { u: 99, v: null } }, { plan: { u: 2, v: plan() } });
    expect(r.data.plan.v).toEqual(plan());
    expect(r.toPush).toEqual([]);
    expect(r.toApply).toEqual(['plan']);
  });
  test('première fusion : le plan écarté rejoint l historique', () => {
    const r = mergeFirstLogin(
      { plan: { u: 5, v: plan({ fingerprint: 'vieux' }) } },
      { plan: { u: 8, v: plan({ fingerprint: 'neuf' }) } }
    );
    expect(r.data.plan.v.fingerprint).toBe('neuf');
    expect(r.data.history.v.map((p) => p.fingerprint)).toEqual(['vieux']);
    expect(r.toPush).toContain('history');
  });
});

describe('données corrompues', () => {
  test('entrées illisibles ignorées, aucune exception', () => {
    const local = { favorites: { u: 3, v: ['a'] } };
    for (const bad of [null, 12, 'x', [], {}, { u: 'x', v: [] }, { u: NaN, v: [] }, { u: -1, v: [] }, { u: 1 }]) {
      const r = mergeData(local, { favorites: bad, notes: bad });
      expect(r.data.favorites.v).toEqual(['a']);
      expect(r.toApply).toEqual([]);
    }
    expect(mergeData(null, 'x')).toEqual({ data: {}, toApply: [], toPush: [] });
    expect(mergeFirstLogin(undefined, 3)).toEqual({ data: {}, toApply: [], toPush: [] });
  });
  test('valeur de mauvaise forme : la donnée locale reste, même si le compte est plus récent', () => {
    const r = mergeData(
      { notes: { u: 1, v: { a: 'b' } }, plan: { u: 1, v: plan() } },
      { notes: { u: 9, v: 'texte' }, plan: { u: 9, v: { meals: 'non' } } }
    );
    expect(r.data.notes.v).toEqual({ a: 'b' });
    expect(r.data.plan.v).toEqual(plan());
    expect(r.toApply).toEqual([]);
  });
  test('__proto__ ignoré', () => {
    const r = mergeData({}, JSON.parse('{"__proto__":{"u":1,"v":{"pollue":true}}}'));
    expect({}.pollue).toBeUndefined();
    expect(Object.keys(r.data)).toEqual([]);
  });
  test('réponse serveur inexploitable : rien lu', () => {
    for (const d of [null, 'x', [], {}, { version: 'a', data: {} }, { version: 1 }, { version: -1, data: {} }, { version: 1, data: [] }])
      expect(lireEtatServeur(d)).toBeNull();
    expect(lireEtatServeur({ version: 0, data: {} })).toEqual({ version: 0, data: {} });
  });
  test('réponse 200 inexploitable : aucun envoi, rien d effacé', async () => {
    mockAuth = { id: 1 };
    await toggleFavorite('a');
    apiJsonWithStatus.mockImplementationOnce(async () => ({ ok: true, status: 200, data: { oups: 1 } }));
    await requestMenusSync();
    expect(mockServer.puts).toHaveLength(0);
    expect(await loadFavorites()).toEqual(['a']);
    expect((await readSyncState()).dirty.favorites).toBe(true);
  });
  test('état de sauvegarde corrompu : valeurs par défaut, aucune exception', async () => {
    mockStore.set(MENUS_KEY.sync, '{pas du json');
    expect((await readSyncState()).owner).toBeNull();
    mockStore.set(MENUS_KEY.sync, JSON.stringify({ v: 1, data: { owner: 3, stamps: 'x', dirty: [1] } }));
    expect(await readSyncState()).toEqual({
      owner: null,
      stamps: {},
      base: {},
      dirty: {},
      lastSyncAt: 0,
    });
  });
  test('clé locale corrompue : jamais envoyée', async () => {
    mockStore.set(MENUS_KEY.favorites, '{pas du json');
    mockStore.set(MENUS_KEY.notes, JSON.stringify({ v: 1, data: 12 }));
    const snap = await readSyncSnapshot();
    expect(snap.entries).toEqual({});
  });
  test('valeur du compte nettoyée à l écriture locale', async () => {
    mockAuth = { id: 1 };
    mockServer.version = 2;
    mockServer.data = { favorites: { u: 5, v: ['ok', 3, null, 'ok'] } };
    await requestMenusSync();
    expect(await loadFavorites()).toEqual(['ok']);
  });
});

describe('traces locales', () => {
  test('chaque écriture sauvegardée note l horodatage et marque à envoyer', async () => {
    await toggleFavorite('a');
    const st = await readSyncState();
    expect(st.stamps.favorites).toBeGreaterThan(0);
    expect(st.dirty.favorites).toBe(true);
  });
  test('horodatage toujours croissant', async () => {
    await toggleFavorite('a');
    const a = (await readSyncState()).stamps.favorites;
    await toggleFavorite('b');
    expect((await readSyncState()).stamps.favorites).toBeGreaterThan(a);
  });
  test('une écriture sans changement ne marque rien', async () => {
    await saveFridge([]);
    expect((await readSyncState()).dirty).toEqual({});
  });
  test('applied et meta ne marquent rien', async () => {
    await markApplied('l1', 'fp');
    await setMeta({ onboarded: true });
    expect((await readSyncState()).dirty).toEqual({});
  });
  test('clearPlan laisse un effacement explicite', async () => {
    await savePlan(plan());
    await clearPlan();
    expect((await readSyncSnapshot()).entries.plan.v).toBeNull();
  });
  test('la clé de sauvegarde est effacée avec les autres', async () => {
    expect(MENUS_KEYS).toContain(MENUS_KEY.sync);
    await toggleFavorite('a');
    await clearAllMenus();
    expect(mockStore.has(MENUS_KEY.sync)).toBe(false);
  });
  test('donnée antérieure à la sauvegarde : envoyée comme la plus ancienne', async () => {
    mockStore.set(MENUS_KEY.fridge, JSON.stringify({ v: 1, data: ['a'] }));
    expect((await readSyncSnapshot()).entries.fridge).toEqual({ u: LEGACY_STAMP, v: ['a'] });
  });
});

describe('échanges', () => {
  test('sans compte : aucun appel réseau, tout reste local', async () => {
    await toggleFavorite('a');
    await requestMenusSync();
    expect(apiJsonWithStatus).not.toHaveBeenCalled();
    expect(await loadFavorites()).toEqual(['a']);
    expect((await loadMenusSyncStatus()).connected).toBe(false);
  });
  test('première connexion : données locales et compte réunis, propriétaire posé', async () => {
    await toggleFavorite('invite');
    mockAuth = { id: 7, email: 'a@b.c' };
    mockServer.version = 3;
    mockServer.data = { favorites: { u: 10, v: ['compte'] }, notes: { u: 10, v: { r: 'n' } } };
    await requestMenusSync();
    expect((await loadFavorites()).sort()).toEqual(['compte', 'invite']);
    expect(await loadNotes()).toEqual({ r: 'n' });
    expect(mockServer.version).toBe(4);
    expect(mockServer.data.favorites.v.sort()).toEqual(['compte', 'invite']);
    expect(mockServer.data.notes.v).toEqual({ r: 'n' });
    const st = await readSyncState();
    expect(st.owner).toBe('7');
    expect(st.dirty).toEqual({});
    expect(st.lastSyncAt).toBeGreaterThan(0);
    const status = await loadMenusSyncStatus();
    expect(status).toMatchObject({ connected: true, account: 'a@b.c', pending: false });
  });
  test('rien à envoyer : aucun PUT, deuxième passage idem', async () => {
    mockAuth = { id: 7 };
    mockServer.version = 1;
    mockServer.data = { fridge: { u: 10, v: ['a'] } };
    await requestMenusSync();
    await requestMenusSync();
    expect(mockServer.puts).toHaveLength(0);
    expect(await loadFridge()).toEqual(['a']);
  });
  test('tout le contenu est renvoyé, clés inconnues comprises', async () => {
    mockAuth = { id: 7 };
    mockServer.version = 1;
    mockServer.data = { myRecipes: { u: 1, v: [{ id: 'x' }] } };
    await requestMenusSync();
    await toggleFavorite('a');
    await requestMenusSync();
    expect(mockServer.data.myRecipes.v).toEqual([{ id: 'x' }]);
    expect(mockServer.data.favorites.v).toEqual(['a']);
  });
  test('conflit 409 : refusion avec l état renvoyé, nouvel essai réussi', async () => {
    mockAuth = { id: 7 };
    await requestMenusSync();
    await toggleFavorite('a');
    let premier = true;
    mockServer.onPut = (_b, etat) => {
      if (!premier) return null;
      premier = false;
      mockServer.version = 5;
      mockServer.data = { notes: { u: 3, v: { x: 'autre appareil' } } };
      return { ok: false, status: 409, data: etat() };
    };
    await requestMenusSync();
    expect(mockServer.puts).toHaveLength(2);
    expect(mockServer.puts[1].base_version).toBe(5);
    expect(mockServer.data.favorites.v).toEqual(['a']);
    expect(mockServer.data.notes.v).toEqual({ x: 'autre appareil' });
    expect(await loadNotes()).toEqual({ x: 'autre appareil' });
    expect((await readSyncState()).dirty).toEqual({});
  });
  test('conflit permanent : 3 envois au plus, rien de perdu, reprise possible', async () => {
    mockAuth = { id: 7 };
    await requestMenusSync();
    await toggleFavorite('a');
    mockServer.onPut = (_b, etat) => ({ ok: false, status: 409, data: etat() });
    await requestMenusSync();
    expect(mockServer.puts).toHaveLength(3);
    expect((await readSyncState()).dirty.favorites).toBe(true);
    mockServer.onPut = null;
    await requestMenusSync();
    expect(mockServer.data.favorites.v).toEqual(['a']);
  });
  test('hors ligne : rien de perdu, aucune exception, envoi au passage suivant', async () => {
    mockAuth = { id: 7 };
    await requestMenusSync();
    mockServer.offline = true;
    await toggleFavorite('a');
    await expect(requestMenusSync()).resolves.toBeUndefined();
    expect(apiJsonWithStatus).toHaveBeenCalledTimes(2);
    expect((await readSyncState()).dirty.favorites).toBe(true);
    expect((await loadMenusSyncStatus()).pending).toBe(true);
    mockServer.offline = false;
    await requestMenusSync();
    expect(mockServer.data.favorites.v).toEqual(['a']);
    expect((await readSyncState()).dirty).toEqual({});
  });
  test('première connexion hors ligne : aucun rattachement, données gardées', async () => {
    await toggleFavorite('a');
    mockAuth = { id: 7 };
    mockServer.offline = true;
    await requestMenusSync();
    expect((await readSyncState()).owner).toBeNull();
    expect(await loadFavorites()).toEqual(['a']);
  });
  test('erreur 500 au PUT : clé toujours à envoyer, un seul essai', async () => {
    mockAuth = { id: 7 };
    await requestMenusSync();
    await toggleFavorite('a');
    mockServer.onPut = () => ({ ok: false, status: 500, data: null });
    await requestMenusSync();
    expect(mockServer.puts).toHaveLength(1);
    expect((await readSyncState()).dirty.favorites).toBe(true);
  });
  test('413 : rien ne bloque, gardé en local, journalisé', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAuth = { id: 7 };
    await requestMenusSync();
    await toggleFavorite('a');
    mockServer.onPut = () => ({ ok: false, status: 413, data: null });
    await requestMenusSync();
    expect(mockServer.puts).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await loadFavorites()).toEqual(['a']);
    expect((await readSyncState()).dirty.favorites).toBe(true);
    warn.mockRestore();
  });
  test('une saisie faite pendant l envoi reste à envoyer', async () => {
    mockAuth = { id: 7 };
    await requestMenusSync();
    await toggleFavorite('a');
    let ecrit;
    mockServer.onPut = () => {
      ecrit = toggleFavorite('b');
      return null;
    };
    await requestMenusSync();
    await ecrit;
    expect((await readSyncState()).dirty.favorites).toBe(true);
    expect((await loadFavorites()).sort()).toEqual(['a', 'b']);
  });
  test('une saisie faite après la photographie n est pas écrasée par le compte', async () => {
    await toggleFavorite('local');
    const snap = await readSyncSnapshot();
    await toggleFavorite('apres');
    const r = await applySyncEntries({
      owner: '7',
      entries: { favorites: { u: 9e15, v: ['compte'] } },
      stamps: snap.state.stamps,
      dirty: [],
    });
    expect(r.applied).toEqual([]);
    expect((await loadFavorites()).sort()).toEqual(['apres', 'local']);
  });
  test('le contexte est prévenu des clés changées, valeur ou effacement', async () => {
    mockAuth = { id: 7 };
    mockServer.version = 1;
    mockServer.data = { plan: { u: 5, v: plan() }, notes: { u: 5, v: null } };
    const recu = [];
    onMenusRemoteChange((e) => recu.push(e));
    await requestMenusSync();
    expect(recu).toHaveLength(1);
    expect(recu[0].keys.sort()).toEqual(['notes', 'plan']);
    expect(recu[0].filled).toEqual(['plan']);
    recu.length = 0;
    await requestMenusSync();
    expect(recu).toHaveLength(0);
  });
  test('effacement venu du compte appliqué localement', async () => {
    mockAuth = { id: 7 };
    await requestMenusSync();
    await savePlan(plan());
    await requestMenusSync();
    mockServer.data = { ...mockServer.data, plan: { u: Date.now() + 9999, v: null } };
    mockServer.version += 1;
    await requestMenusSync();
    expect(await loadPlan()).toBeNull();
  });
  test('deux demandes simultanées : un seul passage à la fois', async () => {
    mockAuth = { id: 7 };
    const a = requestMenusSync();
    const b = requestMenusSync();
    expect(a).toBe(b);
    await a;
    expect(mockServer.gets).toBe(1);
  });
});

describe('cloisonnement par compte', () => {
  test('changement de compte : les données de A ne sont ni lues ni envoyées pour B', async () => {
    mockAuth = { id: 1 };
    await requestMenusSync();
    await toggleFavorite('secret-de-a');
    mockServer.offline = true;
    await requestMenusSync();
    mockServer.offline = false;
    mockAuth = { id: 2 };
    mockServer.version = 9;
    mockServer.data = { favorites: { u: 1, v: ['de-b'] } };
    const recu = [];
    onMenusRemoteChange((e) => recu.push(e));
    await requestMenusSync();
    expect(await loadFavorites()).toEqual(['de-b']);
    expect(JSON.stringify(mockServer.puts)).not.toContain('secret-de-a');
    expect((await readSyncState()).owner).toBe('2');
    expect(recu[0].keys).toEqual(SYNC_KEYS);
  });
  test('un échange en cours n écrit plus rien après la déconnexion', async () => {
    mockAuth = { id: 1 };
    const p = requestMenusSync();
    resetMenusSyncSession();
    await clearAllMenus();
    mockServer.data = { favorites: { u: 5, v: ['de-a'] } };
    await p;
    expect(await loadFavorites()).toEqual([]);
    expect((await readSyncState()).owner).toBeNull();
  });
  test('applySyncEntries refuse un autre compte', async () => {
    await applySyncEntries({ owner: '1', entries: {}, stamps: {}, dirty: [] });
    const r = await applySyncEntries({
      owner: '2',
      entries: { fridge: { u: 5, v: ['x'] } },
      stamps: {},
      dirty: [],
    });
    expect(r.ok).toBe(false);
    expect(await loadFridge()).toEqual([]);
  });
  test('session sans jeton ou sans identifiant : aucune sauvegarde', async () => {
    mockAuth = { email: 'sans-id@b.c' };
    await requestMenusSync();
    expect(apiJsonWithStatus).not.toHaveBeenCalled();
  });
});

describe('réinitialisation', () => {
  test('sur un compte : l effacement part sur le compte et ne revient pas', async () => {
    mockAuth = { id: 1 };
    await requestMenusSync();
    await toggleFavorite('a');
    await savePlan(plan());
    await requestMenusSync();
    await resetAllMenus();
    await requestMenusSync();
    expect(mockServer.data.favorites.v).toBeNull();
    expect(mockServer.data.plan.v).toBeNull();
    await requestMenusSync();
    expect(await loadFavorites()).toEqual([]);
    expect(await loadPlan()).toBeNull();
  });
  test('sans compte : aucune trace qui viderait un compte rejoint plus tard', async () => {
    await toggleFavorite('a');
    await resetAllMenus();
    expect(mockStore.has(MENUS_KEY.sync)).toBe(false);
    mockAuth = { id: 1 };
    mockServer.version = 1;
    mockServer.data = { favorites: { u: 1, v: ['compte'] } };
    await requestMenusSync();
    expect(await loadFavorites()).toEqual(['compte']);
  });
});

describe('envoi différé, retour au premier plan, déconnexion', () => {
  test('envoi environ 3 s après la dernière écriture, regroupé', async () => {
    mockAuth = { id: 1 };
    await requestMenusSync();
    const reel = setTimeout;
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await toggleFavorite('a');
      await toggleFavorite('b');
      jest.advanceTimersByTime(PUSH_DELAY_MS - 100);
      expect(mockServer.puts).toHaveLength(0);
      jest.advanceTimersByTime(200);
      jest.useRealTimers();
      await until(() => mockServer.puts.length > 0);
      expect(mockServer.puts).toHaveLength(1);
      expect(mockServer.data.favorites.v).toEqual(['a', 'b']);
    } finally {
      jest.useRealTimers();
      expect(reel).toBeDefined();
    }
  });
  test('lecture au lancement et au retour au premier plan, pas de doublon d écoute', async () => {
    mockAuth = { id: 1 };
    let ecoute = null;
    const AppState = {
      currentState: 'active',
      addEventListener: jest.fn((_e, fn) => {
        ecoute = fn;
        return { remove() {} };
      }),
    };
    await startMenusSync(AppState);
    await startMenusSync(AppState);
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    expect(mockServer.gets).toBe(2);
    ecoute('background');
    ecoute('active');
    await until(() => mockServer.gets === 3);
    expect(mockServer.gets).toBe(3);
  });
  test('déconnexion : ce qui attend part avant l effacement', async () => {
    mockAuth = { id: 1 };
    await requestMenusSync();
    await toggleFavorite('a');
    await flushMenusSync();
    expect(mockServer.data.favorites.v).toEqual(['a']);
  });
  test('déconnexion hors ligne ou serveur muet : durée bornée, aucune exception', async () => {
    mockAuth = { id: 1 };
    await requestMenusSync();
    await toggleFavorite('a');
    let libere;
    apiJsonWithStatus.mockImplementationOnce(() => new Promise((r) => (libere = r)));
    const debut = Date.now();
    await flushMenusSync(30);
    expect(Date.now() - debut).toBeLessThan(1000);
    libere({ ok: false, status: 500, data: null });
  });
  test('rien à envoyer : aucun appel à la déconnexion', async () => {
    mockAuth = { id: 1 };
    await requestMenusSync();
    apiJsonWithStatus.mockClear();
    await flushMenusSync();
    expect(apiJsonWithStatus).not.toHaveBeenCalled();
  });
});

test('historique du compte chargé localement', async () => {
  mockAuth = { id: 1 };
  mockServer.version = 1;
  mockServer.data = { history: { u: 4, v: [plan()] } };
  await requestMenusSync();
  expect(await loadHistory()).toHaveLength(1);
  await setNote('r', 'bon');
  expect((await readSyncState()).dirty.notes).toBe(true);
});

describe('relecture adverse', () => {
  test('deux téléphones : les favoris ajoutés des deux côtés restent, même horloge en retard', () => {
    const r = mergeSync(
      { favorites: { u: 5, v: ['a', 'local'] } },
      { favorites: { u: 90, v: ['a', 'autre'] } },
      { dirty: { favorites: true }, base: { favorites: 4 } }
    );
    expect(r.data.favorites.v.sort()).toEqual(['a', 'autre', 'local']);
    expect(r.data.favorites.u).toBe(91);
    expect(r.toPush).toContain('favorites');
    expect(r.toApply).toContain('favorites');
  });

  test('sans conflit, un favori retiré ici ne revient pas', () => {
    const r = mergeSync(
      { favorites: { u: 50, v: [] } },
      { favorites: { u: 40, v: ['a'] } },
      { dirty: { favorites: true }, base: { favorites: 40 } }
    );
    expect(r.data.favorites.v).toEqual([]);
  });

  test('clé non modifiée ici : le compte gagne, sans réunion', () => {
    const r = mergeSync(
      { favorites: { u: 5, v: ['vieux'] } },
      { favorites: { u: 90, v: ['neuf'] } },
      { dirty: {}, base: { favorites: 5 } }
    );
    expect(r.data.favorites.v).toEqual(['neuf']);
  });

  test('conflit sur le plan : le plan écarté rejoint l historique', () => {
    const r = mergeSync(
      { plan: { u: 5, v: plan({ weekStart: '2026-10-19' }) } },
      { plan: { u: 90, v: plan() } },
      { dirty: { plan: true }, base: { plan: 4 } }
    );
    expect(r.data.plan.v.weekStart).toBe('2026-10-26');
    expect(r.data.history.v[0].weekStart).toBe('2026-10-19');
  });

  test('une allergie ajoutée sur chaque téléphone reste dans la fusion', () => {
    const r = mergeFirstLogin(
      { profile: { u: 5, v: { persons: 2, diets: [], excludedIngredients: ['lait'] } } },
      { profile: { u: 9, v: { persons: 4, diets: ['halal'], excludedIngredients: ['oeuf'] } } }
    );
    expect(r.data.profile.v.persons).toBe(4);
    expect(r.data.profile.v.diets).toEqual(['halal']);
    expect(r.data.profile.v.excludedIngredients.sort()).toEqual(['lait', 'oeuf']);
  });

  test('deux données anciennes différentes : la version du compte est bien écrite ici', () => {
    const r = mergeData(
      { fridge: { u: LEGACY_STAMP, v: ['a'] } },
      { fridge: { u: LEGACY_STAMP, v: ['b'] } }
    );
    expect(r.toApply).toEqual(['fridge']);
  });

  test('un horodatage hors des entiers sûrs est ignoré', () => {
    expect(entreeValide({ u: Number.MAX_SAFE_INTEGER + 1, v: [] })).toBe(false);
    expect(entreeValide({ u: 1.5, v: [] })).toBe(false);
    expect(entreeValide({ u: 3, v: [] })).toBe(true);
  });

  test('une session de cuisine terminée part vers le compte', async () => {
    mockStore.set(MENUS_KEY.batch, JSON.stringify({ v: 1, data: null }));
    mockStore.set(MENUS_KEY.sync, JSON.stringify({ v: 1, data: { owner: '7', stamps: { batch: 50 } } }));
    const snap = await readSyncSnapshot();
    expect(snap.entries.batch.v).toBeNull();
    expect(snap.entries.batch.u).toBe(50);
  });

  test('cycle réel : un second téléphone ne remplace pas le frigo du premier', async () => {
    mockAuth = { id: 7 };
    await saveFridge(['tomate']);
    await requestMenusSync();
    expect(mockServer.data.fridge.v).toEqual(['tomate']);
    const base = (await readSyncState()).base.fridge;
    expect(base).toBe(mockServer.data.fridge.u);
    mockServer.data.fridge = { u: base + 1, v: ['tomate', 'oignon'] };
    mockServer.version += 1;
    await saveFridge(['tomate', 'carotte']);
    await requestMenusSync();
    expect(mockServer.data.fridge.v.sort()).toEqual(['carotte', 'oignon', 'tomate']);
    expect((await loadFridge()).sort()).toEqual(['carotte', 'oignon', 'tomate']);
  });

  test('clé saisie pendant la fusion : la version du compte reste à réunir', async () => {
    await applySyncEntries({ owner: '7', entries: {}, stamps: {}, dirty: [] });
    await saveFridge(['ici']);
    const r = await applySyncEntries({
      owner: '7',
      entries: { fridge: { u: 999, v: ['compte'] } },
      stamps: {},
      dirty: [],
    });
    expect(r.skipped).toEqual(['fridge']);
    expect(await loadFridge()).toEqual(['ici']);
  });
});
