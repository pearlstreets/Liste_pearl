// Correctifs menus : liste par défaut, variété, badge "cuisiner double", lignes de courses,
// semaines, prix arabe, ajout d'une recette.
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
import { getRecipes, getIngredients } from '../lib/menus/recipes';
import { generatePlan, swapMeal, setFree, recomputeCooking } from '../lib/menus/planner';
import { dishProfile } from '../lib/menus/variety';
import { lineTexts } from '../lib/menus/lineText';
import { weekTarget, mondayISO, addDaysISO, dayIndexIn, isPastWeek } from '../lib/menus/weeks';
import { savePlan, loadPlan, pushHistory, loadHistory, clearPlan } from '../lib/menus/storage';
import { formatEur } from '../lib/menus/pricing';
import { recipeListLines } from '../lib/menus/recipeList';
import { buildShoppingList } from '../lib/menus/shopping';

const KEY_ITEMS = 'SG_ITEMS';
const set = (k, v) => mockStore.set(k, typeof v === 'string' ? v : JSON.stringify(v));
const get = (k) => (mockStore.has(k) ? JSON.parse(mockStore.get(k)) : undefined);
const it1 = (name, qty = 1) => ({ id: name, name, qty, unit: 'u', crossed: false, selected: true });

beforeEach(() => mockStore.clear());

describe('1. liste par défaut : plus de perte en changeant de liste', () => {
  test('quitter puis revenir sur la liste par défaut garde ses articles', async () => {
    set(KEY_ITEMS, [it1('pain'), it1('lait')]); // utilisateur existant, ancien stockage
    // liste par défaut active : premier chargement = migration vers la clé propre
    const a = await loadListItems('default', 'default');
    expect(a.items.map((x) => x.name)).toEqual(['pain', 'lait']);
    expect(get(listItemsKey('default'))).toHaveLength(2);
    // on bascule sur une autre liste : le miroir SG_ITEMS reçoit les articles de l'autre liste
    set('SG_LISTS', [{ id: 'L2', name: 'Soirée' }]);
    set('SG_ITEMS__L2', [it1('chips')]);
    await persistActiveItems('L2', [it1('chips')]);
    expect(get(KEY_ITEMS).map((x) => x.name)).toEqual(['chips']);
    // retour sur la liste par défaut : rien n'est perdu
    const back = await loadListItems('default', 'L2');
    expect(back.items.map((x) => x.name)).toEqual(['pain', 'lait']);
  });

  test('le miroir du panier est toujours la liste active', async () => {
    await persistActiveItems('default', [it1('a')]);
    expect(get(KEY_ITEMS)).toHaveLength(1);
    expect(get(listItemsKey('default'))).toHaveLength(1);
  });

  test("un ancien stockage corrompu n'écrase rien", async () => {
    set(KEY_ITEMS, '{pas du json');
    const r = await loadListItems('default', 'default');
    expect(r.ok).toBe(false);
    expect(mockStore.get(KEY_ITEMS)).toBe('{pas du json');
    expect(mockStore.has(listItemsKey('default'))).toBe(false);
  });

  test('ajout depuis Menus dans la liste par défaut quand une autre est active', async () => {
    set('SG_LISTS', [{ id: 'L2', name: 'Soirée' }]);
    set('SG_ACTIVE_LIST', 'L2');
    set(listItemsKey('default'), [it1('pain')]);
    set('SG_ITEMS__L2', [it1('chips')]);
    set(KEY_ITEMS, [it1('chips')]);
    const lines = [{ key: 'lait', packs: 2, qty: 2, unit: 'u' }];
    const r = await addToList('default', lines, { nameOf: () => 'Lait' });
    expect(r.status).toBe('ok');
    expect(get(listItemsKey('default')).map((x) => x.name)).toEqual(['pain', 'Lait']);
    expect(get(KEY_ITEMS).map((x) => x.name)).toEqual(['chips']); // miroir de L2 intact
  });

  test('readMyLists propose la liste par défaut même quand une autre est active', async () => {
    set('SG_LISTS', [
      { id: 'default', name: '' },
      { id: 'L2', name: 'Soirée' },
    ]);
    set('SG_ACTIVE_LIST', 'L2');
    const r = await readMyLists();
    expect(r.lists.map((l) => l.id)).toContain('default');
    expect(r.lists.map((l) => l.id)).toContain('L2');
    expect(r.activeId).toBe('L2');
  });
});

