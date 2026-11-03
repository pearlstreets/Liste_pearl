// Besoins par personne (facultatifs) : calculs, bornes, enfants, ancien comportement intact sans
// personnes détaillées, profil abîmé, sauvegarde et synchro qui gardent les personnes.
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

import {
  memberNeeds,
  portionFactor,
  mealShare,
  householdMealNeeds,
  cleanMembers,
  isChildMember,
} from '../lib/menus/needs';
import {
  normalizeProfile,
  personsFor,
  headsFor,
  portionsForHeads,
  CHILD_FACTOR,
} from '../lib/menus/profile';
import {
  loadProfile,
  saveProfile,
  clearAllMenus,
  MENUS_KEY,
  MENUS_KEYS,
  readSyncSnapshot,
} from '../lib/menus/storage';
import { mergeData, mergeSync, mergeFirstLogin, valeurValide } from '../lib/menus/sync';

const FEMME = { id: 'a', age: 30, sex: 'f', heightCm: 165, weightKg: 60, activity: 'moderee' };
const HOMME = {
  id: 'b',
  age: 35,
  sex: 'm',
  heightCm: 180,
  weightKg: 80,
  activity: 'elevee',
  goal: 'prendre',
};

describe('memberNeeds', () => {
  test('Mifflin-St Jeor et activité, cas connus', () => {
    // 10x60 + 6,25x165 - 5x30 - 161 = 1320,25 ; x1,375 = 1815 ; protéines 0,8 g/kg
    expect(memberNeeds(FEMME)).toMatchObject({ kcal: 1820, protein: 48, complete: true });
    // 1755 x 1,55 x 1,12 = 3047 ; protéines 1,8 g/kg
    expect(memberNeeds(HOMME)).toMatchObject({ kcal: 3050, protein: 144, child: false });
    const n = memberNeeds(FEMME);
    expect(n.fat).toBe(Math.round((1820 * 0.3) / 9));
    expect(n.carbs).toBe(Math.round((1820 - 48 * 4 - n.fat * 9) / 4));
  });

  test('perdre : -18 %, jamais sous le plancher, jamais au-dessus de l entretien', () => {
    const base = { age: 40, sex: 'm', heightCm: 180, weightKg: 90, activity: 'moderee' };
    const maint = memberNeeds(base).kcal;
    const perdre = memberNeeds({ ...base, goal: 'perdre' });
    expect(perdre.kcal).toBeLessThan(maint * 0.85);
    expect(perdre.kcal).toBeGreaterThan(maint * 0.8);
    expect(perdre.protein).toBe(Math.round(90 * 1.4));
    const petite = { age: 50, sex: 'f', heightCm: 155, weightKg: 50, activity: 'faible' };
    expect(memberNeeds({ ...petite, goal: 'perdre' }).kcal).toBe(1200);
    const fragile = { age: 70, sex: 'f', heightCm: 150, weightKg: 42, activity: 'faible' };
    // entretien 1016 kcal, sous le plancher : on reste à l'entretien, on ne monte pas à 1200
    expect(memberNeeds({ ...fragile, goal: 'perdre' }).kcal).toBe(memberNeeds(fragile).kcal);
    expect(memberNeeds({ ...fragile, goal: 'perdre' }).kcal).toBe(1020);
    const homme = { age: 60, sex: 'm', heightCm: 165, weightKg: 62, activity: 'faible' };
    expect(memberNeeds({ ...homme, goal: 'perdre' }).kcal).toBeGreaterThanOrEqual(1500);
  });

  test('enfants : références par âge, objectif ignoré sous 18 ans', () => {
    expect(memberNeeds({ age: 8, sex: 'm' }).kcal).toBe(1850);
    expect(memberNeeds({ age: 8, sex: 'f' }).kcal).toBe(1700);
    expect(memberNeeds({ age: 8 }).kcal).toBe(1780);
    expect(memberNeeds({ age: 8, sex: 'm' }).child).toBe(true);
    expect(memberNeeds({ age: 2 }).kcal).toBe(1030);
    expect(memberNeeds({ age: 8, sex: 'm', weightKg: 26 }).protein).toBe(25);
    const ado = { age: 15, sex: 'f', heightCm: 160, weightKg: 70, goal: 'perdre' };
    expect(memberNeeds(ado).kcal).toBe(2200);
    expect(memberNeeds({ ...ado, goal: 'prendre' }).kcal).toBe(2200);
    expect(memberNeeds(ado).child).toBe(false); // 15 ans : plus « enfant » (cantine), mais sans régime
  });

  test('valeurs absentes ou absurdes : jamais NaN, jamais d exception', () => {
    for (const m of [
      null,
      undefined,
      'x',
      [],
      {},
      { age: -3, heightCm: 'abc', weightKg: 9999, sex: 'z', activity: 'ultra', goal: 'tout' },
      { age: true, weightKg: '' },
    ]) {
      const n = memberNeeds(m);
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) expect(Number.isFinite(n[k])).toBe(true);
      expect(n.kcal).toBeGreaterThan(0);
    }
    expect(memberNeeds({}).kcal).toBe(2100);
    expect(memberNeeds({ child: true }).kcal).toBe(1260);
  });
});

