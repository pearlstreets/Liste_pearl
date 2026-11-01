// Mise à l'échelle lisible des quantités : fractions, g -> kg, ml -> l.
import { estNombre, estObjet, arr } from './util';

const FRACTIONS = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [1, ''],
];

export function scaleQty(qty, fromServings, toPersons) {
  const q = Number(qty);
  const f = Number(fromServings) > 0 ? Number(fromServings) : 4;
  const t = Number(toPersons) > 0 ? Number(toPersons) : f;
  return estNombre(q) ? (q * t) / f : 0;
}

// Fraction lisible la plus proche (tolérance 0,06) ou null.
function fractionText(x) {
  const whole = Math.floor(x + 1e-9);
  const frac = x - whole;
  let best = null;
  for (const [v, s] of FRACTIONS) {
    if (Math.abs(frac - v) <= 0.06 && (!best || Math.abs(frac - v) < Math.abs(frac - best[0])))
      best = [v, s];
  }
  if (!best) return null;
  if (best[0] === 1) return String(whole + 1);
  if (best[0] === 0) return String(whole);
  return whole > 0 ? `${whole} ${best[1]}` : best[1];
}

function decimal(x, lang, digits) {
  const s = (Math.round(x * 10 ** digits) / 10 ** digits).toString();
  return ['en', 'ja', 'zh', 'th'].includes(String(lang || 'fr').slice(0, 2))
    ? s
    : s.replace('.', ',');
}

// Arrondit une masse ou un volume à un pas agréable.
function roundMetric(x) {
  if (x < 20) return Math.round(x);
  if (x < 100) return Math.round(x / 5) * 5;
  if (x < 500) return Math.round(x / 10) * 10;
  return Math.round(x / 25) * 25;
}

/**
 * formatQty(qty, unit, { lang }) -> { amount:'1,5', unit:'kg', value:1.5 }
 * g >= 1000 -> kg ; ml >= 1000 -> l ; pièces et cuillères en fractions (½, ¼...).
 * Le libellé de l'unité reste à traduire côté écran (clé = unit).
 */
export function formatQty(qty, unit, opts = {}) {
  const lang = opts && opts.lang;
  const q = Number(qty);
  if (!estNombre(q) || q <= 0) return { amount: '0', unit: unit || 'u', value: 0 };
  if (unit === 'g' || unit === 'ml') {
    // Jamais « 0 g » : une quantité positive s'affiche au moins 1 g ou 1 ml.
    const v = Math.max(1, roundMetric(q));
    if (v >= 1000) {
      const big = Math.round((v / 1000) * 10) / 10;
      return { amount: decimal(big, lang, 1), unit: unit === 'g' ? 'kg' : 'l', value: big };
    }
    return { amount: String(v), unit, value: v };
  }
  if (unit === 'kg' || unit === 'l')
    return { amount: decimal(Math.round(q * 100) / 100, lang, 2), unit, value: q };
  // u, cs, cc : fractions
  // Plus petite fraction lisible : jamais « 0 » pour une quantité positive.
  if (q < 1 / 8) return { amount: '⅛', unit: unit || 'u', value: 1 / 8 };
  const f = fractionText(q);
  if (f !== null && q < 20) return { amount: f, unit: unit || 'u', value: q };
  const v = q < 10 ? Math.round(q * 10) / 10 : Math.round(q);
  return { amount: decimal(v, lang, 1), unit: unit || 'u', value: v };
}

/** Texte brut "1,5 kg" ; labels optionnels { kg:'kg', u:'' ...} pour traduire l'unité. */
export function formatQtyText(qty, unit, opts = {}) {
  const f = formatQty(qty, unit, opts);
  const labels = (opts && opts.labels) || {};
  const u = labels[f.unit] !== undefined ? labels[f.unit] : f.unit === 'u' ? '' : f.unit;
  return u ? `${f.amount} ${u}` : f.amount;
}

