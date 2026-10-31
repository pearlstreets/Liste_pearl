// Utilitaires purs partagés par la logique des menus (aucun React, aucun stockage).

export const DAYS = [0, 1, 2, 3, 4, 5, 6];
export const SLOT_NAMES = ['midi', 'soir'];
export const SEASONS = ['hiver', 'printemps', 'ete', 'automne'];

export const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const estNombre = (v) => typeof v === 'number' && Number.isFinite(v);
export const num = (v, def = 0) =>
  estNombre(Number(v)) && v !== null && v !== '' && v !== undefined ? Number(v) : def;
export const arr = (v) => (Array.isArray(v) ? v : []);
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Texte sans accents, minuscules, espaces réduits : pour la recherche.
export function norm(s) {
  if (s === null || s === undefined) return '';
  let t = String(s).toLowerCase();
  try {
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    /* ancien moteur */
  }
  return t
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9Ѐ-ӿ぀-ヿ㐀-鿿؀-ۿ฀-๿]+/g, ' ')
    .trim();
}

// Graine -> entier 32 bits (chaîne, nombre ou rien).
export function hashSeed(seed) {
  const s = String(seed === undefined || seed === null ? 'pearl' : seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Générateur déterministe (mulberry32) : même graine, mêmes tirages.
export function createRng(seed) {
  let a = hashSeed(seed);
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Empreinte courte d'une chaîne (djb2), en base 36.
export function hashString(str) {
  let h = 5381;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const mealKey = (day, slot) => `${day}-${slot}`;
export function parseMealKey(key) {
  const m = /^([0-6])-(midi|soir)$/.exec(String(key));
  return m ? { day: Number(m[1]), slot: m[2] } : null;
}

// Recettes en tableau OU en objet -> Map id -> recette (entrées invalides ignorées).
export function indexRecipes(recipes) {
  if (recipes instanceof Map) return recipes;
  const map = new Map();
  const list = Array.isArray(recipes) ? recipes : estObjet(recipes) ? Object.values(recipes) : [];
  for (const r of list) {
    if (estObjet(r) && typeof r.id === 'string' && r.id) map.set(r.id, r);
  }
  return map;
}

// Unités -> base. Familles : 'm' masse (g), 'v' volume (ml), 'u' pièces.
export function toBase(qty, unit) {
  const q = Number(qty);
  if (!estNombre(q) || q < 0) return { amt: 0, fam: 'u' };
  switch (unit) {
    case 'g':
      return { amt: q, fam: 'm' };
    case 'kg':
      return { amt: q * 1000, fam: 'm' };
    case 'ml':
      return { amt: q, fam: 'v' };
    case 'cl':
      return { amt: q * 10, fam: 'v' };
    case 'dl':
      return { amt: q * 100, fam: 'v' };
    case 'l':
    case 'L':
      return { amt: q * 1000, fam: 'v' };
    case 'cs':
      return { amt: q * 15, fam: 'v' };
    case 'cc':
      return { amt: q * 5, fam: 'v' };
    default:
      return { amt: q, fam: 'u' };
  }
}
export const FAM_UNIT = { m: 'g', v: 'ml', u: 'u' };

// Convertit une quantité d'une famille vers une autre (g et ml : densité 1 ;
// pièces : via ing.unitWeight en g si connu). null = non convertible.
export function convertFam(amt, from, to, ing) {
  if (from === to) return amt;
  if ((from === 'm' && to === 'v') || (from === 'v' && to === 'm')) return amt;
  const w = ing && estNombre(ing.unitWeight) && ing.unitWeight > 0 ? ing.unitWeight : 0;
  if (!w) return null;
  if (from === 'u') return amt * w;
  if (to === 'u') return amt / w;
  return null;
}

export const AISLE_ORDER = [
  'fruits-legumes',
  'boulangerie',
  'viandes-poissons',
  'cremerie',
  'epicerie',
  'surgeles',
  'boissons',
];

// Saison d'un mois (0 = janvier).
export function seasonOf(month) {
  const m = Number(month);
  if (!Number.isInteger(m) || m < 0 || m > 11) return null;
  if (m === 11 || m <= 1) return 'hiver';
  if (m <= 4) return 'printemps';
  if (m <= 7) return 'ete';
  return 'automne';
}
