// Cuisine en lot : regroupement, temps, conservation, reprise, recette supprimée.
import {
  groupPreps,
  scheduleTasks,
  storageInfo,
  keepDaysOf,
  cleanBatch,
  newSession,
  buildSession,
  followIds,
  sessionProgress,
  setStepDone,
  planBatchMeals,
  proposeBatch,
  setMealsPrepared,
  linkedMealKeys,
} from '../lib/menus/batch';
import { buildShoppingList } from '../lib/menus/shopping';
import { lockedFromPlan } from '../lib/menus/planner';
import { defaultProfile } from '../lib/menus/profile';
import { INGREDIENTS, RECIPES } from './menus-fixtures';

const steps3 = ['Couper', 'Cuire au four', 'Laisser reposer'];
const withBatch = (id, extra) => ({
  ...RECIPES.find((r) => r.id === id),
  keepDays: 3,
  freezable: true,
  stepTimers: { 1: 1800 },
  stepKinds: { 1: 'four' },
  ovenTempC: 180,
  ...extra,
});
const A = withBatch('poulet-riz');
const B = withBatch('boeuf-pates');
const C = withBatch('porc-lentilles', { keepDays: 1, freezable: false });
const recipes = [A, B, C];
const profile = defaultProfile();
const stepsOf = () => steps3;
const items = [
  { recipeId: A.id, persons: 2, mealKeys: ['0-soir'] },
  { recipeId: B.id, persons: 2, mealKeys: [] },
];
const session = () => newSession({ items, today: '2026-11-02', weekStart: '2026-11-02', id: 's1' });
const view = (s, list = recipes) =>
  buildSession({
    session: s,
    recipes: list,
    ingredients: INGREDIENTS,
    profile,
    stepsOf,
    today: '2026-11-02',
  });

describe('regroupement', () => {
  test('un ingrédient partagé est cumulé et cite ses recettes', () => {
    const shared = {
      id: 'x',
      servings: 2,
      ingredients: [{ key: 'oignon', qty: 100, unit: 'g' }],
    };
    const other = { ...shared, id: 'y' };
    const out = groupPreps(
      [
        { recipe: shared, persons: 2 },
        { recipe: other, persons: 2 },
      ],
      INGREDIENTS,
      profile
    );
    const onion = out.filter((g) => g.key === 'oignon');
    expect(onion).toHaveLength(1);
    expect(onion[0].amt).toBe(200);
    expect(onion[0].recipes).toEqual(['x', 'y']);
  });
  test('entrée illisible ignorée sans exception', () => {
    expect(() => groupPreps([null, {}, { recipe: null }], INGREDIENTS, profile)).not.toThrow();
  });
});

describe('temps', () => {
  test('le parallèle est plus court que recette après recette', () => {
    const v = view(session());
    expect(v.totalMin).toBeGreaterThan(0);
    expect(v.totalMin).toBeLessThan(v.sequentialMin);
  });
  test('deux fours à températures éloignées ne se chevauchent pas', () => {
    const task = (ovenTempC) => ({
      recipe: { id: String(ovenTempC), ovenTempC },
      tasks: [
        {
          recipeId: String(ovenTempC),
          stepIndex: 0,
          kind: 'four',
          min: 30,
          hands: 2,
          timerSec: 1800,
        },
      ],
    });
    const out = scheduleTasks([task(120), task(220)], 0);
    expect(out.steps).toHaveLength(2);
    const [a, b] = out.steps;
    expect(a.endMin <= b.startMin || b.endMin <= a.startMin).toBe(true);
  });
});

describe('conservation', () => {
  test('date limite calculée depuis le jour de cuisson', () => {
    expect(storageInfo(A, '2026-11-02').fridgeUntil).toBe('2026-11-05');
  });
  test('non congelable : jamais de date de congélateur', () => {
    const x = storageInfo(C, '2026-11-02');
    expect(x.freezable).toBe(false);
    expect(x.freezerUntil).toBeNull();
  });
  test('recette sans donnée : durée prudente, pas congelable', () => {
    expect(keepDaysOf({})).toBe(2);
    expect(storageInfo({}, '2026-11-02').freezable).toBe(false);
  });
  test('repas prévu après la limite : à congeler, ou trop tard si non congelable', () => {
    const s = newSession({
      items: [
        { recipeId: A.id, persons: 2, mealKeys: ['6-soir'] },
        { recipeId: C.id, persons: 2, mealKeys: ['6-soir'] },
      ],
      today: '2026-11-02',
      weekStart: '2026-11-02',
      id: 's2',
    });
    const v = view(s);
    const a = v.storage.find((x) => x.recipeId === A.id);
    const c = v.storage.find((x) => x.recipeId === C.id);
    expect(a.mustFreeze).toBe(true);
    expect(c.mustFreeze).toBeFalsy();
    expect(c.tooLate).toBe(true);
  });
});

