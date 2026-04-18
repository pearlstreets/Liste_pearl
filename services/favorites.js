import { apiGet, apiPost } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParseArray } from '../utils/safeParse';

const KEY_FAV_SHOPS = 'KEY_FAV_SHOPS';
const KEY_FAV_PRODUCTS = 'KEY_FAV_PRODUCTS';

// Fetch favorites from backend and sync to local.
// NOTE: /users/favorites/* is 404 on production - syncFavorites silently
// falls through to local-only mode. Local writes still work via
// add*/remove* below, so favorites persist on the device.
// We also NEVER overwrite local with an empty {shops:[], products:[]}
// backend response - that would wipe the user's starred items.
export async function syncFavorites() {
  try {
    const data = await apiGet('/users/favorites/');
    if (data?.status && (Array.isArray(data.shops) || Array.isArray(data.products))) {
      const shopNames = Array.isArray(data.shops) ? data.shops.map((s) => s.name) : null;
      const products = Array.isArray(data.products)
        ? data.products.map((p) => ({ name: p.name, detail: p.detail, price: p.price }))
        : null;
      // Only overwrite local if backend returned a non-empty list OR an
      // explicit empty confirmation (data.clear === true). Prevents
      // silent wipe when backend returns {status:1, shops:[], products:[]}
      // because it hasn't been taught about this user yet.
      if (shopNames && (shopNames.length > 0 || data.clear === true)) {
        await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(shopNames));
      }
      if (products && (products.length > 0 || data.clear === true)) {
        await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(products));
      }
      return {
        shops: shopNames || safeParseArray(await AsyncStorage.getItem(KEY_FAV_SHOPS)),
        products: products || safeParseArray(await AsyncStorage.getItem(KEY_FAV_PRODUCTS)),
      };
    }
  } catch (_e) {}
  // Fallback to local (corrupted blob → [] instead of crash)
  const shopsRaw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
  const prodsRaw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
  return {
    shops: safeParseArray(shopsRaw),
    products: safeParseArray(prodsRaw),
  };
}

// Add shop to favorites (local + backend)
export async function addShopFavorite(shopName, companyId) {
  // Local
  const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
  const shops = safeParseArray(raw);
  if (!shops.includes(shopName)) {
    shops.push(shopName);
    await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(shops));
  }
  // Backend (404 on prod today - silent no-op)
  try {
    await apiPost('/users/favorites/add/', {
      type: 'shop',
      company_name: shopName,
      company_id: companyId || 0,
    });
  } catch (_e) {}
}

// Remove shop from favorites (local + backend)
export async function removeShopFavorite(shopName) {
  const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
  const shops = safeParseArray(raw);
  const updated = shops.filter((s) => s !== shopName);
  await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(updated));
  try {
    await apiPost('/users/favorites/remove/', { type: 'shop', company_name: shopName });
  } catch (_e) {}
}

// Add product to favorites (local + backend)
export async function addProductFavorite(product) {
  const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
  const products = safeParseArray(raw);
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
  } catch (_e) {}
}

// Remove product from favorites (local + backend)
export async function removeProductFavorite(productName) {
  const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
  const products = safeParseArray(raw);
  const updated = products.filter((p) => p.name !== productName);
  await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(updated));
  try {
    await apiPost('/users/favorites/remove/', { type: 'product', product_name: productName });
  } catch (_e) {}
}
