import { apiGet } from "./api";

// Get all categories
export async function getCategories() {
  const data = await apiGet("/admin/categories-list/");
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
  const products = Array.isArray(data) ? data : (data.results || data.data || []);

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
  const data = await apiGet("/userprofessional/get/products/");
  if (Array.isArray(data)) return data;
  if (data.results) return data.results;
  if (data.data) return data.data;
  return [];
}

// ───────────────────────────────────────────────────────────────────────
// Catalogue marketplace par catégorie — endpoint dédié 2026-04-30.
// Slugs disponibles : food_drink, product_purchase, music, travel,
// relaxation, aesthetics, experiences, art_and_culture.
// Réponse par item: { id, name, productType, category_slug, price,
// currency, image, company_id, company_name, description }.
// ───────────────────────────────────────────────────────────────────────

const _norm = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
};

export async function getProductsByCategory(slug, opts = {}) {
  const { page = 1, pageSize = 50, productType } = opts;
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (productType) params.set("productType", productType);
  const data = await apiGet(`/users/products-by-category/${encodeURIComponent(slug)}/?${params}`);
  return _norm(data);
}

// Shortcut Food & drink (pizza, burger, drinks, …)
export const getFoodDrinkProducts = (opts) => getProductsByCategory("food_drink", opts);

// Shortcut Product purchase (épicerie + biens)
export const getProductPurchaseProducts = (opts) => getProductsByCategory("product_purchase", opts);

// Catalogue "courses" : Food & drink + Product purchase en parallèle
export async function getShoppableCatalog(opts = {}) {
  const [foodDrink, productPurchase] = await Promise.all([
    getFoodDrinkProducts(opts).catch(() => []),
    getProductPurchaseProducts(opts).catch(() => []),
  ]);
  return { foodDrink, productPurchase };
}
