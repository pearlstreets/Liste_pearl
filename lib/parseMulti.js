// Parses a free-form shopping-list string into [{ name, qty, unit }] items.
// Accepts separators: newline, comma, semicolon. Quantity forms accepted:
//   "3 pommes"  ·  "3 kg pommes"  ·  "pommes x 3"  ·  "pommes 250 g"
//   "pommes 3"  ·  "pommes"       (qty defaults to 1, unit defaults to 'u')

import { autocorrectName } from '../utils/spellcheck';

// Canonical unit set used across the app. Keep in sync with App.js UNITS.
const UNIT_ALIASES = {
  u: 'u', un: 'u', pc: 'u', pcs: 'u', piece: 'u', pieces: 'u',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  mg: 'mg',
  l: 'L', lt: 'L', ltr: 'L', litre: 'L', litres: 'L', liter: 'L', liters: 'L',
  ml: 'mL', mls: 'mL',
  cl: 'cL',
};
const UNIT_RX_SRC = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length).join('|');
const QTY = '\\d+(?:[.,]\\d+)?';

function normalizeQty(raw) {
  const n = parseFloat(String(raw).replace(',', '.'));
  if (!isFinite(n) || n <= 0) return 1;
  return Number.isInteger(n) ? n : Math.round(n * 100) / 100;
}
function normalizeUnit(raw) {
  if (!raw) return 'u';
  return UNIT_ALIASES[raw.toLowerCase()] || 'u';
}

export function parseMulti(input) {
  const str = (input || '').trim();
  if (!str) return [];
  const parts = str.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const out = [];

  // Pre-compiled patterns (highest specificity first)
  const RX_QTY_UNIT_NAME = new RegExp(`^(${QTY})\\s*(${UNIT_RX_SRC})\\s+(.+)$`, 'i');
  const RX_NAME_QTY_UNIT = new RegExp(`^(.+?)\\s+(${QTY})\\s*(${UNIT_RX_SRC})$`, 'i');
  const RX_QTY_NAME = new RegExp(`^(\\d+)\\s+(.+)$`);
  const RX_NAME_X_QTY = new RegExp(`^(.+?)\\s*[xX]\\s*(\\d+)$`);
  const RX_NAME_QTY = new RegExp(`^(.+?)\\s*(\\d+)\\s*[xX]?$`);

  for (const part of parts) {
    let m, name = null, qty = 1, unit = 'u';
    if ((m = part.match(RX_QTY_UNIT_NAME))) {
      qty = normalizeQty(m[1]); unit = normalizeUnit(m[2]); name = m[3].trim();
    } else if ((m = part.match(RX_NAME_QTY_UNIT))) {
      name = m[1].trim(); qty = normalizeQty(m[2]); unit = normalizeUnit(m[3]);
    } else if ((m = part.match(RX_QTY_NAME))) {
      qty = normalizeQty(m[1]); name = m[2].trim();
    } else if ((m = part.match(RX_NAME_X_QTY))) {
      name = m[1].trim(); qty = normalizeQty(m[2]);
    } else if ((m = part.match(RX_NAME_QTY))) {
      const n = m[1].trim();
      if (n) { name = n; qty = normalizeQty(m[2]); }
    } else {
      name = part;
    }
    if (!name) continue;
    name = autocorrectName(name);
    out.push({ name, qty, unit });
  }
  return out;
}
