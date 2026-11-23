import React from "react";
import { resolveCategoryId } from "../../services/products";
import { champsCommande, articleSansFiche, signaturePanier, etatCommandesEnAttente } from "../../lib/panier";
import { plafonner, ecartsDeStock, appliquerEcarts, refusDeStock, appliquerRefus, champsVariantePanier } from "../../lib/variantes";
import { clearCart, placeOrder, getMarketplaceOrderStatuses } from "../../services/orders";
import { fetchAddresses, createAddress } from "../../services/addresses";
import { getProfile } from "../../services/profile";
import { fetchPhotonSuggestions } from "../../lib/photon";
import { COUNTRIES } from "../../lib/countries";

// Téléphone du compte souvent enregistré avec l'indicatif (« 33647055417 » ou
// « +33 6 47… ») : on le sépare pour ne pas l'afficher deux fois.
const decouperTelephone = (raw, pays) => {
  const brut = String(raw || '').replace(/[^\d+]/g, '');
  const parDefaut = (COUNTRIES.find(c => c.name === pays)?.dial) || '+33';
  if (!brut) return { phone_code: parDefaut, phone_number: '' };
  const dials = COUNTRIES.map(c => c.dial).filter(Boolean).sort((a, b) => b.length - a.length);
  if (brut.startsWith('+')) {
    const d = dials.find(x => brut.startsWith(x));
    if (d) return { phone_code: d, phone_number: brut.slice(d.length) };
    return { phone_code: parDefaut, phone_number: brut };
  }
  const sansPlus = parDefaut.slice(1);
  if (brut.startsWith(sansPlus) && brut.length - sansPlus.length >= 8 && brut.length - sansPlus.length <= 10) {
    return { phone_code: parDefaut, phone_number: brut.slice(sansPlus.length) };
  }
  return { phone_code: parDefaut, phone_number: brut };
};
import { getSecureItem } from "../../services/secureStorage";
import { createDeliveryOrder, DELIVERY_STATUS } from "../../services/delivery";
// Paiement carte réel (Option A) : tunnel commande Marketplace + SDK Stripe natif.
import { addToCartApi, updateCartMetaApi, createOrderApi } from "../../services/payment";
import { estRefusSurPlaceSeul } from "../../lib/surPlaceSeul";
import { libelleDetail } from "../../lib/libelleDetail";
import { StripeAvailable } from "../../services/stripeNative";
import CardPaymentModal from "../../components/CardPaymentModal";
import { useTranslation } from "react-i18next";
import { DeviceEventEmitter } from "react-native";
import SearchPopup from "../../components/SearchPopup";
import Modal from "../../components/DeuxEcrans";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import { Ionicons } from "../../components/ui/IoniconsSens";
import RepeatButton from "../../components/ui/RepeatButton";
import { MARCHE, SERIF, TAILLES } from "../../components/ui/marche";
import { THEME } from "../../components/commun/theme";
import { useCurrency } from "../../components/commun/devise";
import { ProductThumb, ProductImage } from "../../components/commun/ProductImage";
import { KEY_CART, KEY_PENDING_PAYMENT, KEY_ORDER_HISTORY, KEY_PROFILE } from "../../lib/constants";
import { cartStyles } from "./cartStyles";
import OrderTracker from "./OrderTracker";
import { formatSavedAddress, formatAddressContact } from "./adresses";
import { useCommandes } from "./orders/useCommandes";
import { ListeCommandes } from "./orders/HistoriqueCommandes";
import { DetailCommande } from "./orders/DetailCommande";
import { prendreCommandeAOuvrir, trouverCommande, EVENEMENT_OUVRIR } from "../../services/pushToucher";

const SEARCH_MAP = require('../../data/search-map.json');

