// Menus x Pearl Streets : quels ingrédients existent chez de VRAIES boutiques, à quel prix réel.
// Aucun prix inventé : sans correspondance, rien n'est dit. Règle de correspondance partagée avec
// l'écran Produits (lib/matchProduct.js). Le nom utilisé est TOUJOURS le nom français.
import { matchProducts, norm } from '../matchProduct';
import { sansPlatsSurPlaceSeul } from '../surPlaceSeul';
import { getIngredients } from './recipes';
import { packPrice } from './pricing';

// Équivalents simples (nom français), par clé d'ingrédient. Le nom français lui-même passe en premier.
const SYNONYMS = {
  'poulet-filet': ['blanc de poulet', 'escalope de poulet'],
  'cuisse-poulet': ['cuisses de poulet', 'poulet cuisse'],
  'pomme-de-terre': ['pommes de terre'],
  'patate-douce': ['patates douces'],
  oeuf: ['oeufs'],
  'boeuf-hache': ['viande hachee', 'steak hache'],
  'dinde-escalope': ['escalope de dinde', 'blanc de dinde'],
  'thon-conserve': ['thon'],
  sardine: ['sardines'],
  saucisse: ['saucisses'],
  yaourt: ['yaourts', 'yaourt nature', 'yogourt'],
  'fromage-rape': ['emmental rape', 'gruyere rape'],
  creme: ['creme liquide', 'creme fleurette'],
  'creme-fraiche': ['creme fraiche', 'creme epaisse'],
  'pates-lasagne': ['lasagnes', 'feuilles de lasagnes'],
  pates: ['spaghetti', 'penne', 'tagliatelles', 'coquillettes'],
  lentilles: ['lentilles vertes', 'lentilles corail'],
  'tomate-concassee': ['tomates concassees', 'tomates pelees'],
  'concentre-tomate': ['double concentre de tomate'],
  'lait-coco': ['lait de coco', 'lait de noix de coco'],
  'huile-olive': ['huile d olive'],
  'sauce-soja': ['sauce soja salee', 'soja sauce'],
  'chocolat-noir': ['chocolat noir patissier', 'chocolat noir dessert'],
  cacahuete: ['cacahuetes', 'arachides'],
  'flocons-avoine': ['flocons d avoine'],
  'jus-orange': ['jus d orange'],
  crevette: ['crevettes'],
  champignon: ['champignons de paris', 'champignons'],
  'petits-pois': ['petits pois'],
  citron: ['citrons'],
  tomate: ['tomates'],
  carotte: ['carottes'],
  courgette: ['courgettes'],
  oignon: ['oignons'],
  banane: ['bananes'],
  orange: ['oranges'],
  poivron: ['poivrons'],
  concombre: ['concombres'],
  avocat: ['avocats'],
};

const QUALIFIERS = /\b(frais|fraiche|fraiches|surgele|surgeles|surgelee|surgelees|cuite|cuit|en conserve|decortiquees|en poudre|chimique|gousse|cube|tranche|ferme)\b/g;

/** Nom français sans parenthèses ni ligature : "Ail (gousse)" -> "ail". */
export function cleanName(fr) {
  return norm(String(fr || '').replace(/\([^)]*\)/g, ' '))
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/'/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Noms français équivalents à essayer, du plus précis au plus large. */
export function ingredientQueries(key, frName) {
  const base = cleanName(frName || String(key || '').replace(/-/g, ' '));
  const out = [];
  const add = (x) => {
    const v = String(x || '').trim();
    if (v && !out.includes(v)) out.push(v);
  };
  add(base);
  const stripped = base.replace(QUALIFIERS, ' ').replace(/\s+/g, ' ').trim();
  add(stripped);
  (SYNONYMS[key] || []).forEach(add);
  const words = stripped.split(' ');
  if (words.length === 1 && stripped && !/[sx]$/.test(stripped)) add(stripped + 's');
  return out;
}

// Sous-catégories de boutique qui ne vendent pas à manger : un « poireau » brodé ou un collier n'est pas un légume.
// Noms et slugs servis par Pearl Streets (artisan, clothing, art_galleries, bookstores, perfumery,
// fitness_equipment, jewellery, cosmetics, decoration) et leurs équivalents français.
const NON_ALIMENTAIRE =
  /(bijou|jewel|cosmet|beaute|parfum|perfum|savon|bougie|vetement|cloth|textile|chaussure|shoe|maroquin|decor|jouet|toy|livre|book|librair|papeterie|accessoire|hygiene|ceramique|poterie|fleur|flower|artisan|galler|galerie|fitness|sport|fashion)/;
// Sous-catégories qui vendent à manger. Sous-catégorie connue mais absente des deux listes :
// dans le doute, la correspondance est ignorée (jamais un « prix réel » douteux).
const ALIMENTAIRE =
  /(grocery|epicerie|local_product|local product|aliment|food|drink|restaurant|traiteur|boulang|bakery|patiss|boucher|butcher|charcut|poisson|fish|primeur|fruit|legume|fromag|cheese|cremerie|caviste|\bcave\b|\bvins?\b|wine|\bcafe\b|coffee|\bthe\b|\btea\b|chocolat|confiser|\bbio\b|organic|marche|market)/;
