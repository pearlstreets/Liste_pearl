import { apiPost } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParse } from '../utils/safeParse';

const KEY_CART = 'KEY_CART';
const KEY_ORDER_HISTORY = 'KEY_ORDER_HISTORY';

// Cart is managed locally and synced when placing an order
// This hybrid approach works because the Marketplace backend
// doesn't have dedicated cart endpoints yet

// Get local cart
export async function getCart() {
  const raw = await AsyncStorage.getItem(KEY_CART);
  const cart = safeParse(raw, []);
  return Array.isArray(cart) ? cart : [];
}

// Save cart locally
export async function saveCart(cart) {
  await AsyncStorage.setItem(KEY_CART, JSON.stringify(cart));
}

// Add item to cart
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

// Remove item from cart
export async function removeFromCart(itemId, shop) {
  let cart = await getCart();
  cart = cart.filter((c) => !(c.id === itemId && c.shop === shop));
  await saveCart(cart);
  return cart;
}

// Clear cart
export async function clearCart() {
  await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
}

// Place order - creates order locally and attempts to sync with backend
export async function placeOrder(orderData) {
  const order = {
    id: Date.now(),
    date: new Date().toISOString(),
    ...orderData,
    status: 'confirmed',
  };

  // Save to local order history (reset to [] if storage corrupted)
  const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
  const parsed = safeParse(raw, []);
  const orders = Array.isArray(parsed) ? parsed : [];
  orders.unshift(order);
  await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(orders));

  // Try to sync with backend. Local storage is always the source of truth;
  // backend sync is best-effort. Unsynced orders are tagged for later retry.
  try {
    await apiPost('/users/orders/', {
      products: orderData.items.map((item) => ({
        product_id: item.id,
        quantity: item.qty,
        price: item.price,
      })),
      delivery_mode: orderData.mode,
      delivery_address: orderData.address,
      total: orderData.total,
      client_order_id: order.id,
    });
    order.synced = true;
  } catch (_e) {
    order.synced = false;
    // Persist unsynced flag so retryUnsyncedOrders can pick it up later
    const currentRaw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
    const currentParsed = safeParse(currentRaw, []);
    const currentOrders = Array.isArray(currentParsed) ? currentParsed : [];
    if (currentOrders[0]?.id === order.id) {
      currentOrders[0].synced = false;
      await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(currentOrders));
    }
    console.log('Order saved locally, backend sync will retry later');
  }

  // Clear cart after order
  await clearCart();

  return order;
}

// Get order history
export async function getOrders() {
  const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
  const orders = safeParse(raw, []);
  return Array.isArray(orders) ? orders : [];
}

// Get order by ID
export async function getOrder(orderId) {
  const orders = await getOrders();
  return orders.find((o) => o.id === orderId);
}

// Retry unsynced orders - safe to call on login or network reconnect.
// Silently skips if backend is unreachable; marks orders synced on success.
export async function retryUnsyncedOrders() {
  const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
  const parsed = safeParse(raw, []);
  const orders = Array.isArray(parsed) ? parsed : [];
  const unsynced = orders.filter((o) => o.synced === false);
  if (unsynced.length === 0) return { retried: 0, succeeded: 0 };

  let succeeded = 0;
  for (const order of unsynced) {
    try {
      await apiPost('/users/orders/', {
        products: (order.items || []).map((item) => ({
          product_id: item.id,
          quantity: item.qty,
          price: item.price,
        })),
        delivery_mode: order.mode,
        delivery_address: order.address,
        total: order.total,
        client_order_id: order.id,
      });
      order.synced = true;
      succeeded += 1;
    } catch (_e) {
      // Keep synced=false, try again next time
    }
  }

  if (succeeded > 0) {
    await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(orders));
  }
  return { retried: unsynced.length, succeeded };
}
