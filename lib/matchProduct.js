// Règle de correspondance entre un article de liste et un produit d'une vraie boutique
// Pearl Streets. Extraite telle quelle de buildInventory (App.js) : même règle pour
// l'écran Produits et pour Menus.

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const cache = new WeakMap(); // produit -> { pn, ptok }
function prep(p) {
  if (!p || typeof p !== 'object') return { pn: '', ptok: [] };
  const name = p.name;
  const hit = cache.get(p);
  if (hit && hit.name === name) return hit;
  const pn = norm(name);
  const v = { name, pn, ptok: pn.split(/\s+/).filter(Boolean) };
  cache.set(p, v);
  return v;
}

/** Vrai si le produit (nom) correspond à l'article (nom). */
export function nameMatches(itemName, productName) {
  const inm = norm(itemName);
  const pn = norm(productName);
  if (!pn || !inm) return false;
  if (pn === inm) return true; // égalité exacte
  const ptok = pn.split(/\s+/).filter(Boolean);
  return tokensMatch(inm, ptok);
}

function tokensMatch(inm, ptok) {
  const itok = inm.split(/\s+/).filter(Boolean);
  // article multi-mots : tous ses mots présents dans le produit
  if (itok.length >= 2 && itok.every((w) => ptok.includes(w))) return true;
  // mot unique : uniquement si assez long (>=6) ET mot ENTIER du produit
  // (évite « eau »→« eau de parfum », « pain »→« pain au chocolat »)
  if (itok.length === 1 && inm.length >= 6 && ptok.includes(inm)) return true;
  return false;
}

function matchesPrepared(inm, pr) {
  if (!pr.pn || !inm) return false;
  if (pr.pn === inm) return true;
  return tokensMatch(inm, pr.ptok);
}

const asNames = (n) => (Array.isArray(n) ? n : [n]);

/** Premier produit de la liste qui correspond (n = un nom, ou plusieurs noms équivalents, essayés dans l'ordre). */
export function matchProduct(itemNames, products) {
  const list = Array.isArray(products) ? products : [];
  for (const n of asNames(itemNames)) {
    const inm = norm(n);
    if (!inm) continue;
    const found = list.find((p) => matchesPrepared(inm, prep(p)));
    if (found) return found;
  }
  return undefined;
}

/** Tous les produits qui correspondent à l'un des noms. */
export function matchProducts(itemNames, products) {
  const list = Array.isArray(products) ? products : [];
  const names = asNames(itemNames)
    .map(norm)
    .filter(Boolean);
  if (!names.length) return [];
  return list.filter((p) => {
    const pr = prep(p);
    return names.some((inm) => matchesPrepared(inm, pr));
  });
}