// Prix plausible d'un produit pour un ingrédient : comparé au prix estimé d'un paquet de l'ingrédient (pricing.js),
// avec de la marge (bio, conditionnement, producteur : 4 fois la référence ou référence + 6 €), sinon plafond absolu. Hors bornes : correspondance
// ignorée (nom identique mais autre chose, prix au lot ou erreur de saisie), jamais affichée.
const PLAFOND_SANS_REFERENCE = 60;
export function plausibleOffer(product, ing, price) {
  if (!(price > 0)) return false;
  const sous = norm(`${(product && product.subcategory) || ''} ${(product && product.subcategorySlug) || ''}`);
  if (sous.trim() && (NON_ALIMENTAIRE.test(sous) || !ALIMENTAIRE.test(sous))) return false;
  const ref = ing ? packPrice(ing) : null;
  if (ref && ref.priceKnown && ref.eur > 0) {
    return price <= Math.max(ref.eur * 4, ref.eur + 6) && price >= ref.eur / 10;
  }
  return price <= PLAFOND_SANS_REFERENCE;
}

const num = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
};
const round2 = (x) => Math.round(x * 100) / 100;

/**
 * matchLines(lines, shops, frNameOf) ->
 * { byKey: { [key]: { count, min, offers:[{shop, product, price}] } }, covered: [key],
 *   totalReal, best: [{ shop, count, total }] }
 * Prix = prix réel d'UN produit de la boutique ; total = nombre de paquets de la ligne x prix.
 * Plats au seul sur place, prix nuls, produits non alimentaires et prix hors bornes (plausibleOffer) exclus.
 * Boutique sans produit correspondant : absente.
 */
export function matchLines(lines, shops, frNameOf) {
  const out = { byKey: {}, covered: [], totalReal: 0, best: [] };
  const L = Array.isArray(lines) ? lines.filter((l) => l && l.key) : [];
  const S = sansPlatsSurPlaceSeul(Array.isArray(shops) ? shops : []).filter(
    (s) => s && Array.isArray(s.products) && s.products.length > 0
  );
  if (!L.length || !S.length) return out;
  const perShop = new Map();
  let fiches = {};
  try {
    fiches = getIngredients() || {};
  } catch {
    fiches = {};
  }
  for (const l of L) {
    const ing = fiches[l.key] || null;
    const names = ingredientQueries(l.key, typeof frNameOf === 'function' ? frNameOf(l.key) : '');
    const offers = [];
    for (const shop of S) {
      let best = null;
      for (const p of matchProducts(names, shop.products)) {
        const price = num(p.price);
        if (!plausibleOffer(p, ing, price)) continue;
        if (!best || price < best.price) best = { shop, product: p, price: round2(price) };
      }
      if (best) offers.push(best);
    }
    if (!offers.length) continue;
    offers.sort((a, b) => a.price - b.price);
    const packs = l.packs > 0 ? l.packs : 1;
    out.byKey[l.key] = { count: offers.length, min: offers[0].price, offers };
    out.covered.push(l.key);
    out.totalReal += offers[0].price * packs;
    for (const o of offers) {
      const k = String(o.shop.id);
      const cur = perShop.get(k) || { shop: o.shop, count: 0, total: 0 };
      cur.count += 1;
      cur.total += o.price * packs;
      perShop.set(k, cur);
    }
  }
  out.totalReal = round2(out.totalReal);
  out.best = [...perShop.values()]
    .map((x) => ({ ...x, total: round2(x.total) }))
    .sort((a, b) => b.count - a.count || a.total - b.total || String(a.shop.name).localeCompare(String(b.shop.name)))
    .slice(0, 3);
  return out;
}

/** Restaurants et traiteurs "autour" : ville ou code postal connus de l'appli, trouvés dans l'adresse de la boutique. */
export function nearbyShops(shops, place, limit = 3) {
  const city = cleanName(place && place.city);
  const postal = String((place && (place.postalCode || place.postcode)) || '')
    .replace(/\s+/g, '')
    .trim();
  if (!city && !postal) return [];
  const list = (Array.isArray(shops) ? shops : []).filter((s) => s && s.id != null && s.name);
  const scored = [];
  for (const s of list) {
    const addr = String(s.address || '');
    const flat = addr.replace(/\s+/g, '');
    let score = 0;
    if (postal && postal.length >= 4 && flat.includes(postal)) score += 2;
    if (city && ` ${cleanName(addr)} `.includes(` ${city} `)) score += 1;
    if (score > 0) scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score || String(a.s.name).localeCompare(String(b.s.name)));
  return scored.slice(0, limit).map((x) => x.s);
}
