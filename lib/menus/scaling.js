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
    const v = roundMetric(q);
    if (v >= 1000) {
      const big = Math.round((v / 1000) * 10) / 10;
      return { amount: decimal(big, lang, 1), unit: unit === 'g' ? 'kg' : 'l', value: big };
    }
    return { amount: String(v), unit, value: v };
  }
  if (unit === 'kg' || unit === 'l')
    return { amount: decimal(Math.round(q * 100) / 100, lang, 2), unit, value: q };
  // u, cs, cc : fractions
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

/** Ingrédients d'une recette mis à l'échelle de `persons` : [{ key, qty, unit, optional, amount, displayUnit }]. */
export function scaleIngredients(recipe, persons, opts = {}) {
  if (!estObjet(recipe)) return [];
  return arr(recipe.ingredients)
    .filter((i) => estObjet(i) && i.key)
    .map((i) => {
      const qty = scaleQty(i.qty, recipe.servings, persons);
      const f = formatQty(qty, i.unit, opts);
      return {
        key: i.key,
        qty,
        unit: i.unit,
        optional: !!i.optional,
        amount: f.amount,
        displayUnit: f.unit,
      };
    });
}
