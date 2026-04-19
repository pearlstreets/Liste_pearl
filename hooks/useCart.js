import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEY_CART } from '../constants/storageKeys';

export function useCart() {
  const [cartItems, setCartItems] = useState([]);
  const [cartVersion, setCartVersion] = useState(0);

  const loadCart = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CART);
    setCartItems(raw ? JSON.parse(raw) : []);
  }, []);

  useEffect(() => { loadCart(); }, [cartVersion]);

  const addToCart = useCallback(async (item) => {
    const raw = await AsyncStorage.getItem(KEY_CART);
    const cart = raw ? JSON.parse(raw) : [];
    const existing = cart.findIndex(c => c.id === item.id && c.shop === item.shop);
    if (existing >= 0) {
      cart[existing].qty = (cart[existing].qty || 1) + (item.qty || 1);
    } else {
      cart.push({ ...item, qty: item.qty || 1 });
    }
    await AsyncStorage.setItem(KEY_CART, JSON.stringify(cart));
    setCartItems(cart);
    setCartVersion(v => v + 1);
    return cart;
  }, []);

  const removeFromCart = useCallback(async (itemId, shop) => {
    const raw = await AsyncStorage.getItem(KEY_CART);
    let cart = raw ? JSON.parse(raw) : [];
    cart = cart.filter(c => !(c.id === itemId && c.shop === shop));
    await AsyncStorage.setItem(KEY_CART, JSON.stringify(cart));
    setCartItems(cart);
    setCartVersion(v => v + 1);
    return cart;
  }, []);

  const clearCart = useCallback(async () => {
    await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
    setCartItems([]);
    setCartVersion(v => v + 1);
  }, []);

  const refreshCart = useCallback(() => {
    setCartVersion(v => v + 1);
  }, []);

  return { cartItems, cartVersion, addToCart, removeFromCart, clearCart, refreshCart, loadCart };
}
