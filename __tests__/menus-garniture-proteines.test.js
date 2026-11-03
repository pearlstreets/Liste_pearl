// Semaine sans quasi-doublons (même garniture, même sauce) et protéines servies proches de la cible quand un objectif
// perdre ou prendre en demande ; « Changer » n'offre pas de plat trop léger pour la cible quand d'autres existent.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { generatePlan, slotIdeas } from '../lib/menus/planner';
import { garnishOf, mealTraits, balancePenalty } from '../lib/menus/variety';
import { normalizeProfile } from '../lib/menus/profile';
import { portionTarget, SCALE_MAX } from '../lib/menus/needs';
import { dayTotals } from '../lib/menus/sides';

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

const LEA = {
  id: 'lea',
  name: 'Léa',
  age: 32,
  sex: 'f',
  heightCm: 165,
  weightKg: 60,
  activity: 'elevee',
  goal: 'perdre',
};
const TOM = {
  id: 'tom',
  name: 'Tom',
  age: 28,
  sex: 'm',
  heightCm: 180,
  weightKg: 78,
  goal: 'prendre',
};
const PERSO = () =>
  normalizeProfile({
    mode: 'perso',
    members: [LEA, TOM],
    prefs: { cuisines: ['asie'], quick: 30, balanced: true, treats: 1, sides: true },
  });
const plan = (profile, seed) =>
  generatePlan({ recipes: cat, ingredients: ings, profile, seed, weekStart: WEEK });

const SAUCE = [
  { key: 'sauce-soja', qty: 4, unit: 'cs' },
  { key: 'miel', qty: 40, unit: 'g' },
  { key: 'huile-sesame', qty: 1, unit: 'cs' },
  { key: 'sesame', qty: 2, unit: 'cs' },
  { key: 'ail', qty: 2, unit: 'u' },
  { key: 'huile-tournesol', qty: 3, unit: 'cs' },
];
const rec = (id, lines) => ({ id, ingredients: lines });
const NOUILLES = rec('n', [
  { key: 'crevette', qty: 400, unit: 'g' },
  { key: 'epinard', qty: 200, unit: 'g' },
  { key: 'champignon', qty: 250, unit: 'g' },
  ...SAUCE,
  { key: 'nouilles', qty: 300, unit: 'g' },
]);
const WOK_PORC = rec('p', [
  { key: 'porc-filet', qty: 500, unit: 'g' },
  { key: 'epinard', qty: 200, unit: 'g' },
  { key: 'champignon', qty: 250, unit: 'g' },
  ...SAUCE,
  { key: 'riz', qty: 300, unit: 'g' },
]);
const WOK_DINDE = rec('d', [
  { key: 'dinde-escalope', qty: 500, unit: 'g' },
  { key: 'chou-chinois', qty: 400, unit: 'g' },
  { key: 'carotte', qty: 200, unit: 'g' },
  ...SAUCE,
  { key: 'riz', qty: 300, unit: 'g' },
]);

// Paires de plats cuisinés différents qui partagent la garniture ou la sauce : [{ a, b, near }]
function pairs(p) {
  const out = [];
  const ck = p.meals.filter((m) => m.recipeId && !m.leftoverOf);
  for (let i = 0; i < ck.length; i++)
    for (let j = i + 1; j < ck.length; j++) {
      if (ck[i].recipeId === ck[j].recipeId) continue;
      const a = garnishOf(cat.get(ck[i].recipeId));
      const b = garnishOf(cat.get(ck[j].recipeId));
      if ((a.garnish && a.garnish === b.garnish) || (a.sauce && a.sauce === b.sauce))
        out.push({ a: ck[i].key, b: ck[j].key, near: Math.abs(ck[i].day - ck[j].day) <= 1 });
    }
  return out;
}

