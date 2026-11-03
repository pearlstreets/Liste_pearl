// Apports du jour par personne (mode personnalisé) : ce que chacun mange réellement (portion ajustée aux besoins
// x son facteur de portion, accompagnement compris) face à SA cible, convives et cantine pris en compte.
import { dayTotals } from '../lib/menus/sides';
import { normalizeProfile } from '../lib/menus/profile';
import { portionFactor, memberNeeds, mealShare, recipePortionScale } from '../lib/menus/needs';

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
const KID = { id: 'kid', name: 'Zoé', age: 8, sex: 'f', heightCm: 128, weightKg: 26 };

const RECIPES = [
  { id: 'plat720', kcal: 720, protein: 40 },
  { id: 'plat480', kcal: 480, protein: 30 },
  { id: 'side', kcal: 100, protein: 4 },
];
const perso = (members, extra = {}) => normalizeProfile({ mode: 'perso', members, ...extra });
const meal = (day, slot, recipeId, extra = {}) => ({
  key: `${day}-${slot}`,
  day,
  slot,
  recipeId,
  free: false,
  persons: 2,
  ...extra,
});
const eats = (m, servedKcal) => Math.round(servedKcal * portionFactor(m));
const target = (m, ...slots) =>
  Math.round(slots.reduce((s, slot) => s + memberNeeds(m).kcal * mealShare(slot), 0));