describe('portionFactor et mealShare', () => {
  test('personne sans info = adulte 1 ou enfant 0,6, sinon besoins / 2100 bornés', () => {
    expect(portionFactor({})).toBe(1);
    expect(portionFactor({ child: true })).toBe(CHILD_FACTOR);
    expect(portionFactor(FEMME)).toBe(0.85);
    expect(portionFactor(HOMME)).toBe(1.45);
    expect(portionFactor({ age: 1 })).toBe(0.5);
    expect(portionFactor({ age: 0 })).toBe(0.4); // borne basse
    expect(
      portionFactor({
        age: 20,
        sex: 'm',
        heightCm: 210,
        weightKg: 140,
        activity: 'intense',
        goal: 'prendre',
      })
    ).toBe(1.8); // borne haute
  });

  test('parts des repas', () => {
    expect(mealShare('midi')).toBe(0.35);
    expect(mealShare('soir')).toBe(0.35);
    expect(mealShare('???')).toBe(0.35);
  });
});

describe('profil : sans personnes détaillées, rien ne change', () => {
  const ancien = (p, day, slot) => {
    const q = normalizeProfile(p);
    const cantine = q.kidsCantine && slot === 'midi' && day >= 0 && day <= 4;
    const n = q.adults + (cantine ? 0 : q.children * 0.6);
    return n > 0 ? Math.round(n * 100) / 100 : Math.max(1, q.adults);
  };
  const profils = [
    {},
    { adults: 2, children: 2 },
    { adults: 1, children: 3, kidsCantine: true },
    { adults: 0, children: 2, kidsCantine: true },
    { adults: 4, members: [] },
    { adults: 3, members: 'oups' },
  ];
  test('personsFor identique', () => {
    for (const p of profils)
      for (let d = 0; d < 7; d++)
        for (const s of ['midi', 'soir']) expect(personsFor(p, d, s)).toBe(ancien(p, d, s));
  });
  test('pas de champ members ajouté, householdMealNeeds null', () => {
    for (const p of profils) {
      expect(normalizeProfile(p)).not.toHaveProperty('members');
      expect(householdMealNeeds(p, 0, 'soir')).toBeNull();
    }
    expect(householdMealNeeds(null, 0, 'soir')).toBeNull();
  });
});

