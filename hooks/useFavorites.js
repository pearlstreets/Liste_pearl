import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEY_FAV_SHOPS, KEY_FAV_PRODUCTS } from '../constants/storageKeys';

export function useFavorites() {
  const [favShops, setFavShops] = useState([]);
  const [favProducts, setFavProducts] = useState([]);

  const loadFavorites = useCallback(async () => {
    const shopsRaw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
    const prodsRaw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
    setFavShops(shopsRaw ? JSON.parse(shopsRaw) : []);
    setFavProducts(prodsRaw ? JSON.parse(prodsRaw) : []);
  }, []);

  const toggleShopFavorite = useCallback(async (shopName) => {
    const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
    let shops = raw ? JSON.parse(raw) : [];
    if (shops.includes(shopName)) {
      shops = shops.filter(s => s !== shopName);
    } else {
      shops.push(shopName);
    }
    await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(shops));
    setFavShops(shops);
    return shops;
  }, []);

  const toggleProductFavorite = useCallback(async (product) => {
    const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
    let products = raw ? JSON.parse(raw) : [];
    const exists = products.find(p => p.name === product.name);
    if (exists) {
      products = products.filter(p => p.name !== product.name);
    } else {
      products.push({ name: product.name, detail: product.detail || '', price: product.price || 0 });
    }
    await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(products));
    setFavProducts(products);
    return products;
  }, []);

  return { favShops, favProducts, loadFavorites, toggleShopFavorite, toggleProductFavorite };
}