describe('3. variété du planificateur (vraies recettes)', () => {
  const recipes = getRecipes();
  const ingredients = getIngredients();
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const profile = { adults: 2, children: 1 };

  test('les deux currys aux pois chiches ne tombent jamais le même jour', () => {
    const a = dishProfile(byId.get('curry-pois-chiches-epinards'), ingredients);
    const b = dishProfile(byId.get('curry-patate-douce-pois-chiches'), ingredients);
    expect(a.family).toBe('curry');
    expect(b.family).toBe('curry');
    for (let seed = 1; seed <= 40; seed++) {
      const plan = generatePlan({ recipes, ingredients, profile, seed });
      for (let d = 0; d < 7; d++) {
        const fam = plan.meals
          .filter((m) => m.day === d && m.recipeId && !m.leftoverOf)
          .map((m) => dishProfile(byId.get(m.recipeId), ingredients));
        const families = fam.map((f) => f.family).filter((f) => f !== 'autre' && f);
        // pas de plat principal de même famille midi et soir (hors restes)
        expect(new Set(families).size).toBe(families.length);
      }
    }
  });

  test('midi et soir : plat principal différent', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = generatePlan({ recipes, ingredients, profile, seed });
      for (let d = 0; d < 7; d++) {
        const ms = plan.meals.filter((m) => m.day === d && m.recipeId && !m.leftoverOf);
        if (ms.length === 2) {
          expect(ms[0].recipeId).not.toBe(ms[1].recipeId);
          const p0 = dishProfile(byId.get(ms[0].recipeId), ingredients);
          const p1 = dishProfile(byId.get(ms[1].recipeId), ingredients);
          expect(p0.main && p0.main === p1.main).toBeFalsy();
        }
      }
    }
  });

  test('dans la semaine, pas plus de 3 plats de la même famille', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = generatePlan({ recipes, ingredients, profile, seed });
      const cnt = {};
      for (const m of plan.meals) {
        if (!m.recipeId || m.leftoverOf) continue;
        const f = dishProfile(byId.get(m.recipeId), ingredients).family;
        if (f) cnt[f] = (cnt[f] || 0) + 1;
      }
      for (const v of Object.values(cnt)) expect(v).toBeLessThanOrEqual(3);
    }
  });
});

