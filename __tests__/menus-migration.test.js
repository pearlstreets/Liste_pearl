// Migration des listes : un téléphone existant (avant Menus) avec plusieurs listes.
// Reproduit ce que font App.js (chargement, bascule, persistance) et le pont Menus.
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

import { loadListItems, persistActiveItems, listItemsKey } from '../lib/listStore';
import { addToList, readMyLists } from '../lib/menus/listBridge';

const set = (k, v) => mockStore.set(k, typeof v === 'string' ? v : JSON.stringify(v));
const get = (k) => (mockStore.has(k) ? JSON.parse(mockStore.get(k)) : undefined);
const names = (a) => (a || []).map((x) => x.name);
const it1 = (name, qty = 1) => ({ id: name, name, qty, unit: 'u', crossed: false, selected: true });

beforeEach(() => mockStore.clear());

// Téléphone d'avant : « default » n'a que SG_ITEMS, les autres listes ont leur clé propre.
function ancienTelephone(activeId) {
  set('SG_LISTS', [
    { id: 'default', name: '' },
    { id: 'l_a', name: 'Soirée' },
    { id: 'l_b', name: 'Week-end' },
  ]);
  set('SG_ACTIVE_LIST', activeId);
  set('SG_ITEMS__l_a', [it1('chips'), it1('cola')]);
  set('SG_ITEMS__l_b', [it1('barbecue')]);
  set('SG_ITEMS', activeId === 'default' ? [it1('pain'), it1('lait', 2)] : get('SG_ITEMS__' + activeId));
}

describe('migration : téléphone existant avec plusieurs listes', () => {
  test('liste par défaut active : reprise de SG_ITEMS, autres listes intactes', async () => {
    ancienTelephone('default');
    const r = await loadListItems('default', 'default');
    expect(r.ok).toBe(true);
    expect(names(r.items)).toEqual(['pain', 'lait']);
    expect(names(get(listItemsKey('default')))).toEqual(['pain', 'lait']);
    expect(names(get('SG_ITEMS__l_a'))).toEqual(['chips', 'cola']);
    expect(names(get('SG_ITEMS__l_b'))).toEqual(['barbecue']);
    // deuxième chargement : idempotent
    const r2 = await loadListItems('default', 'default');
    expect(names(r2.items)).toEqual(['pain', 'lait']);
  });

  test('parcours complet : bascule, ajout depuis Menus, retour, panier', async () => {
    ancienTelephone('default');
    let cur = (await loadListItems('default', 'default')).items;
    await persistActiveItems('default', cur);

    // bascule vers « Soirée » (comme switchOwnList)
    cur = (await loadListItems('l_a', 'default')).items;
    await persistActiveItems('l_a', cur);
    set('SG_ACTIVE_LIST', 'l_a');
    expect(names(get('SG_ITEMS'))).toEqual(['chips', 'cola']); // miroir = active

    // Menus ajoute dans « Week-end » (ni active ni défaut)
    const lines = [{ key: 'riz', packs: 1, qty: 500, unit: 'g' }];
    const r = await addToList('l_b', lines, { nameOf: () => 'Riz' });
    expect(r.status).toBe('ok');
    expect(names(get('SG_ITEMS__l_b'))).toEqual(['barbecue', 'Riz']);
    expect(names(get('SG_ITEMS'))).toEqual(['chips', 'cola']); // miroir intact

    // Menus ajoute dans la liste par défaut alors qu'une autre est active
    const r2 = await addToList('default', [{ key: 'sel', packs: 1, qty: 1, unit: 'u' }], { nameOf: () => 'Sel' });
    expect(r2.status).toBe('ok');
    expect(names(get(listItemsKey('default')))).toEqual(['pain', 'lait', 'Sel']);
    expect(names(get('SG_ITEMS'))).toEqual(['chips', 'cola']);

    // retour sur la liste par défaut : rien de perdu
    cur = (await loadListItems('default', 'l_a')).items;
    expect(names(cur)).toEqual(['pain', 'lait', 'Sel']);
    await persistActiveItems('default', cur);
    set('SG_ACTIVE_LIST', 'default');
    expect(names(get('SG_ITEMS'))).toEqual(['pain', 'lait', 'Sel']);
    expect(names(get('SG_ITEMS__l_a'))).toEqual(['chips', 'cola']);
  });

  test("Menus écrit AVANT que l'écran Liste n'ait chargé : l'ancienne liste est reprise, pas écrasée", async () => {
    ancienTelephone('default');
    const r = await addToList(null, [{ key: 'sel', packs: 1, qty: 1, unit: 'u' }], { nameOf: () => 'Sel' });
    expect(r.status).toBe('ok');
    expect(names(get(listItemsKey('default')))).toEqual(['pain', 'lait', 'Sel']);
    expect(names(get('SG_ITEMS'))).toEqual(['pain', 'lait', 'Sel']);
  });

  test('autre liste active au démarrage : son contenu reste, la liste par défaut démarre vide sans erreur', async () => {
    ancienTelephone('l_a');
    const a = await loadListItems('l_a', 'l_a');
    expect(names(a.items)).toEqual(['chips', 'cola']);
    const d = await loadListItems('default', 'l_a');
    expect(d.ok).toBe(true);
    expect(d.items).toEqual([]);
    // la liste par défaut ne reprend JAMAIS le miroir d'une autre liste
    expect(mockStore.has(listItemsKey('default'))).toBe(false);
    expect(names(get('SG_ITEMS'))).toEqual(['chips', 'cola']);
  });

  test('registre : les listes existantes sont toutes proposées à Menus', async () => {
    ancienTelephone('l_b');
    const r = await readMyLists();
    expect(r.lists.map((l) => l.id)).toEqual(['default', 'l_a', 'l_b']);
    expect(r.activeId).toBe('l_b');
  });

  test('liste partagée : Menus refuse, rien ne bouge', async () => {
    ancienTelephone('default');
    set('SG_LISTS', [
      { id: 'default', name: '' },
      { id: 'sh1', name: 'Amis', shared: true },
    ]);
    const r = await addToList('sh1', [{ key: 'sel', packs: 1, qty: 1, unit: 'u' }], { nameOf: () => 'Sel' });
    expect(r.status).toBe('refused_shared');
    expect(mockStore.has('SG_ITEMS__sh1')).toBe(false);
    expect(names(get('SG_ITEMS'))).toEqual(['pain', 'lait']);
  });

  test('ancien stockage illisible : rien écrit, Menus ne touche pas à la liste', async () => {
    ancienTelephone('default');
    set('SG_ITEMS', '{abîmé');
    const r = await addToList(null, [{ key: 'sel', packs: 1, qty: 1, unit: 'u' }], { nameOf: () => 'Sel' });
    expect(r.status).toBe('corrupt');
    expect(mockStore.get('SG_ITEMS')).toBe('{abîmé');
    expect(mockStore.has(listItemsKey('default'))).toBe(false);
  });

  test('déconnexion : les clés de listes sont toutes effacées par le préfixe SG_ITEMS__', async () => {
    ancienTelephone('default');
    await loadListItems('default', 'default');
    const scoped = [...mockStore.keys()].filter((k) => k.startsWith('SG_ITEMS__'));
    expect(scoped).toEqual(expect.arrayContaining(['SG_ITEMS__default', 'SG_ITEMS__l_a', 'SG_ITEMS__l_b']));
  });
});
