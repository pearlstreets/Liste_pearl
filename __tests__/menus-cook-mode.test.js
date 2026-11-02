jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  multiRemove: jest.fn(async () => {}),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Vibration: { vibrate: jest.fn() },
}));
jest.mock('../services/api', () => ({
  getTokens: jest.fn(async () => null),
  apiJsonWithStatus: jest.fn(async () => ({ ok: false, status: 500 })),
}));
jest.mock('../services/secureStorage', () => ({
  getSecureItem: jest.fn(async () => null),
}));

import { getRecipes, getCatalog, getTexts, getRecipe } from '../lib/menus/recipes';
import { idFromRow } from '../lib/menus/catalog';
import { buildCookPlan } from '../lib/menus/cookPlan';
import {
  initState,
  simulate,
  remaining,
  current,
  launch,
  finish,
  advance,
  undo,
  cancelCook,
  toggleCook,
  toggleAll,
  allDone,
  can,
  validState,
} from '../lib/menus/cookEngine';

const fr = getTexts('fr');
const planOf = (recipe) => {
  const steps = fr.recipeSteps(recipe.id);
  return buildCookPlan({ recipe, steps, frSteps: steps, ingredientName: fr.ingredientName });
};

describe('mode cuisine : plan des vraies recettes', () => {
  test('pâtes aux crevettes : eau d’abord, ail lancé pour finir avec les pâtes, 20 min', () => {
    const plan = planOf(getRecipe('crevettes-ail-citron-pates'));
    const [eau, pates, ail, crevettes, fin] = plan.tasks;
    expect(eau.cook.k).toBe('eau');
    expect(eau.label.key).toBe('cook.k.boilWater');
    expect(pates.need).toEqual(['eau']);
    expect(pates.keys).toContain('pates');
    expect(ail.sync).toEqual({ k: pates.cook.k, lead: 300 });
    expect(crevettes.keys).toContain('crevette');
    expect(fin.need).toEqual([pates.cook.k]);
    const sim = simulate(plan, initState(plan));
    expect(sim.done).toBe(true);
    expect(Math.round(sim.sec / 60)).toBe(20); // la recette annonce 20 min
  });

  test('boulettes en sauce tomate : pâtes lancées pendant le mijoté, plus court qu’annoncé', () => {
    const r = getRecipe('boulettes-sauce-tomate-pates');
    const plan = planOf(r);
    const pates = plan.tasks.find((x) => x.cook && x.cook.starch);
    expect(pates.label.key).toBe('cook.k.starch');
    expect(pates.sync).toBeTruthy();
    const sim = simulate(plan, initState(plan));
    expect(sim.done).toBe(true);
    expect(sim.sec / 60).toBeLessThanOrEqual(r.timeMin);
    expect(sim.sec).toBeLessThan(plan.seqSec);
  });

  test('toutes les recettes écrites à la main se terminent, jamais plus long que dans l’ordre', () => {
    for (const r of getRecipes()) {
      const plan = planOf(r);
      expect(plan.tasks.length).toBeGreaterThan(0);
      const sim = simulate(plan, initState(plan));
      expect(sim.done).toBe(true);
      expect(sim.sec).toBeLessThanOrEqual(plan.seqSec);
    }
  });

  test('recettes générées (échantillon) : même garantie', () => {
    const c = getCatalog();
    for (let row = 0; row < 11581; row += 37) {
      const r = c.get(idFromRow(row));
      if (!r) continue;
      const plan = planOf(r);
      const sim = simulate(plan, initState(plan));
      expect(sim.done).toBe(true);
      expect(sim.sec).toBeLessThanOrEqual(plan.seqSec);
    }
  });

  test('sans texte français ni minuteur : les étapes dans l’ordre', () => {
    const plan = buildCookPlan({ recipe: { id: 'x' }, steps: ['A', 'B', 'C'] });
    expect(plan.tasks.map((x) => x.after)).toEqual([[], [0], [1]]);
    expect(simulate(plan, initState(plan)).done).toBe(true);
  });
});

