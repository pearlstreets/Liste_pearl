import { apiGet } from './api';

// Get all categories
export async function getCategories() {
  const data = await apiGet('/admin/categories-list/');
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  if (data.data) return data.data;
  return [];
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
    // Le backend peut renvoyer les images en tableau OU en chaîne : on
    // normalise vers la 1ʳᵉ URL exploitable.
    const firstUrl = (v, fallback) => {
      if (Array.isArray(v)) return v.find((u) => typeof u === 'string' && u) || fallback || '';
      if (typeof v === 'string' && v) return v;
      return fallback || '';
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
