import { apiGet, apiPost } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_FAV_SHOPS = 'KEY_FAV_SHOPS';
const KEY_FAV_PRODUCTS = 'KEY_FAV_PRODUCTS';

// Fetch favorites from backend and sync to local
export async function syncFavorites() {
  try {
    const data = await apiGet('/users/favorites/');
    if (data.status) {
      // Sync shops
      const shopNames = (data.shops || []).map((s) => s.name);
      await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(shopNames));
      // Sync products
      const products = (data.products || []).map((p) => ({
        name: p.name,
        detail: p.detail,
        price: p.price,
      }));
      await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(products));
      return { shops: shopNames, products };
    }
  } catch (e) {}
  // Fallback to local
  const shopsRaw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
  const prodsRaw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
  return {
    shops: shopsRaw ? JSON.parse(shopsRaw) : [],
    products: prodsRaw ? JSON.parse(prodsRaw) : [],
  };
}

// Add shop to favorites (local + backend)
export async function addShopFavorite(shopName, companyId) {
  // Local
  const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
  const shops = raw ? JSON.parse(raw) : [];
  if (!shops.includes(shopName)) {
    shops.push(shopName);
    await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(shops));
  }
  // Backend
  try {
    await apiPost('/users/favorites/add/', {
      type: 'shop',
      company_name: shopName,
      company_id: companyId || 0,
    });
  } catch (e) {}
}

// Remove shop from favorites (local + backend)
export async function removeShopFavorite(shopName) {
  const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
  const shops = raw ? JSON.parse(raw) : [];
  const updated = shops.filter((s) => s !== shopName);
  await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(updated));
  try {
    await apiPost('/users/favorites/remove/', { type: 'shop', company_name: shopName });
  } catch (e) {}
}

// Add product to favorites (local + backend)
export async function addProductFavorite(product) {
  const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
  const products = raw ? JSON.parse(raw) : [];
  if (!products.find((p) => p.name === product.name)) {
    products.push({ name: product.name, detail: product.detail || '', price: product.price || 0 });
    await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(products));
  }
  try {
    await apiPost('/users/favorites/add/', {
      type: 'product',
      product_name: product.name,
      product_detail: product.detail,
      product_price: product.price,
    });
  } catch (e) {}
}

// Remove product from favorites (local + backend)
export async function removeProductFavorite(productName) {
  const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
  const products = raw ? JSON.parse(raw) : [];
  const updated = products.filter((p) => p.name !== productName);
  await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(updated));
  try {
    await apiPost('/users/favorites/remove/', { type: 'product', product_name: productName });
  } catch (e) {}
}