describe('mode cuisine : déroulé', () => {
  const plan = planOf(getRecipe('crevettes-ail-citron-pates'));

  test('ce qui vient d’être prêt passe devant : l’eau bout, on jette les pâtes', () => {
    let S = launch(plan, initState(plan), 0); // eau
    expect(current(plan, S)).not.toBe(1);
    S = advance(plan, S, 480).S;
    expect(current(plan, S)).toBe(1);
  });

  test('Défaire ne fait jamais reculer une cuisson', () => {
    let S = launch(plan, initState(plan), 0);
    const avant = S;
    S = advance(plan, S, 200).S;
    S = launch(plan, S, 2); // ail lancé par erreur
    S = advance(plan, S, 30).S;
    const back = undo(plan, S, avant);
    expect(back.st[2].s).toBe('todo');
    expect(back.cooks.find((c) => c.k === 'eau').r).toBe(480 - 230);
  });

  test('Annuler une cuisson la remet à lancer ; pause et tout en pause arrêtent le temps', () => {
    let S = launch(plan, initState(plan), 0);
    S = toggleCook(S, 'eau');
    S = advance(plan, S, 100).S;
    expect(S.cooks[0].r).toBe(480);
    S = toggleCook(S, 'eau');
    S = toggleAll(S);
    S = advance(plan, S, 100).S;
    expect(S.cooks[0].r).toBe(480);
    S = toggleAll(S);
    S = cancelCook(plan, S, 'eau');
    expect(S.st[0].s).toBe('todo');
    expect(S.cooks.length).toBe(0);
    expect(can(plan, S, 0)).toBe(true);
  });

  test('le repas est fini quand tout est fait et que toutes les cuissons sont prêtes', () => {
    let S = initState(plan);
    for (let n = 0; n < 100 && !allDone(plan, S); n++) {
      const c = current(plan, S);
      if (c >= 0 && S.st[c].s === 'todo') S = launch(plan, S, c);
      else if (c >= 0 && S.st[c].s === 'run') S = finish(plan, S, c);
      else S = advance(plan, S, 30).S;
    }
    expect(allDone(plan, S)).toBe(true);
    expect(remaining(plan, S)).toBe(0);
  });

  test('un état sauvegardé abîmé est refusé', () => {
    expect(validState(plan, null)).toBeNull();
    expect(validState(plan, { st: [], cooks: [] })).toBeNull();
    expect(validState(plan, JSON.parse(JSON.stringify(initState(plan))))).not.toBeNull();
  });
});

describe('mode cuisine : alertes', () => {
  beforeEach(() => jest.resetModules());

  test('sans module de notifications : rien ne plante', async () => {
    jest.doMock(
      'expo-audio',
      () => {
        throw new Error('absent');
      },
      { virtual: true }
    );
    jest.doMock(
      'expo-notifications',
      () => {
        throw new Error('absent');
      },
      { virtual: true }
    );
    const a = require('../services/cookAlerts');
    a._resetCookAlertsForTests();
    expect(() => a.feedback('ready')).not.toThrow();
    expect(() => a.keepScreenOn(true)).not.toThrow();
    await expect(
      a.scheduleCookAlarms([{ id: 'eau', inSec: 60, title: 't', body: 'b' }])
    ).resolves.toBeUndefined();
  });

  test('sons en fichiers quand le build contient expo-audio, un lecteur par son', () => {
    const play = jest.fn();
    const audio = {
      createAudioPlayer: jest.fn(() => ({ play, seekTo: jest.fn(async () => {}) })),
      setAudioModeAsync: jest.fn(async () => {}),
    };
    jest.doMock('expo-audio', () => audio, { virtual: true });
    const a = require('../services/cookAlerts');
    a._resetCookAlertsForTests();
    expect(a.cookScreenPlaysSounds()).toBe(false);
    a.keepScreenOn(true);
    expect(a.cookScreenPlaysSounds()).toBe(true);
    a.feedback('ready');
    a.feedback('ready');
    a.feedback('go');
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenCalledTimes(3);
    a.keepScreenOn(false);
    expect(a.cookScreenPlaysSounds()).toBe(false);
  });

  test('alarmes programmées à la fin de chaque cuisson, refaites à chaque changement', async () => {
    const sched = [];
    const nat = {
      scheduleNotificationAsync: jest.fn(async (x) => sched.push(x.identifier)),
      cancelScheduledNotificationAsync: jest.fn(async (id) => {
        const i = sched.indexOf(id);
        if (i >= 0) sched.splice(i, 1);
      }),
      getAllScheduledNotificationsAsync: jest.fn(async () =>
        sched.map((identifier) => ({ identifier }))
      ),
      getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
      SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
    };
    jest.doMock('expo-notifications', () => nat, { virtual: true });
    const a = require('../services/cookAlerts');
    a._resetCookAlertsForTests();
    await a.scheduleCookAlarms([
      { id: 'eau', inSec: 480, title: 'L’eau bout !', body: 'Cuire les pâtes.' },
      { id: 'etape-3', inSec: 240, title: 'Minuteur terminé', body: 'Crevettes' },
    ]);
    expect(sched).toEqual(['cuisine-eau', 'cuisine-etape-3']);
    expect(nat.scheduleNotificationAsync.mock.calls[0][0].content.data).toEqual({ cuisine: true });
    await a.scheduleCookAlarms([{ id: 'eau', inSec: 300, title: 'x', body: 'y' }]);
    expect(sched).toEqual(['cuisine-eau']);
    await a.cancelCookAlarms();
    expect(sched).toEqual([]);
  });
});
