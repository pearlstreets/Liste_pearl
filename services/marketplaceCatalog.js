/**
 * Marketplace catalog wrapper — pearl-list.
 *
 * Couche haute pour browser le catalogue temps réel du marketplace
 * Pearl Streets (alimenté par les pros via WebsitePro/AppPro).
 *
 * Aggrege :
 *   - getProductsByCategory(slug)  → produits filtrés par catégorie
 *   - getCategories()              → liste catégories disponibles
 * Fournit :
 *   - getCatalogHomePage()         → 'food_drink' + 'product_purchase' en parallèle
 *   - searchCatalog(query, opts)   → recherche client-side (fallback)
 *   - getCatalogByCompany(companyId) → produits d'une boutique
 *
 * Usage dans ProductsScreen.js :
 *   import { getCatalogHomePage } from '../services/marketplaceCatalog';
 *   useEffect(() => {
 *     getCatalogHomePage().then(({ foodDrink, productPurchase }) => {
 *       setFoodDrink(foodDrink);
 *       setProductPurchase(productPurchase);
 *     });
 *   }, []);
 */
import {
  getProductsByCategory,
  getFoodDrinkProducts,
  getProductPurchaseProducts,
  getShoppableCatalog,
  getCategories,
  getCompanyProductsAndServices,
} from './products';

/**
 * Snapshot home page : Food & drink + Product purchase en parallèle.
 * Cache léger 60s pour éviter spam pendant focus/blur navigation.
 */
const _cache = { data: null, ts: 0 };
const CACHE_TTL_MS = 60_000;

export async function getCatalogHomePage(opts = {}) {
  const now = Date.now();
  if (!opts.force && _cache.data && now - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }
  const data = await getShoppableCatalog(opts);
  _cache.data = data;
  _cache.ts = now;
  return data;
}

/** Invalide le cache (à appeler après une action utilisateur qui modifie le contexte). */
export function invalidateCatalogCache() {
  _cache.data = null;
  _cache.ts = 0;
}

/**
 * Recherche client-side dans le catalogue chargé.
 * Pour vraie recherche full-text serveur, utiliser /users/search-tab/ (POST).
 */
export async function searchCatalog(query, opts = {}) {
  if (!query || !query.trim()) {
    const { foodDrink, productPurchase } = await getCatalogHomePage(opts);
    return [...foodDrink, ...productPurchase];
  }
  const q = query.trim().toLowerCase();
  const { foodDrink, productPurchase } = await getCatalogHomePage(opts);
  const all = [...foodDrink, ...productPurchase];
  return all.filter((p) =>
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.description && p.description.toLowerCase().includes(q)) ||
    (p.company_name && p.company_name.toLowerCase().includes(q))
  );
}

/**
 * Filtres avancés client-side : prix min/max, catégorie, shop.
 * Utiliser sur le résultat de getCatalogHomePage pour rester fluide.
 */
export function filterProducts(products, filters = {}) {
  if (!Array.isArray(products)) return [];
  let out = products;
  if (filters.minPrice != null) out = out.filter((p) => (p.price || 0) >= filters.minPrice);
  if (filters.maxPrice != null) out = out.filter((p) => (p.price || 0) <= filters.maxPrice);
  if (filters.categorySlug) out = out.filter((p) => p.category_slug === filters.categorySlug);
  if (filters.companyId) out = out.filter((p) => p.company_id === filters.companyId);
  if (filters.onSale) out = out.filter((p) => p.promotional_price && p.promotional_price < p.price);
  if (filters.sort === 'price_asc') out = [...out].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (filters.sort === 'price_desc') out = [...out].sort((a, b) => (b.price || 0) - (a.price || 0));
  if (filters.sort === 'name') out = [...out].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return out;
}

/** Re-export des fonctions de bas niveau pour facilité d'import. */
export {
  getProductsByCategory,
  getFoodDrinkProducts,
  getProductPurchaseProducts,
  getCategories,
  getCompanyProductsAndServices,
};
