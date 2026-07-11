import { autocorrectName } from "./utils/spellcheck";
import React, { useEffect, useMemo, useState } from "react";

// Marketplace API Services
import { loginUser, registerUser, logoutUser, forgotPassword as apiForgotPassword, updatePassword as apiUpdatePassword, getDocumentStatus } from "./services/auth";
import { getAllProducts, getCompanyProducts, searchProducts as apiSearchProducts, getCategories, getShopsByCategory } from "./services/products";
import { getAllShops, getShopDetails } from "./services/shops";
import { getCart, saveCart, addToCart as apiAddToCart, removeFromCart as apiRemoveFromCart, clearCart, placeOrder } from "./services/orders";
import { getProfile as apiGetProfile, updateProfile as apiUpdateProfile, uploadProfilePhoto } from "./services/profile";
import { fetchAddresses, createAddress, updateAddress, deleteAddressById, makeAddressDefault } from "./services/addresses";
import { getTokens } from "./services/api";
import { createDeliveryOrder, trackDelivery, getDeliveryStatus, DELIVERY_STATUS, getDeliveryStatusInfo, toggleDriverMode, isDriverMode, getDriverEarnings, canDeliver, getDriverCountry, setDriverCountry, COUNTRY_LIMITS, getCountryLimit } from "./services/delivery";

function __getUserItems(){
  try { if (typeof items !== "undefined" && Array.isArray(items)) return items; } catch(_) {}
  try { if (typeof list !== "undefined" && Array.isArray(list)) return list; } catch(_) {}
  try { if (typeof userItems !== "undefined" && Array.isArray(userItems)) return userItems; } catch(_) {}
  try { if (typeof myList !== "undefined" && Array.isArray(myList)) return myList; } catch(_) {}
  return [];
}


function itemsToRenderForShop(allUserItems, assignedForThisShop, optimized){
  const A = Array.isArray(allUserItems) ? allUserItems : [];
  const B = Array.isArray(assignedForThisShop) ? assignedForThisShop : [];
  const opt = typeof optimized === "boolean" ? optimized : false;
  return opt ? B : A;
}

import './i18n';
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter } from 'react-native';
import SearchPopup from './components/SearchPopup';
import * as Location from 'expo-location';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Keyboard, FlatList, Modal, Pressable, Alert, ActivityIndicator, Image, Animated, ScrollView, Platform, KeyboardAvoidingView, InputAccessoryView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DefaultTheme, useNavigation, useFocusEffect } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';

import { openCamera } from "./utils/openCamera";
import Toast from "./components/ui/Toast";
import RepeatButton from "./components/ui/RepeatButton";
import { SEED_ACCOUNTS as MARKETPLACE_ACCOUNTS } from "./lib/seedAccounts";
import { PRODUCT_IMAGES, DEFAULT_PRODUCT, CATEGORY_FALLBACKS, getProductImage } from "./lib/productImages";
import { CURRENCIES } from "./data/currencies";
import { RATES_CACHE_MS, fetchLiveRates, getCurrencyWithLiveRate, getCachedLiveRates } from "./lib/rates";
import { parseMulti } from "./lib/parseMulti";
const BRAND = "#09d7aa";

// Design system tokens — "modern delivery marketplace" look.
const THEME = {
  brand: '#09d7aa', brandDark: '#07b896', brandSoft: '#E0FAF3',
  bg: '#FFFFFF', card: '#FFFFFF', subtle: '#F1F3F5',
  ink: '#0F172A', muted: '#64748B', faint: '#94A3B8',
  border: '#ECEEF1', danger: '#EF4444', dangerSoft: '#FEE2E2',
  accent: '#FFB547', accentSoft: '#FFF3E0', info: '#3B82F6', infoSoft: '#DBEAFE',
  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  shadowSm: { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
};


const ProductThumb = ({ name, size = 44 }) => {
  const img = getProductImage(name);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: img.bg, alignItems: 'center', justifyContent: 'center'
    }}>
      <Text style={{ fontSize: size * 0.5 }}>{img.emoji}</Text>
    </View>
  );
};

const KEY_ITEMS = "SG_ITEMS";
const KEY_SELECTED = "SG_SELECTED_FOR_PRODUCTS";
const KEY_CART = "KEY_CART";
const KEY_ORDER_HISTORY = "KEY_ORDER_HISTORY";
const KEY_PROFILE = "KEY_PROFILE";
const KEY_FAV_SHOPS="KEY_FAV_SHOPS";
const KEY_FAVS = "KEY_FAVS";
const KEY_FAV_PRODUCTS = "KEY_FAV_PRODUCTS";
const KEY_AUTH = "KEY_AUTH";
const KEY_ACCOUNTS = "KEY_ACCOUNTS";
// Marketplace user accounts — loaded from ./lib/seedAccounts (imported at top).
// In production, accounts come from the backend. For local dev, drop a
// `data/seed-accounts.json` file (gitignored) matching the .example schema.
const GUTTER = 24;
const CTRL = 20;
const GAP = 10;


const CurrencyContext = React.createContext({ currency: CURRENCIES[0], fmtPrice: (n) => n.toFixed(2) + ' €' });

const Tab = createBottomTabNavigator();
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: BRAND, background: "#fff" } };

const Square = ({ value, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.square, value && styles.squareOn]}>
    {value ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
  </TouchableOpacity>
);
const Radio = ({ value, onPress, style }) => {
  const Cmp = onPress ? TouchableOpacity : View;
  return (
    <Cmp onPress={onPress} style={[styles.radioOuter, value && { borderColor: BRAND, backgroundColor: BRAND }, style]}>
      {value ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
    </Cmp>
  );
};

const PillScan = () => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={async ()=>{ await openCamera(); }} activeOpacity={0.8} style={styles.scanPill}>
      <Ionicons name="scan" size={16} color={BRAND} />
      <Text style={styles.scanText}>{t('listScreen.scan')}</Text>
    </TouchableOpacity>
  );
};

const QtyInput = ({ value, onCommit }) => {
  const [temp, setTemp] = useState(String(value ?? 1));
  useEffect(() => { setTemp(String(value ?? 1)); }, [value]);

  return (
    <TextInput
      value={temp}
      onChangeText={(t) => {
        const digits = (t || "").replace(/[^\d]/g, "");
        setTemp(digits);
      }}
      onEndEditing={() => {
        const next = temp === "" ? 1 : Math.max(1, parseInt(temp, 10));
        onCommit(next);
        setTemp(String(next));
      }}
      keyboardType="number-pad"
      style={styles.qtyInput}
    />
  );
};


// Toast and RepeatButton extracted to components/ui/

const lstyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, paddingHorizontal: 14, height: 38, borderRadius: 19 },
  scanTxt: { color: THEME.brandDark, fontWeight: '700', fontSize: 13, marginLeft: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  input: { flex: 1, height: 52, backgroundColor: THEME.card, borderRadius: 16, paddingHorizontal: 16, fontSize: 15, color: THEME.ink, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  addBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center', marginLeft: 10, ...THEME.shadow },
  toolRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, marginRight: 8, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  pillOn: { backgroundColor: THEME.brand, borderColor: THEME.brand },
  pillOnDark: { backgroundColor: THEME.ink, borderColor: THEME.ink },
  pillTxt: { fontSize: 12.5, fontWeight: '700', color: THEME.muted },
  pillTxtOn: { color: '#fff' },
  delPill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: THEME.dangerSoft },
  delTxt: { color: THEME.danger, fontWeight: '800', fontSize: 12.5, marginLeft: 4 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#D7DCE3', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: THEME.brand, borderColor: THEME.brand },
  itemName: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  itemNameCrossed: { textDecorationLine: 'line-through', color: THEME.faint, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 10, height: 30, paddingHorizontal: 3, borderWidth: 1, borderColor: THEME.border },
  stepBtn: { width: 24, height: 24, borderRadius: 7, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center' },
  stepQty: { minWidth: 26, textAlign: 'center', fontSize: 13, fontWeight: '800', color: THEME.ink, marginHorizontal: 2 },
  unitChip: { marginLeft: 6, minWidth: 30, height: 30, paddingHorizontal: 7, borderRadius: 9, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  unitChipOn: { backgroundColor: THEME.ink, borderColor: THEME.ink },
  unitChipTxt: { fontSize: 12, fontWeight: '700', color: THEME.faint },
  unitChipTxtOn: { color: '#fff' },
  unitGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, marginHorizontal: -4 },
  unitOpt: { minWidth: 64, height: 44, paddingHorizontal: 14, margin: 4, borderRadius: 12, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  unitOptOn: { backgroundColor: THEME.ink, borderColor: THEME.ink },
  unitOptTxt: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  unitOptTxtOn: { color: '#fff' },
  doneBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#E2E6EB', alignItems: 'center', justifyContent: 'center' },
  doneBtnOn: { backgroundColor: THEME.ink, borderColor: THEME.ink },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 70, paddingHorizontal: 50 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(9,215,170,0.95)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: THEME.card, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: THEME.border, ...THEME.shadow },
  hideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  hideTxt: { fontSize: 13, color: THEME.muted, marginLeft: 8, fontWeight: '600' },
  cta: { height: 54, borderRadius: 16, backgroundColor: THEME.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', paddingHorizontal: 28 },
  modalBox: { backgroundColor: THEME.card, borderRadius: 22, padding: 22 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: THEME.ink, marginBottom: 14 },
  modalInput: { height: 50, backgroundColor: THEME.subtle, borderRadius: 14, paddingHorizontal: 14, fontSize: 15, color: THEME.ink },
  modalRow: { flexDirection: 'row', marginTop: 16 },
  modalCancel: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.subtle, marginRight: 8 },
  modalSave: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.brand, marginLeft: 8 },
  modalCancelTxt: { color: THEME.muted, fontWeight: '700', fontSize: 15 },
  modalSaveTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

function ListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [strikeAll, setStrikeAll] = useState(false);
  const [hideCrossed, setHideCrossed] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastKey, setToastKey] = useState(0);

  const showToast = (msg) => { setToastMsg(msg); setToastKey(k => k + 1); };

  const [editVisible, setEditVisible] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const [unitPickerId, setUnitPickerId] = useState(null);

  const hydrated = React.useRef(false);
  useEffect(() => { (async () => {
    try {
      const s = await AsyncStorage.getItem("SG_ITEMS");
      if (s) setItems(JSON.parse(s));
    } catch {}
    hydrated.current = true;
  })(); }, []);
  // Persist only after the initial load — otherwise the empty initial state
  // overwrites the saved list on every cold start.
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem("SG_ITEMS", JSON.stringify(items)).catch(() => {});
  }, [items]);

  // Reload items when returning to this tab (e.g. after adding to cart crosses them off)
  useFocusEffect(React.useCallback(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem("SG_ITEMS");
        if (s) setItems(JSON.parse(s));
      } catch {}
    })();
  }, []));

  const addFromInput = () => {
    const parsed = parseMulti(text);
    if (parsed.length === 0) return;
    setItems(prev => {
      const base = [...prev];
      for (const p of parsed) {
        const idx = base.findIndex(b => b.name.toLowerCase() === p.name.toLowerCase() && (b.unit || 'u') === (p.unit || 'u'));
        if (idx >= 0) base[idx] = { ...base[idx], qty: (base[idx].qty || 1) + p.qty };
        else base.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), name: p.name, qty: p.qty, unit: p.unit || 'u', crossed: false, selected: true });
      }
      return base;
    });
    setText("");
    Keyboard.dismiss();
    const count = parsed.length;
  };

  const onMinus = id => setItems(items.map(it => it.id === id ? { ...it, qty: Math.max(1, (it.qty || 1) - 1) } : it));
  const onPlus  = id => setItems(items.map(it => it.id === id ? { ...it, qty: (it.qty || 1) + 1 } : it));
  const setQty  = (id, q) => setItems(items.map(it => it.id === id ? { ...it, qty: q } : it));
  const setUnit = (id, u) => setItems(items.map(it => it.id === id ? { ...it, unit: u } : it));
  const toggleSelected = id => setItems(items.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleCrossed  = id => setItems(items.map(it => it.id === id ? { ...it, crossed: !it.crossed, selected: it.crossed ? it.selected : false } : it));

  const toggleSelectAll = () => {
    const v = !selectAll; setSelectAll(v);
    setItems(items.map(it => ({ ...it, selected: v })));
  };
  const toggleStrikeAll = () => {
    const v = !strikeAll; setStrikeAll(v);
    setItems(items.map(it => ({ ...it, crossed: v, selected: v ? false : it.selected })));
  };

  const visible = useMemo(() => hideCrossed ? items.filter(i => !i.crossed) : items, [items, hideCrossed]);

  const openEdit = (it) => { setEditId(it.id); setEditText(it.name); setEditVisible(true); };
  const closeEdit = () => { setEditVisible(false); setEditId(null); setEditText(""); };
  const saveEdit = () => {
    if (!editText.trim()) { closeEdit(); return; }
    setItems(prev => prev.map(it => it.id === editId ? { ...it, name: editText.trim() } : it));
    closeEdit();
  };

  const renderItem = ({ item }) => {
    const isCrossed = !!item.crossed;
    return (
    <View style={[lstyles.card, isCrossed && { opacity: 0.62 }]}>
      {/* Select checkbox */}
      <TouchableOpacity onPress={() => !isCrossed && toggleSelected(item.id)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <View style={[lstyles.check, item.selected && !isCrossed && lstyles.checkOn]}>
          {item.selected && !isCrossed ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
        </View>
      </TouchableOpacity>

      {/* Name — tap to edit */}
      <TouchableOpacity onPress={() => !isCrossed && openEdit(item)} activeOpacity={0.7} style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
        <Text numberOfLines={1} style={[lstyles.itemName, isCrossed && lstyles.itemNameCrossed]}>{item.name}</Text>
      </TouchableOpacity>

      {/* Quantity stepper */}
      <View style={[lstyles.stepper, isCrossed && { opacity: 0.5 }]}>
        <RepeatButton onPress={() => !isCrossed && onMinus(item.id)} onLongAction={() => !isCrossed && onMinus(item.id)} style={lstyles.stepBtn}><Ionicons name="remove" size={14} color={THEME.ink} /></RepeatButton>
        {isCrossed ? (
          <Text style={lstyles.stepQty}>{item.qty || 1}</Text>
        ) : (
          <QtyInput value={item.qty || 1} onCommit={(q) => setQty(item.id, q)} />
        )}
        <RepeatButton onPress={() => !isCrossed && onPlus(item.id)} onLongAction={() => !isCrossed && onPlus(item.id)} style={lstyles.stepBtn}><Ionicons name="add" size={14} color={THEME.ink} /></RepeatButton>
      </View>

      {/* Unit chip — tap to choose kg/g/L/mL/cL/mg */}
      <TouchableOpacity
        onPress={() => !isCrossed && setUnitPickerId(item.id)}
        activeOpacity={0.7}
        disabled={isCrossed}
        hitSlop={{top:6,bottom:6,left:4,right:4}}
        style={[lstyles.unitChip, (item.unit && item.unit !== 'u') && lstyles.unitChipOn, isCrossed && { opacity: 0.5 }]}
      >
        <Text style={[lstyles.unitChipTxt, (item.unit && item.unit !== 'u') && lstyles.unitChipTxtOn]} numberOfLines={1}>
          {item.unit && item.unit !== 'u' ? item.unit : 'u'}
        </Text>
      </TouchableOpacity>

      {/* Done toggle */}
      <TouchableOpacity onPress={() => toggleCrossed(item.id)} activeOpacity={0.7} style={{ marginLeft: 10 }}>
        <View style={[lstyles.doneBtn, isCrossed && lstyles.doneBtnOn]}>
          <Ionicons name="checkmark" size={15} color={isCrossed ? '#fff' : THEME.faint} />
        </View>
      </TouchableOpacity>
    </View>
    );
  };

  const Header = (
    <View style={lstyles.header}>
      <View style={lstyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={lstyles.title}>{t('tabs.myList')}</Text>
          <Text style={lstyles.subtitle}>{items.length} {t('listScreen.deleteItem', { count: items.length })}</Text>
        </View>
        <TouchableOpacity onPress={async () => { await openCamera(); }} activeOpacity={0.8} style={lstyles.scanBtn}>
          <Ionicons name="scan-outline" size={17} color={THEME.brandDark} />
          <Text style={lstyles.scanTxt}>{t('listScreen.scan')}</Text>
        </TouchableOpacity>
      </View>

      <View style={lstyles.inputWrap}>
        <TextInput
          autoCorrect={true}
          spellCheck={true}
          autoCapitalize="sentences"
          keyboardType="default"
          textContentType="none"
          secureTextEntry={false}
          value={text}
          onChangeText={setText}
          placeholder={t('listScreen.inputPlaceholder')}
          placeholderTextColor={THEME.faint}
          style={lstyles.input}
          returnKeyType="done"
          onSubmitEditing={addFromInput}
        />
        <TouchableOpacity onPress={addFromInput} activeOpacity={0.85} style={lstyles.addBtn}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={lstyles.toolRow}>
        <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.8} style={[lstyles.pill, selectAll && lstyles.pillOn]}>
          <Text style={[lstyles.pillTxt, selectAll && lstyles.pillTxtOn]}>{t('listScreen.selectAll')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleStrikeAll} activeOpacity={0.8} style={[lstyles.pill, strikeAll && lstyles.pillOnDark]}>
          <Text style={[lstyles.pillTxt, strikeAll && lstyles.pillTxtOn]}>{t('listScreen.strikeAll')}</Text>
        </TouchableOpacity>
        {items.some(it => it.selected) && (
          <TouchableOpacity onPress={() => {
            const count = items.filter(it => it.selected).length;
            Alert.alert(t('listScreen.deleteTitle'), `${t('listScreen.deleteConfirm')} ${count} ${t('listScreen.deleteItem', {count})}`, [
              { text: t('listScreen.cancel'), style: 'cancel' },
              { text: t('listScreen.delete'), style: 'destructive', onPress: () => {
                setItems(prev => prev.filter(it => !it.selected));
                setSelectAll(false);
              }}
            ]);
          }} activeOpacity={0.8} style={lstyles.delPill}>
            <Ionicons name="trash-outline" size={15} color={THEME.danger} />
            <Text style={lstyles.delTxt}>{items.filter(it => it.selected).length}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={lstyles.screen}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={lstyles.screen} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={lstyles.empty}>
            <View style={lstyles.emptyCircle}>
              <Ionicons name="cart-outline" size={44} color="#fff" />
            </View>
            <Text style={lstyles.emptyTitle}>{t('listScreen.noItems')}</Text>
            <Text style={lstyles.emptyHint}>{t('listScreen.inputPlaceholder')}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 180 }}
      />

      <View style={lstyles.bottomWrap}>
        <View style={lstyles.hideRow}>
          <Switch value={hideCrossed} onValueChange={setHideCrossed} trackColor={{ true: THEME.brand, false: '#D7DCE3' }} thumbColor="#fff" style={{ transform:[{ scale:0.85 }] }} />
          <Text style={lstyles.hideTxt}>{t('listScreen.hideStriked')}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.9} style={lstyles.cta} onPress={async ()=>{
        try{
          const all = Array.isArray(items) ? items : [];
          // D'abord les items cochés, sinon tous les items non-barrés, sinon tous
          let chosen = all.filter(it=>it && (it.selected || it.checked)).map(it=>({
            name: String(it.name||it.title||'').trim(),
            qty: Number(it.qty||it.quantity||1)
          }));
          if (!chosen.length) {
            chosen = all.filter(it=>it && !it.crossed).map(it=>({
              name: String(it.name||it.title||'').trim(),
              qty: Number(it.qty||it.quantity||1)
            }));
          }
          if (!chosen.length) {
            chosen = all.map(it=>({
              name: String(it.name||it.title||'').trim(),
              qty: Number(it.qty||it.quantity||1)
            }));
          }
          await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify(chosen));
        }catch(e){}
        DeviceEventEmitter.emit('PRODUCTS_RESET');
        navigation.navigate("products");
      }}>
          <Ionicons name="bag-check-outline" size={20} color="#fff" />
          <Text style={lstyles.ctaTxt}>{t('listScreen.findExactProducts')}</Text>
        </TouchableOpacity>
      </View>

      {/* Unit picker modal */}
      <Modal visible={unitPickerId !== null} transparent animationType="fade" onRequestClose={() => setUnitPickerId(null)}>
        <Pressable style={lstyles.modalBackdrop} onPress={() => setUnitPickerId(null)}>
          <Pressable style={lstyles.modalBox} onPress={() => {}}>
            <Text style={lstyles.modalTitle}>{t('listScreen.unit')}</Text>
            <View style={lstyles.unitGrid}>
              {['u','g','kg','mL','cL','L','mg'].map((u) => {
                const current = items.find(i => i.id === unitPickerId)?.unit || 'u';
                const active = current === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => { setUnit(unitPickerId, u); setUnitPickerId(null); }}
                    style={[lstyles.unitOpt, active && lstyles.unitOptOn]}
                  >
                    <Text style={[lstyles.unitOptTxt, active && lstyles.unitOptTxtOn]}>{u}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[lstyles.modalRow, { marginTop: 14 }]}>
              <Pressable onPress={() => setUnitPickerId(null)} style={[lstyles.modalCancel, { flex: 1, marginRight: 0 }]}>
                <Text style={lstyles.modalCancelTxt}>{t('listScreen.cancel')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={lstyles.modalBackdrop}>
          <View style={lstyles.modalBox}>
            <Text style={lstyles.modalTitle}>{t('listScreen.editItem')}</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              style={lstyles.modalInput}
              autoFocus
              autoCorrect={true}
              spellCheck={true}
              autoCapitalize="sentences"
              keyboardType="default"
              textContentType="none"
            />
            <View style={lstyles.modalRow}>
              <Pressable onPress={closeEdit} style={lstyles.modalCancel}>
                <Text style={lstyles.modalCancelTxt}>{t('listScreen.cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={lstyles.modalSave}>
                <Text style={lstyles.modalSaveTxt}>{t('listScreen.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
    </View>
  );
}

function Placeholder({ title }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 12 }}>
        <Text style={styles.h1}>{title}</Text>
        <Text style={styles.muted}>{t('placeholder.screenToImplement')}</Text>
      </View>
    </SafeAreaView>
  );
}










const SEARCH_MAP = require('./data/search-map.json');

const prodStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  clearBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.dangerSoft, alignItems: 'center', justifyContent: 'center' },

  segment: { flexDirection: 'row', marginTop: 16, backgroundColor: THEME.subtle, borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 11 },
  segBtnOn: { backgroundColor: THEME.card, ...THEME.shadowSm },
  segTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.muted, marginLeft: 6 },
  segTxtOn: { color: THEME.ink },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, marginRight: 8, marginBottom: 8, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  chipOn: { backgroundColor: THEME.brand, borderColor: THEME.brand },
  chipTxt: { fontSize: 12.5, fontWeight: '700', color: THEME.muted },
  chipTxtOn: { color: '#fff' },

  summaryCard: { marginTop: 12, marginHorizontal: 20, padding: 14, borderRadius: 16, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: THEME.muted },
  summaryStats: { flexDirection: 'row', marginTop: 10 },
  statBox: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: '800', color: THEME.ink },
  statLabel: { fontSize: 11.5, fontWeight: '600', color: THEME.faint, marginTop: 1 },
  statDivider: { width: 1, backgroundColor: THEME.border, marginHorizontal: 4 },

  infoBanner: { marginHorizontal: 20, marginTop: 10, padding: 14, borderRadius: 16, backgroundColor: THEME.brandSoft, flexDirection: 'row', alignItems: 'center' },
  infoTxt: { flex: 1, fontSize: 13, color: THEME.brandDark, fontWeight: '600', marginLeft: 10, lineHeight: 18 },

  card: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  cardOn: { borderColor: THEME.brand, borderWidth: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  shopIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  shopName: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginTop: 2 },
  metaTxt: { fontSize: 12, color: THEME.muted, marginLeft: 4, fontWeight: '600' },
  shopFavBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  feeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  feeTxt: { fontSize: 12.5, color: THEME.muted, fontWeight: '600', marginLeft: 4 },

  productRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.border },
  productLine: { flexDirection: 'row', alignItems: 'center' },
  qtyBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginRight: 8 },
  qtyBadgeTxt: { fontSize: 12.5, fontWeight: '800' },
  productTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: THEME.ink, marginRight: 10 },
  addedTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addedTagTxt: { color: THEME.brand, fontWeight: '700', fontSize: 12.5, marginLeft: 4 },
  searchBtn: { backgroundColor: THEME.brand, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  searchBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12.5, marginLeft: 4 },

  picked: { marginTop: 10, padding: 12, backgroundColor: THEME.subtle, borderRadius: 14 },
  pickedRow: { flexDirection: 'row', alignItems: 'center' },
  pickedBody: { flex: 1, marginLeft: 10 },
  pickedName: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  pickedDetail: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  pickedPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  pickedPrice: { fontSize: 15.5, fontWeight: '800', color: THEME.ink },
  pickedUnit: { fontSize: 11, color: THEME.faint, marginLeft: 6, fontWeight: '600' },
  pickedFav: { marginLeft: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 12, height: 34, paddingHorizontal: 3, borderWidth: 1, borderColor: THEME.border, marginLeft: 'auto' },
  stepBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepBtnAdd: { width: 28, height: 28, borderRadius: 9, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center' },
  stepBtnDel: { width: 28, height: 28, borderRadius: 9, backgroundColor: THEME.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  stepQty: { fontSize: 15, fontWeight: '700', color: THEME.ink, marginHorizontal: 6, minWidth: 18, textAlign: 'center' },

  addMoreBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, borderWidth: 1, borderColor: THEME.brand, borderStyle: 'dashed', backgroundColor: THEME.brandSoft },
  addMoreTxt: { color: THEME.brandDark, fontWeight: '700', fontSize: 13.5, marginLeft: 6 },
  totalsBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13.5, fontWeight: '700', color: THEME.muted },
  totalValue: { fontSize: 13.5, fontWeight: '700', color: THEME.ink },
  grandLabel: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  grandValue: { fontSize: 15, fontWeight: '800', color: THEME.brand },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 70, paddingHorizontal: 50 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: THEME.border, paddingBottom: Platform.OS === 'ios' ? 30 : 16, ...THEME.shadow },
  bottomList: { maxHeight: 220, paddingHorizontal: 20, paddingTop: 14 },
  bottomItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.border },
  bottomItemBody: { flex: 1, marginLeft: 10 },
  bottomItemName: { fontSize: 13.5, fontWeight: '700', color: THEME.ink },
  bottomItemShop: { fontSize: 11.5, color: THEME.muted, fontWeight: '600', marginTop: 1 },
  bottomItemQty: { fontSize: 12.5, fontWeight: '700', color: THEME.muted, marginRight: 10 },
  bottomItemPrice: { fontSize: 13.5, fontWeight: '800', color: THEME.brand },
  bottomSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  bottomCount: { fontSize: 14, fontWeight: '700', color: THEME.muted },
  bottomTotal: { fontSize: 18, fontWeight: '800', color: THEME.brand },
  cta: { marginHorizontal: 20, height: 52, borderRadius: 16, backgroundColor: THEME.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },
});

