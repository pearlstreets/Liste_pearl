import React from "react";
import { getProductOptions, prefetchShopOptions, getShopCatalogue } from "../../services/products";
import { optionDOffice, ficheEpuisee, optionEpuisee, plafonner, varianteDeLOption, cleVariante } from "../../lib/variantes";
import { loadShops, peekShops } from "../../lib/shopsCache";
import { takePendingShop, onOpenShop } from "../../lib/openShop";
import { useTranslation } from "react-i18next";
import { DeviceEventEmitter } from "react-native";
import Modal from "../../components/DeuxEcrans";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SqueletteBoutiques } from "../../components/ui/Squelette";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { MARCHE, SERIF, TAILLES } from "../../components/ui/marche";
import { BRAND, INSET_BAS, THEME } from "../../components/commun/theme";
import { useCurrency } from "../../components/commun/devise";
import { KEY_CART, KEY_FAV_SHOPS } from "../../lib/constants";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { sousCategorie } from "../../lib/sousCategorie";


// ── Écran BOUTIQUES : vrais shops Pearl Streets (product_purchase) + produits ──
// Catalogue réel via getShopsByCategory('product_purchase'). Tap shop → ses vrais
// produits → ajout panier (KEY_CART, champ `shop` réel) → checkout collect/livraison
// existant. Aucune donnée mockée.
// integre : affiché dans l'onglet Acheter (sous son segment, sans marge du haut).
// actif : segment « Boutiques » choisi (favoris relus quand il devient visible).
const ShopsScreen = ({ integre = false, actif = true, favTick = 0 } = {}) => {
  const { t } = useTranslation();
  const estFocus = useIsFocused();
  const visible = estFocus && actif !== false;
  const { fmtPrice } = useCurrency();
  const navigation = useNavigation();
  // Dernière liste connue (même ancienne) affichée tout de suite ; load() au
  // montage la rafraîchit en arrière-plan.
  const cacheBoutiques = peekShops('product_purchase');
  const [shops, setShops] = React.useState(() => cacheBoutiques || []);
  const [loading, setLoading] = React.useState(() => !(cacheBoutiques && cacheBoutiques.length));
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [selectedShop, setSelectedShop] = React.useState(null);
  const [toast, setToast] = React.useState('');
  // Détail produit (ouvert au tap d'une carte produit) + barres de recherche
  // boutiques / produits. Demande user.
  const [selectedProduct, setSelectedProduct] = React.useState(null);
  const [shopSearch, setShopSearch] = React.useState('');
  const [productSearch, setProductSearch] = React.useState('');
  const [pdQty, setPdQty] = React.useState(1);
  const [pdNote, setPdNote] = React.useState('');
  // Options de la fiche ouverte : undefined = lecture en cours, null = inconnues
  // (l'article part sans option, comme avant), sinon { libelle, options }.
  const [pdOptions, setPdOptions] = React.useState(null);
  const [pdOption, setPdOption] = React.useState(null);
  const [busyAdd, setBusyAdd] = React.useState(null); // id du produit dont on lit les options
  const pdReqRef = React.useRef(0);

  const load = React.useCallback(async (force) => {
    setError(false);
    try {
      const data = await loadShops('product_purchase', { force: force === true });
      setShops(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // La liste ne porte que 12 annonces par boutique : à l'ouverture de sa fiche,
  // son catalogue complet remplace ces annonces (rien ne change si la lecture échoue).
  const chargerCatalogue = React.useCallback((shop) => {
    if (!shop || !(shop.total > (shop.products || []).length)) return;
    getShopCatalogue('product_purchase', shop.id).then((products) => {
      if (!Array.isArray(products) || products.length <= (shop.products || []).length) return;
      setSelectedShop((cur) => (cur && cur.id === shop.id ? { ...cur, products } : cur));
      if (products.some((p) => p.options === undefined)) prefetchShopOptions(shop.id);
    }).catch(() => {});
  }, []);

  // Fiche demandée depuis Menus (Soir libre, courses) : ouvre la boutique donnée.
  React.useEffect(() => {
    const ouvrir = (shop) => {
      if (!shop) return;
      setSelectedProduct(null); setProductSearch(''); setSelectedShop(shop);
      if ((shop.products || []).some((p) => p.options === undefined)) prefetchShopOptions(shop.id);
      chargerCatalogue(shop);
    };
    ouvrir(takePendingShop());
    return onOpenShop(() => ouvrir(takePendingShop()));
  }, [chargerCatalogue]);

  // Boutiques favorites : même stockage que Comparer et Favoris (KEY_FAV_SHOPS,
  // tableau de noms).
  const [favShops, setFavShops] = React.useState([]);
  const loadFavShops = React.useCallback(async () => {
    try { const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS); const arr = raw ? JSON.parse(raw) : []; setFavShops(Array.isArray(arr) ? arr : []); }
    catch (e) { setFavShops([]); }
  }, []);
  React.useEffect(() => { if (visible) loadFavShops(); }, [visible, loadFavShops, favTick]);
  const isShopFav = (name) => favShops.includes(String(name || ''));
  const toggleShopFav = async (shop) => {
    try {
      const name = String(shop?.name || '');
      if (!name) return;
      // Relu juste avant l'écriture : un favori posé ailleurs n'est pas écrasé.
      const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
      const cur = raw ? JSON.parse(raw) : [];
      const set = new Set(Array.isArray(cur) ? cur : []);
      if (set.has(name)) set.delete(name); else set.add(name);
      const out = [...set];
      setFavShops(out);
      await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(out));
    } catch (e) {}
  };

  const onRefresh = () => { setRefreshing(true); load(true); };

  // `option` = option choisie (fiche à plusieurs options) ou prise d'office :
  // gardée dans l'article (`variant`) et envoyée à la création de la course.
  // Quantité plafonnée au stock de l'option (`maxQty`), sans message.
  // `note` = « Instructions spéciales » de la fiche, gardée sur la ligne panier
  // (champ `note`). Elle ne compte pas dans la fusion des lignes : une note
  // nouvelle s'ajoute à celle de la ligne existante.
  const addToCart = async (shop, product, qty = 1, option = null, note = '') => {
    try {
      const raw = await AsyncStorage.getItem(KEY_CART);
      const existing = raw ? (JSON.parse(raw) || []) : [];
      const variant = varianteDeLOption(option);
      const cap = option && option.stock !== null && option.stock !== undefined ? option.stock : null;
      const cle = cleVariante(variant);
      const idx = existing.findIndex(e => (product.id != null && e && e.productId != null)
        ? String(e.productId) === String(product.id) && cleVariante(e.variant) === cle
        : String(e.name || '').toLowerCase().trim() === String(product.name || '').toLowerCase().trim() &&
          String(e.shop || '').toLowerCase().trim() === String(shop.name || '').toLowerCase().trim()
      );
      if (idx >= 0) {
        existing[idx].qty = plafonner((existing[idx].qty || 1) + qty, cap);
        existing[idx].price = product.price || existing[idx].price;
        if (cap !== null) existing[idx].maxQty = cap;
        const n = String(note || '').trim();
        if (n) {
          const avant = String(existing[idx].note || '').trim();
          existing[idx].note = !avant ? n : (avant.split('\n').includes(n) ? avant : `${avant}\n${n}`);
        }
      } else {
        existing.push({
          name: product.name,
          detail: sousCategorie(product) || product.description || '',
          unitPrice: '',
          qty: qty,
          price: product.price || 0,
          shop: shop.name,
          shopId: shop.id,
          // productId réel → le serveur valide le vrai prix catalogue et résout
          // les coords boutique pour l'itinéraire livreur (createDeliveryOrder).
          productId: product.id,
          companyId: shop.id,
          image: product.image || '',
          category: shop.category || 'product_purchase',
          ...(variant ? { variant } : {}),
          ...(cap !== null ? { maxQty: cap } : {}),
          ...(String(note || '').trim() ? { note: String(note).trim() } : {}),
        });
      }
      await AsyncStorage.setItem(KEY_CART, JSON.stringify(existing));
      DeviceEventEmitter.emit('CART_UPDATED');
      setToast(`${product.name} : ${t('shops.added', 'ajouté au panier')}`);
      setTimeout(() => setToast(''), 1600);
    } catch (e) {}
  };

  // Fiche ouverte : options lues (liste, sinon boutique/fiche). Une seule
  // option non épuisée est prise d'office.
  const ouvrirFiche = (item, connues) => {
    setPdQty(1); setPdNote(''); setPdOption(null); setSelectedProduct(item);
    const req = ++pdReqRef.current;
    const appliquer = (o) => {
      if (req !== pdReqRef.current) return;
      setPdOptions(o || null);
      setPdOption(optionDOffice(o && o.options));
    };
    const deja = connues !== undefined ? connues : item.options;
    if (deja !== undefined) { appliquer(deja); return; }
    setPdOptions(undefined);
    getProductOptions(item.id, selectedShop?.id).then(appliquer, () => appliquer(null));
  };

  // Bouton « + » : produit simple ou option unique = ajout direct ; plusieurs
  // options (ou toutes épuisées) = la fiche s'ouvre pour choisir.
  const ajoutRapide = async (item) => {
    if (busyAdd != null) return;
    const shop = selectedShop;
    let o = item.options;
    if (o === undefined) {
      setBusyAdd(item.id);
      try { o = await getProductOptions(item.id, shop?.id); } catch (_) { o = null; }
      setBusyAdd(null);
    }
    const opts = o && Array.isArray(o.options) ? o.options : [];
    if (opts.length === 0) { addToCart(shop, item, 1); return; }
    const office = optionDOffice(opts);
    if (office) { addToCart(shop, item, 1, office); return; }
    ouvrirFiche(item, o);
  };

  const renderShopCard = ({ item }) => (
    <View style={shopStyles.card}>
    <TouchableOpacity activeOpacity={0.9} style={shopStyles.cardMain} onPress={() => { setSelectedProduct(null); setSelectedShop(item); setProductSearch(''); if ((item.products || []).some((p) => p.options === undefined)) prefetchShopOptions(item.id); chargerCatalogue(item); }}>
      <View style={shopStyles.cover}>
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={shopStyles.coverImg} resizeMode="cover" />
        ) : (
          <View style={[shopStyles.coverImg, shopStyles.coverPlaceholder]}>
            <Ionicons name="storefront" size={30} color={BRAND} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={shopStyles.shopName} numberOfLines={1}>{item.name}</Text>
        {item.address ? <Text style={shopStyles.shopAddr} numberOfLines={1}>{item.address}</Text> : null}
        <View style={shopStyles.badgeRow}>
          <View style={shopStyles.badge}><Text style={shopStyles.badgeTxt}>{t('counts.products', { count: item.total || item.products.length })}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
        </View>
      </View>
    </TouchableOpacity>
      {/* Cœur favori : frère de la zone de la carte (jamais un touchable dans un autre côté iOS). */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => toggleShopFav(item)}
        style={[shopStyles.favBtn, isShopFav(item.name) && shopStyles.favBtnOn]}
        accessibilityRole="button" accessibilityState={{ selected: isShopFav(item.name) }} accessibilityLabel={`${t('tabs.favorites')} ${item.name}`}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Ionicons name={isShopFav(item.name) ? 'heart' : 'heart-outline'} size={17} color={isShopFav(item.name) ? THEME.terra : THEME.muted} />
      </TouchableOpacity>
    </View>
  );

  const renderProduct = ({ item }) => (
    <View style={shopStyles.prodRow}>
      {/* Zone détail (image + texte) et bouton « + » = FRÈRES, jamais imbriqués
          (touchable dans touchable = onPress externe avalé sur iOS). */}
      <TouchableOpacity activeOpacity={0.7} style={shopStyles.prodMain}
        onPress={() => ouvrirFiche(item)}
        accessibilityRole="button" accessibilityLabel={item.name}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={shopStyles.prodImg} resizeMode="cover" />
        ) : (
          <View style={[shopStyles.prodImg, shopStyles.coverPlaceholder]}><Ionicons name="cube-outline" size={22} color={THEME.faint} /></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={shopStyles.prodName} numberOfLines={2}>{item.name}</Text>
          {item.subcategory ? <Text style={shopStyles.prodSub} numberOfLines={1}>{sousCategorie(item)}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={shopStyles.prodPrice}>{fmtPrice(item.price)}</Text>
            {item.promo ? <Text style={shopStyles.prodBase}>{fmtPrice(item.basePrice)}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
      {/* Restaurant au seul sur place : pas d'ajout au panier. */}
      {item.surPlaceSeul ? null : (
      <TouchableOpacity style={shopStyles.addBtn} onPress={() => ajoutRapide(item)} disabled={busyAdd != null}
        accessibilityRole="button" accessibilityLabel={`${t('cart.add', 'Ajouter')} ${item.name}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        {busyAdd === item.id ? <ActivityIndicator color="#1C1917" size="small" /> : <Ionicons name="add" size={22} color="#1C1917" />}
      </TouchableOpacity>
      )}
    </View>
  );

  // Filtres de recherche (boutiques + produits d'une boutique). Insensible à la casse.
  const _q = (s) => String(s || '').toLowerCase().trim();
  const boutiquesFiltrees = shopSearch.trim()
    ? shops.filter((s) => _q(s.name).includes(_q(shopSearch)) || _q(s.address).includes(_q(shopSearch))
      || (s.products || []).some((p) => _q(p.name).includes(_q(shopSearch))))
    : shops;
  // Favoris en tête, ordre d'origine gardé (tri stable), comme Comparer.
  const filteredShops = [...boutiquesFiltrees].sort((a, b) => (isShopFav(a.name) ? 0 : 1) - (isShopFav(b.name) ? 0 : 1));
  const _shopProducts = selectedShop?.products || [];
  const filteredProducts = productSearch.trim()
    ? _shopProducts.filter((p) => _q(p.name).includes(_q(productSearch)) || _q(sousCategorie(p)).includes(_q(productSearch)))
    : _shopProducts;

  return (
    <SafeAreaView style={shopStyles.screen} edges={integre ? [] : ['top']}>
      <View style={shopStyles.header}>
        <Text style={shopStyles.title}>{t('shops.title', 'Boutiques')}</Text>
        <Text style={shopStyles.subtitle}>{t('shops.subtitle', 'Achat de produits, click & collect ou livraison')}</Text>
      </View>

      {!loading && !error && shops.length > 0 ? (
        <View style={shopStyles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={THEME.faint} />
          <TextInput
            value={shopSearch}
            onChangeText={setShopSearch}
            placeholder={t('shops.searchShopPlaceholder', 'Rechercher une boutique...')}
            placeholderTextColor={THEME.faint}
            style={shopStyles.searchInput}
            returnKeyType="search"
          />
          {shopSearch.length > 0 ? (
            <TouchableOpacity onPress={() => setShopSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={THEME.faint} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <SqueletteBoutiques />
      ) : error ? (
        <View style={shopStyles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={THEME.faint} />
          <Text style={shopStyles.emptyTxt}>{t('shops.error', 'Impossible de charger les boutiques')}</Text>
          <TouchableOpacity style={shopStyles.retryBtn} onPress={() => { setLoading(true); load(true); }}>
            <Text style={shopStyles.retryTxt}>{t('shops.retry', 'Réessayer')}</Text>
          </TouchableOpacity>
        </View>
      ) : shops.length === 0 ? (
        <View style={shopStyles.center}>
          <Ionicons name="storefront-outline" size={40} color={THEME.faint} />
          <Text style={shopStyles.emptyTxt}>{t('shops.empty', 'Aucune boutique disponible')}</Text>
          <TouchableOpacity style={shopStyles.retryBtn} onPress={() => { setLoading(true); load(true); }}>
            <Text style={shopStyles.retryTxt}>{t('shops.retry', 'Réessayer')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredShops}
          keyExtractor={(s) => String(s.id)}
          renderItem={renderShopCard}
          extraData={favShops}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={shopSearch.trim() ? <Text style={[shopStyles.emptyTxt, { marginTop: 24 }]}>{t('shops.noShopMatch', 'Aucune boutique trouvée')}</Text> : null}
        />
      )}

      {/* Détail d'une boutique : ses vrais produits */}
      <Modal visible={!!selectedShop} animationType="slide" onRequestClose={() => { if (selectedProduct) setSelectedProduct(null); else setSelectedShop(null); }}>
        <View style={shopStyles.screen}>
          <View style={shopStyles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedShop(null)} style={shopStyles.backBtn}
              accessibilityRole="button" accessibilityLabel={t('profile.back', 'Retour')}>
              <Ionicons name="chevron-back" size={24} color={THEME.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={shopStyles.detailTitle} numberOfLines={1}>{selectedShop?.name}</Text>
              {selectedShop?.address ? <Text style={shopStyles.shopAddr} numberOfLines={1}>{selectedShop.address}</Text> : null}
            </View>
          </View>
          <View style={[shopStyles.searchWrap, { marginTop: 12 }]}>
            <Ionicons name="search-outline" size={18} color={THEME.faint} />
            <TextInput
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder={t('shops.searchProductPlaceholder', 'Rechercher un produit...')}
              placeholderTextColor={THEME.faint}
              style={shopStyles.searchInput}
              returnKeyType="search"
            />
            {productSearch.length > 0 ? (
              <TouchableOpacity onPress={() => setProductSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={THEME.faint} />
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={filteredProducts}
            keyExtractor={(p) => String(p.id)}
            renderItem={renderProduct}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 + INSET_BAS }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={[shopStyles.emptyTxt, { marginTop: 24 }]}>{productSearch.trim() ? t('shops.noProductMatch', 'Aucun produit trouvé') : t('shops.noProducts', 'Aucun produit')}</Text>}
          />
          {toast ? (
            <TouchableOpacity activeOpacity={0.8} style={shopStyles.toast}
              onPress={() => { setSelectedShop(null); navigation.navigate('cart'); }}
              accessibilityRole="button" accessibilityLabel={`${toast} · ${t('cart.viewCart')}`}>
              <Ionicons name="checkmark-circle" size={18} color="#1C1917" /><Text style={shopStyles.toastTxt}>{toast} · {t('cart.viewCart')}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Détail produit — page plein écran façon AppUser (overlay absolu
              DANS le modal boutique : évite le conflit de modals iOS). */}
          {selectedProduct ? (
            <View style={shopStyles.pdFull}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                <View style={shopStyles.pdHeroWrap}>
                  {selectedProduct?.image ? (
                    <Image source={{ uri: selectedProduct.image }} style={shopStyles.pdHero} resizeMode="cover" />
                  ) : (
                    <View style={[shopStyles.pdHero, shopStyles.coverPlaceholder]}><Ionicons name="cube-outline" size={54} color={THEME.faint} /></View>
                  )}
                  <TouchableOpacity onPress={() => setSelectedProduct(null)} style={shopStyles.pdCloseFloat}
                    accessibilityRole="button" accessibilityLabel={t('profile.close', 'Fermer')}>
                    <Ionicons name="close" size={22} color={THEME.ink} />
                  </TouchableOpacity>
                </View>
                <View style={shopStyles.pdBody}>
                  <Text style={shopStyles.pdName}>{selectedProduct?.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    <Text style={shopStyles.pdPrice}>{selectedProduct ? fmtPrice(selectedProduct.price) : ''}</Text>
                    {selectedProduct?.promo ? <Text style={shopStyles.pdBase}>{fmtPrice(selectedProduct.basePrice)}</Text> : null}
                  </View>
                  {selectedShop?.name ? <Text style={shopStyles.pdStore}>{selectedShop.name}</Text> : null}
                  {selectedShop?.address ? (
                    <View style={shopStyles.pdLocRow}>
                      <Ionicons name="location-outline" size={16} color={THEME.muted} />
                      <Text style={shopStyles.pdLocTxt} numberOfLines={2}>{selectedShop.address}</Text>
                    </View>
                  ) : null}
                  {selectedProduct?.subcategory ? <Text style={shopStyles.pdSub}>{sousCategorie(selectedProduct)}</Text> : null}
                  {selectedProduct?.description ? <Text style={shopStyles.pdDesc}>{selectedProduct.description}</Text> : null}
                  {/* Options de la fiche : pastilles simples, option épuisée grisée
                      et non sélectionnable. */}
                  {pdOptions && Array.isArray(pdOptions.options) && pdOptions.options.length > 0 ? (
                    <>
                      <Text style={shopStyles.pdSectionTitle}>{pdOptions.libelle || t('stock.option', 'Option')}</Text>
                      <View style={shopStyles.optWrap}>
                        {pdOptions.options.map((o, i) => {
                          const epuisee = optionEpuisee(o);
                          const on = !!pdOption && pdOption.title === o.title;
                          return (
                            <TouchableOpacity key={String(o.id ?? o.title) + ':' + i} activeOpacity={0.8} disabled={epuisee}
                              onPress={() => { setPdOption(o); setPdQty((q) => plafonner(q, o.stock)); }}
                              style={[shopStyles.optChip, on && shopStyles.optChipOn, epuisee && shopStyles.optChipOff]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on, disabled: epuisee }}
                              accessibilityLabel={epuisee ? `${o.title}, ${t('stock.soldOut', 'Épuisé')}` : o.title}>
                              <Text style={[shopStyles.optChipTxt, on && shopStyles.optChipTxtOn, epuisee && shopStyles.optChipTxtOff]} numberOfLines={1}>{o.title}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  <Text style={shopStyles.pdSectionTitle}>{t('shops.instructions', 'Instructions spéciales')}</Text>
                  <TextInput
                    value={pdNote}
                    onChangeText={setPdNote}
                    placeholder={t('shops.addComment', 'Ajouter un commentaire')}
                    placeholderTextColor={THEME.faint}
                    style={shopStyles.pdNoteInput}
                    multiline
                  />
                </View>
              </ScrollView>
              {selectedProduct && selectedProduct.surPlaceSeul ? null : (() => {
                // Plafond = stock de l'option choisie (null = non suivi).
                const opts = pdOptions && Array.isArray(pdOptions.options) ? pdOptions.options : [];
                const cap = pdOption && pdOption.stock !== null && pdOption.stock !== undefined ? pdOption.stock : null;
                const enLecture = pdOptions === undefined;
                const epuise = ficheEpuisee(opts);
                const aChoisir = opts.length > 1 && !pdOption;
                const bloque = enLecture || epuise || aChoisir;
                const auPlafond = cap !== null && pdQty >= cap;
                return (
              <View style={shopStyles.pdFooter}>
                <TouchableOpacity style={[shopStyles.pdQtyBtn, pdQty <= 1 && { opacity: 0.4 }]} onPress={() => setPdQty((q) => Math.max(1, q - 1))}
                  accessibilityRole="button" accessibilityLabel={t('cart.qtyMinus', 'moins')}>
                  <Ionicons name="remove" size={20} color={THEME.ink} />
                </TouchableOpacity>
                <TouchableOpacity style={[shopStyles.pdAddBig, bloque && shopStyles.pdAddBigOff]} activeOpacity={0.9} disabled={bloque}
                  onPress={() => { if (selectedProduct) { addToCart(selectedShop, selectedProduct, plafonner(pdQty, cap), pdOption, pdNote); } setSelectedProduct(null); }}
                  accessibilityRole="button" accessibilityState={{ disabled: bloque }} accessibilityLabel={t('cart.add', 'Ajouter')}>
                  {enLecture ? <ActivityIndicator color="#1C1917" /> : (
                    <Text style={shopStyles.pdAddBigTxt} numberOfLines={1}>
                      {epuise ? t('stock.soldOut', 'Épuisé') : aChoisir ? t('stock.chooseOption', 'Choisissez une option') : `${t('cart.add', 'Ajouter')} ${pdQty} · ${selectedProduct ? fmtPrice((Number(selectedProduct.price) || 0) * pdQty) : ''}`}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[shopStyles.pdQtyBtn, auPlafond && { opacity: 0.4 }]} onPress={() => setPdQty((q) => plafonner(q + 1, cap))}
                  accessibilityRole="button" accessibilityLabel={t('cart.qtyPlus', 'plus')}>
                  <Ionicons name="add" size={20} color={THEME.ink} />
                </TouchableOpacity>
              </View>
                );
              })()}
            </View>
          ) : null}
        </View>
      </Modal>

      {toast ? (
        <View style={shopStyles.toast}><Ionicons name="checkmark-circle" size={18} color="#1C1917" /><Text style={shopStyles.toastTxt}>{toast}</Text></View>
      ) : null}
    </SafeAreaView>
  );
};

const shopStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: TAILLES.marge, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: SERIF, fontWeight: '400', color: THEME.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 4, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTxt: { fontSize: 14, color: THEME.muted, marginTop: 12, fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 16, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, paddingHorizontal: 22, height: TAILLES.boutonPetit, borderRadius: TAILLES.rayonBouton, alignItems: 'center', justifyContent: 'center' },
  retryTxt: { color: THEME.ink, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  favBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, marginLeft: 10, alignSelf: 'flex-start' },
  favBtnOn: { borderColor: THEME.terra, backgroundColor: THEME.terraSoft },
  cover: { marginRight: 12 },
  coverImg: { width: 64, height: 64, borderRadius: 16, backgroundColor: THEME.subtle },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  shopName: { fontSize: 16, fontWeight: '600', color: THEME.ink },
  shopAddr: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  badge: { backgroundColor: THEME.terraSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { color: THEME.terraDark, fontSize: 12, fontWeight: '600' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 56, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: THEME.border },
  backBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  detailTitle: { fontSize: 18, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, flexShrink: 1 },
  prodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
  prodMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  prodImg: { width: 56, height: 56, borderRadius: 16, backgroundColor: THEME.subtle, marginRight: 12 },
  prodName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  prodSub: { fontSize: 11, color: THEME.faint, marginTop: 1, fontWeight: '600' },
  prodPrice: { fontSize: 15, fontWeight: '600', color: THEME.ink, marginTop: 3 },
  prodBase: { fontSize: 12, color: THEME.faint, marginLeft: 8, marginTop: 4, textDecorationLine: 'line-through' },
  addBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  toast: { position: 'absolute', bottom: 24, left: 24, right: 24, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', ...THEME.shadow },
  toastTxt: { color: THEME.ink, fontWeight: '700', marginLeft: 8, flex: 1 },
  // Barre de recherche (boutiques + produits)
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, paddingHorizontal: 12, height: TAILLES.champ, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderColor: THEME.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: THEME.ink, paddingVertical: 0 },
  // Pop-up détail produit
  pdOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  pdSheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: '86%' },
  pdClose: { alignSelf: 'flex-end', width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pdImg: { width: '100%', height: 230, borderRadius: 16, backgroundColor: THEME.subtle, marginBottom: 16 },
  pdName: { fontSize: 22, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.4 },
  pdSub: { fontSize: 13, color: THEME.muted, marginTop: 4, fontWeight: '600' },
  pdPrice: { fontSize: 24, fontWeight: '600', color: THEME.ink, marginTop: 10 },
  pdBase: { fontSize: 15, color: THEME.faint, marginLeft: 10, marginBottom: 3, textDecorationLine: 'line-through' },
  pdDesc: { fontSize: 14, color: THEME.muted, marginTop: 14, lineHeight: 21, fontWeight: '500' },
  pdShopRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  pdShopTxt: { fontSize: 13, color: THEME.muted, fontWeight: '700', marginLeft: 6, flex: 1 },
  pdAddBtn: { marginTop: 18, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, borderRadius: TAILLES.rayonBouton, height: TAILLES.bouton, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  pdAddTxt: { color: THEME.ink, fontSize: 16, fontWeight: '600', marginLeft: 8 },
  // Page détail produit plein écran (façon AppUser)
  pdFull: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: THEME.bg },
  pdHeroWrap: { width: '100%', height: 300, backgroundColor: THEME.subtle },
  pdHero: { width: '100%', height: '100%' },
  // top: 56 → sous la barre d'état (encoche/Dynamic Island), jamais dessous.
  pdCloseFloat: { position: 'absolute', top: 56, left: 16, width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', ...THEME.shadowSm, borderWidth: 1, borderColor: THEME.border },
  pdBody: { paddingHorizontal: 20, paddingTop: 18 },
  pdStore: { fontSize: 16, fontWeight: '600', color: THEME.ink, marginTop: 12 },
  pdLocRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pdLocTxt: { fontSize: 13, color: THEME.muted, fontWeight: '600', flex: 1, marginLeft: 6 },
  pdSectionTitle: { fontSize: 16, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, marginTop: 22, marginBottom: 8 },
  pdNoteInput: { minHeight: 96, borderWidth: 1, borderColor: THEME.border, borderRadius: 16, padding: 12, fontSize: 14, color: THEME.ink, textAlignVertical: 'top', backgroundColor: THEME.card },
  pdFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.card },
  pdQtyBtn: { width: TAILLES.bouton, height: TAILLES.bouton, borderRadius: TAILLES.bouton / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },
  pdAddBig: { flex: 1, marginHorizontal: 10, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, borderRadius: TAILLES.rayonBouton, height: TAILLES.bouton, alignItems: 'center', justifyContent: 'center' },
  pdAddBigTxt: { color: THEME.ink, fontSize: 16, fontWeight: '600' },
  pdAddBigOff: { opacity: 0.45 },
  // Pastilles d'options (fiche à plusieurs options)
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, maxWidth: '100%' },
  optChipOn: { borderColor: MARCHE.noir, backgroundColor: MARCHE.noir },
  optChipOff: { backgroundColor: THEME.subtle, borderColor: THEME.border, opacity: 0.5 },
  optChipTxt: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  optChipTxtOn: { color: MARCHE.blanc },
  optChipTxtOff: { color: THEME.faint },
});

export default ShopsScreen;