describe('dayTotals : apports réels par personne', () => {
  test('exemple Léa et Tom : chacun face à sa cible, plus la portion de référence', () => {
    const p = perso([LEA, TOM]);
    const plan = { meals: [meal(0, 'midi', 'plat720'), meal(0, 'soir', 'plat720')] };
    const d = dayTotals(plan, RECIPES, p)[0];
    // Portion de référence : 2 x 720 (ajustement 1 pour 720 kcal face à une cible de 730).
    expect(d.kcal).toBe(1440);
    expect(d.members.map((x) => x.name)).toEqual(['Léa', 'Tom']);
    const [lea, tom] = d.members;
    expect(portionFactor(LEA)).toBeLessThan(1);
    expect(portionFactor(TOM)).toBeGreaterThan(1);
    expect(lea.kcal).toBe(eats(LEA, 1440));
    expect(tom.kcal).toBe(eats(TOM, 1440));
    expect(lea.targetKcal).toBe(Math.round(memberNeeds(LEA).kcal * 0.7));
    expect(tom.targetKcal).toBe(Math.round(memberNeeds(TOM).kcal * 0.7));
    // Le chiffre de chacun est proche de SA cible, pas de celle de la portion de référence.
    expect(Math.abs(lea.kcal - lea.targetKcal)).toBeLessThan(Math.abs(d.kcal - lea.targetKcal));
    expect(Math.abs(tom.kcal - tom.targetKcal)).toBeLessThan(Math.abs(d.kcal - tom.targetKcal));
    expect(d.household).toEqual({
      kcal: Math.round(1440 * portionFactor(LEA) + 1440 * portionFactor(TOM)),
      protein: Math.round(80 * portionFactor(LEA) + 80 * portionFactor(TOM)),
      targetKcal: Math.round((memberNeeds(LEA).kcal + memberNeeds(TOM).kcal) * 0.7),
      targetProtein: Math.round((memberNeeds(LEA).protein + memberNeeds(TOM).protein) * 0.7),
    });
  });

  test('portion ajustée aux besoins appliquée (480 kcal x 1,5) et accompagnement compté', () => {
    const p = perso([LEA, TOM]);
    const plan = { meals: [meal(1, 'soir', 'plat480', { sideId: 'side' })] };
    const d = dayTotals(plan, RECIPES, p)[1];
    expect(d.kcal).toBe(480 * 1.5 + 100);
    expect(d.members[0].kcal).toBe(eats(LEA, 820));
    expect(d.members[0].protein).toBe(Math.round((30 * 1.5 + 4) * portionFactor(LEA)));
    expect(d.members[1].kcal).toBe(eats(TOM, 820));
  });

  test('convives : une personne absente d un repas ne le compte pas', () => {
    const p = perso([LEA, TOM]);
    const plan = {
      meals: [meal(2, 'midi', 'plat720', { eaters: ['lea'] }), meal(2, 'soir', 'plat720')],
    };
    const d = dayTotals(plan, RECIPES, p)[2];
    const [lea, tom] = d.members;
    expect(lea.kcal).toBe(eats(LEA, 1440));
    expect(lea.targetKcal).toBe(target(LEA, 'midi', 'soir'));
    expect(tom.kcal).toBe(eats(TOM, 720));
    expect(tom.targetKcal).toBe(target(TOM, 'soir'));
  });

  test('personne absente de tous les repas du jour : pas de ligne', () => {
    const p = perso([LEA, TOM]);
    const plan = { meals: [meal(3, 'soir', 'plat720', { eaters: ['tom'] })] };
    const d = dayTotals(plan, RECIPES, p)[3];
    expect(d.members.map((x) => x.id)).toEqual(['tom']);
    expect(d.household.kcal).toBe(d.members[0].kcal);
  });

  test('cantine : l enfant ne compte pas le midi en semaine', () => {
    const p = perso([LEA, KID], { kidsCantine: true });
    const plan = { meals: [meal(0, 'midi', 'plat720'), meal(0, 'soir', 'plat720')] };
    const d = dayTotals(plan, RECIPES, p)[0];
    const kid = d.members.find((x) => x.id === 'kid');
    const sc = recipePortionScale(p, RECIPES[0]);
    expect(kid.kcal).toBe(eats(KID, 720 * sc));
    expect(kid.targetKcal).toBe(target(KID, 'soir'));
  });

  test('ordre du foyer gardé et rang n pour un prénom vide', () => {
    const p = perso([{ ...TOM, name: '' }, LEA]);
    const plan = { meals: [meal(4, 'soir', 'plat720', { eaters: ['lea', 'tom'] })] };
    const d = dayTotals(plan, RECIPES, p)[4];
    expect(d.members.map((x) => [x.id, x.n])).toEqual([
      ['tom', 1],
      ['lea', 2],
    ]);
  });

  test('plus de 4 personnes : le total du foyer est la somme de chacun', () => {
    const many = [1, 2, 3, 4, 5].map((i) => ({ ...LEA, id: `p${i}`, name: `P${i}`, age: 20 + i }));
    const p = perso(many);
    const d = dayTotals({ meals: [meal(5, 'soir', 'plat720')] }, RECIPES, p)[5];
    expect(d.members).toHaveLength(5);
    const sc = recipePortionScale(p, RECIPES[0]);
    const raw = many.reduce((s, m) => s + 720 * sc * portionFactor(m), 0);
    expect(d.household.kcal).toBe(Math.round(raw));
    const rawT = many.reduce((s, m) => s + memberNeeds(m).kcal * 0.35, 0);
    expect(d.household.targetKcal).toBe(Math.round(rawT));
  });

  test('mode simple et repas libre : aucune ligne par personne, affichage d avant', () => {
    const simple = normalizeProfile({ mode: 'simple', members: [LEA, TOM] });
    const plan = { meals: [meal(0, 'soir', 'plat720'), { ...meal(1, 'soir', null), free: true }] };
    const days = dayTotals(plan, RECIPES, simple);
    expect(days[0].kcal).toBe(720);
    expect(days[0].members).toEqual([]);
    expect(days[0].household).toBeNull();
    expect(days[1].meals).toBe(0);
    expect(dayTotals(plan, RECIPES, perso([LEA, TOM]))[1].members).toEqual([]);
  });

  test('jamais d exception sur des entrées invalides', () => {
    expect(dayTotals(null, null, null)).toHaveLength(7);
    expect(dayTotals({ meals: [null, 3, {}] }, RECIPES, perso([LEA]))[0].members).toEqual([]);
  });
});
