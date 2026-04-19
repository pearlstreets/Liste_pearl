import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, GUTTER } from '../constants/brand';
import { KEY_FAV_SHOPS, KEY_FAV_PRODUCTS } from '../constants/storageKeys';
import { ProductThumb } from '../constants/productImages';
import CurrencyContext, { useCurrency } from '../context/CurrencyContext';
import { styles } from '../styles/shared';

const FavoritesScreen = () => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const [tab, setTab] = React.useState('shops'); // 'shops' | 'products'
  const [favShops, setFavShops] = React.useState([]);
  const [shopDetails, setShopDetails] = React.useState([]);
  const [favProducts, setFavProducts] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const BRAND = "#00C29B";

  // Load favorite shops
  const loadFavShops = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
      const arr = raw ? JSON.parse(raw) : [];
      setFavShops(Array.isArray(arr) ? arr : []);
      const details = (Array.isArray(arr) ? arr : []).map(shopName => {
        const shopData = [
          {name: "Carrefour Market", distance: "0.9 km", time: "9 min", address: "12 Rue du Commerce"},
          {name: "Intermarché Sud", distance: "0.8 km", time: "10 min", address: "45 Avenue du Sud"},
          {name: "Primeur Bio", distance: "0.5 km", time: "7 min", address: "8 Place du Marché"},
          {name: "Leclerc Meaux", distance: "1.8 km", time: "8 min", address: "Zone Commerciale Meaux"},
          {name: "Monoprix Centre", distance: "1.2 km", time: "6 min", address: "Centre Ville"},
          {name: "Auchan City", distance: "1.5 km", time: "11 min", address: "23 Boulevard Haussmann"},
          {name: "Lidl Express", distance: "0.7 km", time: "5 min", address: "6 Rue des Lilas"},
          {name: "Casino Shop", distance: "1.0 km", time: "8 min", address: "18 Avenue de la République"}
        ].find(s => s.name === shopName);
        return shopData || {name: shopName, distance: "", time: "", address: ""};
      });
      setShopDetails(details);
    } catch(e) { setFavShops([]); setShopDetails([]); }
  }, []);

  // Load favorite products
  const loadFavProducts = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
      setFavProducts(raw ? JSON.parse(raw) : []);
    } catch(e) { setFavProducts([]); }
  }, []);

  useFocusEffect(React.useCallback(() => { loadFavShops(); loadFavProducts(); }, [loadFavShops, loadFavProducts]));

  const removeShopFav = async (shopName) => {
    const newFavs = favShops.filter(name => name !== shopName);
    setFavShops(newFavs);
    await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(newFavs));
    await loadFavShops();
  };

  const removeProductFav = async (productName) => {
    const updated = favProducts.filter(p => p.name !== productName);
    setFavProducts(updated);
    await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(updated));
  };

  const filteredShops = searchQuery.trim()
    ? shopDetails.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : shopDetails;

  const filteredProducts = searchQuery.trim()
    ? favProducts.filter(p => (p.name||'').toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : favProducts;

  const isEmpty = tab === 'shops' ? shopDetails.length === 0 : favProducts.length === 0;

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={styles.screen}>
      {/* Toggle Shops / Produits */}
      <View style={{flexDirection:'row', marginHorizontal:16, marginTop:12, marginBottom:8}}>
        <TouchableOpacity onPress={() => { setTab('shops'); setSearchQuery(''); }} style={{flex:1, borderWidth:1, borderColor: tab==='shops' ? BRAND : '#ccc', borderRadius:10, paddingVertical:8, marginRight:8, alignItems:'center', backgroundColor: tab==='shops' ? BRAND : '#fff'}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Ionicons name="storefront-outline" size={16} color={tab==='shops' ? '#fff' : '#555'} style={{marginRight:6}} />
            <Text style={{color: tab==='shops' ? '#fff' : '#555', fontWeight:'600'}}>{t('favorites.shops') || 'Shops'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setTab('products'); setSearchQuery(''); }} style={{flex:1, borderWidth:1, borderColor: tab==='products' ? BRAND : '#ccc', borderRadius:10, paddingVertical:8, marginLeft:8, alignItems:'center', backgroundColor: tab==='products' ? BRAND : '#fff'}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Ionicons name="heart-outline" size={16} color={tab==='products' ? '#fff' : '#555'} style={{marginRight:6}} />
            <Text style={{color: tab==='products' ? '#fff' : '#555', fontWeight:'600'}}>{t('favorites.products') || 'Produits'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal:16, paddingBottom:4 }}>
        <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:12, paddingHorizontal:12, paddingVertical:10, borderWidth:1, borderColor:'#E5E7EB' }}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput value={searchQuery} onChangeText={setSearchQuery}
            placeholder={tab === 'shops' ? (t('favorites.searchPlaceholder') || 'Rechercher un shop') : (t('favorites.searchProductPlaceholder') || 'Rechercher un produit')}
            placeholderTextColor="#9CA3AF" style={{ flex:1, marginLeft:8, fontSize:15, color:'#111', padding:0 }} />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isEmpty ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40}}>
          <Ionicons name={tab === 'shops' ? "storefront-outline" : "heart-outline"} size={56} color="#E5E7EB" />
          <Text style={{fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center'}}>
            {tab === 'shops' ? (t('favorites.noFavorites') || 'Aucun shop favori') : (t('favorites.noFavProducts') || 'Aucun produit favori')}
          </Text>
          <Text style={{fontSize: 13, color: '#9CA3AF', marginTop: 8, textAlign: 'center'}}>
            {tab === 'shops' ? (t('favorites.addFromProducts') || 'Ajoutez depuis l\'onglet Produits') : (t('favorites.addProductHint') || 'Appuyez sur le coeur d\'un produit pour l\'ajouter')}
          </Text>
        </View>
      ) : tab === 'shops' ? (
        <FlatList
          data={filteredShops}
          keyExtractor={(item) => item.name}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{paddingVertical: 8}}
          renderItem={({item}) => (
            <View style={{ backgroundColor:'#fff', marginHorizontal:16, marginVertical:6, borderRadius:12, padding:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2 }}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
                    <Ionicons name="storefront" size={18} color={BRAND} style={{marginRight:8}} />
                    <Text style={{fontSize:16, fontWeight:'700', color:'#111'}}>{item.name}</Text>
                  </View>
                  {item.address ? <Text style={{fontSize:13, color:'#6B7280', marginTop:2}}>{item.address}</Text> : null}
                  <View style={{flexDirection:'row', alignItems:'center', marginTop:6}}>
                    {item.distance ? <><Ionicons name="location-outline" size={13} color="#6B7280" /><Text style={{fontSize:12, color:'#6B7280', marginLeft:4}}>{item.distance}</Text></> : null}
                    {item.time ? <><Ionicons name="time-outline" size={13} color="#6B7280" style={{marginLeft:10}} /><Text style={{fontSize:12, color:'#6B7280', marginLeft:4}}>{item.time}</Text></> : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeShopFav(item.name)} style={{ width:34, height:34, borderRadius:17, backgroundColor:'#FEE2E2', alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="heart-dislike-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item, i) => (item.name||'') + i}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{paddingVertical: 8}}
          renderItem={({item}) => (
            <View style={{ backgroundColor:'#fff', marginHorizontal:16, marginVertical:6, borderRadius:12, padding:14, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2, flexDirection:'row', alignItems:'center' }}>
              <ProductThumb name={item.name} size={44} />
              <View style={{flex:1, marginLeft:12}}>
                <Text style={{fontSize:15, fontWeight:'700', color:'#111'}}>{item.name}</Text>
                {item.detail ? <Text style={{fontSize:12, color:'#6B7280', marginTop:2}}>{item.detail}</Text> : null}
                <View style={{flexDirection:'row', alignItems:'baseline', marginTop:4}}>
                  <Text style={{fontSize:15, fontWeight:'800', color:'#111'}}>{fmtPrice(item.price || 0)}</Text>
                  {item.unitPrice ? <Text style={{fontSize:11, color:'#9CA3AF', marginLeft:6}}>{item.unitPrice}</Text> : null}
                </View>
              </View>
              <TouchableOpacity onPress={() => removeProductFav(item.name)} style={{ width:34, height:34, borderRadius:17, backgroundColor:'#FEE2E2', alignItems:'center', justifyContent:'center' }}>
                <Ionicons name="heart-dislike-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default FavoritesScreen;
