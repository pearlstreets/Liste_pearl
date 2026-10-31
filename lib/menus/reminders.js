// Rappels des menus : réglages et calendrier. Pur, sans stockage ni module natif, donc testable.
// Jours : 0 = lundi ... 6 = dimanche, comme `menus.days` et les clés de repas du plan.
import { estObjet, arr } from './util';
import { parseISO, toISO } from './weeks';

export const REMINDER_ID_PREFIX = 'menus-rappel-';
export const REMINDER_PLAN_ID = `${REMINDER_ID_PREFIX}semaine`;
export const REMINDER_SHOP_ID = `${REMINDER_ID_PREFIX}courses`;
const PREP_ID_PREFIX = `${REMINDER_ID_PREFIX}veille-`;

export const REMINDER_SOURCE = 'menus';
export const PREP_HOUR = 19;
export const LONG_RECIPE_MIN = 60;
const MEAT_FISH_AISLE = 'viandes-poissons';
const SEAFOOD_ALLERGENS = ['poisson', 'crustaces', 'mollusques'];
const MAX_NAMES = 2;

export const defaultReminders = () => ({
  plan: { on: false, weekday: 6, hour: 10, minute: 0 },
  shop: { on: false, weekday: 5, hour: 10, minute: 0 },
  prep: { on: false },
});

const entierDans = (v, min, max, repli) =>
  Number.isInteger(v) && v >= min && v <= max ? v : repli;

function cleanWeekly(v, def) {
  const e = estObjet(v) ? v : {};
  return {
    on: e.on === true,
    weekday: entierDans(e.weekday, 0, 6, def.weekday),
    hour: entierDans(e.hour, 0, 23, def.hour),
    minute: entierDans(e.minute, 0, 59, def.minute),
  };
}

/** Réglages lisibles quoi qu'il arrive : toute valeur corrompue revient au défaut (désactivé). */
export function cleanReminders(v) {
  const def = defaultReminders();
  const r = estObjet(v) ? v : {};
  return {
    plan: cleanWeekly(r.plan, def.plan),
    shop: cleanWeekly(r.shop, def.shop),
    prep: { on: estObjet(r.prep) && r.prep.on === true },
  };
}

export const anyReminderOn = (v) => {
  const r = cleanReminders(v);
  return r.plan.on || r.shop.on || r.prep.on;
};

/** Jour attendu par le déclencheur hebdomadaire : 1 = dimanche ... 7 = samedi. */
export const toTriggerWeekday = (weekday) => ((weekday + 1) % 7) + 1;

function contientViandeOuPoisson(recipe, ingredients) {
  const cat = estObjet(ingredients) ? ingredients : {};
  return arr(recipe.ingredients).some((i) => {
    if (!estObjet(i)) return false;
    const info = cat[String(i.key)];
    if (!estObjet(info)) return false;
    return (
      info.aisle === MEAT_FISH_AISLE ||
      arr(info.allergens).some((a) => SEAFOOD_ALLERGENS.includes(a))
    );
  });
}

/** Recette à anticiper la veille : viande ou poisson, ou plus de 60 minutes. */
export function needsPrep(recipe, ingredients) {
  if (!estObjet(recipe)) return false;
  return Number(recipe.timeMin) > LONG_RECIPE_MIN || contientViandeOuPoisson(recipe, ingredients);
}

/**
 * Une entrée par veille à venir : { day: 'AAAA-MM-JJ' du repas, at: Date, meals: [{ recipeId, mealKey }] }.
 * Un reste, un soir libre ou une recette inconnue ne demandent rien ; une veille passée est ignorée.
 */
