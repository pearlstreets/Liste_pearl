// Parses a free-form shopping-list string into [{ name, qty }] items.
// Accepts separators: newline, comma, semicolon. Accepts quantity forms:
//   "3 pommes"  ·  "pommes x 3"  ·  "pommes 3"  ·  "pommes"  (qty defaults to 1)

import { autocorrectName } from '../utils/spellcheck';

export function parseMulti(input) {
  const str = (input || '').trim();
  if (!str) return [];
  const parts = str
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const part of parts) {
    let m;
    let name = null;
    let qty = 1;
    if ((m = part.match(/^(\d+)\s+(.+)$/))) {
      name = m[2].trim();
      qty = Math.max(1, parseInt(m[1], 10));
    } else if ((m = part.match(/^(.+?)\s*[xX]\s*(\d+)$/))) {
      name = m[1].trim();
      qty = Math.max(1, parseInt(m[2], 10));
    } else if ((m = part.match(/^(.+?)\s*(\d+)\s*[xX]?$/))) {
      const n = m[1].trim();
      const q = parseInt(m[2], 10);
      if (n) {
        name = n;
        qty = Math.max(1, q);
      }
    } else {
      name = part;
      qty = 1;
    }
    name = autocorrectName(name);
    out.push({ name, qty });
  }
  return out;
}
