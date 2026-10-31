// Stockage des menus et pont vers les listes : JSON corrompu, écritures concurrentes,
// miroir de la liste active, listes partagées intouchables.
const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => {
    await new Promise((r) => setTimeout(r, 1));
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

import {
  MENUS_KEYS,
  MENUS_KEY,
  loadProfile,
  saveProfile,
  loadPlan,
  savePlan,
  loadHistory,
  pushHistory,
  loadFavorites,
  toggleFavorite,
  loadNotes,
  setNote,
  loadCooked,
  markCooked,
  clearAllMenus,
  clearPlan,
  hasApplied,
  loadFridge,
  saveFridge,
} from '../lib/menus/storage';
import { addToList, readMyLists } from '../lib/menus/listBridge';
import { generatePlan } from '../lib/menus/planner';
import { buildShoppingList } from '../lib/menus/shopping';
import { INGREDIENTS, RECIPES } from './menus-fixtures';

beforeEach(() => mockStore.clear());

describe('storage', () => {
  test('MENUS_KEYS préfixées et complètes', () => {
    expect(MENUS_KEYS.length).toBe(Object.keys(MENUS_KEY).length);
    expect(MENUS_KEYS.every((k) => k.startsWith('MENUS_'))).toBe(true);
  });
  test('valeurs par défaut quand rien n est stocké', async () => {
    expect((await loadProfile()).adults).toBe(2);
    expect(await loadPlan()).toBeNull();
    expect(await loadHistory()).toEqual([]);
    expect(await loadFavorites()).toEqual([]);
    expect(await loadNotes()).toEqual({});
    expect(await loadCooked()).toEqual({});
    expect(await loadFridge()).toEqual([]);
  });
  test('JSON corrompu ou de mauvaise forme : valeurs par défaut, aucune exception', async () => {
    for (const k of MENUS_KEYS) mockStore.set(k, '{pas du json');
    expect((await loadProfile()).adults).toBe(2);
    expect(await loadPlan()).toBeNull();
    expect(await loadHistory()).toEqual([]);
    expect(await loadFavorites()).toEqual([]);
    for (const k of MENUS_KEYS) mockStore.set(k, JSON.stringify({ v: 1, data: 12 }));
    expect(await loadPlan()).toBeNull();
    expect(await loadFavorites()).toEqual([]);
    expect(await loadNotes()).toEqual({});
    mockStore.set(MENUS_KEY.history, JSON.stringify({ v: 1, data: [1, null, { meals: 'x' }] }));
    expect(await loadHistory()).toEqual([]);
    mockStore.set(MENUS_KEY.profile, 'null');
    expect((await loadProfile()).children).toBe(0);
  });
  test('valeur nue sans enveloppe (ancienne forme) migrée, version trop récente ignorée', async () => {
    mockStore.set(MENUS_KEY.favorites, JSON.stringify(['a', 'b', 'a']));
    expect(await loadFavorites()).toEqual(['a', 'b']);
    mockStore.set(MENUS_KEY.favorites, JSON.stringify({ v: 99, data: ['z'] }));
    expect(await loadFavorites()).toEqual([]);
  });
  test('profil : écriture fusionnée et assainie', async () => {
    const p = await saveProfile({ adults: 3, budget: 80, diets: ['vegetarien'] });
    expect(p.adults).toBe(3);
    await saveProfile({ children: 2 });
    const r = await loadProfile();
    expect(r).toMatchObject({ adults: 3, children: 2, budget: 80, diets: ['vegetarien'] });
    expect(JSON.parse(mockStore.get(MENUS_KEY.profile)).v).toBe(1);
  });
  test('écritures concurrentes : aucune perte', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => toggleFavorite(`r${i}`)));
    expect((await loadFavorites()).length).toBe(20);
    await Promise.all(Array.from({ length: 10 }, () => markCooked('x', 5)));
    expect((await loadCooked()).x.count).toBe(10);
    await Promise.all([setNote('a', 'un'), setNote('b', 'deux'), setNote('a', 'trois')]);
    expect(await loadNotes()).toEqual({ a: 'trois', b: 'deux' });
  });
  test('favoris : bascule', async () => {
    expect(await toggleFavorite('x')).toBe(true);
    expect(await toggleFavorite('x')).toBe(false);
    expect(await toggleFavorite('')).toBeNull();
    expect(await loadFavorites()).toEqual([]);
  });
  test('plan et historique', async () => {
    const plan = generatePlan({
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      profile: {},
      seed: 2,
      weekStart: '2026-11-02',
    });
    expect(await savePlan(plan)).toBe(true);
    expect((await loadPlan()).fingerprint).toBe(plan.fingerprint);
    expect(await savePlan('nope')).toBe(false);
    await pushHistory(plan, 1);
    await pushHistory(plan, 2);
    const h = await loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].savedAt).toBe(2);
    for (let i = 0; i < 40; i++) await pushHistory({ ...plan, weekStart: `w${i}` }, i);
    expect((await loadHistory()).length).toBe(26);
    await clearPlan();
    expect(await loadPlan()).toBeNull();
  });
  test('stock chez moi', async () => {
    await saveFridge(['a', 'a', 'b', 3]);
    expect(await loadFridge()).toEqual(['a', 'b']);
  });
  test('échec d écriture : renvoie false, ne lève pas', async () => {
    const AS = require('@react-native-async-storage/async-storage');
    AS.setItem.mockImplementationOnce(async () => {
      throw new Error('plein');
    });
    expect(await setNote('a', 'x')).toBe(false);
  });
  test('nettoyage à la déconnexion', async () => {
    await toggleFavorite('a');
    await setNote('a', 'x');
    await saveProfile({ adults: 4 });
    mockStore.set('SG_ITEMS', '[]');
    await clearAllMenus();
    for (const k of MENUS_KEYS) expect(mockStore.has(k)).toBe(false);
    expect(mockStore.has('SG_ITEMS')).toBe(true);
  });
});

