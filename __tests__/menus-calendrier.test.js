// Calendrier par mois : grille, semaines connues, ce qu'on peut faire d'une semaine, choix libre d'une recette
// du catalogue pour un repas (verrouillé, accepté même si le profil l'écarte), textes dans les 13 langues.
import {
  monthGrid,
  shiftMonth,
  weeksIndex,
  weekKind,
  mondayISO,
  addDaysISO,
} from '../lib/menus/weeks';
import { generatePlan, swapMeal, lockedFromPlan } from '../lib/menus/planner';
import { unsuitableMeals, okForSig } from '../lib/menus/pool';
import { RECIPES, INGREDIENTS } from './menus-fixtures';

const fs = require('fs');
const path = require('path');

describe('grille du mois', () => {
  test('lundi en premier, semaines complètes, jours du mois tous présents', () => {
    const g = monthGrid(2026, 10); // novembre 2026 : le 1er est un dimanche
    expect(g[0].weekStart).toBe('2026-10-26');
    expect(g[0].days[6]).toMatchObject({ iso: '2026-11-01', date: 1, inMonth: true });
    expect(g[0].days[0].inMonth).toBe(false);
    for (const w of g) {
      expect(w.days).toHaveLength(7);
      expect(mondayISO(new Date(w.weekStart + 'T12:00:00'))).toBe(w.weekStart);
    }
    const inMonth = g.flatMap((w) => w.days).filter((d) => d.inMonth);
    expect(inMonth).toHaveLength(30);
    expect(g[g.length - 1].days.some((d) => d.iso === '2026-11-30')).toBe(true);
  });
  test("février, décembre, passage d'année", () => {
    expect(
      monthGrid(2026, 1)
        .flatMap((w) => w.days)
        .filter((d) => d.inMonth)
    ).toHaveLength(28);
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    const g = monthGrid(2027, 0);
    expect(g[0].days.some((d) => d.iso === '2027-01-01')).toBe(true);
  });
});

describe('semaines connues et actions', () => {
  const now = new Date(2026, 10, 3, 10); // mardi 3 novembre 2026
  const cur = { weekStart: '2026-11-02', meals: [{ key: '0-midi', recipeId: 'a' }] };
  const old = { weekStart: '2026-10-26', meals: [{ key: '0-midi', recipeId: 'b' }], savedAt: 1 };
  const old2 = { weekStart: '2026-10-26', meals: [{ key: '0-midi', recipeId: 'c' }], savedAt: 2 };
  const kept = { weekStart: '2026-11-02', meals: [{ key: '0-midi', recipeId: 'z' }], savedAt: 3 };
  test("le plan en cours l'emporte, puis l'entrée la plus récente", () => {
    const idx = weeksIndex(cur, [old, old2, kept]);
    expect(idx.get('2026-11-02')).toMatchObject({ source: 'plan' });
    expect(idx.get('2026-10-26').plan.meals[0].recipeId).toBe('c');
    expect(weeksIndex(null, null).size).toBe(0);
    expect(weeksIndex({ weekStart: 'nimp', meals: [] }, [{ weekStart: 3 }, null]).size).toBe(0);
  });
  test('edit, past, resume, prepare, far, none', () => {
    const idx = weeksIndex(cur, [old, { weekStart: '2026-11-16', meals: [] }]);
    expect(weekKind('2026-11-02', cur, idx, now)).toBe('edit');
    expect(weekKind('2026-10-26', cur, idx, now)).toBe('past');
    expect(weekKind('2026-10-19', cur, idx, now)).toBe('none');
    expect(weekKind('2026-11-09', cur, idx, now)).toBe('prepare');
    expect(weekKind('2026-11-16', cur, idx, now)).toBe('resume');
    expect(weekKind('2026-11-23', cur, idx, now)).toBe('far');
    expect(weekKind('pas-une-date', cur, idx, now)).toBe('none');
  });
  test("plan déjà sur la semaine suivante : l'actuelle est à composer, la suivante aussi", () => {
    const next = { weekStart: '2026-11-09', meals: [] };
    const idx = weeksIndex(next, []);
    expect(weekKind('2026-11-02', next, idx, now)).toBe('prepare');
    expect(weekKind('2026-11-16', next, idx, now)).toBe('prepare');
    expect(weekKind('2026-11-23', next, idx, now)).toBe('far');
    expect(addDaysISO('2026-11-09', 7)).toBe('2026-11-16');
  });
});