const ProductsScreen = () => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const navigation = useNavigation();
  const [__activeQuery, __setActiveQuery] = React.useState('');
  // __selectedByQuery removed (unused)
  const [popupSelectedItems, setPopupSelectedItems] = React.useState([]); // Items selected from popup
  const [checkedShops, setCheckedShops] = React.useState({}); // {shopIndex: true/false}
  const [favProductNames, setFavProductNames] = React.useState(new Set());

  // Load favorite product names
  React.useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
      const arr = raw ? JSON.parse(raw) : [];
      setFavProductNames(new Set(arr.map(p => p.name)));
    })();
  }, []);

  const toggleProductFav = async (product) => {
    const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
    let arr = raw ? JSON.parse(raw) : [];
    const exists = arr.findIndex(p => p.name === product.name);
    if (exists >= 0) {
      arr = arr.filter(p => p.name !== product.name);
    } else {
      arr.push({ name: product.name, detail: product.detail || '', price: product.price || 0, unitPrice: product.unitPrice || '' });
    }
    await AsyncStorage.setItem(KEY_FAV_PRODUCTS, JSON.stringify(arr));
    setFavProductNames(new Set(arr.map(p => p.name)));
  };
  const [dupModalVisible, setDupModalVisible] = React.useState(false);
  const [dupItems, setDupItems] = React.useState([]); // [{newItem, existingIndex, add: true/false}]
  const [dupMerged, setDupMerged] = React.useState([]);
  const [dupNewOnly, setDupNewOnly] = React.useState(0);
  const [successModalVisible, setSuccessModalVisible] = React.useState(false);
  const [successCount, setSuccessCount] = React.useState(0);
  const [confirmCartVisible, setConfirmCartVisible] = React.useState(false);
  const [confirmCartItems, setConfirmCartItems] = React.useState([]);
  const [cartSuccessVisible, setCartSuccessVisible] = React.useState(false);
  const [cartSuccessCount, setCartSuccessCount] = React.useState(0);


  const [__searchVisible, __setSearchVisible] = React.useState(false); //__search_popup_flag
  const [__initialQuery, __setInitialQuery] = React.useState(''); //__search_popup_flag
  const [__shopFilter, __setShopFilter] = React.useState(null);
  const [__activeShopName, __setActiveShopName] = React.useState('');
  const [__activeShopIndex, __setActiveShopIndex] = React.useState(null);

  const BRAND="#00C29B";
  const [mode,setMode]=React.useState("collect");
  const [favShops,setFavShops]=React.useState([]);
  const loadFavShops = React.useCallback(async()=>{ try{ const raw=await AsyncStorage.getItem(KEY_FAV_SHOPS); const arr=raw?JSON.parse(raw):[]; setFavShops(Array.isArray(arr)?arr:[]); }catch(e){ setFavShops([]);} },[]);
  useFocusEffect(React.useCallback(()=>{ let a=true;(async()=>{ await loadFavShops(); })(); return ()=>{a=false}; },[loadFavShops]));
  const isShopFav = (name)=> favShops.includes(String(name||""));
  const toggleShopFav = async (shopObj)=>{
    try{
      const name = String(shopObj?.name||"");
      const set = new Set(Array.isArray(favShops)?favShops:[]);
      if(set.has(name)) { set.delete(name); }
      else { set.add(name); }
      const out = [...set];
      setFavShops(out);
      await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(out));
    }catch(e){}
  };
  const [strategy,setStrategy]=React.useState("balanced");  // 'eco' | 'fast' | 'balanced' | 'single'
  const [loading,setLoading]=React.useState(true);
  const [groups,setGroups]=React.useState([]);   // [{name,distance,time,deliveryFee,products:[{title,qty,price}],subtotal,grandTotal}]
  const [summary,setSummary]=React.useState({price:0,time:0,shops:0});


  const parseMin=(t)=>{if(!t)return 0;const m=String(t).match(/(\d+)/);return m?Number(m[1]):0;};
  // Deterministic hash so prices stay stable across refreshes
  const hashStr=(s)=>{let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return Math.abs(h);};
  const seededRand=(seed,a,b)=>a+((seed%10000)/10000)*(b-a);
  const randPrice=(name,shopName)=>{
    const n=String(name||"").toLowerCase();
    const seed=hashStr(n+"_"+(shopName||""));
    if(n.includes("pain"))return seededRand(seed,1.0,2.0);
    if(n.includes("yaourt"))return seededRand(seed,0.6,1.2);
    if(n.includes("pomme"))return seededRand(seed,0.4,1.0);
    if(n.includes("tomate"))return seededRand(seed,1.5,3.0);
    if(n.includes("poulet"))return seededRand(seed,6.0,11.0);
    if(n.includes("lait"))return seededRand(seed,0.8,1.5);
    if(n.includes("oeuf")||n.includes("œuf"))return seededRand(seed,2.0,4.0);
    if(n.includes("fromage"))return seededRand(seed,1.5,5.0);
    if(n.includes("beurre"))return seededRand(seed,1.2,3.0);
    return seededRand(seed,0.8,13.0);
  };

  const readJSON=async(k)=>{try{const raw=await AsyncStorage.getItem(k);return raw?JSON.parse(raw):null;}catch(_){return null;}};

  // Tous les produits du catalogue comme défaut quand la liste est vide
  // On extrait les clés uniques (singulier) de search-map pour éviter les doublons
  const DEFAULT_PRODUCTS = React.useMemo(() => {
    const seen = new Set();
    const products = [];
    // Clés singulières prioritaires pour éviter doublons singulier/pluriel
    const keys = Object.keys(SEARCH_MAP).sort((a, b) => a.length - b.length);
    keys.forEach(key => {
      // Skip les catégories génériques (fruits, legumes, viande, etc.)
      if (['fruits', 'legumes', 'viande', 'poisson', 'surgeles', 'boisson', 'petit dejeuner', 'hygiene', 'menage'].includes(key)) return;
      const items = SEARCH_MAP[key];
      if (!items || !items.length) return;
      const firstName = items[0].name;
      if (seen.has(firstName)) return;
      seen.add(firstName);
      products.push({ name: key, qty: 1 });
    });
    return products;
  }, []);

  const [showingDefaults, setShowingDefaults] = React.useState(false);
  const [cartPushed, setCartPushed] = React.useState(false); // true after adding to cart = block refresh

  const loadSelected=async()=>{
    // Only load from KEY_SELECTED — set by "Trouver produits exacts" button
    const raw = await AsyncStorage.getItem(KEY_SELECTED);
    let selected = raw ? JSON.parse(raw) : null;
    // If KEY_SELECTED is explicitly empty [], products were cleared after cart push
    if (Array.isArray(selected) && selected.length === 0) {
      setShowingDefaults(true);
      return [];
    }
    // If KEY_SELECTED doesn't exist, try fallback
    if (!Array.isArray(selected) || !selected.length) {
      selected = (await readJSON('SG_SELECTED_FOR_PRODUCTS'));
      if (!Array.isArray(selected) || !selected.length) {
        setShowingDefaults(true);
        return [];
      }
    }
    setShowingDefaults(false);
    return selected;
  };

  const buildInventory=(items)=>{
    const shops=[
      {name:"Carrefour Market", distance:"0.9 km", time:"9 min",  fee:Number(seededRand(hashStr("fee_carrefour"),1.5,4.0).toFixed(2))},
      {name:"Intermarché Sud", distance:"0.8 km", time:"10 min", fee:Number(seededRand(hashStr("fee_inter"),1.5,4.0).toFixed(2))},
      {name:"Primeur Bio",     distance:"0.5 km", time:"7 min",  fee:Number(seededRand(hashStr("fee_bio"),1.5,4.0).toFixed(2))},
      {name:"Leclerc Meaux",   distance:"1.8 km", time:"8 min",  fee:Number(seededRand(hashStr("fee_leclerc"),1.5,4.0).toFixed(2))},
      {name:"Monoprix Centre", distance:"1.2 km", time:"6 min",  fee:Number(seededRand(hashStr("fee_mono"),1.5,4.0).toFixed(2))},
      {name:"Auchan City",     distance:"1.5 km", time:"11 min", fee:Number(seededRand(hashStr("fee_auchan"),1.5,4.0).toFixed(2))},
      {name:"Lidl Express",    distance:"0.7 km", time:"5 min",  fee:Number(seededRand(hashStr("fee_lidl"),1.5,4.0).toFixed(2))},
      {name:"Casino Shop",     distance:"1.0 km", time:"8 min",  fee:Number(seededRand(hashStr("fee_casino"),1.5,4.0).toFixed(2))}
    ];
    return shops.map(s=>({
      ...s,
      items: items.map(it=>{
        const avail = (hashStr(it.name+"_avail_"+s.name)%100)<85;
        return {
          name: it.name, qty: it.qty,
          available: avail,
          price: Number(randPrice(it.name,s.name).toFixed(2))
        };
      })
    }));
  };

  const assignEco=(items,inv)=>{
    const map={};
    items.forEach(it=>{
      let best=null;
      inv.forEach(s=>{
        const r=s.items.find(x=>x.name===it.name);
        if(r && r.available && (!best || r.price<best.price)) best={shop:s, row:r};
      });
      if(!best){const s=inv[Math.floor(Math.random()*inv.length)];
        best={shop:s,row:{name:it.name,price:randPrice(it.name,s.name),qty:it.qty}};}
      const key=best.shop.name;
      if(!map[key]) map[key]={shop:best.shop,products:[]};
      map[key].products.push({title:it.name,qty:it.qty,price:best.row.price});
    });
    return Object.values(map);
  };

  const assignFast=(items,inv,mode)=>{
    const sorted=[...inv].sort((a,b)=>parseMin(a.time)-parseMin(b.time));
    const map={};
    items.forEach(it=>{
      const chosen=sorted.find(s=>s.items.find(r=>r.name===it.name && r.available))||sorted[0];
      const row=chosen.items.find(r=>r.name===it.name)||{price:randPrice(it.name,chosen.name)};
      const key=chosen.name; if(!map[key]) map[key]={shop:chosen,products:[]};
      map[key].products.push({title:it.name,qty:it.qty,price:row.price});
    });
    return Object.values(map);
  };

  const assignBalanced=(items,inv)=>{
    const alpha=0.25; // €/min
    const map={};
    items.forEach(it=>{
      let best=null;
      inv.forEach(s=>{
        const r=s.items.find(x=>x.name===it.name);
        const unit=r&&r.available?r.price:randPrice(it.name,s.name)*1.1;
        const score=unit + alpha*parseMin(s.time);
        if(!best || score<best.score) best={shop:s,price:unit,score};
      });
      const key=best.shop.name; if(!map[key]) map[key]={shop:best.shop,products:[]};
      map[key].products.push({title:it.name,qty:it.qty,price:best.price});
    });
    return Object.values(map);
  };

  const assignSingle=(items,inv)=>{
    const hasAll=(s)=>items.every(it=>{const r=s.items.find(x=>x.name===it.name);return r&&r.available;});
    const one=inv.find(hasAll);
    if(one){
      return [{shop:one,products:items.map(it=>{const r=one.items.find(x=>x.name===it.name);return {title:it.name,qty:it.qty,price:r.price};})}];
    }
    let best=null;
    for(let i=0;i<inv.length;i++){
      for(let j=i+1;j<inv.length;j++){
        const si=inv[i], sj=inv[j];
        let sum=0;
        items.forEach(it=>{
          const ri=si.items.find(x=>x.name===it.name && x.available);
          const rj=sj.items.find(x=>x.name===it.name && x.available);
          const price = ri?ri.price : (rj?rj.price : randPrice(it.name,"fallback")*1.2);
          sum += price*it.qty;
        });
        const ti=parseMin(si.time), tj=parseMin(sj.time);
        const time=(mode==='collect')?ti+tj:Math.max(ti,tj);
        const score = sum + 0.25*time;
        if(!best || score<best.score) best={si,sj,score};
      }
    }
    const res={};
    items.forEach(it=>{
      const ri=best.si.items.find(x=>x.name===it.name);
      const rj=best.sj.items.find(x=>x.name===it.name);
      const pi=ri&&ri.available?ri.price:Infinity;
      const pj=rj&&rj.available?rj.price:Infinity;
      const chosen=(pi<=pj)?{shop:best.si,price:pi}:{shop:best.sj,price:pj};
      if(!isFinite(chosen.price)) chosen.price=randPrice(it.name,"fallback")*1.25;
      const key=chosen.shop.name; if(!res[key]) res[key]={shop:chosen.shop,products:[]};
      res[key].products.push({title:it.name,qty:it.qty,price:chosen.price});
    });
    return Object.values(res);
  };

  // Normalize: remove accents, lowercase, trim
  const norm = (s) => String(s||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  const buildProposal=(items)=>{
    const inv=buildInventory(items);
    let assigned;
    if(strategy==='eco') assigned=assignEco(items,inv);
    else if(strategy==='fast') assigned=assignFast(items,inv,mode);
    else if(strategy==='single') assigned=assignSingle(items,inv);
    else assigned=assignBalanced(items,inv);

    // Dupliquer certains produits dans d'autres shops pour comparaison
    const dupeNames = items.filter(it => {
      const n = (it.name||'').toLowerCase();
      return n.includes('pat') || n.includes('pât') || n.includes('pizza') || n.includes('riz') || n.includes('lait') || n.includes('oeuf') || n.includes('œuf') || n.includes('poulet');
    }).map(it => it.name);
    if (dupeNames.length > 0) {
      dupeNames.forEach(dName => {
        const alreadyIn = new Set(assigned.filter(g => g.products.some(p => p.title === dName)).map(g => g.shop.name));
        const shopCandidates = inv.filter(s => !alreadyIn.has(s.name) && s.items.find(x => x.name === dName && x.available));
        const toAdd = shopCandidates.sort((a, b) => {
          const pa = a.items.find(x => x.name === dName)?.price || 99;
          const pb = b.items.find(x => x.name === dName)?.price || 99;
          return pa - pb;
        }).slice(0, 2);
        const origItem = items.find(it => it.name === dName);
        toAdd.forEach(s => {
          const row = s.items.find(x => x.name === dName);
          let existing = assigned.find(g => g.shop.name === s.name);
          if (!existing) { existing = { shop: s, products: [] }; assigned.push(existing); }
          if (!existing.products.some(p => p.title === dName)) {
            existing.products.push({ title: dName, qty: origItem?.qty || 1, price: row.price });
          }
        });
      });
    }

    const groups=assigned.map(g=>{
      const subtotal=g.products.reduce((a,p)=>a+Number(p.price||0)*Number(p.qty||1),0);
      const fee=mode==='delivery'?Number(g.shop.fee||0):0;
      return {name:g.shop.name,distance:g.shop.distance,time:g.shop.time,deliveryFee:fee,products:g.products,subtotal,grandTotal:subtotal+fee};
    });
    // Favoris en haut de liste
    // Ensure ALL products appear in ALL shops (with shop-specific prices)
    groups.forEach(g => {
      const shopInv = inv.find(s => s.name === g.name);
      if (!shopInv) return;
      items.forEach(it => {
        const already = g.products.some(p => norm(p.title) === norm(it.name));
        if (!already) {
          const row = shopInv.items.find(x => x.name === it.name);
          if (row) {
            g.products.push({ title: it.name, qty: it.qty, price: row.price });
          }
        }
      });
      // Recalculate totals
      g.subtotal = g.products.reduce((a, p) => a + Number(p.price || 0) * Number(p.qty || 1), 0);
      g.grandTotal = g.subtotal + (mode === 'delivery' ? Number(g.deliveryFee || 0) : 0);
    });

    groups.sort((a,b) => {
      const aFav = favShops.includes(a.name) ? 0 : 1;
      const bFav = favShops.includes(b.name) ? 0 : 1;
      return aFav - bFav;
    });
    const priceTotal=groups.reduce((a,g)=>a+g.grandTotal,0);
    const time=(mode==='collect')?groups.reduce((a,g)=>a+parseMin(g.time),0):Math.max(...groups.map(g=>parseMin(g.time)),0);
    return {groups,summary:{price:priceTotal,time,shops:groups.length}};
  };

  // Damerau-Levenshtein distance for fuzzy matching
  const damerauLev = (a, b) => {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
        if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1])
          dp[i][j] = Math.min(dp[i][j], dp[i-2][j-2]+1);
      }
    }
    return dp[m][n];
  };

  const autoFillProducts = (items, groups) => {
    const filled = [];
    let idCounter = Date.now();
    const mapKeys = Object.keys(SEARCH_MAP);
    const mapKeysNorm = mapKeys.map(k => ({ key: k, norm: norm(k) }));

    items.forEach(item => {
      const key = norm(item.name);
      if (!key) return;

      // 1. Exact match
      let mapResults = SEARCH_MAP[key] || SEARCH_MAP[key + 's'] || SEARCH_MAP[key + 'es'];
      // 2. Remove trailing s/es
      if (!mapResults && key.endsWith('s')) mapResults = SEARCH_MAP[key.slice(0,-1)];
      if (!mapResults && key.endsWith('es')) mapResults = SEARCH_MAP[key.slice(0,-2)];
      // 3. Substring match
      if (!mapResults) {
        const found = mapKeysNorm.find(k => k.norm.includes(key) || key.includes(k.norm));
        if (found) mapResults = SEARCH_MAP[found.key];
      }
      // 4. Fuzzy match (Damerau-Levenshtein) — find closest product even with typos
      if (!mapResults) {
        let bestKey = null, bestDist = Infinity;
        mapKeysNorm.forEach(({ key: k, norm: nk }) => {
          if (Math.abs(key.length - nk.length) > 4) return; // skip very different lengths
          const dist = damerauLev(key, nk);
          const threshold = Math.max(2, Math.floor(key.length * 0.4)); // allow ~40% errors
          if (dist < bestDist && dist <= threshold) {
            bestDist = dist;
            bestKey = k;
          }
        });
        if (bestKey) mapResults = SEARCH_MAP[bestKey];
      }
      const product = mapResults ? mapResults[0] : null;
      if (!product) return;

      // Add product to EVERY shop that has it in their products list
      groups.forEach((group, shopIndex) => {
        const shopProduct = (group.products || []).find(p => {
          const pName = norm(p.title);
          return pName === key || pName.includes(key) || key.includes(pName);
        });
        // Always add — every shop should show every product
        filled.push({
          id: idCounter++,
          name: product.name,
          detail: product.detail || '',
          unitPrice: product.unitPrice || '',
          price: shopProduct ? (product.price || shopProduct.price || 0) : (product.price || 0),
          qty: item.qty || 1,
          shop: group.name,
          shopIndex: shopIndex,
          checked: false,
        });
      });
    });
    return filled;
  };

  const refresh=React.useCallback(async()=>{
    if (cartPushed) { setLoading(false); return; }
    setLoading(true);
    try{
      const items=await loadSelected();
      const {groups,summary}=buildProposal(items);
      setGroups(groups); setSummary(summary);

      // Auto-fill product details from search-map for all products
      if (groups.length > 0 && items.length > 0) {
        const autoFilled = autoFillProducts(items, groups);
        if (autoFilled.length > 0) {
          setPopupSelectedItems(autoFilled);
          setCheckedShops({});
        }
      }
    }catch(e){ setGroups([]); setSummary({price:0,time:0,shops:0}); }
    finally{ setLoading(false); }
  },[mode,strategy]);

  React.useEffect(()=>{ refresh(); },[refresh]);
  useFocusEffect(React.useCallback(()=>{ refresh(); },[refresh]));

  // Reset cartPushed when user pushes new products from Ma Liste
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('PRODUCTS_RESET', () => {
      setCartPushed(false);
      refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const setQty=(si,pi,delta)=>{
    setGroups(prev=>{
      const arr=Array.isArray(prev)?JSON.parse(JSON.stringify(prev)):[];
      if(arr[si]&&arr[si].products&&arr[si].products[pi]){
        const q=Number(arr[si].products[pi].qty||1);
        arr[si].products[pi].qty=Math.max(1,q+delta);
      }
      arr.forEach(g=>{
        g.subtotal=(Array.isArray(g.products)?g.products:[]).reduce((a,p)=>a+Number(p.price||0)*Number(p.qty||1),0);
        g.grandTotal=g.subtotal+(mode==='delivery'?Number(g.deliveryFee||0):0);
      });
      const priceTotal=arr.reduce((a,g)=>a+g.grandTotal,0);
      const time=(mode==='collect')?arr.reduce((a,g)=>a+parseMin(g.time),0):Math.max(...arr.map(g=>parseMin(g.time)),0);
      setSummary({price:priceTotal,time,shops:arr.length});
      return arr;
    });
  };


  const Chip=({label,active,onPress})=>(
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[prodStyles.chip, active && prodStyles.chipOn]}>
      <Text style={[prodStyles.chipTxt, active && prodStyles.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={prodStyles.screen}>
    <SafeAreaView style={prodStyles.screen} edges={['top']}>
      {/* Header avec titre + bouton effacer */}
      <View style={prodStyles.header}>
        <View style={prodStyles.headerRow}>
          <View style={{flex:1}}>
            <Text style={prodStyles.title}>{t('tabs.products')}</Text>
            <Text style={prodStyles.subtitle}>{summary.shops} {t('productsScreen.shops')?.replace(/[•·]/g,'').trim() || 'shops'}</Text>
          </View>
          {groups.length > 0 && (
            <TouchableOpacity activeOpacity={0.8} onPress={async () => {
              await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
              setGroups([]); setSummary({price:0,time:0,shops:0});
              setPopupSelectedItems([]); setCheckedShops({});
              setShowingDefaults(true);
            }} style={prodStyles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={THEME.danger} />
            </TouchableOpacity>
          )}
        </View>

        {/* Mode */}
        <View style={prodStyles.segment}>
          <TouchableOpacity activeOpacity={0.8} onPress={()=>setMode("collect")} style={[prodStyles.segBtn, mode==="collect" && prodStyles.segBtnOn]}>
            <Ionicons name="bag-handle-outline" size={16} color={mode==="collect" ? THEME.brand : THEME.muted} />
            <Text style={[prodStyles.segTxt, mode==="collect" && prodStyles.segTxtOn]}>{t('productsScreen.clickAndCollect')}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} onPress={()=>setMode("delivery")} style={[prodStyles.segBtn, mode==="delivery" && prodStyles.segBtnOn]}>
            <Ionicons name="bicycle-outline" size={16} color={mode==="delivery" ? THEME.brand : THEME.muted} />
            <Text style={[prodStyles.segTxt, mode==="delivery" && prodStyles.segTxtOn]}>{t('productsScreen.delivery')}</Text>
          </TouchableOpacity>
        </View>

        {/* Stratégies */}
        <View style={prodStyles.chipRow}>
          <Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>setStrategy('balanced')} />
          <Chip label={t('productsScreen.strategies.totalPrice')}  active={strategy==='eco'} onPress={()=>setStrategy('eco')} />
          <Chip label={t('productsScreen.strategies.time')}  active={strategy==='fast'} onPress={()=>setStrategy('fast')} />
          <Chip label={t('productsScreen.strategies.singleShop')}  active={strategy==='single'} onPress={()=>setStrategy('single')} />
        </View>
      </View>

      {/* Résumé */}
      <View style={prodStyles.summaryCard}>
        <Text style={prodStyles.summaryTitle}>{t('productsScreen.proposal')}{strategy==="balanced"?t('productsScreen.proposalTypes.balanced'):strategy==="eco"?t('productsScreen.proposalTypes.economic'):strategy==="fast"?t('productsScreen.proposalTypes.fast'):t('productsScreen.proposalTypes.singleShop')}</Text>
        <View style={prodStyles.summaryStats}>
          <View style={prodStyles.statBox}>
            <Text style={prodStyles.statValue}>{fmtPrice(summary.price)}</Text>
            <Text style={prodStyles.statLabel}>{t('productsScreen.total').replace(/[:•]/g,'').trim() || 'Total'}</Text>
          </View>
          <View style={prodStyles.statDivider} />
          <View style={prodStyles.statBox}>
            <Text style={prodStyles.statValue}>{summary.time}{t('productsScreen.minutes')}</Text>
            <Text style={prodStyles.statLabel}>{t('productsScreen.time').replace(/[:•]/g,'').trim() || 'Temps'}</Text>
          </View>
          <View style={prodStyles.statDivider} />
          <View style={prodStyles.statBox}>
            <Text style={prodStyles.statValue}>{summary.shops}</Text>
            <Text style={prodStyles.statLabel}>{t('productsScreen.shops').replace(/[:•]/g,'').trim() || 'Shops'}</Text>
          </View>
        </View>
      </View>

      {/* Bandeau info quand liste vide */}
      {showingDefaults && !loading && (
        <View style={prodStyles.infoBanner}>
          <Ionicons name="information-circle" size={18} color={THEME.brand} />
          <Text style={prodStyles.infoTxt}>{t('productsScreen.defaultProducts') || 'Ajoutez des articles dans Ma Liste puis appuyez sur "Trouver produits exacts" pour voir les résultats ici.'}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{marginTop:24}} color={THEME.brand} />
      ) : (
        <FlatList
          data={(function(){
      const src = Array.isArray(groups)?groups:[];
      const user = __getUserItems();
      const mapped = src.map(g=>{
        const assigned = g.items || g.products || g.lines || [];
        return { ...g, __renderItems: (Array.isArray(assigned)&&assigned.length>0 ? assigned : user) };
      });
      // Tri : favoris en haut, puis si balanced → plus de produits en premier
      mapped.sort((a,b) => {
        const aF = favShops.includes(a.name) ? 0 : 1;
        const bF = favShops.includes(b.name) ? 0 : 1;
        if (aF !== bF) return aF - bF;
        if (strategy === 'balanced') {
          const aP = (a.products || a.__renderItems || []).length;
          const bP = (b.products || b.__renderItems || []).length;
          return bP - aP;
        }
        return 0;
      });
      return mapped;
    })()}
          keyExtractor={(g,i)=>String(g?.name||'shop')+'_'+i}
          renderItem={({item,index})=>(
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={()=>{
                const wasChecked = !!checkedShops[index];
                setCheckedShops(prev=>({...prev,[index]:!wasChecked}));
                setPopupSelectedItems(prev => prev.map(si => si.shopIndex === index ? {...si, checked: !wasChecked} : si));
              }}
              style={[prodStyles.card, checkedShops[index] && prodStyles.cardOn]}>
              <View style={prodStyles.cardHead}>
                <View style={prodStyles.cardHeadLeft}>
                  <Square value={!!checkedShops[index]} onPress={()=>{
                    const wasChecked = !!checkedShops[index];
                    setCheckedShops(prev=>({...prev,[index]:!wasChecked}));
                    setPopupSelectedItems(prev => prev.map(si => si.shopIndex === index ? {...si, checked: !wasChecked} : si));
                  }} />
                  <View style={prodStyles.shopIcon}>
                    <Ionicons name="storefront" size={22} color={THEME.brand} />
                  </View>
                  <View style={{flex:1}}>
                    <Text numberOfLines={1} style={prodStyles.shopName}>{item?.name||t('productsScreen.defaultShop')}</Text>
                    <View style={prodStyles.metaRow}>
                      {item?.distance ? (
                        <View style={prodStyles.metaChip}>
                          <Ionicons name="location-outline" size={12} color={THEME.muted} />
                          <Text style={prodStyles.metaTxt}>{item.distance}</Text>
                        </View>
                      ) : null}
                      {item?.time ? (
                        <View style={prodStyles.metaChip}>
                          <Ionicons name="time-outline" size={12} color={THEME.muted} />
                          <Text style={prodStyles.metaTxt}>{item.time}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={()=>toggleShopFav({name:item?.name})}
                  style={[prodStyles.shopFavBtn, {
                    borderColor: isShopFav(item?.name) ? THEME.brand : THEME.border,
                    backgroundColor: isShopFav(item?.name) ? THEME.brandSoft : THEME.card,
                  }]}
                >
                  <Ionicons
                    name={isShopFav(item?.name) ? "heart" : "heart-outline"}
                    size={17}
                    color={isShopFav(item?.name) ? THEME.brand : THEME.muted}
                  />
                </TouchableOpacity>
              </View>
              {mode==="delivery" ? (
                <View style={prodStyles.feeRow}>
                  <Ionicons name="bicycle-outline" size={14} color={THEME.muted} />
                  <Text style={prodStyles.feeTxt}>{t('productsScreen.deliveryFee')}{fmtPrice(item?.deliveryFee||0)}</Text>
                </View>
              ) : null}

              {/* Display original products with quantity controls */}
              {(Array.isArray(item?.products)?item.__renderItems:[]).map((p,i)=>(
                <View key={i} style={prodStyles.productRow}>
                  <View style={prodStyles.productLine}>
                    {/* Qty + Title — green if matched product found, red if not */}
                    {(() => {
                      const pName = String(p?.title || p?.name || '').toLowerCase().trim();
                      const pWords = pName.split(/\s+/).filter(w => w.length > 2);
                      const matchedQty = popupSelectedItems.filter(si => {
                        if (si.shopIndex !== index) return false;
                        const sName = String(si.name || '').toLowerCase().trim();
                        const sWords = sName.split(/\s+/).filter(w => w.length > 2);
                        return pWords.some(pw => sWords.some(sw => sw.includes(pw) || pw.includes(sw)));
                      }).reduce((s, si) => s + (si.qty || 1), 0);
                      const needed = Number(p?.qty || 1);
                      const isMatched = matchedQty >= needed;
                      const qtyColor = isMatched ? BRAND : '#EF4444';
                      return <><View style={[prodStyles.qtyBadge, {backgroundColor: isMatched ? THEME.brandSoft : THEME.dangerSoft}]}><Text style={[prodStyles.qtyBadgeTxt, {color:qtyColor}]}>x{needed}</Text></View>
                    <Text numberOfLines={1} style={prodStyles.productTitle}>{String(p?.title||'')}</Text>
                    {isMatched ? (
                      <View style={prodStyles.addedTag}>
                        <Ionicons name="checkmark-circle" size={14} color={BRAND} />
                        <Text style={prodStyles.addedTagTxt}>{t('cart.added') || 'Ajouté'}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.85} style={prodStyles.searchBtn} onPress={()=>{ __setActiveQuery(String(p?.title||p?.name||''));  __setInitialQuery(String(p?.title||p?.name||"")); __setActiveShopName(String(item?.name||'')); __setActiveShopIndex(index); __setSearchVisible(true); }}><Ionicons name="search" size={13} color="#fff" /><Text style={prodStyles.searchBtnTxt}>{t('productsScreen.search')}</Text></TouchableOpacity>
                    )}</>;
                    })()}
                  </View>

                  {/* Show matching selected items below each product */}
                  {popupSelectedItems
                    .filter(selected => {
                      // Must match this shop
                      if (selected.shopIndex !== index) return false;
                      const productName = String(p?.title || p?.name || '').toLowerCase().trim();
                      const selectedName = String(selected?.name || '').toLowerCase().trim();
                      if (!productName || !selectedName) return false;
                      // Smart matching: check if words overlap significantly
                      const productWords = productName.split(/\s+/).filter(w => w.length > 2);
                      const selectedWords = selectedName.split(/\s+/).filter(w => w.length > 2);
                      return productWords.some(pw => selectedWords.some(sw => sw.includes(pw) || pw.includes(sw)));
                    })
                    .map(selectedItem => (
                      <View key={selectedItem.id} style={prodStyles.picked}>
                        <View style={prodStyles.pickedRow}>
                          <Square
                            value={selectedItem.checked !== false}
                            onPress={() => {
                              const newChecked = selectedItem.checked === false;
                              setPopupSelectedItems(prev => {
                                const updated = prev.map(si => si.id === selectedItem.id ? {...si, checked: newChecked} : si);
                                if (newChecked) {
                                  setCheckedShops(pr => ({ ...pr, [index]: true }));
                                } else {
                                  // If no more checked products for this shop, uncheck the shop
                                  const shopProducts = (item?.products || []);
                                  const hasAnyChecked = updated.some(si => {
                                    if (si.checked === false) return false;
                                    const siName = String(si.name || '').toLowerCase().trim();
                                    return shopProducts.some(p => {
                                      const pName = String(p?.title || p?.name || '').toLowerCase().trim();
                                      const pWords = pName.split(/\s+/).filter(w => w.length > 2);
                                      const sWords = siName.split(/\s+/).filter(w => w.length > 2);
                                      return pWords.some(pw => sWords.some(sw => sw.includes(pw) || pw.includes(sw)));
                                    });
                                  });
                                  if (!hasAnyChecked) {
                                    setCheckedShops(pr => ({ ...pr, [index]: false }));
                                  }
                                }
                                return updated;
                              });
                            }}
                          />
                          <View style={{width:10}} />
                          <ProductThumb name={selectedItem.name} size={44} />
                          <View style={prodStyles.pickedBody}>
                            <Text style={prodStyles.pickedName}>{selectedItem.name}</Text>
                            {selectedItem.detail ? <Text style={prodStyles.pickedDetail}>{selectedItem.detail}</Text> : null}
                            <View style={prodStyles.pickedPriceRow}>
                              <Text style={prodStyles.pickedPrice}>{fmtPrice(selectedItem.price)}</Text>
                              {selectedItem.unitPrice && <Text style={prodStyles.pickedUnit}>{selectedItem.unitPrice}</Text>}
                              <TouchableOpacity onPress={() => toggleProductFav(selectedItem)} style={prodStyles.pickedFav}>
                                <Ionicons name={favProductNames.has(selectedItem.name) ? "heart" : "heart-outline"} size={18} color={favProductNames.has(selectedItem.name) ? THEME.danger : THEME.faint} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={prodStyles.stepper}>
                            {(selectedItem.qty || 1) <= 1 ? (
                              <TouchableOpacity
                                onPress={() => setPopupSelectedItems(prev => prev.filter(si => si.id !== selectedItem.id))}
                                style={prodStyles.stepBtnDel}
                              >
                                <Ionicons name="trash-outline" size={14} color={THEME.danger} />
                              </TouchableOpacity>
                            ) : (
                              <RepeatButton
                                onPress={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: (si.qty || 1) - 1} : si))}
                                onLongAction={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: Math.max(1, (si.qty || 1) - 1)} : si))}
                                style={prodStyles.stepBtn}
                              >
                                <Ionicons name="remove" size={14} color={THEME.ink} />
                              </RepeatButton>
                            )}
                            <Text style={prodStyles.stepQty}>{selectedItem.qty || 1}</Text>
                            <RepeatButton
                              onPress={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: (si.qty || 1) + 1} : si))}
                              onLongAction={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: (si.qty || 1) + 1} : si))}
                              style={prodStyles.stepBtnAdd}
                            >
                              <Ionicons name="add" size={14} color="#fff" />
                            </RepeatButton>
                          </View>
                        </View>
                      </View>
                    ))}
                </View>
              ))}

              {(() => {
                // Calculate live total from popupSelectedItems for this shop
                const shopSelected = popupSelectedItems.filter(si => si.shopIndex === index);
                const liveTotal = shopSelected.reduce((s, si) => s + (Number(si.price||0) * Number(si.qty||1)), 0);
                const liveTotalWithDelivery = liveTotal + (mode === 'delivery' ? Number(item?.deliveryFee||0) : 0);
                const liveQty = shopSelected.reduce((s, si) => s + Number(si.qty||1), 0);
                return <>
                  {/* Bouton ajouter un produit supplémentaire */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => { __setActiveQuery(''); __setInitialQuery(''); __setActiveShopName(String(item?.name||'')); __setActiveShopIndex(index); __setSearchVisible(true); }}
                    style={prodStyles.addMoreBtn}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={THEME.brandDark} />
                    <Text style={prodStyles.addMoreTxt}>{t('productsScreen.addProduct') || 'Ajouter un produit'}</Text>
                  </TouchableOpacity>

                  <View style={prodStyles.totalsBox}>
                    <View style={prodStyles.totalRow}>
                      <Text style={prodStyles.totalLabel}>{t('productsScreen.productsTotal')}</Text>
                      <Text style={prodStyles.totalValue}>{shopSelected.length} ({liveQty} {t('productsScreen.quantity') || 'quantité'})</Text>
                    </View>
                    <View style={[prodStyles.totalRow, {marginTop:6}]}>
                      <Text style={prodStyles.grandLabel}>{t('cart.total') + ' ' + t('cart.totalPrice', {defaultValue: 'prix'})}</Text>
                      <Text style={prodStyles.grandValue}>{fmtPrice(liveTotal)}</Text>
                    </View>
                    {mode==="delivery" ? (
                      <View style={[prodStyles.totalRow, {marginTop:6}]}>
                        <Text style={prodStyles.totalLabel}>{t('productsScreen.totalWithDelivery')}</Text>
                        <Text style={prodStyles.totalValue}>{fmtPrice(liveTotalWithDelivery)}</Text>
                      </View>
                    ) : null}
                  </View>
                </>;
              })()}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={prodStyles.empty}>
              <View style={prodStyles.emptyCircle}>
                <Ionicons name="cart-outline" size={44} color="#fff" />
              </View>
              <Text style={prodStyles.emptyTitle}>{t('productsScreen.addFromList') || 'Ajoutez des produits dans Ma Liste'}</Text>
              <Text style={prodStyles.emptyHint}>{t('productsScreen.addFromListSub') || 'Puis appuyez sur "Trouver produits exacts"'}</Text>
            </View>
          }
          contentContainerStyle={{paddingBottom: 220}}
        />
      )}

      {/* Panneau produits sélectionnés en bas */}
      {Object.values(checkedShops).some(v=>v) && (
        <View style={prodStyles.bottomWrap}>
          {/* Liste des produits sélectionnés — max 3.5 visibles */}
          <FlatList
            data={popupSelectedItems.filter(si => checkedShops[si.shopIndex])}
            keyExtractor={(item) => String(item.id)}
            horizontal={false}
            style={prodStyles.bottomList}
            showsVerticalScrollIndicator={true}
            renderItem={({item: si}) => (
              <View style={prodStyles.bottomItem}>
                <ProductThumb name={si.name} size={36} />
                <View style={prodStyles.bottomItemBody}>
                  <Text style={prodStyles.bottomItemName} numberOfLines={1}>{si.name}</Text>
                  <Text style={prodStyles.bottomItemShop}>{si.shop}</Text>
                </View>
                <Text style={prodStyles.bottomItemQty}>x{si.qty||1}</Text>
                <Text style={prodStyles.bottomItemPrice}>{fmtPrice((si.price||0)*(si.qty||1))}</Text>
              </View>
            )}
          />
          {/* Nombre de produits sélectionnés + total */}
          <View style={prodStyles.bottomSummary}>
            <Text style={prodStyles.bottomCount}>
              {popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty||1), 0)} {t('productsScreen.quantity') || 'produits'}
            </Text>
            <Text style={prodStyles.bottomTotal}>
              {fmtPrice(popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (Number(si.price||0) * Number(si.qty||1)), 0))}
            </Text>
          </View>
          {/* Bouton ajouter au panier */}
          <View>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async ()=>{
                try {
                  const cartItems = [];
                  popupSelectedItems.forEach(si => {
                    const shopIdx = si.shopIndex;
                    if (shopIdx === null || shopIdx === undefined || !checkedShops[shopIdx]) return;
                    cartItems.push({
                      name: si.name, detail: si.detail||si.subtitle||'',
                      unitPrice: si.unitPrice||si.pricePerKg||'',
                      qty: si.qty||1, price: si.price||0, shop: si.shop
                    });
                  });
                  const raw = await AsyncStorage.getItem(KEY_CART);
                  const existing = Array.isArray(raw ? JSON.parse(raw) : []) ? (raw ? JSON.parse(raw) : []) : [];
                  const merged = [...existing];
                  const duplicates = [];
                  const newOnly = [];
                  cartItems.forEach(newItem => {
                    const existingIndex = merged.findIndex(e =>
                      String(e.name||'').toLowerCase().trim() === String(newItem.name||'').toLowerCase().trim() &&
                      String(e.shop||'').toLowerCase().trim() === String(newItem.shop||'').toLowerCase().trim()
                    );
                    if (existingIndex >= 0) { duplicates.push({ newItem, existingIndex }); }
                    else { newOnly.push(newItem); }
                  });
                  newOnly.forEach(item => merged.push(item));
                  if (duplicates.length > 0) {
                    setDupItems(duplicates.map(d => ({ ...d, add: false })));
                    setDupMerged(merged);
                    setDupNewOnly(newOnly.length);
                    setDupModalVisible(true);
                  } else {
                    setConfirmCartItems(merged);
                    setConfirmCartVisible(true);
                  }
                } catch(e){}
              }}
              style={prodStyles.cta}
            >
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={prodStyles.ctaTxt}>
                {t('cart.addToCart')} ({popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty||1), 0)})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

          <SearchPopup
            visible={__searchVisible}
            initialQuery={__initialQuery}
            shopName={__activeShopName}
            fmtPrice={fmtPrice}
            onClose={()=>__setSearchVisible(false)} 
            onSelect={(it)=>{
              try{
                // Add the selected item to the popup selected items list
                setPopupSelectedItems(prev => {
                  const exists = prev.find(item => item.id === it.id);
                  if (exists) {
                    return prev.map(item => item.id === it.id ? { ...item, qty: (item.qty || 1) + (it.qty || 1) } : item);
                  }
                  return [...prev, { ...it, qty: it.qty || 1, checked: true, shop: __activeShopName, shopIndex: __activeShopIndex }];
                });
                // Auto-check the shop when a product is selected
                if (__activeShopIndex !== null) {
                  setCheckedShops(prev => ({ ...prev, [__activeShopIndex]: true }));
                }
              }catch(e){}
            }}
          />


      {/* Modal doublons panier */}
      <Modal visible={dupModalVisible} animationType="slide" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'80%', paddingBottom:40}}>
            {/* Header */}
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
              <View>
                <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>{t('cart.duplicateProducts')}</Text>
                <Text style={{fontSize:13, color:'#6B7280', marginTop:4}}>{dupItems.length} {t('cart.duplicateCount')}</Text>
              </View>
              <TouchableOpacity onPress={() => setDupModalVisible(false)} style={{padding:6}}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Liste des produits en doublon */}
            <FlatList
              data={dupItems}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{padding:16}}
              renderItem={({item: dup, index: di}) => {
                const existingQty = dupMerged[dup.existingIndex]?.qty || 1;
                return (
                  <View style={{
                    flexDirection:'row', alignItems:'center', padding:14, marginBottom:10,
                    backgroundColor: dup.add ? '#F0FDF4' : '#FEF2F2', borderRadius:12,
                    borderWidth:1, borderColor: dup.add ? '#BBF7D0' : '#FECACA'
                  }}>
                    <ProductThumb name={dup.newItem.name} size={44} />
                    <View style={{flex:1, marginLeft:12}}>
                      <Text style={{fontSize:15, fontWeight:'700', color:'#111'}}>{dup.newItem.name}</Text>
                      <Text style={{fontSize:12, color:'#6B7280', marginTop:2}}>{dup.newItem.shop}</Text>
                      <Text style={{fontSize:12, color:'#9CA3AF', marginTop:2}}>{t('cart.alreadyInCart')} {existingQty}</Text>
                    </View>
                    <View style={{flexDirection:'row', gap:6}}>
                      <TouchableOpacity
                        onPress={() => setDupItems(prev => prev.map((d, i) => i === di ? {...d, add: false} : d))}
                        style={{
                          paddingHorizontal:12, paddingVertical:8, borderRadius:10,
                          backgroundColor: !dup.add ? '#EF4444' : '#F3F4F6'
                        }}
                      >
                        <Text style={{color: !dup.add ? '#fff' : '#999', fontWeight:'700', fontSize:12}}>{t('cart.ignore')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDupItems(prev => prev.map((d, i) => i === di ? {...d, add: true} : d))}
                        style={{
                          paddingHorizontal:12, paddingVertical:8, borderRadius:10,
                          backgroundColor: dup.add ? BRAND : '#F3F4F6'
                        }}
                      >
                        <Text style={{color: dup.add ? '#fff' : '#999', fontWeight:'700', fontSize:12}}>{t('cart.addItem')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />

            {/* Boutons de confirmation */}
            <View style={{paddingHorizontal:16, gap:10}}>
              <TouchableOpacity
                onPress={async () => {
                  const finalMerged = [...dupMerged];
                  dupItems.forEach(d => {
                    if (d.add) {
                      const existingQty = finalMerged[d.existingIndex]?.qty || 1;
                      finalMerged[d.existingIndex] = { ...finalMerged[d.existingIndex], qty: existingQty + (d.newItem.qty || 1) };
                    }
                  });
                  const added = dupItems.filter(d => d.add).length + dupNewOnly;
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify(finalMerged));
                  DeviceEventEmitter.emit('CART_UPDATED');

                  // Cross off added items in Ma Liste
                  const selectedRaw2 = await AsyncStorage.getItem(KEY_SELECTED);
                  const selectedItems2 = selectedRaw2 ? JSON.parse(selectedRaw2) : [];
                  const originalNames2 = selectedItems2.map(si => norm(si.name));
                  const productNames2 = dupItems.filter(d => d.add).map(d => norm(d.newItem.name));
                  const allNames2 = [...new Set([...originalNames2, ...productNames2])];
                  const listRaw2 = await AsyncStorage.getItem(KEY_ITEMS);
                  if (listRaw2) {
                    const listItems2 = JSON.parse(listRaw2);
                    const updated2 = listItems2.map(it => {
                      const itName = norm(it.name || it.title || '');
                      if (allNames2.some(n => n.includes(itName) || itName.includes(n))) {
                        return { ...it, crossed: true, selected: false };
                      }
                      return it;
                    });
                    await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify(updated2));
                  }
                  await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
                  setGroups([]); setSummary({price:0,time:0,shops:0});
                  setShowingDefaults(true);
                  setCartPushed(true);
                  setCheckedShops({});
                  setPopupSelectedItems([]);
                  setDupModalVisible(false);
                  setCartSuccessCount(added);
                  setCartSuccessVisible(true);
                  navigation.navigate('cart');
                }}
                style={{height:50, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDupModalVisible(false)}
                style={{height:44, borderRadius:14, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#666', fontWeight:'600'}}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal confirmation ajout panier */}
      <Modal visible={confirmCartVisible} animationType="slide" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'70%', paddingBottom:40}}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
              <View>
                <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>{t('cart.addToCart')}</Text>
                {(() => {
                  const active = popupSelectedItems.filter(si => checkedShops[si.shopIndex]);
                  const shopCount = new Set(active.map(si => si.shop)).size;
                  const totalQty = active.reduce((s, si) => s + (si.qty || 1), 0);
                  return <Text style={{fontSize:13, color:'#6B7280', marginTop:4}}>
                    {shopCount} {shopCount > 1 ? 'shops' : 'shop'} • {totalQty} {t('productsScreen.quantity') || 'quantité'}
                  </Text>;
                })()}
              </View>
              <TouchableOpacity onPress={() => setConfirmCartVisible(false)} style={{padding:6}}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={(() => {
                // Group by shop
                const active = popupSelectedItems.filter(si => checkedShops[si.shopIndex]);
                const byShop = {};
                active.forEach(si => {
                  if (!byShop[si.shop]) byShop[si.shop] = { shop: si.shop, shopIndex: si.shopIndex, items: [] };
                  byShop[si.shop].items.push(si);
                });
                return Object.values(byShop);
              })()}
              keyExtractor={(item, i) => item.shop + i}
              contentContainerStyle={{padding:16}}
              renderItem={({item: group}) => (
                <View style={{marginBottom:12}}>
                  <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                    <Ionicons name="storefront-outline" size={16} color={BRAND} />
                    <Text style={{fontSize:15, fontWeight:'700', color:'#111', marginLeft:8}}>{group.shop}</Text>
                    <Text style={{fontSize:13, color:'#6B7280', marginLeft:8}}>{fmtPrice(group.items.reduce((s, si) => s + (Number(si.price||0) * Number(si.qty||1)), 0))}</Text>
                  </View>
                  {group.items.map(si => (
                    <View key={si.id} style={{flexDirection:'row', alignItems:'center', padding:10, marginBottom:6, backgroundColor:'#F9FAFB', borderRadius:10}}>
                      <ProductThumb name={si.name} size={36} />
                      <View style={{flex:1, marginLeft:10}}>
                        <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{si.name}</Text>
                        <Text style={{fontSize:11, color:'#6B7280'}}>{si.detail}</Text>
                      </View>
                      <View style={{alignItems:'flex-end'}}>
                        <View style={{flexDirection:'row', alignItems:'center', marginBottom:3}}>
                          {(si.qty || 1) <= 1 ? (
                            <RepeatButton
                              onPress={() => setPopupSelectedItems(prev => prev.filter(p => p.id !== si.id))}
                              onLongAction={() => setPopupSelectedItems(prev => prev.filter(p => p.id !== si.id))}
                              style={{width:24,height:24,borderRadius:12,borderWidth:1.5,borderColor:'#EF4444',alignItems:'center',justifyContent:'center'}}
                            >
                              <Ionicons name="trash-outline" size={11} color="#EF4444" />
                            </RepeatButton>
                          ) : (
                            <RepeatButton
                              onPress={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: (p.qty||1)-1} : p))}
                              onLongAction={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: Math.max(1,(p.qty||1)-1)} : p))}
                              style={{width:24,height:24,borderRadius:12,borderWidth:1.5,borderColor:'#D1D5DB',alignItems:'center',justifyContent:'center'}}
                            >
                              <Ionicons name="remove" size={11} color="#555" />
                            </RepeatButton>
                          )}
                          <Text style={{fontSize:13,fontWeight:'800',color:'#111',marginHorizontal:5,minWidth:16,textAlign:'center'}}>{si.qty || 1}</Text>
                          <RepeatButton
                            onPress={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: (p.qty||1)+1} : p))}
                            onLongAction={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: (p.qty||1)+1} : p))}
                            style={{width:24,height:24,borderRadius:12,backgroundColor:BRAND,alignItems:'center',justifyContent:'center'}}
                          >
                            <Ionicons name="add" size={11} color="#fff" />
                          </RepeatButton>
                        </View>
                        <Text style={{fontSize:12, color:BRAND, fontWeight:'700'}}>{fmtPrice(si.price * (si.qty || 1))}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            />

            <View style={{paddingHorizontal:16, gap:10}}>
              {/* Total */}
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:8, borderTopWidth:1, borderTopColor:'#F3F4F6'}}>
                <Text style={{fontSize:16, fontWeight:'700', color:'#374151'}}>{t('productsScreen.productsTotal')}</Text>
                <Text style={{fontSize:16, fontWeight:'700', color:'#374151'}}>{popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty || 1), 0)}</Text>
              </View>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                <Text style={{fontSize:16, fontWeight:'700', color:'#111'}}>{t('cart.total') + ' ' + t('cart.totalPrice', {defaultValue: 'prix'})}</Text>
                <Text style={{fontSize:16, fontWeight:'700', color:BRAND}}>{fmtPrice(popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (Number(si.price||0) * Number(si.qty||1)), 0))}</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const activeItems = popupSelectedItems.filter(si => checkedShops[si.shopIndex]);
                    const count = activeItems.reduce((s, si) => s + (si.qty || 1), 0);
                    // Replace cart with only the newly selected products
                    const newCart = activeItems.map(si => ({
                      name: si.name,
                      detail: si.detail||si.subtitle||'',
                      unitPrice: si.unitPrice||si.pricePerKg||'',
                      qty: si.qty||1,
                      price: si.price||0,
                      shop: si.shop
                    }));
                    await AsyncStorage.setItem(KEY_CART, JSON.stringify(newCart));
                    DeviceEventEmitter.emit('CART_UPDATED');

                    // Cross off added items in Ma Liste
                    // Collect both product names AND original list item names
                    const selectedRaw = await AsyncStorage.getItem(KEY_SELECTED);
                    const selectedItems = selectedRaw ? JSON.parse(selectedRaw) : [];
                    const originalNames = selectedItems.map(si => norm(si.name));
                    const productNames = activeItems.map(si => norm(si.name));
                    const allNames = [...new Set([...originalNames, ...productNames])];
                    const listRaw = await AsyncStorage.getItem(KEY_ITEMS);
                    if (listRaw) {
                      const listItems = JSON.parse(listRaw);
                      const updated = listItems.map(it => {
                        const itName = norm(it.name || it.title || '');
                        if (allNames.some(n => n.includes(itName) || itName.includes(n))) {
                          return { ...it, crossed: true, selected: false };
                        }
                        return it;
                      });
                      await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify(updated));
                    }

                    // Clear products screen - no more suggestions
                    await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
                    setGroups([]); setSummary({price:0,time:0,shops:0});
                    setShowingDefaults(true);
                    setCartPushed(true);
                    setCheckedShops({});
                    setPopupSelectedItems([]);
                    setConfirmCartVisible(false);
                    setCartSuccessCount(count);
                    setCartSuccessVisible(true);
                    // Navigate to cart
                    navigation.navigate('cart');
                  } catch(e) {}
                }}
                style={{height:50, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('profile.confirm')} ({popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty || 1), 0)})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setConfirmCartVisible(false)}
                style={{height:44, borderRadius:14, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#666', fontWeight:'600'}}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal succès ajout panier */}
      <Modal visible={cartSuccessVisible} transparent animationType="fade">
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center'}}>
          <View style={{backgroundColor:'#fff', borderRadius:24, padding:30, marginHorizontal:30, alignItems:'center', width:'85%'}}>
            <View style={{width:64, height:64, borderRadius:32, backgroundColor:'#ECFDF5', alignItems:'center', justifyContent:'center', marginBottom:16}}>
              <Ionicons name="checkmark-circle" size={40} color={BRAND} />
            </View>
            <Text style={{fontSize:20, fontWeight:'800', color:'#111', textAlign:'center'}}>{t('cart.addedToCart')}</Text>
            <Text style={{fontSize:14, color:'#6B7280', marginTop:8, textAlign:'center'}}>{cartSuccessCount} {t('productsScreen.quantity') || 'produits'} {t('cart.addedToCartSub') || 'ajoutés au panier'}</Text>
            <TouchableOpacity
              onPress={() => { setCartSuccessVisible(false); navigation.navigate('cart'); }}
              style={{marginTop:20, width:'100%', height:50, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}
            >
              <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('cart.viewCart')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCartSuccessVisible(false)}
              style={{marginTop:10, width:'100%', height:44, borderRadius:14, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
            >
              <Text style={{color:'#666', fontWeight:'600'}}>{t('productsScreen.continueShopping') || 'Continuer les courses'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </View>
  );
};

const favStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  segment: { flexDirection: 'row', marginTop: 16, backgroundColor: THEME.subtle, borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 11 },
  segBtnOn: { backgroundColor: THEME.card, ...THEME.shadowSm },
  segTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.muted, marginLeft: 6 },
  segTxtOn: { color: THEME.ink },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 14, paddingHorizontal: 14, height: 48, marginTop: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: THEME.ink, padding: 0 },
  card: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  shopIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  cardSub: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6 },
  metaTxt: { fontSize: 12, color: THEME.muted, marginLeft: 4, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  price: { fontSize: 15.5, fontWeight: '800', color: THEME.ink },
  unitPrice: { fontSize: 11, color: THEME.faint, marginLeft: 6, fontWeight: '600' },
  favBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 50 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});

