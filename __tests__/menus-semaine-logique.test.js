// Semaine logique : diversité pour tous (bases féculentes, protéines, cuisines), préférences facultatives
// (équilibrée, rapide, cuisines, repas plaisir), cible de calories des personnes, égalité sans réglage,
// régimes stricts sans impasse, préférences rangées dans household (protégées des anciennes versions).
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

import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getCatalog, getRecipes, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { generatePlan } from '../lib/menus/planner';
import { mealTraits, balancePenalty, isTreat, BASE_CAP } from '../lib/menus/variety';
import { healthOf, cuisineOf, isFried } from '../lib/menus/healthy';
import {
  normalizeProfile,
  cleanPrefs,
  defaultPrefs,
  prefsActive,
  QUICK_CHOICES,
  TREAT_CHOICES,
} from '../lib/menus/profile';
import { mealTarget } from '../lib/menus/needs';
import { weekTargets } from '../lib/menus/nutrition';
import { saveProfile, loadProfile, MENUS_KEY } from '../lib/menus/storage';
import { mergeSync } from '../lib/menus/sync';

const reel = () => ({
  meta: require('../data/menus/gen/meta.js'),
  hdr: require('../data/menus/gen/hdr.js'),
  loaders: require('../data/menus/gen/loaders.js'),
});
const WEEK = '2026-11-02';
let cat;
let ings;
beforeAll(() => {
  resetMenusCache();
  resetGenSource();
  setGenSource(reel());
  cat = getCatalog();
  ings = getIngredients();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

const plan = (profile, seed, recipes = cat) =>
  generatePlan({ recipes, ingredients: ings, profile, seed, weekStart: WEEK });
const cooked = (p) => p.meals.filter((m) => m.recipeId && !m.leftoverOf);
// repas servis, restes compris : un reste compte comme un repas de sa base et de sa protéine
const served = (p) => p.meals.filter((m) => m.recipeId);
const rec = (id) => cat.get(id);

const FEMME = { id: 'a', age: 34, sex: 'f', heightCm: 165, weightKg: 70, activity: 'moderee' };
const HOMME = { id: 'b', age: 30, sex: 'm', heightCm: 182, weightKg: 75, activity: 'elevee' };

describe('repères de variété', () => {
  test('base féculente et protéine déduites des ingrédients', () => {
    const r = (ingredients, extra = {}) => ({ id: 'x', ingredients, ...extra });
    expect(mealTraits(r([{ key: 'pates', qty: 400, unit: 'g' }]))).toEqual({
      base: 'pates',
      protein: null,
    });
    const t = mealTraits(
      r([
        { key: 'riz', qty: 300, unit: 'g' },
        { key: 'poulet-filet', qty: 500, unit: 'g' },
        { key: 'oeuf', qty: 2, unit: 'u' },
      ])
    );
    expect(t).toEqual({ base: 'riz', protein: 'volaille' });
    expect(mealTraits(r([{ key: 'steak-thon', qty: 2, unit: 'u' }])).protein).toBe('poisson');
    expect(mealTraits(r([{ key: 'pates', qty: 400, unit: 'g', optional: true }])).base).toBeNull();
    expect(mealTraits(null)).toEqual({ base: null, protein: null });
    expect(mealTraits({ id: 'tarte-poireaux', ingredients: 'oups' })).toEqual({
      base: 'tarte',
      protein: null,
    });
  });

  test('pénalité : même base le même jour, deux jours de suite, plafond de la semaine', () => {
    const p = (base, day, leftover = false) => ({ traits: { base, protein: null }, day, leftover });
    const tr = { base: 'pates', protein: null, cuisine: null };
    expect(balancePenalty(tr, 3, [])).toBe(0);
    const memeJour = balancePenalty(tr, 3, [p('pates', 3)]);
    const veille = balancePenalty(tr, 3, [p('pates', 2)]);
    const loin = balancePenalty(tr, 3, [p('pates', 0)]);
    expect(memeJour).toBeGreaterThan(veille);
    expect(veille).toBeGreaterThan(loin);
    const auPlafond = balancePenalty(tr, 6, [p('pates', 0), p('pates', 3)]);
    expect(auPlafond).toBeGreaterThan(loin * 3);
    expect(BASE_CAP.pates).toBe(2);
    expect(balancePenalty(null, 0, [])).toBe(0);
  });
});

describe('diversité pour tous (catalogue complet)', () => {
  const PROFILS = [
    { adults: 2 },
    { adults: 2, children: 2, budget: 90 },
    { adults: 2, diets: ['vegetarien'] },
    { adults: 3, diets: ['sans-gluten'] },
  ];
  const plans = [];
  beforeAll(() => {
    for (const pr of PROFILS) for (let s = 1; s <= 4; s++) plans.push({ pr, p: plan(pr, s * 13) });
  });

  test('pâtes : 2 par semaine au plus, jamais deux jours de suite, jamais midi et soir (restes compris)', () => {
    let trop = 0;
    let suite = 0;
    let memeJour = 0;
    for (const { p } of plans) {
      const c = served(p).map((m) => ({ day: m.day, base: mealTraits(rec(m.recipeId)).base }));
      if (c.filter((x) => x.base === 'pates').length > 2) trop++;
      for (let d = 0; d < 6; d++)
        if (
          c.some((x) => x.day === d && x.base === 'pates') &&
          c.some((x) => x.day === d + 1 && x.base === 'pates')
        )
          suite++;
      for (let d = 0; d < 7; d++) {
        const j = c.filter((x) => x.day === d && x.base);
        if (j.length === 2 && j[0].base === j[1].base) memeJour++;
      }
    }
    expect(trop).toBe(0);
    expect(suite).toBe(0);
    expect(memeJour).toBe(0);
  });

  test('protéines en rotation, poisson présent quand le régime le permet', () => {
    let sansPoisson = 0;
    for (const { pr, p } of plans) {
      const n = {};
      for (const m of served(p)) {
        const g = mealTraits(rec(m.recipeId)).protein;
        if (g) n[g] = (n[g] || 0) + 1;
      }
      expect(Math.max(0, ...Object.values(n))).toBeLessThanOrEqual(4);
      if (!pr.diets && !n.poisson) sansPoisson++;
    }
    expect(sansPoisson).toBeLessThanOrEqual(1);
  });

  test('un reste de pâtes compte : jamais de pâtes le lendemain ni de 3e repas de pâtes (40 graines, 2 adultes)', () => {
    let suite = 0;
    let trop = 0;
    for (let s = 1; s <= 40; s++) {
      const c = served(plan({ adults: 2 }, s)).map((m) => ({
        day: m.day,
        base: mealTraits(rec(m.recipeId)).base,
      }));
      const pates = c.filter((x) => x.base === 'pates');
      if (pates.length > 2) trop++;
      for (let d = 0; d < 6; d++)
        if (pates.some((x) => x.day === d) && pates.some((x) => x.day === d + 1)) suite++;
    }
    expect(suite).toBe(0);
    expect(trop).toBe(0);
  });

  test('cuisines variées : jamais plus de 4 plats de la même cuisine', () => {
    for (const { p } of plans) {
      const n = {};
      for (const m of cooked(p)) {
        const c = cuisineOf(rec(m.recipeId));
        if (c) n[c] = (n[c] || 0) + 1;
      }
      expect(Math.max(0, ...Object.values(n))).toBeLessThanOrEqual(4);
    }
  });
});

describe('égalité sans réglage', () => {
  const SANS = [
    { adults: 2 },
    { adults: 2, children: 1, budget: 70 },
    { adults: 1, diets: ['vegan'] },
  ];
  test.each([1, 7, 42])(
    'graine %s : prefs par défaut et members vides = mêmes semaines',
    (seed) => {
      for (const pr of SANS) {
        const a = plan(pr, seed);
        expect(plan({ ...pr, prefs: defaultPrefs() }, seed)).toEqual(a);
        expect(plan({ ...pr, members: [] }, seed)).toEqual(a);
        expect(plan({ ...pr, prefs: { sides: true } }, seed)).toEqual(a); // sides ne change pas le plan
        expect(plan({ ...pr, prefs: 'oups' }, seed)).toEqual(a);
      }
      const b = plan({ adults: 2 }, seed, getRecipes());
      expect(plan({ adults: 2, prefs: defaultPrefs() }, seed, getRecipes())).toEqual(b);
    }
  );
});

describe('préférences facultatives (bonus, jamais filtre)', () => {
  const SEEDS = [3, 11, 29];
  const moyenne = (profile, f, jours = null) => {
    let s = 0;
    let n = 0;
    for (const seed of SEEDS)
      for (const m of cooked(plan(profile, seed))) {
        if (jours && !jours.includes(m.day)) continue;
        s += f(rec(m.recipeId));
        n++;
      }
    return n ? s / n : 0;
  };

  test('repas rapides en semaine : temps du lundi au vendredi plus court', () => {
    const base = moyenne({ adults: 2 }, (r) => r.timeMin, [0, 1, 2, 3, 4]);
    const vite = moyenne({ adults: 2, prefs: { quick: 20 } }, (r) => r.timeMin, [0, 1, 2, 3, 4]);
    expect(vite).toBeLessThan(base);
    const part = moyenne(
      { adults: 2, prefs: { quick: 20 } },
      (r) => (r.timeMin <= 20 ? 1 : 0),
      [0, 1, 2, 3, 4]
    );
    expect(part).toBeGreaterThan(0.5);
  });

  test('semaine équilibrée : plus de plats équilibrés et de légumes, moins de fritures', () => {
    const f = (r) => (healthOf(r, ings).balanced ? 1 : 0);
    expect(moyenne({ adults: 2, prefs: { balanced: true } }, f)).toBeGreaterThan(
      moyenne({ adults: 2 }, f)
    );
    const veg = (r) => healthOf(r, ings).veg;
    expect(moyenne({ adults: 2, prefs: { balanced: true } }, veg)).toBeGreaterThan(
      moyenne({ adults: 2 }, veg)
    );
  });

  test('cuisines préférées : plus souvent, sans exclure les autres', () => {
    const f = (r) => (cuisineOf(r) === 'asie' ? 1 : 0);
    const avec = moyenne({ adults: 2, prefs: { cuisines: ['asie'] } }, f);
    expect(avec).toBeGreaterThan(moyenne({ adults: 2 }, f));
    expect(avec).toBeLessThan(1); // les autres cuisines restent possibles
  });

  test('cible de calories : suit les besoins par portion, objectif compté une seule fois (dans la portion)', () => {
    const perdre = {
      members: [
        { ...FEMME, goal: 'perdre' },
        { ...HOMME, goal: 'perdre' },
      ],
    };
    const maintenir = {
      members: [
        { ...FEMME, goal: 'maintenir' },
        { ...HOMME, goal: 'maintenir' },
      ],
    };
    expect(mealTarget({ adults: 2 }, 0, 'soir')).toBeNull();
    const cible = mealTarget(perdre, 0, 'soir');
    expect(cible.kcal).toBeGreaterThan(0);
    expect(cible.protein).toBeGreaterThan(0);
    // même cible par portion que l'équivalent sans objectif de perte : pas de second « tilt » par-dessus la portion
    const ref = mealTarget(maintenir, 0, 'soir');
    expect(Math.abs(cible.kcal - ref.kcal) / ref.kcal).toBeLessThan(0.12);
    const prot = (r) => Number(r.protein) || 0;
    expect(moyenne(perdre, prot)).toBeGreaterThan(0);
  });

  test('repas plaisir : jusqu au nombre choisi, jamais deux jours de suite, plutôt en fin de semaine', () => {
    const treat = (r) => isTreat(r, isFried(r));
    let total = 0;
    let finSemaine = 0;
    for (const seed of SEEDS) {
      const c = cooked(plan({ adults: 2, prefs: { treats: 2 } }, seed)).filter((m) =>
        treat(rec(m.recipeId))
      );
      expect(c.length).toBeLessThanOrEqual(2);
      const jours = c.map((m) => m.day).sort();
      for (let i = 1; i < jours.length; i++) expect(jours[i] - jours[i - 1]).toBeGreaterThan(1);
      total += c.length;
      finSemaine += c.filter((m) => m.day >= 5 || (m.day === 4 && m.slot === 'soir')).length;
    }
    expect(total).toBeGreaterThanOrEqual(SEEDS.length);
    expect(finSemaine).toBeGreaterThanOrEqual(Math.ceil(total / 2));
    // aucun plaisir demandé, ou semaine équilibrée sans choix : au plus 1
    for (const seed of SEEDS) {
      const n0 = cooked(plan({ adults: 2, prefs: { treats: 0 } }, seed)).filter((m) =>
        treat(rec(m.recipeId))
      ).length;
      expect(n0).toBe(0);
      const nb = cooked(plan({ adults: 2, prefs: { balanced: true } }, seed)).filter((m) =>
        treat(rec(m.recipeId))
      ).length;
      expect(nb).toBeLessThanOrEqual(1);
    }
  });
});

describe('régimes stricts et peu de recettes : jamais d impasse', () => {
  test.each([
    [{ adults: 1, diets: ['vegan', 'sans-gluten'], prefs: { balanced: true, quick: 20 } }],
    [{ adults: 2, diets: ['sans-gluten'], budget: 40, prefs: { cuisines: ['inde'], treats: 3 } }],
    [{ adults: 2, diets: ['vegan'], members: [{ ...FEMME, goal: 'perdre' }, HOMME] }],
  ])('%j', (profile) => {
    for (const seed of [1, 2]) {
      for (const recipes of [cat, getRecipes()]) {
        const p = plan(profile, seed, recipes);
        expect(p.warnings.some((w) => w.code === 'error')).toBe(false);
        expect(p.meals).toHaveLength(14);
        expect(cooked(p).length).toBeGreaterThan(4);
        for (const m of p.meals.filter((x) => x.recipeId)) {
          const tags = (
            recipes === cat ? rec(m.recipeId) : getRecipes().find((r) => r.id === m.recipeId)
          ).tags;
          for (const d of profile.diets) expect(tags).toContain(d);
        }
      }
    }
  });
});

describe('prefs : assainies, rangées dans household', () => {
  test('cleanPrefs ne lève jamais et revient à éteint', () => {
    expect(cleanPrefs(undefined)).toEqual(defaultPrefs());
    expect(
      cleanPrefs({ balanced: 'oui', quick: 25, cuisines: ['asie', 'asie', 'mars', 3], treats: 7 })
    ).toEqual({ balanced: false, quick: 0, cuisines: ['asie'], sides: false, treats: null });
    expect(cleanPrefs({ balanced: true, quick: '30', sides: true, treats: '0' })).toEqual({
      balanced: true,
      quick: 30,
      cuisines: [],
      sides: true,
      treats: 0,
    });
    expect(QUICK_CHOICES).toEqual([0, 20, 30]);
    expect(TREAT_CHOICES).toEqual([0, 1, 2, 3]);
    expect(prefsActive(defaultPrefs())).toBe(false);
    expect(prefsActive({ ...defaultPrefs(), sides: true })).toBe(false);
    expect(prefsActive({ ...defaultPrefs(), treats: 0 })).toBe(true);
    expect(normalizeProfile({ adults: 2 })).not.toHaveProperty('prefs');
    expect(normalizeProfile({ prefs: { quick: 20 } }).prefs.quick).toBe(20);
  });

  describe('stockage', () => {
    beforeEach(() => mockStore.clear());
    const brut = (k) => {
      const s = mockStore.get(MENUS_KEY[k]);
      if (s === undefined) return undefined;
      const p = JSON.parse(s);
      return p && 'data' in p ? p.data : p;
    };

    test('prefs sous household, jamais dans le profil ; fusion partielle ; personnes gardées', async () => {
      await saveProfile({ members: [FEMME, HOMME] });
      let lu = await saveProfile({ prefs: { balanced: true, cuisines: ['italie'] } });
      expect(lu.prefs).toMatchObject({ balanced: true, cuisines: ['italie'] });
      expect(lu.members).toHaveLength(2);
      expect(brut('profile')).not.toHaveProperty('prefs');
      expect(brut('household').prefs).toMatchObject({ balanced: true, cuisines: ['italie'] });
      lu = await saveProfile({ prefs: { quick: 20 } });
      expect(lu.prefs).toMatchObject({ balanced: true, quick: 20, cuisines: ['italie'] });
      lu = await saveProfile({ members: [FEMME] });
      expect(lu.prefs.quick).toBe(20); // changer les personnes ne touche pas aux préférences
      expect((await loadProfile()).prefs).toMatchObject({ balanced: true, quick: 20 });
    });

    test('ancienne version qui réécrit le profil : les préférences restent', async () => {
      await saveProfile({ prefs: { treats: 1, balanced: true } });
      mockStore.set(
        MENUS_KEY.profile,
        JSON.stringify({ v: 1, data: { ...brut('profile'), adults: 3 } })
      );
      const lu = await loadProfile();
      expect(lu.adults).toBe(3);
      expect(lu.prefs).toMatchObject({ treats: 1, balanced: true });
    });

    test('profil enregistré avec prefs : déplacées vers household sans perte', async () => {
      mockStore.set(
        MENUS_KEY.profile,
        JSON.stringify({ v: 1, data: { adults: 2, prefs: { quick: 30 } } })
      );
      const lu = await loadProfile();
      expect(lu.prefs.quick).toBe(30);
      expect(brut('household').prefs.quick).toBe(30);
      expect(brut('profile')).not.toHaveProperty('prefs');
    });

    test('sans prefs réglées : le profil chargé n en a pas', async () => {
      await saveProfile({ adults: 2 });
      expect(await loadProfile()).not.toHaveProperty('prefs');
    });
  });

  test('synchro : un conflit garde les préférences', () => {
    const l = { household: { u: 20, v: { members: [FEMME], prefs: { quick: 20 } } } };
    const r = { household: { u: 10, v: { members: [HOMME] } } };
    const ms = mergeSync(l, r, { dirty: { household: true }, base: { household: 5 } });
    expect(ms.data.household.v.prefs).toEqual({ quick: 20 });
    expect(ms.data.household.v.members).toHaveLength(2);
  });
});

describe('weekTargets', () => {
  test('sans personnes : apports donnés, aucune cible', () => {
    const p = plan({ adults: 2 }, 5);
    const w = weekTargets(p, cat, { adults: 2 });
    expect(w.hasTargets).toBe(false);
    expect(w.days).toHaveLength(7);
    const m = w.days[0].meals[0];
    expect(m.target).toBeNull();
    expect(m.members).toEqual([]);
    expect(w.days[0].kcal).toBe(w.days[0].meals.reduce((s, x) => s + x.kcal, 0));
  });

  test('avec personnes : servi et cible par repas et par jour, cantine respectée', () => {
    const profile = {
      kidsCantine: true,
      members: [{ ...FEMME, goal: 'perdre' }, HOMME, { id: 'c', age: 8 }],
    };
    const p = plan(profile, 5);
    const w = weekTargets(p, cat, profile);
    expect(w.hasTargets).toBe(true);
    const lundi = w.days[0];
    const midi = lundi.meals.find((x) => x.slot === 'midi');
    const soir = lundi.meals.find((x) => x.slot === 'soir');
    expect(midi.members.map((x) => x.id)).toEqual(['a', 'b']); // enfant à la cantine
    expect(soir.members.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(soir.target).toEqual(mealTarget(profile, 0, 'soir'));
    const a = soir.members.find((x) => x.id === 'a');
    expect(a.targetKcal).toBeGreaterThan(0);
    if (soir.recipeId) expect(a.kcal).toBeGreaterThan(0);
    const totA = lundi.members.find((x) => x.id === 'a');
    expect(totA.targetKcal).toBe(
      lundi.meals
        .filter((x) => x.recipeId)
        .reduce((s, x) => s + x.members.find((y) => y.id === 'a').targetKcal, 0)
    );
  });

  test('entrées abîmées : jamais d exception', () => {
    expect(weekTargets(null, null, null).days).toHaveLength(7);
    expect(
      weekTargets(
        { meals: [null, { day: 9 }, { day: 1, slot: 'soir', recipeId: 'inconnu' }] },
        cat,
        {}
      ).days[1].meals[0].free
    ).toBe(true);
  });
});