describe('profil avec personnes détaillées', () => {
  test('adultes et enfants en découlent (enfant = moins de 12 ans, ou ajouté comme enfant)', () => {
    const p = normalizeProfile({
      adults: 5,
      children: 0,
      members: [FEMME, HOMME, { age: 8 }, { child: true }, { age: 12 }],
    });
    expect(p.adults).toBe(3);
    expect(p.children).toBe(2);
    expect(isChildMember({ age: 11 })).toBe(true);
    expect(isChildMember({ age: 12 })).toBe(false);
    expect(isChildMember({ age: 30, child: true })).toBe(false);
  });

  test('personnes vides = même résultat que adultes/enfants', () => {
    const avant = { adults: 2, children: 1, kidsCantine: true };
    const apres = { ...avant, members: [{}, {}, { child: true }] };
    for (let d = 0; d < 7; d++)
      for (const s of ['midi', 'soir']) {
        expect(personsFor(apres, d, s)).toBe(personsFor(avant, d, s));
        expect(headsFor(apres, d, s)).toEqual(headsFor(avant, d, s));
        for (const h of [1, 2, 3, 5])
          expect(portionsForHeads(apres, d, s, h)).toBe(portionsForHeads(avant, d, s, h));
      }
  });

  test('personsFor = somme des facteurs, cantine respectée', () => {
    const p = { kidsCantine: true, members: [FEMME, HOMME, { age: 8, sex: 'm' }] };
    const enfant = portionFactor({ age: 8, sex: 'm' });
    expect(personsFor(p, 0, 'soir')).toBe(Math.round((0.85 + 1.45 + enfant) * 100) / 100);
    expect(personsFor(p, 1, 'midi')).toBe(2.3); // enfant à la cantine
    expect(personsFor(p, 5, 'midi')).toBe(personsFor(p, 0, 'soir')); // samedi
    // moins de convives : l'enfant part d'abord ; plus : adulte de référence
    expect(portionsForHeads(p, 0, 'soir', 3)).toBe(personsFor(p, 0, 'soir'));
    expect(portionsForHeads(p, 0, 'soir', 2)).toBe(2.3);
    expect(portionsForHeads(p, 0, 'soir', 4)).toBe(Math.round((2.3 + enfant + 1) * 100) / 100);
  });

  test('householdMealNeeds', () => {
    const p = { kidsCantine: true, members: [FEMME, HOMME, { age: 8, sex: 'm' }] };
    const soir = householdMealNeeds(p, 0, 'soir');
    expect(soir.count).toBe(3);
    expect(soir.kcal).toBe(Math.round((1820 + 3050 + 1850) * 0.35));
    expect(soir.protein).toBe(Math.round((48 + 144 + 28) * 0.35));
    expect(soir.portions).toBe(personsFor(p, 0, 'soir'));
    expect(soir.perPortionKcal).toBe(Math.round(soir.kcal / soir.portions));
    const midi = householdMealNeeds(p, 2, 'midi');
    expect(midi.count).toBe(2);
    expect(midi.kcal).toBe(Math.round((1820 + 3050) * 0.35));
    expect(householdMealNeeds(p, null, 'midi').count).toBe(3); // sans jour : tout le foyer
    const seulEnfant = householdMealNeeds({ kidsCantine: true, members: [{ age: 6 }] }, 0, 'midi');
    expect(seulEnfant).toMatchObject({ count: 0, kcal: 0, portions: 0, perPortionKcal: 0 });
  });

  test('profil abîmé : assaini sans jamais lever', () => {
    const p = normalizeProfile({
      members: [
        null,
        'x',
        { id: 'a', age: '42', sex: 'M', heightCm: 'grand', weightKg: -5, activity: 'moderee' },
        { id: 'a', age: 300, goal: 'perdre', name: 123 },
        { __proto__: { age: 3 } },
        ...Array.from({ length: 20 }, () => ({})),
      ],
    });
    expect(p.members).toHaveLength(12);
    expect(p.members[0]).toEqual({
      id: 'a',
      name: '',
      age: 42,
      sex: null,
      heightCm: null,
      weightKg: null,
      activity: 'moderee',
      goal: null,
      child: false,
    });
    expect(p.members[1].id).toBe('a-2'); // identifiants uniques
    expect(p.members[1].age).toBeNull();
    expect(p.adults + p.children).toBe(12);
    expect(cleanMembers({ length: 3 })).toEqual([]);
    expect(normalizeProfile({ members: [{}] }).adults).toBe(1);
  });
});

