// Enseignes où faire les courses du menu (drive, livraison, magasin) et leurs adaptateurs.
//
// Aujourd'hui aucune enseigne n'est partenaire : l'adaptateur « lien » ouvre le site de l'enseigne
// (recherche article par article) et la liste reste dans Ma Liste. Les prix affichés sont l'estimation
// Pearl (jamais un prix inventé de l'enseigne), toujours marqués « ~ ».
//
// Partenariat signé (API panier, comme Jow avec les enseignes) : registerPartner(id, adaptateur) avec
//   {
//     capabilities: { cart: true, prices: true, alternatives: true, slots: true },
//     async connect(ctx)                      -> { ok, storeId?, storeName? }   (magasin ou drive choisi)
//     async products(lines, ctx)              -> [{ key, product: { id, name, brand, price, image, packText },
//                                                  alternatives: [...] }]
//     async fillCart(items, ctx)              -> { ok, url?, total?, missing: [key] }
//   }
// L'écran n'affiche « Changer », le tri qualité/prix et « Remplir le panier » que si l'adaptateur le permet.
import { Linking, Platform } from 'react-native';

export const MODES = ['drive', 'livraison', 'magasin'];

// Recherche sur le site : une URL par article (le nom est encodé, rien d'autre ne part).
const q = (s) => encodeURIComponent(String(s || '').trim());

export const ENSEIGNES = [
  {
    id: 'leclerc',
    name: 'E.Leclerc',
    color: '#0066B3',
    modes: ['drive', 'livraison'],
    site: 'https://www.e.leclerc/',
    search: (s) => `https://www.e.leclerc/recherche?q=${q(s)}`,
  },
  {
    id: 'auchan',
    name: 'Auchan',
    color: '#E2001A',
    modes: ['drive', 'livraison'],
    site: 'https://www.auchan.fr/',
    search: (s) => `https://www.auchan.fr/recherche?text=${q(s)}`,
  },
  {
    id: 'carrefour',
    name: 'Carrefour',
    color: '#004E9F',
    modes: ['drive', 'livraison'],
    site: 'https://www.carrefour.fr/',
    search: (s) => `https://www.carrefour.fr/s?q=${q(s)}`,
  },
  {
    id: 'intermarche',
    name: 'Intermarché',
    color: '#E30613',
    modes: ['drive', 'livraison'],
    site: 'https://www.intermarche.com/',
    search: (s) => `https://www.intermarche.com/recherche/${q(s)}`,
  },
  {
    id: 'monoprix',
    name: 'Monoprix',
    color: '#111111',
    modes: ['livraison'],
    site: 'https://courses.monoprix.fr/',
    search: (s) => `https://courses.monoprix.fr/search?q=${q(s)}`,
  },
  {
    // pas de courses en ligne : liste dans Ma Liste et itinéraire vers le magasin le plus proche
    id: 'lidl',
    name: 'Lidl',
    color: '#0050AA',
    modes: ['magasin'],
    site: 'https://www.lidl.fr/',
    search: null,
  },
];

export function enseigneById(id) {
  return ENSEIGNES.find((e) => e.id === id) || null;
}

/** Enseignes qui proposent ce mode (drive, livraison, magasin). */
export function enseignesFor(mode) {
  return ENSEIGNES.filter((e) => e.modes.includes(mode));
}

/* ------------------------------ adaptateurs ------------------------------ */

const NONE = { cart: false, prices: false, alternatives: false, slots: false };
const partners = new Map();

/** Branche l'API d'une enseigne partenaire (voir l'en-tête du fichier). */
export function registerPartner(id, adapter) {
  if (!enseigneById(id) || !adapter || typeof adapter !== 'object') return false;
  partners.set(id, { ...adapter, capabilities: { ...NONE, ...(adapter.capabilities || {}) } });
  return true;
}

export function unregisterPartner(id) {
  partners.delete(id);
}

/** Adaptateur d'une enseigne : partenaire s'il y en a un, sinon liens vers le site. */
export function adapterFor(id) {
  const p = partners.get(id);
  if (p) return { id, partner: true, ...p };
  const e = enseigneById(id);
  return {
    id,
    partner: false,
    capabilities: NONE,
    // URL de recherche d'un article sur le site (null : pas de site de courses)
    searchUrl: (name) => (e && e.search ? e.search(name) : null),
    siteUrl: e ? e.site : null,
  };
}

export function isPartner(id) {
  return partners.has(id);
}

/* ------------------------------ panier estimé ------------------------------ */

/**
 * Panier estimé pour une enseigne : lignes de courses (shopping.js) et total estimé Pearl.
 * { items: [{ key, line, searchUrl }], total, approx } ; `approx` vrai dès qu'un prix est estimé.
 */
export function estimateCart(lines, id, nameOf) {
  const ad = adapterFor(id);
  const items = [];
  let total = 0;
  let approx = false;
  for (const l of Array.isArray(lines) ? lines : []) {
    if (!l || !l.key) continue;
    const name = typeof nameOf === 'function' ? nameOf(l.key) : l.key;
    items.push({ key: l.key, line: l, name, searchUrl: ad.searchUrl ? ad.searchUrl(name) : null });
    const eur = Number(l.estimatedEur) || 0;
    total += eur;
    if (!l.priceKnown || l.free) approx = true;
  }
  return { items, total: Math.round(total * 100) / 100, approx: approx || !ad.partner };
}

/* -------------------------------- ouvertures -------------------------------- */

export async function openUrl(url) {
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Itinéraire vers le magasin le plus proche de l'enseigne (Plans sur iOS, Maps ailleurs). */
export function storeMapUrl(id) {
  const e = enseigneById(id);
  const name = e ? e.name : '';
  return Platform.OS === 'ios'
    ? `http://maps.apple.com/?q=${q(name)}`
    : `https://www.google.com/maps/search/?api=1&query=${q(name)}`;
}