describe('4. badge "cuisiner double" après Changer ou Libre', () => {
  const recipes = getRecipes();
  const ingredients = getIngredients();
  const profile = { adults: 2, children: 0 };
  const args = (plan, over) => ({ plan, recipes, ingredients, profile, ...over });

  test('cookPersons et leftoverOf restent cohérents après changement et repas libre', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30 && checked < 6; seed++) {
      let plan = generatePlan({ recipes, ingredients, profile, seed });
      const src = plan.meals.find((m) => m.cookPersons > m.persons + 0.01);
      if (!src) continue;
      checked++;
      const eater = plan.meals.find((m) => m.leftoverOf === src.key);
      // 1. on change le repas source
      const swapped = swapMeal(args(plan, { mealKey: src.key, seed: 5 }));
      for (const m of swapped.meals) {
        if (m.leftoverOf) {
          const s = swapped.meals.find((x) => x.key === m.leftoverOf);
          expect(s && s.recipeId === m.recipeId && !s.free).toBe(true);
        } else if (m.recipeId && !m.free) {
          const eat = swapped.meals
            .filter((x) => x.leftoverOf === m.key)
            .reduce((a, x) => a + x.persons, 0);
          expect(m.cookPersons).toBeCloseTo(m.persons + eat, 1);
        }
      }
      // 2. on passe le repas qui mange les restes en "libre" : plus de double portion
      const free = setFree(args(plan, { mealKey: eater.key, free: true }));
      const s2 = free.meals.find((m) => m.key === src.key);
      expect(free.meals.find((m) => m.key === eater.key).leftoverOf).toBeFalsy();
      expect(s2.cookPersons).toBeCloseTo(s2.persons, 1);
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('recomputeCooking : restes orphelins ou de recette différente remis à zéro', () => {
    const meals = [
      { key: '0-midi', day: 0, slot: 'midi', recipeId: 'a', persons: 2, cookPersons: 4 },
      { key: '0-soir', day: 0, slot: 'soir', recipeId: 'b', persons: 2, leftoverOf: '0-midi' },
      { key: '1-midi', day: 1, slot: 'midi', recipeId: 'c', persons: 2, leftoverOf: 'absent' },
    ];
    const out = recomputeCooking(meals);
    expect(out[1].leftoverOf).toBeNull();
    expect(out[2].leftoverOf).toBeNull();
    expect(out[0].cookPersons).toBe(2);
    expect(out[1].cookPersons).toBe(2);
    expect(meals[0].cookPersons).toBe(4); // entrée non modifiée
  });
});

describe('5. ligne de courses lisible pour les petites unités', () => {
  // t simulé : renvoie la clé et les paramètres utiles
  const t = (k, o = {}) => {
    const m = {
      'shop.noun_clove': `${o.amount} gousses`,
      'shop.pack_head': `${o.count} tête`,
      'shop.pack_box': `${o.count} boîte de ${o.size}`,
      'shop.pack_lot': `${o.count} lot de ${o.size}`,
      'shop.pack_roll': `${o.count} rouleau`,
      'shop.packs': `${o.count} x ${o.size}`,
    };
    return m[k] || k;
  };
  const labels = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', u: '' };
  const line = (o) => ({ qty: 1, unit: 'u', packs: 1, packQty: 1, packUnit: 'u', ...o });

  test('ail : 7 gousses, 1 tête (et non "7 · 1 x 10")', () => {
    const r = lineTexts(line({ key: 'ail', qty: 7, packs: 1, packQty: 10, packLabel: 'tête' }), t, {
      labels,
    });
    expect(r.qtyText).toBe('7 gousses');
    expect(r.packText).toBe('1 tête');
  });
  test('oeufs : boîte de 6, lot, rouleau', () => {
    expect(
      lineTexts(line({ key: 'oeuf', qty: 5, packQty: 6, packLabel: 'boîte de 6' }), t, { labels })
    ).toEqual({ qtyText: '5', packText: '1 boîte de 6' });
    expect(
      lineTexts(line({ key: 'yaourt', qty: 5, packs: 2, packQty: 4, packLabel: 'lot de 4' }), t, {
        labels,
      }).packText
    ).toBe('2 lot de 4');
    expect(
      lineTexts(line({ key: 'pate-brisee', qty: 2, packs: 2, packLabel: 'rouleau' }), t, { labels })
        .packText
    ).toBe('2 rouleau');
  });
  test('pièce : quantité seule ; grammes : affichage inchangé', () => {
    expect(
      lineTexts(line({ key: 'citron', qty: 3, packs: 3, packLabel: 'pièce' }), t, { labels })
    ).toEqual({ qtyText: '3', packText: '' });
    const g = lineTexts(
      { key: 'farine', qty: 500, unit: 'g', packs: 1, packQty: 1000, packUnit: 'g' },
      t,
      { labels }
    );
    expect(g).toEqual({ qtyText: '500 g', packText: '1 x 1 kg' });
  });
  test('toutes les étiquettes de paquet en unités des données sont reconnues', () => {
    const ings = getIngredients();
    for (const [key, i] of Object.entries(ings)) {
      if (!i.pack || i.pack.unit !== 'u') continue;
      const r = lineTexts(
        line({ key, qty: 2, packs: 1, packQty: i.pack.qty, packLabel: i.pack.label }),
        t,
        { labels }
      );
      expect(r.packText).not.toMatch(/ x /); // jamais le repli "N x taille"
    }
  });
});

describe('6. semaines', () => {
  const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);
  test('lundi de référence et semaine à proposer', () => {
    expect(mondayISO(D(2026, 10, 31))).toBe('2026-10-26'); // samedi
    expect(mondayISO(D(2026, 11, 1))).toBe('2026-10-26'); // dimanche
    expect(addDaysISO('2026-10-26', 7)).toBe('2026-11-02');
    expect(weekTarget(D(2026, 10, 29)).proposeNext).toBe(false); // jeudi
    expect(weekTarget(D(2026, 10, 31, 10)).proposeNext).toBe(false); // samedi matin
    const sat = weekTarget(D(2026, 10, 31, 19));
    expect(sat.proposeNext).toBe(true);
    expect(sat.start).toBe('2026-11-02');
    const sun = weekTarget(D(2026, 11, 1, 9));
    expect(sun.proposeNext).toBe(true);
    expect(sun.start).toBe('2026-11-02');
    expect(weekTarget(D(2026, 11, 2, 9)).start).toBe('2026-11-02');
  });
  test('jour courant dans la semaine du plan, semaine passée', () => {
    expect(dayIndexIn('2026-10-26', D(2026, 10, 28))).toBe(2);
    expect(dayIndexIn('2026-11-02', D(2026, 10, 28))).toBe(-1);
    expect(isPastWeek('2026-10-26', D(2026, 11, 1))).toBe(false);
    expect(isPastWeek('2026-10-26', D(2026, 11, 2))).toBe(true);
    expect(isPastWeek(null, D(2026, 11, 2))).toBe(false);
  });
  test('une semaine passée est archivée sans perte puis retirée', async () => {
    const recipes = getRecipes();
    const ingredients = getIngredients();
    const plan = generatePlan({
      recipes,
      ingredients,
      profile: { adults: 2, children: 0 },
      seed: 3,
      weekStart: '2026-10-19',
    });
    await savePlan(plan);
    const loaded = await loadPlan();
    expect(isPastWeek(loaded.weekStart, D(2026, 11, 2))).toBe(true);
    expect(await pushHistory(loaded)).toBe(true);
    await clearPlan();
    expect(await loadPlan()).toBeNull();
    const hist = await loadHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0].weekStart).toBe('2026-10-19');
    expect(hist[0].meals).toHaveLength(plan.meals.length);
  });
});