describe('reprise', () => {
  test('les cases cochées survivent à la relecture et donnent la prochaine étape', () => {
    let s = session();
    const ids = followIds(view(s));
    s = setStepDone(s, ids[0], true, '2026-11-03');
    s = setStepDone(s, ids[1], true, '2026-11-04');
    const again = cleanBatch(JSON.parse(JSON.stringify(s)));
    expect(again.cookedOn).toBe('2026-11-03');
    const p = sessionProgress(view(again), again);
    expect(p.done).toBe(2);
    expect(p.nextIndex).toBe(2);
    expect(p.complete).toBe(false);
  });
  test('tout coché : session terminée ; décocher rouvre', () => {
    let s = session();
    const ids = followIds(view(s));
    ids.forEach((id) => {
      s = setStepDone(s, id, true, '2026-11-03');
    });
    expect(sessionProgress(view(s), s).complete).toBe(true);
    s = setStepDone(s, ids[0], false, '2026-11-03');
    expect(sessionProgress(view(s), s).complete).toBe(false);
  });
  test.each([null, 'x', 3, [], { items: 'x' }, { items: [null, {}] }])(
    'donnée corrompue %j : ignorée',
    (bad) => {
      expect(cleanBatch(bad)).toBeNull();
    }
  );
  test('moins de 2 recettes : pas de session', () => {
    expect(newSession({ items: items.slice(0, 1), today: '2026-11-02' })).toBeNull();
  });
});

describe('recette supprimée', () => {
  test('sort du calcul, reste signalée, les autres cases restent justes', () => {
    let s = session();
    const before = followIds(view(s));
    const keep = before.find((id) => id.startsWith(`${A.id}#`));
    s = setStepDone(s, keep, true, '2026-11-02');
    const v = view(s, [A, C]);
    expect(v.missing).toEqual([B.id]);
    expect(v.items.map((i) => i.recipeId)).toEqual([A.id]);
    expect(v.steps.every((x) => x.recipeId === A.id)).toBe(true);
    expect(sessionProgress(v, s).done).toBeGreaterThanOrEqual(1);
  });
  test('toutes supprimées : vue vide sans plantage', () => {
    const v = view(session(), []);
    expect(v.items).toEqual([]);
    expect(sessionProgress(v, session()).complete).toBe(false);
  });
});

describe('semaine et courses', () => {
  const plan = {
    weekStart: '2026-11-02',
    meals: [
      { key: '0-soir', recipeId: A.id, persons: 2, locked: true },
      { key: '1-soir', recipeId: B.id, persons: 2 },
    ],
  };
  test('repas préparés : plus aucun ingrédient compté dans la liste de la semaine', () => {
    const s = session();
    expect(linkedMealKeys(plan, s)).toEqual(['0-soir']);
    const marked = setMealsPrepared(plan, s, true);
    expect(marked.meals[0].batchOf).toBe('s1');
    const keys = (p) =>
      buildShoppingList({ plan: p, recipes: RECIPES, ingredients: INGREDIENTS, profile }).lines.map(
        (l) => l.key
      );
    expect(keys(plan)).toContain('poulet');
    expect(keys(marked)).not.toContain('poulet');
  });
  test('marque retirée : le repas revient', () => {
    const s = session();
    const back = setMealsPrepared(setMealsPrepared(plan, s, true), s, false);
    expect(back.meals[0].batchOf).toBeFalsy();
  });
  test('un repas verrouillé garde sa marque à la régénération', () => {
    const marked = setMealsPrepared(plan, session(), true);
    expect(lockedFromPlan(marked)['0-soir'].batchOf).toBe('s1');
  });
  test('planBatchMeals saute les repas déjà préparés', () => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const marked = setMealsPrepared(plan, session(), true);
    expect(planBatchMeals(marked, byId).map((x) => x.recipeId)).toEqual([B.id]);
  });
  test('proposition : tolère un catalogue vide ou sans recette de lot', () => {
    expect(proposeBatch({ recipes: [], ingredients: {}, profile })).toEqual([]);
  });
});
