// Panier local (KEY_CART) : fusion des ajouts, signature du contenu, état des
// commandes Marketplace en attente de paiement. Fonctions pures.
import { cleVariante, plafonner } from './variantes';

const txt = (v) => String(v || '').toLowerCase().trim();

// Même article : productId + option quand les deux ont un vrai id (comme
// addToCart de l'onglet Boutiques), sinon nom + boutique.
export function memeArticle(a, b) {
  if (!a || !b) return false;
  if (a.productId != null && b.productId != null) {
    return String(a.productId) === String(b.productId) && cleVariante(a.variant) === cleVariante(b.variant);
  }
  return txt(a.name) === txt(b.name) && txt(a.shop) === txt(b.shop);
}

// Sépare les ajouts déjà présents dans le panier (doublons) des nouveaux.
// `merged` = panier existant + nouveaux articles.
export function separerDoublons(existing, nouveaux) {
  const base = Array.isArray(existing) ? existing.filter(Boolean) : [];
  const merged = [...base];
  const duplicates = [];
  const newOnly = [];
  (Array.isArray(nouveaux) ? nouveaux : []).forEach((newItem) => {
    const existingIndex = base.findIndex((e) => memeArticle(e, newItem));
    if (existingIndex >= 0) duplicates.push({ newItem, existingIndex });
    else newOnly.push(newItem);
  });
  newOnly.forEach((it) => merged.push(it));
  return { merged, duplicates, newOnly };
}

// Quantité ajoutée à un article du panier, plafonnée au stock connu.
export function cumulerQuantite(item, qty) {
  const cap = item && item.maxQty != null ? item.maxQty : null;
  return { ...item, qty: plafonner(Number((item && item.qty) || 1) + Number(qty || 1), cap) };
}

// Ajoute des articles au panier : un article déjà présent voit sa quantité
// augmenter (plafonnée), les autres sont ajoutés à la fin.
export function ajouterAuPanier(existing, nouveaux) {
  const out = Array.isArray(existing) ? existing.filter(Boolean).map((it) => ({ ...it })) : [];
  (Array.isArray(nouveaux) ? nouveaux : []).forEach((n) => {
    if (!n) return;
    const i = out.findIndex((e) => memeArticle(e, n));
    if (i >= 0) out[i] = cumulerQuantite(out[i], n.qty || 1);
    else out.push({ ...n, qty: plafonner(n.qty || 1, n.maxQty != null ? n.maxQty : null) });
  });
  return out;
}

// Champs d'un article du panier qui servent à la commande réelle.
export function champsCommande(src) {
  if (!src) return {};
  const out = {};
  if (src.productId != null) out.productId = src.productId;
  if (src.companyId != null) out.companyId = src.companyId;
  if (src.shopId != null) out.shopId = src.shopId;
  if (src.category) out.category = src.category;
  if (src.variant) out.variant = src.variant;
  if (src.maxQty != null) out.maxQty = src.maxQty;
  return out;
}

// Article sans vraie fiche boutique : il ne peut pas être payé.
export const articleSansFiche = (it) => !it || it.productId == null || it.companyId == null;

// Signature du contenu commandé (articles sélectionnés + mode) : sert à savoir
// si des commandes en attente correspondent encore au panier.
export function signaturePanier(items, mode) {
  const lignes = (Array.isArray(items) ? items : []).map((it) => [
    it && it.productId != null ? String(it.productId) : txt(it && it.name),
    it && it.companyId != null ? String(it.companyId) : txt(it && it.shop),
    cleVariante(it && it.variant),
    Number((it && it.qty) || 1),
  ].join('|'));
  lignes.sort();
  return String(mode || '') + '#' + lignes.join(';');
}

// État des commandes en attente d'après les statuts serveur
// (getMarketplaceOrderStatuses) :
//  'payee'      : toutes connues, aucune en attente de paiement ni annulée ;
//  'abandonnee' : au moins une annulée ou remboursée, aucune payée ;
//  'inconnue'   : sinon (hors ligne, en attente de paiement…).
export function etatCommandesEnAttente(orders, statuts) {
  const ids = (Array.isArray(orders) ? orders : []).map((o) => o && o.orderId).filter((id) => id != null);
  if (!ids.length || !statuts || typeof statuts !== 'object') return 'inconnue';
  const infos = ids.map((id) => statuts[String(id)]);
  const st = (i) => String((i && i.status) || '').toLowerCase();
  const morte = (i) => !!i && (i.is_refunded || ['cancelled', 'canceled', 'refunded'].includes(st(i)));
  const attente = (i) => !i || st(i) === 'awaiting_payment' || st(i) === '';
  if (infos.some(morte)) return infos.some((i) => i && !morte(i) && !attente(i)) ? 'inconnue' : 'abandonnee';
  if (infos.every((i) => !attente(i))) return 'payee';
  return 'inconnue';
}
