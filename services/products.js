import { apiGet } from './api';
import { CONFIG } from './config';

// Base pour résoudre les chemins media relatifs (ex "/media/product_images/x.jpg")
// en URLs absolues. API_URL = ".../api/v1" → on retire le suffixe pour la racine.
const MEDIA_BASE = String(CONFIG.API_URL || '').replace(/\/api\/v1\/?$/, '');
function absolutizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u; // déjà absolue
  return MEDIA_BASE + (u.startsWith('/') ? u : '/' + u);
}

// Get all categories. `query` permet d'ajouter ?page_size=... (l'endpoint est
// paginé à 10 par défaut, ce qui pourrait masquer une catégorie).
export async function getCategories(query = '') {
  const data = await apiGet('/admin/categories-list/' + (query || ''));
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  if (data.data) return data.data;
  return [];
}

// Résout le category_id NUMÉRIQUE (requis dans l'URL /users/order/create/<company>/<category>/)
// à partir du slug porté par les items Boutiques (ex 'product_purchase'). Les produits
// n'exposent que le slug ; on mappe slug→id via /admin/categories-list/ (mis en cache
// module-level). Retourne null si introuvable (l'appelant garde alors le flux local).
let _categoryIdBySlug = null;
export async function resolveCategoryId(slug) {
  if (!slug) return null;
  if (!_categoryIdBySlug) {
    try {
      // page_size élevé : ne pas rater le slug s'il tombe en page 2 (défaut 10).
      const cats = await getCategories('?page_size=100');
      const map = {};
      (Array.isArray(cats) ? cats : []).forEach((c) => {
        const s = c?.slug || c?.category_slug || c?.categorySlug || c?.name;
        const id = c?.id ?? c?.category_id ?? c?.pk;
        if (s != null && id != null) map[String(s).toLowerCase()] = id;
      });
      _categoryIdBySlug = map;
    } catch (e) {
      _categoryIdBySlug = null;
      return null;
    }
  }
  return _categoryIdBySlug[String(slug).toLowerCase()] ?? null;
}

// Get subcategories for a category
export async function getSubcategories(categoryId) {
  const data = await apiGet(`/admin/subcategories/${categoryId}/`);
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  return [];
}

// Get products for a company
export async function getCompanyProducts(companyId) {
  const data = await apiGet(`/userprofessional/get/products/?company_id=${companyId}`);
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  if (data.data) return data.data;
  return [];
}

// Get a single product
export async function getProduct(productId) {
  return apiGet(`/userprofessional/get/products/${productId}/`);
}

// Get products and services for a company (user-facing endpoint)
export async function getCompanyProductsAndServices(companyId) {
  return apiGet(`/users/company/${companyId}/products-services/`);
}

// Search products across all companies
export async function searchProducts(query) {
  // The Marketplace API may not have a direct search endpoint,
  // so we fetch all products and filter client-side as fallback
  const data = await apiGet(`/userprofessional/get/products/`);
  const products = Array.isArray(data) ? data : data.results || data.data || [];

  if (!query) return products;

  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      (p.productname && p.productname.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.keywords && p.keywords.some((k) => k.toLowerCase().includes(q)))
  );
}

// Get all products (for building inventory)
export async function getAllProducts() {
  const data = await apiGet('/userprofessional/get/products/');
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  if (data.data) return data.data;
  return [];
}

// Vrais shops Pearl Streets d'une catégorie racine (product_purchase / food_drink),
// groupés avec leurs produits publiés. Consommé par l'écran Boutiques.
// 1 endpoint (products-by-category) → on dédoublonne par company_id.
export async function getShopsByCategory(slug = 'product_purchase', { pages = 3, pageSize = 100 } = {}) {
  const byShop = new Map();
  for (let page = 1; page <= pages; page++) {
    let data;
    try {
      data = await apiGet(`/users/products-by-category/${slug}/?page=${page}&page_size=${pageSize}`);
    } catch (e) {
      break;
    }
    const rows = Array.isArray(data) ? data : (data && (data.results || data.data)) || [];
    if (!rows.length) break;
    // Le backend peut renvoyer les images en tableau OU en chaîne, et parfois
    // en chemin relatif (/media/...) : on normalise vers la 1ʳᵉ URL absolue.
    const firstUrl = (v, fallback) => {
      let u = '';
      if (Array.isArray(v)) u = v.find((x) => typeof x === 'string' && x) || '';
      else if (typeof v === 'string') u = v;
      return absolutizeUrl(u) || fallback || '';
    };
    rows.forEach((p) => {
      const shopId = p.company_id;
      if (!shopId) return;
      if (!byShop.has(shopId)) {
        byShop.set(shopId, {
          id: shopId,
          name: p.company_name || 'Boutique',
          cover: firstUrl(p.company_cover_photo),
          address: p.company_address || '',
          phone: p.company_phone || '',
          refCode: p.company_ref_code || '',
          openingHours: p.opening_hours || null,
          category: slug,
          products: [],
        });
      }
      const hasPromo = p.promotional_price != null && Number(p.promotional_price) > 0;
      byShop.get(shopId).products.push({
        id: p.id,
        name: p.name || 'Produit',
        price: Number(hasPromo ? p.promotional_price : p.price) || 0,
        basePrice: Number(p.price) || 0,
        promo: hasPromo,
        // image = tableau d'URLs côté backend → 1ʳᵉ image (fallback galerie).
        image: firstUrl(p.image, firstUrl(p.gallery)),
        description: p.description || '',
        subcategory: p.subcategory_name || p.subcategory_slug || '',
      });
    });
    const total = (data && Number(data.count)) || 0;
    if (page * pageSize >= total) break;
  }
  return Array.from(byShop.values());
}