const CartScreen = ({ isAuth }) => {
  const { t, i18n } = useTranslation();
  const { fmtPrice } = useCurrency();
  const navigation = useNavigation();
  const [cartItems, setCartItems] = React.useState([]);
  const [orderVisible, setOrderVisible] = React.useState(false);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  // Popup intégrée (design app) affichée AU-DESSUS de la feuille Confirmer.
  // iOS n'empile pas 2 Modals → on la rend en overlay DANS le Modal confirm
  // (pas via un 2e Modal). { title, message, tone:'error'|'warning'|'info' }.
  const [popup, setPopup] = React.useState(null);
  const [placedOrder, setPlacedOrder] = React.useState(null); // snapshot de la commande passée (pour le suivi)
  const [placing, setPlacing] = React.useState(false);
  const placingRef = React.useRef(false); // garde d'idempotence anti double-création
  const [selectedCart, setSelectedCart] = React.useState({});
  const [orderMode, setOrderMode] = React.useState('delivery'); // 'delivery' | 'collect'
  const [cartSearchVisible, setCartSearchVisible] = React.useState(false);
  const [cartSearchShop, setCartSearchShop] = React.useState('');
  const [shopProductsVisible, setShopProductsVisible] = React.useState(false);
  const [shopProductsList, setShopProductsList] = React.useState([]);
  const [shopProductsSearch, setShopProductsSearch] = React.useState('');
  const [shopProductsName, setShopProductsName] = React.useState('');

  const openShopProducts = (shopName) => {
    // Build full product list from search-map
    const allProducts = [];
    const seen = new Set();
    const skipCategories = new Set(['fruits','legumes','viande','poisson','surgeles','boisson','petit dejeuner','hygiene','menage']);
    const keys = Object.keys(SEARCH_MAP).sort((a, b) => a.length - b.length);
    keys.forEach(key => {
      if (skipCategories.has(key)) return;
      const items = SEARCH_MAP[key];
      if (!items || !items.length) return;
      const p = items[0];
      if (seen.has(p.name)) return;
      seen.add(p.name);
      const inCart = cartItems.some(ci => ci.shop === shopName && String(ci.name||'').toLowerCase() === String(p.name||'').toLowerCase());
      allProducts.push({ ...p, inCart, qty: 1 });
    });
    // Also add other variants (2nd, 3rd products per key)
    Object.keys(SEARCH_MAP).forEach(key => {
      if (skipCategories.has(key)) return;
      const items = SEARCH_MAP[key];
      if (!items || items.length <= 1) return;
      items.slice(1).forEach(p => {
        if (seen.has(p.name)) return;
        seen.add(p.name);
        const inCart = cartItems.some(ci => ci.shop === shopName && String(ci.name||'').toLowerCase() === String(p.name||'').toLowerCase());
        allProducts.push({ ...p, inCart, qty: 1 });
      });
    });
    setShopProductsList(allProducts);
    setShopProductsName(shopName);
    setShopProductsSearch('');
    setShopProductsVisible(true);
  };
  const [addresses, setAddresses] = React.useState([]);
  const [addressesLoading, setAddressesLoading] = React.useState(false);
  const [selectedAddressId, setSelectedAddressId] = React.useState(null);
  const [addressPickerVisible, setAddressPickerVisible] = React.useState(false);
  // Formulaire « ce qui manque » ouvert par le bouton Continuer du panier.
  const [addrFormVisible, setAddrFormVisible] = React.useState(false);
  const [addrForm, setAddrForm] = React.useState({ first_name: '', last_name: '', phone_code: '+33', phone_number: '', house_building: '', pincode: '', city: '', countryFlag: 'FR', lat: null, lang: null });
  const [addrSaving, setAddrSaving] = React.useState(false);
  const [addrSugg, setAddrSugg] = React.useState([]);
  const addrSuggTimer = React.useRef(null);
  const [selectedDateIndex, setSelectedDateIndex] = React.useState(0);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [addProductShop, setAddProductShop] = React.useState(null); // shop name for add product popup
  const [addProductSearch, setAddProductSearch] = React.useState('');
  // Segment en haut de l'onglet : 'panier' ou 'commandes' (Mes commandes).
  const [vue, setVue] = React.useState('panier');
  // Historique, détail et suivi live des commandes (une seule instance : le
  // relevé livraison 30 s et le suivi 5 s du détail vivent ici).
  const mesCommandes = useCommandes(t);
  const { setDetailOrder, loadOrders } = mesCommandes;

  // Générer les 7 prochains jours (exclure aujourd'hui si aucun créneau dispo)
  const deliveryDays = React.useMemo(() => {
    const days = [];
    const joursSemaine = [t('cart.days.sun'), t('cart.days.mon'), t('cart.days.tue'), t('cart.days.wed'), t('cart.days.thu'), t('cart.days.fri'), t('cart.days.sat')];
    const mois = [t('cart.months.jan'), t('cart.months.feb'), t('cart.months.mar'), t('cart.months.apr'), t('cart.months.may'), t('cart.months.jun'), t('cart.months.jul'), t('cart.months.aug'), t('cart.months.sep'), t('cart.months.oct'), t('cart.months.nov'), t('cart.months.dec')];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      // Vérifier si aujourd'hui a des créneaux
      if (i === 0) {
        const now = new Date();
        const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        let sH = earliest.getHours();
        if (earliest.getMinutes() > 30) sH++;
        if (sH >= 22) continue; // Pas de créneau aujourd'hui, on skip
      }
      days.push({
        date: d,
        label: i === 0 ? t('cart.today') : i === 1 ? t('cart.tomorrow') : joursSemaine[d.getDay()],
        dayName: joursSemaine[d.getDay()],
        sub: d.getDate() + ' ' + mois[d.getMonth()],
      });
    }
    return days;
  }, [t]);

  // Générer créneaux de 30 min (de 8h à 22h, en partant de maintenant+2h si aujourd'hui)
  const deliverySlots = React.useMemo(() => {
    const slots = [];
    const day = deliveryDays[selectedDateIndex]?.date;
    if (!day) return slots;
    const now = new Date();
    const isToday = day.toDateString() === now.toDateString();
    let startHour = 8;
    let startMin = 0;
    if (isToday) {
      const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      startHour = earliest.getHours();
      startMin = earliest.getMinutes() >= 30 ? 30 : 0;
      if (earliest.getMinutes() > 30) { startHour++; startMin = 0; }
    }
    for (let h = startHour; h < 22; h++) {
      for (let m = (h === startHour ? startMin : 0); m < 60; m += 30) {
        const from = h.toString().padStart(2,'0') + 'h' + m.toString().padStart(2,'0');
        const toH = m === 30 ? h + 1 : h;
        const toM = m === 30 ? 0 : 30;
        const to = toH.toString().padStart(2,'0') + 'h' + toM.toString().padStart(2,'0');
        if (toH > 22) break;
        slots.push(from + ' - ' + to);
      }
    }
    return slots;
  }, [selectedDateIndex, deliveryDays]);

  // Auto-select earliest slot
  React.useEffect(() => {
    if (deliverySlots.length > 0 && !selectedSlot) {
      setSelectedSlot(deliverySlots[0]);
    }
  }, [deliverySlots]);

  // Profil du compte (adresse saisie à l'inscription) : adresse par défaut
  // quand le carnet est vide, et pré-remplissage du formulaire du panier.
  const profilCompteRef = React.useRef(null);
  const adresseCompteTenteeRef = React.useRef(false);

  const loadAddresses = React.useCallback(async () => {
    setAddressesLoading(true);
    try {
      const list = await fetchAddresses();
      let arr = Array.isArray(list) ? list : [];
      // Carnet vide : l'adresse du compte devient l'adresse par défaut
      // (enregistrée une seule fois dans le carnet, puis sélectionnée).
      if (arr.length === 0) {
        let prof = null;
        try { prof = await getProfile(); } catch (_) {}
        profilCompteRef.current = prof;
        if (!adresseCompteTenteeRef.current && prof && (prof.address || '').trim() && (prof.city || '').trim()) {
          adresseCompteTenteeRef.current = true;
          try {
            await createAddress({
              first_name: prof.prenom || prof.firstName || '', last_name: prof.nom || prof.lastName || '',
              ...decouperTelephone(prof.phone, prof.country),
              house_building: prof.address.trim(), road_area_colony: prof.addressSupplement || '',
              pincode: prof.postalCode || '', city: prof.city.trim(), state: '',
              address_type: 'home',
              countryFlag: (COUNTRIES.find(c => c.name === prof.country)?.code || 'FR'),
              lat: null, lang: null,
            });
            const relu = await fetchAddresses();
            arr = Array.isArray(relu) ? relu : [];
          } catch (_) {}
        }
      }
      setAddresses(arr);
      setSelectedAddressId((prev) => {
        if (prev != null && arr.some((a) => String(a.id) === String(prev))) return prev;
        const def = arr.find((a) => a.is_default) || arr[0];
        return def ? def.id : null;
      });
    } catch (e) {
      setAddresses([]);
    }
    setAddressesLoading(false);
  }, []);

  const selectedAddress = React.useMemo(
    () => addresses.find((a) => String(a.id) === String(selectedAddressId)) || null,
    [addresses, selectedAddressId],
  );
  const deliveryAddress = formatSavedAddress(selectedAddress);
  const recipient = formatAddressContact(selectedAddress);

  // Bouton « Continuer » sans adresse : formulaire pré-rempli avec ce que le
  // compte connaît déjà, il ne reste qu'à compléter ce qui manque.
  const ouvrirFormulaireAdresse = React.useCallback(async () => {
    let auth = null;
    try { const raw = await getSecureItem('KEY_AUTH'); auth = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!auth || !auth.id) { DeviceEventEmitter.emit('OPEN_AUTH'); return; }
    const p = profilCompteRef.current || {};
    setAddrForm({
      first_name: p.prenom || p.firstName || '', last_name: p.nom || p.lastName || '',
      ...decouperTelephone(p.phone, p.country),
      house_building: p.address || '', pincode: p.postalCode || '', city: p.city || '',
      countryFlag: (COUNTRIES.find(c => c.name === p.country)?.code || 'FR'), lat: null, lang: null,
    });
    setAddrSugg([]);
    // iOS n'empile pas deux Modal : la feuille « Confirmer » se ferme d'abord,
    // le formulaire suit, puis la feuille revient à la fermeture du formulaire.
    retourConfirmRef.current = true;
    setConfirmVisible(false);
    setTimeout(() => setAddrFormVisible(true), 450);
  }, []);
  const retourConfirmRef = React.useRef(false);
  React.useEffect(() => {
    if (addrFormVisible || addressPickerVisible || !retourConfirmRef.current) return;
    retourConfirmRef.current = false;
    setTimeout(() => setConfirmVisible(true), 450);
  }, [addrFormVisible, addressPickerVisible]);
  // Choix d'adresse depuis la feuille « Confirmer » : même règle, la feuille se
  // ferme, le choix s'ouvre, puis la feuille revient à sa fermeture.
  const ouvrirChoixAdresse = React.useCallback(() => {
    retourConfirmRef.current = true;
    setConfirmVisible(false);
    setTimeout(() => setAddressPickerVisible(true), 450);
  }, []);
  const setAF = (k, v) => setAddrForm(f => ({ ...f, [k]: v }));
  const onAddrRueChange = (v) => {
    setAF('house_building', v);
    if (addrSuggTimer.current) clearTimeout(addrSuggTimer.current);
    const q = (v || '').trim();
    if (q.length < 3) { setAddrSugg([]); return; }
    addrSuggTimer.current = setTimeout(async () => {
      try { setAddrSugg(await fetchPhotonSuggestions(q, (addrForm.countryFlag || 'FR').toUpperCase(), i18n.language)); } catch (_) {}
    }, 300);
  };
  const choisirSuggestion = (s) => {
    if (addrSuggTimer.current) clearTimeout(addrSuggTimer.current);
    setAddrForm(f => ({ ...f, house_building: s.address || s.label, pincode: s.postcode || f.pincode, city: s.city || f.city, lat: s.lat ?? f.lat, lang: s.lng ?? f.lang }));
    setAddrSugg([]);
  };
  const enregistrerAdresse = async () => {
    if (!addrForm.first_name.trim() || !addrForm.house_building.trim() || !addrForm.city.trim()) {
      Alert.alert(t('cart.deliveryAddress'), t('cart.addressRequiredMsg', 'Ajoutez une adresse de livraison pour continuer.'));
      return;
    }
    setAddrSaving(true);
    try {
      const cree = await createAddress({
        first_name: addrForm.first_name.trim(), last_name: addrForm.last_name.trim(),
        phone_code: (addrForm.phone_code || '').trim() || '+33', phone_number: addrForm.phone_number.trim(),
        house_building: addrForm.house_building.trim(), road_area_colony: '',
        pincode: addrForm.pincode.trim(), city: addrForm.city.trim(), state: '',
        address_type: 'home', countryFlag: addrForm.countryFlag || 'FR',
        lat: addrForm.lat, lang: addrForm.lang,
      });
      const newId = cree && (cree.id || (cree.data && cree.data.id));
      if (!newId) throw new Error('refus');
      setSelectedAddressId(newId);
      await loadAddresses();
      setAddrFormVisible(false);
    } catch (e) {
      Alert.alert(t('cart.deliveryAddress'), t('profile.addrSaveError', 'Could not save the address.'));
    }
    setAddrSaving(false);
  };
  const totalPrice = cartItems.reduce((sum, it, i) => selectedCart[i] ? sum + (Number(it.price || 0) * Number(it.qty || 1)) : sum, 0);

  const loadCart = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_CART);
      const arr = raw ? JSON.parse(raw) : [];
      const items = Array.isArray(arr) ? arr : [];
      setCartItems(items);
      // Auto-sélectionner tous les produits
      const sel = {};
      items.forEach((_, i) => { sel[i] = true; });
      setSelectedCart(sel);
    } catch(e) {
      setCartItems([]);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { loadCart(); loadAddresses(); loadOrders(); }, [loadCart, loadAddresses, loadOrders]));
  // Connexion demandée depuis « Confirmer » : la feuille s'ouvre d'elle-même
  // une fois connecté (l'intention n'est pas perdue).
  const veutConfirmerRef = React.useRef(false);
  // Panier quitté sans s'être connecté : l'intention est oubliée (une connexion
  // faite plus tard ailleurs n'ouvre pas la feuille « Confirmer »).
  useFocusEffect(React.useCallback(() => () => { veutConfirmerRef.current = false; }, []));
  React.useEffect(() => {
    if (!isAuth) return;
    loadOrders();
    if (veutConfirmerRef.current) {
      veutConfirmerRef.current = false;
      setTimeout(() => { setPopup(null); setConfirmVisible(true); }, 450);
    }
  }, [isAuth, loadOrders]);

  // À l'ouverture de la feuille « Confirmer », recharge les adresses : après une
  // connexion, l'écran panier ne reprend pas le focus (le login est un modal
  // par-dessus), donc le loadAddresses du focus ne rejoue pas → sans ça l'adresse
  // par défaut n'apparaît qu'après avoir ouvert puis fermé le sélecteur.
  React.useEffect(() => { if (confirmVisible) loadAddresses(); }, [confirmVisible, loadAddresses]);

  // Reload cart when products are added from Products screen
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('CART_UPDATED', loadCart);
    return () => sub.remove();
  }, [loadCart]);

  const removeFromCart = async (index) => {
    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
    // Sélection indexée par position : l'index retiré disparaît, les suivants
    // reculent d'un cran (sinon la coche passe à l'article voisin).
    setSelectedCart(prev => {
      const next = {};
      Object.keys(prev || {}).forEach(k => {
        const i = Number(k);
        if (!Number.isInteger(i) || i === index) return;
        next[i > index ? i - 1 : i] = prev[k];
      });
      return next;
    });
    await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
    DeviceEventEmitter.emit('CART_COUNT_CHANGED');
  };

  const updateQty = async (index, delta) => {
    const updated = cartItems.map((it, i) => {
      if (i !== index) return it;
      // Plafond = stock de l'option gardé à l'ajout (maxQty), sans message.
      return { ...it, qty: plafonner(Math.max(1, (it.qty || 1) + delta), it.maxQty) };
    });
    setCartItems(updated);
    await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
    DeviceEventEmitter.emit('CART_COUNT_CHANGED');
  };

  const clearCart = async () => {
    Alert.alert(
      t('cart.clearCart'),
      t('cart.clearCartConfirm'),
      [
        { text: t('listScreen.cancel'), style: "cancel" },
        { text: t('cart.clearCartBtn'), style: "destructive", onPress: async () => {
          setCartItems([]);
          setSelectedCart({});
          await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
          DeviceEventEmitter.emit('CART_COUNT_CHANGED');
        }}
      ]
    );
  };

  // Crée la commande AU MOMENT de la confirmation (plus au « Terminé » du suivi).
  // Conséquences : le suivi devient purement informatif, fermer la croix n'annule
  // plus rien silencieusement, on ne commande QUE les articles sélectionnés, et
  // les articles NON sélectionnés restent dans le panier (aucune perte).
  // Pourboire livreur choisi au checkout (0 par défaut). Réinitialisé quand le
  // panier change (évite de reporter un pourboire d'une commande à l'autre).
  const [deliveryTip, setDeliveryTip] = React.useState(0);
  // keepTipRef : liste relue après un refus de stock = même commande, le
  // pourboire choisi est gardé.
  const keepTipRef = React.useRef(false);
  React.useEffect(() => {
    if (keepTipRef.current) { keepTipRef.current = false; return; }
    setDeliveryTip(0);
  }, [cartItems]);

  // Lignes neutres des écarts de stock (« Quantité ajustée au stock : 2 au lieu
  // de 3 », « Épuisé, retiré de la commande »).
  const lignesStock = React.useCallback((lignes) => (Array.isArray(lignes) ? lignes : []).map((l) => {
    const base = l && l.name ? t('productNames.' + l.name, { defaultValue: l.name }) : '';
    const nom = base + (l && l.variant ? ` (${l.variant})` : '');
    const txt = l && l.type === 'adjusted'
      ? t('stock.adjusted', { qty: l.qty, requested: l.requested, defaultValue: 'Quantité ajustée au stock : {{qty}} au lieu de {{requested}}' })
      : t('stock.removed', 'Épuisé, retiré de la commande');
    return nom ? `${nom} · ${txt}` : txt;
  }), [t]);

  // Refus 409 de stock (« Épuisé » / « Cet article vient d'être vendu. ») :
  // message neutre et liste relue avec ce que dit le serveur (articles épuisés
  // décochés mais gardés, quantités ramenées à ce qui reste).
  const signalerRefusDeStock = React.useCallback(async (refus) => {
    const { items, selected, noms } = appliquerRefus(cartItems, selectedCart, refus);
    if (items.some((it, i) => it !== cartItems[i])) {
      keepTipRef.current = true;
      setCartItems(items);
      try { await AsyncStorage.setItem(KEY_CART, JSON.stringify(items)); } catch (_) {}
      DeviceEventEmitter.emit('CART_COUNT_CHANGED');
    }
    setSelectedCart(selected);
    setPopup({
      tone: 'info',
      title: refus && refus.epuise ? t('stock.soldOut', 'Épuisé') : t('stock.justSold', "Cet article vient d'être vendu."),
      message: [noms.join(', '), t('stock.cartUpdated', 'Panier mis à jour.')].filter(Boolean).join('\n'),
    });
  }, [cartItems, selectedCart, t]);

  // Construit le payload createDeliveryOrder (partagé entre la pré-création au
  // checkout — pour obtenir payable_orders — et la finalisation placeOrder, avec
  // le MÊME orderId → create-order est idempotent sur client_order_id, donc pas
  // de doublon).
  const buildDeliveryOrderArgs = React.useCallback(async (orderId) => {
    const selectedItems = cartItems.filter((_, i) => selectedCart[i]);
    const deliveryFee = orderMode === 'delivery' ? 9.99 : 0;
    const subtotal = selectedItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
    const shops = [...new Set(selectedItems.map(i => i.shop).filter(Boolean))];
    const selectedDay = deliveryDays[selectedDateIndex];
    const deliveryDateLabel = selectedDay ? ((selectedDay.dayName || selectedDay.label) + ' ' + selectedDay.sub) : '';
    let profile = {};
    try { const p = await getSecureItem(KEY_PROFILE); profile = p ? JSON.parse(p) : {}; } catch (e) {}
    const recipientName = selectedAddress ? [selectedAddress.first_name, selectedAddress.last_name].filter(Boolean).join(' ').trim() : '';
    const recipientPhone = selectedAddress ? [selectedAddress.phone_code, selectedAddress.phone_number].filter(Boolean).join(' ').trim() : '';
    return {
      id: orderId, shops, address: deliveryAddress, addressId: selectedAddressId,
      customerName: recipientName || ((profile.prenom || '') + ' ' + (profile.nom || '')).trim(),
      customerPhone: recipientPhone || profile.phone || '',
      dropoffLat: selectedAddress?.lat ?? null,
      dropoffLng: selectedAddress?.lang ?? null,
      items: selectedItems, total: subtotal + deliveryFee, deliveryFee,
      slot: selectedSlot || '', deliveryDate: deliveryDateLabel, mode: 'delivery',
      tip: orderMode === 'delivery' ? (deliveryTip || 0) : 0,
    };
  }, [cartItems, selectedCart, orderMode, deliveryDays, selectedDateIndex, deliveryAddress, selectedAddressId, selectedAddress, selectedSlot, deliveryTip]);

  const placeOrder = React.useCallback(async (backendOrderIds = [], opts = {}) => {
    const selectedItems = cartItems.filter((_, i) => selectedCart[i]);
    if (selectedItems.length === 0) return null;
    const deliveryFee = orderMode === 'delivery' ? 9.99 : 0;
    const selectedDay = deliveryDays[selectedDateIndex];
    const deliveryDateLabel = selectedDay ? ((selectedDay.dayName || selectedDay.label) + ' ' + selectedDay.sub) : '';
    const orderId = opts.orderId || Date.now();
    // Livraison → créer la course réelle pour l'app Livreur (Pearl Streets).
    // Idempotent sur orderId : si la course a déjà été pré-créée au checkout (pour
    // obtenir payable_orders), ce re-POST ne crée pas de doublon (update_or_create
    // côté serveur + garde `if created and not neworder_id`). Sa réponse dit ce
    // que la commande contient (quantités ramenées au stock, articles épuisés).
    let ecarts = opts.ecarts || null;
    if (orderMode === 'delivery') {
      try {
        ecarts = ecartsDeStock(await createDeliveryOrder(await buildDeliveryOrderArgs(orderId))) || ecarts;
      } catch (e) {
        const refus = refusDeStock(e);
        // Rien n'a été créé : message neutre, liste relue, aucune commande locale.
        if (refus && !opts.orderId) { await signalerRefusDeStock(refus); return false; }
        // Restaurant au seul sur place : aucune course créée, aucune commande locale.
        if (estRefusSurPlaceSeul(e)) {
          setPopup({ tone: 'info', title: t('cart.confirmOrder'), message: t('cart.onsiteOnly') });
          return false;
        }
      }
    }
    const { commandes, exclus, lignes } = appliquerEcarts(selectedItems, ecarts);
    if (commandes.length === 0) {
      await signalerRefusDeStock({ epuise: true, exclus: (ecarts && ecarts.exclus) || [], manques: [] });
      return false;
    }
    const subtotal = commandes.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
    const shops = [...new Set(commandes.map(i => i.shop).filter(Boolean))];
    const order = {
      id: orderId,
      date: new Date().toISOString(),
      items: commandes,
      total: subtotal + deliveryFee,
      subtotal,
      deliveryFee,
      shops,
      mode: orderMode,
      slot: selectedSlot || '',
      deliveryDate: deliveryDateLabel,
      address: orderMode === 'delivery' ? deliveryAddress : '',
      addressId: orderMode === 'delivery' ? selectedAddressId : null,
      deliveryStatus: orderMode === 'delivery' ? DELIVERY_STATUS.PENDING : null,
      // order_id(s) Marketplace créés par le tunnel carte → permet de relire le
      // VRAI statut backend (dont remboursement) via /users/orders-new/.
      marketplaceOrderIds: Array.isArray(backendOrderIds) ? backendOrderIds : [],
    };
    try {
      const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      history.unshift(order);
      await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(history));
    } catch (e) {}
    // Retirer du panier UNIQUEMENT les articles commandés (garder le reste) ;
    // un article épuisé, retiré de la commande, reste dans la liste, décoché.
    const horsCommande = new Set(exclus);
    const remaining = cartItems.filter((it, i) => !selectedCart[i] || horsCommande.has(it));
    setCartItems(remaining);
    const sel = {}; remaining.forEach((it, i) => { sel[i] = !horsCommande.has(it); });
    setSelectedCart(sel);
    await AsyncStorage.setItem(KEY_CART, JSON.stringify(remaining));
    DeviceEventEmitter.emit('CART_COUNT_CHANGED');
    setPlacedOrder({ items: commandes, total: subtotal + deliveryFee, mode: orderMode, orderNo: '#' + String(orderId).slice(-4), notices: lignesStock(lignes), paid: opts.paid === true, commande: order });
    loadOrders();
    return order;
  }, [cartItems, selectedCart, orderMode, selectedSlot, selectedDateIndex, deliveryDays, deliveryAddress, selectedAddress, selectedAddressId, buildDeliveryOrderArgs, signalerRefusDeStock, lignesStock, loadOrders, t]);

  // ===== Option A — paiement carte réel (le PRO reçoit la commande payée) =====
  const [cardModalVisible, setCardModalVisible] = React.useState(false);
  const [pendingPayment, setPendingPayment] = React.useState(null); // { orders:[{orderId,shopName}], totalLabel }

  // Mode choisi dans Comparer (navigate('cart', { mode, n })) : repris à l'arrivée,
  // jamais pendant un paiement en cours.
  const route = useRoute();
  const modeDemande = route && route.params ? route.params.mode : undefined;
  const modeDemandeN = route && route.params ? route.params.n : undefined;
  const cardModalVisibleRef = React.useRef(false);
  cardModalVisibleRef.current = cardModalVisible;
  React.useEffect(() => {
    if (modeDemande !== 'collect' && modeDemande !== 'delivery') return;
    if (cardModalVisibleRef.current || placingRef.current) return;
    setOrderMode(modeDemande);
  }, [modeDemande, modeDemandeN]);

  // Commandes en attente gardées avec la signature du contenu commandé
  // (articles cochés, quantités, mode) et enregistrées (KEY_PENDING_PAYMENT) :
  // après un rechargement du panier, l'app tuée ou un retour sur l'onglet, le
  // re-tap reprend les MÊMES commandes au lieu d'en recréer. Si le contenu
  // change vraiment, elles sont ignorées au tap : de nouvelles commandes cohérentes
  // sont créées (jamais payer une sélection périmée).
  const signatureCommande = React.useMemo(
    () => signaturePanier(cartItems.filter((_, i) => selectedCart[i]), orderMode),
    [cartItems, selectedCart, orderMode]
  );
  const enAttenteLuRef = React.useRef(false);
  React.useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY_PENDING_PAYMENT);
        const p = raw ? JSON.parse(raw) : null;
        if (vivant && p && typeof p === 'object' && Array.isArray(p.orders) && p.orders.length && p.sig) {
          setPendingPayment(prev => prev || p);
        }
      } catch (e) {}
      enAttenteLuRef.current = true;
    })();
    return () => { vivant = false; };
  }, []);
  React.useEffect(() => {
    if (!enAttenteLuRef.current) return;
    (pendingPayment
      ? AsyncStorage.setItem(KEY_PENDING_PAYMENT, JSON.stringify(pendingPayment))
      : AsyncStorage.removeItem(KEY_PENDING_PAYMENT)).catch(() => {});
  }, [pendingPayment]);
  // Déconnexion : les commandes en attente du compte sont oubliées.
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('USER_DATA_CLEARED', () => {
      setPendingPayment(null);
      AsyncStorage.removeItem(KEY_PENDING_PAYMENT).catch(() => {});
    });
    return () => sub.remove();
  }, []);
  // Commandes en attente encore valables pour le panier affiché (sinon null :
  // le contenu a changé). Vérifié au tap, jamais pendant un rechargement.
  const enAttenteValable = pendingPayment && Array.isArray(pendingPayment.orders)
    && pendingPayment.orders.length && pendingPayment.sig === signatureCommande ? pendingPayment : null;

  // Pré-étape carte. Retourne :
  //  'started' → commande(s) Marketplace créées + modal ouvert (le modal prend le relais) ;
  //  'error'   → tentative faite mais échec (alerte affichée) → NE PAS créer de commande locale ;
  //  'local'   → non applicable → l'appelant CONSERVE le flux LOCAL existant (Expo Go sans SDK,
  //              ou sélection contenant des items sans vrais ids Marketplace).
  const maybeStartCardCheckout = React.useCallback(async (enAttente = null) => {
    if (!StripeAvailable) return 'local';
    // Re-tap après annulation : réutilise les commandes déjà créées au lieu d'en
    // recréer (évite les commandes awaiting_payment fantômes). `enAttente` =
    // commandes encore valables pour ce panier (vérifiées par l'appelant).
    if (enAttente && Array.isArray(enAttente.orders) && enAttente.orders.length) {
      setCardModalVisible(true);
      return 'started';
    }
    const selectedItems = cartItems.filter((_, i) => selectedCart[i]);
    if (selectedItems.length === 0) return 'local';
    // Éligibles = items d'une vraie boutique (productId + companyId RÉELS).
    const eligible = selectedItems.filter(it => it && it.productId != null && it.companyId != null);
    // Tunnel carte uniquement si TOUS les items sélectionnés sont de vraies fiches
    // boutique : sinon on débiterait une partie et on enregistrerait le reste non payé.
    if (eligible.length === 0 || eligible.length !== selectedItems.length) return 'local';
    // Une commande Marketplace par boutique (invariant serveur mono-vendeur).
    const byCompany = {};
    eligible.forEach(it => { const k = String(it.companyId); (byCompany[k] = byCompany[k] || []).push(it); });
    // category_id NUMÉRIQUE requis dans l'URL order/create (résolu depuis le slug),
    // propre à CHAQUE boutique (un restaurant food_drink et une boutique product_purchase
    // dans la même commande groupée). Tout est résolu avant le moindre ajout au panier.
    const categoryOf = {};
    for (const k of Object.keys(byCompany)) {
      const cid = await resolveCategoryId(byCompany[k][0].category || 'product_purchase');
      // Vraies fiches mais catégorie introuvable : jamais de commande locale non payée.
      if (cid == null) {
        setPopup({ tone: 'error', title: t('cart.confirmOrder'), message: t('cart.orderCreateFailed', 'Impossible de créer la commande. Réessayez.') });
        return 'error';
      }
      categoryOf[k] = cid;
    }
    const otKeyInt = orderMode === 'delivery' ? 3 : 2;   // cart/add : INT
    const otKeyStr = orderMode === 'delivery' ? '3' : '2'; // update-meta : CLÉ STRING
    const orders = [];
    try {
      for (const k of Object.keys(byCompany)) {
        const group = byCompany[k];
        const companyId = group[0].companyId;
        for (const it of group) {
          // Option choisie (fiche à plusieurs options) : `selected_variant`, sinon
          // le serveur refuse la ligne (variant_required).
          const r = await addToCartApi({ product_id: it.productId, company_id: companyId, quantity: it.qty || 1, order_type_key: otKeyInt, ...champsVariantePanier(it.variant) });
          if (!r || r.status === false) throw Object.assign(new Error((r && r.message) || 'cart/add'), { refus: r });
        }
        if (orderMode === 'delivery' && selectedAddressId) {
          try { await updateCartMetaApi(companyId, otKeyStr, { new_order_type: 'Delivery', address_id: selectedAddressId }); } catch (_) {}
        }
        const body = {};
        if (orderMode === 'delivery' && selectedAddressId) body.address_id = selectedAddressId;
        const oc = await createOrderApi(companyId, categoryOf[k], body);
        const orderId = (oc && (oc.order_id || (oc.data && oc.data.order_id))) || null;
        if (!oc || oc.status === false || !orderId) throw Object.assign(new Error((oc && oc.message) || 'order/create'), { refus: oc });
        orders.push({ orderId, shopName: group[0].shop || '' });
      }
    } catch (e) {
      if (estRefusSurPlaceSeul(e)) setPopup({ tone: 'info', title: t('cart.confirmOrder'), message: t('cart.onsiteOnly') });
      else setPopup({ tone: 'error', title: t('cart.confirmOrder'), message: t('cart.orderCreateFailed', 'Impossible de créer la commande côté Marketplace. Réessayez.') });
      setPendingPayment(null);
      return 'error';
    }
    if (orders.length === 0) {
      setPopup({ tone: 'error', title: t('cart.confirmOrder'), message: t('cart.orderCreateFailed', 'Impossible de créer la commande. Réessayez.') });
      return 'error';
    }
    // Total INDICATIF : sous-total des prix catalogue réels (pas de frais inventés).
    // Le montant final (frais boutique/taxes) est calculé et débité côté serveur.
    const grand = eligible.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
    setPendingPayment({ orders, totalLabel: fmtPrice(grand), sig: signaturePanier(selectedItems, orderMode) });
    // NE PAS ouvrir le modal ici : la feuille "Confirmer" est encore présentée et
    // iOS n'empile pas deux Modals (le modal de paiement resterait invisible/bloqué).
    // L'appelant ferme la feuille PUIS ouvre le modal après un court délai.
    return 'started';
  }, [cartItems, selectedCart, orderMode, selectedAddressId, fmtPrice, t]);

  // Paiement réussi → on rejoue la confirmation LOCALE existante (historique +
  // course livreur + tracker), INCHANGÉE. La commande pro est désormais payée.
  const onCardPaySuccess = React.useCallback(async () => {
    setCardModalVisible(false);
    // Livraison : la course a été pré-créée au checkout (même orderId). Le paiement
    // vient de réussir → le backend a dispatché le livreur (signal). On finalise la
    // commande LOCALE avec ce MÊME orderId (idempotent, pas de doublon).
    if (pendingPayment && pendingPayment._delivery) {
      const did = pendingPayment.orderId;
      const ecartsCourse = pendingPayment.ecarts || null;
      setPendingPayment(null);
      const ok = await placeOrder([], { orderId: did, ecarts: ecartsCourse, paid: true });
      if (ok) { setConfirmVisible(false); setOrderVisible(true); }
      placingRef.current = false; setPlacing(false);
      return;
    }
    // Retrait (tunnel Marketplace) : capture les order_id AVANT de vider
    // pendingPayment, pour les attacher à la commande locale (relecture statut).
    const backendOrderIds = (pendingPayment && Array.isArray(pendingPayment.orders))
      ? pendingPayment.orders.map(o => o.orderId).filter(Boolean) : [];
    setPendingPayment(null);
    const ok = await placeOrder(backendOrderIds, { paid: true });
    if (ok) { setConfirmVisible(false); setOrderVisible(true); }
    placingRef.current = false; setPlacing(false);
  }, [placeOrder, pendingPayment]);

  const onCardPayCancel = React.useCallback(() => {
    setCardModalVisible(false);
    // On GARDE pendingPayment : un re-tap réutilise les commandes déjà créées
    // (évite les commandes awaiting_payment fantômes). Nettoyé si le panier change.
    placingRef.current = false; setPlacing(false);
  }, []);

  // Notification de commande touchée (services/pushToucher.js) : « Mes
  // commandes » puis le détail de la commande, retrouvée dans l'historique de
  // l'appareil. iOS n'empile pas deux Modal : une fenêtre ouverte est fermée
  // d'abord, le détail suit 300 ms plus tard. Paiement en cours : jamais
  // interrompu, la commande s'ouvre dès que la fenêtre de paiement se ferme.
  const autreModaleOuverte = React.useRef(false);
  autreModaleOuverte.current = orderVisible || confirmVisible || shopProductsVisible || addressPickerVisible || addrFormVisible
    || cartSearchVisible || mesCommandes.reorderVisible || mesCommandes.allOrdersVisible;
  const paiementEnCoursRef = React.useRef(false);
  paiementEnCoursRef.current = cardModalVisible;
  const commandePushEnAttente = React.useRef(null);
  const montrerCommande = React.useCallback((order) => {
    setVue('commandes');
    if (autreModaleOuverte.current) {
      setOrderVisible(false); setPlacedOrder(null);
      setConfirmVisible(false); setShopProductsVisible(false);
      setAddressPickerVisible(false); setAddrFormVisible(false); setCartSearchVisible(false);
      mesCommandes.setReorderVisible(false); mesCommandes.setAllOrdersVisible(false);
      setTimeout(() => setDetailOrder(order), 300);
    } else {
      setDetailOrder(order);
    }
  }, []);
  const ouvrirCommandeDepuisPush = React.useCallback(async () => {
    const cible = prendreCommandeAOuvrir() || commandePushEnAttente.current;
    if (!cible) return;
    if (paiementEnCoursRef.current) { commandePushEnAttente.current = cible; return; }
    commandePushEnAttente.current = null;
    const order = await trouverCommande(cible);
    if (!order) { setVue('commandes'); return; }
    montrerCommande(order);
  }, [montrerCommande]);
  // L'onglet peut ne pas être monté quand l'évènement part : la commande est
  // aussi prise au focus ci-dessous.
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVENEMENT_OUVRIR, () => { ouvrirCommandeDepuisPush(); });
    return () => sub.remove();
  }, [ouvrirCommandeDepuisPush]);
  useFocusEffect(React.useCallback(() => { ouvrirCommandeDepuisPush(); }, [ouvrirCommandeDepuisPush]));
  React.useEffect(() => {
    if (!cardModalVisible && commandePushEnAttente.current) ouvrirCommandeDepuisPush();
  }, [cardModalVisible, ouvrirCommandeDepuisPush]);
  // Ligne « Mes commandes » du Profil (EVT_OUVRIR_MES_COMMANDES) : vue Mes commandes.
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OUVRIR_MES_COMMANDES', () => { setVue('commandes'); loadOrders(); });
    return () => sub.remove();
  }, [loadOrders]);

  // « Suivre ma commande » du suivi après paiement : détail dans Mes commandes.
  const suivreCommande = React.useCallback(() => {
    const order = placedOrder && placedOrder.commande;
    setOrderVisible(false); setPlacedOrder(null);
    if (!order) return;
    setVue('commandes');
    loadOrders();
    setTimeout(() => setDetailOrder(order), 300);
  }, [placedOrder, loadOrders]);

  // Group cart items by shop (must be before early return to respect hooks order)
  const groupedCart = React.useMemo(() => {
    const groups = {};
    cartItems.forEach((item, index) => {
      const shop = item.shop || '__other__';
      if (!groups[shop]) groups[shop] = [];
      groups[shop].push({ ...item, _originalIndex: index });
    });
    return Object.entries(groups).map(([shop, items]) => ({ shop, items }));
  }, [cartItems]);

  const toggleShopSelection = (shopGroup) => {
    const indices = shopGroup.items.map(it => it._originalIndex);
    const allSelected = indices.every(i => selectedCart[i]);
    setSelectedCart(prev => {
      const next = { ...prev };
      indices.forEach(i => { next[i] = !allSelected; });
      return next;
    });
  };

  // Segment « Panier » / « Mes commandes », sous le titre.
  // Récap de la feuille Confirmer : paiement carte quand le tunnel carte prendra
  // la commande (build natif, toutes les lignes cochées sont de vraies fiches).
  const lignesCochees = cartItems.filter((_, i) => selectedCart[i]);
  const paiementParCarte = !!StripeAvailable && lignesCochees.length > 0 && !lignesCochees.some(articleSansFiche);
  const segmentVue = (
    <View style={[cartStyles.segment, { marginTop: 8, marginBottom: 6 }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setVue('panier')} accessibilityRole="button" accessibilityState={{ selected: vue === 'panier' }}
        style={[cartStyles.segBtn, vue === 'panier' && cartStyles.segBtnOn]}>
        <Ionicons name="cart-outline" size={16} color={vue === 'panier' ? THEME.terra : THEME.muted} />
        <Text style={[cartStyles.segTxt, vue === 'panier' && cartStyles.segTxtOn]}>{t('tabs.cart')}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => { setVue('commandes'); loadOrders(); }} accessibilityRole="button" accessibilityState={{ selected: vue === 'commandes' }}
        style={[cartStyles.segBtn, vue === 'commandes' && cartStyles.segBtnOn]}>
        <Ionicons name="receipt-outline" size={16} color={vue === 'commandes' ? THEME.terra : THEME.muted} />
        <Text style={[cartStyles.segTxt, vue === 'commandes' && cartStyles.segTxtOn]}>{t('cart.myOrders', 'Mes commandes')}</Text>
      </TouchableOpacity>
    </View>
  );
  const listeCommandes = <ListeCommandes commandes={mesCommandes} t={t} fmtPrice={fmtPrice} />;
  // Suivi après commande et détail d'une commande : montés dans les deux
  // rendus (panier vide ou non), au même endroit, pour ne pas les démonter
  // quand la commande vide le panier.
  const modalesCommandes = (
    <>
      <OrderTracker
        visible={orderVisible}
        items={placedOrder?.items || []}
        total={placedOrder?.total || 0}
        mode={placedOrder?.mode || orderMode}
        orderNo={placedOrder?.orderNo}
        notices={placedOrder?.notices}
        paid={!!placedOrder?.paid}
        onTrack={placedOrder && placedOrder.commande ? suivreCommande : undefined}
        onCancel={() => { setOrderVisible(false); if (placedOrder?.commande) setVue('commandes'); setPlacedOrder(null); }}
        onClose={() => { setOrderVisible(false); if (placedOrder?.commande) setVue('commandes'); setPlacedOrder(null); }}
      />
      <DetailCommande commandes={mesCommandes} t={t} fmtPrice={fmtPrice} navigation={navigation} apresRecommande={() => setVue('panier')} />
    </>
  );

  if (cartItems.length === 0) {
    return (
      <View style={cartStyles.screen}>
        <SafeAreaView style={cartStyles.screen} edges={['top']}>
          <View style={cartStyles.header}>
            <Text style={cartStyles.title}>{t('tabs.cart')}</Text>
            {vue !== 'commandes' ? <Text style={cartStyles.subtitle}>{t('counts.items', { count: 0 })}</Text> : null}
          </View>
          {segmentVue}
          {vue === 'commandes' ? listeCommandes : (
          <View style={cartStyles.empty}>
            <Text style={cartStyles.emptyTitle}>{t('cart.emptyCart')}</Text>
            <Text style={cartStyles.emptyHint}>{t('favorites.addFromBuy')}</Text>
          </View>
          )}
        </SafeAreaView>
        {modalesCommandes}
      </View>
    );
  }

  return (
    <View style={cartStyles.screen}>
    <SafeAreaView style={cartStyles.screen} edges={['top']}>
      {/* Header avec titre + poubelle */}
      <View style={cartStyles.header}>
        <View style={cartStyles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={cartStyles.title}>{t('tabs.cart')}</Text>
            {vue !== 'commandes' ? <Text style={cartStyles.subtitle}>{t('counts.items', { count: cartItems.reduce((s, it) => s + Number(it.qty || 1), 0) })}</Text> : null}
          </View>
          {vue === 'panier' ? (
          <TouchableOpacity onPress={clearCart} activeOpacity={0.8} style={cartStyles.clearBtn}>
            <Ionicons name="trash-outline" size={19} color={THEME.danger} />
          </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {segmentVue}
      {vue === 'commandes' ? listeCommandes : (<>
      <FlatList
        data={groupedCart}
        keyExtractor={(item, i) => item.shop + i}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 200 }}
        renderItem={({ item: group }) => {
          const allSelected = group.items.every(it => selectedCart[it._originalIndex]);
          const someSelected = group.items.some(it => selectedCart[it._originalIndex]);
          return (
          <View style={[cartStyles.card, someSelected && cartStyles.cardOn]}>
            {/* Shop header - shown once */}
            <TouchableOpacity activeOpacity={0.7} onPress={() => toggleShopSelection(group)}
              style={cartStyles.shopHead}>
              <TouchableOpacity onPress={() => toggleShopSelection(group)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <View style={[cartStyles.check, someSelected && cartStyles.checkOn]}>
                  {someSelected ? <Ionicons name="checkmark" size={15} color={MARCHE.blanc} /> : null}
                </View>
              </TouchableOpacity>
              <View style={cartStyles.shopIcon}>
                <Ionicons name="storefront" size={18} color={THEME.brand} />
              </View>
              <View style={{flex:1}}>
                <Text style={cartStyles.shopName}>{group.shop}</Text>
                <Text style={cartStyles.shopMeta}>
                  {t('counts.items', { count: group.items.reduce((s, it) => s + Number(it.qty || 1), 0) })} • {fmtPrice(group.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0))}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Products in this shop */}
            {group.items.map((item, pi) => {
              const idx = item._originalIndex;
              return (
              <TouchableOpacity key={idx} activeOpacity={0.9} onPress={() => setSelectedCart(prev => ({...prev, [idx]: !prev[idx]}))}
                style={[cartStyles.productRow, pi < group.items.length - 1 && cartStyles.productDivider]}>
                <TouchableOpacity onPress={() => setSelectedCart(prev => ({...prev, [idx]: !prev[idx]}))} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                  <View style={[cartStyles.check, !!selectedCart[idx] && cartStyles.checkOn]}>
                    {!!selectedCart[idx] ? <Ionicons name="checkmark" size={15} color={MARCHE.blanc} /> : null}
                  </View>
                </TouchableOpacity>
                <View style={{ marginLeft: 10 }}>
                  <ProductImage uri={item.image} name={item.name || item.title} size={44} />
                </View>
                <View style={cartStyles.productBody}>
                  <Text style={cartStyles.productName}>{t('productNames.' + (item.name || item.title), { defaultValue: item.name || item.title })}</Text>
                  {item.variant && item.variant.title ? <Text style={cartStyles.productDetail} numberOfLines={1}>{String(item.variant.title)}</Text> : null}
                  {item.detail ? <Text style={cartStyles.productDetail} numberOfLines={1}>{libelleDetail(item.detail, t)}</Text> : null}
                  <View style={cartStyles.stepper}>
                    <RepeatButton onPress={() => updateQty(idx, -1)} onLongAction={() => updateQty(idx, -1)} style={cartStyles.stepBtn}>
                      <Ionicons name="remove" size={16} color={THEME.ink} />
                    </RepeatButton>
                    <Text style={cartStyles.stepQty}>{item.qty || 1}</Text>
                    <RepeatButton onPress={() => updateQty(idx, 1)} onLongAction={() => updateQty(idx, 1)} style={cartStyles.stepBtn}>
                      <Ionicons name="add" size={16} color={THEME.ink} />
                    </RepeatButton>
                  </View>
                </View>
                <View style={cartStyles.productSide}>
                  <Text style={cartStyles.productPrice}>
                    {fmtPrice(Number(item.price || 0) * Number(item.qty || 1))}
                  </Text>
                  {item.unitPrice ? <Text style={cartStyles.productUnit}>{item.unitPrice}</Text> : null}
                  <TouchableOpacity onPress={() => removeFromCart(idx)} activeOpacity={0.8} style={cartStyles.productDelBtn}>
                    <Ionicons name="trash-outline" size={15} color={THEME.danger} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              );
            })}

            {/* Bouton ajouter produit */}
            <TouchableOpacity
              onPress={() => openShopProducts(group.shop)}
              activeOpacity={0.85}
              style={cartStyles.addMoreBtn}
            >
              <Ionicons name="add-circle-outline" size={18} color={THEME.brandDark} />
              <Text style={cartStyles.addMoreTxt}>{t('productsScreen.addProduct', 'Ajouter un produit')}</Text>
            </TouchableOpacity>

            {/* Shop subtotal */}
            <View style={cartStyles.subtotalRow}>
              <Text style={cartStyles.subtotalLabel}>{t('counts.items', { count: group.items.filter(it => selectedCart[it._originalIndex]).reduce((s, it) => s + Number(it.qty || 1), 0) })}</Text>
              <Text style={cartStyles.subtotalValue}>{fmtPrice(group.items.filter(it => selectedCart[it._originalIndex]).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0))}</Text>
            </View>
          </View>
          );
        }}
      />
      {Object.values(selectedCart).some(v => v) && (
      <View style={cartStyles.bottomWrap}>
        <View style={cartStyles.bottomRow}>
          <Text style={cartStyles.bottomCount}>{t('productsScreen.productsTotal')}</Text>
          <Text style={cartStyles.bottomCountVal}>{cartItems.filter((_, i) => selectedCart[i]).reduce((s, it) => s + Number(it.qty || 1), 0)}</Text>
        </View>
        <View style={[cartStyles.bottomRow, { marginTop: 6 }]}>
          <Text style={cartStyles.bottomTotalLabel}>{t('cart.subtotal')}</Text>
          <Text style={cartStyles.bottomTotalVal}>{fmtPrice(totalPrice)}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={() => { if (!isAuth) { veutConfirmerRef.current = true; DeviceEventEmitter.emit('OPEN_AUTH'); return; } setPopup(null); setConfirmVisible(true); }} style={cartStyles.cta}>
          <Ionicons name="bicycle" size={20} color="#1C1917" />
          <Text style={cartStyles.ctaTxt}>{t('cart.confirmOrder')}</Text>
        </TouchableOpacity>
      </View>
      )}
      </>)}

      {/* Modal de confirmation de commande */}
      <Modal onRequestClose={() => setConfirmVisible(false)} visible={confirmVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={cartStyles.sheetBackdrop}>
          <View style={[cartStyles.sheet, { maxHeight: '88%', paddingBottom: 36 }]}>
            {/* Header */}
            <View style={cartStyles.sheetGrabber} />
            <View style={cartStyles.sheetHeader}>
              <Text style={cartStyles.sheetTitle}>{t('cart.confirmOrder')}</Text>
              <TouchableOpacity onPress={() => setConfirmVisible(false)} activeOpacity={0.8} style={cartStyles.closeBtn}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            {/* Toggle Livraison / Click & Collect */}
            <View style={cartStyles.segment}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOrderMode('delivery')}
                style={[cartStyles.segBtn, orderMode === 'delivery' && cartStyles.segBtnOn]}
              >
                <Ionicons name="bicycle-outline" size={16} color={orderMode === 'delivery' ? THEME.terra : THEME.muted} />
                <Text style={[cartStyles.segTxt, orderMode === 'delivery' && cartStyles.segTxtOn]}>{t('cart.delivery')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOrderMode('collect')}
                style={[cartStyles.segBtn, orderMode === 'collect' && cartStyles.segBtnOn]}
              >
                <Ionicons name="bag-handle-outline" size={16} color={orderMode === 'collect' ? THEME.terra : THEME.muted} />
                <Text style={[cartStyles.segTxt, orderMode === 'collect' && cartStyles.segTxtOn]}>{t('productsScreen.clickAndCollect')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{paddingHorizontal:20, marginTop:4}} contentContainerStyle={{paddingBottom:10}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Résumé par magasin */}
              {(() => {
                const selected = cartItems.map((it, idx) => ({...it, _origIdx: idx})).filter((_, i) => selectedCart[i]);
                const grouped = {};
                selected.forEach(it => {
                  const shop = it.shop || '__other__';
                  if (!grouped[shop]) grouped[shop] = [];
                  grouped[shop].push(it);
                });
                return Object.entries(grouped).map(([shop, items], si) => (
                  <View key={si} style={cartStyles.shopBlock}>
                    <View style={cartStyles.shopBlockHead}>
                      <Ionicons name="storefront" size={16} color={THEME.brand} />
                      <Text style={cartStyles.shopBlockName}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                    </View>
                    {items.map((it, i) => (
                      <View key={i} style={[cartStyles.miniRow, i < items.length - 1 && cartStyles.productDivider]}>
                        <ProductImage uri={it.image} name={it.name || it.title} size={40} />
                        <View style={{flex:1, marginLeft:10}}>
                          <Text style={cartStyles.miniName}>{t('productNames.' + (it.name || it.title), { defaultValue: it.name || it.title })}</Text>
                          <Text style={cartStyles.miniPrice}>{fmtPrice(Number(it.price||0) * Number(it.qty||1))}</Text>
                        </View>
                        <View style={cartStyles.miniStepper}>
                          <RepeatButton
                            onPress={() => {
                              if ((it.qty || 1) <= 1) {
                                const newSelected = {...selectedCart};
                                delete newSelected[it._origIdx];
                                setSelectedCart(newSelected);
                                const remaining = Object.keys(newSelected).filter(k => newSelected[k]).length;
                                if (remaining === 0) setConfirmVisible(false);
                              } else {
                                keepTipRef.current = true;
                                updateQty(it._origIdx, -1);
                              }
                            }}
                            onLongAction={() => {
                              keepTipRef.current = true;
                              updateQty(it._origIdx, -1);
                            }}
                            style={(it.qty || 1) <= 1 ? cartStyles.miniStepBtnDel : cartStyles.miniStepBtn}
                          >
                            <Ionicons name={(it.qty || 1) <= 1 ? "trash-outline" : "remove"} size={14} color={(it.qty || 1) <= 1 ? THEME.danger : THEME.ink} />
                          </RepeatButton>
                          <Text style={cartStyles.miniStepQty}>{it.qty || 1}</Text>
                          <RepeatButton
                            onPress={() => {
                              keepTipRef.current = true;
                              updateQty(it._origIdx, 1);
                            }}
                            onLongAction={() => {
                              keepTipRef.current = true;
                              updateQty(it._origIdx, 1);
                            }}
                            style={cartStyles.miniStepBtn}
                          >
                            <Ionicons name="add" size={14} color={THEME.ink} />
                          </RepeatButton>
                        </View>
                      </View>
                    ))}
                    {/* Bouton ajouter produits */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setAddProductSearch('');
                        setCartItems(prev => prev.map(it => ({...it, _addQty: 0})));
                        setAddProductShop(shop);
                      }}
                      style={cartStyles.blockAddBtn}
                    >
                      <Ionicons name="add-circle-outline" size={15} color={THEME.ink} />
                      <Text style={cartStyles.blockAddTxt}>{t('cart.addProducts')}</Text>
                    </TouchableOpacity>
                    <View style={cartStyles.blockSubtotal}>
                      <Text style={cartStyles.blockSubLabel}>{t('cart.subtotal')} {shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                      <Text style={cartStyles.blockSubVal}>{fmtPrice(items.reduce((s,it) => s + Number(it.price||0) * Number(it.qty||1), 0))}</Text>
                    </View>
                  </View>
                ));
              })()}

              {/* Frais de livraison */}
              <View style={cartStyles.feeRow}>
                <Text style={cartStyles.feeLabel}>{orderMode === 'delivery' ? t('cart.deliveryFee') : t('cart.collectFee')}</Text>
                <Text style={orderMode === 'collect' ? cartStyles.feeValueFree : cartStyles.feeValue}>{orderMode === 'delivery' ? fmtPrice(9.99) : t('cart.free')}</Text>
              </View>

              {/* Adresse de livraison ou Click & Collect */}
              {orderMode === 'collect' && (
                <View style={cartStyles.infoCard}>
                  <View style={cartStyles.infoCardHead}>
                    <View style={cartStyles.infoIcon}>
                      <Ionicons name="storefront" size={18} color={THEME.brand} />
                    </View>
                    <View style={{marginLeft:10, flex:1}}>
                      <Text style={cartStyles.infoTitle}>{t('cart.storePickup')}</Text>
                      <Text style={cartStyles.infoSub}>{t('cart.readyIn1Hour')}</Text>
                    </View>
                  </View>
                  <Text style={cartStyles.infoNote}>{t('cart.presentAtDesk')}</Text>
                </View>
              )}
              {orderMode === 'delivery' && <View style={cartStyles.addrCard}>
                <View style={cartStyles.addrHeadRow}>
                  <View style={cartStyles.addrHeadLeft}>
                    <Ionicons name="location" size={18} color={THEME.brand} />
                    <Text style={cartStyles.addrTitle}>{t('cart.deliveryAddress')}</Text>
                  </View>
                  <TouchableOpacity onPress={ouvrirChoixAdresse}>
                    <Text style={cartStyles.addrEditTxt}>{selectedAddress ? t('cart.edit') : t('profile.addrAdd', 'Add New Address')}</Text>
                  </TouchableOpacity>
                </View>
                {selectedAddress ? (
                  <View style={cartStyles.addrDisplay}>
                    <View style={cartStyles.addrDisplayRow}>
                      <Ionicons name="home-outline" size={14} color={THEME.muted} />
                      <Text style={cartStyles.addrDisplayTxt}>{deliveryAddress}</Text>
                    </View>
                    {recipient ? (
                      <View style={[cartStyles.addrDisplayRow, { marginTop: 4 }]}>
                        <Ionicons name="person-outline" size={14} color={THEME.faint} />
                        <Text style={cartStyles.addrDisplaySub}>{recipient}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <TouchableOpacity onPress={ouvrirChoixAdresse} activeOpacity={0.7} style={cartStyles.addrDisplay}>
                    <View style={cartStyles.addrDisplayRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={THEME.faint} />
                      <Text style={cartStyles.addrDisplaySub}>{t('profile.addrEmpty', 'No saved address yet')}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>}

              {/* Créneau de livraison */}
              <View style={cartStyles.slotSection}>
                <View style={cartStyles.slotSectionHead}>
                  <View style={cartStyles.infoIcon}>
                    <Ionicons name="time" size={18} color={THEME.brand} />
                  </View>
                  <Text style={cartStyles.slotSectionTitle}>{t('cart.deliverySlot')}</Text>
                </View>

                {/* Sélecteur de jour - ligne horizontale */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
                  {deliveryDays.map((day, i) => {
                    const active = selectedDateIndex === i;
                    return (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.85}
                      onPress={() => { setSelectedDateIndex(i); setSelectedSlot(null); }}
                      style={[cartStyles.dayPill, active && cartStyles.dayPillOn]}
                    >
                      <Text style={[cartStyles.dayPillTxt, active && cartStyles.dayPillTxtOn]}>{day.label} {day.date.getDate()}</Text>
                    </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Créneaux groupés par période */}
                {deliverySlots.length > 0 ? (() => {
                  const periods = [
                    { label: t('cart.morning'), icon: 'sunny-outline', color: '#F59E0B', from: 8, to: 12 },
                    { label: t('cart.afternoon'), icon: 'partly-sunny-outline', color: '#F97316', from: 12, to: 18 },
                    { label: t('cart.evening'), icon: 'moon-outline', color: '#6366F1', from: 18, to: 23 },
                  ];
                  return periods.map((period, pi) => {
                    const periodSlots = deliverySlots.filter(s => {
                      const h = parseInt(s.split('h')[0]);
                      return h >= period.from && h < period.to;
                    });
                    if (periodSlots.length === 0) return null;
                    return (
                      <View key={pi} style={cartStyles.periodGroup}>
                        <View style={cartStyles.periodHead}>
                          <Ionicons name={period.icon} size={14} color={period.color} />
                          <Text style={cartStyles.periodLabel}>{period.label}</Text>
                        </View>
                        <View style={cartStyles.slotGrid}>
                          {periodSlots.map((slot, si) => {
                            const active = selectedSlot === slot;
                            return (
                            <TouchableOpacity
                              key={si}
                              activeOpacity={0.85}
                              onPress={() => setSelectedSlot(slot)}
                              style={[cartStyles.slotChip, { marginRight: (si % 3 < 2) ? '2.75%' : 0 }, active && cartStyles.slotChipOn]}
                            >
                              <Text style={[cartStyles.slotChipTxt, active && cartStyles.slotChipTxtOn]}>{slot}</Text>
                            </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  });
                })() : (
                  <View style={cartStyles.noSlots}>
                    <Ionicons name="time-outline" size={28} color={THEME.faint} />
                    <Text style={cartStyles.noSlotsTxt}>{t('cart.noSlots')}</Text>
                  </View>
                )}

              </View>

              {/* Total + résumé créneau */}
              <View style={cartStyles.totalsBox}>
                {selectedSlot && (
                  <View style={cartStyles.slotBanner}>
                    <Ionicons name="time" size={16} color={THEME.brand} />
                    <Text style={cartStyles.slotBannerDay}>
                      {deliveryDays[selectedDateIndex]?.label} {deliveryDays[selectedDateIndex]?.sub}
                    </Text>
                    <Text style={cartStyles.slotBannerTime}>{selectedSlot}</Text>
                  </View>
                )}
                <View style={cartStyles.totalRow}>
                  <Text style={cartStyles.totalLabel}>{t('cart.subtotal')}</Text>
                  <Text style={cartStyles.totalValue}>{fmtPrice(totalPrice)}</Text>
                </View>
                <View style={cartStyles.totalRow}>
                  <Text style={cartStyles.totalLabel}>{orderMode === 'delivery' ? t('cart.delivery') : t('cart.collect')}</Text>
                  <Text style={orderMode === 'collect' ? cartStyles.totalValueFree : cartStyles.totalValue}>{orderMode === 'delivery' ? fmtPrice(9.99) : t('cart.free')}</Text>
                </View>
                {orderMode === 'delivery' ? (
                  <View style={{ marginTop: 6, marginBottom: 2 }}>
                    <Text style={cartStyles.totalLabel}>{t('cart.tip', 'Pourboire livreur')}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      {[0, 1, 2, 3].map(v => (
                        <TouchableOpacity key={v} activeOpacity={0.85} onPress={() => setDeliveryTip(v)}
                          style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
                            borderColor: deliveryTip === v ? MARCHE.noir : THEME.border,
                            backgroundColor: deliveryTip === v ? MARCHE.noir : THEME.card }}>
                          <Text style={{ fontWeight: '700', fontSize: 13, color: deliveryTip === v ? MARCHE.blanc : THEME.ink }}>
                            {v === 0 ? t('cart.noTip', 'Aucun') : fmtPrice(v)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
                {orderMode === 'delivery' && deliveryTip > 0 ? (
                  <View style={cartStyles.totalRow}>
                    <Text style={cartStyles.totalLabel}>{t('cart.tip', 'Pourboire livreur')}</Text>
                    <Text style={cartStyles.totalValue}>{fmtPrice(deliveryTip)}</Text>
                  </View>
                ) : null}
                <View style={cartStyles.grandRow}>
                  <Text style={cartStyles.grandLabel}>{t('cart.total')}</Text>
                  <Text style={cartStyles.grandValue}>{fmtPrice(totalPrice + (orderMode === 'delivery' ? 9.99 + (deliveryTip || 0) : 0))}</Text>
                </View>
                <View style={[cartStyles.totalRow, { marginTop: 10, marginBottom: 0 }]}>
                  <Text style={cartStyles.totalLabel}>{t('cart.payment', 'Paiement')}</Text>
                  <Text style={cartStyles.totalValue}>{paiementParCarte ? t('cart.byCard', 'Par carte') : orderMode === 'collect' ? t('cart.payAtPickup', 'À payer au retrait') : t('cart.payAtDelivery', 'À payer à la livraison')}</Text>
                </View>
              </View>

              {/* Nombre articles */}
              <Text style={cartStyles.itemsCaption}>
                {t('counts.itemsSelected', { count: cartItems.filter((_, i) => selectedCart[i]).length })}
              </Text>
            </ScrollView>

            {/* Boutons */}
            <View style={cartStyles.sheetFooter}>
              {(() => {
                const missingAddress = orderMode === 'delivery' && !selectedAddress;
                // Le bouton reste TOUJOURS tappable (hors envoi) : sans créneau il
                // PRÉVIENT via la popup intégrée (« choisis un créneau ») au lieu
                // d'être grisé sans explication ; adresse manquante → sélecteur.
                const disabled = placing;
                return (
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={missingAddress ? t('auth.continue', 'Continuer') : t('cart.confirmOrder')}
                onPress={async () => {
                  // En livraison, une adresse est obligatoire (sinon le livreur
                  // n'a pas de destination) : « Continuer » ouvre le formulaire
                  // pré-rempli pour compléter ce qui manque.
                  if (orderMode === 'delivery' && !selectedAddress) {
                    ouvrirFormulaireAdresse();
                    return;
                  }
                  if (!selectedSlot) {
                    setPopup({ tone: 'warning', icon: 'time-outline', title: t('cart.slotRequired'), message: t('cart.slotRequiredMsg') });
                    return;
                  }
                  if (placingRef.current) return; // idempotence : ignore les taps rapides
                  placingRef.current = true;
                  setPlacing(true);
                  let cardRes = 'local';
                  try {
                    // Sécurité : un article sans vraie fiche (productId + companyId)
                    // ne peut être ni payé ni livré ; jamais de commande « réussie »
                    // enregistrée sans paiement réel.
                    if (cartItems.filter((_, i) => selectedCart[i]).some(articleSansFiche)) {
                      // Articles sans boutique (anciens paniers, catalogue local) : décochés,
                      // le reste du panier peut être commandé.
                      setSelectedCart(prev => {
                        const n = { ...prev };
                        cartItems.forEach((it, i) => { if (n[i] && articleSansFiche(it)) delete n[i]; });
                        return n;
                      });
                      setPopup({ tone: 'error', title: t('cart.confirmOrder'), message: t('cart.itemsWithoutShop') });
                      return;
                    }
                    // Commandes déjà créées pour ce même panier : statut serveur relu.
                    // Déjà payées (app tuée après le paiement) : on finalise sans
                    // repayer ; annulées : on en recrée ; sinon on les reprend.
                    let enAttente = enAttenteValable;
                    if (enAttente) {
                      let statuts = null;
                      try { statuts = await getMarketplaceOrderStatuses(); } catch (e) {}
                      const etat = etatCommandesEnAttente(enAttente.orders, statuts);
                      if (etat === 'payee') { await onCardPaySuccess(); return; }
                      if (etat === 'abandonnee') { setPendingPayment(null); enAttente = null; }
                    }
                    // LIVRAISON : la course est la source unique. On la pré-crée
                    // (createDeliveryOrder → NewOrders awaiting_payment) puis on
                    // encaisse ses payable_orders via le CardPaymentModal existant.
                    // Le paiement réussi dispatche le livreur (signal backend). On
                    // n'utilise PAS maybeStartCardCheckout ici (créerait un doublon).
                    if (orderMode === 'delivery' && StripeAvailable) {
                      // Re-tap après annulation : réutilise la course déjà créée
                      // (évite une 2e commande awaiting_payment orpheline).
                      if (enAttente && enAttente._delivery) {
                        cardRes = 'started';
                        setConfirmVisible(false);
                        setTimeout(() => setCardModalVisible(true), 450);
                        setPlacing(false);
                        return;
                      }
                      const did = Date.now();
                      let dres = null;
                      try {
                        dres = await createDeliveryOrder(await buildDeliveryOrderArgs(did));
                      } catch (e) {
                        // 409 de stock (« Épuisé » / « Cet article vient d'être
                        // vendu. ») : message neutre, liste relue, rien n'est créé.
                        const refus = refusDeStock(e);
                        if (refus) await signalerRefusDeStock(refus);
                        else if (estRefusSurPlaceSeul(e)) setPopup({ tone: 'info', title: t('cart.confirmOrder'), message: t('cart.onsiteOnly') });
                        else setPopup({ tone: 'error', title: t('cart.confirmOrder'), message: t('cart.orderCreateFailed', 'Impossible de créer la commande. Réessayez.') });
                        placingRef.current = false; setPlacing(false); return;
                      }
                      // Quantités ramenées au stock / articles épuisés (clés
                      // absentes des anciennes réponses : rien ne change).
                      const ecartsCourse = ecartsDeStock(dres);
                      const payable = (dres && dres.payable_orders) || [];
                      if (payable.length) {
                        const sel = cartItems.filter((_, i) => selectedCart[i]);
                        const { commandes: selCommandee, lignes: lignesCourse } = appliquerEcarts(sel, ecartsCourse);
                        const grand = selCommandee.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
                        setPendingPayment({
                          orders: payable.map(o => ({ orderId: o.order_id, shopName: o.shop || '' })),
                          totalLabel: fmtPrice(grand), _delivery: true, orderId: did,
                          ecarts: ecartsCourse, notices: lignesStock(lignesCourse),
                          sig: signaturePanier(sel, orderMode),
                        });
                        cardRes = 'started';
                        setConfirmVisible(false);
                        setTimeout(() => setCardModalVisible(true), 450);
                        setPlacing(false);
                        return; // le modal de paiement prend le relais
                      }
                      // Aucune commande pro à payer (items sans vraie fiche boutique)
                      // → flux LOCAL avec ce même orderId (course déjà créée, idempotent).
                      const okd = await placeOrder([], { orderId: did, ecarts: ecartsCourse });
                      if (okd) { setConfirmVisible(false); setOrderVisible(true); }
                      else if (okd !== false) { setPopup({ tone: 'info', title: t('cart.emptyCart'), message: t('favorites.addFromBuy') }); }
                      return;
                    }
                    // Option A : tente le paiement carte réel (crée la commande
                    // Marketplace + ouvre le modal). 'local' → flux local inchangé ;
                    // 'error' → déjà alerté, on ne crée PAS de commande locale conflictuelle.
                    cardRes = await maybeStartCardCheckout(enAttente);
                    if (cardRes === 'started') {
                      // Ferme la feuille "Confirmer" AVANT d'ouvrir le modal de paiement
                      // (iOS ne présente pas 2 Modals en même temps → sinon écran bloqué).
                      setConfirmVisible(false);
                      setTimeout(() => setCardModalVisible(true), 450);
                      setPlacing(false);
                      return; // le modal de paiement prend le relais
                    }
                    if (cardRes === 'error') return;
                    const ok = await placeOrder();
                    if (ok) { setConfirmVisible(false); setOrderVisible(true); }
                    else if (ok !== false) { setPopup({ tone: 'info', title: t('cart.emptyCart'), message: t('favorites.addFromBuy') }); }
                  } finally { if (cardRes !== 'started') { placingRef.current = false; setPlacing(false); } }
                }}
                style={[cartStyles.primaryBtn, missingAddress && { backgroundColor: MARCHE.noir, borderColor: MARCHE.noir }, disabled && cartStyles.primaryBtnDisabled]}
              >
                {placing ? <ActivityIndicator color="#1C1917" /> : missingAddress ? (
                  <Text style={[cartStyles.primaryBtnTxt, { color: MARCHE.blanc, marginLeft: 0 }]}>{t('auth.continue', 'Continuer')}</Text>
                ) : (<>
                  <Ionicons name="checkmark-circle" size={20} color="#1C1917" />
                  <Text style={cartStyles.primaryBtnTxt}>{t('cart.confirmOrder')}</Text>
                </>)}
              </TouchableOpacity>
                );
              })()}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setConfirmVisible(false)}
                style={cartStyles.ghostBtn}
              >
                <Text style={cartStyles.ghostBtnTxt}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Popup ajouter produits - overlay dans la modal */}
          {!!addProductShop && (
            <View style={cartStyles.sheetBackdrop}>
              <View style={[cartStyles.sheet, { maxHeight: '74%', paddingBottom: 36 }]}>
                <View style={cartStyles.sheetGrabber} />
                <View style={cartStyles.sheetHeader}>
                  <View style={cartStyles.sheetTitleRow}>
                    <Ionicons name="storefront" size={18} color={THEME.brand} />
                    <Text style={[cartStyles.sheetTitle, { fontSize: 18, marginLeft: 8 }]} numberOfLines={1}>{addProductShop}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAddProductShop(null)} activeOpacity={0.8} style={cartStyles.closeBtn}>
                    <Ionicons name="close" size={20} color={THEME.muted} />
                  </TouchableOpacity>
                </View>
                {/* Barre de recherche */}
                <View style={{paddingHorizontal:20, marginBottom:12}}>
                  <View style={cartStyles.searchWrap}>
                    <Ionicons name="search-outline" size={18} color={THEME.faint} />
                    <TextInput
                      value={addProductSearch}
                      onChangeText={setAddProductSearch}
                      placeholder={t('shops.searchProductPlaceholder', 'Rechercher un produit...')}
                      placeholderTextColor={THEME.faint}
                      style={cartStyles.searchInput}
                    />
                    {addProductSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setAddProductSearch('')}>
                        <Ionicons name="close-circle" size={18} color={THEME.faint} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <FlatList
                  data={cartItems.map((it, idx) => ({...it, _idx: idx})).filter(it => (it.shop || '__other__') === addProductShop && (!addProductSearch || (it.name || it.title || '').toLowerCase().includes(addProductSearch.toLowerCase())))}
                  keyExtractor={(it, i) => String(i)}
                  style={{paddingHorizontal:20}}
                  showsVerticalScrollIndicator={false}
                  renderItem={({item}) => {
                    const qty = item._addQty || 0;
                    const isAdded = qty > 0;
                    return (
                    <View style={[cartStyles.pickerRow, isAdded && cartStyles.pickerRowOn]}>
                      <ProductThumb name={item.name || item.title} size={40} />
                      <View style={cartStyles.pickerBody}>
                        <Text style={cartStyles.pickerName}>{t('productNames.' + (item.name || item.title), { defaultValue: item.name || item.title })}</Text>
                        <View style={cartStyles.pickerPriceRow}>
                          <Text style={cartStyles.pickerPrice}>{fmtPrice(Number(item.price||0))}</Text>
                        </View>
                      </View>
                      {qty === 0 ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => {
                            const updated = [...cartItems];
                            updated[item._idx] = {...updated[item._idx], _addQty: 1};
                            setCartItems(updated);
                          }}
                          style={cartStyles.pickerAddBtn}
                        >
                          <Ionicons name="add" size={20} color="#1C1917" />
                        </TouchableOpacity>
                      ) : (
                        <View style={cartStyles.pickerStepper}>
                          <RepeatButton
                            onPress={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: Math.max(0, (u[item._idx]._addQty || 0) - 1)}; return u; });
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: Math.max(0, (u[item._idx]._addQty || 0) - 1)}; return u; });
                            }}
                            style={cartStyles.pickerStepBtn}
                          >
                            <Ionicons name="remove" size={16} color={THEME.ink} />
                          </RepeatButton>
                          <Text style={cartStyles.pickerStepQty}>{qty}</Text>
                          <RepeatButton
                            onPress={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: (u[item._idx]._addQty || 0) + 1}; return u; });
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: (u[item._idx]._addQty || 0) + 1}; return u; });
                            }}
                            style={cartStyles.pickerStepBtn}
                          >
                            <Ionicons name="add" size={16} color={THEME.ink} />
                          </RepeatButton>
                        </View>
                      )}
                    </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={cartStyles.pickerEmpty}>
                      <Text style={cartStyles.pickerEmptyTxt}>{t('cart.noProductsInShop')}</Text>
                    </View>
                  }
                />
                {/* Résumé produits ajoutés */}
                {(() => {
                  const added = cartItems.filter(it => (it.shop || '__other__') === addProductShop && (it._addQty || 0) > 0);
                  if (added.length === 0) return null;
                  return (
                    <View style={cartStyles.addedSummary}>
                      <Text style={cartStyles.addedSummaryTitle}>{t('counts.productsSelected', { count: added.length })}</Text>
                      {added.map((it, i) => (
                        <Text key={i} style={cartStyles.addedSummaryLine}>• {it.name || it.title} x{it._addQty}</Text>
                      ))}
                    </View>
                  );
                })()}
                {/* Bouton Ajouter en bas */}
                <View style={{paddingHorizontal:20, paddingTop:10}}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      // Mettre à jour les quantités et sélectionner les produits avec _addQty > 0
                      const updated = [...cartItems];
                      const newSelected = {...selectedCart};
                      updated.forEach((it, idx) => {
                        if ((it.shop || '__other__') === addProductShop && it._addQty > 0) {
                          updated[idx] = {...it, qty: (it.qty || 1) + it._addQty, _addQty: 0};
                          newSelected[idx] = true;
                        }
                        if (it._addQty !== undefined) {
                          updated[idx] = {...updated[idx], _addQty: 0};
                        }
                      });
                      setCartItems(updated);
                      setSelectedCart(newSelected);
                      setAddProductShop(null);
                    }}
                    style={cartStyles.primaryBtn}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#1C1917" />
                    <Text style={cartStyles.primaryBtnTxt}>{t('cart.addToOrder')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {/* Popup intégrée (design app) — overlay DANS le Modal confirm.
              iOS n'empile pas 2 Modals : on rend un overlay absolu, pas un 2e Modal. */}
          {popup && (() => {
            const TONES = {
              error:   { c: THEME.danger, s: THEME.dangerSoft, i: 'alert-circle' },
              warning: { c: '#F59E0B',    s: '#FEF3C7',        i: 'time' },
              info:    { c: THEME.brand,  s: THEME.brandSoft,  i: 'information-circle' },
            };
            const tn = TONES[popup.tone] || TONES.info;
            return (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(46,28,18,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 60, elevation: 60 }}>
                <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setPopup(null)} />
                <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%', maxWidth: 340, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, borderRadius: 24, paddingTop: 26, paddingHorizontal: 22, paddingBottom: 16, alignItems: 'center', shadowColor: MARCHE.nuit, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tn.s, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Ionicons name={popup.icon || tn.i} size={32} color={tn.c} />
                  </View>
                  <Text style={{ fontFamily: SERIF, fontSize: 20, fontWeight: '400', color: THEME.ink, textAlign: 'center', marginBottom: 6 }}>{popup.title}</Text>
                  {!!popup.message && <Text style={{ fontSize: 14.5, lineHeight: 21, color: THEME.muted, textAlign: 'center', marginBottom: 20 }}>{popup.message}</Text>}
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setPopup(null)} style={{ alignSelf: 'stretch', backgroundColor: MARCHE.noir, borderRadius: TAILLES.rayonBouton, height: TAILLES.bouton, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: MARCHE.blanc, fontSize: 16, fontWeight: '700' }}>{t('common.ok', 'OK')}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
        </KeyboardAvoidingView>
      </Modal>



      {/* Paiement carte (Option A) — monté uniquement en build natif (StripeAvailable) */}
      {cardModalVisible && pendingPayment ? (
        <CardPaymentModal
          visible={cardModalVisible}
          orders={pendingPayment.orders}
          totalLabel={pendingPayment.totalLabel}
          notices={pendingPayment.notices}
          t={t}
          onSuccess={onCardPaySuccess}
          onCancel={onCardPayCancel}
        />
      ) : null}

      {/* Modal liste produits du shop */}
      <Modal onRequestClose={() => setShopProductsVisible(false)} visible={shopProductsVisible} animationType="none" transparent={true} page>
        <View style={cartStyles.sheetBackdrop}>
          <View style={[cartStyles.sheet, { maxHeight: '88%', paddingBottom: 36 }]}>
            <View style={cartStyles.sheetGrabber} />
            <View style={cartStyles.sheetHeader}>
              <View style={{flex:1}}>
                <Text style={[cartStyles.sheetTitle, { fontSize: 18 }]} numberOfLines={1}>{shopProductsName}</Text>
                <Text style={cartStyles.subtitle}>{t('counts.products', { count: shopProductsList.length })}</Text>
              </View>
              <TouchableOpacity onPress={() => setShopProductsVisible(false)} activeOpacity={0.8} style={cartStyles.closeBtn}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>

            {/* Barre de recherche */}
            <View style={{paddingHorizontal:20, paddingBottom:12}}>
              <View style={cartStyles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={THEME.faint} />
                <TextInput
                  value={shopProductsSearch}
                  onChangeText={setShopProductsSearch}
                  placeholder={t('favorites.searchProductPlaceholder', 'Rechercher un produit...')}
                  placeholderTextColor={THEME.faint}
                  style={cartStyles.searchInput}
                />
                {shopProductsSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setShopProductsSearch('')}>
                    <Ionicons name="close-circle" size={18} color={THEME.faint} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <FlatList
              data={shopProductsSearch.trim()
                ? shopProductsList.filter(p => (p.name||'').toLowerCase().includes(shopProductsSearch.toLowerCase().trim()))
                : shopProductsList
              }
              keyExtractor={(item, i) => item.name + i}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal:20, paddingBottom:16}}
              // Rien à montrer (catalogue vide ou recherche sans résultat) :
              // message et repli sur la recherche dans tous les produits.
              ListEmptyComponent={(
                <View style={cartStyles.pickerEmpty}>
                  <Ionicons name="search-outline" size={30} color={THEME.faint} />
                  <Text style={[cartStyles.pickerEmptyTxt, { marginTop: 8 }]}>{t('cart.noShopProductFound', 'Aucun produit trouvé pour cette boutique.')}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShopProductsVisible(false);
                      setCartSearchShop(shopProductsName);
                      setTimeout(() => setCartSearchVisible(true), 350);
                    }}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    style={[cartStyles.ghostBtn, { paddingHorizontal: 22, marginTop: 16, alignSelf: 'center' }]}
                  >
                    <Text style={cartStyles.ghostBtnTxt}>{t('cart.searchAllProducts', 'Rechercher dans tous les produits')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              renderItem={({item: product}) => (
                <View style={cartStyles.pickerRow}>
                  <ProductThumb name={product.name} size={40} />
                  <View style={cartStyles.pickerBody}>
                    <Text style={cartStyles.pickerName}>{product.name}</Text>
                    {product.detail ? <Text style={cartStyles.pickerDetail}>{libelleDetail(product.detail)}</Text> : null}
                    <View style={cartStyles.pickerPriceRow}>
                      <Text style={cartStyles.pickerPrice}>{fmtPrice(product.price||0)}</Text>
                      {product.unitPrice ? <Text style={cartStyles.pickerUnit}>{product.unitPrice}</Text> : null}
                    </View>
                  </View>
                  {product.inCart ? (
                    <View style={cartStyles.pickerInCart}>
                      <Ionicons name="checkmark-circle" size={14} color={THEME.muted} />
                      <Text style={cartStyles.pickerInCartTxt}>{t('cart.inCart', 'Dans le panier')}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={async () => {
                        const newItem = {
                          name: product.name, detail: product.detail || '',
                          unitPrice: product.unitPrice || '', qty: 1,
                          price: product.price || 0, shop: shopProductsName,
                          ...champsCommande(product),
                        };
                        const updated = [...cartItems, newItem];
                        setCartItems(updated);
                        // Sélection existante gardée, seul l'ajout est coché.
                        setSelectedCart(prev => ({ ...prev, [updated.length - 1]: true }));
                        await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
                        DeviceEventEmitter.emit('CART_COUNT_CHANGED');
                        // Mark as in cart
                        setShopProductsList(prev => prev.map(p => p.name === product.name ? {...p, inCart: true} : p));
                      }}
                      style={cartStyles.pickerAddPill}
                    >
                      <Ionicons name="add" size={16} color="#1C1917" />
                      <Text style={cartStyles.pickerAddPillTxt}>{t('cart.add', 'Ajouter')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Formulaire « Continuer » : compléter l'adresse de livraison manquante */}
      <Modal visible={addrFormVisible} animationType="none" transparent={true} onRequestClose={() => setAddrFormVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={cartStyles.sheetBackdrop}>
          <View style={[cartStyles.sheet, { maxHeight: '88%', paddingBottom: 32 }]}>
            <View style={cartStyles.sheetGrabber} />
            <View style={cartStyles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[cartStyles.sheetTitle, { fontSize: 18 }]}>{t('cart.deliveryAddress')}</Text>
              </View>
              <TouchableOpacity onPress={() => setAddrFormVisible(false)} activeOpacity={0.8} style={cartStyles.closeBtn}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={cartStyles.addrFieldLabel}>{t('profile.firstName')}</Text>
                  <TextInput value={addrForm.first_name} onChangeText={(v) => setAF('first_name', v)} placeholderTextColor={THEME.faint} style={cartStyles.addrInput} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={cartStyles.addrFieldLabel}>{t('profile.lastName')}</Text>
                  <TextInput value={addrForm.last_name} onChangeText={(v) => setAF('last_name', v)} placeholderTextColor={THEME.faint} style={cartStyles.addrInput} />
                </View>
              </View>
              <Text style={[cartStyles.addrFieldLabel, { marginTop: 12 }]}>{t('profile.addrPhone')}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput value={addrForm.phone_code} onChangeText={(v) => setAF('phone_code', v)} placeholder="+33" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[cartStyles.addrInput, { width: 88 }]} />
                <TextInput value={addrForm.phone_number} onChangeText={(v) => setAF('phone_number', v)} placeholder="6 12 34 56 78" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[cartStyles.addrInput, { flex: 1 }]} />
              </View>
              <Text style={[cartStyles.addrFieldLabel, { marginTop: 12 }]}>{t('profile.street')}</Text>
              <TextInput value={addrForm.house_building} onChangeText={onAddrRueChange} placeholder={t('auth.addressAutoPlaceholder', 'Commencez à taper votre adresse…')} placeholderTextColor={THEME.faint} autoCorrect={false} style={cartStyles.addrInput} />
              {addrSugg.length > 0 && (
                <View style={cartStyles.addrSuggestBox}>
                  {addrSugg.map((s, i) => (
                    <TouchableOpacity key={i} onPress={() => choisirSuggestion(s)} activeOpacity={0.7}
                      style={[cartStyles.addrSuggestRow, i < addrSugg.length - 1 && { borderBottomWidth: 1, borderBottomColor: THEME.border }]}>
                      <Ionicons name="location-outline" size={16} color={THEME.brand} />
                      <Text style={[cartStyles.addrSuggestTxt, { flex: 1 }]} numberOfLines={2}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={cartStyles.addrFieldLabel}>{t('profile.postalCode')}</Text>
                  <TextInput value={addrForm.pincode} onChangeText={(v) => setAF('pincode', v)} keyboardType="number-pad" placeholderTextColor={THEME.faint} style={cartStyles.addrInput} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={cartStyles.addrFieldLabel}>{t('profile.city')}</Text>
                  <TextInput value={addrForm.city} onChangeText={(v) => setAF('city', v)} placeholderTextColor={THEME.faint} style={cartStyles.addrInput} />
                </View>
              </View>
              <TouchableOpacity onPress={enregistrerAdresse} disabled={addrSaving} activeOpacity={0.9} style={[cartStyles.addrSaveBtn, { flex: 0, marginTop: 18 }]}>
                {addrSaving ? <ActivityIndicator color={MARCHE.blanc} /> : <Text style={cartStyles.addrSaveTxt}>{t('auth.continue', 'Continuer')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal sélection adresse de livraison */}
      <Modal visible={addressPickerVisible} animationType="none" transparent={true} onRequestClose={() => setAddressPickerVisible(false)}>
        <View style={cartStyles.sheetBackdrop}>
          <View style={[cartStyles.sheet, { maxHeight: '82%', paddingBottom: 32 }]}>
            <View style={cartStyles.sheetGrabber} />
            <View style={cartStyles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[cartStyles.sheetTitle, { fontSize: 18 }]}>{t('cart.deliveryAddress')}</Text>
                <Text style={cartStyles.subtitle}>{t('profile.addrSelect', 'Select delivery address')}</Text>
              </View>
              <TouchableOpacity onPress={() => setAddressPickerVisible(false)} activeOpacity={0.8} style={cartStyles.closeBtn}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            {addressesLoading && addresses.length === 0 ? (
              <View style={{ paddingVertical: 44, alignItems: 'center' }}>
                <ActivityIndicator color={THEME.brand} />
              </View>
            ) : addresses.length === 0 ? (
              <View style={cartStyles.pickerEmpty}>
                <Ionicons name="location-outline" size={30} color={THEME.faint} />
                <Text style={[cartStyles.pickerEmptyTxt, { marginTop: 8 }]}>{t('profile.addrEmpty', 'No saved address yet')}</Text>
                <TouchableOpacity
                  onPress={() => {
                    retourConfirmRef.current = false;
                    setAddressPickerVisible(false);
                    setConfirmVisible(false);
                    navigation.navigate('profile');
                    // Le Profil ouvre son formulaire d'adresse (laissé le temps
                    // de monter l'onglet et de fermer la feuille).
                    setTimeout(() => DeviceEventEmitter.emit('OUVRIR_ADRESSES'), 450);
                  }}
                  activeOpacity={0.9}
                  style={[cartStyles.addrSaveBtn, { flex: 0, paddingHorizontal: 22, marginTop: 16 }]}
                >
                  <Text style={cartStyles.addrSaveTxt}>{t('profile.addrAdd', 'Add New Address')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                {addresses.map((item) => {
                  const isOn = String(item.id) === String(selectedAddressId);
                  const isWork = item.address_type === 'work';
                  const line = formatSavedAddress(item);
                  const who = formatAddressContact(item);
                  return (
                    <TouchableOpacity
                      key={String(item.id)}
                      activeOpacity={0.85}
                      onPress={() => { setSelectedAddressId(item.id); setAddressPickerVisible(false); }}
                      style={[cartStyles.pickerRow, isOn && cartStyles.pickerRowOn]}
                    >
                      <View style={cartStyles.infoIcon}>
                        <Ionicons name={isWork ? 'briefcase' : 'home'} size={16} color={THEME.brand} />
                      </View>
                      <View style={cartStyles.pickerBody}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={cartStyles.pickerName}>{isWork ? t('profile.addrWork', 'Work') : t('profile.addrHome', 'Home')}</Text>
                          {item.is_default && (
                            <View style={cartStyles.addrPickBadge}>
                              <Text style={cartStyles.addrPickBadgeTxt}>{t('profile.addrDefault', 'Default')}</Text>
                            </View>
                          )}
                        </View>
                        {!!who && <Text style={cartStyles.addrDisplaySub} numberOfLines={1}>{who}</Text>}
                        {!!line && <Text style={cartStyles.pickerDetail} numberOfLines={2}>{line}</Text>}
                      </View>
                      {isOn
                        ? <Ionicons name="checkmark-circle" size={22} color={THEME.terra} />
                        : <Ionicons name="ellipse-outline" size={22} color={THEME.borderInput} />}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() => {
                    retourConfirmRef.current = false;
                    setAddressPickerVisible(false);
                    setConfirmVisible(false);
                    navigation.navigate('profile');
                    // Le Profil ouvre son formulaire d'adresse (laissé le temps
                    // de monter l'onglet et de fermer la feuille).
                    setTimeout(() => DeviceEventEmitter.emit('OUVRIR_ADRESSES'), 450);
                  }}
                  activeOpacity={0.9}
                  style={[cartStyles.addrSaveBtn, { flex: 0, paddingHorizontal: 22, marginTop: 16 }]}
                >
                  <Text style={cartStyles.addrSaveTxt}>{t('profile.addrAdd', 'Add New Address')}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* SearchPopup pour ajouter produit dans le panier */}
      <SearchPopup
        visible={cartSearchVisible}
        initialQuery=""
        shopName={cartSearchShop}
        onClose={() => setCartSearchVisible(false)}
        onSelect={async (product) => {
          const newItem = {
            name: product.name,
            detail: product.detail || product.subtitle || '',
            unitPrice: product.unitPrice || product.pricePerKg || '',
            qty: product.qty || 1,
            price: product.price || 0,
            shop: cartSearchShop,
            ...champsCommande(product),
          };
          const updated = [...cartItems, newItem];
          setCartItems(updated);
          // Sélection existante gardée, seul l'ajout est coché.
          setSelectedCart(prev => ({ ...prev, [updated.length - 1]: true }));
          await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
          DeviceEventEmitter.emit('CART_COUNT_CHANGED');
          setCartSearchVisible(false);
        }}
      />
    </SafeAreaView>
    {modalesCommandes}
    </View>
  );
};

export default CartScreen;
