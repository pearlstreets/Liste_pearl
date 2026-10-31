// Texte d'une ligne de courses : "7 gousses" et "1 tête" au lieu de "7 · 1 x 10" pour les petites unités.
// Pur : `t` est la fonction de traduction de l'onglet (clés relatives à menus.*).
import { formatQty, formatQtyText } from './scaling';

// Nom de l'unité pour les ingrédients comptés à la pièce (clé d'ingrédient -> clé de traduction).
const NOUNS = { ail: 'shop.noun_clove', bouillon: 'shop.noun_cube' };

// Libellés de conditionnement (en français dans les données) -> clé de traduction.
function packKind(label) {
  const s = String(label || '').trim();
  let m;
  if (s === 'pièce') return { kind: 'piece' };
  if (s === 'tête') return { key: 'shop.pack_head' };
  if (s === 'rouleau') return { key: 'shop.pack_roll' };
  if (s === 'paquet (tranches)') return { key: 'shop.pack_slices' };
  if (s === 'boîte de cubes') return { key: 'shop.pack_cubes' };
  if ((m = /^boîte de (\d+)$/.exec(s))) return { key: 'shop.pack_box', size: Number(m[1]) };
  if ((m = /^lot de (\d+)$/.exec(s))) return { key: 'shop.pack_lot', size: Number(m[1]) };
  return null;
}

/**
 * -> { qtyText, packText }. packText vide : rien à ajouter après la quantité.
 * opts : { lang, labels } comme formatQtyText.
 */
export function lineTexts(line, t, opts = {}) {
  if (line.noQty) return { qtyText: '', packText: '' };
  if (line.free) return { qtyText: formatQtyText(line.qty, line.unit, opts), packText: '' };
  const base = {
    qtyText: formatQtyText(line.qty, line.unit, opts),
    packText: t('shop.packs', {
      count: line.packs,
      size: formatQtyText(line.packQty, line.packUnit, opts),
    }),
  };
  if (line.unit !== 'u') return base;

  const f = formatQty(line.qty, 'u', opts);
  const noun = NOUNS[line.key];
  const qtyText = noun
    ? t(noun, { count: Math.max(1, Math.ceil(Number(line.qty) || 0)), amount: f.amount })
    : f.amount;

  if (line.packUnit !== 'u') return { qtyText, packText: base.packText };
  const kind = packKind(line.packLabel);
  if (!kind) return { qtyText, packText: base.packText };
  if (kind.kind === 'piece') return { qtyText, packText: '' };
  return { qtyText, packText: t(kind.key, { count: line.packs, size: kind.size }) };
}