describe('choisir une recette précise (catalogue) pour un repas', () => {
  const base = { recipes: RECIPES, ingredients: INGREDIENTS };
  const profile = { adults: 2, excludedIngredients: ['lait'] };
  const plan = generatePlan({ ...base, profile, seed: 3, weekStart: '2026-11-02' });
  const key = plan.meals.find((m) => m.recipeId).key;
  const target = RECIPES.find((r) => r.ingredients.some((i) => i.key === 'poulet'));

  test('recette du catalogue posée à la main : gardée, verrouillée, marquée, régénération la garde', () => {
    const okFor = okForSig(profile, target);
    const n = swapMeal({
      plan,
      mealKey: key,
      recipeId: target.id,
      manual: true,
      okFor,
      ...base,
      profile,
      seed: 1,
    });
    const m = n.meals.find((x) => x.key === key);
    expect(m).toMatchObject({ recipeId: target.id, locked: true, manual: true, okFor });
    expect(
      unsuitableMeals(n, {
        recipes: new Map(RECIPES.map((r) => [r.id, r])),
        ingredients: INGREDIENTS,
        profile,
      }).some((u) => u.key === key)
    ).toBe(false);
    const again = generatePlan({
      ...base,
      profile,
      seed: 9,
      locked: lockedFromPlan(n),
      weekStart: '2026-11-02',
    });
    expect(again.meals.find((x) => x.key === key).recipeId).toBe(target.id);
    // les autres repas gardés restent identiques
    expect(n.weekStart).toBe('2026-11-02');
  });
  test('recette inconnue : le plan ne change pas, sans erreur', () => {
    const n = swapMeal({
      plan,
      mealKey: key,
      recipeId: 'nexiste-pas',
      manual: true,
      ...base,
      profile,
    });
    expect(n.meals.find((x) => x.key === key).recipeId).toBe(
      plan.meals.find((x) => x.key === key).recipeId
    );
  });
});

describe('textes du calendrier dans les 13 langues', () => {
  const KEYS = [
    'view',
    'prev',
    'next',
    'past',
    'prepare',
    'prepareNote',
    'resume',
    'far',
    'searchPh',
    'searchHint',
    'addTitle',
    'addSub',
    'replaceQ',
    'replace',
    'redoTitle',
    'redoAsk',
  ];
  const files = fs
    .readdirSync(path.join(__dirname, '..', 'locales'))
    .filter((f) => f.endsWith('.json'));
  test('13 langues, toutes les clés, variables et ponctuation propres', () => {
    expect(files).toHaveLength(13);
    for (const f of files) {
      const o = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', f), 'utf8')).menus
        .month;
      for (const k of KEYS) {
        expect(typeof o[k]).toBe('string');
        expect(o[k].length).toBeGreaterThan(1);
        expect(/[—→]/.test(o[k])).toBe(false);
      }
      expect(o.replaceQ).toContain('{{old}}');
      expect(o.replaceQ).toContain('{{new}}');
    }
  });
});

describe('vue Mois : dates écrites comme dans chaque langue', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../components/menus/MonthScreen.js'), 'utf8');

  test('pas de majuscule à chaque mot (« Mardi 3 Novembre ») : seulement la première lettre', () => {
    expect(src).not.toMatch(/textTransform:\s*'capitalize'/);
    const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const d = new Date(2026, 10, 3);
    const day = (l) =>
      capFirst(d.toLocaleDateString(l, { weekday: 'long', day: 'numeric', month: 'long' }));
    const month = (l) => capFirst(d.toLocaleDateString(l, { month: 'long', year: 'numeric' }));
    expect(day('fr')).toBe('Mardi 3 novembre');
    expect(month('fr')).toBe('Novembre 2026');
    expect(day('es')).toBe('Martes, 3 de noviembre');
    expect(month('es')).toBe('Noviembre de 2026');
    expect(day('de')).toBe('Dienstag, 3. November');
    expect(day('en')).toBe('Tuesday, November 3');
  });
});
