import React from "react";
import { libelleDetail } from "../../lib/libelleDetail";
import { useTranslation } from "react-i18next";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { SERIF, TAILLES } from "../../components/ui/marche";
import { BRAND, INSET_BAS, THEME } from "../../components/commun/theme";
import { useCurrency } from "../../components/commun/devise";
import { ProductThumb } from "../../components/commun/ProductImage";
import { KEY_FAV_SHOPS, KEY_FAV_PRODUCTS } from "../../lib/constants";

const favStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: TAILLES.marge, paddingTop: 10, paddingBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 26, fontWeight: '400', color: THEME.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  segment: { flexDirection: 'row', marginTop: 16, backgroundColor: THEME.subtle, borderRadius: TAILLES.rayonCarte, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.boutonPetit, borderRadius: 12 },
  segBtnOn: { backgroundColor: THEME.card, ...THEME.shadowSm, borderWidth: 1, borderColor: THEME.border },
  segTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.muted, marginLeft: 6 },
  segTxtOn: { color: THEME.ink },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, paddingHorizontal: 14, height: TAILLES.champ, marginTop: 12, borderWidth: 1, borderColor: THEME.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: THEME.ink, padding: 0 },
  card: { backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, padding: 14, marginHorizontal: TAILLES.marge, marginTop: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  shopIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  cardSub: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6 },
  metaTxt: { fontSize: 12, color: THEME.muted, marginLeft: 4, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  price: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  unitPrice: { fontSize: 11, color: THEME.faint, marginLeft: 6, fontWeight: '600' },
  favBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 50 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: '400', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});

const FavoritesScreen = ({ onClose }) => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const [tab, setTab] = React.useState('shops'); // 'shops' | 'products'
  const [favShops, setFavShops] = React.useState([]);
  const [shopDetails, setShopDetails] = React.useState([]);
  const [favProducts, setFavProducts] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const BRAND = "#1C1917";

  // Load favorite shops
  const loadFavShops = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
      const arr = raw ? JSON.parse(raw) : [];
      setFavShops(Array.isArray(arr) ? arr : []);
      // Les boutiques favorites sont de vraies boutiques Pearl Streets (ajoutées
      // par nom). On n'invente plus de distance/horaire/adresse : on affiche le nom.
      const details = (Array.isArray(arr) ? arr : []).map(shopName => ({ name: shopName, distance: "", time: "", address: "" }));
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

  const Header = (
    <View style={[favStyles.header, onClose && { paddingTop: 54 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onClose ? (
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('profile.back', 'Retour')}
            style={{ width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={THEME.ink} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={favStyles.title}>{t('tabs.favorites')}</Text>
          <Text style={favStyles.subtitle}>
            {tab === 'shops'
              ? t('counts.shops', { count: shopDetails.length })
              : t('counts.products', { count: favProducts.length })}
          </Text>
        </View>
      </View>

      {/* Toggle Shops / Produits */}
      <View style={favStyles.segment}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => { setTab('shops'); setSearchQuery(''); }} style={[favStyles.segBtn, tab === 'shops' && favStyles.segBtnOn]}>
          <Ionicons name={tab === 'shops' ? 'storefront' : 'storefront-outline'} size={16} color={tab === 'shops' ? THEME.terra : THEME.muted} />
          <Text style={[favStyles.segTxt, tab === 'shops' && favStyles.segTxtOn]}>{t('favorites.shops', 'Shops')}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => { setTab('products'); setSearchQuery(''); }} style={[favStyles.segBtn, tab === 'products' && favStyles.segBtnOn]}>
          <Ionicons name={tab === 'products' ? 'heart' : 'heart-outline'} size={16} color={tab === 'products' ? THEME.terra : THEME.muted} />
          <Text style={[favStyles.segTxt, tab === 'products' && favStyles.segTxtOn]}>{t('favorites.products', 'Produits')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={favStyles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={THEME.faint} />
        <TextInput value={searchQuery} onChangeText={setSearchQuery}
          placeholder={tab === 'shops' ? (t('favorites.searchPlaceholder', 'Rechercher un shop')) : (t('favorites.searchProductPlaceholder', 'Rechercher un produit'))}
          placeholderTextColor={THEME.faint} style={favStyles.searchInput} />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={THEME.faint} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={favStyles.screen}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={favStyles.screen} edges={['top']}>
      {isEmpty ? (
        <>
          {Header}
          <View style={favStyles.empty}>
            <Text style={favStyles.emptyTitle}>
              {tab === 'shops' ? (t('favorites.noFavorites', 'Aucune boutique favorite')) : (t('favorites.noFavProducts', 'Aucun produit favori'))}
            </Text>
            <Text style={favStyles.emptyHint}>
              {tab === 'shops' ? (t('favorites.addFromBuy')) : (t('favorites.addProductHint', 'Appuyez sur le coeur d\'un produit pour l\'ajouter'))}
            </Text>
          </View>
        </>
      ) : tab === 'shops' ? (
        <FlatList
          data={filteredShops}
          keyExtractor={(item) => item.name}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={Header}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 24 + INSET_BAS}}
          renderItem={({item}) => (
            <View style={favStyles.card}>
              <View style={favStyles.cardRow}>
                <View style={favStyles.shopIcon}>
                  <Ionicons name="storefront" size={22} color={THEME.brand} />
                </View>
                <View style={favStyles.cardBody}>
                  <Text style={favStyles.cardTitle}>{item.name}</Text>
                  {item.address ? <Text style={favStyles.cardSub}>{item.address}</Text> : null}
                  <View style={favStyles.metaRow}>
                    {item.distance ? (
                      <View style={favStyles.metaChip}>
                        <Ionicons name="location-outline" size={12} color={THEME.muted} />
                        <Text style={favStyles.metaTxt}>{item.distance}</Text>
                      </View>
                    ) : null}
                    {item.time ? (
                      <View style={favStyles.metaChip}>
                        <Ionicons name="time-outline" size={12} color={THEME.muted} />
                        <Text style={favStyles.metaTxt}>{item.time}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeShopFav(item.name)} activeOpacity={0.8} style={favStyles.favBtn}>
                  <Ionicons name="heart-dislike-outline" size={17} color={THEME.danger} />
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
          ListHeaderComponent={Header}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 24 + INSET_BAS}}
          renderItem={({item}) => (
            <View style={favStyles.card}>
              <View style={favStyles.cardRow}>
                <ProductThumb name={item.name} size={44} />
                <View style={favStyles.cardBody}>
                  <Text style={favStyles.cardTitle}>{item.name}</Text>
                  {item.detail ? <Text style={favStyles.cardSub}>{libelleDetail(item.detail)}</Text> : null}
                  <View style={favStyles.priceRow}>
                    <Text style={favStyles.price}>{fmtPrice(item.price || 0)}</Text>
                    {item.unitPrice ? <Text style={favStyles.unitPrice}>{item.unitPrice}</Text> : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeProductFav(item.name)} activeOpacity={0.8} style={favStyles.favBtn}>
                  <Ionicons name="heart-dislike-outline" size={17} color={THEME.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
    </KeyboardAvoidingView>
    </View>
  );
};

export default FavoritesScreen;
