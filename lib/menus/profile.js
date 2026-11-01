// Profil du foyer : valeurs par défaut et assainissement (jamais d'exception).
import { estObjet, arr, num } from './util';

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
  if (out.adults + out.children === 0) out.adults = 1;
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
export function personsFor(profile, day, slot) {
  const p = normalizeProfile(profile);
  const cantine = p.kidsCantine && slot === 'midi' && day >= 0 && day <= 4;
  const n = p.adults + (cantine ? 0 : p.children * CHILD_FACTOR);
  return n > 0 ? Math.round(n * 100) / 100 : Math.max(1, p.adults);
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
export function headsFor(profile, day, slot) {
  const p = normalizeProfile(profile);
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
  const kids = Math.min(h.children, Math.max(0, n - h.adults));
  const v = n - kids + kids * CHILD_FACTOR;
  return Math.round(v * 100) / 100;
}
