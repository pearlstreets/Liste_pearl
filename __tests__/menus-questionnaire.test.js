// Questionnaire « Personnaliser mes menus » : mode simple / personnalisé du foyer (personnes gardées mais
// ignorées en simple), marques de suppression des personnes (membersDeleted) et leur fusion de synchro.
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

import { loadProfile, saveProfile, resetAllMenus, MENUS_KEY, readSyncSnapshot } from '../lib/menus/storage';
import { normalizeProfile, personsFor, portionsForHeads } from '../lib/menus/profile';
import { membersAt, householdMealNeeds, mealTarget, activeMembers, isSimpleMode } from '../lib/menus/needs';
import { mergeSync, mergeFirstLogin } from '../lib/menus/sync';

const A = { id: 'a', name: 'Ana', age: 35, sex: 'f', heightCm: 165, weightKg: 60, activity: 'moderee', goal: 'perdre' };
const B = { id: 'b', name: 'Bob', age: 8 };
const foyer = (extra) => ({ members: [A, B], ...extra });

beforeEach(() => mockStore.clear());

describe('mode du foyer dans le profil', () => {
  test('sans mode : comme avant, les personnes comptent', () => {
    const p = normalizeProfile({ adults: 5, children: 5, members: [A, B] });
    expect(p.mode).toBeUndefined();
    expect(p.members.length).toBe(2);
    expect(p.adults).toBe(1);
    expect(p.children).toBe(1);
    expect(householdMealNeeds(p, 0, 'soir')).not.toBeNull();
  });

  test('simple : personnes gardées (dormant), ignorées partout, adultes et enfants du réglage simple', () => {
    const p = normalizeProfile({ adults: 3, children: 2, mode: 'simple', members: [A, B] });
    expect(p.mode).toBe('simple');
    expect(p.members).toBeUndefined();
    expect(p.dormant.map((m) => m.id)).toEqual(['a', 'b']);
    expect(p.adults).toBe(3);
    expect(p.children).toBe(2);
    expect(personsFor(p, 0, 'soir')).toBe(3 + 2 * 0.6);
    expect(householdMealNeeds(p, 0, 'soir')).toBeNull();
    expect(mealTarget(p, 0, 'soir')).toBeNull();
    expect(portionsForHeads(p, 0, 'soir', 5)).toBe(3 + 2 * 0.6);
    // les fonctions de needs ignorent aussi un profil non normalisé
    const brut = { adults: 3, children: 2, mode: 'simple', members: [A, B] };
    expect(isSimpleMode(brut)).toBe(true);
    expect(activeMembers(brut)).toEqual([]);
    expect(membersAt(brut, 0, 'soir')).toEqual([]);
    expect(householdMealNeeds(brut, 0, 'soir')).toBeNull();
  });

  test('simple puis perso : les personnes reviennent, normalisation idempotente', () => {
    const simple = normalizeProfile({ adults: 3, children: 2, mode: 'simple', members: [A, B] });
    expect(normalizeProfile(simple)).toEqual(simple);
    const perso = normalizeProfile({ ...simple, mode: 'perso' });
    expect(perso.members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(perso.dormant).toBeUndefined();
    expect(perso.adults).toBe(1);
    expect(perso.children).toBe(1);
    expect(normalizeProfile({ ...simple, mode: undefined }).members.length).toBe(2);
  });

  test('mode inconnu ignoré, mode simple sans personnes sans effet', () => {
    expect(normalizeProfile({ mode: 'x' }).mode).toBeUndefined();
    const p = normalizeProfile({ adults: 2, children: 1, mode: 'simple' });
    expect(p.dormant).toBeUndefined();
    expect(p.adults).toBe(2);
  });
});

describe('mode et personnes rangés sous household', () => {
  test('mode simple enregistré, personnes gardées, retour en perso', async () => {
    await saveProfile({ members: [A, B] });
    const s = await saveProfile({ mode: 'simple', adults: 4, children: 0 });
    expect(s.mode).toBe('simple');
    expect(s.members).toBeUndefined();
    expect(s.adults).toBe(4);
    const rechargé = await loadProfile();
    expect(rechargé.mode).toBe('simple');
    expect(rechargé.dormant.length).toBe(2);
    const stocke = JSON.parse(mockStore.get(MENUS_KEY.profile)).data;
    expect('mode' in stocke || 'members' in stocke || 'dormant' in stocke).toBe(false);
    const h = JSON.parse(mockStore.get(MENUS_KEY.household)).data;
    expect(h.mode).toBe('simple');
    expect(h.members.length).toBe(2);
    const perso = await saveProfile({ mode: 'perso' });
    expect(perso.members.length).toBe(2);
    expect(perso.adults).toBe(1);
  });

  test('un patch sans members ne touche pas aux personnes ; members undefined non plus', async () => {
    await saveProfile({ members: [A, B] });
    await saveProfile({ adults: 2 });
    await saveProfile({ members: undefined });
    expect((await loadProfile()).members.length).toBe(2);
  });

  test('retrait d une personne : marque de suppression ; recréée avec un autre id, elle vit', async () => {
    await saveProfile({ members: [A, B] });
    const avant = Date.now();
    await saveProfile({ members: [A] });
    let h = JSON.parse(mockStore.get(MENUS_KEY.household)).data;
    expect(h.membersDeleted.b).toBeGreaterThanOrEqual(avant);
    expect(h.membersDeleted.a).toBeUndefined();
    await saveProfile({ members: [A, { id: 'c', name: 'Bob' }] });
    h = JSON.parse(mockStore.get(MENUS_KEY.household)).data;
    expect(h.members.map((m) => m.id)).toEqual(['a', 'c']);
    expect(h.membersDeleted.b).toBeGreaterThan(0);
    // le même identifiant qui revient efface sa marque
    await saveProfile({ members: [A, B] });
    h = JSON.parse(mockStore.get(MENUS_KEY.household)).data;
    expect(h.membersDeleted.b).toBeUndefined();
  });

  test('Tout effacer (members vide) marque toutes les personnes', async () => {
    await saveProfile({ members: [A, B] });
    await saveProfile({ members: [] });
    const h = JSON.parse(mockStore.get(MENUS_KEY.household)).data;
    expect(h.members).toEqual([]);
    expect(Object.keys(h.membersDeleted).sort()).toEqual(['a', 'b']);
  });

  test('tout réinitialiser sur un compte : personnes marquées supprimées et envoyées', async () => {
    await saveProfile({ members: [A, B], prefs: { balanced: true } });
    mockStore.set(
      MENUS_KEY.sync,
      JSON.stringify({ v: 1, data: { owner: '7', stamps: {}, base: {}, dirty: {}, lastSyncAt: 0 } })
    );
    await resetAllMenus();
    const snap = await readSyncSnapshot();
    expect(snap.entries.household.v.members).toEqual([]);
    expect(Object.keys(snap.entries.household.v.membersDeleted).sort()).toEqual(['a', 'b']);
    expect((await loadProfile()).members).toBeUndefined();
  });

  test('tout réinitialiser sans compte : tout est effacé, aucune marque', async () => {
    await saveProfile({ members: [A, B] });
    await resetAllMenus();
    expect(mockStore.has(MENUS_KEY.household)).toBe(false);
  });

  test('anciennes données sans mode ni marques : lues comme avant', async () => {
    mockStore.set(MENUS_KEY.household, JSON.stringify({ v: 1, data: { members: [A, B] } }));
    const p = await loadProfile();
    expect(p.members.length).toBe(2);
    expect(p.mode).toBeUndefined();
  });
});

describe('synchro : une personne supprimée ne revient pas', () => {
  const entree = (u, v) => ({ household: { u, v } });
  const ids = (r) => r.data.household.v.members.map((m) => m.id).sort();

  test('vrai conflit : supprimée ici, encore là et modifiée sur l autre téléphone', () => {
    const local = entree(100, { members: [A], membersDeleted: { b: 90 } });
    const distant = entree(200, { members: [A, { ...B, name: 'Bobby' }] });
    const r = mergeSync(local, distant, { dirty: { household: true }, base: { household: 50 } });
    expect(ids(r)).toEqual(['a']);
    expect(r.data.household.v.membersDeleted.b).toBe(90);
    expect(r.toPush).toContain('household');
  });

  test('vrai conflit : supprimée sur le compte, encore là en local', () => {
    const local = entree(300, { members: [A, B], prefs: { balanced: true } });
    const distant = entree(200, { members: [A], membersDeleted: { b: 150 } });
    const r = mergeSync(local, distant, { dirty: { household: true }, base: { household: 50 } });
    expect(ids(r)).toEqual(['a']);
    expect(r.data.household.v.prefs).toEqual({ balanced: true });
  });

  test('personne recréée (nouvel identifiant) après la suppression : elle survit', () => {
    const local = entree(100, { members: [A, { id: 'c', name: 'Bob' }], membersDeleted: { b: 90 } });
    const distant = entree(200, { members: [A, B] });
    const r = mergeSync(local, distant, { dirty: { household: true }, base: { household: 50 } });
    expect(ids(r)).toEqual(['a', 'c']);
  });

  test('premier rattachement : les marques s appliquent aussi, le mode est gardé', () => {
    const local = entree(100, { members: [A], membersDeleted: { b: 90 }, mode: 'simple' });
    const distant = entree(80, { members: [A, B] });
    const r = mergeFirstLogin(local, distant);
    expect(ids(r)).toEqual(['a']);
    expect(r.data.household.v.mode).toBe('simple');
  });

  test('sans marque ni conflit : rien ne change, union des personnes comme avant', () => {
    const local = entree(100, { members: [A] });
    const distant = entree(200, { members: [B] });
    const r = mergeSync(local, distant, { dirty: { household: true }, base: { household: 50 } });
    expect(ids(r)).toEqual(['a', 'b']);
    expect(r.data.household.v.membersDeleted).toBeUndefined();
  });

  test('marques abîmées ignorées sans exception', () => {
    const local = entree(100, { members: [A], membersDeleted: 'x' });
    const distant = entree(200, { members: [A, B], membersDeleted: { b: 'pas un nombre' } });
    const r = mergeSync(local, distant, { dirty: { household: true }, base: { household: 50 } });
    expect(ids(r)).toEqual(['a', 'b']);
  });
});
