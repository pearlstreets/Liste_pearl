import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, Modal, ScrollView, Alert, Animated, Platform, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DeviceEventEmitter, KeyboardAvoidingView } from 'react-native';
import SearchPopup from '../components/SearchPopup';
import { Square } from '../components/Square';
import { RepeatButton } from '../components/RepeatButton';
import { Toast } from '../components/Toast';
import { BRAND, GUTTER } from '../constants/brand';
import { KEY_CART, KEY_ORDER_HISTORY, KEY_SELECTED, KEY_ITEMS, KEY_PROFILE } from '../constants/storageKeys';
import { ProductThumb } from '../constants/productImages';
import CurrencyContext from '../context/CurrencyContext';
import { useCartEvents } from '../context/CartContext';
import { styles } from '../styles/shared';
import { getCart, saveCart, clearCart as clearCartService, placeOrder, syncOrderToBackend } from '../services/orders';
import { createDeliveryOrder, DELIVERY_STATUS, getDeliveryStatusInfo } from '../services/delivery';
import { PaymentModal } from '../components/ui/PaymentSheet';
import { STRIPE_PUBLISHABLE_KEY } from '../services/stripe';

const useCurrency = () => React.useContext(CurrencyContext);

const SEARCH_MAP = require('../data/search-map.json');