describe('garniture et sauce d un plat', () => {
  test('garnishOf : deux légumes les plus lourds et au moins trois condiments, protéine et base retirées', () => {
    expect(garnishOf(NOUILLES)).toEqual({
      garnish: 'champignon+epinard',
      sauce: 'huile-sesame+miel+sauce-soja+sesame',
    });
    expect(garnishOf(WOK_PORC)).toEqual(garnishOf(NOUILLES));
    expect(garnishOf(WOK_DINDE).garnish).toBe('carotte+chou-chinois');
    expect(garnishOf(WOK_DINDE).sauce).toBe(garnishOf(NOUILLES).sauce);
    // un seul légume, deux condiments, lignes facultatives : pas de signature
    expect(
      garnishOf(
        rec('x', [
          { key: 'poulet', qty: 500, unit: 'g' },
          { key: 'brocoli', qty: 400, unit: 'g' },
          { key: 'vinaigre', qty: 1, unit: 'cs' },
          { key: 'moutarde', qty: 1, unit: 'cc' },
          { key: 'courgette', qty: 300, unit: 'g', optional: true },
          { key: 'miel', qty: 10, unit: 'g', optional: true },
        ])
      )
    ).toEqual({ garnish: null, sauce: null });
    expect(garnishOf(null)).toEqual({ garnish: null, sauce: null });
    expect(garnishOf({ id: 'y', ingredients: 'oups' })).toEqual({ garnish: null, sauce: null });
  });

  test('balancePenalty : même garniture ou sauce très pénalisée la veille, le jour même ou le lendemain, forte dans la semaine', () => {
    const tr = (r) => ({ ...mealTraits(r), ...garnishOf(r) });
    const porc = tr(WOK_PORC);
    const sans = { ...porc, garnish: null, sauce: null };
    const placed = (t, day) => [{ traits: t, day, leftover: false }];
    const n = tr(NOUILLES);
    const d = tr(WOK_DINDE);
    const base = balancePenalty(sans, 4, placed(n, 3));
    expect(balancePenalty(porc, 4, placed(n, 3)) - base).toBeGreaterThanOrEqual(250);
    expect(
      balancePenalty(porc, 4, placed(d, 4)) - balancePenalty(sans, 4, placed(d, 4))
    ).toBeGreaterThanOrEqual(250);
    const loin = balancePenalty(porc, 6, placed(n, 1)) - balancePenalty(sans, 6, placed(n, 1));
    expect(loin).toBeGreaterThanOrEqual(50);
    expect(loin).toBeLessThan(250);
    // son propre reste n'est pas un autre plat de même garniture
    expect(balancePenalty(porc, 4, placed(porc, 3))).toBe(balancePenalty(sans, 4, placed(sans, 3)));
  });
});

describe('génération : Léa (perdre) et Tom (prendre), asie, rapide, équilibré, 1 plaisir', () => {
  const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

  test('jamais deux plats de même garniture ou de même sauce le même jour ou deux jours de suite, au plus une paire par semaine', () => {
    let total = 0;
    for (const seed of SEEDS) {
      const ps = pairs(plan(PERSO(), seed));
      expect(ps.filter((x) => x.near)).toEqual([]);
      expect(ps.length).toBeLessThanOrEqual(1);
      total += ps.length;
    }
    expect(total / SEEDS.length).toBeLessThan(0.5);
  });

  test('protéines servies : rares jours sous 75 % de la cible de chacun, kcal toujours approchées', () => {
    let sous = 0;
    let jours = 0;
    for (const seed of SEEDS) {
      for (const d of dayTotals(plan(PERSO(), seed), cat, PERSO()))
        for (const mb of d.members) {
          if (!mb.targetProtein) continue;
          jours++;
          if (mb.protein < 0.75 * mb.targetProtein) sous++;
          expect(mb.kcal).toBeGreaterThan(0.6 * mb.targetKcal);
        }
    }
    expect(jours).toBe(SEEDS.length * 7 * 2);
    expect(sous / jours).toBeLessThan(0.05); // 11 % des jours avant le correctif
  });

  test('pâtes : au plus deux plats, jamais deux jours de suite (restes compris)', () => {
    for (const seed of SEEDS) {
      const p = plan(PERSO(), seed);
      const pd = p.meals.filter(
        (m) => m.recipeId && mealTraits(cat.get(m.recipeId)).base === 'pates'
      );
      expect(pd.filter((m) => !m.leftoverOf).length).toBeLessThanOrEqual(2);
      const days = [...new Set(pd.map((m) => m.day))].sort((a, b) => a - b);
      for (let i = 1; i < days.length; i++) expect(days[i] - days[i - 1]).toBeGreaterThan(1);
    }
  });

  test('« Changer » : aucune idée trop légère pour la cible (portion à plus que doubler) quand d autres existent', () => {
    const prof = PERSO();
    const pt = portionTarget(prof);
    for (const seed of [1, 2, 3, 4]) {
      const p = plan(prof, seed);
      for (const m of p.meals.filter((x) => x.recipeId && !x.leftoverOf).slice(0, 4)) {
        const ideas = slotIdeas({
          plan: p,
          mealKey: m.key,
          recipes: cat,
          ingredients: ings,
          profile: prof,
          n: 3,
          rng: () => 0.5,
        });
        expect(ideas.length).toBe(3);
        for (const r of ideas) expect(pt.kcal / r.kcal).toBeLessThanOrEqual(SCALE_MAX);
      }
    }
  });
});

test('2 adultes sans personnalisation : aucune paire de même garniture ou de même sauce proche', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const ps = pairs(plan(normalizeProfile({ adults: 2 }), seed));
    expect(ps.filter((x) => x.near)).toEqual([]);
  }
});