describe('7. prix en arabe', () => {
  test("même présentation que le reste de l'application", () => {
    expect(formatEur(12.5, 'ar')).toBe('12.50 €');
    expect(formatEur(12.5, 'ar-SA')).toBe('12.50 €');
    expect(formatEur(12.5, 'fr')).toBe('12,50 €');
  });
});

describe("8. ajout d'une recette à ma liste", () => {
  const recipes = getRecipes();
  const ingredients = getIngredients();
  const profile = { adults: 2, children: 0, pantry: [] };
  const recipe = recipes.find((r) => r.id === 'curry-pois-chiches-epinards');

  test('lignes à la portion choisie', () => {
    const two = recipeListLines({ recipe, persons: 2, recipes, ingredients, profile });
    const eight = recipeListLines({ recipe, persons: 8, recipes, ingredients, profile });
    expect(two.lines.length).toBeGreaterThan(0);
    expect(two.fingerprint).not.toBe(eight.fingerprint);
    const sum = (r) => r.lines.reduce((a, l) => a + l.qty, 0);
    expect(sum(eight)).toBeGreaterThan(sum(two));
  });

  test('fusion sans doublon, et deuxième appui sans effet', async () => {
    const { lines, fingerprint } = recipeListLines({
      recipe,
      persons: 4,
      recipes,
      ingredients,
      profile,
    });
    const nameOf = (l) => l.key;
    // un article déjà présent dans la liste
    const first = lines[0];
    set(KEY_ITEMS, [it1(first.key, 1)]);
    const r1 = await addToList(null, lines, { nameOf, fingerprint });
    expect(r1.status).toBe('ok');
    expect(r1.merged).toBe(1);
    const items = get(KEY_ITEMS);
    const names = items.map((x) => x.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length); // aucun doublon
    expect(items.find((x) => x.name === first.key).qty).toBe(1 + first.packs);
    // même recette, mêmes portions : rien de plus
    const r2 = await addToList(null, lines, { nameOf, fingerprint });
    expect(r2.status).toBe('already');
    expect(get(KEY_ITEMS)).toEqual(items);
  });

  test('cohérent avec la liste de courses du plan', () => {
    const one = recipeListLines({ recipe, persons: 4, recipes, ingredients, profile });
    const plan = {
      meals: [{ key: '0-midi', day: 0, slot: 'midi', recipeId: recipe.id, persons: 4 }],
    };
    const viaPlan = buildShoppingList({ plan, recipes, ingredients, profile });
    expect(one.lines.map((l) => l.key).sort()).toEqual(viaPlan.lines.map((l) => l.key).sort());
  });
});
