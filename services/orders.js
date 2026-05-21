import { apiPost } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_CART = 'KEY_CART';
const KEY_ORDER_HISTORY = 'KEY_ORDER_HISTORY';

// Cart is managed locally and synced when placing an order
// This hybrid approach works because the Marketplace backend
// doesn't have dedicated cart endpoints yet

// Get local cart
export async function getCart() {
  const raw = await AsyncStorage.getItem(KEY_CART);
  return raw ? JSON.parse(raw) : [];
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

  // Save to local order history
  const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
  const orders = raw ? JSON.parse(raw) : [];
  orders.unshift(order);
  await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(orders));

  // Try to sync with backend (orders endpoint may be disabled)
  try {
    await apiPost('/userprofessional/create-new-orders/', {
      products: orderData.items.map((item) => ({
        product_id: item.id,
        quantity: item.qty,
        price: item.price,
      })),
      delivery_mode: orderData.mode,
      delivery_address: orderData.address,
      total: orderData.total,
    });
  } catch {
    // Backend order endpoint may be commented out - local storage is the fallback
    console.log('Order sync with backend skipped (endpoint may be inactive)');
  }

  // Clear cart after order
  await clearCart();

  return order;
}

// Get order history
export async function getOrders() {
  const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
  return raw ? JSON.parse(raw) : [];
}

// Get order by ID
export async function getOrder(orderId) {
  const orders = await getOrders();
  return orders.find((o) => o.id === orderId);
}
