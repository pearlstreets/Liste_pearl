// Profil du foyer : valeurs par défaut et assainissement (jamais d'exception).
import { estObjet, estNombre, arr, num } from './util';
import { cleanMembers, cleanEaters, isChildMember, portionFactor, membersAt } from './needs';
import { CUISINES } from './healthy';

export const CHILD_FACTOR = 0.6;

export function defaultSlots() {
  const slots = {};
  for (let d = 0; d < 7; d++) {
    slots[`${d}-midi`] = true;
    slots[`${d}-soir`] = true;
  }
  return slots;
}

export function defaultProfile() {
  return {
    adults: 2,
    children: 0,
    budget: null, // euros par semaine, null = sans plafond
    slots: defaultSlots(),
    diets: [], // tags exigés (ex. vegetarien)
    excludedIngredients: [], // clés d'ingrédients ou allergènes à bannir
    maxTimeMin: null,
    pantry: [], // clés supposées déjà à la maison
    kidsCantine: false, // enfants à la cantine le midi, du lundi au vendredi
    useLeftovers: true,
    month: null, // 0-11, pour la saison (sinon pas de saison)
  };
}

/** Réponses possibles de « repas rapides en semaine » (minutes ; 0 = non). */
export const QUICK_CHOICES = [0, 20, 30];
/** Réponses possibles de « repas plaisir par semaine » (null = non réglé : ni forcé ni interdit). */
export const TREAT_CHOICES = [0, 1, 2, 3];

/** Préférences des menus, toutes éteintes. */
export function defaultPrefs() {
  return { balanced: false, quick: 0, cuisines: [], sides: false, treats: null };
}

/**
 * Préférences des menus assainies (jamais d'exception) : { balanced, quick 0|20|30, cuisines (parmi CUISINES,
 * sans doublon), sides, treats null|0|1|2|3 }. Tout est facultatif : une valeur inconnue revient à « éteint ».
 */
export function cleanPrefs(v) {
  const out = defaultPrefs();
  if (!estObjet(v)) return out;
  out.balanced = v.balanced === true;
  const q = Number(v.quick);
  out.quick = QUICK_CHOICES.includes(q) ? q : 0;
  out.cuisines = arr(v.cuisines).filter((c, i, a) => CUISINES.includes(c) && a.indexOf(c) === i);
  out.sides = v.sides === true;
  const t = v.treats === null || v.treats === undefined || v.treats === '' ? NaN : Number(v.treats);
  out.treats = TREAT_CHOICES.includes(t) ? t : null;
  return out;
}

/** Au moins une préférence qui change le score des menus (sides n'en change pas). */
export function prefsActive(prefs) {
  return !!(
    estObjet(prefs) &&
    (prefs.balanced === true ||
      prefs.quick > 0 ||
      arr(prefs.cuisines).length > 0 ||
      TREAT_CHOICES.includes(prefs.treats))
  );
}

const strs = (v) =>
  arr(v)
    .filter((x) => typeof x === 'string' && x)
    .filter((x, i, a) => a.indexOf(x) === i);

export function normalizeProfile(p) {
  const d = defaultProfile();
  if (!estObjet(p)) return d;
  const out = { ...d };
  out.adults = Math.min(12, Math.max(0, Math.round(num(p.adults, d.adults))));
  out.children = Math.min(12, Math.max(0, Math.round(num(p.children, d.children))));
  // Personnes détaillées (facultatif, needs.js) : adultes et enfants en découlent. Liste vide = absente.
  // Mode simple : les personnes sont gardées (profile.dormant) mais n'entrent dans aucun calcul ni ne changent
  // adultes et enfants ; repasser en 'perso' (ou sans mode) les retrouve. Voir isSimpleMode (needs.js).
  if (p.mode === 'simple' || p.mode === 'perso') out.mode = p.mode;
  const members = cleanMembers(arr(p.members).length ? p.members : p.dormant);
  if (members.length && p.mode === 'simple') {
    out.dormant = members;
  } else if (members.length) {
    out.members = members;
    out.children = members.filter(isChildMember).length;
    out.adults = members.length - out.children;
  }
  if (out.adults + out.children === 0) out.adults = 1;
  // Préférences des menus (facultatif) : gardées seulement si elles sont données.
  if (estObjet(p.prefs)) out.prefs = cleanPrefs(p.prefs);
  const b =
    p.budget === null || p.budget === undefined || p.budget === '' ? null : Number(p.budget);
  out.budget = b !== null && Number.isFinite(b) && b > 0 ? b : null;
  if (estObjet(p.slots)) {
    out.slots = {};
    for (let i = 0; i < 7; i++)
      for (const s of ['midi', 'soir']) out.slots[`${i}-${s}`] = !!p.slots[`${i}-${s}`];
  }
  out.diets = strs(p.diets);
  out.excludedIngredients = strs(p.excludedIngredients);
  const t = Number(p.maxTimeMin);
  out.maxTimeMin = Number.isFinite(t) && t > 0 ? t : null;
  out.pantry = strs(p.pantry);
  out.kidsCantine = !!p.kidsCantine;
  out.useLeftovers = p.useLeftovers === undefined ? true : !!p.useLeftovers;
  const m = Number(p.month);
  out.month =
    p.month !== null && p.month !== undefined && Number.isInteger(m) && m >= 0 && m <= 11
      ? m
      : null;
  return out;
}