// Simulated order tracking modal
const OrderTracker = ({ visible, onClose, onCancel, items, total, mode }) => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const isCollect = mode === 'collect';
  const steps = isCollect ? [
    { icon: "checkmark-circle", label: t('orderStatus.confirmed'), delay: 0 },
    { icon: "storefront", label: t('orderStatus.preparing'), delay: 2500 },
    { icon: "bag-handle", label: t('orderStatus.ready'), delay: 6000 },
    { icon: "walk", label: t('orderStatus.waitingPickup'), delay: 10000 },
    { icon: "checkmark-done", label: t('orderStatus.collected'), delay: 13000 },
  ] : [
    { icon: "checkmark-circle", label: t('orderStatus.confirmed'), delay: 0 },
    { icon: "storefront", label: t('orderStatus.preparing'), delay: 2500 },
    { icon: "bicycle", label: t('orderStatus.onTheWay'), delay: 6000 },
    { icon: "location", label: t('orderStatus.almostThere'), delay: 10000 },
    { icon: "home", label: t('orderStatus.delivered'), delay: 13000 },
  ];
  const [currentStep, setCurrentStep] = React.useState(0);
  const [orderNumber] = React.useState(() => "SG-" + Math.floor(10000 + Math.random() * 90000));
  const [eta, setEta] = React.useState(25);

  React.useEffect(() => {
    if (!visible) { setCurrentStep(0); setEta(25); return; }
    const timers = steps.map((s, i) => {
      if (i === 0) return null;
      return setTimeout(() => setCurrentStep(i), s.delay);
    });
    // ETA countdown
    const interval = setInterval(() => {
      setEta(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => { timers.forEach(t => t && clearTimeout(t)); clearInterval(interval); };
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111' }}>{t('cart.orderTracking')}</Text>
            <TouchableOpacity onPress={onCancel || onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={{ color: '#6B7280', marginTop: 4 }}>N\u00b0 {orderNumber}</Text>
        </View>

        {/* ETA */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: currentStep >= 4 ? '#ECFDF5' : '#F0FDF4', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: BRAND }}>
            {currentStep >= 4 ? (
              <Ionicons name="checkmark" size={50} color={BRAND} />
            ) : (
              <>
                <Ionicons name="time-outline" size={36} color={BRAND} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: BRAND, marginTop: 2 }}>{eta} min</Text>
              </>
            )}
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginTop: 12 }}>
            {currentStep >= 4 ? (isCollect ? t('cart.orderCollected') : t('cart.orderArrived')) : (isCollect ? t('cart.estimatedPickup') : t('cart.estimatedDelivery'))}
          </Text>
        </View>

        {/* Steps */}
        <View style={{ paddingHorizontal: 24 }}>
          {steps.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                backgroundColor: i <= currentStep ? BRAND : '#F3F4F6',
              }}>
                <Ionicons name={step.icon} size={18} color={i <= currentStep ? '#fff' : '#9CA3AF'} />
              </View>
              {i < steps.length - 1 && (
                <View style={{
                  position: 'absolute', left: 17, top: 36, width: 2, height: 20,
                  backgroundColor: i < currentStep ? BRAND : '#E5E7EB'
                }} />
              )}
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={{
                  fontSize: 15, fontWeight: i <= currentStep ? '700' : '500',
                  color: i <= currentStep ? '#111' : '#9CA3AF'
                }}>{step.label}</Text>
              </View>
              {i <= currentStep && (
                <Ionicons name="checkmark" size={18} color={BRAND} />
              )}
            </View>
          ))}
        </View>

        {/* Order summary */}
        <ScrollView style={{ marginTop: 16, marginHorizontal: 20, maxHeight: 260 }}>
          <View style={{ padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 }}>{t('cart.summary')}</Text>
            {(() => {
              const grouped = {};
              (items || []).forEach(it => {
                const shop = it.shop || '__other__';
                if (!grouped[shop]) grouped[shop] = [];
                grouped[shop].push(it);
              });
              return Object.entries(grouped).map(([shop, shopItems], si) => (
                <View key={si} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="storefront-outline" size={14} color={BRAND} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND, marginLeft: 6 }}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                  </View>
                  {shopItems.map((it, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingLeft: 20 }}>
                      <Text style={{ color: '#374151', fontSize: 13, flex: 1 }}>{it.qty || 1}x {t('productNames.' + (it.name || it.title), { defaultValue: it.name || it.title })}</Text>
                      <Text style={{ color: '#374151', fontSize: 13 }}>{fmtPrice(Number(it.price || 0) * Number(it.qty || 1))}</Text>
                    </View>
                  ))}
                </View>
              ));
            })()}
            <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 4, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>{t('cart.total')}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: BRAND }}>{fmtPrice(total || 0)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Close button */}
        {currentStep >= 4 && (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <TouchableOpacity onPress={onClose} style={{
              height: 48, borderRadius: 14, backgroundColor: BRAND,
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('cart.done')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const CartScreen = () => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const { cartVersion } = useCartEvents();
  const [cartItems, setCartItems] = React.useState([]);
  const [orderVisible, setOrderVisible] = React.useState(false);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [paymentVisible, setPaymentVisible] = React.useState(false);
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
  const [deliveryAddress, setDeliveryAddress] = React.useState('12 Rue de Rivoli, 75004 Paris');
  const [deliveryInfo, setDeliveryInfo] = React.useState('');
  const [selectedAddressId, setSelectedAddressId] = React.useState(null);
  const [editingAddress, setEditingAddress] = React.useState(false);
  const [tempAddress, setTempAddress] = React.useState('');
  const [tempInfo, setTempInfo] = React.useState('');
  const [addressSuggestions, setAddressSuggestions] = React.useState([]);
  const [selectedDateIndex, setSelectedDateIndex] = React.useState(0);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [addProductShop, setAddProductShop] = React.useState(null); // shop name for add product popup
  const [addProductSearch, setAddProductSearch] = React.useState('');

  // Generer les 7 prochains jours (exclure aujourd'hui si aucun creneau dispo)
  const deliveryDays = React.useMemo(() => {
    const days = [];
    const joursSemaine = [t('cart.days.sun'), t('cart.days.mon'), t('cart.days.tue'), t('cart.days.wed'), t('cart.days.thu'), t('cart.days.fri'), t('cart.days.sat')];
    const mois = [t('cart.months.jan'), t('cart.months.feb'), t('cart.months.mar'), t('cart.months.apr'), t('cart.months.may'), t('cart.months.jun'), t('cart.months.jul'), t('cart.months.aug'), t('cart.months.sep'), t('cart.months.oct'), t('cart.months.nov'), t('cart.months.dec')];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      // Verifier si aujourd'hui a des creneaux
      if (i === 0) {
        const now = new Date();
        const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        let sH = earliest.getHours();
        if (earliest.getMinutes() > 30) sH++;
        if (sH >= 22) continue; // Pas de creneau aujourd'hui, on skip
      }
      days.push({
        date: d,
        label: i === 0 ? t('cart.today') : i === 1 ? t('cart.tomorrow') : joursSemaine[d.getDay()],
        sub: d.getDate() + ' ' + mois[d.getMonth()],
      });
    }
    return days;
  }, [t]);

  // Generer creneaux de 30 min (de 8h a 22h, en partant de maintenant+2h si aujourd'hui)
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

  const [userAddresses, setUserAddresses] = React.useState([]); // [{id, label}]
  const [tempAddressId, setTempAddressId] = React.useState(null);
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY_PROFILE);
        if (raw) {
          const p = JSON.parse(raw);
          const addrs = p.addresses || [];
          const formatted = addrs.map(a => ({ id: a.id || null, label: [a.address, a.postalCode, a.city].filter(Boolean).join(', ') })).filter(a => a.label.length > 0);
          if (formatted.length > 0) {
            setUserAddresses(formatted);
            // Pré-remplir avec l'adresse sélectionnée dans le profil
            const selId = p.selectedAddressId || null;
            const selAddr = selId ? addrs.find(a => a.id === selId) : addrs[0];
            if (selAddr) {
              const selFormatted = [selAddr.address, selAddr.postalCode, selAddr.city].filter(Boolean).join(', ');
              if (selFormatted) setDeliveryAddress(selFormatted);
            }
            setSelectedAddressId(selId || addrs[0]?.id || null);
            return;
          }
          // Fallback: single address
          if (p.address) {
            setUserAddresses([{ id: null, label: [p.address, p.postalCode, p.city].filter(Boolean).join(', ') }]);
            setDeliveryAddress([p.address, p.postalCode, p.city].filter(Boolean).join(', '));
            return;
          }
        }
      } catch(e) {}
    })();
  }, []);

  const filterAddresses = (text) => {
    setTempAddress(text);
    setTempAddressId(null); // free text = no known ID until user picks a suggestion
    if (userAddresses.length === 0) { setAddressSuggestions([]); return; }
    if (text.length < 1) { setAddressSuggestions(userAddresses.slice(0, 5)); return; }
    const q = text.toLowerCase();
    const filtered = userAddresses.filter(a => a.label.toLowerCase().includes(q)).slice(0, 5);
    setAddressSuggestions(filtered);
  };
  const totalPrice = cartItems.reduce((sum, it, i) => selectedCart[i] ? sum + (Number(it.price || 0) * Number(it.qty || 1)) : sum, 0);

  const loadCart = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_CART);
      const arr = raw ? JSON.parse(raw) : [];
      const items = Array.isArray(arr) ? arr : [];
      setCartItems(items);
      // Auto-selectionner tous les produits
      const sel = {};
      items.forEach((_, i) => { sel[i] = true; });
      setSelectedCart(sel);
    } catch(e) {
      setCartItems([]);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { loadCart(); }, [loadCart]));

  // Reload cart when products are added from Products screen
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('CART_UPDATED', loadCart);
    return () => sub.remove();
  }, [loadCart]);

  // Reload cart when cartVersion changes (context-based update)
  useEffect(() => { loadCart(); }, [cartVersion]);

  const removeFromCart = async (index) => {
    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
    await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
  };

  const updateQty = async (index, delta) => {
    const updated = cartItems.map((it, i) => {
      if (i !== index) return it;
      return { ...it, qty: Math.max(1, (it.qty || 1) + delta) };
    });
    setCartItems(updated);
    await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
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
        }}
      ]
    );
  };

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

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="bag-handle-outline" size={64} color="#E5E7EB" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111', marginTop: 16, textAlign: 'center' }}>
            {t('cart.emptyCart')}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
            {t('cart.addProductsFromTab')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header avec titre + poubelle */}
      <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:14, paddingBottom:8}}>
        <Text style={{fontSize:22, fontWeight:'900', color:'#111'}}>{t('tabs.cart')}</Text>
        <TouchableOpacity onPress={clearCart} style={{padding:6}}>
          <Ionicons name="trash-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={groupedCart}
        keyExtractor={(item, i) => item.shop + i}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 120 }}
        renderItem={({ item: group }) => {
          const allSelected = group.items.every(it => selectedCart[it._originalIndex]);
          const someSelected = group.items.some(it => selectedCart[it._originalIndex]);
          return (
          <View style={{
            backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 6,
            borderRadius: 12, padding: 16,
            shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
            borderWidth: someSelected ? 2 : 0, borderColor: someSelected ? '#00C29B' : 'transparent'
          }}>
            {/* Shop header - shown once */}
            <TouchableOpacity activeOpacity={0.7} onPress={() => toggleShopSelection(group)}
              style={{ flexDirection:'row', alignItems:'center', marginBottom:12, paddingBottom:10, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
              <Square value={someSelected} onPress={() => toggleShopSelection(group)} />
              <Ionicons name="storefront-outline" size={16} color="#00C29B" style={{marginLeft:8}} />
              <View style={{flex:1, marginLeft:6}}>
                <Text style={{ fontSize:15, fontWeight:'700', color:'#00C29B' }}>{group.shop}</Text>
                <Text style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                  {group.items.reduce((s, it) => s + Number(it.qty || 1), 0)} {t('productsScreen.quantity')} \u2022 {fmtPrice(group.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0))}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Products in this shop */}
            {group.items.map((item, pi) => {
              const idx = item._originalIndex;
              return (
              <TouchableOpacity key={idx} activeOpacity={0.9} onPress={() => setSelectedCart(prev => ({...prev, [idx]: !prev[idx]}))}
                style={{ flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth: pi < group.items.length - 1 ? 1 : 0, borderBottomColor:'#F3F4F6' }}>
                <View style={{ marginRight: 10 }}>
                  <Square value={!!selectedCart[idx]} onPress={() => setSelectedCart(prev => ({...prev, [idx]: !prev[idx]}))} />
                </View>
                <ProductThumb name={item.name || item.title} size={44} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{t('productNames.' + (item.name || item.title), { defaultValue: item.name || item.title })}</Text>
                  {item.detail ? <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{t('productDetails.' + item.detail, { defaultValue: item.detail })}</Text> : null}
                  <View style={{ flexDirection:'row', alignItems:'center', marginTop: 8 }}>
                    <TouchableOpacity onPress={() => updateQty(idx, -1)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 9 }}>
                      <Text style={{ fontSize: 15 }}>-</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: '600', marginHorizontal: 10 }}>{item.qty || 1}</Text>
                    <TouchableOpacity onPress={() => updateQty(idx, 1)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 9 }}>
                      <Text style={{ fontSize: 15 }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>
                    {fmtPrice(Number(item.price || 0) * Number(item.qty || 1))}
                  </Text>
                  {item.unitPrice ? <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.unitPrice}</Text> : null}
                  <TouchableOpacity onPress={() => removeFromCart(idx)} style={{ padding: 6, marginTop: 4 }}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              );
            })}

            {/* Bouton ajouter produit */}
            <TouchableOpacity
              onPress={() => openShopProducts(group.shop)}
              style={{marginTop:10, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:10, borderRadius:12, backgroundColor:BRAND}}
            >
              <Ionicons name="add-circle" size={20} color="#fff" style={{marginRight:8}} />
              <Text style={{color:'#fff', fontWeight:'700', fontSize:15}}>{t('productsScreen.addProduct') || 'Ajouter un produit'}</Text>
            </TouchableOpacity>

            {/* Shop subtotal */}
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:10, marginTop:6, borderTopWidth:1, borderTopColor:'#F3F4F6' }}>
              <Text style={{ fontSize:13, color:'#6B7280' }}>{group.items.filter(it => selectedCart[it._originalIndex]).reduce((s, it) => s + Number(it.qty || 1), 0)} {t('productsScreen.quantity')}</Text>
              <Text style={{ fontSize:15, fontWeight:'700', color:BRAND }}>{fmtPrice(group.items.filter(it => selectedCart[it._originalIndex]).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0))}</Text>
            </View>
          </View>
          );
        }}
      />
      {Object.values(selectedCart).some(v => v) && (
      <View style={{
        position: 'absolute', bottom: 20, left: GUTTER, right: GUTTER,
        backgroundColor: '#fff', borderRadius: 14, padding: 12, paddingBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>{t('productsScreen.productsTotal')}</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{cartItems.filter((_, i) => selectedCart[i]).reduce((s, it) => s + Number(it.qty || 1), 0)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>{t('cart.total')}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: BRAND }}>{fmtPrice(totalPrice)}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => setConfirmVisible(true)} style={{
            flex: 1, height: 44, borderRadius: 12, backgroundColor: BRAND,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center'
          }}>
            <Ionicons name="bicycle" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('cart.confirmOrder')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {/* Modal de confirmation de commande */}
      <Modal visible={confirmVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'85%', paddingBottom:40}}>
            {/* Header */}
            <View style={{padding:20, paddingBottom:0}}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <Text style={{fontSize:20, fontWeight:'800', color:'#111'}}>{t('cart.confirmOrder')}</Text>
                <TouchableOpacity onPress={() => setConfirmVisible(false)} style={{padding:6}}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              {/* Toggle Livraison / Click & Collect */}
              <View style={{flexDirection:'row', backgroundColor:'#F3F4F6', borderRadius:14, padding:4, marginBottom:16}}>
                <TouchableOpacity
                  onPress={() => setOrderMode('delivery')}
                  style={{
                    flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
                    paddingVertical:10, borderRadius:12,
                    backgroundColor: orderMode === 'delivery' ? '#fff' : 'transparent',
                    shadowColor: orderMode === 'delivery' ? '#000' : 'transparent',
                    shadowOpacity: orderMode === 'delivery' ? 0.08 : 0,
                    shadowRadius: 4, elevation: orderMode === 'delivery' ? 2 : 0,
                  }}
                >
                  <Ionicons name="bicycle-outline" size={16} color={orderMode === 'delivery' ? BRAND : '#9CA3AF'} />
                  <Text style={{marginLeft:6, fontSize:14, fontWeight:'700', color: orderMode === 'delivery' ? BRAND : '#9CA3AF'}}>{t('cart.delivery')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setOrderMode('collect')}
                  style={{
                    flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
                    paddingVertical:10, borderRadius:12,
                    backgroundColor: orderMode === 'collect' ? '#fff' : 'transparent',
                    shadowColor: orderMode === 'collect' ? '#000' : 'transparent',
                    shadowOpacity: orderMode === 'collect' ? 0.08 : 0,
                    shadowRadius: 4, elevation: orderMode === 'collect' ? 2 : 0,
                  }}
                >
                  <Ionicons name="bag-handle-outline" size={16} color={orderMode === 'collect' ? BRAND : '#9CA3AF'} />
                  <Text style={{marginLeft:6, fontSize:14, fontWeight:'700', color: orderMode === 'collect' ? BRAND : '#9CA3AF'}}>{t('productsScreen.clickAndCollect')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{paddingHorizontal:20}} contentContainerStyle={{paddingBottom:10}} keyboardShouldPersistTaps="handled">
              {/* Resume par magasin */}
              {(() => {
                const selected = cartItems.map((it, idx) => ({...it, _origIdx: idx})).filter((_, i) => selectedCart[i]);
                const grouped = {};
                selected.forEach(it => {
                  const shop = it.shop || '__other__';
                  if (!grouped[shop]) grouped[shop] = [];
                  grouped[shop].push(it);
                });
                return Object.entries(grouped).map(([shop, items], si) => (
                  <View key={si} style={{marginTop:16}}>
                    <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                      <Ionicons name="storefront-outline" size={16} color={BRAND} />
                      <Text style={{fontSize:15, fontWeight:'700', color:BRAND, marginLeft:8}}>{shop}</Text>
                    </View>
                    {items.map((it, i) => (
                      <View key={i} style={{flexDirection:'row', alignItems:'center', paddingVertical:8}}>
                        <ProductThumb name={it.name || it.title} size={36} />
                        <View style={{flex:1, marginLeft:10}}>
                          <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{it.name || it.title}</Text>
                          <Text style={{fontSize:12, color:'#9CA3AF'}}>{fmtPrice(Number(it.price||0) * Number(it.qty||1))}</Text>
                        </View>
                        <View style={{flexDirection:'row', alignItems:'center', width:84, justifyContent:'space-between'}}>
                          <RepeatButton
                            onPress={() => {
                              if ((it.qty || 1) <= 1) {
                                const newSelected = {...selectedCart};
                                delete newSelected[it._origIdx];
                                setSelectedCart(newSelected);
                                const remaining = Object.keys(newSelected).filter(k => newSelected[k]).length;
                                if (remaining === 0) setConfirmVisible(false);
                              } else {
                                setCartItems(prev => { const u = [...prev]; u[it._origIdx] = {...u[it._origIdx], qty: Math.max(1, (u[it._origIdx].qty || 1) - 1)}; return u; });
                              }
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; const q = u[it._origIdx].qty || 1; if (q > 1) u[it._origIdx] = {...u[it._origIdx], qty: q - 1}; return u; });
                            }}
                            style={{width:28, height:28, borderRadius:7, alignItems:'center', justifyContent:'center', backgroundColor: (it.qty || 1) <= 1 ? '#FEE2E2' : '#fff', borderWidth: (it.qty || 1) <= 1 ? 0 : 1, borderColor:'#E5E7EB'}}
                          >
                            <Ionicons name={(it.qty || 1) <= 1 ? "trash-outline" : "remove"} size={14} color={(it.qty || 1) <= 1 ? '#EF4444' : '#111'} />
                          </RepeatButton>
                          <Text style={{fontSize:13, fontWeight:'700', color:'#111', textAlign:'center'}}>{it.qty || 1}</Text>
                          <RepeatButton
                            onPress={() => {
                              setCartItems(prev => { const u = [...prev]; u[it._origIdx] = {...u[it._origIdx], qty: (u[it._origIdx].qty || 1) + 1}; return u; });
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; u[it._origIdx] = {...u[it._origIdx], qty: (u[it._origIdx].qty || 1) + 1}; return u; });
                            }}
                            style={{width:28, height:28, borderRadius:7, alignItems:'center', justifyContent:'center', backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB'}}
                          >
                            <Ionicons name="add" size={14} color="#111" />
                          </RepeatButton>
                        </View>
                      </View>
                    ))}
                    {/* Bouton ajouter produits */}
                    <TouchableOpacity
                      onPress={() => {
                        setAddProductSearch('');
                        setCartItems(prev => prev.map(it => ({...it, _addQty: 0})));
                        setAddProductShop(shop);
                      }}
                      style={{flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:8, marginBottom:8, paddingVertical:8, borderRadius:10, backgroundColor:'#111', alignSelf:'flex-start', width:'50%'}}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#fff" />
                      <Text style={{fontSize:12, fontWeight:'600', color:'#fff', marginLeft:6}}>{t('cart.addProducts')}</Text>
                    </TouchableOpacity>
                    <View style={{borderTopWidth:1, borderTopColor:'#F3F4F6', flexDirection:'row', justifyContent:'space-between', paddingTop:8}}>
                      <Text style={{fontSize:13, color:'#6B7280'}}>{t('cart.subtotal')} {shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                      <Text style={{fontSize:13, fontWeight:'700', color:'#111'}}>{fmtPrice(items.reduce((s,it) => s + Number(it.price||0) * Number(it.qty||1), 0))}</Text>
                    </View>
                  </View>
                ));
              })()}

              {/* Frais de livraison */}
              <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:10}}>
                <Text style={{fontSize:13, color:'#6B7280'}}>{orderMode === 'delivery' ? t('cart.deliveryFee') : t('cart.collectFee')}</Text>
                <Text style={{fontSize:13, fontWeight:'700', color: orderMode === 'collect' ? BRAND : '#111'}}>{orderMode === 'delivery' ? fmtPrice(9.99) : t('cart.free')}</Text>
              </View>

              {/* Adresse de livraison ou Click & Collect */}
              {orderMode === 'collect' && (
                <View style={{marginTop:20, padding:14, backgroundColor:'#FFF7ED', borderRadius:12}}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <View style={{width:32, height:32, borderRadius:16, backgroundColor:'#FFEDD5', alignItems:'center', justifyContent:'center'}}>
                      <Ionicons name="storefront-outline" size={18} color="#F97316" />
                    </View>
                    <View style={{marginLeft:10, flex:1}}>
                      <Text style={{fontSize:14, fontWeight:'700', color:'#111'}}>{t('cart.storePickup')}</Text>
                      <Text style={{fontSize:12, color:'#6B7280', marginTop:2}}>{t('cart.readyIn1Hour')}</Text>
                    </View>
                  </View>
                  <Text style={{fontSize:13, color:'#9CA3AF', marginTop:8, marginLeft:42}}>{t('cart.presentAtDesk')}</Text>
                </View>
              )}
              {orderMode === 'delivery' && <View style={{marginTop:20, padding:14, backgroundColor:'#F9FAFB', borderRadius:12}}>
                <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Ionicons name="location-outline" size={18} color={BRAND} />
                    <Text style={{fontSize:14, fontWeight:'700', color:'#111', marginLeft:8}}>{t('cart.deliveryAddress')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setTempAddress(deliveryAddress); setTempInfo(deliveryInfo); setAddressSuggestions(userAddresses.slice(0, 5)); setEditingAddress(true); }}>
                    <Text style={{fontSize:13, fontWeight:'600', color:BRAND}}>{t('cart.edit')}</Text>
                  </TouchableOpacity>
                </View>
                {editingAddress ? (
                  <View style={{marginTop:10}}>
                    {/* Champ adresse */}
                    <Text style={{fontSize:12, fontWeight:'600', color:'#6B7280', marginBottom:4}}>{t('cart.address')}</Text>
                    <TextInput
                      value={tempAddress}
                      onChangeText={filterAddresses}
                      style={{backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#111'}}
                      autoFocus={true}
                      placeholder={t('cart.enterAddress')}
                    />
                    {/* Suggestions */}
                    {addressSuggestions.length > 0 && (
                      <View style={{backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, marginTop:4, overflow:'hidden'}}>
                        {addressSuggestions.map((addr, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => { setTempAddress(addr.label); setTempAddressId(addr.id); setAddressSuggestions([]); }}
                            style={{paddingHorizontal:12, paddingVertical:10, borderBottomWidth: i < addressSuggestions.length - 1 ? 1 : 0, borderBottomColor:'#F3F4F6', flexDirection:'row', alignItems:'center'}}
                          >
                            <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                            <Text style={{fontSize:13, color:'#374151', marginLeft:8}}>{addr.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {/* Infos complementaires */}
                    <Text style={{fontSize:12, fontWeight:'600', color:'#6B7280', marginTop:12, marginBottom:4}}>{t('cart.additionalInfo')}</Text>
                    <TextInput
                      value={tempInfo}
                      onChangeText={setTempInfo}
                      style={{backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#111'}}
                      placeholder={t('cart.additionalInfoPlaceholder')}
                      multiline={false}
                    />
                    {/* Boutons */}
                    <View style={{flexDirection:'row', marginTop:12, gap:8}}>
                      <TouchableOpacity
                        onPress={() => { setEditingAddress(false); setAddressSuggestions([]); }}
                        style={{flex:1, height:36, borderRadius:8, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
                      >
                        <Text style={{color:'#666', fontWeight:'600', fontSize:13}}>{t('profile.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { setDeliveryAddress(tempAddress); setDeliveryInfo(tempInfo); setSelectedAddressId(tempAddressId); setEditingAddress(false); setAddressSuggestions([]); }}
                        style={{flex:1, height:36, borderRadius:8, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}
                      >
                        <Text style={{color:'#fff', fontWeight:'600', fontSize:13}}>{t('profile.validate')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{marginTop:8, marginLeft:26}}>
                    <View style={{flexDirection:'row', alignItems:'center'}}>
                      <Ionicons name="home-outline" size={14} color="#6B7280" />
                      <Text style={{fontSize:13, color:'#374151', marginLeft:6, flex:1}}>{deliveryAddress}</Text>
                    </View>
                    {deliveryInfo ? (
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:4}}>
                        <Ionicons name="business-outline" size={14} color="#9CA3AF" />
                        <Text style={{fontSize:12, color:'#9CA3AF', marginLeft:6}}>{deliveryInfo}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>}

              {/* Creneau de livraison */}
              <View style={{marginTop:12}}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom:14}}>
                  <View style={{width:32, height:32, borderRadius:16, backgroundColor:'#F0FDF4', alignItems:'center', justifyContent:'center'}}>
                    <Ionicons name="time-outline" size={18} color={BRAND} />
                  </View>
                  <Text style={{fontSize:15, fontWeight:'700', color:'#111', marginLeft:10}}>{t('cart.deliverySlot')}</Text>
                </View>

                {/* Selecteur de jour - ligne horizontale */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
                  {deliveryDays.map((day, i) => {
                    const active = selectedDateIndex === i;
                    return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setSelectedDateIndex(i); setSelectedSlot(null); }}
                      style={{
                        paddingHorizontal:14, paddingVertical:8, borderRadius:20, marginRight:8,
                        backgroundColor: active ? BRAND : 'transparent',
                        borderWidth: active ? 0 : 1, borderColor:'#E5E7EB',
                      }}
                    >
                      <Text style={{fontSize:13, fontWeight:'600', color: active ? '#fff' : '#374151'}}>{day.label} {day.date.getDate()}</Text>
                    </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Creneaux groupes par periode */}
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
                      <View key={pi} style={{marginBottom:14}}>
                        <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                          <Ionicons name={period.icon} size={14} color={period.color} />
                          <Text style={{fontSize:12, fontWeight:'700', color:'#6B7280', marginLeft:6, textTransform:'uppercase', letterSpacing:0.5}}>{period.label}</Text>
                        </View>
                        <View style={{flexDirection:'row', flexWrap:'wrap'}}>
                          {periodSlots.map((slot, si) => {
                            const active = selectedSlot === slot;
                            return (
                            <TouchableOpacity
                              key={si}
                              onPress={() => setSelectedSlot(slot)}
                              style={{
                                width:'31.5%', marginRight: (si % 3 < 2) ? '2.75%' : 0, marginBottom:8,
                                paddingVertical:8, borderRadius:10, alignItems:'center',
                                backgroundColor: active ? BRAND : 'transparent',
                                borderWidth:1, borderColor: active ? BRAND : '#E5E7EB',
                              }}
                            >
                              <Text style={{fontSize:11, fontWeight:'600', color: active ? '#fff' : '#374151'}}>{slot}</Text>
                            </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  });
                })() : (
                  <View style={{padding:20, alignItems:'center', backgroundColor:'#F9FAFB', borderRadius:12}}>
                    <Ionicons name="time-outline" size={28} color="#D1D5DB" />
                    <Text style={{fontSize:13, color:'#9CA3AF', marginTop:8}}>{t('cart.noSlots')}</Text>
                  </View>
                )}

              </View>

              {/* Total + resume creneau */}
              <View style={{marginTop:16, padding:14, backgroundColor:'#F9FAFB', borderRadius:12}}>
                {selectedSlot && (
                  <View style={{flexDirection:'row', alignItems:'center', marginBottom:10, paddingBottom:10, borderBottomWidth:1, borderBottomColor:'#E5E7EB'}}>
                    <Ionicons name="time-outline" size={16} color={BRAND} />
                    <Text style={{fontSize:13, fontWeight:'700', color:'#111', marginLeft:8}}>
                      {deliveryDays[selectedDateIndex]?.label} {deliveryDays[selectedDateIndex]?.sub}
                    </Text>
                    <Text style={{fontSize:13, color:BRAND, fontWeight:'600', marginLeft:6}}>{selectedSlot}</Text>
                  </View>
                )}
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:6}}>
                  <Text style={{fontSize:14, color:'#6B7280'}}>{t('cart.subtotal')}</Text>
                  <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{fmtPrice(totalPrice)}</Text>
                </View>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:6}}>
                  <Text style={{fontSize:14, color:'#6B7280'}}>{orderMode === 'delivery' ? t('cart.delivery') : t('cart.collect')}</Text>
                  <Text style={{fontSize:14, fontWeight:'600', color: orderMode === 'collect' ? BRAND : '#111'}}>{orderMode === 'delivery' ? fmtPrice(9.99) : t('cart.free')}</Text>
                </View>
                <View style={{borderTopWidth:1, borderTopColor:'#E5E7EB', paddingTop:8, flexDirection:'row', justifyContent:'space-between'}}>
                  <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>{t('cart.total')}</Text>
                  <Text style={{fontSize:18, fontWeight:'800', color:BRAND}}>{fmtPrice(totalPrice + (orderMode === 'delivery' ? 9.99 : 0))}</Text>
                </View>
              </View>

              {/* Nombre articles */}
              <Text style={{fontSize:12, color:'#9CA3AF', textAlign:'center', marginTop:10}}>
                {cartItems.filter((_, i) => selectedCart[i]).length} {t('cart.itemsSelected', {count: cartItems.filter((_, i) => selectedCart[i]).length})}
              </Text>
            </ScrollView>

            {/* Boutons */}
            <View style={{paddingHorizontal:20, marginTop:10, gap:10}}>
              <TouchableOpacity
                onPress={() => {
                  if (!selectedSlot) {
                    Alert.alert(t('cart.slotRequired'), t('cart.slotRequiredMsg'));
                    return;
                  }
                  setConfirmVisible(false);
                  setPaymentVisible(true);
                }}
                style={{height:52, borderRadius:14, backgroundColor: selectedSlot ? BRAND : '#9CA3AF', flexDirection:'row', alignItems:'center', justifyContent:'center'}}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginRight:8}} />
                <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('cart.confirmOrder')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setConfirmVisible(false)}
                style={{height:44, borderRadius:14, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#666', fontWeight:'600'}}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Popup ajouter produits - overlay dans la modal */}
          {!!addProductShop && (
            <View style={{position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
              <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'70%', paddingBottom:40}}>
                <View style={{padding:20, paddingBottom:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Ionicons name="storefront-outline" size={18} color={BRAND} />
                    <Text style={{fontSize:17, fontWeight:'800', color:'#111', marginLeft:8}}>{addProductShop}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAddProductShop(null)} style={{padding:6}}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                {/* Barre de recherche */}
                <View style={{paddingHorizontal:20, marginBottom:12}}>
                  <View style={{flexDirection:'row', alignItems:'center', backgroundColor:'#F3F4F6', borderRadius:10, paddingHorizontal:12, paddingVertical:8}}>
                    <Ionicons name="search-outline" size={16} color="#9CA3AF" />
                    <TextInput
                      value={addProductSearch}
                      onChangeText={setAddProductSearch}
                      placeholder="Rechercher un produit..."
                      placeholderTextColor="#9CA3AF"
                      style={{flex:1, marginLeft:8, fontSize:14, color:'#111', padding:0}}
                    />
                    {addProductSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setAddProductSearch('')}>
                        <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <FlatList
                  data={cartItems.map((it, idx) => ({...it, _idx: idx})).filter(it => (it.shop || '__other__') === addProductShop && (!addProductSearch || (it.name || it.title || '').toLowerCase().includes(addProductSearch.toLowerCase())))}
                  keyExtractor={(it, i) => String(i)}
                  style={{paddingHorizontal:20}}
                  renderItem={({item}) => {
                    const qty = item._addQty || 0;
                    const isAdded = qty > 0;
                    return (
                    <View style={{flexDirection:'row', alignItems:'center', paddingVertical:10, paddingHorizontal:10, marginBottom:6, borderRadius:12, backgroundColor: isAdded ? '#F0FDF4' : 'transparent', borderWidth: isAdded ? 1 : 0, borderColor: isAdded ? '#BBF7D0' : 'transparent'}}>
                      <ProductThumb name={item.name || item.title} size={40} />
                      <View style={{flex:1, marginLeft:12}}>
                        <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{t('productNames.' + (item.name || item.title), { defaultValue: item.name || item.title })}</Text>
                        <Text style={{fontSize:12, color:'#9CA3AF'}}>{fmtPrice(Number(item.price||0))}</Text>
                      </View>
                      {qty === 0 ? (
                        <TouchableOpacity
                          onPress={() => {
                            const updated = [...cartItems];
                            updated[item._idx] = {...updated[item._idx], _addQty: 1};
                            setCartItems(updated);
                          }}
                          style={{width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:BRAND}}
                        >
                          <Ionicons name="add" size={20} color="#fff" />
                        </TouchableOpacity>
                      ) : (
                        <View style={{flexDirection:'row', alignItems:'center', backgroundColor:'#F3F4F6', borderRadius:10, paddingHorizontal:4, paddingVertical:2}}>
                          <RepeatButton
                            onPress={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: Math.max(0, (u[item._idx]._addQty || 0) - 1)}; return u; });
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: Math.max(0, (u[item._idx]._addQty || 0) - 1)}; return u; });
                            }}
                            style={{width:30, height:30, borderRadius:8, alignItems:'center', justifyContent:'center', backgroundColor:'#fff'}}
                          >
                            <Ionicons name="remove" size={16} color="#111" />
                          </RepeatButton>
                          <Text style={{fontSize:14, fontWeight:'700', color:'#111', marginHorizontal:12}}>{qty}</Text>
                          <RepeatButton
                            onPress={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: (u[item._idx]._addQty || 0) + 1}; return u; });
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; u[item._idx] = {...u[item._idx], _addQty: (u[item._idx]._addQty || 0) + 1}; return u; });
                            }}
                            style={{width:30, height:30, borderRadius:8, alignItems:'center', justifyContent:'center', backgroundColor:'#fff'}}
                          >
                            <Ionicons name="add" size={16} color="#111" />
                          </RepeatButton>
                        </View>
                      )}
                    </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={{alignItems:'center', paddingVertical:30}}>
                      <Text style={{fontSize:14, color:'#6B7280'}}>{t('cart.noProductsInShop')}</Text>
                    </View>
                  }
                />
                {/* Resume produits ajoutes */}
                {(() => {
                  const added = cartItems.filter(it => (it.shop || '__other__') === addProductShop && (it._addQty || 0) > 0);
                  if (added.length === 0) return null;
                  return (
                    <View style={{paddingHorizontal:20, paddingTop:10, paddingBottom:4}}>
                      <Text style={{fontSize:13, fontWeight:'700', color:'#111', marginBottom:4}}>{added.length} {t('cart.productsSelected', {count: added.length})}</Text>
                      {added.map((it, i) => (
                        <Text key={i} style={{fontSize:12, color:'#6B7280'}}>{'\u2022'} {it.name || it.title} x{it._addQty}</Text>
                      ))}
                    </View>
                  );
                })()}
                {/* Bouton Ajouter en bas */}
                <View style={{paddingHorizontal:20, paddingTop:8}}>
                  <TouchableOpacity
                    onPress={() => {
                      // Mettre a jour les quantites et selectionner les produits avec _addQty > 0
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
                    style={{height:48, borderRadius:12, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}
                  >
                    <Text style={{color:'#fff', fontWeight:'700', fontSize:15}}>{t('cart.addToOrder')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
        </KeyboardAvoidingView>
      </Modal>


      <PaymentModal
        visible={paymentVisible}
        onClose={() => setPaymentVisible(false)}
        onSuccess={() => {
          setPaymentVisible(false);
          setOrderVisible(true);
        }}
        orderId={String(Date.now())}
        totalLabel={fmtPrice(totalPrice + (orderMode === 'delivery' ? 9.99 : 0))}
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        amountCents={Math.round((totalPrice + (orderMode === 'delivery' ? 9.99 : 0)) * 100)}
        currency="eur"
      />

      <OrderTracker
        visible={orderVisible}
        items={cartItems}
        total={totalPrice}
        mode={orderMode}
        onCancel={() => setOrderVisible(false)}
        onClose={async () => {
          setOrderVisible(false);
          // Save to order history
          try {
            const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
            const history = raw ? JSON.parse(raw) : [];
            const shops = [...new Set(cartItems.map(i => i.shop).filter(Boolean))];
            const deliveryFee = orderMode === 'delivery' ? 9.99 : 0;
            const selectedDay = deliveryDays[selectedDateIndex];
            const deliveryDateLabel = selectedDay ? (selectedDay.label + ' ' + selectedDay.sub) : '';
            const orderId = Date.now();
            const order = {
              id: orderId,
              date: new Date().toISOString(),
              items: cartItems,
              total: totalPrice + deliveryFee,
              subtotal: totalPrice,
              deliveryFee,
              shops,
              mode: orderMode,
              slot: selectedSlot || '',
              deliveryDate: deliveryDateLabel,
              address: orderMode === 'delivery' ? deliveryAddress : '',
              address_id: orderMode === 'delivery' ? (selectedAddressId || null) : null,
              deliveryStatus: orderMode === 'delivery' ? DELIVERY_STATUS.PENDING : null,
            };
            history.unshift(order);
            await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(history));
            syncOrderToBackend(order).catch(() => {});

            // If delivery mode, create delivery assignment for Livraison-app drivers
            if (orderMode === 'delivery') {
              try {
                const profileRaw = await AsyncStorage.getItem(KEY_PROFILE);
                const profile = profileRaw ? JSON.parse(profileRaw) : {};
                await createDeliveryOrder({
                  id: orderId,
                  shops,
                  address: deliveryAddress,
                  deliveryInfo,
                  customerName: (profile.prenom || '') + ' ' + (profile.nom || ''),
                  customerPhone: profile.phone || '',
                  items: cartItems,
                  total: totalPrice + deliveryFee,
                  deliveryFee,
                  slot: selectedSlot || '',
                  deliveryDate: deliveryDateLabel,
                  mode: 'delivery',
                });
              } catch(e) {
                console.log('Delivery order sync skipped:', e.message);
              }
            }
          } catch(e) {}
          // Clear cart after order
          setCartItems([]);
          setSelectedCart({});
          await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
        }}
      />

      {/* Modal liste produits du shop */}
      <Modal visible={shopProductsVisible} animationType="none" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'85%', paddingBottom:40}}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
              <View style={{flex:1}}>
                <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>{shopProductsName}</Text>
                <Text style={{fontSize:13, color:'#6B7280', marginTop:2}}>{shopProductsList.length} {t('productsScreen.quantity') || 'produits'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShopProductsVisible(false)} style={{padding:6}}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Barre de recherche */}
            <View style={{paddingHorizontal:20, paddingVertical:10}}>
              <View style={{flexDirection:'row', alignItems:'center', backgroundColor:'#F3F4F6', borderRadius:10, paddingHorizontal:12, paddingVertical:8}}>
                <Ionicons name="search-outline" size={16} color="#9CA3AF" />
                <TextInput
                  value={shopProductsSearch}
                  onChangeText={setShopProductsSearch}
                  placeholder={t('favorites.searchProductPlaceholder') || 'Rechercher un produit...'}
                  placeholderTextColor="#9CA3AF"
                  style={{flex:1, marginLeft:8, fontSize:14, color:'#111', padding:0}}
                />
                {shopProductsSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setShopProductsSearch('')}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
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
              contentContainerStyle={{paddingHorizontal:16, paddingBottom:16}}
              renderItem={({item: product}) => (
                <View style={{flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
                  <ProductThumb name={product.name} size={40} />
                  <View style={{flex:1, marginLeft:10}}>
                    <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{product.name}</Text>
                    {product.detail ? <Text style={{fontSize:12, color:'#6B7280', marginTop:1}}>{product.detail}</Text> : null}
                    <View style={{flexDirection:'row', alignItems:'baseline', marginTop:2}}>
                      <Text style={{fontSize:14, fontWeight:'700', color:'#111'}}>{fmtPrice(product.price||0)}</Text>
                      {product.unitPrice ? <Text style={{fontSize:10, color:'#9CA3AF', marginLeft:4}}>{product.unitPrice}</Text> : null}
                    </View>
                  </View>
                  {product.inCart ? (
                    <View style={{flexDirection:'row', alignItems:'center', backgroundColor:'#F3F4F6', paddingHorizontal:10, paddingVertical:6, borderRadius:8}}>
                      <Ionicons name="checkmark-circle" size={14} color="#9CA3AF" style={{marginRight:4}} />
                      <Text style={{fontSize:12, fontWeight:'600', color:'#9CA3AF'}}>{t('cart.inCart') || 'Dans le panier'}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={async () => {
                        const newItem = {
                          name: product.name, detail: product.detail || '',
                          unitPrice: product.unitPrice || '', qty: 1,
                          price: product.price || 0, shop: shopProductsName
                        };
                        const updated = [...cartItems, newItem];
                        setCartItems(updated);
                        const sel = {};
                        updated.forEach((_, i) => { sel[i] = true; });
                        setSelectedCart(sel);
                        await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
                        // Mark as in cart
                        setShopProductsList(prev => prev.map(p => p.name === product.name ? {...p, inCart: true} : p));
                      }}
                      style={{flexDirection:'row', alignItems:'center', backgroundColor:BRAND, paddingHorizontal:12, paddingVertical:8, borderRadius:8}}
                    >
                      <Ionicons name="add" size={16} color="#fff" style={{marginRight:4}} />
                      <Text style={{fontSize:13, fontWeight:'700', color:'#fff'}}>{t('cart.add') || 'Ajouter'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
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
            shop: cartSearchShop
          };
          const updated = [...cartItems, newItem];
          setCartItems(updated);
          const sel = {};
          updated.forEach((_, i) => { sel[i] = true; });
          setSelectedCart(sel);
          await AsyncStorage.setItem(KEY_CART, JSON.stringify(updated));
          setCartSearchVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

export default CartScreen;