const FavoritesScreen = () => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const [tab, setTab] = React.useState('shops'); // 'shops' | 'products'
  const [favShops, setFavShops] = React.useState([]);
  const [shopDetails, setShopDetails] = React.useState([]);
  const [favProducts, setFavProducts] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const BRAND = "#09d7aa";

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

  const Header = (
    <View style={favStyles.header}>
      <Text style={favStyles.title}>{t('tabs.favorites')}</Text>
      <Text style={favStyles.subtitle}>
        {tab === 'shops'
          ? `${shopDetails.length} ${t('favorites.shops') || 'Shops'}`
          : `${favProducts.length} ${t('favorites.products') || 'Produits'}`}
      </Text>

      {/* Toggle Shops / Produits */}
      <View style={favStyles.segment}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => { setTab('shops'); setSearchQuery(''); }} style={[favStyles.segBtn, tab === 'shops' && favStyles.segBtnOn]}>
          <Ionicons name={tab === 'shops' ? 'storefront' : 'storefront-outline'} size={16} color={tab === 'shops' ? THEME.brand : THEME.muted} />
          <Text style={[favStyles.segTxt, tab === 'shops' && favStyles.segTxtOn]}>{t('favorites.shops') || 'Shops'}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => { setTab('products'); setSearchQuery(''); }} style={[favStyles.segBtn, tab === 'products' && favStyles.segBtnOn]}>
          <Ionicons name={tab === 'products' ? 'heart' : 'heart-outline'} size={16} color={tab === 'products' ? THEME.brand : THEME.muted} />
          <Text style={[favStyles.segTxt, tab === 'products' && favStyles.segTxtOn]}>{t('favorites.products') || 'Produits'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={favStyles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={THEME.faint} />
        <TextInput value={searchQuery} onChangeText={setSearchQuery}
          placeholder={tab === 'shops' ? (t('favorites.searchPlaceholder') || 'Rechercher un shop') : (t('favorites.searchProductPlaceholder') || 'Rechercher un produit')}
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
            <View style={favStyles.emptyCircle}>
              <Ionicons name={tab === 'shops' ? "storefront-outline" : "heart-outline"} size={44} color="#fff" />
            </View>
            <Text style={favStyles.emptyTitle}>
              {tab === 'shops' ? (t('favorites.noFavorites') || 'Aucun shop favori') : (t('favorites.noFavProducts') || 'Aucun produit favori')}
            </Text>
            <Text style={favStyles.emptyHint}>
              {tab === 'shops' ? (t('favorites.addFromProducts') || 'Ajoutez depuis l\'onglet Produits') : (t('favorites.addProductHint') || 'Appuyez sur le coeur d\'un produit pour l\'ajouter')}
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
          contentContainerStyle={{paddingBottom: 24}}
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
          contentContainerStyle={{paddingBottom: 24}}
          renderItem={({item}) => (
            <View style={favStyles.card}>
              <View style={favStyles.cardRow}>
                <ProductThumb name={item.name} size={44} />
                <View style={favStyles.cardBody}>
                  <Text style={favStyles.cardTitle}>{item.name}</Text>
                  {item.detail ? <Text style={favStyles.cardSub}>{item.detail}</Text> : null}
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
// Simulated order tracking modal
const cartStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  clearBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.dangerSoft, alignItems: 'center', justifyContent: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 50 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  card: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  cardOn: { borderColor: THEME.brand, borderWidth: 2 },
  shopHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: THEME.border },
  shopIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginLeft: 10, marginRight: 10 },
  shopName: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  shopMeta: { fontSize: 12.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },

  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#D7DCE3', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: THEME.brand, borderColor: THEME.brand },

  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  productDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  productBody: { flex: 1, marginLeft: 10, marginRight: 10 },
  productName: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  productDetail: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  productSide: { alignItems: 'flex-end' },
  productPrice: { fontSize: 15.5, fontWeight: '800', color: THEME.ink },
  productUnit: { fontSize: 11, color: THEME.faint, marginTop: 2, fontWeight: '600' },
  productDelBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: THEME.dangerSoft, alignItems: 'center', justifyContent: 'center', marginTop: 6 },

  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 12, height: 34, paddingHorizontal: 3, marginTop: 8, alignSelf: 'flex-start' },
  stepBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepQty: { fontSize: 15, fontWeight: '700', color: THEME.ink, marginHorizontal: 8, minWidth: 18, textAlign: 'center' },

  addMoreBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, borderWidth: 1, borderColor: THEME.brand, borderStyle: 'dashed', backgroundColor: THEME.brandSoft },
  addMoreTxt: { color: THEME.brandDark, fontWeight: '700', fontSize: 13.5, marginLeft: 6 },

  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: THEME.border },
  subtotalLabel: { fontSize: 12.5, color: THEME.muted, fontWeight: '600' },
  subtotalValue: { fontSize: 15, fontWeight: '800', color: THEME.brand },

  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: THEME.card, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 28 : 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: THEME.border, ...THEME.shadow },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomCount: { fontSize: 13.5, fontWeight: '700', color: THEME.muted },
  bottomCountVal: { fontSize: 13.5, fontWeight: '700', color: THEME.ink },
  bottomTotalLabel: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  bottomTotalVal: { fontSize: 20, fontWeight: '900', color: THEME.brand },
  cta: { marginTop: 12, height: 52, borderRadius: 16, backgroundColor: THEME.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },
  ctaDisabled: { backgroundColor: THEME.faint },

  // Bottom sheet modals
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...THEME.shadow },
  sheetGrabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.border, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: THEME.ink, letterSpacing: -0.4 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center' },

  // Segmented control (delivery / collect)
  segment: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: THEME.subtle, borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 11 },
  segBtnOn: { backgroundColor: THEME.card, ...THEME.shadowSm },
  segTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.muted, marginLeft: 6 },
  segTxtOn: { color: THEME.ink },

  // Shop block inside confirm sheet
  shopBlock: { marginTop: 14, padding: 14, backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  shopBlockHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  shopBlockName: { fontSize: 15, fontWeight: '700', color: THEME.ink, marginLeft: 8 },
  miniRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  miniName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  miniPrice: { fontSize: 12, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  miniStepper: { flexDirection: 'row', alignItems: 'center', width: 96, justifyContent: 'space-between' },
  miniStepBtn: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.subtle },
  miniStepBtnDel: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.dangerSoft },
  miniStepQty: { fontSize: 14, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  blockAddBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, marginBottom: 4, paddingHorizontal: 12, height: 34, borderRadius: 10, backgroundColor: THEME.subtle },
  blockAddTxt: { fontSize: 12.5, fontWeight: '700', color: THEME.ink, marginLeft: 6 },
  blockSubtotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: THEME.border },
  blockSubLabel: { fontSize: 13, color: THEME.muted, fontWeight: '600' },
  blockSubVal: { fontSize: 13.5, fontWeight: '800', color: THEME.ink },

  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingHorizontal: 2 },
  feeLabel: { fontSize: 13, color: THEME.muted, fontWeight: '600' },
  feeValue: { fontSize: 13.5, fontWeight: '800', color: THEME.ink },
  feeValueFree: { fontSize: 13.5, fontWeight: '800', color: THEME.brand },

  // Info card (collect / address)
  infoCard: { marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: THEME.subtle },
  infoCardHead: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  infoSub: { fontSize: 12.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  infoNote: { fontSize: 12.5, color: THEME.faint, marginTop: 10, marginLeft: 48, fontWeight: '600' },

  addrCard: { marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: THEME.subtle },
  addrHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addrHeadLeft: { flexDirection: 'row', alignItems: 'center' },
  addrTitle: { fontSize: 14, fontWeight: '700', color: THEME.ink, marginLeft: 8 },
  addrEditTxt: { fontSize: 13, fontWeight: '700', color: THEME.brand },
  addrFieldLabel: { fontSize: 12, fontWeight: '700', color: THEME.muted, marginBottom: 6 },
  addrInput: { backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: THEME.ink },
  addrSuggestBox: { backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  addrSuggestRow: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  addrSuggestTxt: { fontSize: 13, color: THEME.ink, marginLeft: 8, fontWeight: '600' },
  addrBtnRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  addrCancelBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },
  addrCancelTxt: { color: THEME.muted, fontWeight: '700', fontSize: 14 },
  addrSaveBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center' },
  addrSaveTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  addrDisplay: { marginTop: 10, marginLeft: 28 },
  addrDisplayRow: { flexDirection: 'row', alignItems: 'center' },
  addrDisplayTxt: { fontSize: 13, color: THEME.ink, marginLeft: 6, flex: 1, fontWeight: '600' },
  addrDisplaySub: { fontSize: 12.5, color: THEME.muted, marginLeft: 6, fontWeight: '600' },

  // Slot picker
  slotSection: { marginTop: 18 },
  slotSectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  slotSectionTitle: { fontSize: 15, fontWeight: '700', color: THEME.ink, marginLeft: 10 },
  dayPill: { paddingHorizontal: 14, height: 38, borderRadius: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  dayPillOn: { backgroundColor: THEME.brand, borderColor: THEME.brand },
  dayPillTxt: { fontSize: 13, fontWeight: '700', color: THEME.muted },
  dayPillTxtOn: { color: '#fff' },
  periodGroup: { marginBottom: 14 },
  periodHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  periodLabel: { fontSize: 11.5, fontWeight: '800', color: THEME.muted, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  slotChip: { width: '31.5%', marginBottom: 8, paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  slotChipOn: { backgroundColor: THEME.brand, borderColor: THEME.brand },
  slotChipTxt: { fontSize: 11, fontWeight: '700', color: THEME.muted },
  slotChipTxtOn: { color: '#fff' },
  noSlots: { padding: 22, alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 16 },
  noSlotsTxt: { fontSize: 13, color: THEME.muted, marginTop: 8, fontWeight: '600' },

  // Totals box
  totalsBox: { marginTop: 16, padding: 14, backgroundColor: THEME.subtle, borderRadius: 16 },
  slotBanner: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: THEME.border },
  slotBannerDay: { fontSize: 13, fontWeight: '700', color: THEME.ink, marginLeft: 8 },
  slotBannerTime: { fontSize: 13, color: THEME.brand, fontWeight: '700', marginLeft: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 13.5, color: THEME.muted, fontWeight: '600' },
  totalValue: { fontSize: 13.5, fontWeight: '700', color: THEME.ink },
  totalValueFree: { fontSize: 13.5, fontWeight: '700', color: THEME.brand },
  grandRow: { borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandLabel: { fontSize: 17, fontWeight: '900', color: THEME.ink },
  grandValue: { fontSize: 17, fontWeight: '900', color: THEME.brand },
  itemsCaption: { fontSize: 12, color: THEME.faint, textAlign: 'center', marginTop: 12, fontWeight: '600' },

  sheetFooter: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  primaryBtn: { height: 52, borderRadius: 16, backgroundColor: THEME.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  primaryBtnDisabled: { backgroundColor: THEME.faint },
  primaryBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },
  ghostBtn: { height: 46, borderRadius: 14, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center' },
  ghostBtnTxt: { color: THEME.muted, fontWeight: '700', fontSize: 15 },

  // Search field inside modals
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 14, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: THEME.ink, padding: 0 },

  // Picker product row (shop products / add products lists)
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, marginBottom: 8, borderRadius: 14, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  pickerRowOn: { backgroundColor: THEME.brandSoft, borderColor: THEME.brand },
  pickerBody: { flex: 1, marginLeft: 12, marginRight: 10 },
  pickerName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  pickerDetail: { fontSize: 12, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  pickerPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 3 },
  pickerPrice: { fontSize: 14, fontWeight: '800', color: THEME.ink },
  pickerUnit: { fontSize: 10.5, color: THEME.faint, marginLeft: 4, fontWeight: '600' },
  pickerAddBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.brand },
  pickerAddPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brand, paddingHorizontal: 12, height: 36, borderRadius: 12 },
  pickerAddPillTxt: { fontSize: 13, fontWeight: '700', color: '#fff', marginLeft: 4 },
  pickerInCart: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, paddingHorizontal: 10, height: 32, borderRadius: 10 },
  pickerInCartTxt: { fontSize: 12, fontWeight: '700', color: THEME.muted, marginLeft: 4 },
  pickerStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 12, paddingHorizontal: 3, height: 36 },
  pickerStepBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card },
  pickerStepQty: { fontSize: 14, fontWeight: '800', color: THEME.ink, marginHorizontal: 12 },
  pickerEmpty: { alignItems: 'center', paddingVertical: 34 },
  pickerEmptyTxt: { fontSize: 14, color: THEME.muted, fontWeight: '600' },
  addrPickBadge: { marginLeft: 8, paddingHorizontal: 7, height: 18, borderRadius: 6, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center' },
  addrPickBadgeTxt: { fontSize: 9.5, fontWeight: '800', color: THEME.brandDark, letterSpacing: 0.3 },
  addedSummary: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  addedSummaryTitle: { fontSize: 13, fontWeight: '800', color: THEME.ink, marginBottom: 4 },
  addedSummaryLine: { fontSize: 12, color: THEME.muted, fontWeight: '600' },

  // OrderTracker
  trackerHeader: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: THEME.border },
  trackerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackerTitle: { fontSize: 24, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  trackerOrderNo: { fontSize: 13, color: THEME.muted, marginTop: 3, fontWeight: '600' },
  etaWrap: { alignItems: 'center', paddingVertical: 26 },
  etaCircle: { width: 108, height: 108, borderRadius: 54, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: THEME.brand },
  etaValue: { fontSize: 19, fontWeight: '900', color: THEME.brandDark, marginTop: 2 },
  etaCaption: { fontSize: 15, fontWeight: '700', color: THEME.ink, marginTop: 14 },
  stepsWrap: { paddingHorizontal: 24 },
  stepItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepDotOn: { backgroundColor: THEME.brand },
  stepDotOff: { backgroundColor: THEME.subtle },
  stepConnector: { position: 'absolute', left: 17, top: 36, width: 2, height: 20 },
  stepLabelWrap: { marginLeft: 14, flex: 1 },
  stepLabel: { fontSize: 15 },
  stepLabelOn: { fontWeight: '700', color: THEME.ink },
  stepLabelOff: { fontWeight: '600', color: THEME.faint },
  trackerSummaryScroll: { marginTop: 14, marginHorizontal: 20, maxHeight: 240 },
  trackerSummaryCard: { padding: 14, backgroundColor: THEME.subtle, borderRadius: 16 },
  trackerSummaryTitle: { fontSize: 13, fontWeight: '800', color: THEME.muted, marginBottom: 10 },
  trackerShopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  trackerShopName: { fontSize: 13, fontWeight: '700', color: THEME.brandDark, marginLeft: 6 },
  trackerLineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingLeft: 20 },
  trackerLineName: { color: THEME.ink, fontSize: 13, flex: 1, fontWeight: '600' },
  trackerLinePrice: { color: THEME.ink, fontSize: 13, fontWeight: '600' },
  trackerTotalRow: { borderTopWidth: 1, borderTopColor: THEME.border, marginTop: 6, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  trackerTotalLabel: { fontSize: 15, fontWeight: '900', color: THEME.ink },
  trackerTotalValue: { fontSize: 15, fontWeight: '900', color: THEME.brand },
  trackerFooter: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
});

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
      <SafeAreaView style={cartStyles.screen} edges={[]}>
        {/* Header */}
        <View style={cartStyles.trackerHeader}>
          <View style={cartStyles.trackerHeaderRow}>
            <Text style={cartStyles.trackerTitle}>{t('cart.orderTracking')}</Text>
            <TouchableOpacity onPress={onCancel || onClose} activeOpacity={0.8} style={cartStyles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.muted} />
            </TouchableOpacity>
          </View>
          <Text style={cartStyles.trackerOrderNo}>N° {orderNumber}</Text>
        </View>

        {/* ETA */}
        <View style={cartStyles.etaWrap}>
          <View style={cartStyles.etaCircle}>
            {currentStep >= 4 ? (
              <Ionicons name="checkmark" size={50} color={THEME.brand} />
            ) : (
              <>
                <Ionicons name="time-outline" size={34} color={THEME.brand} />
                <Text style={cartStyles.etaValue}>{eta} min</Text>
              </>
            )}
          </View>
          <Text style={cartStyles.etaCaption}>
            {currentStep >= 4 ? (isCollect ? t('cart.orderCollected') : t('cart.orderArrived')) : (isCollect ? t('cart.estimatedPickup') : t('cart.estimatedDelivery'))}
          </Text>
        </View>

        {/* Steps */}
        <View style={cartStyles.stepsWrap}>
          {steps.map((step, i) => (
            <View key={i} style={cartStyles.stepItem}>
              <View style={[cartStyles.stepDot, i <= currentStep ? cartStyles.stepDotOn : cartStyles.stepDotOff]}>
                <Ionicons name={step.icon} size={18} color={i <= currentStep ? '#fff' : THEME.faint} />
              </View>
              {i < steps.length - 1 && (
                <View style={[cartStyles.stepConnector, { backgroundColor: i < currentStep ? THEME.brand : THEME.border }]} />
              )}
              <View style={cartStyles.stepLabelWrap}>
                <Text style={[cartStyles.stepLabel, i <= currentStep ? cartStyles.stepLabelOn : cartStyles.stepLabelOff]}>{step.label}</Text>
              </View>
              {i <= currentStep && (
                <Ionicons name="checkmark" size={18} color={THEME.brand} />
              )}
            </View>
          ))}
        </View>

        {/* Order summary */}
        <ScrollView style={cartStyles.trackerSummaryScroll} showsVerticalScrollIndicator={false}>
          <View style={cartStyles.trackerSummaryCard}>
            <Text style={cartStyles.trackerSummaryTitle}>{t('cart.summary')}</Text>
            {(() => {
              const grouped = {};
              (items || []).forEach(it => {
                const shop = it.shop || '__other__';
                if (!grouped[shop]) grouped[shop] = [];
                grouped[shop].push(it);
              });
              return Object.entries(grouped).map(([shop, shopItems], si) => (
                <View key={si} style={{ marginBottom: 10 }}>
                  <View style={cartStyles.trackerShopRow}>
                    <Ionicons name="storefront" size={14} color={THEME.brand} />
                    <Text style={cartStyles.trackerShopName}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                  </View>
                  {shopItems.map((it, i) => (
                    <View key={i} style={cartStyles.trackerLineRow}>
                      <Text style={cartStyles.trackerLineName}>{it.qty || 1}x {t('productNames.' + (it.name || it.title), { defaultValue: it.name || it.title })}</Text>
                      <Text style={cartStyles.trackerLinePrice}>{fmtPrice(Number(it.price || 0) * Number(it.qty || 1))}</Text>
                    </View>
                  ))}
                </View>
              ));
            })()}
            <View style={cartStyles.trackerTotalRow}>
              <Text style={cartStyles.trackerTotalLabel}>{t('cart.total')}</Text>
              <Text style={cartStyles.trackerTotalValue}>{fmtPrice(total || 0)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Close button */}
        {currentStep >= 4 && (
          <View style={cartStyles.trackerFooter}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.9} style={cartStyles.primaryBtn}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={cartStyles.primaryBtnTxt}>{t('cart.done')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const formatSavedAddress = (a) =>
  a
    ? [
        a.house_building,
        a.road_area_colony,
        [a.pincode, a.city].filter(Boolean).join(' ').trim(),
        a.state,
      ]
        .map((s) => (s || '').toString().trim())
        .filter(Boolean)
        .join(', ')
    : '';

const formatAddressContact = (a) =>
  a
    ? [
        [a.first_name, a.last_name].filter(Boolean).join(' ').trim(),
        [a.phone_code, a.phone_number].filter(Boolean).join(' ').trim(),
      ]
        .filter(Boolean)
        .join('  •  ')
    : '';

const CartScreen = ({ isAuth }) => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const navigation = useNavigation();
  const [cartItems, setCartItems] = React.useState([]);
  const [orderVisible, setOrderVisible] = React.useState(false);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
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
  const [selectedDateIndex, setSelectedDateIndex] = React.useState(0);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [addProductShop, setAddProductShop] = React.useState(null); // shop name for add product popup
  const [addProductSearch, setAddProductSearch] = React.useState('');

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

  const loadAddresses = React.useCallback(async () => {
    setAddressesLoading(true);
    try {
      const list = await fetchAddresses();
      const arr = Array.isArray(list) ? list : [];
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

  useFocusEffect(React.useCallback(() => { loadCart(); loadAddresses(); }, [loadCart, loadAddresses]));

  // Reload cart when products are added from Products screen
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('CART_UPDATED', loadCart);
    return () => sub.remove();
  }, [loadCart]);

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
      <View style={cartStyles.screen}>
        <SafeAreaView style={cartStyles.screen} edges={['top']}>
          <View style={cartStyles.header}>
            <Text style={cartStyles.title}>{t('tabs.cart')}</Text>
            <Text style={cartStyles.subtitle}>0 {t('productsScreen.quantity')}</Text>
          </View>
          <View style={cartStyles.empty}>
            <View style={cartStyles.emptyCircle}>
              <Ionicons name="bag-handle-outline" size={44} color="#fff" />
            </View>
            <Text style={cartStyles.emptyTitle}>{t('cart.emptyCart')}</Text>
            <Text style={cartStyles.emptyHint}>{t('cart.addProductsFromTab')}</Text>
          </View>
        </SafeAreaView>
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
            <Text style={cartStyles.subtitle}>{cartItems.reduce((s, it) => s + Number(it.qty || 1), 0)} {t('productsScreen.quantity')}</Text>
          </View>
          <TouchableOpacity onPress={clearCart} activeOpacity={0.8} style={cartStyles.clearBtn}>
            <Ionicons name="trash-outline" size={19} color={THEME.danger} />
          </TouchableOpacity>
        </View>
      </View>
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
                  {someSelected ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                </View>
              </TouchableOpacity>
              <View style={cartStyles.shopIcon}>
                <Ionicons name="storefront" size={18} color={THEME.brand} />
              </View>
              <View style={{flex:1}}>
                <Text style={cartStyles.shopName}>{group.shop}</Text>
                <Text style={cartStyles.shopMeta}>
                  {group.items.reduce((s, it) => s + Number(it.qty || 1), 0)} {t('productsScreen.quantity')} • {fmtPrice(group.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0))}
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
                    {!!selectedCart[idx] ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                  </View>
                </TouchableOpacity>
                <View style={{ marginLeft: 10 }}>
                  <ProductThumb name={item.name || item.title} size={44} />
                </View>
                <View style={cartStyles.productBody}>
                  <Text style={cartStyles.productName}>{t('productNames.' + (item.name || item.title), { defaultValue: item.name || item.title })}</Text>
                  {item.detail ? <Text style={cartStyles.productDetail} numberOfLines={1}>{t('productDetails.' + item.detail, { defaultValue: item.detail })}</Text> : null}
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
              <Text style={cartStyles.addMoreTxt}>{t('productsScreen.addProduct') || 'Ajouter un produit'}</Text>
            </TouchableOpacity>

            {/* Shop subtotal */}
            <View style={cartStyles.subtotalRow}>
              <Text style={cartStyles.subtotalLabel}>{group.items.filter(it => selectedCart[it._originalIndex]).reduce((s, it) => s + Number(it.qty || 1), 0)} {t('productsScreen.quantity')}</Text>
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
          <Text style={cartStyles.bottomTotalLabel}>{t('cart.total')}</Text>
          <Text style={cartStyles.bottomTotalVal}>{fmtPrice(totalPrice)}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={() => { if (!isAuth) { DeviceEventEmitter.emit('OPEN_AUTH'); return; } setConfirmVisible(true); }} style={cartStyles.cta}>
          <Ionicons name="bicycle" size={20} color="#fff" />
          <Text style={cartStyles.ctaTxt}>{t('cart.confirmOrder')}</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Modal de confirmation de commande */}
      <Modal visible={confirmVisible} animationType="slide" transparent={true}>
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
                <Ionicons name="bicycle-outline" size={16} color={orderMode === 'delivery' ? THEME.brand : THEME.muted} />
                <Text style={[cartStyles.segTxt, orderMode === 'delivery' && cartStyles.segTxtOn]}>{t('cart.delivery')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOrderMode('collect')}
                style={[cartStyles.segBtn, orderMode === 'collect' && cartStyles.segBtnOn]}
              >
                <Ionicons name="bag-handle-outline" size={16} color={orderMode === 'collect' ? THEME.brand : THEME.muted} />
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
                      <Text style={cartStyles.shopBlockName}>{shop}</Text>
                    </View>
                    {items.map((it, i) => (
                      <View key={i} style={[cartStyles.miniRow, i < items.length - 1 && cartStyles.productDivider]}>
                        <ProductThumb name={it.name || it.title} size={40} />
                        <View style={{flex:1, marginLeft:10}}>
                          <Text style={cartStyles.miniName}>{it.name || it.title}</Text>
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
                                setCartItems(prev => { const u = [...prev]; u[it._origIdx] = {...u[it._origIdx], qty: Math.max(1, (u[it._origIdx].qty || 1) - 1)}; return u; });
                              }
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; const q = u[it._origIdx].qty || 1; if (q > 1) u[it._origIdx] = {...u[it._origIdx], qty: q - 1}; return u; });
                            }}
                            style={(it.qty || 1) <= 1 ? cartStyles.miniStepBtnDel : cartStyles.miniStepBtn}
                          >
                            <Ionicons name={(it.qty || 1) <= 1 ? "trash-outline" : "remove"} size={14} color={(it.qty || 1) <= 1 ? THEME.danger : THEME.ink} />
                          </RepeatButton>
                          <Text style={cartStyles.miniStepQty}>{it.qty || 1}</Text>
                          <RepeatButton
                            onPress={() => {
                              setCartItems(prev => { const u = [...prev]; u[it._origIdx] = {...u[it._origIdx], qty: (u[it._origIdx].qty || 1) + 1}; return u; });
                            }}
                            onLongAction={() => {
                              setCartItems(prev => { const u = [...prev]; u[it._origIdx] = {...u[it._origIdx], qty: (u[it._origIdx].qty || 1) + 1}; return u; });
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
                  <TouchableOpacity onPress={() => setAddressPickerVisible(true)}>
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
                  <TouchableOpacity onPress={() => setAddressPickerVisible(true)} activeOpacity={0.7} style={cartStyles.addrDisplay}>
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
                <View style={cartStyles.grandRow}>
                  <Text style={cartStyles.grandLabel}>{t('cart.total')}</Text>
                  <Text style={cartStyles.grandValue}>{fmtPrice(totalPrice + (orderMode === 'delivery' ? 9.99 : 0))}</Text>
                </View>
              </View>

              {/* Nombre articles */}
              <Text style={cartStyles.itemsCaption}>
                {cartItems.filter((_, i) => selectedCart[i]).length} {t('cart.itemsSelected', {count: cartItems.filter((_, i) => selectedCart[i]).length})}
              </Text>
            </ScrollView>

            {/* Boutons */}
            <View style={cartStyles.sheetFooter}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  if (!selectedSlot) {
                    Alert.alert(t('cart.slotRequired'), t('cart.slotRequiredMsg'));
                    return;
                  }
                  setConfirmVisible(false);
                  setOrderVisible(true);
                }}
                style={[cartStyles.primaryBtn, !selectedSlot && cartStyles.primaryBtnDisabled]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={cartStyles.primaryBtnTxt}>{t('cart.confirmOrder')}</Text>
              </TouchableOpacity>
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
                      placeholder="Rechercher un produit..."
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
                          <Ionicons name="add" size={20} color="#fff" />
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
                      <Text style={cartStyles.addedSummaryTitle}>{added.length} {t('cart.productsSelected', {count: added.length})}</Text>
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
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={cartStyles.primaryBtnTxt}>{t('cart.addToOrder')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
        </KeyboardAvoidingView>
      </Modal>


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
              addressId: orderMode === 'delivery' ? selectedAddressId : null,
              deliveryStatus: orderMode === 'delivery' ? DELIVERY_STATUS.PENDING : null,
            };
            history.unshift(order);
            await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(history));

            // If delivery mode, create delivery assignment for Livraison-app drivers
            if (orderMode === 'delivery') {
              try {
                const profileRaw = await AsyncStorage.getItem(KEY_PROFILE);
                const profile = profileRaw ? JSON.parse(profileRaw) : {};
                const recipientName = selectedAddress
                  ? [selectedAddress.first_name, selectedAddress.last_name].filter(Boolean).join(' ').trim()
                  : '';
                const recipientPhone = selectedAddress
                  ? [selectedAddress.phone_code, selectedAddress.phone_number].filter(Boolean).join(' ').trim()
                  : '';
                await createDeliveryOrder({
                  id: orderId,
                  shops,
                  address: deliveryAddress,
                  addressId: selectedAddressId,
                  customerName: recipientName || ((profile.prenom || '') + ' ' + (profile.nom || '')).trim(),
                  customerPhone: recipientPhone || profile.phone || '',
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
        <View style={cartStyles.sheetBackdrop}>
          <View style={[cartStyles.sheet, { maxHeight: '88%', paddingBottom: 36 }]}>
            <View style={cartStyles.sheetGrabber} />
            <View style={cartStyles.sheetHeader}>
              <View style={{flex:1}}>
                <Text style={[cartStyles.sheetTitle, { fontSize: 18 }]} numberOfLines={1}>{shopProductsName}</Text>
                <Text style={cartStyles.subtitle}>{shopProductsList.length} {t('productsScreen.quantity') || 'produits'}</Text>
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
                  placeholder={t('favorites.searchProductPlaceholder') || 'Rechercher un produit...'}
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
              renderItem={({item: product}) => (
                <View style={cartStyles.pickerRow}>
                  <ProductThumb name={product.name} size={40} />
                  <View style={cartStyles.pickerBody}>
                    <Text style={cartStyles.pickerName}>{product.name}</Text>
                    {product.detail ? <Text style={cartStyles.pickerDetail}>{product.detail}</Text> : null}
                    <View style={cartStyles.pickerPriceRow}>
                      <Text style={cartStyles.pickerPrice}>{fmtPrice(product.price||0)}</Text>
                      {product.unitPrice ? <Text style={cartStyles.pickerUnit}>{product.unitPrice}</Text> : null}
                    </View>
                  </View>
                  {product.inCart ? (
                    <View style={cartStyles.pickerInCart}>
                      <Ionicons name="checkmark-circle" size={14} color={THEME.muted} />
                      <Text style={cartStyles.pickerInCartTxt}>{t('cart.inCart') || 'Dans le panier'}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
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
                      style={cartStyles.pickerAddPill}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={cartStyles.pickerAddPillTxt}>{t('cart.add') || 'Ajouter'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          </View>
        </View>
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
                  onPress={() => { setAddressPickerVisible(false); navigation.navigate('profile'); }}
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
                        ? <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />
                        : <Ionicons name="ellipse-outline" size={22} color={THEME.border} />}
                    </TouchableOpacity>
                  );
                })}
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
    </View>
  );
};

// ── Écran BOUTIQUES : vrais shops Pearl Streets (product_purchase) + produits ──
// Catalogue réel via getShopsByCategory('product_purchase'). Tap shop → ses vrais
// produits → ajout panier (KEY_CART, champ `shop` réel) → checkout collect/livraison
// existant. Aucune donnée mockée.
const ShopsScreen = () => {
  const { t } = useTranslation();
  const { fmtPrice } = useCurrency();
  const [shops, setShops] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [selectedShop, setSelectedShop] = React.useState(null);
  const [toast, setToast] = React.useState('');

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const data = await getShopsByCategory('product_purchase');
      setShops(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const addToCart = async (shop, product) => {
    try {
      const raw = await AsyncStorage.getItem(KEY_CART);
      const existing = raw ? (JSON.parse(raw) || []) : [];
      const idx = existing.findIndex(e =>
        String(e.name || '').toLowerCase().trim() === String(product.name || '').toLowerCase().trim() &&
        String(e.shop || '').toLowerCase().trim() === String(shop.name || '').toLowerCase().trim()
      );
      if (idx >= 0) {
        existing[idx].qty = (existing[idx].qty || 1) + 1;
        existing[idx].price = product.price || existing[idx].price;
      } else {
        existing.push({
          name: product.name,
          detail: product.subcategory || product.description || '',
          unitPrice: '',
          qty: 1,
          price: product.price || 0,
          shop: shop.name,
          shopId: shop.id,
          image: product.image || '',
          category: 'product_purchase',
        });
      }
      await AsyncStorage.setItem(KEY_CART, JSON.stringify(existing));
      setToast(`${product.name} — ${t('shops.added', 'ajouté au panier')}`);
      setTimeout(() => setToast(''), 1600);
    } catch (e) {}
  };

  const renderShopCard = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} style={shopStyles.card} onPress={() => setSelectedShop(item)}>
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
          <View style={shopStyles.badge}><Text style={shopStyles.badgeTxt}>{item.products.length} {t('shops.products', 'produits')}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderProduct = ({ item }) => (
    <View style={shopStyles.prodRow}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={shopStyles.prodImg} resizeMode="cover" />
      ) : (
        <View style={[shopStyles.prodImg, shopStyles.coverPlaceholder]}><Ionicons name="cube-outline" size={22} color={THEME.faint} /></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={shopStyles.prodName} numberOfLines={2}>{item.name}</Text>
        {item.subcategory ? <Text style={shopStyles.prodSub} numberOfLines={1}>{item.subcategory}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={shopStyles.prodPrice}>{fmtPrice(item.price)}</Text>
          {item.promo ? <Text style={shopStyles.prodBase}>{fmtPrice(item.basePrice)}</Text> : null}
        </View>
      </View>
      <TouchableOpacity style={shopStyles.addBtn} onPress={() => addToCart(selectedShop, item)}>
        <Ionicons name="add" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={shopStyles.screen} edges={['top']}>
      <View style={shopStyles.header}>
        <Text style={shopStyles.title}>{t('shops.title', 'Boutiques')}</Text>
        <Text style={shopStyles.subtitle}>{t('shops.subtitle', 'Achat de produits — click & collect ou livraison')}</Text>
      </View>

      {loading ? (
        <View style={shopStyles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : error ? (
        <View style={shopStyles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={THEME.faint} />
          <Text style={shopStyles.emptyTxt}>{t('shops.error', 'Impossible de charger les boutiques')}</Text>
          <TouchableOpacity style={shopStyles.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={shopStyles.retryTxt}>{t('shops.retry', 'Réessayer')}</Text>
          </TouchableOpacity>
        </View>
      ) : shops.length === 0 ? (
        <View style={shopStyles.center}>
          <Ionicons name="storefront-outline" size={40} color={THEME.faint} />
          <Text style={shopStyles.emptyTxt}>{t('shops.empty', 'Aucune boutique disponible')}</Text>
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(s) => String(s.id)}
          renderItem={renderShopCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
        />
      )}

      {/* Détail d'une boutique : ses vrais produits */}
      <Modal visible={!!selectedShop} animationType="slide" onRequestClose={() => setSelectedShop(null)}>
        <SafeAreaView style={shopStyles.screen} edges={['top']}>
          <View style={shopStyles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedShop(null)} style={shopStyles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={THEME.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={shopStyles.detailTitle} numberOfLines={1}>{selectedShop?.name}</Text>
              {selectedShop?.address ? <Text style={shopStyles.shopAddr} numberOfLines={1}>{selectedShop.address}</Text> : null}
            </View>
          </View>
          <FlatList
            data={selectedShop?.products || []}
            keyExtractor={(p) => String(p.id)}
            renderItem={renderProduct}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={shopStyles.emptyTxt}>{t('shops.noProducts', 'Aucun produit')}</Text>}
          />
        </SafeAreaView>
      </Modal>

      {toast ? (
        <View style={shopStyles.toast}><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={shopStyles.toastTxt}>{toast}</Text></View>
      ) : null}
    </SafeAreaView>
  );
};

const shopStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 4, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTxt: { fontSize: 14, color: THEME.muted, marginTop: 12, fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: BRAND, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  retryTxt: { color: '#fff', fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  cover: { marginRight: 12 },
  coverImg: { width: 64, height: 64, borderRadius: 14, backgroundColor: THEME.subtle },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  shopName: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  shopAddr: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  badge: { backgroundColor: THEME.brandSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { color: THEME.brandDark, fontSize: 12, fontWeight: '800' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.border },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  detailTitle: { fontSize: 18, fontWeight: '900', color: THEME.ink },
  prodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 14, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
  prodImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: THEME.subtle, marginRight: 12 },
  prodName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  prodSub: { fontSize: 11, color: THEME.faint, marginTop: 1, fontWeight: '600' },
  prodPrice: { fontSize: 15, fontWeight: '900', color: THEME.brandDark, marginTop: 3 },
  prodBase: { fontSize: 12, color: THEME.faint, marginLeft: 8, marginTop: 4, textDecorationLine: 'line-through' },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  toast: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: THEME.ink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', ...THEME.shadow },
  toastTxt: { color: '#fff', fontWeight: '700', marginLeft: 8, flex: 1 },
});

function MainNavigator({ onLogout, isAuth }) {
  const { t } = useTranslation();

  const ICONS = {
    "profile": { focused: "person", unfocused: "person-outline" },
    "myList": { focused: "reorder-three", unfocused: "reorder-three-outline" },
    "products": { focused: "cart",           unfocused: "cart-outline" },
    "shops": { focused: "storefront",      unfocused: "storefront-outline" },
    "favorites":  { focused: "heart",          unfocused: "heart-outline" },
    "cart":   { focused: "bag-handle",     unfocused: "bag-handle-outline" }
  };

  const getTabName = (key) => {
    const tabNames = {
      myList: t('tabs.myList'),
      products: t('tabs.products'),
      shops: t('tabs.shops', 'Boutiques'),
      favorites: t('tabs.favorites'),
      cart: t('tabs.cart'),
      profile: t('tabs.profile')
    };
    return tabNames[key] || key;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleAlign: "center",
        headerTitle: getTabName(route.name),
        tabBarLabel: getTabName(route.name),
        tabBarActiveTintColor: BRAND,
        tabBarStyle: { height: 88, paddingTop: 8, paddingBottom: 28 },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name] || { focused:"ellipse", unfocused:"ellipse-outline" };
          const name = focused ? iconSet.focused : iconSet.unfocused;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="myList" component={ListScreen} options={{ headerShown: false }} />
      <Tab.Screen name="products" component={ProductsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="shops" component={ShopsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="cart" options={{ headerShown: false }}>{() => <CartScreen isAuth={isAuth} />}</Tab.Screen>
      <Tab.Screen name="favorites" component={FavoritesScreen} options={{ headerShown: false }} />
      <Tab.Screen name="profile" options={{ headerShown: false }}>{() => <FakeProfileScreen onLogout={onLogout} isAuth={isAuth} />}</Tab.Screen>
    </Tab.Navigator>
  );
}

const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },

  // Top bar (back / close)
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 4, minHeight: 46 },
  topBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center' },

  // Scroll body
  scrollBody: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },

  // Brand header
  brandHeader: { alignItems: 'center', marginBottom: 28 },
  brandLogo: { width: 72, height: 72, borderRadius: 24, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...THEME.shadow },
  brandTitle: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  brandSubtitle: { fontSize: 13, color: THEME.muted, marginTop: 6, textAlign: 'center', lineHeight: 19, fontWeight: '600' },

  // Error banner
  errorBanner: { backgroundColor: THEME.dangerSoft, borderRadius: 14, padding: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center' },
  errorTxt: { color: THEME.danger, fontSize: 13, marginLeft: 8, flex: 1, fontWeight: '600' },

  // Form fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: THEME.muted, marginBottom: 6 },
  field: { height: 52, backgroundColor: THEME.subtle, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, color: THEME.ink },
  pwdRow: { flexDirection: 'row', alignItems: 'center', height: 52, backgroundColor: THEME.subtle, borderRadius: 14 },
  pwdInput: { flex: 1, height: 52, paddingHorizontal: 16, fontSize: 15, color: THEME.ink },
  pwdEye: { paddingHorizontal: 14, height: 52, alignItems: 'center', justifyContent: 'center' },

  // Primary button
  primaryBtn: { height: 54, borderRadius: 16, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 4, ...THEME.shadow },
  primaryBtnDisabled: { backgroundColor: THEME.faint, shadowOpacity: 0, elevation: 0 },
  primaryBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Toggle-mode link
  toggleLink: { alignItems: 'center', paddingVertical: 18 },
  toggleTxt: { color: THEME.muted, fontSize: 14.5, fontWeight: '600' },
  toggleTxtBrand: { color: THEME.brand, fontWeight: '800', fontSize: 14.5 },

  // Language picker button
  langBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 24, marginBottom: 24, height: 48, borderRadius: 14, backgroundColor: THEME.subtle },
  langBtnTxt: { fontSize: 14, fontWeight: '700', color: THEME.ink, marginLeft: 8 },

  // Language picker modal
  langBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  langSheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '62%', paddingBottom: 36 },
  langHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  langHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.border },
  langHeadTitle: { fontSize: 18, fontWeight: '900', color: THEME.ink, letterSpacing: -0.3 },
  langClose: { width: 34, height: 34, borderRadius: 11, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center' },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, marginBottom: 4 },
  langRowActive: { backgroundColor: THEME.brandSoft },
  langFlag: { fontSize: 24, marginRight: 14 },
  langLabel: { flex: 1, fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  langLabelActive: { fontWeight: '800', color: THEME.brandDark },
});

function AuthScreen({ onLogin, onClose }) {
  const { t, i18n: i18nAuth } = useTranslation();
  const [isLogin, setIsLogin] = React.useState(true);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pseudo, setPseudo] = React.useState('');
  const [prenom, setPrenom] = React.useState('');
  const [nom, setNom] = React.useState('');
  const [error, setError] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [langVisible, setLangVisible] = React.useState(false);

  // Sync all Marketplace accounts to local storage
  React.useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      let accounts = raw ? JSON.parse(raw) : [];
      let changed = false;
      for (const mktAccount of MARKETPLACE_ACCOUNTS) {
        const exists = accounts.some(a => a.email && a.email.toLowerCase() === mktAccount.email.toLowerCase());
        if (!exists) { accounts.push(mktAccount); changed = true; }
      }
      if (changed) await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
    })();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() && !password.trim()) { setError(t('auth.errorBothEmpty') || 'Veuillez saisir votre email et mot de passe'); return; }
    if (!email.trim()) { setError(t('auth.errorNoEmail') || 'Veuillez saisir votre email'); return; }
    if (!password.trim()) { setError(t('auth.errorNoPassword') || 'Veuillez saisir votre mot de passe'); return; }
    // Rate limiting: max 5 attempts per minute
    const { checkRateLimit } = require('./services/security');
    const rateCheck = checkRateLimit('login', 5, 60000);
    if (!rateCheck.allowed) { setError((t('auth.errorRateLimit') || 'Trop de tentatives. Réessayez dans') + ' ' + rateCheck.waitSeconds + 's'); return; }
    setLoading(true);
    // Try Marketplace API with timeout — if unavailable, fallback to local
    try {
      const apiPromise = loginUser(email.trim(), password);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const result = await Promise.race([apiPromise, timeoutPromise]);
      if (result && result.success) { setLoading(false); onLogin(); return; }
    } catch(e) { /* API unavailable — fallback to local */ }
    const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
    const accounts = raw ? JSON.parse(raw) : [];
    const input = email.trim().toLowerCase();
    const accountExists = accounts.find(a => (a.email.toLowerCase() === input || (a.pseudo && a.pseudo.toLowerCase() === input)));
    if (!accountExists) { setError(t('auth.errorAccountNotFound') || 'Aucun compte trouvé'); setLoading(false); return; }
    if (accountExists.password !== password) { setError(t('auth.errorWrongPassword') || 'Mot de passe incorrect'); setLoading(false); return; }
    const found = accountExists;
    const userKey = 'USER_' + found.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await AsyncStorage.setItem(KEY_AUTH, JSON.stringify({...found, userKey}));
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify({ pseudo: found.pseudo, prenom: found.prenom, nom: found.nom, email: found.email, photo: null }));
    await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
    await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
    await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
    setLoading(false);
    onLogin();
  };

  const handleSignup = async () => {
    setError('');
    if (!email.trim() || !password.trim() || !pseudo.trim() || !prenom.trim() || !nom.trim()) { setError(t('auth.errorEmpty') || 'Remplissez tous les champs'); return; }
    if (password.length < 6) { setError(t('auth.errorPasswordLength') || 'Minimum 6 caractères'); return; }
    setLoading(true);
    try {
      const apiPromise = registerUser({ username: pseudo.trim(), email: email.trim(), password, firstName: prenom.trim(), lastName: nom.trim() });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const result = await Promise.race([apiPromise, timeoutPromise]);
      if (result && result.success) { setLoading(false); onLogin(); return; }
    } catch(e) { /* API unavailable — fallback to local */ }
    const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
    const accounts = raw ? JSON.parse(raw) : [];
    if (accounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase())) { setError(t('auth.errorEmailExists') || 'Email déjà utilisé'); setLoading(false); return; }
    const newAccount = { pseudo: pseudo.trim(), prenom: prenom.trim(), nom: nom.trim(), email: email.trim(), password, role: 'user' };
    accounts.push(newAccount);
    await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
    await AsyncStorage.setItem(KEY_AUTH, JSON.stringify({...newAccount, userKey: 'USER_' + newAccount.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}));
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify({ pseudo: newAccount.pseudo, prenom: newAccount.prenom, nom: newAccount.nom, email: newAccount.email, photo: null }));
    setLoading(false);
    onLogin();
  };

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={authStyles.screen} edges={[]}>
      <View style={authStyles.topBar}>
        {!isLogin ? (
          <TouchableOpacity onPress={() => { setIsLogin(true); setError(''); }} style={authStyles.topBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={THEME.ink} />
          </TouchableOpacity>
        ) : <View style={{ width: 38, height: 38 }} />}
        {onClose ? (
          <TouchableOpacity onPress={onClose} style={authStyles.topBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={THEME.ink} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={authStyles.scrollBody} keyboardShouldPersistTaps="handled">
        <View style={authStyles.brandHeader}>
          <View style={authStyles.brandLogo}>
            <Ionicons name="cart" size={34} color="#fff" />
          </View>
          <Text style={authStyles.brandTitle}>Pearl List</Text>
          <Text style={authStyles.brandSubtitle}>
            {isLogin ? (t('auth.pearlLoginHint') || 'Connectez-vous avec votre compte Pearl Streets ou Marketplace') : (t('auth.pearlSignupHint') || 'Créez un compte — utilisable sur l\'app et le site Marketplace')}
          </Text>
        </View>
        {error ? (
          <View style={authStyles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={THEME.danger} />
            <Text style={authStyles.errorTxt}>{error}</Text>
          </View>
        ) : null}
        {!isLogin && (
          <>
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>{t('profile.pseudo')}</Text>
              <TextInput value={pseudo} onChangeText={setPseudo} placeholder={t('profile.pseudoPlaceholder')} placeholderTextColor={THEME.faint} style={authStyles.field} />
            </View>
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>{t('profile.firstName')}</Text>
              <TextInput value={prenom} onChangeText={setPrenom} placeholder={t('profile.firstNamePlaceholder')} placeholderTextColor={THEME.faint} style={authStyles.field} />
            </View>
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>{t('profile.lastName')}</Text>
              <TextInput value={nom} onChangeText={setNom} placeholder={t('profile.lastNamePlaceholder')} placeholderTextColor={THEME.faint} style={authStyles.field} />
            </View>
          </>
        )}
        <View style={authStyles.fieldGroup}>
          <Text style={authStyles.fieldLabel}>{isLogin ? t('auth.emailOrPseudo') : t('profile.email')}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder={isLogin ? t('auth.emailOrPseudoPlaceholder') : t('auth.emailPlaceholder')} placeholderTextColor={THEME.faint} keyboardType="email-address" autoCapitalize="none" style={authStyles.field} />
        </View>
        <View style={authStyles.fieldGroup}>
          <Text style={authStyles.fieldLabel}>{t('auth.password')}</Text>
          <View style={authStyles.pwdRow}>
            <TextInput value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} placeholderTextColor={THEME.faint} secureTextEntry={!showPwd} style={authStyles.pwdInput} />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={authStyles.pwdEye} activeOpacity={0.7}>
              <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={THEME.faint} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={isLogin ? handleLogin : handleSignup} disabled={loading} activeOpacity={0.85} style={[authStyles.primaryBtn, loading && authStyles.primaryBtnDisabled]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={authStyles.primaryBtnTxt}>{isLogin ? t('auth.loginBtn') : t('auth.signupBtn')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(''); }} style={authStyles.toggleLink} activeOpacity={0.7}>
          <Text style={authStyles.toggleTxt}>
            {isLogin ? (t('auth.noAccountPearl') || 'Pas de compte ? ') : (t('auth.hasAccountPearl') || 'Déjà un compte ? ')}
            <Text style={authStyles.toggleTxtBrand}>{isLogin ? t('auth.signupBtn') : t('auth.loginBtn')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity onPress={() => setLangVisible(true)} style={authStyles.langBtn} activeOpacity={0.7}>
        <Ionicons name="globe-outline" size={18} color={THEME.muted} />
        <Text style={authStyles.langBtnTxt}>{LANGUAGES.find(l => l.code === i18nAuth.language)?.flag || '🌐'} {LANGUAGES.find(l => l.code === i18nAuth.language)?.label || 'Language'}</Text>
      </TouchableOpacity>

      {/* Language Picker Modal */}
      <Modal visible={langVisible} animationType="none" transparent={true}>
        <View style={authStyles.langBackdrop}>
          <View style={authStyles.langSheet}>
            <View style={authStyles.langHandle} />
            <View style={authStyles.langHeadRow}>
              <Text style={authStyles.langHeadTitle}>{t('profile.language') || 'Langue'}</Text>
              <TouchableOpacity onPress={() => setLangVisible(false)} style={authStyles.langClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              contentContainerStyle={{paddingHorizontal:14, paddingVertical:10}}
              renderItem={({item: lang}) => (
                <TouchableOpacity
                  onPress={async () => { await i18nAuth.changeLanguage(lang.code); await AsyncStorage.setItem('APP_LANG', lang.code); setLangVisible(false); }}
                  activeOpacity={0.7}
                  style={[authStyles.langRow, i18nAuth.language === lang.code && authStyles.langRowActive]}
                >
                  <Text style={authStyles.langFlag}>{lang.flag}</Text>
                  <Text style={[authStyles.langLabel, i18nAuth.language === lang.code && authStyles.langLabelActive]}>{lang.label}</Text>
                  {i18nAuth.language === lang.code && <Ionicons name="checkmark-circle" size={20} color={THEME.brand} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const useCurrency = () => React.useContext(CurrencyContext);

export default function App() {
  const [isAuth, setIsAuth] = React.useState(null); // null = loading, true/false
  const [proBlocked, setProBlocked] = React.useState(false);
  const [authVisible, setAuthVisible] = React.useState(false);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_AUTH', () => setAuthVisible(true));
    return () => sub.remove();
  }, []);

  // Check if pro user needs verification
  React.useEffect(() => {
    (async () => {
      const authRaw = await AsyncStorage.getItem(KEY_AUTH);
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        if (auth.role === 'professionaluser' && !auth.isVerified) {
          setProBlocked(true);
        } else {
          setProBlocked(false);
        }
      }
    })();
  }, [isAuth]);

  const [currency, setCurrencyState] = React.useState(CURRENCIES[0]);
  const [liveRates, setLiveRates] = React.useState(null);

  // Fetch live exchange rates on mount and every 30 min
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const rates = await fetchLiveRates();
      if (mounted && rates) setLiveRates(rates);
    };
    load();
    const interval = setInterval(load, RATES_CACHE_MS);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // When liveRates arrive, update current currency rate
  React.useEffect(() => {
    if (liveRates && currency.code !== 'EUR') {
      const live = liveRates[currency.code];
      if (live && isFinite(live) && live !== currency.rate) {
        setCurrencyState(prev => ({ ...prev, rate: live }));
      }
    }
  }, [liveRates]);

  const fmtPrice = React.useCallback((eurAmount) => {
    const n = Number(eurAmount || 0) * currency.rate;
    const dec = currency.decimals !== undefined ? currency.decimals : 2;
    const formatted = n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formatted} ${currency.symbol}`;
  }, [currency]);

  const setCurrency = React.useCallback(async (cur) => {
    // Apply live rate if available
    const updated = getCurrencyWithLiveRate(cur, liveRates || getCachedLiveRates());
    setCurrencyState(updated);
    await AsyncStorage.setItem('APP_CURRENCY', cur.code);
  }, [liveRates]);

  React.useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY_AUTH);
      setIsAuth(!!raw);
      const savedCur = await AsyncStorage.getItem('APP_CURRENCY');
      if (savedCur) {
        const found = CURRENCIES.find(c => c.code === savedCur);
        if (found) {
          const updated = getCurrencyWithLiveRate(found, getCachedLiveRates());
          setCurrencyState(updated);
        }
      }
    })();
  }, []);

  if (isAuth === null) {
    return (
      <View style={{flex:1, backgroundColor:'#fff', alignItems:'center', justifyContent:'center'}}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, fmtPrice }}>
      <NavigationContainer theme={navTheme}>
        <MainNavigator onLogout={() => setIsAuth(false)} isAuth={isAuth} />
      </NavigationContainer>
      <Modal visible={authVisible} animationType="slide" onRequestClose={() => setAuthVisible(false)}>
        <AuthScreen
          onLogin={() => { setIsAuth(true); setAuthVisible(false); }}
          onClose={() => setAuthVisible(false)}
        />
      </Modal>
    </CurrencyContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1, backgroundColor:"#fff" },

  sectionHeader:{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:GUTTER, paddingTop:6, paddingBottom:4 },
  sectionTitle:{ fontSize:20, fontWeight:"700", color:"#111" },

  inputRow:{ flexDirection:"row", alignItems:"center", paddingHorizontal:GUTTER, marginTop:8 },
  input:{ flex:1, height:44, borderWidth:1, borderColor:"#E5E7EB", borderRadius:10, paddingHorizontal:12, fontSize:15, color:"#111" },
  addBtn:{ width:44, height:44, borderRadius:10, backgroundColor:BRAND, alignItems:"center", justifyContent:"center", marginLeft:10 },

  scanPill:{ height:32, paddingHorizontal:10, borderRadius:10, borderWidth:1, borderColor:BRAND, flexDirection:"row", alignItems:"center", justifyContent:"center" },
  scanText:{ color:BRAND, fontWeight:"600", marginLeft:6, fontSize:13 },

  dualRow:{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:GUTTER, marginTop:14 },
  dualLeft:{ flexDirection:"row", alignItems:"center" },
  dualRight:{ flexDirection:"row", alignItems:"center" },
  dualLabel:{ fontSize:15, color:"#333", marginLeft:12 },

  row:{ flexDirection:"row", alignItems:"center", paddingVertical:10, paddingLeft:GUTTER, paddingRight:12 },
  qtyInline:{ flexDirection:"row", alignItems:"center", marginLeft:12 },
  qtyBtn:{ width:28, height:28, borderRadius:8, borderWidth:1, borderColor:"#E5E7EB", alignItems:"center", justifyContent:"center" },
  qtyInput:{ minWidth:26, height:24, textAlign:"center", fontSize:13, fontWeight:'800', color:THEME.ink, marginHorizontal:2, paddingVertical:0 },

  itemLabel:{ fontSize:16, color:"#111", marginLeft:12 },
  crossed:{ textDecorationLine:"line-through", color:"#999" },
  trashBtn:{ paddingHorizontal:8, marginLeft:8 },

  square:{ width:CTRL, height:CTRL, borderRadius:6, borderWidth:1, borderColor:"#CBD5E1", alignItems:"center", justifyContent:"center" },
  squareOn:{ backgroundColor:BRAND, borderColor:BRAND },

  radioOuter:{ width:CTRL, height:CTRL, borderRadius:10, borderWidth:1, borderColor:"#CBD5E1", backgroundColor:"#fff", alignItems:"center", justifyContent:"center" },
  radioInner:{ width:10, height:10, borderRadius:5, backgroundColor:BRAND },

  h1:{ fontSize:20, fontWeight:"700", color:"#111", marginTop:6, marginBottom:6 },
  muted:{ color:"#9AA", fontSize:15 },
  empty:{ color:"#9AA", fontSize:15 },

  bottomAreaWrap:{ position:"absolute", left:GUTTER, right:GUTTER, bottom:30 },
  switchCenterRow:{ flexDirection:"row", alignItems:"center", justifyContent:"center", marginBottom:12 },
  switchLabel:{ fontSize:15, color:"#333", marginLeft:10 },

  bottomBtn:{ height:48, borderRadius:14, backgroundColor:BRAND, alignItems:"center", justifyContent:"center" },
  bottomBtnText:{ color:"#fff", fontSize:16, fontWeight:"700" },

  modalBackdrop:{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"center", alignItems:"center" },
  modalBox:{ width:"80%", backgroundColor:"#fff", borderRadius:12, padding:20 },
  modalTitle:{ fontSize:18, fontWeight:"700", marginBottom:12, textAlign:"center" },
  modalInput:{ borderWidth:1, borderColor:"#DDD", borderRadius:8, padding:10, fontSize:16, marginBottom:16 },
  modalRow:{ flexDirection:"row", justifyContent:"flex-end" },
  modalBtnCancel:{ paddingVertical:10, paddingHorizontal:16, marginRight:10 },
  modalBtnSave:{ paddingVertical:10, paddingHorizontal:16, backgroundColor:BRAND, borderRadius:8 },
  modalBtnText:{ fontSize:15, color:"#333" },
  modalBtnTextSave:{ fontSize:15, fontWeight:"700", color:"#fff" }
});


const LANGUAGES = [
  { code:'fr', label:'Français', flag:'🇫🇷' },
  { code:'en', label:'English', flag:'🇬🇧' },
  { code:'es', label:'Español', flag:'🇪🇸' },
  { code:'zh', label:'中文', flag:'🇨🇳' },
  { code:'ar', label:'العربية', flag:'🇸🇦' },
  { code:'de', label:'Deutsch', flag:'🇩🇪' },
  { code:'nl', label:'Nederlands', flag:'🇳🇱' },
  { code:'it', label:'Italiano', flag:'🇮🇹' },
  { code:'pt', label:'Português', flag:'🇵🇹' },
  { code:'ja', label:'日本語', flag:'🇯🇵' },
  { code:'th', label:'ไทย', flag:'🇹🇭' },
  { code:'sv', label:'Svenska', flag:'🇸🇪' },
  { code:'ru', label:'Русский', flag:'🇷🇺' },
];

const profStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },

  // Custom in-screen header
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },

  // Profile identity card
  profileCard: { backgroundColor: THEME.card, borderRadius: 16, marginHorizontal: 20, marginTop: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  avatarWrap: { width: 60, height: 60, marginBottom: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#9ca3af', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#3B82F6', overflow: 'hidden' },
  avatarImg: { width: 60, height: 60 },
  avatarInitials: { fontSize: 24, fontWeight: '900', color: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: THEME.card, zIndex: 10 },
  profileName: { fontSize: 19, fontWeight: '900', color: THEME.ink, letterSpacing: -0.3 },
  profileHandle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, paddingHorizontal: 16, height: 34, borderRadius: 12, marginTop: 10 },
  editBtnTxt: { color: THEME.brandDark, fontWeight: '700', fontSize: 13, marginLeft: 6 },

  // Section
  section: { marginTop: 14, paddingHorizontal: 20 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, letterSpacing: -0.3 },
  sectionCount: { fontSize: 12.5, fontWeight: '700', color: THEME.muted },

  // Verification banners
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10 },
  bannerWarn: { backgroundColor: '#FEF3C7' },
  bannerOk: { backgroundColor: THEME.brandSoft },
  bannerTxt: { flex: 1, fontSize: 13, fontWeight: '600', marginLeft: 10, lineHeight: 18 },

  // Document status card
  docCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10 },
  docDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  docIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: THEME.ink, marginLeft: 10 },
  docStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  docStatusTxt: { fontSize: 11.5, fontWeight: '800' },

  // Order card
  orderCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  orderRow: { flexDirection: 'row', alignItems: 'center' },
  orderIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center' },
  orderBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  orderTitle: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  orderStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  orderDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  orderStatusTxt: { fontSize: 12.5, fontWeight: '700' },
  orderShops: { fontSize: 12.5, color: THEME.muted, marginTop: 3, fontWeight: '600' },
  orderDate: { fontSize: 11.5, color: THEME.faint, marginTop: 2, fontWeight: '600' },
  orderSide: { alignItems: 'flex-end' },
  modePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: THEME.subtle, marginBottom: 4 },
  modePillTxt: { fontSize: 10, fontWeight: '800', color: THEME.muted },
  orderPrice: { fontSize: 15.5, fontWeight: '900', color: THEME.ink },

  // Settings rows
  settingsCard: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  settingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center' },
  settingBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  settingLabel: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  settingValue: { fontSize: 12.5, color: THEME.muted, marginTop: 1, fontWeight: '600' },

  // Driver CTA card
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.border },
  driverIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center' },
  driverBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  driverTitle: { fontSize: 15.5, fontWeight: '800', color: THEME.ink },
  driverSub: { fontSize: 12.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },

  // Logout
  logoutBtn: { height: 52, borderRadius: 16, backgroundColor: THEME.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logoutTxt: { fontSize: 15.5, fontWeight: '800', color: THEME.danger, marginLeft: 8 },

  // Empty state
  empty: { backgroundColor: THEME.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  emptyCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  // Guest screen
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  guestTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  guestHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  guestBtn: { height: 52, borderRadius: 16, backgroundColor: THEME.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 24, ...THEME.shadow },
  guestBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },

  // Full-page modal header
  modalScreen: { flex: 1, backgroundColor: THEME.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  modalBack: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: THEME.ink, flex: 1, letterSpacing: -0.4 },
  modalHeaderPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: THEME.brandSoft },
  modalHeaderPillTxt: { fontSize: 12, fontWeight: '800', color: THEME.brandDark },

  // Form fields
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: THEME.muted, marginBottom: 6 },
  field: { height: 52, backgroundColor: THEME.subtle, borderRadius: 14, paddingHorizontal: 14, fontSize: 15, color: THEME.ink },
  fieldGroup: { marginBottom: 16 },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },

  // Generic white card inside modals
  modalCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },

  // Geolocation button
  geoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 14, backgroundColor: THEME.brandSoft, marginBottom: 20 },
  geoBtnTxt: { fontSize: 14.5, fontWeight: '700', color: THEME.brandDark, marginLeft: 8 },

  // Password change collapsible
  pwdToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 14, borderWidth: 1, borderColor: THEME.border, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 22, ...THEME.shadowSm },
  pwdToggleTxt: { flex: 1, fontSize: 15, fontWeight: '700', color: THEME.ink, marginLeft: 10 },
  pwdPanel: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 16, marginBottom: 22, ...THEME.shadowSm },
  pwdPanelHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  pwdPanelTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: THEME.ink, marginLeft: 8 },
  pwdAlert: { borderRadius: 12, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  pwdAlertTxt: { fontSize: 12.5, fontWeight: '600', marginLeft: 6, flex: 1 },

  // Button row (cancel / save)
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { color: THEME.muted, fontWeight: '700', fontSize: 15 },
  saveBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  saveBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Primary full-width button
  primaryBtn: { height: 52, borderRadius: 16, backgroundColor: THEME.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  primaryBtnDisabled: { backgroundColor: THEME.faint },
  primaryBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },

  // Picker rows (language / currency)
  pickerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  pickerRowOn: { backgroundColor: THEME.brandSoft, borderColor: THEME.brand, borderWidth: 2 },
  pickerFlag: { fontSize: 24, marginRight: 14 },
  pickerName: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  pickerNameOn: { color: THEME.brandDark, fontWeight: '800' },
  pickerSub: { fontSize: 12, color: THEME.faint, marginTop: 2, fontWeight: '600' },

  // Sheet footer (confirm button area)
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },

  // Driver info modal hero
  driverHero: { alignItems: 'center', marginBottom: 22 },
  driverHeroIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  driverHeroTitle: { fontSize: 22, fontWeight: '900', color: THEME.ink, textAlign: 'center', letterSpacing: -0.4 },
  driverHeroSub: { fontSize: 14, color: THEME.muted, marginTop: 6, textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  driverTypeCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  driverTypeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  driverTypeIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverTypeTitle: { fontSize: 15.5, fontWeight: '800', color: THEME.ink },
  driverTypeTxt: { fontSize: 13, color: THEME.muted, lineHeight: 20, fontWeight: '600' },
  limitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  limitFlag: { fontSize: 22, marginRight: 12 },
  limitName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  limitInfo: { fontSize: 11.5, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  limitValue: { fontSize: 13, fontWeight: '800' },
  legalNote: { fontSize: 11.5, color: THEME.faint, textAlign: 'center', marginTop: 10, lineHeight: 16, fontWeight: '600' },

  // Order detail rows
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailInfoLabel: { fontSize: 13, color: THEME.muted, marginLeft: 8, fontWeight: '600' },
  detailInfoValue: { fontSize: 13, fontWeight: '700', color: THEME.ink, marginLeft: 6 },
  driverChip: { backgroundColor: THEME.brandSoft, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  driverChipIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverChipName: { fontSize: 13.5, fontWeight: '800', color: THEME.ink },
  driverChipSub: { fontSize: 12, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  driverChipCall: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.brand, alignItems: 'center', justifyContent: 'center' },
  costBlock: { borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 12, marginTop: 4 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costLabel: { fontSize: 13, color: THEME.muted, fontWeight: '600' },
  costValue: { fontSize: 13, fontWeight: '700', color: THEME.ink },
  costValueFree: { fontSize: 13, fontWeight: '700', color: THEME.brand },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 10, marginTop: 4 },
  grandLabel: { fontSize: 16, fontWeight: '900', color: THEME.ink },
  grandValue: { fontSize: 16, fontWeight: '900', color: THEME.brand },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 14, marginBottom: 12 },
  statusCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statusCardLabel: { fontSize: 12.5, color: THEME.muted, fontWeight: '600' },
  statusCardValue: { fontSize: 16, fontWeight: '800', marginTop: 1 },
  shopBlock: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  shopBlockHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  shopBlockIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  shopBlockName: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  detailItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  detailItemDivider: { borderTopWidth: 1, borderTopColor: THEME.border },
  detailItemBody: { flex: 1, marginLeft: 10 },
  detailItemName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  detailItemMeta: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  detailItemPrice: { fontSize: 14, fontWeight: '800', color: THEME.ink },
  detailFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.card },

  // Reorder bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '78%', paddingBottom: Platform.OS === 'ios' ? 32 : 20, ...THEME.shadow },
  sheetGrabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.border, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: THEME.ink, letterSpacing: -0.4 },
  selectAllPill: { paddingHorizontal: 12, height: 32, borderRadius: 10, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  selectAllTxt: { fontSize: 12, fontWeight: '700', color: THEME.ink },
  closeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center' },
  reorderRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: 14, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  reorderRowOn: { backgroundColor: THEME.brandSoft, borderColor: THEME.brand },
  reorderBody: { flex: 1, marginLeft: 10 },
  reorderName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  reorderShop: { fontSize: 11.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  reorderSide: { alignItems: 'flex-end' },
  reorderQty: { fontSize: 13, fontWeight: '700', color: THEME.muted },
  reorderPrice: { fontSize: 13.5, fontWeight: '800', color: THEME.brand, marginTop: 2 },
  reorderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  reorderTotalLabel: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  reorderTotalValue: { fontSize: 17, fontWeight: '900', color: THEME.brand },

  // Delivery address — list, cards & form
  addrSectionTitle: { fontSize: 15, fontWeight: '800', color: THEME.ink, marginBottom: 12 },
  addrCard: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 14, marginBottom: 12, ...THEME.shadowSm },
  addrCardOn: { borderColor: THEME.brand, borderWidth: 2, padding: 13 },
  addrCardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addrTypeIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  addrType: { fontSize: 14.5, fontWeight: '800', color: THEME.ink },
  addrBadge: { backgroundColor: 'rgba(0,194,155,0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, marginLeft: 8 },
  addrBadgeTxt: { fontSize: 9.5, fontWeight: '800', color: '#fff', letterSpacing: 0.4, textTransform: 'uppercase' },
  addrCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center' },
  addrName: { fontSize: 13.5, fontWeight: '700', color: THEME.ink, marginBottom: 3 },
  addrText: { fontSize: 13, color: THEME.muted, fontWeight: '600', lineHeight: 19 },
  addrDivider: { height: 1, backgroundColor: THEME.border, marginVertical: 12 },
  addrActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addrAction: { flexDirection: 'row', alignItems: 'center' },
  addrActionTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.ink, marginLeft: 7 },
  addrEmpty: { alignItems: 'center', paddingVertical: 44 },
  addrEmptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: 'rgba(0,194,155,0.9)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  addrEmptyTxt: { fontSize: 14, fontWeight: '700', color: THEME.muted },
  addrFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.card },
  addrTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  addrTypeBtnOn: { backgroundColor: THEME.brandSoft, borderColor: THEME.brand, borderWidth: 2 },
  addrTypeBtnTxt: { fontSize: 14, fontWeight: '700', color: THEME.muted, marginLeft: 8 },
  addrTypeBtnTxtOn: { color: THEME.brandDark, fontWeight: '800' },
});

const EMPTY_ADDR_FORM = {
  first_name: '', last_name: '', phone_code: '+33', phone_number: '',
  house_building: '', road_area_colony: '', pincode: '', city: '',
  state: '', address_type: 'home', countryFlag: 'FR', lat: null, lang: null,
};

function FakeProfileScreen({ onLogout, isAuth }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const { currency, setCurrency, fmtPrice } = useCurrency();
  const navigation = useNavigation();
  const [profile, setProfile] = React.useState({ nom: '', prenom: '', pseudo: '', photo: null });
  const [editVisible, setEditVisible] = React.useState(false);
  const [editNom, setEditNom] = React.useState('');
  const [editPrenom, setEditPrenom] = React.useState('');
  const [editPseudo, setEditPseudo] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [showPwdChange, setShowPwdChange] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [pwdError, setPwdError] = React.useState('');
  const [pwdSuccess, setPwdSuccess] = React.useState('');
  const [orders, setOrders] = React.useState([]);
  const [allOrdersVisible, setAllOrdersVisible] = React.useState(false);
  const [detailOrder, setDetailOrder] = React.useState(null);
  const [reorderVisible, setReorderVisible] = React.useState(false);
  const [reorderItems, setReorderItems] = React.useState([]); // [{...item, selected: true/false}]
  const [langVisible, setLangVisible] = React.useState(false);
  const [pendingLang, setPendingLang] = React.useState(null);
  const [currencyVisible, setCurrencyVisible] = React.useState(false);
  const [pendingCurrency, setPendingCurrency] = React.useState(null);
  const [addressListVisible, setAddressListVisible] = React.useState(false);
  const [addresses, setAddresses] = React.useState([]);
  const [addressLoading, setAddressLoading] = React.useState(false);
  const [addressFormVisible, setAddressFormVisible] = React.useState(false);
  const [editingAddressId, setEditingAddressId] = React.useState(null);
  const [addrForm, setAddrForm] = React.useState(EMPTY_ADDR_FORM);
  const [addrSaving, setAddrSaving] = React.useState(false);
  const [geoLoading, setGeoLoading] = React.useState(false);
  const [driverInfoVisible, setDriverInfoVisible] = React.useState(false);
  const [docStatuses, setDocStatuses] = React.useState(null);
  const [driverMode, setDriverMode] = React.useState(false);
  const [driverCountry, setDriverCountryState] = React.useState('FR');
  const [driverEarnings, setDriverEarnings] = React.useState({ total_year: 0, remaining: 3000, limit: 3000 });
  const [driverBlocked, setDriverBlocked] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    try {
      // Try to fetch from Marketplace API first
      const apiProfile = await apiGetProfile();
      if (apiProfile && apiProfile.id) {
        setProfile(apiProfile);
        return;
      }
    } catch(e) {}
    // Fallback to local storage
    try {
      const raw = await AsyncStorage.getItem(KEY_PROFILE);
      if (raw) setProfile(JSON.parse(raw));
    } catch(e) {}
  }, []);
  const loadOrders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
      if (raw) setOrders(JSON.parse(raw));
    } catch(e) {}
  }, []);
  const loadAddresses = React.useCallback(async () => {
    setAddressLoading(true);
    try {
      const list = await fetchAddresses();
      setAddresses(Array.isArray(list) ? list : []);
    } catch(e) {}
    setAddressLoading(false);
  }, []);

  useFocusEffect(React.useCallback(() => {
    loadProfile(); loadOrders(); loadAddresses();
    // Load driver mode status for regular users
    (async () => {
      try {
        const dm = await isDriverMode();
        setDriverMode(dm);
        const cc = await getDriverCountry();
        setDriverCountryState(cc);
        if (dm) {
          const earnings = await getDriverEarnings();
          setDriverEarnings(earnings);
          const ok = await canDeliver();
          setDriverBlocked(!ok);
        }
      } catch(e) {}
    })();
    // Load document verification status for pro users
    (async () => {
      try {
        const authRaw = await AsyncStorage.getItem(KEY_AUTH);
        const auth = authRaw ? JSON.parse(authRaw) : {};
        if (auth.role === 'professionaluser') {
          const data = await getDocumentStatus();
          if (data && data.status && data.document_status) {
            setDocStatuses(data.document_status);
            // Update isVerified in profile
            if (data.document_status.is_verified) {
              const profRaw = await AsyncStorage.getItem(KEY_PROFILE);
              const prof = profRaw ? JSON.parse(profRaw) : {};
              if (!prof.isVerified) {
                prof.isVerified = true;
                await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(prof));
                setProfile(prof);
              }
            }
          }
        }
      } catch(e) {}
    })();
  }, [loadProfile, loadOrders, loadAddresses]));

  React.useEffect(() => {
    if (isAuth) { loadProfile(); loadOrders(); }
  }, [isAuth, loadProfile, loadOrders]);

  const saveProfile = async () => {
    const updated = { ...profile, nom: editNom.trim(), prenom: editPrenom.trim(), pseudo: editPseudo.trim(), email: editEmail.trim() };
    // Try to update on Marketplace backend first
    try {
      await apiUpdateProfile({
        prenom: editPrenom.trim(),
        nom: editNom.trim(),
        pseudo: editPseudo.trim(),
        email: editEmail.trim(),
      });
    } catch(e) {}
    // Also update local accounts as fallback
    try {
      const accRaw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      if (accRaw) {
        const accounts = JSON.parse(accRaw);
        const idx = accounts.findIndex(a => a.email.toLowerCase() === profile.email.toLowerCase());
        if (idx >= 0) {
          accounts[idx].pseudo = editPseudo.trim();
          accounts[idx].nom = editNom.trim();
          accounts[idx].prenom = editPrenom.trim();
          accounts[idx].email = editEmail.trim();
          await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
        }
      }
    } catch(e) {}
    setProfile(updated);
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    setEditVisible(false);
  };

  const setAF = (k, v) => setAddrForm(f => ({ ...f, [k]: v }));

  const openAddressList = () => { setAddressListVisible(true); loadAddresses(); };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddrForm(EMPTY_ADDR_FORM);
    setAddressFormVisible(true);
  };

  const openEditAddress = (item) => {
    setEditingAddressId(item.id);
    setAddrForm({
      first_name: item.first_name || '', last_name: item.last_name || '',
      phone_code: item.phone_code || '+33', phone_number: item.phone_number || '',
      house_building: item.house_building || '', road_area_colony: item.road_area_colony || '',
      pincode: item.pincode || '', city: item.city || '', state: item.state || '',
      address_type: item.address_type === 'work' ? 'work' : 'home',
      countryFlag: item.countryFlag || 'FR',
      lat: item.lat ?? null, lang: item.lang ?? null,
    });
    setAddressFormVisible(true);
  };

  const submitAddress = async () => {
    if (!addrForm.first_name.trim() || !addrForm.house_building.trim() || !addrForm.city.trim()) {
      Alert.alert(t('profile.deliveryAddress'), t('profile.pwdErrorEmpty'));
      return;
    }
    setAddrSaving(true);
    try {
      const payload = {
        first_name: addrForm.first_name.trim(),
        last_name: addrForm.last_name.trim(),
        phone_code: (addrForm.phone_code || '').trim() || '+33',
        phone_number: addrForm.phone_number.trim(),
        house_building: addrForm.house_building.trim(),
        road_area_colony: addrForm.road_area_colony.trim(),
        pincode: addrForm.pincode.trim(),
        city: addrForm.city.trim(),
        state: addrForm.state.trim(),
        address_type: addrForm.address_type,
        countryFlag: addrForm.countryFlag || 'FR',
        lat: addrForm.lat, lang: addrForm.lang,
      };
      if (editingAddressId) await updateAddress(editingAddressId, payload);
      else await createAddress(payload);
      await loadAddresses();
      setAddressFormVisible(false);
    } catch (e) {
      Alert.alert(t('profile.deliveryAddress'), t('profile.addrSaveError', 'Could not save the address.'));
    }
    setAddrSaving(false);
  };

  const confirmDeleteAddress = (id) => {
    Alert.alert(
      t('profile.deliveryAddress'),
      t('profile.addrDeleteConfirm', 'Delete this address?'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        { text: t('profile.delete', 'Delete'), style: 'destructive', onPress: async () => {
          try { await deleteAddressById(id); await loadAddresses(); } catch (e) {}
        } },
      ]
    );
  };

  const selectDefaultAddress = async (id) => {
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    try { await makeAddressDefault(id); } catch (e) {}
    loadAddresses();
  };

  const addressGeo = async () => {
    try {
      setGeoLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeoLoading(false);
        Alert.alert(t('profile.locationDenied'), t('profile.locationDeniedMsg'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const results = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const r = results && results[0];
      if (r) {
        setAddrForm(f => ({
          ...f,
          house_building: ((r.streetNumber || '') + ' ' + (r.street || r.name || '')).trim() || f.house_building,
          road_area_colony: r.district || r.subregion || f.road_area_colony,
          city: r.city || r.region || f.city,
          pincode: r.postalCode || f.pincode,
          state: r.region || f.state,
          countryFlag: r.isoCountryCode || f.countryFlag,
          lat: loc.coords.latitude, lang: loc.coords.longitude,
        }));
      } else {
        Alert.alert(t('profile.deliveryAddress'), t('profile.locationError'));
      }
      setGeoLoading(false);
    } catch (e) {
      setGeoLoading(false);
      Alert.alert(t('profile.deliveryAddress'), t('profile.locationError'));
    }
  };

  const defaultAddress = addresses.find(a => a.is_default) || addresses[0] || null;

  const handleChangePassword = async () => {
    setPwdError(''); setPwdSuccess('');
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { setPwdError(t('profile.pwdErrorEmpty')); return; }
    if (newPassword !== confirmPassword) { setPwdError(t('profile.pwdErrorMismatch')); return; }
    if (newPassword.length < 6) { setPwdError(t('profile.pwdErrorLength')); return; }
    try {
      // Try Marketplace API first
      const apiResult = await apiUpdatePassword(oldPassword, newPassword);
      if (apiResult.status) {
        setPwdSuccess(t('profile.pwdSuccess'));
        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        setTimeout(() => { setShowPwdChange(false); setPwdSuccess(''); }, 1500);
        return;
      }
      // Fallback to local accounts
      const accRaw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      if (accRaw) {
        const accounts = JSON.parse(accRaw);
        const idx = accounts.findIndex(a => a.email.toLowerCase() === profile.email.toLowerCase());
        if (idx >= 0) {
          if (accounts[idx].password !== oldPassword) { setPwdError(apiResult.message || t('profile.pwdErrorOld')); return; }
          accounts[idx].password = newPassword;
          await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
          setPwdSuccess(t('profile.pwdSuccess'));
          setOldPassword(''); setNewPassword(''); setConfirmPassword('');
          setTimeout(() => { setShowPwdChange(false); setPwdSuccess(''); }, 1500);
        }
      }
    } catch(e) { setPwdError(t('profile.pwdErrorGeneral')); }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.photoPermissionTitle'), t('profile.photoPermissionMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const updated = { ...profile, photo: uri };
      setProfile(updated);
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
      // Sync photo with Marketplace backend
      try { await uploadProfilePhoto(uri); } catch(e) {}
    }
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return iso; }
  };

  const initials = (profile.prenom || profile.nom || '').trim().charAt(0).toUpperCase();
  // Avatar ring reflects the user's status — a new user (no orders yet) gets a blue ring.
  const statusRingColor = (orders.length === 0) ? '#3B82F6' : BRAND;

  // Track delivery status from API for delivery orders
  const [deliveryStatuses, setDeliveryStatuses] = React.useState({});

  // Poll delivery status for recent delivery orders
  React.useEffect(() => {
    let mounted = true;
    const pollDeliveryStatuses = async () => {
      const recentDeliveryOrders = orders.filter(o => o.mode === 'delivery' && o.deliveryStatus && o.deliveryStatus !== DELIVERY_STATUS.DELIVERED && o.deliveryStatus !== DELIVERY_STATUS.CANCELLED);
      for (const order of recentDeliveryOrders.slice(0, 5)) {
        try {
          const status = await getDeliveryStatus(order.id);
          if (mounted && status && status.status) {
            setDeliveryStatuses(prev => ({ ...prev, [order.id]: status }));
            // Update order in history
            const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
            if (raw) {
              const hist = JSON.parse(raw);
              const idx = hist.findIndex(o => o.id === order.id);
              if (idx >= 0 && hist[idx].deliveryStatus !== status.status) {
                hist[idx].deliveryStatus = status.status;
                hist[idx].driverName = status.driver_name || '';
                hist[idx].driverPhone = status.driver_phone || '';
                hist[idx].estimatedArrival = status.estimated_arrival || '';
                hist[idx].deliveryCode = status.delivery_code || hist[idx].deliveryCode || '';
                await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(hist));
              }
            }
          }
        } catch(e) {}
      }
    };
    if (orders.length > 0) {
      pollDeliveryStatuses();
      const interval = setInterval(pollDeliveryStatuses, 30000); // Poll every 30s
      return () => { mounted = false; clearInterval(interval); };
    }
    return () => { mounted = false; };
  }, [orders]);

  // Get order status - uses delivery API for delivery orders, simulated for collect
  const getOrderStatus = (order) => {
    // For delivery orders, check real delivery status from API
    if (order.mode === 'delivery' && order.deliveryStatus) {
      const apiStatus = deliveryStatuses[order.id];
      if (apiStatus && apiStatus.status) {
        return getDeliveryStatusInfo(apiStatus.status, t);
      }
      // Fallback: use stored delivery status
      return getDeliveryStatusInfo(order.deliveryStatus, t);
    }

    // Simulated status based on time elapsed (collect mode or no delivery tracking)
    const elapsed = Date.now() - (order.id || Date.parse(order.date) || 0);
    const minutes = elapsed / 60000;
    const isCollect = order.mode === 'collect';
    if (minutes < 5) return { step: 0, label: t('orderStatus.confirmed'), color: '#059669', icon: 'checkmark-circle' };
    if (minutes < 15) return { step: 1, label: t('orderStatus.preparing'), color: '#F59E0B', icon: 'storefront' };
    if (minutes < 30) return { step: 2, label: isCollect ? t('orderStatus.ready') : t('orderStatus.onTheWay'), color: isCollect ? '#059669' : '#F97316', icon: isCollect ? 'bag-handle' : 'bicycle' };
    if (minutes < 45) return { step: 3, label: isCollect ? t('orderStatus.waitingPickup') : t('orderStatus.almostThere'), color: '#8B5CF6', icon: isCollect ? 'walk' : 'location' };
    return { step: 4, label: isCollect ? t('orderStatus.collected') : t('orderStatus.delivered'), color: '#059669', icon: 'checkmark-done' };
  };

  const OrderSteps = ({ mode }) => {
    const isCollect = mode === 'collect';
    const steps = isCollect ? [
      { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
      { icon: "storefront", label: t('orderStatus.preparingDone') },
      { icon: "bag-handle", label: t('orderStatus.ready') },
      { icon: "walk", label: t('orderStatus.pickedUp') },
      { icon: "checkmark-done", label: t('orderStatus.collected') },
    ] : [
      { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
      { icon: "storefront", label: t('orderStatus.preparingDone') },
      { icon: "bicycle", label: t('orderStatus.onTheWay') },
      { icon: "location", label: t('orderStatus.almostThere') },
      { icon: "home", label: t('orderStatus.delivered') },
    ];
    return (
      <View style={{ marginBottom:10 }}>
        {steps.map((step, i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
            <View style={{ width:24, height:24, borderRadius:12, backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center' }}>
              <Ionicons name={step.icon} size={12} color="#fff" />
            </View>
            {i < steps.length - 1 && (
              <View style={{ position:'absolute', left:11, top:24, width:2, height:6, backgroundColor:'#00C29B' }} />
            )}
            <Text style={{ fontSize:12, fontWeight:'600', color:'#111', marginLeft:8 }}>{step.label}</Text>
            <Ionicons name="checkmark" size={14} color="#00C29B" style={{ marginLeft:6 }} />
          </View>
        ))}
      </View>
    );
  };

  if (!isAuth) {
    return (
      <SafeAreaView style={profStyles.screen} edges={['top']}>
        <View style={profStyles.header}>
          <Text style={profStyles.title}>{t('tabs.profile')}</Text>
        </View>
        <View style={profStyles.guestWrap}>
          <View style={profStyles.emptyCircle}>
            <Ionicons name="person-outline" size={44} color="#fff" />
          </View>
          <Text style={profStyles.guestTitle}>{t('profile.guestTitle') || 'Vous n\'êtes pas connecté'}</Text>
          <Text style={profStyles.guestHint}>{t('profile.guestHint') || 'Connectez-vous pour gérer votre profil, vos commandes et la livraison.'}</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => DeviceEventEmitter.emit('OPEN_AUTH')} style={profStyles.guestBtn}>
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={profStyles.guestBtnTxt}>{t('auth.loginBtn') || 'Se connecter'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={profStyles.screen} edges={['top']}>
      <View style={profStyles.header}>
        <Text style={profStyles.title}>{t('tabs.profile')}</Text>
        <Text style={profStyles.subtitle}>{(profile.prenom || '') + ' ' + (profile.nom || '')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom:28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={profStyles.profileCard}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={profStyles.avatarWrap}>
            <View style={[profStyles.avatar, { borderColor: statusRingColor }]}>
              {profile.photo && (profile.photo.startsWith('/') || profile.photo.startsWith('file')) ? (
                <Image source={{ uri: profile.photo }} style={profStyles.avatarImg} />
              ) : (
                <Text style={profStyles.avatarInitials}>{initials || '👤'}</Text>
              )}
            </View>
            <View style={profStyles.avatarBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={profStyles.profileName}>{(profile.prenom || '') + ' ' + (profile.nom || '')}</Text>
          {profile.pseudo ? <Text style={profStyles.profileHandle}>@{profile.pseudo}</Text> : null}

          <TouchableOpacity activeOpacity={0.85} onPress={() => { setEditNom(profile.nom); setEditPrenom(profile.prenom); setEditPseudo(profile.pseudo||''); setEditEmail(profile.email||''); setShowPwdChange(false); setPwdError(''); setPwdSuccess(''); setEditVisible(true); }} style={profStyles.editBtn}>
            <Ionicons name="create-outline" size={16} color={THEME.brandDark} />
            <Text style={profStyles.editBtnTxt}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Document Verification Status (Pro users) */}
        {profile.role === 'professionaluser' && (
          <View style={profStyles.section}>
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.verificationStatus') || 'Statut de vérification'}</Text>
            </View>
            {!profile.isVerified && (
              <View style={[profStyles.banner, profStyles.bannerWarn]}>
                <Ionicons name="time-outline" size={20} color="#B45309" />
                <Text style={[profStyles.bannerTxt, { color:'#92400E' }]}>{t('profile.verificationPending') || 'Votre compte est en cours de vérification par notre équipe.'}</Text>
              </View>
            )}
            {profile.isVerified && (
              <View style={[profStyles.banner, profStyles.bannerOk]}>
                <Ionicons name="checkmark-circle" size={20} color={THEME.brandDark} />
                <Text style={[profStyles.bannerTxt, { color:THEME.brandDark }]}>{t('profile.verificationApproved') || 'Compte vérifié'}</Text>
              </View>
            )}
            {docStatuses && (
              <View style={profStyles.docCard}>
                {[
                  { key: 'kbiss_status', label: 'KBISS' },
                  { key: 'iban_status', label: 'IBAN / RIB' },
                  { key: 'identityCardFront_status', label: t('auth.docIdFront') || 'Carte d\'identité (recto)' },
                  { key: 'identityCardBack_status', label: t('auth.docIdBack') || 'Carte d\'identité (verso)' },
                  { key: 'proofOfAddress_status', label: t('auth.docProofAddress') || 'Justificatif de domicile' },
                ].map((doc, i) => {
                  const status = docStatuses[doc.key] || 'pending';
                  const icon = status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time-outline';
                  const color = status === 'approved' ? THEME.brand : status === 'rejected' ? THEME.danger : '#F59E0B';
                  const tint = status === 'approved' ? THEME.brandSoft : status === 'rejected' ? THEME.dangerSoft : '#FEF3C7';
                  const label = status === 'approved' ? (t('profile.docApproved') || 'Approuvé') : status === 'rejected' ? (t('profile.docRejected') || 'Rejeté') : (t('profile.docPending') || 'En attente');
                  return (
                    <View key={i} style={[profStyles.docRow, i < 4 && profStyles.docDivider]}>
                      <View style={[profStyles.docIcon, { backgroundColor: tint }]}>
                        <Ionicons name={icon} size={17} color={color} />
                      </View>
                      <Text style={profStyles.docLabel}>{doc.label}</Text>
                      <View style={[profStyles.docStatusPill, { backgroundColor: tint }]}>
                        <Text style={[profStyles.docStatusTxt, { color }]}>{label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Order History */}
        <View style={profStyles.section}>
          <View style={profStyles.sectionHeadRow}>
            <Text style={profStyles.sectionTitle}>{t('profile.orderHistory')}</Text>
            {orders.length > 0 ? <Text style={profStyles.sectionCount}>{orders.length}</Text> : null}
          </View>

          {orders.length === 0 ? (
            <View style={profStyles.empty}>
              <View style={profStyles.emptyCircle}>
                <Ionicons name="receipt-outline" size={24} color="#fff" />
              </View>
              <Text style={profStyles.emptyTitle}>{t('profile.noOrders')}</Text>
            </View>
          ) : (
            <>
              {orders.slice(0,3).map((order) => {
                const status = getOrderStatus(order);
                return (
                <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => setDetailOrder(order)} style={profStyles.orderCard}>
                  <View style={profStyles.orderRow}>
                    <View style={profStyles.orderIcon}>
                      <Ionicons name={status.icon} size={20} color={THEME.brand} />
                    </View>
                    <View style={profStyles.orderBody}>
                      <Text style={profStyles.orderTitle} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                      <View style={profStyles.orderStatusRow}>
                        <View style={[profStyles.orderDot, { backgroundColor: status.color }]} />
                        <Text style={[profStyles.orderStatusTxt, { color: status.color }]}>{status.label}</Text>
                      </View>
                      {(order.shops && order.shops.length > 0) ? (
                        <Text style={profStyles.orderShops} numberOfLines={1}>{order.shops.join(', ')}</Text>
                      ) : null}
                      <Text style={profStyles.orderDate}>{fmtDate(order.date)}</Text>
                    </View>
                    <View style={profStyles.orderSide}>
                      <View style={profStyles.modePill}>
                        <Text style={profStyles.modePillTxt}>
                          {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                        </Text>
                      </View>
                      <Text style={profStyles.orderPrice}>{fmtPrice(order.total||0)}</Text>
                      <Ionicons name="chevron-forward" size={16} color={THEME.faint} style={{marginTop:4}} />
                    </View>
                  </View>
                </TouchableOpacity>
                );
              })}
              {orders.length > 0 && (
                <TouchableOpacity activeOpacity={0.85} onPress={() => setAllOrdersVisible(true)} style={profStyles.primaryBtn}>
                  <Ionicons name="time-outline" size={18} color="#fff" />
                  <Text style={profStyles.primaryBtnTxt}>{t('profile.openAllHistory')} ({orders.length})</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Preferences */}
        <View style={profStyles.section}>
          <View style={profStyles.settingsCard}>
            {/* Address */}
            <TouchableOpacity activeOpacity={0.8} onPress={openAddressList} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="location-outline" size={19} color="#fff" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.deliveryAddress')}</Text>
                <Text style={profStyles.settingValue} numberOfLines={1}>
                  {defaultAddress ? [defaultAddress.house_building, defaultAddress.city].filter(Boolean).join(', ') : t('profile.noAddress')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>

            {/* Language */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setLangVisible(true)} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="language-outline" size={19} color="#fff" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.language')}</Text>
                <Text style={profStyles.settingValue}>
                  {LANGUAGES.find(l => l.code === i18nInstance.language)?.flag || '🌐'} {({'fr':'Français','en':'English','es':'Español','zh':'中文','ar':'العربية','de':'Deutsch','nl':'Nederlands','it':'Italiano','pt':'Português','ja':'日本語','th':'ไทย','sv':'Svenska','ru':'Русский'})[i18nInstance.language] || i18nInstance.language}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>

            {/* Currency */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setCurrencyVisible(true)} style={profStyles.settingRow}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="cash-outline" size={19} color="#fff" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.currency')}</Text>
                <Text style={profStyles.settingValue}>{currency.flag} {currency.code}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Become a driver */}
        <View style={profStyles.section}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setDriverInfoVisible(true)} style={profStyles.driverCard}>
            <View style={profStyles.driverIcon}>
              <Ionicons name="bicycle" size={22} color="#fff" />
            </View>
            <View style={profStyles.driverBody}>
              <Text style={profStyles.driverTitle}>{t('profile.becomeDriver') || 'Devenir livreur'}</Text>
              <Text style={profStyles.driverSub}>{t('profile.driverSubtitle') || 'Livrez et gagnez un complément de revenu'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={[profStyles.section, { marginBottom: 8 }]}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => {
            Alert.alert(t('profile.logoutTitle'), t('profile.logoutConfirm'), [
              { text: t('profile.cancel'), style: 'cancel' },
              { text: t('profile.logoutAction'), style: 'destructive', onPress: async () => {
                // Sauvegarder les données du compte avant déconnexion
                try {
                  const authRaw = await AsyncStorage.getItem(KEY_AUTH);
                  if (authRaw) {
                    const auth = JSON.parse(authRaw);
                    const userKey = auth.userKey || 'USER_' + auth.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    const data = {
                      profile: JSON.parse(await AsyncStorage.getItem(KEY_PROFILE) || 'null'),
                      items: JSON.parse(await AsyncStorage.getItem(KEY_ITEMS) || '[]'),
                      selected: JSON.parse(await AsyncStorage.getItem(KEY_SELECTED) || '[]'),
                      cart: JSON.parse(await AsyncStorage.getItem(KEY_CART) || '[]'),
                      orders: JSON.parse(await AsyncStorage.getItem(KEY_ORDER_HISTORY) || '[]'),
                      favShops: JSON.parse(await AsyncStorage.getItem(KEY_FAV_SHOPS) || '[]'),
                      favs: JSON.parse(await AsyncStorage.getItem(KEY_FAVS) || '[]'),
                    };
                    await AsyncStorage.setItem(userKey + '_DATA', JSON.stringify(data));
                  }
                } catch(e) {}
                // Logout from Marketplace API first (needs tokens)
                try { await logoutUser(); } catch(e) {}
                // Nettoyer les données courantes
                try {
                  await AsyncStorage.multiRemove([KEY_AUTH, KEY_PROFILE, KEY_ORDER_HISTORY, 'MARKETPLACE_TOKENS']);
                  await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_FAVS, JSON.stringify([]));
                } catch(e) {}
                if (onLogout) onLogout();
              }}
            ]);
          }} style={profStyles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={THEME.danger} />
            <Text style={profStyles.logoutTxt}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Driver Info Full Page Modal */}
      <Modal visible={driverInfoVisible} animationType="slide">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setDriverInfoVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.becomeDriver') || 'Devenir livreur'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:40 }} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={profStyles.driverHero}>
              <View style={profStyles.driverHeroIcon}>
                <Ionicons name="bicycle" size={36} color="#fff" />
              </View>
              <Text style={profStyles.driverHeroTitle}>Pearl Delivery</Text>
              <Text style={profStyles.driverHeroSub}>
                {t('profile.driverInfoDesc') || 'Gagnez un complément de revenu en livrant des commandes dans votre ville.'}
              </Text>
            </View>

            {/* Two types */}
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.driverTypes') || 'Deux façons de livrer'}</Text>
            </View>

            <View style={profStyles.driverTypeCard}>
              <View style={profStyles.driverTypeHead}>
                <View style={profStyles.driverTypeIcon}>
                  <Ionicons name="bicycle" size={19} color={THEME.brand} />
                </View>
                <Text style={profStyles.driverTypeTitle}>{t('profile.driverParticulier') || 'Livreur Particulier'}</Text>
              </View>
              <Text style={profStyles.driverTypeTxt}>
                {t('profile.driverParticulierInfo') || 'Aucun statut professionnel requis. Livrez quand vous voulez en complément de revenu, dans la limite du plafond annuel de votre pays.'}
              </Text>
            </View>

            <View style={[profStyles.driverTypeCard, { marginBottom: 18 }]}>
              <View style={profStyles.driverTypeHead}>
                <View style={profStyles.driverTypeIcon}>
                  <Ionicons name="storefront" size={19} color={THEME.brand} />
                </View>
                <Text style={profStyles.driverTypeTitle}>{t('profile.driverPro') || 'Livreur Pro'}</Text>
              </View>
              <Text style={profStyles.driverTypeTxt}>
                {t('profile.driverProInfo') || 'Vous avez un statut professionnel (auto-entrepreneur, société). Pas de limite de revenus. Documents requis : carte d\'identité, IBAN, KBISS.'}
              </Text>
            </View>

            {/* Country limits */}
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.driverLimits') || 'Plafonds par pays (particuliers)'}</Text>
            </View>

            {[
              { flag: '🇫🇷', name: 'France', limit: '3 000 €/an', status: 'ok', info: 'Micro-BIC — Abattement 50%' },
              { flag: '🇧🇪', name: 'Belgique', limit: '7 700 €/an', status: 'ok', info: 'Taux fixe 10,7%' },
              { flag: '🇬🇧', name: 'Royaume-Uni', limit: '1 000 £/an', status: 'ok', info: 'Trading Allowance' },
              { flag: '🇩🇪', name: 'Allemagne', limit: '—', status: 'gray', info: 'Pas de cadre spécifique' },
              { flag: '🇮🇹', name: 'Italie', limit: '—', status: 'gray', info: 'Pas de cadre spécifique' },
              { flag: '🇪🇸', name: 'Espagne', limit: '—', status: 'blocked', info: 'Statut salarié obligatoire' },
              { flag: '🇨🇭', name: 'Suisse', limit: '—', status: 'blocked', info: 'Statut salarié depuis 2023' },
              { flag: '🇳🇱', name: 'Pays-Bas', limit: '—', status: 'strict', info: 'Risque de requalification' },
              { flag: '🇵🇹', name: 'Portugal', limit: '—', status: 'gray', info: 'Pas de cadre spécifique' },
            ].map((c, i) => {
              const limitColor = c.status === 'ok' ? THEME.brand : c.status === 'blocked' ? THEME.danger : '#F59E0B';
              return (
              <View key={i} style={profStyles.limitRow}>
                <Text style={profStyles.limitFlag}>{c.flag}</Text>
                <View style={{ flex:1 }}>
                  <Text style={profStyles.limitName}>{c.name}</Text>
                  <Text style={profStyles.limitInfo}>{c.info}</Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={[profStyles.limitValue, { color: limitColor }]}>{c.limit}</Text>
                  <Ionicons name={c.status === 'ok' ? 'checkmark-circle' : c.status === 'blocked' ? 'close-circle' : 'alert-circle'} size={14} color={limitColor} style={{marginTop:2}} />
                </View>
              </View>
              );
            })}

            {/* CTA */}
            <View style={{ marginTop:18 }}>
              <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                const { Linking, Platform } = require('react-native');
                try {
                  const canOpen = await Linking.canOpenURL('pearl-delivery://');
                  if (canOpen) {
                    setDriverInfoVisible(false);
                    Linking.openURL('pearl-delivery://');
                  } else {
                    throw new Error('not installed');
                  }
                } catch(e) {
                  // App not installed — redirect to store
                  Alert.alert(
                    'Pearl Delivery',
                    t('profile.downloadDeliveryApp') || "L'app Pearl Delivery n'est pas installée. Téléchargez-la pour devenir livreur.",
                    [
                      { text: t('profile.cancel') || 'Annuler', style: 'cancel' },
                      { text: 'App Store', onPress: () => Linking.openURL('https://apps.apple.com/app/pearl-delivery/id000000000') },
                      Platform.OS === 'android' ? { text: 'Google Play', onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.pearlstreets.delivery') } : null,
                    ].filter(Boolean)
                  );
                }
              }} style={profStyles.primaryBtn}>
                <Ionicons name="bicycle" size={22} color="#fff" />
                <Text style={profStyles.primaryBtnTxt}>{t('profile.openDeliveryApp') || "Ouvrir l'app Pearl Delivery"}</Text>
              </TouchableOpacity>
              <Text style={profStyles.legalNote}>
                {t('profile.driverLegalNote') || "L'inscription se fait directement dans l'app Pearl Delivery. Vous pouvez choisir entre livreur particulier ou professionnel."}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Profile Full Page Modal */}
      <Modal visible={editVisible} animationType="slide">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{t('profile.editProfile')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.pseudo')}</Text>
                <TextInput value={editPseudo} onChangeText={setEditPseudo} placeholder={t('profile.pseudoPlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.firstName')}</Text>
                <TextInput value={editPrenom} onChangeText={setEditPrenom} placeholder={t('profile.firstNamePlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.lastName')}</Text>
                <TextInput value={editNom} onChangeText={setEditNom} placeholder={t('profile.lastNamePlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.email')}</Text>
                <TextInput value={editEmail} onChangeText={setEditEmail} placeholder={t('profile.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none"
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              {/* Password change section */}
              {!showPwdChange ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => { setShowPwdChange(true); setPwdError(''); setPwdSuccess(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  style={profStyles.pwdToggle}>
                  <View style={profStyles.settingIcon}>
                    <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                  </View>
                  <Text style={profStyles.pwdToggleTxt}>{t('profile.changePassword')}</Text>
                  <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
                </TouchableOpacity>
              ) : (
                <View style={profStyles.pwdPanel}>
                  <View style={profStyles.pwdPanelHead}>
                    <Ionicons name="lock-closed-outline" size={18} color={THEME.brand} />
                    <Text style={profStyles.pwdPanelTitle}>{t('profile.changePassword')}</Text>
                    <TouchableOpacity onPress={() => setShowPwdChange(false)} style={profStyles.closeBtn}>
                      <Ionicons name="close" size={18} color={THEME.muted} />
                    </TouchableOpacity>
                  </View>

                  {pwdError ? (
                    <View style={[profStyles.pwdAlert, { backgroundColor: THEME.dangerSoft }]}>
                      <Ionicons name="alert-circle" size={16} color={THEME.danger} />
                      <Text style={[profStyles.pwdAlertTxt, { color: THEME.danger }]}>{pwdError}</Text>
                    </View>
                  ) : null}
                  {pwdSuccess ? (
                    <View style={[profStyles.pwdAlert, { backgroundColor: THEME.brandSoft }]}>
                      <Ionicons name="checkmark-circle" size={16} color={THEME.brandDark} />
                      <Text style={[profStyles.pwdAlertTxt, { color: THEME.brandDark }]}>{pwdSuccess}</Text>
                    </View>
                  ) : null}

                  <View style={profStyles.fieldGroup}>
                    <Text style={profStyles.fieldLabel}>{t('profile.oldPassword')}</Text>
                    <TextInput value={oldPassword} onChangeText={setOldPassword} placeholder={t('profile.currentPasswordPlaceholder')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <View style={profStyles.fieldGroup}>
                    <Text style={profStyles.fieldLabel}>{t('profile.newPassword')}</Text>
                    <TextInput value={newPassword} onChangeText={setNewPassword} placeholder={t('profile.newPassword')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <View style={[profStyles.fieldGroup, { marginBottom: 4 }]}>
                    <Text style={profStyles.fieldLabel}>{t('profile.confirmPassword')}</Text>
                    <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('profile.confirmPassword')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <TouchableOpacity activeOpacity={0.85} onPress={handleChangePassword} style={[profStyles.primaryBtn, { marginTop: 12 }]}>
                    <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.validate')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={profStyles.btnRow}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setEditVisible(false)} style={profStyles.cancelBtn}>
                  <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={saveProfile} style={profStyles.saveBtn}>
                  <Text style={profStyles.saveBtnTxt}>{t('profile.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Language Selector Full Page Modal */}
      <Modal visible={langVisible} animationType="slide" onShow={() => setPendingLang(null)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => { setPendingLang(null); setLangVisible(false); }} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.language')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
            {LANGUAGES.map(lang => {
              const currentLang = i18nInstance.language || 'fr';
              const isActive = currentLang === lang.code || currentLang.startsWith(lang.code);
              const isSelected = pendingLang === lang.code || (!pendingLang && isActive);
              return (
                <TouchableOpacity key={lang.code} activeOpacity={0.8} onPress={() => setPendingLang(lang.code)} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                  <Text style={profStyles.pickerFlag}>{lang.flag}</Text>
                  <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn, { flex:1 }]}>{lang.label}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                const lang = pendingLang || i18nInstance.language;
                i18nInstance.changeLanguage(lang);
                await AsyncStorage.setItem('APP_LANGUAGE', lang);
                setPendingLang(null);
                setLangVisible(false);
              }} style={[profStyles.primaryBtn, !pendingLang && profStyles.primaryBtnDisabled]}>
                <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Currency Selector Full Page Modal */}
      <Modal visible={currencyVisible} animationType="slide" onShow={() => setPendingCurrency(null)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => { setPendingCurrency(null); setCurrencyVisible(false); }} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.currency')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
            {CURRENCIES.map(curr => {
              const isSelected = pendingCurrency === curr.code || (!pendingCurrency && currency.code === curr.code);
              return (
                <TouchableOpacity key={curr.code} activeOpacity={0.8} onPress={() => setPendingCurrency(curr.code)} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                  <Text style={profStyles.pickerFlag}>{curr.flag}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn]}>{curr.name}</Text>
                    <Text style={profStyles.pickerSub}>{curr.code}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => {
                const code = pendingCurrency || currency.code;
                const found = CURRENCIES.find(c => c.code === code);
                if (found) setCurrency(found);
                setPendingCurrency(null);
                setCurrencyVisible(false);
              }} style={[profStyles.primaryBtn, !pendingCurrency && profStyles.primaryBtnDisabled]}>
                <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Delivery Address — saved addresses list */}
      <Modal visible={addressListVisible} animationType="slide" onRequestClose={() => setAddressListVisible(false)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setAddressListVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.deliveryAddress')}</Text>
          </View>
          {addressLoading && addresses.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={THEME.brand} size="large" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={profStyles.addrSectionTitle}>{t('profile.addrSelect', 'Select delivery address')}</Text>
              {addresses.length === 0 ? (
                <View style={profStyles.addrEmpty}>
                  <View style={profStyles.addrEmptyIcon}>
                    <Ionicons name="location-outline" size={26} color="#fff" />
                  </View>
                  <Text style={profStyles.addrEmptyTxt}>{t('profile.addrEmpty', 'No saved address yet')}</Text>
                </View>
              ) : addresses.map((item) => {
                const isDef = !!item.is_default;
                const isWork = item.address_type === 'work';
                const fullAddr = [item.house_building, item.road_area_colony, [item.pincode, item.city].filter(Boolean).join(' '), item.state].filter(Boolean).join(', ');
                const who = [item.first_name, item.last_name].filter(Boolean).join(' ');
                const phone = [item.phone_code, item.phone_number].filter(Boolean).join(' ');
                return (
                  <TouchableOpacity key={String(item.id)} activeOpacity={0.85} onPress={() => !isDef && selectDefaultAddress(item.id)} style={[profStyles.addrCard, isDef && profStyles.addrCardOn]}>
                    <View style={profStyles.addrCardHead}>
                      <View style={profStyles.addrTypeIcon}>
                        <Ionicons name={isWork ? 'briefcase' : 'home'} size={14} color="#fff" />
                      </View>
                      <Text style={profStyles.addrType}>{isWork ? t('profile.addrWork', 'Work') : t('profile.addrHome', 'Home')}</Text>
                      {isDef && (
                        <View style={profStyles.addrBadge}>
                          <Text style={profStyles.addrBadgeTxt}>{t('profile.addrDefault', 'Default')}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }} />
                      {isDef && (
                        <View style={profStyles.addrCheck}>
                          <Ionicons name="checkmark" size={15} color="#fff" />
                        </View>
                      )}
                    </View>
                    {!!(who || phone) && (
                      <Text style={profStyles.addrName} numberOfLines={1}>{[who, phone].filter(Boolean).join('  •  ')}</Text>
                    )}
                    <Text style={profStyles.addrText}>{fullAddr}</Text>
                    <View style={profStyles.addrDivider} />
                    <View style={profStyles.addrActions}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => openEditAddress(item)} style={profStyles.addrAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="create-outline" size={17} color={THEME.ink} />
                        <Text style={profStyles.addrActionTxt}>{t('profile.edit', 'Edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => confirmDeleteAddress(item.id)} style={profStyles.addrAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={17} color={THEME.danger} />
                        <Text style={[profStyles.addrActionTxt, { color: THEME.danger }]}>{t('profile.delete', 'Delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <View style={profStyles.addrFooter}>
            <TouchableOpacity activeOpacity={0.9} onPress={openAddAddress} style={profStyles.primaryBtn}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={profStyles.primaryBtnTxt}>{t('profile.addrAdd', 'Add New Address')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Delivery Address — add / edit form */}
      <Modal visible={addressFormVisible} animationType="slide" onRequestClose={() => setAddressFormVisible(false)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => setAddressFormVisible(false)} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{editingAddressId ? t('profile.addrEditTitle', 'Edit Address') : t('profile.addrAdd', 'Add New Address')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={0.85} onPress={addressGeo} disabled={geoLoading} style={[profStyles.geoBtn, geoLoading && { backgroundColor: THEME.subtle }]}>
                {geoLoading ? (
                  <ActivityIndicator color={THEME.brand} />
                ) : (
                  <Ionicons name="navigate" size={19} color={THEME.brandDark} />
                )}
                <Text style={profStyles.geoBtnTxt}>{geoLoading ? t('profile.locating') : t('profile.useMyLocation')}</Text>
              </TouchableOpacity>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrType', 'Address type')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[['home', 'home', t('profile.addrHome', 'Home')], ['work', 'briefcase', t('profile.addrWork', 'Work')]].map(([key, icon, label]) => {
                    const on = addrForm.address_type === key;
                    return (
                      <TouchableOpacity key={key} activeOpacity={0.8} onPress={() => setAF('address_type', key)} style={[profStyles.addrTypeBtn, on && profStyles.addrTypeBtnOn]}>
                        <Ionicons name={on ? icon : icon + '-outline'} size={17} color={on ? THEME.brandDark : THEME.muted} />
                        <Text style={[profStyles.addrTypeBtnTxt, on && profStyles.addrTypeBtnTxtOn]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={profStyles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.firstName')}</Text>
                  <TextInput value={addrForm.first_name} onChangeText={(v) => setAF('first_name', v)} placeholder={t('profile.firstNamePlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.lastName')}</Text>
                  <TextInput value={addrForm.last_name} onChangeText={(v) => setAF('last_name', v)} placeholder={t('profile.lastNamePlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrPhone', 'Phone')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TextInput value={addrForm.phone_code} onChangeText={(v) => setAF('phone_code', v)} placeholder="+33" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[profStyles.field, { width: 88 }]} />
                  <TextInput value={addrForm.phone_number} onChangeText={(v) => setAF('phone_number', v)} placeholder="6 12 34 56 78" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[profStyles.field, { flex: 1 }]} />
                </View>
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.street')}</Text>
                <TextInput value={addrForm.house_building} onChangeText={(v) => setAF('house_building', v)} placeholder={t('profile.streetPlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addressSupplement')}</Text>
                <TextInput value={addrForm.road_area_colony} onChangeText={(v) => setAF('road_area_colony', v)} placeholder={t('profile.supplementPlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.postalCode')}</Text>
                  <TextInput value={addrForm.pincode} onChangeText={(v) => setAF('pincode', v)} placeholder={t('profile.postalCodePlaceholder')} keyboardType="number-pad" placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.city')}</Text>
                  <TextInput value={addrForm.city} onChangeText={(v) => setAF('city', v)} placeholder={t('profile.cityPlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
              </View>

              <View style={[profStyles.fieldGroup, { marginBottom: 24 }]}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrState', 'State / Region')}</Text>
                <TextInput value={addrForm.state} onChangeText={(v) => setAF('state', v)} placeholder={t('profile.addrState', 'State / Region')} placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.btnRow}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setAddressFormVisible(false)} style={profStyles.cancelBtn}>
                  <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={submitAddress} disabled={addrSaving} style={profStyles.saveBtn}>
                  {addrSaving ? <ActivityIndicator color="#fff" /> : <Text style={profStyles.saveBtnTxt}>{t('profile.save')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* All Orders Full Page Modal */}
      <Modal visible={allOrdersVisible} animationType="none">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setAllOrdersVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.allOrders')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:32 }} showsVerticalScrollIndicator={false}>
            {orders.map((order) => {
              const status = getOrderStatus(order);
              return (
              <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => { setAllOrdersVisible(false); setTimeout(() => setDetailOrder(order), 300); }}
                style={profStyles.orderCard}>
                <View style={profStyles.orderRow}>
                  <View style={profStyles.orderIcon}>
                    <Ionicons name={status.icon} size={20} color={THEME.brand} />
                  </View>
                  <View style={profStyles.orderBody}>
                    <Text style={profStyles.orderTitle} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                    <View style={profStyles.orderStatusRow}>
                      <View style={[profStyles.orderDot, { backgroundColor: status.color }]} />
                      <Text style={[profStyles.orderStatusTxt, { color: status.color }]}>{status.label}</Text>
                    </View>
                    {(order.shops && order.shops.length > 0) ? (
                      <Text style={profStyles.orderShops} numberOfLines={1}>{order.shops.join(', ')}</Text>
                    ) : null}
                    <Text style={profStyles.orderDate}>{fmtDate(order.date)}</Text>
                  </View>
                  <View style={profStyles.orderSide}>
                    <View style={profStyles.modePill}>
                      <Text style={profStyles.modePillTxt}>
                        {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                      </Text>
                    </View>
                    <Text style={profStyles.orderPrice}>{fmtPrice(order.total||0)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={THEME.faint} style={{marginTop:4}} />
                  </View>
                </View>
              </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Order Detail Full Page Modal */}
      <Modal visible={!!detailOrder} animationType="none">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailOrder(null)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>
              {t('profile.orderNumber')} #{detailOrder ? String(detailOrder.id).slice(-4) : ''}
            </Text>
            {detailOrder && (
              <View style={profStyles.modalHeaderPill}>
                <Text style={profStyles.modalHeaderPillTxt}>
                  {detailOrder.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                </Text>
              </View>
            )}
          </View>
          {detailOrder && (
            <ScrollView style={{flex:1}} contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:20 }} showsVerticalScrollIndicator={false}>
              {/* Infos commande */}
              <View style={[profStyles.modalCard, { marginBottom: 12 }]}>
                <View style={profStyles.detailInfoRow}>
                  <Ionicons name="calendar-outline" size={16} color={THEME.brand} />
                  <Text style={profStyles.detailInfoLabel}>{t('profile.orderedOn')}</Text>
                  <Text style={profStyles.detailInfoValue}>{fmtDate(detailOrder.date)}</Text>
                </View>
                {detailOrder.slot ? (
                  <View style={profStyles.detailInfoRow}>
                    <Ionicons name="time-outline" size={16} color={THEME.brand} />
                    <Text style={profStyles.detailInfoLabel}>{detailOrder.mode === 'collect' ? t('cart.collect') : t('cart.delivery')}</Text>
                    <Text style={profStyles.detailInfoValue}>
                      {detailOrder.deliveryDate ? detailOrder.deliveryDate + ', ' : ''}{detailOrder.slot}
                    </Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'delivery' && detailOrder.address ? (
                  <View style={profStyles.detailInfoRow}>
                    <Ionicons name="home-outline" size={16} color={THEME.brand} />
                    <Text style={profStyles.detailInfoLabel}>{t('profile.address')}</Text>
                    <Text style={[profStyles.detailInfoValue, { flex:1 }]} numberOfLines={2}>{detailOrder.address}</Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'collect' ? (
                  <View style={profStyles.detailInfoRow}>
                    <Ionicons name="storefront-outline" size={16} color={THEME.brand} />
                    <Text style={profStyles.detailInfoLabel}>{t('profile.storePickup')}</Text>
                  </View>
                ) : null}
                {/* Driver info (from Livraison-app) */}
                {detailOrder.mode === 'delivery' && (detailOrder.driverName || deliveryStatuses[detailOrder.id]?.driver_name) ? (
                  <View style={profStyles.driverChip}>
                    <View style={profStyles.driverChipIcon}>
                      <Ionicons name="bicycle" size={18} color="#fff" />
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={profStyles.driverChipName}>
                        {deliveryStatuses[detailOrder.id]?.driver_name || detailOrder.driverName}
                      </Text>
                      <Text style={profStyles.driverChipSub}>
                        {deliveryStatuses[detailOrder.id]?.estimated_arrival || detailOrder.estimatedArrival || t('orderStatus.onTheWay')}
                      </Text>
                    </View>
                    {(deliveryStatuses[detailOrder.id]?.driver_phone || detailOrder.driverPhone) ? (
                      <TouchableOpacity style={profStyles.driverChipCall}>
                        <Ionicons name="call" size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
                {/* Code livreur : à communiquer au livreur pour valider la remise */}
                {(() => {
                  const code = deliveryStatuses[detailOrder.id]?.delivery_code || detailOrder.deliveryCode;
                  const st = deliveryStatuses[detailOrder.id]?.status || detailOrder.deliveryStatus;
                  if (detailOrder.mode !== 'delivery' || !code
                      || st === DELIVERY_STATUS.DELIVERED || st === DELIVERY_STATUS.CANCELLED) return null;
                  return (
                    <View style={{ marginTop: 10, marginBottom: 4, padding: 12, borderRadius: 12,
                      backgroundColor: '#EAF9F3', borderWidth: 1, borderColor: '#62D4AC', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#0B7A5B', fontWeight: '600' }}>
                        {t('orderStatus.deliveryCode', 'Code à donner au livreur')}
                      </Text>
                      <Text style={{ fontSize: 26, letterSpacing: 6, fontWeight: '800', color: '#0B7A5B', marginTop: 4 }}>
                        {code}
                      </Text>
                    </View>
                  );
                })()}
                {/* Coûts */}
                <View style={profStyles.costBlock}>
                  <View style={profStyles.costRow}>
                    <Text style={profStyles.costLabel}>{t('profile.subtotal')}</Text>
                    <Text style={profStyles.costValue}>{fmtPrice(detailOrder.subtotal != null ? detailOrder.subtotal : (detailOrder.total||0) - (detailOrder.deliveryFee||0))}</Text>
                  </View>
                  <View style={profStyles.costRow}>
                    <Text style={profStyles.costLabel}>{detailOrder.mode === 'delivery' ? t('profile.deliveryFee') : t('profile.collectFee')}</Text>
                    <Text style={(detailOrder.deliveryFee||0) === 0 ? profStyles.costValueFree : profStyles.costValue}>
                      {(detailOrder.deliveryFee||0) === 0 ? t('cart.free') : fmtPrice(detailOrder.deliveryFee||0)}
                    </Text>
                  </View>
                  <View style={profStyles.grandRow}>
                    <Text style={profStyles.grandLabel}>{t('cart.total')}</Text>
                    <Text style={profStyles.grandValue}>{fmtPrice(detailOrder.total||0)}</Text>
                  </View>
                </View>
              </View>

              {/* Statut actuel */}
              {(() => {
                const status = getOrderStatus(detailOrder);
                return (
                  <View style={profStyles.statusCard}>
                    <View style={[profStyles.statusCardIcon, { backgroundColor: status.color + '20' }]}>
                      <Ionicons name={status.icon} size={20} color={status.color} />
                    </View>
                    <View style={{flex:1}}>
                      <Text style={profStyles.statusCardLabel}>{t('profile.orderTracking')}</Text>
                      <Text style={[profStyles.statusCardValue, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Produits par shop */}
              <View style={[profStyles.sectionHeadRow, { marginTop: 6 }]}>
                <Text style={profStyles.sectionTitle}>{t('profile.productDetails')}</Text>
              </View>
              {(() => {
                const byShop = {};
                (detailOrder.items||[]).forEach(it => {
                  const s = it.shop || '__other__';
                  if (!byShop[s]) byShop[s] = [];
                  byShop[s].push(it);
                });
                return Object.entries(byShop).map(([shop, items]) => (
                  <View key={shop} style={profStyles.shopBlock}>
                    <View style={profStyles.shopBlockHead}>
                      <View style={profStyles.shopBlockIcon}>
                        <Ionicons name="storefront-outline" size={17} color={THEME.brand} />
                      </View>
                      <Text style={profStyles.shopBlockName}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                    </View>
                    {items.map((it, idx) => (
                      <View key={idx} style={[profStyles.detailItemRow, idx > 0 && profStyles.detailItemDivider]}>
                        <ProductThumb name={it.name||it.title} size={36} />
                        <View style={profStyles.detailItemBody}>
                          <Text style={profStyles.detailItemName} numberOfLines={1}>{it.name||it.title}</Text>
                          <Text style={profStyles.detailItemMeta}>{t('cart.qty')}: {it.qty||1} × {fmtPrice((it.price||0))}</Text>
                        </View>
                        <Text style={profStyles.detailItemPrice}>
                          {fmtPrice((it.price||0)*(it.qty||1))}
                        </Text>
                      </View>
                    ))}
                  </View>
                ));
              })()}

            </ScrollView>
          )}

          {/* Bouton recommander fixe en bas */}
          {detailOrder && (
            <View style={profStyles.detailFooter}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  const items = (detailOrder.items||[]).map((it, i) => ({
                    id: i,
                    name: it.name || it.title,
                    detail: it.detail || '',
                    unitPrice: it.unitPrice || '',
                    qty: it.qty || 1,
                    price: it.price || 0,
                    shop: it.shop || '',
                    selected: true,
                  }));
                  setReorderItems(items);
                  setReorderVisible(true);
                }}
                style={profStyles.primaryBtn}
              >
                <Ionicons name="cart-outline" size={20} color="#fff" />
                <Text style={profStyles.primaryBtnTxt}>{t('profile.reorder') || 'Recommander'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </Modal>

      {/* Modal sélection recommander — AU MÊME NIVEAU */}
      <Modal visible={reorderVisible} animationType="slide" transparent={true}>
        <View style={profStyles.sheetBackdrop}>
          <View style={profStyles.sheet}>
            <View style={profStyles.sheetGrabber} />
            <View style={profStyles.sheetHeader}>
              <Text style={profStyles.sheetTitle}>{t('profile.reorder') || 'Recommander'}</Text>
              <View style={{flexDirection:'row', alignItems:'center'}}>
                <TouchableOpacity onPress={() => {
                  const allSelected = reorderItems.every(it => it.selected);
                  setReorderItems(prev => prev.map(it => ({...it, selected: !allSelected})));
                }} style={profStyles.selectAllPill}>
                  <Text style={profStyles.selectAllTxt}>{reorderItems.every(it => it.selected) ? t('listScreen.deselectAll') : t('listScreen.selectAll')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setReorderVisible(false)} style={profStyles.closeBtn}>
                  <Ionicons name="close" size={18} color={THEME.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={reorderItems}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{paddingHorizontal:20, paddingTop:4, paddingBottom:12}}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setReorderItems(prev => prev.map(it => it.id === item.id ? {...it, selected: !it.selected} : it))}
                  style={[profStyles.reorderRow, item.selected && profStyles.reorderRowOn]}
                >
                  <Square value={item.selected} onPress={() => setReorderItems(prev => prev.map(it => it.id === item.id ? {...it, selected: !it.selected} : it))} />
                  <View style={{width:10}} />
                  <ProductThumb name={item.name} size={40} />
                  <View style={profStyles.reorderBody}>
                    <Text style={profStyles.reorderName}>{item.name}</Text>
                    {item.shop ? <Text style={profStyles.reorderShop}>{item.shop}</Text> : null}
                  </View>
                  <View style={profStyles.reorderSide}>
                    <Text style={profStyles.reorderQty}>x{item.qty||1}</Text>
                    <Text style={profStyles.reorderPrice}>{fmtPrice((item.price||0)*(item.qty||1))}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />

            <View style={profStyles.reorderTotalRow}>
              <Text style={profStyles.reorderTotalLabel}>{t('cart.total') + ' ' + t('cart.totalPrice', {defaultValue: 'prix'})}</Text>
              <Text style={profStyles.reorderTotalValue}>{fmtPrice(reorderItems.filter(it => it.selected).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||1)), 0))}</Text>
            </View>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={async () => {
                  const selected = reorderItems.filter(it => it.selected).map(it => ({
                    name: it.name, detail: it.detail, unitPrice: it.unitPrice,
                    qty: it.qty, price: it.price, shop: it.shop
                  }));
                  if (!selected.length) return;
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify(selected));
                  DeviceEventEmitter.emit('CART_UPDATED');
                  // Close everything at once and navigate
                  setReorderVisible(false);
                  setDetailOrder(null);
                  setAllOrdersVisible(false);
                  navigation.navigate('cart');
                }}
                disabled={!reorderItems.some(it => it.selected)}
                style={[profStyles.primaryBtn, !reorderItems.some(it => it.selected) && profStyles.primaryBtnDisabled]}
              >
                <Ionicons name="cart-outline" size={20} color="#fff" />
                <Text style={profStyles.primaryBtnTxt}>{t('cart.addToCart') || 'Ajouter au panier'} ({reorderItems.filter(it => it.selected).reduce((s, it) => s + (it.qty||1), 0)})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReorderVisible(false)} style={[profStyles.cancelBtn, { marginTop: 10 }]}>
                <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