export function prepDays({ plan, recipeById, ingredients, now = new Date() }) {
  if (!estObjet(plan) || !parseISO(plan.weekStart)) return [];
  const trouver = (id) =>
    recipeById && typeof recipeById.get === 'function' ? recipeById.get(id) : undefined;
  const parJour = new Map();
  for (const m of arr(plan.meals)) {
    if (!estObjet(m) || !m.recipeId || m.free || m.leftoverOf || m.batchOf) continue;
    const rang = /^([0-6])-(midi|soir)$/.exec(String(m.key));
    if (!rang || !needsPrep(trouver(m.recipeId), ingredients)) continue;
    const jour = Number(rang[1]);
    if (!parJour.has(jour)) parJour.set(jour, []);
    const liste = parJour.get(jour);
    if (!liste.some((x) => x.recipeId === m.recipeId))
      liste.push({ recipeId: m.recipeId, mealKey: m.key });
  }
  const out = [];
  for (const jour of [...parJour.keys()].sort((a, b) => a - b)) {
    const repas = parseISO(plan.weekStart);
    repas.setDate(repas.getDate() + jour);
    const at = new Date(
      repas.getFullYear(),
      repas.getMonth(),
      repas.getDate() - 1,
      PREP_HOUR,
      0,
      0
    );
    if (at.getTime() > now.getTime()) out.push({ day: toISO(repas), at, meals: parJour.get(jour) });
  }
  return out;
}

function nomsRecettes(meals, texts) {
  const noms = [];
  for (const m of meals) {
    let nom = '';
    try {
      nom = texts && texts.recipeTitle ? texts.recipeTitle(m.recipeId) : '';
    } catch {
      nom = '';
    }
    if (typeof nom === 'string' && nom.trim()) noms.push(nom.trim());
  }
  return noms.slice(0, MAX_NAMES).join(', ');
}

const hebdo = (e) => ({
  type: 'weekly',
  weekday: toTriggerWeekday(e.weekday),
  hour: e.hour,
  minute: e.minute,
});

/**
 * Calendrier complet voulu : [{ identifier, content, trigger }]. Identifiants stables : reprogrammer
 * remplace, jamais de doublon. `t` reçoit une clé du namespace `menus`.
 */
export function buildReminderSchedule({
  reminders,
  plan,
  recipeById,
  ingredients,
  texts,
  t,
  now = new Date(),
}) {
  const r = cleanReminders(reminders);
  const out = [];
  if (r.plan.on)
    out.push({
      identifier: REMINDER_PLAN_ID,
      content: {
        title: t('reminders.planTitle'),
        body: t('reminders.planBody'),
        data: { source: REMINDER_SOURCE, target: 'week' },
      },
      trigger: hebdo(r.plan),
    });
  if (r.shop.on)
    out.push({
      identifier: REMINDER_SHOP_ID,
      content: {
        title: t('reminders.shopTitle'),
        body: t('reminders.shopBody'),
        data: { source: REMINDER_SOURCE, target: 'shop' },
      },
      trigger: hebdo(r.shop),
    });
  if (r.prep.on)
    for (const p of prepDays({ plan, recipeById, ingredients, now })) {
      const noms = nomsRecettes(p.meals, texts);
      const seule = p.meals.length === 1 ? p.meals[0] : null;
      out.push({
        identifier: `${PREP_ID_PREFIX}${p.day}`,
        content: {
          title: t('reminders.prepTitle'),
          body: noms
            ? t('reminders.prepBody', { recipes: noms, interpolation: { escapeValue: false } })
            : t('reminders.prepBodyPlain'),
          data: {
            source: REMINDER_SOURCE,
            target: 'week',
            ...(seule ? { recipeId: seule.recipeId, mealKey: seule.mealKey } : {}),
          },
        },
        trigger: { type: 'date', date: p.at },
      });
    }
  return out;
}

/** Destination d'une notification touchée, null si elle ne vient pas de ces rappels. */
export function reminderTarget(data) {
  if (!estObjet(data) || data.source !== REMINDER_SOURCE) return null;
  const target = data.target === 'shop' ? 'shop' : 'week';
  const recipeId = typeof data.recipeId === 'string' && data.recipeId ? data.recipeId : null;
  const mealKey = typeof data.mealKey === 'string' && data.mealKey ? data.mealKey : null;
  return { target, recipeId, mealKey };
}