describe('listBridge', () => {
  const plan = generatePlan({ recipes: RECIPES, ingredients: INGREDIENTS, profile: {}, seed: 5 });
  const lignes = buildShoppingList({
    plan,
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    profile: {},
  }).lines;
  const nameOf = (l) => `Nom ${l.key}`;
  const read = (k) => JSON.parse(mockStore.get(k));
  let n = 0;
  const idGen = () => `i${++n}`;

  test('liste par défaut sans registre : écrit SG_ITEMS', async () => {
    const r = await addToList('default', lignes, { nameOf, idGen });
    expect(r.status).toBe('ok');
    expect(read('SG_ITEMS')).toHaveLength(lignes.length);
    expect(read('SG_ITEMS')[0]).toMatchObject({ unit: 'u', crossed: false, selected: true });
  });
  test('même plan envoyé deux fois : pas de doublon', async () => {
    await addToList('default', lignes, { nameOf, idGen });
    const before = mockStore.get('SG_ITEMS');
    const r = await addToList('default', lignes, { nameOf, idGen });
    expect(r.status).toBe('already');
    expect(mockStore.get('SG_ITEMS')).toBe(before);
    expect(await hasApplied('default', r.fingerprint)).toBe(true);
    const forced = await addToList('default', lignes, { nameOf, idGen, force: true });
    expect(forced.status).toBe('ok');
    expect(read('SG_ITEMS')).toHaveLength(lignes.length);
    expect(read('SG_ITEMS')[0].qty).toBeGreaterThanOrEqual(2);
  });
  test('liste active non par défaut : clé canonique ET miroir SG_ITEMS', async () => {
    mockStore.set(
      'SG_LISTS',
      JSON.stringify([
        { id: 'default', name: '' },
        { id: 'abc', name: 'Fête' },
      ])
    );
    mockStore.set('SG_ACTIVE_LIST', 'abc');
    mockStore.set(
      'SG_ITEMS__abc',
      JSON.stringify([{ id: 'x', name: 'Pain', qty: 1, unit: 'u', crossed: false, selected: true }])
    );
    const r = await addToList('abc', lignes.slice(0, 2), { nameOf, idGen });
    expect(r.status).toBe('ok');
    expect(read('SG_ITEMS__abc')).toHaveLength(3);
    expect(read('SG_ITEMS__abc')[0].name).toBe('Pain');
    expect(mockStore.get('SG_ITEMS')).toBe(mockStore.get('SG_ITEMS__abc'));
  });
  test('liste non active : le miroir de la liste active reste intact', async () => {
    mockStore.set('SG_LISTS', JSON.stringify([{ id: 'default' }, { id: 'abc' }]));
    mockStore.set('SG_ACTIVE_LIST', 'default');
    mockStore.set('SG_ITEMS', '[]');
    await addToList('abc', lignes.slice(0, 1), { nameOf, idGen });
    expect(mockStore.get('SG_ITEMS')).toBe('[]');
    expect(read('SG_ITEMS__abc')).toHaveLength(1);
  });
  test('liste active par défaut quand listId absent', async () => {
    mockStore.set('SG_LISTS', JSON.stringify([{ id: 'default' }, { id: 'abc' }]));
    mockStore.set('SG_ACTIVE_LIST', 'abc');
    const r = await addToList(null, lignes.slice(0, 1), { nameOf, idGen });
    expect(r.listId).toBe('abc');
    expect(mockStore.has('SG_ITEMS__abc')).toBe(true);
  });
  test('liste partagée ou inconnue : aucune écriture', async () => {
    mockStore.set('SG_LISTS', JSON.stringify([{ id: 'default' }, { id: 'sh', share_id: 9 }]));
    const r1 = await addToList('sh', lignes, { nameOf, idGen });
    expect(r1.status).toBe('refused_shared');
    const r2 = await addToList('ghost', lignes, { nameOf, idGen });
    expect(r2.status).toBe('unknown_list');
    expect(mockStore.has('SG_ITEMS__sh')).toBe(false);
    expect(mockStore.has('SG_ITEMS__ghost')).toBe(false);
  });
  test('liste illisible : intacte, statut corrupt', async () => {
    mockStore.set('SG_ITEMS', '{casse');
    const r = await addToList('default', lignes, { nameOf, idGen });
    expect(r.status).toBe('corrupt');
    expect(mockStore.get('SG_ITEMS')).toBe('{casse');
    mockStore.set('SG_ITEMS', '{"a":1}');
    expect((await addToList('default', lignes, { nameOf, idGen })).status).toBe('corrupt');
  });
  test('registre corrompu et lignes vides', async () => {
    mockStore.set('SG_LISTS', 'zzz');
    expect((await readMyLists()).lists).toEqual([{ id: 'default', name: '' }]);
    expect((await addToList('default', [], { nameOf })).status).toBe('empty');
    expect((await addToList('default', null)).status).toBe('empty');
    expect((await addToList('default', lignes, { nameOf, idGen })).status).toBe('ok');
  });
  test('appels simultanés : un seul ajout', async () => {
    const rs = await Promise.all([
      addToList('default', lignes, { nameOf, idGen }),
      addToList('default', lignes, { nameOf, idGen }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual(['already', 'ok']);
    expect(read('SG_ITEMS')).toHaveLength(lignes.length);
  });
  test('readMyLists exclut les listes partagées', async () => {
    mockStore.set(
      'SG_LISTS',
      JSON.stringify([
        { id: 'default', name: 'A' },
        { id: 'x', shared: true },
        { id: 'y', name: 'B' },
      ])
    );
    mockStore.set('SG_ACTIVE_LIST', 'x');
    const r = await readMyLists();
    expect(r.lists.map((l) => l.id)).toEqual(['default', 'y']);
    expect(r.activeId).toBe('default');
  });
});
