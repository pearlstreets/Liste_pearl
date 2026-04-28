import { apiGet, apiPost, getTokens } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_CART = "KEY_CART";
const KEY_ORDER_HISTORY = "KEY_ORDER_HISTORY";
const KEY_UNSYNCED = "KEY_UNSYNCED_ORDERS";

// ─── Cart (local) ──────────────────────────────────────────────────────────────

export async function getCart() {
  const raw = await AsyncStorage.getItem(KEY_CART);
  return raw ? JSON.parse(raw) : [];
}

export async function saveCart(cart) {
  await AsyncStorage.setItem(KEY_CART, JSON.stringify(cart));
}

export async function addToCart(item) {
  const cart = await getCart();
  const existing = cart.findIndex((c) => c.id === item.id && c.shop === item.shop);
  if (existing >= 0) {
    cart[existing].qty = (cart[existing].qty || 1) + (item.qty || 1);
  } else {
    cart.push({ ...item, qty: item.qty || 1 });
  }
  await saveCart(cart);
  return cart;
}

export async function removeFromCart(itemId, shop) {
  let cart = await getCart();
  cart = cart.filter((c) => !(c.id === itemId && c.shop === shop));
  await saveCart(cart);
  return cart;
}

export async function clearCart() {
  await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
}

// ─── Backend sync ──────────────────────────────────────────────────────────────

async function _getUserRole() {
  try {
    const raw = await AsyncStorage.getItem("KEY_AUTH");
    if (!raw) return "user";
    const auth = JSON.parse(raw);
    return auth.role || "user";
  } catch (_) { return "user"; }
}

export async function syncOrderToBackend(order) {
  return _syncOrderToBackend(order);
}

async function _syncOrderToBackend(order) {
  // The backend requires POST /users/order/create/<company_id>/<category_id>/
  // Pearl List items from the local catalog have no backend company_id/category_id.
  // Only attempt sync when all items carry a numeric product_id from the backend catalog.
  const hasBackendIds = (order.items || []).every(
    (item) => item.company_id && item.category_id && item.id
  );
  if (!hasBackendIds) return false;

  // Group items by company+category so each group maps to one endpoint call
  const groups = {};
  for (const item of order.items || []) {
    const key = `${item.company_id}/${item.category_id}`;
    if (!groups[key]) groups[key] = { company_id: item.company_id, category_id: item.category_id, items: [] };
    groups[key].items.push(item);
  }

  let allOk = true;
  for (const { company_id, category_id } of Object.values(groups)) {
    try {
      await apiPost(`/users/order/create/${company_id}/${category_id}/`, {
        order_ref: String(order.id),
        delivery_mode: order.mode || "collect",
        delivery_address: order.address || "",
        ...(order.address_id ? { address_id: order.address_id } : {}),
      });
    } catch (_) {
      allOk = false;
    }
  }
  return allOk;
}

// ─── Place order ───────────────────────────────────────────────────────────────

export async function placeOrder(orderData) {
  const order = {
    id: `SG-${Date.now()}`,
    date: new Date().toISOString(),
    ...orderData,
    status: "confirmed",
    synced: false,
  };

  // Save to local history immediately
  const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
  const orders = raw ? JSON.parse(raw) : [];
  orders.unshift(order);
  await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(orders));

  // Clear cart
  await clearCart();

  // Attempt backend sync
  const synced = await _syncOrderToBackend(order);
  if (synced) {
    order.synced = true;
    orders[0] = order;
    await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(orders));
  } else {
    // Queue for retry
    const unsyncedRaw = await AsyncStorage.getItem(KEY_UNSYNCED);
    const unsynced = unsyncedRaw ? JSON.parse(unsyncedRaw) : [];
    unsynced.push(order);
    await AsyncStorage.setItem(KEY_UNSYNCED, JSON.stringify(unsynced));
  }

  return order;
}

// ─── Retry unsynced orders (call on app foreground) ────────────────────────────

export async function retryUnsyncedOrders() {
  const raw = await AsyncStorage.getItem(KEY_UNSYNCED);
  if (!raw) return;
  const unsynced = JSON.parse(raw);
  if (!unsynced.length) return;

  const stillUnsynced = [];
  for (const order of unsynced) {
    const ok = await _syncOrderToBackend(order);
    if (!ok) stillUnsynced.push(order);
    else {
      // Mark as synced in history
      try {
        const histRaw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
        const hist = histRaw ? JSON.parse(histRaw) : [];
        const idx = hist.findIndex((o) => o.id === order.id);
        if (idx >= 0) { hist[idx].synced = true; await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(hist)); }
      } catch (_) {}
    }
  }
  await AsyncStorage.setItem(KEY_UNSYNCED, JSON.stringify(stillUnsynced));
}

// ─── Read history ──────────────────────────────────────────────────────────────

export async function getOrders() {
  const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
  return raw ? JSON.parse(raw) : [];
}

export async function getOrder(orderId) {
  const orders = await getOrders();
  return orders.find((o) => o.id === orderId);
}