describe('sauvegarde et synchro', () => {
  beforeEach(() => mockStore.clear());
  const brut = (k) => {
    const s = mockStore.get(MENUS_KEY[k]);
    if (s === undefined) return undefined;
    const p = JSON.parse(s);
    return p && 'data' in p ? p.data : p;
  };

  test('les personnes sont rangées sous household, jamais dans le profil enregistré', async () => {
    const lu = await saveProfile({ members: [FEMME, HOMME, { age: 6 }] });
    expect(lu.members).toHaveLength(3);
    expect(brut('profile')).not.toHaveProperty('members');
    expect(brut('profile')).toMatchObject({ adults: 2, children: 1 });
    expect(brut('household').members).toHaveLength(3);
    expect(MENUS_KEY.household).toBe('MENUS_HOUSEHOLD');
    const snap = await readSyncSnapshot();
    expect(snap.entries.household.v.members).toHaveLength(3);
    expect(snap.entries.profile.v).not.toHaveProperty('members');
  });

  test('profil réécrit sans members par une ancienne version : les personnes restent', async () => {
    await saveProfile({ members: [FEMME, HOMME] });
    // Ancienne version : elle réécrit le profil entier (sans members, adultes changés à la main).
    mockStore.set(
      MENUS_KEY.profile,
      JSON.stringify({ v: 1, data: { ...brut('profile'), adults: 4, budget: 90 } })
    );
    const lu = await loadProfile();
    expect(lu.members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(lu.adults).toBe(2); // les personnes font foi
    expect(lu.budget).toBe(90); // le reste du profil de l'ancienne version est gardé
    // un patch sans members ne les touche pas non plus
    const apres = await saveProfile({ budget: 50 });
    expect(apres.members).toHaveLength(2);
  });

  test('migration : un profil enregistré avec members les déplace vers household sans perte', async () => {
    mockStore.set(
      MENUS_KEY.profile,
      JSON.stringify({ v: 1, data: { adults: 2, children: 0, members: [FEMME, { age: 7 }] } })
    );
    const lu = await loadProfile();
    expect(lu.members).toHaveLength(2);
    expect(lu.children).toBe(1);
    expect(brut('household').members).toHaveLength(2);
    expect(brut('profile')).not.toHaveProperty('members');
    expect((await loadProfile()).members).toHaveLength(2);
    // household déjà rempli : il fait foi, le profil est seulement nettoyé
    mockStore.set(
      MENUS_KEY.profile,
      JSON.stringify({ v: 1, data: { adults: 1, members: [{ id: 'z', age: 50 }] } })
    );
    expect((await loadProfile()).members.map((m) => m.id)).toEqual(['a', 'p2']);
    expect(brut('profile')).not.toHaveProperty('members');
  });

  test('effacée à la déconnexion comme les autres clés menus', async () => {
    await saveProfile({ members: [FEMME] });
    expect(MENUS_KEYS).toContain('MENUS_HOUSEHOLD');
    expect(mockStore.has('MENUS_HOUSEHOLD')).toBe(true);
    await clearAllMenus();
    expect(mockStore.has('MENUS_HOUSEHOLD')).toBe(false);
    expect((await loadProfile()).members).toBeUndefined();
  });

  test('household passe mergeData, mergeSync et mergeFirstLogin', () => {
    const h1 = { members: [FEMME] };
    const h2 = { members: [HOMME] };
    expect(valeurValide('household', h1)).toBe(true);
    expect(valeurValide('household', [])).toBe(false);
    const l = { household: { u: 20, v: h1 } };
    const r = { household: { u: 10, v: h2 } };
    const md = mergeData(l, r);
    expect(md.data.household.v).toEqual(h1);
    expect(md.toPush).toContain('household');
    expect(mergeData({}, r).toApply).toContain('household');
    // vrai conflit et première connexion : les personnes des deux téléphones sont réunies
    const ms = mergeSync(l, r, { dirty: { household: true }, base: { household: 5 } });
    expect(ms.data.household.v.members.map((m) => m.id)).toEqual(['a', 'b']);
    const fl = mergeFirstLogin(l, r);
    expect(fl.data.household.v.members.map((m) => m.id)).toEqual(['a', 'b']);
    // sans conflit, le plus récent gagne (une personne retirée ne revient pas)
    expect(mergeSync(l, r, { dirty: {}, base: { household: 10 } }).data.household.v).toEqual(h1);
    // mécanisme qui protège une ancienne version : une clé qu'elle ne connaît pas reste sur le compte
    const inconnue = mergeData({}, { cleFuture: { u: 3, v: { x: 1 } } });
    expect(inconnue.data.cleFuture).toEqual({ u: 3, v: { x: 1 } });
  });

  test('saveProfile / loadProfile gardent les personnes ; tout effacer revient à adultes/enfants', async () => {
    await saveProfile({ members: [FEMME, HOMME, { age: 6 }] });
    const lu = await loadProfile();
    expect(lu.members).toHaveLength(3);
    expect(lu.members[1]).toMatchObject({ sex: 'm', goal: 'prendre', weightKg: 80 });
    expect(lu.adults).toBe(2);
    expect(lu.children).toBe(1);
    await saveProfile({ members: [] });
    const vide = await loadProfile();
    expect(vide).not.toHaveProperty('members');
    expect(vide.adults).toBe(2);
    expect(vide.children).toBe(1);
  });

  test('la synchro ne perd pas members', () => {
    const v = normalizeProfile({ members: [FEMME, HOMME] });
    expect(valeurValide('profile', v)).toBe(true);
    const local = { profile: { u: 20, v } };
    const remote = { profile: { u: 10, v: normalizeProfile({ adults: 3 }) } };
    expect(mergeData(local, remote).data.profile.v.members).toHaveLength(2);
    expect(mergeData(remote, local).data.profile.v.members).toHaveLength(2);
    // vrai conflit entre deux téléphones et première connexion : la version récente garde ses personnes
    const conflit = mergeSync(local, remote, { dirty: { profile: true }, base: { profile: 5 } });
    expect(conflit.data.profile.v.members).toEqual(v.members);
    const premiere = mergeFirstLogin(local, remote);
    expect(premiere.data.profile.v.members).toEqual(v.members);
  });
});