// Ingrédients comptés à la pièce qu'on ne coupe pas utilement (½ œuf, ½ rouleau de pâte, ½ cube) : arrondis à
// l'entier le plus proche (4,5 œufs donnent 5 ; 1,5 rouleau en donne 2), jamais moins de 1. Les fruits et légumes à la pièce
// (citron, avocat, concombre...) gardent leurs fractions (½ citron a un sens).
const ENTIERS = new Set([
  'oeuf',
  'ail',
  'yaourt',
  'yaourt-grec',
  'bouillon',
  'laurier',
  'tortilla',
  'pain-burger',
  'pain-pita',
  'pain-mie',
  'pain-campagne',
  'feuille-brick',
  'galette-riz',
  'pate-brisee',
  'pate-feuilletee',
  'pate-sablee',
  'pate-pizza',
  'gelatine',
  'glacons',
  'gousse-vanille',
  'citronnelle',
  'piment-frais',
  'burrata',
  'fruit-passion',
]);

/** Quantité affichée d'une ligne : entière pour les pièces qui ne se coupent pas, sinon inchangée. */
export function roundCount(key, unit, qty) {
  const q = Number(qty);
  if (unit === 'u' && ENTIERS.has(key) && estNombre(q) && q > 0) return Math.max(1, Math.round(q));
  return q;
}

// Seuils sous lesquels une quantité ne se mesure plus (moins d'1 g, moins d'1/8 de cuillère).
function negligeable(qty, unit) {
  if (unit === 'g' || unit === 'ml') return qty < 0.5;
  if (unit === 'cs' || unit === 'cc') return qty < 1 / 8 - 1e-9;
  return false;
}

// Basiques du placard qui font lever, prendre ou epaissir : jamais « selon votre goût », toujours une quantité
// (1 g, ⅛ de cuillère au moins), sinon la recette rate.
const MESURE_REQUISE = new Set(['levure', 'levure-boulangere', 'agar', 'maizena', 'bouillon', 'glacons']);

let fichesCache = null;
function fichesParDefaut() {
  if (fichesCache) return fichesCache;
  try {
    const raw = require('../../data/menus/ingredients.json');
    fichesCache = estObjet(raw) ? raw : {};
  } catch {
    fichesCache = {};
  }
  return fichesCache;
}

/**
 * Ingrédients d'une recette mis à l'échelle de `persons` :
 * [{ key, qty, unit, optional, amount, displayUnit, toTaste, plural }]
 * Pièces qui ne se coupent pas arrondies à l'entier (roundCount). Basique du placard (sel, poivre, épices) dont la
 * quantité ne se mesure plus : toTaste = true et amount vide (l'écran affiche « selon votre goût »), jamais « 0 g ».
 * plural = vrai quand la quantité affichée dépasse 1 pièce (nom au pluriel côté écran).
 * opts : { lang, ingredients } (ingredients : fiches, celles des données par défaut sinon).
 */
export function scaleIngredients(recipe, persons, opts = {}) {
  if (!estObjet(recipe)) return [];
  const fiches = estObjet(opts && opts.ingredients) ? opts.ingredients : null;
  return arr(recipe.ingredients)
    .filter((i) => estObjet(i) && i.key)
    .map((i) => {
      const qty = roundCount(i.key, i.unit, scaleQty(i.qty, recipe.servings, persons));
      if (!(qty > 0))
        return {
          key: i.key,
          qty: 0,
          unit: i.unit,
          optional: !!i.optional,
          amount: '',
          displayUnit: '',
          toTaste: false,
          plural: false,
        };
      if (negligeable(qty, i.unit)) {
        const ing = (fiches || fichesParDefaut())[i.key];
        if (ing && ing.pantry && !MESURE_REQUISE.has(i.key))
          return {
            key: i.key,
            qty,
            unit: i.unit,
            optional: !!i.optional,
            amount: '',
            displayUnit: '',
            toTaste: true,
            plural: false,
          };
      }
      const f = formatQty(qty, i.unit, opts);
      return {
        key: i.key,
        qty,
        unit: i.unit,
        optional: !!i.optional,
        amount: f.amount,
        displayUnit: f.unit,
        toTaste: false,
        plural: (i.unit || 'u') === 'u' && f.value > 1,
      };
    });
}