// Nombre de convives pour un repas (enfants comptés 0,6 ; cantine = absents le midi en semaine).
// Avec profile.members : somme des facteurs de portion des personnes présentes (needs.js).
// Avec `meal` (facultatif) : meal.eaters (convives choisis, ids de profile.members) ou, sans personnes
// détaillées, meal.heads (nombre de personnes à ce repas) ; absents = tout le foyer, comme avant.
export function personsFor(profile, day, slot, meal) {
  const p = normalizeProfile(profile);
  if (meal && typeof meal === 'object') {
    if (p.members && cleanEaters(p, meal.eaters)) {
      const n = membersAt(p, day, slot, meal).reduce((t, m) => t + portionFactor(m), 0);
      if (n > 0) return Math.round(n * 100) / 100;
    } else if (!p.members && validHeads(meal.heads)) {
      return portionsForHeads(p, day, slot, meal.heads);
    }
  }
  if (p.members) {
    const n = membersAt(p, day, slot).reduce((t, m) => t + portionFactor(m), 0);
    return n > 0 ? Math.round(n * 100) / 100 : Math.max(1, p.adults);
  }
  const cantine = p.kidsCantine && slot === 'midi' && day >= 0 && day <= 4;
  const n = p.adults + (cantine ? 0 : p.children * CHILD_FACTOR);
  return n > 0 ? Math.round(n * 100) / 100 : Math.max(1, p.adults);
}

/**
 * Repas d'un plan pour le foyer ACTUEL : `persons` recalculé pour chaque repas daté (jour, créneau) selon le mode,
 * le foyer et les convives choisis du repas (meal.eaters et meal.heads sont gardés : ignorés en mode simple, repris
 * au retour en mode personnalisé). cookPersons est à recalculer ensuite (recomputeCooking). Liste neuve.
 */
export function mealsForProfile(meals, profile) {
  const p = normalizeProfile(profile);
  return arr(meals).map((m) =>
    estObjet(m) && estNombre(m.day) && typeof m.slot === 'string' && m.slot
      ? { ...m, persons: personsFor(p, m.day, m.slot, m) }
      : m
  );
}

/** Nombre de personnes d'un repas (meal.heads) : entier de 1 à 24, sinon null (= tout le foyer). */
export function validHeads(h) {
  const n = typeof h === 'number' || (typeof h === 'string' && h.trim() !== '') ? Number(h) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 24 ? n : null;
}

export function enabledSlots(profile) {
  const p = normalizeProfile(profile);
  const out = [];
  for (let d = 0; d < 7; d++)
    for (const s of ['midi', 'soir'])
      if (p.slots[`${d}-${s}`]) out.push({ day: d, slot: s, key: `${d}-${s}` });
  return out;
}

/**
 * Convives d'un repas en personnes entières : { heads, adults, children } (enfants à la cantine le midi en
 * semaine absents). Sans jour (day null), tout le foyer.
 */
export function headsFor(profile, day, slot, meal) {
  const p = normalizeProfile(profile);
  if (meal && typeof meal === 'object' && p.members) {
    const chosen = cleanEaters(p, meal.eaters);
    if (chosen) {
      const present = membersAt(p, day, slot, meal);
      const children = present.filter(isChildMember).length;
      return { heads: present.length, adults: present.length - children, children };
    }
  }
  const cantine = p.kidsCantine && slot === 'midi' && day >= 0 && day <= 4;
  const children = cantine ? 0 : p.children;
  return { heads: Math.max(1, p.adults + children), adults: p.adults, children };
}

/**
 * Portions pour `heads` personnes à ce repas : les enfants comptent 0,6 (comme personsFor). Quand on baisse
 * le nombre, les enfants partent en premier ; quand on l'augmente, les personnes ajoutées comptent comme des
 * adultes. Au nombre du foyer, le résultat vaut personsFor.
 */
export function portionsForHeads(profile, day, slot, heads) {
  const h = headsFor(profile, day, slot);
  const n = Math.max(1, Math.round(Number(heads) || h.heads));
  const p = normalizeProfile(profile);
  if (p.members) {
    // Avec des personnes détaillées : les enfants partent en premier, puis les derniers adultes ; les
    // personnes ajoutées comptent comme des adultes de référence (1).
    const present = membersAt(p, day, slot);
    const ordre = [
      ...present.filter((m) => !isChildMember(m)),
      ...present.filter(isChildMember).reverse(),
    ];
    const gardes = ordre.slice(0, n);
    const v = gardes.reduce((t, m) => t + portionFactor(m), 0) + Math.max(0, n - present.length);
    return Math.round(v * 100) / 100;
  }
  const kids = Math.min(h.children, Math.max(0, n - h.adults));
  const v = n - kids + kids * CHILD_FACTOR;
  return Math.round(v * 100) / 100;
}
