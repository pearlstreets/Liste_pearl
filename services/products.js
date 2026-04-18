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
