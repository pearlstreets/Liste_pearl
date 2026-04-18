import { autocorrectName } from "./utils/spellcheck";
import { isOptimized, setOptimized, getMode } from "./utils/distributionMode";
import React, { useEffect, useMemo, useState } from "react";

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
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Keyboard, FlatList, Modal, Pressable, Alert, ActivityIndicator, Image, Animated, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DefaultTheme, useNavigation, useFocusEffect } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';

import { openCamera } from "./utils/openCamera";
const BRAND = "#00C29B";

// Product image mapping — returns emoji + background color for product visuals
const PRODUCT_IMAGES = {
  // Boulangerie / Pain
  pain: { emoji: "🥖", bg: "#FEF3C7" },
  baguette: { emoji: "🥖", bg: "#FEF3C7" },
  brioche: { emoji: "🍞", bg: "#FEF3C7" },
  croissant: { emoji: "🥐", bg: "#FEF3C7" },
  "pain de mie": { emoji: "🍞", bg: "#FEF3C7" },
  tartine: { emoji: "🍞", bg: "#FEF3C7" },
  "pain complet": { emoji: "🍞", bg: "#FEF3C7" },
  farine: { emoji: "🌾", bg: "#FEF3C7" },
  levure: { emoji: "🌾", bg: "#FEF3C7" },
  cereale: { emoji: "🌾", bg: "#FEF3C7" },
  muesli: { emoji: "🌾", bg: "#FEF3C7" },
  // Fruits
  pomme: { emoji: "🍎", bg: "#FEE2E2" },
  banane: { emoji: "🍌", bg: "#FEF9C3" },
  orange: { emoji: "🍊", bg: "#FFEDD5" },
  citron: { emoji: "🍋", bg: "#FEF9C3" },
  raisin: { emoji: "🍇", bg: "#E9D5FF" },
  fraise: { emoji: "🍓", bg: "#FEE2E2" },
  cerise: { emoji: "🍒", bg: "#FEE2E2" },
  pasteque: { emoji: "🍉", bg: "#DCFCE7" },
  melon: { emoji: "🍈", bg: "#DCFCE7" },
  ananas: { emoji: "🍍", bg: "#FEF9C3" },
  mangue: { emoji: "🥭", bg: "#FFEDD5" },
  poire: { emoji: "🍐", bg: "#DCFCE7" },
  peche: { emoji: "🍑", bg: "#FFEDD5" },
  abricot: { emoji: "🍑", bg: "#FFEDD5" },
  kiwi: { emoji: "🥝", bg: "#DCFCE7" },
  coco: { emoji: "🥥", bg: "#F3F4F6" },
  fruit: { emoji: "🍎", bg: "#FEE2E2" },
  clementine: { emoji: "🍊", bg: "#FFEDD5" },
  mandarine: { emoji: "🍊", bg: "#FFEDD5" },
  pamplemousse: { emoji: "🍊", bg: "#FFEDD5" },
  litchi: { emoji: "🍇", bg: "#E9D5FF" },
  myrtille: { emoji: "🫐", bg: "#DBEAFE" },
  framboise: { emoji: "🍓", bg: "#FEE2E2" },
  groseille: { emoji: "🍓", bg: "#FEE2E2" },
  figue: { emoji: "🍇", bg: "#E9D5FF" },
  datte: { emoji: "🍇", bg: "#E9D5FF" },
  prune: { emoji: "🍑", bg: "#FFEDD5" },
  grenade: { emoji: "🍎", bg: "#FEE2E2" },
  // Légumes
  tomate: { emoji: "🍅", bg: "#FEE2E2" },
  carotte: { emoji: "🥕", bg: "#FFEDD5" },
  salade: { emoji: "🥬", bg: "#DCFCE7" },
  laitue: { emoji: "🥬", bg: "#DCFCE7" },
  "pomme de terre": { emoji: "🥔", bg: "#FEF3C7" },
  patate: { emoji: "🥔", bg: "#FEF3C7" },
  avocat: { emoji: "🥑", bg: "#DCFCE7" },
  champignon: { emoji: "🍄", bg: "#FEF3C7" },
  mais: { emoji: "🌽", bg: "#FEF9C3" },
  oignon: { emoji: "🧅", bg: "#FEF3C7" },
  ail: { emoji: "🧄", bg: "#F3F4F6" },
  courgette: { emoji: "🥒", bg: "#DCFCE7" },
  concombre: { emoji: "🥒", bg: "#DCFCE7" },
  poivron: { emoji: "🫑", bg: "#DCFCE7" },
  brocoli: { emoji: "🥦", bg: "#DCFCE7" },
  chou: { emoji: "🥬", bg: "#DCFCE7" },
  epinard: { emoji: "🥬", bg: "#DCFCE7" },
  haricot: { emoji: "🫘", bg: "#DCFCE7" },
  "haricot vert": { emoji: "🫘", bg: "#DCFCE7" },
  lentille: { emoji: "🫘", bg: "#FEF3C7" },
  "pois chiche": { emoji: "🫘", bg: "#FEF3C7" },
  "petit pois": { emoji: "🫛", bg: "#DCFCE7" },
  betterave: { emoji: "🥕", bg: "#FEE2E2" },
  radis: { emoji: "🥕", bg: "#FEE2E2" },
  celeri: { emoji: "🥬", bg: "#DCFCE7" },
  navet: { emoji: "🥔", bg: "#F3F4F6" },
  poireau: { emoji: "🥬", bg: "#DCFCE7" },
  fenouil: { emoji: "🥬", bg: "#DCFCE7" },
  artichaut: { emoji: "🥬", bg: "#DCFCE7" },
  asperge: { emoji: "🥬", bg: "#DCFCE7" },
  aubergine: { emoji: "🍆", bg: "#E9D5FF" },
  legume: { emoji: "🥬", bg: "#DCFCE7" },
  persil: { emoji: "🌿", bg: "#DCFCE7" },
  basilic: { emoji: "🌿", bg: "#DCFCE7" },
  menthe: { emoji: "🌿", bg: "#DCFCE7" },
  coriandre: { emoji: "🌿", bg: "#DCFCE7" },
  herbe: { emoji: "🌿", bg: "#DCFCE7" },
  gingembre: { emoji: "🫚", bg: "#FEF3C7" },
  olive: { emoji: "🫒", bg: "#DCFCE7" },
  // Viandes & Poissons
  poulet: { emoji: "🍗", bg: "#FFEDD5" },
  viande: { emoji: "🥩", bg: "#FEE2E2" },
  steak: { emoji: "🥩", bg: "#FEE2E2" },
  boeuf: { emoji: "🥩", bg: "#FEE2E2" },
  veau: { emoji: "🥩", bg: "#FEE2E2" },
  agneau: { emoji: "🥩", bg: "#FEE2E2" },
  porc: { emoji: "🥩", bg: "#FEE2E2" },
  dinde: { emoji: "🍗", bg: "#FFEDD5" },
  canard: { emoji: "🍗", bg: "#FFEDD5" },
  lapin: { emoji: "🍗", bg: "#FFEDD5" },
  jambon: { emoji: "🥓", bg: "#FEE2E2" },
  saucisse: { emoji: "🌭", bg: "#FEE2E2" },
  saucisson: { emoji: "🌭", bg: "#FEE2E2" },
  merguez: { emoji: "🌭", bg: "#FEE2E2" },
  lardon: { emoji: "🥓", bg: "#FEE2E2" },
  bacon: { emoji: "🥓", bg: "#FEE2E2" },
  charcuterie: { emoji: "🥓", bg: "#FEE2E2" },
  "foie gras": { emoji: "🍖", bg: "#FEE2E2" },
  poisson: { emoji: "🐟", bg: "#DBEAFE" },
  saumon: { emoji: "🐟", bg: "#DBEAFE" },
  thon: { emoji: "🐟", bg: "#DBEAFE" },
  cabillaud: { emoji: "🐟", bg: "#DBEAFE" },
  sardine: { emoji: "🐟", bg: "#DBEAFE" },
  truite: { emoji: "🐟", bg: "#DBEAFE" },
  crevette: { emoji: "🦐", bg: "#FEE2E2" },
  huitre: { emoji: "🦪", bg: "#E0E7FF" },
  moule: { emoji: "🦪", bg: "#E0E7FF" },
  "fruit de mer": { emoji: "🦐", bg: "#DBEAFE" },
  crabe: { emoji: "🦀", bg: "#FEE2E2" },
  homard: { emoji: "🦞", bg: "#FEE2E2" },
  // Produits laitiers
  yaourt: { emoji: "🥛", bg: "#EFF6FF" },
  lait: { emoji: "🥛", bg: "#EFF6FF" },
  fromage: { emoji: "🧀", bg: "#FEF9C3" },
  beurre: { emoji: "🧈", bg: "#FEF9C3" },
  creme: { emoji: "🥛", bg: "#EFF6FF" },
  oeuf: { emoji: "🥚", bg: "#FEF3C7" },
  compote: { emoji: "🍎", bg: "#FEE2E2" },
  mozzarella: { emoji: "🧀", bg: "#FEF9C3" },
  camembert: { emoji: "🧀", bg: "#FEF9C3" },
  gruyere: { emoji: "🧀", bg: "#FEF9C3" },
  emmental: { emoji: "🧀", bg: "#FEF9C3" },
  parmesan: { emoji: "🧀", bg: "#FEF9C3" },
  chevre: { emoji: "🧀", bg: "#FEF9C3" },
  roquefort: { emoji: "🧀", bg: "#FEF9C3" },
  // Féculents & Pâtes
  riz: { emoji: "🍚", bg: "#F3F4F6" },
  pate: { emoji: "🍝", bg: "#FEF3C7" },
  pasta: { emoji: "🍝", bg: "#FEF3C7" },
  spaghetti: { emoji: "🍝", bg: "#FEF3C7" },
  nouille: { emoji: "🍝", bg: "#FEF3C7" },
  couscous: { emoji: "🍚", bg: "#FEF3C7" },
  semoule: { emoji: "🍚", bg: "#FEF3C7" },
  quinoa: { emoji: "🍚", bg: "#FEF3C7" },
  boulgour: { emoji: "🍚", bg: "#FEF3C7" },
  // Boissons
  eau: { emoji: "💧", bg: "#DBEAFE" },
  jus: { emoji: "🧃", bg: "#FFEDD5" },
  cafe: { emoji: "☕", bg: "#FEF3C7" },
  the: { emoji: "🍵", bg: "#DCFCE7" },
  tisane: { emoji: "🍵", bg: "#DCFCE7" },
  soda: { emoji: "🥤", bg: "#DBEAFE" },
  coca: { emoji: "🥤", bg: "#FEE2E2" },
  limonade: { emoji: "🥤", bg: "#FEF9C3" },
  biere: { emoji: "🍺", bg: "#FEF9C3" },
  vin: { emoji: "🍷", bg: "#E9D5FF" },
  champagne: { emoji: "🍾", bg: "#FEF9C3" },
  whisky: { emoji: "🥃", bg: "#FEF3C7" },
  sirop: { emoji: "🧃", bg: "#FFEDD5" },
  boisson: { emoji: "🥤", bg: "#DBEAFE" },
  smoothie: { emoji: "🥤", bg: "#DCFCE7" },
  lemonade: { emoji: "🥤", bg: "#FEF9C3" },
  // Sucré / Snacks
  chocolat: { emoji: "🍫", bg: "#FEF3C7" },
  biscuit: { emoji: "🍪", bg: "#FEF3C7" },
  gateau: { emoji: "🎂", bg: "#FEE2E2" },
  tarte: { emoji: "🥧", bg: "#FEE2E2" },
  glace: { emoji: "🍦", bg: "#DBEAFE" },
  bonbon: { emoji: "🍬", bg: "#FEF9C3" },
  confiture: { emoji: "🍯", bg: "#FEE2E2" },
  miel: { emoji: "🍯", bg: "#FEF3C7" },
  sucre: { emoji: "🍬", bg: "#FEF9C3" },
  "pop corn": { emoji: "🍿", bg: "#FEF9C3" },
  popcorn: { emoji: "🍿", bg: "#FEF9C3" },
  chips: { emoji: "🍿", bg: "#FEF9C3" },
  cookie: { emoji: "🍪", bg: "#FEF3C7" },
  nutella: { emoji: "🍫", bg: "#FEF3C7" },
  cacao: { emoji: "🍫", bg: "#FEF3C7" },
  dessert: { emoji: "🍰", bg: "#FEE2E2" },
  crepe: { emoji: "🥞", bg: "#FEF3C7" },
  gaufre: { emoji: "🧇", bg: "#FEF3C7" },
  pancake: { emoji: "🥞", bg: "#FEF3C7" },
  macaron: { emoji: "🍪", bg: "#E9D5FF" },
  // Plats préparés
  pizza: { emoji: "🍕", bg: "#FEE2E2" },
  burger: { emoji: "🍔", bg: "#FEF3C7" },
  hamburger: { emoji: "🍔", bg: "#FEF3C7" },
  sandwich: { emoji: "🥪", bg: "#FEF3C7" },
  wrap: { emoji: "🌯", bg: "#DCFCE7" },
  kebab: { emoji: "🥙", bg: "#FEF3C7" },
  tacos: { emoji: "🌮", bg: "#FEF9C3" },
  sushi: { emoji: "🍣", bg: "#FEE2E2" },
  soupe: { emoji: "🥣", bg: "#FFEDD5" },
  salade: { emoji: "🥗", bg: "#DCFCE7" },
  quiche: { emoji: "🥧", bg: "#FEF3C7" },
  gratin: { emoji: "🥘", bg: "#FEF3C7" },
  lasagne: { emoji: "🍝", bg: "#FEE2E2" },
  ravioli: { emoji: "🥟", bg: "#FEF3C7" },
  "plat prepare": { emoji: "🍱", bg: "#FFEDD5" },
  conserve: { emoji: "🥫", bg: "#FEE2E2" },
  surgelé: { emoji: "🧊", bg: "#DBEAFE" },
  // Condiments & Épices
  huile: { emoji: "🫒", bg: "#FEF9C3" },
  vinaigre: { emoji: "🫒", bg: "#FEF9C3" },
  sel: { emoji: "🧂", bg: "#F3F4F6" },
  poivre: { emoji: "🧂", bg: "#F3F4F6" },
  moutarde: { emoji: "🟡", bg: "#FEF9C3" },
  ketchup: { emoji: "🍅", bg: "#FEE2E2" },
  mayonnaise: { emoji: "🥚", bg: "#FEF9C3" },
  sauce: { emoji: "🥫", bg: "#FEE2E2" },
  epice: { emoji: "🌶️", bg: "#FEE2E2" },
  piment: { emoji: "🌶️", bg: "#FEE2E2" },
  curry: { emoji: "🌶️", bg: "#FEF9C3" },
  paprika: { emoji: "🌶️", bg: "#FEE2E2" },
  cumin: { emoji: "🌶️", bg: "#FEF3C7" },
  // Hygiène & Maison
  savon: { emoji: "🧴", bg: "#DBEAFE" },
  shampoing: { emoji: "🧴", bg: "#DBEAFE" },
  shampooing: { emoji: "🧴", bg: "#DBEAFE" },
  dentifrice: { emoji: "🪥", bg: "#DBEAFE" },
  lessive: { emoji: "🧺", bg: "#DBEAFE" },
  papier: { emoji: "🧻", bg: "#F3F4F6" },
  mouchoir: { emoji: "🧻", bg: "#F3F4F6" },
  serviette: { emoji: "🧻", bg: "#F3F4F6" },
  sac: { emoji: "🛍️", bg: "#F3F4F6" },
  eponge: { emoji: "🧽", bg: "#FEF9C3" },
  // Bébé & Animaux
  couche: { emoji: "🍼", bg: "#EFF6FF" },
  biberon: { emoji: "🍼", bg: "#EFF6FF" },
  croquette: { emoji: "🐾", bg: "#FEF3C7" },
  litiere: { emoji: "🐱", bg: "#F3F4F6" },
};
const DEFAULT_PRODUCT = { emoji: "🛒", bg: "#F3F4F6" };

// Category keywords for fallback matching when no exact match is found
const CATEGORY_FALLBACKS = [
  { keywords: ["bio", "organic", "nature"], img: { emoji: "🌱", bg: "#DCFCE7" } },
  { keywords: ["surgele", "congele", "frozen"], img: { emoji: "🧊", bg: "#DBEAFE" } },
  { keywords: ["conserve", "boite", "bocal"], img: { emoji: "🥫", bg: "#FEE2E2" } },
  { keywords: ["drink", "boisson", "soda", "jus"], img: { emoji: "🥤", bg: "#DBEAFE" } },
  { keywords: ["viande", "meat", "poulet", "boeuf", "porc"], img: { emoji: "🥩", bg: "#FEE2E2" } },
  { keywords: ["poisson", "fish", "mer"], img: { emoji: "🐟", bg: "#DBEAFE" } },
  { keywords: ["legume", "vegetable", "vert"], img: { emoji: "🥬", bg: "#DCFCE7" } },
  { keywords: ["fruit", "jus"], img: { emoji: "🍎", bg: "#FEE2E2" } },
  { keywords: ["lait", "creme", "yaourt", "fromage", "dairy"], img: { emoji: "🥛", bg: "#EFF6FF" } },
  { keywords: ["pain", "boulang", "patisserie"], img: { emoji: "🥖", bg: "#FEF3C7" } },
  { keywords: ["gâteau", "gateau", "dessert", "sucre"], img: { emoji: "🍰", bg: "#FEE2E2" } },
  { keywords: ["hygiene", "soin", "beaute", "douche", "bain"], img: { emoji: "🧴", bg: "#DBEAFE" } },
  { keywords: ["menag", "nettoy", "produit"], img: { emoji: "🧹", bg: "#DBEAFE" } },
];

function getProductImage(name) {
  const n = String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Try exact/substring match from PRODUCT_IMAGES
  for (const [key, val] of Object.entries(PRODUCT_IMAGES)) {
    const kn = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (n.includes(kn)) return val;
  }
  // Fallback: try category keywords
  for (const cat of CATEGORY_FALLBACKS) {
    for (const kw of cat.keywords) {
      const kwn = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (n.includes(kwn)) return cat.img;
    }
  }
  // Final fallback: pick an emoji based on first letter for visual variety
  const firstChar = n.charAt(0);
  const letterEmojis = {
    a:"🅰️",b:"🅱️",c:"©️",d:"🔶",e:"📧",f:"🎏",g:"🟢",h:"♓",i:"ℹ️",j:"🎷",
    k:"🪁",l:"🍋",m:"Ⓜ️",n:"🔷",o:"⭕",p:"🅿️",q:"🔲",r:"®️",s:"💲",t:"✝️",
    u:"⛎",v:"✅",w:"〰️",x:"❌",y:"💹",z:"💤"
  };
  if (letterEmojis[firstChar]) return { emoji: letterEmojis[firstChar], bg: "#F3F4F6" };
  return DEFAULT_PRODUCT;
}

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
const GUTTER = 24;
const CTRL = 20;
const GAP = 10;

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
    <Cmp onPress={onPress} style={[styles.radioOuter, style]}>
      {value ? <View style={styles.radioInner} /> : null}
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

function parseMulti(input){
  const str = (input || "").trim();
  if (!str) return [];
  const parts = str.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    let m, name = null, qty = 1;
    if (m = part.match(/^(\d+)\s+(.+)$/)) { name = m[2].trim(); qty = Math.max(1, parseInt(m[1], 10)); }
    else if (m = part.match(/^(.+?)\s*[xX]\s*(\d+)$/)) { name = m[1].trim(); qty = Math.max(1, parseInt(m[2], 10)); }
    else if (m = part.match(/^(.+?)\s*(\d+)\s*[xX]?$/)) { const n = m[1].trim(); const q = parseInt(m[2], 10); if (n) { name = n; qty = Math.max(1, q); } }
    else { name = part; qty = 1; }
    name = autocorrectName(name);
    out.push({ name, qty });
  }
  return out;
}

// Toast notification component
const Toast = ({ visible, message }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message]);
  if (!visible) return null;
  return (
    <Animated.View style={{
      position: 'absolute', top: 60, left: 40, right: 40, zIndex: 999,
      backgroundColor: '#111', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      opacity, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
    }}>
      <Ionicons name="checkmark-circle" size={20} color={BRAND} style={{ marginRight: 8 }} />
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{message}</Text>
    </Animated.View>
  );
};

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

  useEffect(() => { (async () => {
    try {
      const s = await AsyncStorage.getItem("SG_ITEMS");
      if (s) setItems(JSON.parse(s));
    } catch {}
  })(); }, []);
  useEffect(() => { AsyncStorage.setItem("SG_ITEMS", JSON.stringify(items)).catch(() => {}); }, [items]);

  const addFromInput = () => {
    const parsed = parseMulti(text);
    if (parsed.length === 0) return;
    setItems(prev => {
      const base = [...prev];
      for (const p of parsed) {
        const idx = base.findIndex(b => b.name.toLowerCase() === p.name.toLowerCase());
        if (idx >= 0) base[idx] = { ...base[idx], qty: (base[idx].qty || 1) + p.qty };
        else base.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), name: p.name, qty: p.qty, crossed: false, selected: true });
      }
      return base;
    });
    setText("");
    Keyboard.dismiss();
    const count = parsed.length;
    showToast(count === 1 ? `"${parsed[0].name}" ajouté` : `${count} articles ajoutés`);
  };

  const onMinus = id => setItems(items.map(it => it.id === id ? { ...it, qty: Math.max(1, (it.qty || 1) - 1) } : it));
  const onPlus  = id => setItems(items.map(it => it.id === id ? { ...it, qty: (it.qty || 1) + 1 } : it));
  const setQty  = (id, q) => setItems(items.map(it => it.id === id ? { ...it, qty: q } : it));
  const toggleSelected = id => setItems(items.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleCrossed  = id => setItems(items.map(it => it.id === id ? { ...it, crossed: !it.crossed } : it));
  const removeOne      = id => setItems(items.filter(it => it.id !== id));

  const toggleSelectAll = () => {
    const v = !selectAll; setSelectAll(v);
    setItems(items.map(it => ({ ...it, selected: v })));
  };
  const toggleStrikeAll = () => {
    const v = !strikeAll; setStrikeAll(v);
    setItems(items.map(it => ({ ...it, crossed: v })));
  };

  const visible = useMemo(() => hideCrossed ? items.filter(i => !i.crossed) : items, [items, hideCrossed]);

  const openEdit = (it) => { setEditId(it.id); setEditText(it.name); setEditVisible(true); };
  const closeEdit = () => { setEditVisible(false); setEditId(null); setEditText(""); };
  const saveEdit = () => {
    if (!editText.trim()) { closeEdit(); return; }
    setItems(prev => prev.map(it => it.id === editId ? { ...it, name: editText.trim() } : it));
    closeEdit();
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <Square value={!!item.selected} onPress={() => toggleSelected(item.id)} />

      <View style={styles.qtyInline}>
        <TouchableOpacity onPress={() => onMinus(item.id)} style={styles.qtyBtn}><Ionicons name="remove" size={16} /></TouchableOpacity>
        <QtyInput value={item.qty || 1} onCommit={(q) => setQty(item.id, q)} />
        <TouchableOpacity onPress={() => onPlus(item.id)} style={styles.qtyBtn}><Ionicons name="add" size={16} /></TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => openEdit(item)} style={{ flex:1 }}>
        <Text numberOfLines={1} style={[styles.itemLabel, item.crossed && styles.crossed]}>{item.name}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => removeOne(item.id)} style={styles.trashBtn}>
        <Ionicons name="trash-outline" size={18} color="#C33" />
      </TouchableOpacity>
      <Radio style={{ marginLeft: 12 }} value={!!item.crossed} onPress={() => toggleCrossed(item.id)} />
    </View>
  );

  const Header = (
    <View style={{ marginTop: 24 }}>
      <View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('tabs.myList')}</Text>
          <PillScan />
        </View>
      </View>

      <View style={styles.inputRow}>
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
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={addFromInput}
        />
        <TouchableOpacity onPress={addFromInput} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.dualRow}>
        <View style={styles.dualLeft}>
          <Square value={selectAll} onPress={toggleSelectAll} />
          <Text style={styles.dualLabel}>{t('listScreen.selectAll')}</Text>
        </View>
        <View style={styles.dualRight}>
          <Radio value={strikeAll} onPress={toggleStrikeAll} />
          <Text style={styles.dualLabel}>{t('listScreen.strikeAll')}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Toast key={toastKey} visible={toastKey > 0} message={toastMsg} />
      <FlatList
        data={visible}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        ListEmptyComponent={<View style={{ paddingHorizontal:GUTTER, marginTop:8 }}><Text style={styles.empty}>{t('listScreen.noItems')}</Text></View>}
        contentContainerStyle={{ paddingBottom: 160 }}
      />

      <View style={styles.bottomAreaWrap}>
        <View style={styles.switchCenterRow}>
          <Switch value={hideCrossed} onValueChange={setHideCrossed} style={{ transform:[{ scale:0.9 }] }} />
          <Text style={styles.switchLabel}>{t('listScreen.hideStriked')}</Text>
        </View>
        <TouchableOpacity style={styles.bottomBtn} onPress={async ()=>{
        try{
          const chosen = Array.isArray(items) ? items.filter(it=>it && (it.selected || it.checked)).map(it=>({
            name: String(it.name||it.title||'').trim(),
            qty: Number(it.qty||it.quantity||1)
          })) : [];
          await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify(chosen));
        }catch(e){}
        navigation.navigate("products");
      }}>
          <Text style={styles.bottomBtnText}>{t('listScreen.findExactProducts')}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('listScreen.editItem')}</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              style={styles.modalInput}
              autoFocus
              autoCorrect={true}
              spellCheck={true}
              autoCapitalize="sentences"
              keyboardType="default"
              textContentType="none"
            />
            <View style={styles.modalRow}>
              <Pressable onPress={closeEdit} style={styles.modalBtnCancel}>
                <Text style={styles.modalBtnText}>{t('listScreen.cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={styles.modalBtnSave}>
                <Text style={styles.modalBtnTextSave}>{t('listScreen.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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










const ProductsScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [__activeQuery, __setActiveQuery] = React.useState('');
  const [__selectedByQuery, __setSelectedByQuery] = React.useState({});
  const [popupSelectedItems, setPopupSelectedItems] = React.useState([]); // Items selected from popup
  const [checkedShops, setCheckedShops] = React.useState({}); // {shopIndex: true/false}
  const [dupModalVisible, setDupModalVisible] = React.useState(false);
  const [dupItems, setDupItems] = React.useState([]); // [{newItem, existingIndex, add: true/false}]
  const [dupMerged, setDupMerged] = React.useState([]);
  const [dupNewOnly, setDupNewOnly] = React.useState(0);
  const [successModalVisible, setSuccessModalVisible] = React.useState(false);
  const [successCount, setSuccessCount] = React.useState(0);

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


  const fmtEUR=(n)=>{const num=Number(n||0);return num.toFixed(2).replace('.', ',')+" €";};
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

  const loadSelected=async()=>{
    let selected=(await readJSON(KEY_SELECTED))||(await readJSON('SG_SELECTED_FOR_PRODUCTS'));
    if(!Array.isArray(selected)||!selected.length){
      const all=(await readJSON(KEY_ITEMS))||(await readJSON('SG_ITEMS'))||[];
      const safe=Array.isArray(all)?all:[];
      const checked=safe.filter(x=>x&&(x.selected||x.checked));
      const base=checked.length?checked:safe;
      selected=base.map(it=>({name:String(it?.name||it?.title||'').trim(),qty:Number(it?.qty||it?.quantity||1)||1}));
    }
    if(!Array.isArray(selected)||!selected.length){
      selected=[{name:"Pommes",qty:2},{name:"Yaourt nature",qty:6},{name:"Pain",qty:1}];
    }
    return selected;
  };

  const buildInventory=(items)=>{
    const shops=[
      {name:"Carrefour Market", distance:"0.9 km", time:"9 min",  fee:Number(seededRand(hashStr("fee_carrefour"),1.5,4.0).toFixed(2))},
      {name:"Intermarché Sud", distance:"0.8 km", time:"10 min", fee:Number(seededRand(hashStr("fee_inter"),1.5,4.0).toFixed(2))},
      {name:"Primeur Bio",     distance:"0.5 km", time:"7 min",  fee:Number(seededRand(hashStr("fee_bio"),1.5,4.0).toFixed(2))},
      {name:"Leclerc Meaux",   distance:"1.8 km", time:"8 min",  fee:Number(seededRand(hashStr("fee_leclerc"),1.5,4.0).toFixed(2))},
      {name:"Monoprix Centre", distance:"1.2 km", time:"6 min",  fee:Number(seededRand(hashStr("fee_mono"),1.5,4.0).toFixed(2))}
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

  const buildProposal=(items)=>{
    const inv=buildInventory(items);
    let assigned;
    if(strategy==='eco') assigned=assignEco(items,inv);
    else if(strategy==='fast') assigned=assignFast(items,inv,mode);
    else if(strategy==='single') assigned=assignSingle(items,inv);
    else assigned=assignBalanced(items,inv);

    const groups=assigned.map(g=>{
      const subtotal=g.products.reduce((a,p)=>a+Number(p.price||0)*Number(p.qty||1),0);
      const fee=mode==='delivery'?Number(g.shop.fee||0):0;
      return {name:g.shop.name,distance:g.shop.distance,time:g.shop.time,deliveryFee:fee,products:g.products,subtotal,grandTotal:subtotal+fee};
    });
    // Favoris en haut de liste
    groups.sort((a,b) => {
      const aFav = favShops.includes(a.name) ? 0 : 1;
      const bFav = favShops.includes(b.name) ? 0 : 1;
      return aFav - bFav;
    });
    const priceTotal=groups.reduce((a,g)=>a+g.grandTotal,0);
    const time=(mode==='collect')?groups.reduce((a,g)=>a+parseMin(g.time),0):Math.max(...groups.map(g=>parseMin(g.time)),0);
    return {groups,summary:{price:priceTotal,time,shops:groups.length}};
  };

  const refresh=React.useCallback(async()=>{
    setLoading(true);
    try{
      const items=await loadSelected();
      const {groups,summary}=buildProposal(items);
      setGroups(groups); setSummary(summary);
    }catch(e){ setGroups([]); setSummary({price:0,time:0,shops:0}); }
    finally{ setLoading(false); }
  },[mode,strategy]);

  React.useEffect(()=>{ refresh(); },[refresh]);
  useFocusEffect(React.useCallback(()=>{ refresh(); },[refresh]));

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
    <TouchableOpacity onPress={onPress} style={[{paddingVertical:6,paddingHorizontal:10,borderRadius:10,borderWidth:1,borderColor:"#ddd",marginHorizontal:4}, active && {backgroundColor:BRAND,borderColor:BRAND}]}>
      <Text style={[{fontWeight:"500"}, active && {color:"#fff"}]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{flex:1}}>
      {/* Mode */}
      <View style={{flexDirection:"row",marginHorizontal:16,marginTop:16}}>
        <TouchableOpacity onPress={()=>setMode("collect")} style={[{flex:1,borderWidth:1,borderColor:"#ccc",borderRadius:10,paddingVertical:8,marginRight:8,alignItems:"center"}, mode==="collect" && {backgroundColor:BRAND,borderColor:BRAND}]}>
          <Text style={[{color:"#555",fontWeight:"500"}, mode==="collect" && {color:"#fff",fontWeight:"600"}]}>{t('productsScreen.clickAndCollect')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setMode("delivery")} style={[{flex:1,borderWidth:1,borderColor:"#ccc",borderRadius:10,paddingVertical:8,marginLeft:8,alignItems:"center"}, mode==="delivery" && {backgroundColor:BRAND,borderColor:BRAND}]}>
          <Text style={[{color:"#555",fontWeight:"500"}, mode==="delivery" && {color:"#fff",fontWeight:"600"}]}>{t('productsScreen.delivery')}</Text>
        </TouchableOpacity>
      </View>

      {/* Stratégies */}
      <View style={{flexDirection:"row",justifyContent:"center",marginTop:8}}>
        <Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>setStrategy('balanced')} />
        <Chip label={t('productsScreen.strategies.totalPrice')}  active={strategy==='eco'} onPress={()=>setStrategy('eco')} />
        <Chip label={t('productsScreen.strategies.time')}  active={strategy==='fast'} onPress={()=>setStrategy('fast')} />
        <Chip label={t('productsScreen.strategies.singleShop')}  active={strategy==='single'} onPress={()=>setStrategy('single')} />
      </View>

      {/* Résumé */}
      <View style={{marginTop:10,marginHorizontal:16,padding:12,borderRadius:12,backgroundColor:"#F4F6F6"}}>
        <Text style={{fontWeight:"600"}}>{t('productsScreen.proposal')}{strategy==="balanced"?t('productsScreen.proposalTypes.balanced'):strategy==="eco"?t('productsScreen.proposalTypes.economic'):strategy==="fast"?t('productsScreen.proposalTypes.fast'):t('productsScreen.proposalTypes.singleShop')}</Text>
        <Text style={{marginTop:4}}>{t('productsScreen.total')}<Text style={{fontWeight:"700"}}>{fmtEUR(summary.price)}</Text>{t('productsScreen.time')}<Text style={{fontWeight:"700"}}>{summary.time}{t('productsScreen.minutes')}</Text>{t('productsScreen.shops')}<Text style={{fontWeight:"700"}}>{summary.shops}</Text></Text>
      </View>

     
      {loading ? (
        <ActivityIndicator style={{marginTop:24}} />
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
                const shopProducts = item?.products||[];
                const matchFn = (si) => shopProducts.some(p => {
                  const pName = String(p?.title||p?.name||'').toLowerCase().trim();
                  const siName = String(si?.name||'').toLowerCase().trim();
                  const pWords = pName.split(/\s+/).filter(w=>w.length>2);
                  const siWords = siName.split(/\s+/).filter(w=>w.length>2);
                  return pWords.some(pw=>siWords.some(sw=>sw.includes(pw)||pw.includes(sw)));
                });
                const hasProducts = popupSelectedItems.some(si => matchFn(si));
                if (!hasProducts) return; // Can't select shop without searched products
                const wasChecked = !!checkedShops[index];
                setCheckedShops(prev=>({...prev,[index]:!prev[index]}));
                setPopupSelectedItems(prev => prev.map(si => matchFn(si) ? {...si, checked: !wasChecked} : si));
              }}
              style={{backgroundColor:"#fff",padding:16,marginVertical:8,marginHorizontal:16,borderRadius:12,shadowColor:"#000",shadowOpacity:0.05,shadowRadius:5,
                borderWidth: checkedShops[index] ? 2 : 0, borderColor: checkedShops[index] ? BRAND : "transparent"
              }}>
              <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                <View style={{flexDirection:"row",alignItems:"center",flex:1}}>
                  {popupSelectedItems.length > 0 && <Square value={!!checkedShops[index]} onPress={()=>{
                    const shopProducts = item?.products||[];
                    const matchFn = (si) => shopProducts.some(p => {
                      const pName = String(p?.title||p?.name||'').toLowerCase().trim();
                      const siName = String(si?.name||'').toLowerCase().trim();
                      const pWords = pName.split(/\s+/).filter(w=>w.length>2);
                      const siWords = siName.split(/\s+/).filter(w=>w.length>2);
                      return pWords.some(pw=>siWords.some(sw=>sw.includes(pw)||pw.includes(sw)));
                    });
                    const hasProducts = popupSelectedItems.some(si => matchFn(si));
                    if (!hasProducts) return;
                    const wasChecked = !!checkedShops[index];
                    setCheckedShops(prev=>({...prev,[index]:!prev[index]}));
                    setPopupSelectedItems(prev => prev.map(si => matchFn(si) ? {...si, checked: !wasChecked} : si));
                  }} />}
                  <Text style={{fontWeight:"bold",fontSize:16,marginLeft:popupSelectedItems.length > 0 ? 10 : 0}}>{item?.name||'Boutique'}</Text>
                </View>
                <View style={{flexDirection:"row",alignItems:"center"}}>
                  <TouchableOpacity
                    onPress={()=>toggleShopFav({name:item?.name})}
                    style={{
                      borderWidth:1,
                      borderColor: isShopFav(item?.name) ? "#00C29B" : "#ddd",
                      backgroundColor: isShopFav(item?.name) ? "#E8FCF7" : "#fff",
                      borderRadius:10,
                      paddingVertical:6,
                      paddingHorizontal:10,
                      marginRight:8
                    }}
                  >
                    <Ionicons
                      name={isShopFav(item?.name) ? "heart" : "heart-outline"}
                      size={16}
                      color={isShopFav(item?.name) ? "#00C29B" : "#6B7280"}
                    />
                  </TouchableOpacity>
                  <Text style={{color:"#666"}}>{(item?.distance||"")+(item?.time?(" • "+item.time):"")}</Text>
                </View>
              </View>
              {mode==="delivery" ? <Text style={{color:"#666",marginTop:6}}>{t('productsScreen.deliveryFee')}{fmtEUR(item?.deliveryFee||0)}</Text> : null}

              {/* Display original products with quantity controls */}
              {(Array.isArray(item?.products)?item.__renderItems:[]).map((p,i)=>(
                <View key={i} style={{marginTop:12}}>
                  <Text style={{fontSize:15,fontWeight:"600",color:"#111",marginBottom:8}}>{String(p?.title||'')}</Text>
                  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
                    <View style={{flexDirection:"row",alignItems:"center",flex:1,marginRight:8}}>
                      <TouchableOpacity onPress={()=>setQty(index,i,-1)} style={{borderWidth:1,borderColor:"#ddd",borderRadius:10,paddingVertical:6,paddingHorizontal:10,marginRight:6}}>
                        <Text style={{fontSize:16}}>-</Text>
                      </TouchableOpacity>
                      <View style={{borderWidth:1,borderColor:"#eee",borderRadius:10,paddingVertical:6,paddingHorizontal:12,marginRight:6}}>
                        <Text style={{fontWeight:"600"}}>{Number(p?.qty||1)}</Text>
                      </View>
                      <TouchableOpacity onPress={()=>setQty(index,i,1)} style={{borderWidth:1,borderColor:"#ddd",borderRadius:10,paddingVertical:6,paddingHorizontal:10,marginRight:10}}>
                        <Text style={{fontSize:16}}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{flexDirection:"row",alignItems:"center"}}>
                      <TouchableOpacity style={{backgroundColor:BRAND,paddingHorizontal:10,paddingVertical:6,borderRadius:6}} onPress={()=>{ __setActiveQuery(String(p?.title||p?.name||''));  __setInitialQuery(String(p?.title||p?.name||"")); __setActiveShopName(String(item?.name||'')); __setActiveShopIndex(index); __setSearchVisible(true); }}><Text style={{color:"#fff",fontWeight:"600"}}>{t('productsScreen.search')}</Text></TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Show matching selected items below each product */}
                  {popupSelectedItems
                    .filter(selected => {
                      const productName = String(p?.title || p?.name || '').toLowerCase().trim();
                      const selectedName = String(selected?.name || '').toLowerCase().trim();
                      if (!productName || !selectedName) return false;
                      // Smart matching: check if words overlap significantly
                      const productWords = productName.split(/\s+/).filter(w => w.length > 2);
                      const selectedWords = selectedName.split(/\s+/).filter(w => w.length > 2);
                      return productWords.some(pw => selectedWords.some(sw => sw.includes(pw) || pw.includes(sw)));
                    })
                    .map(selectedItem => (
                      <View key={selectedItem.id} style={{marginTop:8,padding:12,backgroundColor:"#F9FAFB",borderRadius:10}}>
                        <View style={{flexDirection:"row",alignItems:"center"}}>
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
                          <ProductThumb name={selectedItem.name} size={40} />
                          <View style={{flex:1,marginLeft:10}}>
                            <Text style={{fontSize:16,fontWeight:"700",color:"#111"}}>{selectedItem.name}</Text>
                            <Text style={{fontSize:12,color:"#6B7280",marginTop:2}}>
                              {selectedItem.detail}
                            </Text>
                            <View style={{flexDirection:"row",alignItems:"baseline",marginTop:4}}>
                              <Text style={{fontSize:16,fontWeight:"800",color:"#111"}}>{selectedItem.price.toFixed(2).replace('.', ',')} €</Text>
                              {selectedItem.unitPrice && <Text style={{fontSize:11,color:"#9CA3AF",marginLeft:6}}>{selectedItem.unitPrice}</Text>}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              setPopupSelectedItems(prev => prev.filter(item => item.id !== selectedItem.id));
                            }}
                            style={{width:36,height:36,borderRadius:999,backgroundColor:"#EF4444",alignItems:"center",justifyContent:"center"}}
                          >
                            <Text style={{color:"#fff",fontSize:18,fontWeight:"900"}}>×</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </View>
              ))}

              <View style={{marginTop:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                <Text style={{fontWeight:"600"}}>{t('productsScreen.productsTotal')}</Text>
                <Text style={{fontWeight:"700"}}>{fmtEUR(item?.subtotal||0)}</Text>
              </View>
              {mode==="delivery" ? (
                <View style={{marginTop:6,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                  <Text style={{color:"#444"}}>{t('productsScreen.totalWithDelivery')}</Text>
                  <Text style={{fontWeight:"700"}}>{fmtEUR(item?.grandTotal||0)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{textAlign:"center",marginTop:32,color:"#666"}}>{t('productsScreen.noItems')}</Text>}
          contentContainerStyle={{paddingBottom: 100}}
        />
      )}

      {/* Bouton Commander les magasins sélectionnés */}
      {Object.values(checkedShops).some(v=>v) && (
        <View style={{position:"absolute",bottom:10,left:16,right:16}}>
          <TouchableOpacity
            onPress={async ()=>{
              try {
                const cartItems = [];
                // Ajouter les produits cochés dont le shop est coché
                popupSelectedItems.forEach(si => {
                  if (si.checked === false) return;
                  const shopIdx = si.shopIndex;
                  if (shopIdx === null || shopIdx === undefined || !checkedShops[shopIdx]) return;
                  cartItems.push({
                    name: si.name,
                    detail: si.detail||si.subtitle||'',
                    unitPrice: si.unitPrice||si.pricePerKg||'',
                    qty: si.qty||1,
                    price: si.price||0,
                    shop: si.shop
                  });
                });
                // Merge with existing cart - ask for duplicates
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
                  if (existingIndex >= 0) {
                    duplicates.push({ newItem, existingIndex });
                  } else {
                    newOnly.push(newItem);
                  }
                });
                // Add non-duplicates immediately
                newOnly.forEach(item => merged.push(item));

                if (duplicates.length > 0) {
                  // Open custom modal with per-product toggle
                  setDupItems(duplicates.map(d => ({ ...d, add: false })));
                  setDupMerged(merged);
                  setDupNewOnly(newOnly.length);
                  setDupModalVisible(true);
                } else {
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify(merged));
                  setCheckedShops({});
                  setPopupSelectedItems([]);
                  setSuccessCount(cartItems.length);
                  setSuccessModalVisible(true);
                }
              } catch(e){}
            }}
            style={{
              height:52,borderRadius:14,backgroundColor:BRAND,
              flexDirection:"row",alignItems:"center",justifyContent:"center",
              shadowColor:"#000",shadowOpacity:0.15,shadowRadius:8,elevation:5
            }}
          >
            <Ionicons name="cart" size={20} color="#fff" style={{marginRight:8}} />
            <Text style={{color:"#fff",fontSize:16,fontWeight:"700"}}>
              Ajouter au panier ({Object.values(checkedShops).filter(v=>v).length} magasin{Object.values(checkedShops).filter(v=>v).length>1?'s':''})
            </Text>
          </TouchableOpacity>
        </View>
      )}

          <SearchPopup
            visible={__searchVisible}
            initialQuery={__initialQuery}
            shopName={__activeShopName}
            onClose={()=>__setSearchVisible(false)} 
            onSelect={(it)=>{
              try{
                __setSelectedByQuery(prev=>({ ...(prev||{}), [__activeQuery]: it }));
                // Add the selected item to the popup selected items list
                setPopupSelectedItems(prev => {
                  const exists = prev.find(item => item.id === it.id);
                  if (!exists) {
                    return [...prev, { ...it, qty: 1, checked: true, shop: __activeShopName, shopIndex: __activeShopIndex }];
                  }
                  return prev;
                });
                // Auto-check the shop when a product is selected
                if (__activeShopIndex !== null) {
                  setCheckedShops(prev => ({ ...prev, [__activeShopIndex]: true }));
                }
              }catch(e){}
              __setSearchVisible(false);
            }} 
          />

      {/* Modal succès ajout panier */}
      <Modal visible={successModalVisible} animationType="fade" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center'}}>
          <View style={{backgroundColor:'#fff', borderRadius:20, padding:30, marginHorizontal:30, alignItems:'center', width:'85%'}}>
            <View style={{width:70, height:70, borderRadius:35, backgroundColor:'#F0FDF4', alignItems:'center', justifyContent:'center', marginBottom:16}}>
              <Ionicons name="checkmark-circle" size={44} color={BRAND} />
            </View>
            <Text style={{fontSize:20, fontWeight:'800', color:'#111', marginBottom:8}}>Ajouté au panier</Text>
            <Text style={{fontSize:14, color:'#6B7280', textAlign:'center', marginBottom:24}}>
              {successCount} produit{successCount > 1 ? 's' : ''} {successCount > 1 ? 'ont été ajoutés' : 'a été ajouté'} à votre panier
            </Text>
            <TouchableOpacity
              onPress={() => { setSuccessModalVisible(false); navigation.navigate("cart"); }}
              style={{height:48, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', width:'100%', marginBottom:10}}
            >
              <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>Voir le panier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSuccessModalVisible(false)}
              style={{height:44, borderRadius:14, borderWidth:1, borderColor:'#E5E7EB', alignItems:'center', justifyContent:'center', width:'100%'}}
            >
              <Text style={{color:'#666', fontWeight:'600'}}>Continuer mes achats</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal doublons panier */}
      <Modal visible={dupModalVisible} animationType="slide" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'80%', paddingBottom:40}}>
            {/* Header */}
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
              <View>
                <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>Produits déjà dans le panier</Text>
                <Text style={{fontSize:13, color:'#6B7280', marginTop:4}}>{dupItems.length} produit{dupItems.length>1?'s':''} en doublon</Text>
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
                      <Text style={{fontSize:12, color:'#9CA3AF', marginTop:2}}>Déjà {existingQty} dans le panier</Text>
                    </View>
                    <View style={{flexDirection:'row', gap:6}}>
                      <TouchableOpacity
                        onPress={() => setDupItems(prev => prev.map((d, i) => i === di ? {...d, add: false} : d))}
                        style={{
                          paddingHorizontal:12, paddingVertical:8, borderRadius:10,
                          backgroundColor: !dup.add ? '#EF4444' : '#F3F4F6'
                        }}
                      >
                        <Text style={{color: !dup.add ? '#fff' : '#999', fontWeight:'700', fontSize:12}}>Ignorer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDupItems(prev => prev.map((d, i) => i === di ? {...d, add: true} : d))}
                        style={{
                          paddingHorizontal:12, paddingVertical:8, borderRadius:10,
                          backgroundColor: dup.add ? BRAND : '#F3F4F6'
                        }}
                      >
                        <Text style={{color: dup.add ? '#fff' : '#999', fontWeight:'700', fontSize:12}}>Ajouter</Text>
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
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify(finalMerged));
                  setCheckedShops({});
                  setPopupSelectedItems([]);
                  setDupModalVisible(false);
                  const added = dupItems.filter(d => d.add).length + dupNewOnly;
                  setSuccessCount(added);
                  setSuccessModalVisible(true);
                }}
                style={{height:50, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDupModalVisible(false)}
                style={{height:44, borderRadius:14, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#666', fontWeight:'600'}}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
const FavoritesScreen = () => {
  const { t } = useTranslation();
  const [favShops, setFavShops] = React.useState([]);
  const [shopDetails, setShopDetails] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Load favorite shops
  const loadFavShops = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_FAV_SHOPS);
      const arr = raw ? JSON.parse(raw) : [];
      setFavShops(Array.isArray(arr) ? arr : []);
      
      // Create shop details for each favorite
      const details = (Array.isArray(arr) ? arr : []).map(shopName => {
        // Find matching shop details (you can expand this with real data)
        const shopData = [
          {name: "Carrefour Market", distance: "0.9 km", time: "9 min", address: "12 Rue du Commerce"},
          {name: "Intermarché Sud", distance: "0.8 km", time: "10 min", address: "45 Avenue du Sud"},
          {name: "Primeur Bio", distance: "0.5 km", time: "7 min", address: "8 Place du Marché"},
          {name: "Leclerc Meaux", distance: "1.8 km", time: "8 min", address: "Zone Commerciale Meaux"},
          {name: "Monoprix Centre", distance: "1.2 km", time: "6 min", address: "Centre Ville"}
        ].find(s => s.name === shopName);
        
        return shopData || {name: shopName, distance: "", time: "", address: ""};
      });
      setShopDetails(details);
    } catch(e) {
      setFavShops([]);
      setShopDetails([]);
    }
  }, []);
  
  // Load favorites when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadFavShops();
    }, [loadFavShops])
  );
  
  // Remove from favorites
  const removeFavorite = async (shopName) => {
    try {
      const newFavs = favShops.filter(name => name !== shopName);
      setFavShops(newFavs);
      await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(newFavs));
      await loadFavShops();
    } catch(e) {}
  };
  
  if (shopDetails.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40}}>
          <Ionicons name="heart-outline" size={64} color="#E5E7EB" />
          <Text style={{fontSize: 18, fontWeight: '600', color: '#111', marginTop: 16, textAlign: 'center'}}>
            {t('favorites.noFavorites') || 'No favorite shops yet'}
          </Text>
          <Text style={{fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center'}}>
            {t('favorites.addFromProducts') || 'Add your favorite shops from the Products tab'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const filteredShops = searchQuery.trim()
    ? shopDetails.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : shopDetails;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ paddingHorizontal:16, paddingTop:12, paddingBottom:4 }}>
        <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:12, paddingHorizontal:12, paddingVertical:10, borderWidth:1, borderColor:'#E5E7EB' }}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un favori..."
            placeholderTextColor="#9CA3AF"
            style={{ flex:1, marginLeft:8, fontSize:15, color:'#111', padding:0 }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <FlatList
        data={filteredShops}
        keyExtractor={(item) => item.name}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{paddingVertical: 8}}
        renderItem={({item}) => (
          <View style={{
            backgroundColor: '#fff',
            marginHorizontal: 16,
            marginVertical: 8,
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 5,
            elevation: 2
          }}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <View style={{flex: 1}}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                  <Ionicons name="heart" size={20} color="#00C29B" style={{marginRight: 8}} />
                  <Text style={{fontSize: 18, fontWeight: '700', color: '#111'}}>{item.name}</Text>
                </View>
                {item.address ? (
                  <Text style={{fontSize: 14, color: '#6B7280', marginTop: 4}}>{item.address}</Text>
                ) : null}
                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                  {item.distance ? (
                    <>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={{fontSize: 13, color: '#6B7280', marginLeft: 4}}>{item.distance}</Text>
                    </>
                  ) : null}
                  {item.time ? (
                    <>
                      <Ionicons name="time-outline" size={14} color="#6B7280" style={{marginLeft: 12}} />
                      <Text style={{fontSize: 13, color: '#6B7280', marginLeft: 4}}>{item.time}</Text>
                    </>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => removeFavorite(item.name)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FEE2E2',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};
// Simulated order tracking modal
const OrderTracker = ({ visible, onClose, onCancel, items, total }) => {
  const steps = [
    { icon: "checkmark-circle", label: "Commande confirmée", delay: 0 },
    { icon: "storefront", label: "Préparation en cours", delay: 2500 },
    { icon: "bicycle", label: "Livreur en route", delay: 6000 },
    { icon: "location", label: "Presque arrivé !", delay: 10000 },
    { icon: "home", label: "Livré !", delay: 13000 },
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
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111' }}>Suivi de commande</Text>
            <TouchableOpacity onPress={onCancel || onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={{ color: '#6B7280', marginTop: 4 }}>N° {orderNumber}</Text>
        </View>

        {/* ETA */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: currentStep >= 4 ? '#ECFDF5' : '#F0FDF4', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: BRAND }}>
            <Ionicons name={currentStep >= 4 ? "checkmark-circle" : "time-outline"} size={36} color={BRAND} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: BRAND, marginTop: 2 }}>
              {currentStep >= 4 ? "OK" : `${eta} min`}
            </Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginTop: 12 }}>
            {currentStep >= 4 ? "Votre commande est arrivée !" : "Livraison estimée"}
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
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 }}>Récapitulatif</Text>
            {(() => {
              const grouped = {};
              (items || []).forEach(it => {
                const shop = it.shop || 'Autre';
                if (!grouped[shop]) grouped[shop] = [];
                grouped[shop].push(it);
              });
              return Object.entries(grouped).map(([shop, shopItems], si) => (
                <View key={si} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="storefront-outline" size={14} color={BRAND} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND, marginLeft: 6 }}>{shop}</Text>
                  </View>
                  {shopItems.map((it, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingLeft: 20 }}>
                      <Text style={{ color: '#374151', fontSize: 13, flex: 1 }}>{it.qty || 1}x {it.name || it.title}</Text>
                      <Text style={{ color: '#374151', fontSize: 13 }}>{(Number(it.price || 0) * Number(it.qty || 1)).toFixed(2).replace('.', ',')} €</Text>
                    </View>
                  ))}
                </View>
              ));
            })()}
            <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 4, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: BRAND }}>{(total || 0).toFixed(2).replace('.', ',')} €</Text>
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
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Terminé</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const CartScreen = () => {
  const { t } = useTranslation();
  const [cartItems, setCartItems] = React.useState([]);
  const [orderVisible, setOrderVisible] = React.useState(false);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [selectedCart, setSelectedCart] = React.useState({});
  const [orderMode, setOrderMode] = React.useState('delivery'); // 'delivery' | 'collect'
  const [deliveryAddress, setDeliveryAddress] = React.useState('12 Rue de Rivoli, 75004 Paris');
  const [deliveryInfo, setDeliveryInfo] = React.useState('');
  const [editingAddress, setEditingAddress] = React.useState(false);
  const [tempAddress, setTempAddress] = React.useState('');
  const [tempInfo, setTempInfo] = React.useState('');
  const [addressSuggestions, setAddressSuggestions] = React.useState([]);
  const [selectedDateIndex, setSelectedDateIndex] = React.useState(0);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [addProductShop, setAddProductShop] = React.useState(null); // shop name for add product popup

  // Générer les 7 prochains jours
  const deliveryDays = React.useMemo(() => {
    const days = [];
    const joursSemaine = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const mois = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        label: i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : joursSemaine[d.getDay()],
        sub: d.getDate() + ' ' + mois[d.getMonth()],
      });
    }
    return days;
  }, []);

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

  const PARIS_ADDRESSES = [
    '1 Avenue des Champs-Élysées, 75008 Paris',
    '10 Rue de la Paix, 75002 Paris',
    '12 Rue de Rivoli, 75004 Paris',
    '25 Boulevard Saint-Germain, 75005 Paris',
    '33 Rue du Faubourg Saint-Honoré, 75008 Paris',
    '5 Place de la République, 75003 Paris',
    '8 Rue de Bretagne, 75003 Paris',
    '15 Avenue de l\'Opéra, 75001 Paris',
    '42 Rue Oberkampf, 75011 Paris',
    '20 Boulevard de Belleville, 75020 Paris',
    '7 Rue Mouffetard, 75005 Paris',
    '18 Rue des Abbesses, 75018 Paris',
    '3 Place du Trocadéro, 75016 Paris',
    '55 Rue de la Roquette, 75011 Paris',
    '30 Avenue de la Grande Armée, 75017 Paris',
    '14 Rue du Commerce, 75015 Paris',
    '9 Boulevard Voltaire, 75011 Paris',
    '22 Rue de Turbigo, 75003 Paris',
  ];

  const filterAddresses = (text) => {
    setTempAddress(text);
    if (text.length < 2) { setAddressSuggestions([]); return; }
    const q = text.toLowerCase();
    const filtered = PARIS_ADDRESSES.filter(a => a.toLowerCase().includes(q)).slice(0, 4);
    setAddressSuggestions(filtered);
  };
  const totalPrice = cartItems.reduce((sum, it, i) => selectedCart[i] ? sum + (Number(it.price || 0) * Number(it.qty || 1)) : sum, 0);

  const loadCart = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_CART);
      const arr = raw ? JSON.parse(raw) : [];
      const items = Array.isArray(arr) ? arr : [];
      setCartItems(items);
    } catch(e) {
      setCartItems([]);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { loadCart(); }, [loadCart]));

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
      "Vider le panier",
      "Êtes-vous sûr de vouloir vider votre panier ?",
      [
        { text: t('listScreen.cancel'), style: "cancel" },
        { text: "Vider", style: "destructive", onPress: async () => {
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
      const shop = item.shop || 'Autre';
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
            Votre panier est vide
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
            Ajoutez des produits depuis l'onglet Produits
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={groupedCart}
        keyExtractor={(item, i) => item.shop + i}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 120 }}
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
              <Text style={{ fontSize:15, fontWeight:'700', color:'#00C29B', marginLeft:6, flex:1 }}>{group.shop}</Text>
              <Text style={{ fontSize:12, color:'#9CA3AF' }}>{group.items.length} article{group.items.length > 1 ? 's' : ''}</Text>
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
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{item.name || item.title}</Text>
                  {item.detail ? <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{item.detail}</Text> : null}
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
                    {(Number(item.price || 0) * Number(item.qty || 1)).toFixed(2).replace('.', ',')} €
                  </Text>
                  {item.unitPrice ? <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.unitPrice}</Text> : null}
                  <TouchableOpacity onPress={() => removeFromCart(idx)} style={{ padding: 6, marginTop: 4 }}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
          );
        }}
      />
      {Object.values(selectedCart).some(v => v) && (
      <View style={{
        position: 'absolute', bottom: 30, left: GUTTER, right: GUTTER,
        backgroundColor: '#fff', borderRadius: 14, padding: 16,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Total</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: BRAND }}>{totalPrice.toFixed(2).replace('.', ',')} €</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={clearCart} style={{
            flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#EF4444',
            alignItems: 'center', justifyContent: 'center', marginRight: 8
          }}>
            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Vider</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmVisible(true)} style={{
            flex: 2, height: 44, borderRadius: 10, backgroundColor: BRAND,
            alignItems: 'center', justifyContent: 'center'
          }}>
            <Ionicons name="bicycle" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Commander</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {/* Modal de confirmation de commande */}
      <Modal visible={confirmVisible} animationType="slide" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'85%', paddingBottom:40}}>
            {/* Header */}
            <View style={{padding:20, paddingBottom:0}}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <Text style={{fontSize:20, fontWeight:'800', color:'#111'}}>Confirmer la commande</Text>
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
                  <Text style={{marginLeft:6, fontSize:14, fontWeight:'700', color: orderMode === 'delivery' ? BRAND : '#9CA3AF'}}>Livraison</Text>
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
                  <Text style={{marginLeft:6, fontSize:14, fontWeight:'700', color: orderMode === 'collect' ? BRAND : '#9CA3AF'}}>Click & Collect</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{paddingHorizontal:20}} contentContainerStyle={{paddingBottom:10}}>
              {/* Résumé par magasin */}
              {(() => {
                const selected = cartItems.filter((_, i) => selectedCart[i]);
                const grouped = {};
                selected.forEach(it => {
                  const shop = it.shop || 'Autre';
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
                          <Text style={{fontSize:12, color:'#9CA3AF'}}>Qté: {it.qty || 1}</Text>
                        </View>
                        <Text style={{fontSize:14, fontWeight:'700', color:'#111'}}>{(Number(it.price||0) * Number(it.qty||1)).toFixed(2).replace('.',',')} €</Text>
                      </View>
                    ))}
                    <View style={{borderTopWidth:1, borderTopColor:'#F3F4F6', flexDirection:'row', justifyContent:'space-between', paddingTop:8, marginTop:4}}>
                      <Text style={{fontSize:13, color:'#6B7280'}}>Sous-total {shop}</Text>
                      <Text style={{fontSize:13, fontWeight:'700', color:'#111'}}>{items.reduce((s,it) => s + Number(it.price||0) * Number(it.qty||1), 0).toFixed(2).replace('.',',')} €</Text>
                    </View>
                    {/* Bouton ajouter produits */}
                    {cartItems.some((it, idx) => !selectedCart[idx] && (it.shop || 'Autre') === shop) && (
                      <TouchableOpacity
                        onPress={() => setAddProductShop(shop)}
                        style={{flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:10, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:BRAND, borderStyle:'dashed'}}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={BRAND} />
                        <Text style={{fontSize:13, fontWeight:'600', color:BRAND, marginLeft:6}}>Ajouter des produits</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ));
              })()}

              {/* Frais de livraison */}
              <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:10}}>
                <Text style={{fontSize:13, color:'#6B7280'}}>{orderMode === 'delivery' ? 'Frais de livraison' : 'Frais de retrait'}</Text>
                <Text style={{fontSize:13, fontWeight:'700', color: orderMode === 'collect' ? BRAND : '#111'}}>{orderMode === 'delivery' ? '9,99 €' : 'Gratuit'}</Text>
              </View>

              {/* Adresse de livraison ou Click & Collect */}
              {orderMode === 'collect' && (
                <View style={{marginTop:20, padding:14, backgroundColor:'#FFF7ED', borderRadius:12}}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <View style={{width:32, height:32, borderRadius:16, backgroundColor:'#FFEDD5', alignItems:'center', justifyContent:'center'}}>
                      <Ionicons name="storefront-outline" size={18} color="#F97316" />
                    </View>
                    <View style={{marginLeft:10, flex:1}}>
                      <Text style={{fontSize:14, fontWeight:'700', color:'#111'}}>Retrait en magasin</Text>
                      <Text style={{fontSize:12, color:'#6B7280', marginTop:2}}>Votre commande sera prête sous 1h</Text>
                    </View>
                  </View>
                  <Text style={{fontSize:13, color:'#9CA3AF', marginTop:8, marginLeft:42}}>Présentez-vous à l'accueil du magasin</Text>
                </View>
              )}
              {orderMode === 'delivery' && <View style={{marginTop:20, padding:14, backgroundColor:'#F9FAFB', borderRadius:12}}>
                <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Ionicons name="location-outline" size={18} color={BRAND} />
                    <Text style={{fontSize:14, fontWeight:'700', color:'#111', marginLeft:8}}>Adresse de livraison</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setTempAddress(deliveryAddress); setTempInfo(deliveryInfo); setAddressSuggestions([]); setEditingAddress(true); }}>
                    <Text style={{fontSize:13, fontWeight:'600', color:BRAND}}>Modifier</Text>
                  </TouchableOpacity>
                </View>
                {editingAddress ? (
                  <View style={{marginTop:10}}>
                    {/* Champ adresse */}
                    <Text style={{fontSize:12, fontWeight:'600', color:'#6B7280', marginBottom:4}}>Adresse</Text>
                    <TextInput
                      value={tempAddress}
                      onChangeText={filterAddresses}
                      style={{backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#111'}}
                      autoFocus={true}
                      placeholder="Entrez votre adresse"
                    />
                    {/* Suggestions */}
                    {addressSuggestions.length > 0 && (
                      <View style={{backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, marginTop:4, overflow:'hidden'}}>
                        {addressSuggestions.map((addr, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => { setTempAddress(addr); setAddressSuggestions([]); }}
                            style={{paddingHorizontal:12, paddingVertical:10, borderBottomWidth: i < addressSuggestions.length - 1 ? 1 : 0, borderBottomColor:'#F3F4F6', flexDirection:'row', alignItems:'center'}}
                          >
                            <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                            <Text style={{fontSize:13, color:'#374151', marginLeft:8}}>{addr}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {/* Infos complémentaires */}
                    <Text style={{fontSize:12, fontWeight:'600', color:'#6B7280', marginTop:12, marginBottom:4}}>Informations complémentaires</Text>
                    <TextInput
                      value={tempInfo}
                      onChangeText={setTempInfo}
                      style={{backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#111'}}
                      placeholder="Bât, étage, code, interphone..."
                      multiline={false}
                    />
                    {/* Boutons */}
                    <View style={{flexDirection:'row', marginTop:12, gap:8}}>
                      <TouchableOpacity
                        onPress={() => { setEditingAddress(false); setAddressSuggestions([]); }}
                        style={{flex:1, height:36, borderRadius:8, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
                      >
                        <Text style={{color:'#666', fontWeight:'600', fontSize:13}}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { setDeliveryAddress(tempAddress); setDeliveryInfo(tempInfo); setEditingAddress(false); setAddressSuggestions([]); }}
                        style={{flex:1, height:36, borderRadius:8, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}
                      >
                        <Text style={{color:'#fff', fontWeight:'600', fontSize:13}}>Valider</Text>
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

              {/* Créneau de livraison */}
              <View style={{marginTop:12}}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom:14}}>
                  <View style={{width:32, height:32, borderRadius:16, backgroundColor:'#F0FDF4', alignItems:'center', justifyContent:'center'}}>
                    <Ionicons name="time-outline" size={18} color={BRAND} />
                  </View>
                  <Text style={{fontSize:15, fontWeight:'700', color:'#111', marginLeft:10}}>Créneau de livraison</Text>
                </View>

                {/* Sélecteur de jour - ligne horizontale */}
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

                {/* Créneaux groupés par période */}
                {deliverySlots.length > 0 ? (() => {
                  const periods = [
                    { label: 'Matin', icon: 'sunny-outline', color: '#F59E0B', from: 8, to: 12 },
                    { label: 'Après-midi', icon: 'partly-sunny-outline', color: '#F97316', from: 12, to: 18 },
                    { label: 'Soir', icon: 'moon-outline', color: '#6366F1', from: 18, to: 23 },
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
                        <View style={{flexDirection:'row', flexWrap:'wrap', gap:8}}>
                          {periodSlots.map((slot, si) => {
                            const active = selectedSlot === slot;
                            return (
                            <TouchableOpacity
                              key={si}
                              onPress={() => setSelectedSlot(slot)}
                              style={{
                                paddingHorizontal:12, paddingVertical:8, borderRadius:10,
                                backgroundColor: active ? BRAND : 'transparent',
                                borderWidth:1, borderColor: active ? BRAND : '#E5E7EB',
                              }}
                            >
                              <Text style={{fontSize:12, fontWeight:'600', color: active ? '#fff' : '#374151'}}>{slot}</Text>
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
                    <Text style={{fontSize:13, color:'#9CA3AF', marginTop:8}}>Aucun créneau disponible</Text>
                  </View>
                )}

                {/* Résumé sélection */}
                {selectedSlot && (
                  <View style={{backgroundColor:'#F0FDF4', borderRadius:12, padding:12, flexDirection:'row', alignItems:'center', marginBottom:8}}>
                    <View style={{width:28, height:28, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center'}}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                    <View style={{marginLeft:10, flex:1}}>
                      <Text style={{fontSize:14, fontWeight:'700', color:'#111'}}>
                        {deliveryDays[selectedDateIndex]?.label} {deliveryDays[selectedDateIndex]?.sub}
                      </Text>
                      <Text style={{fontSize:13, fontWeight:'600', color:BRAND}}>{selectedSlot}</Text>
                    </View>
                  </View>
                )}

              </View>

              {/* Total */}
              <View style={{marginTop:16, padding:14, backgroundColor:'#F9FAFB', borderRadius:12}}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:6}}>
                  <Text style={{fontSize:14, color:'#6B7280'}}>Sous-total produits</Text>
                  <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{totalPrice.toFixed(2).replace('.',',')} €</Text>
                </View>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:6}}>
                  <Text style={{fontSize:14, color:'#6B7280'}}>{orderMode === 'delivery' ? 'Livraison' : 'Retrait'}</Text>
                  <Text style={{fontSize:14, fontWeight:'600', color: orderMode === 'collect' ? BRAND : '#111'}}>{orderMode === 'delivery' ? '9,99 €' : 'Gratuit'}</Text>
                </View>
                <View style={{borderTopWidth:1, borderTopColor:'#E5E7EB', paddingTop:8, flexDirection:'row', justifyContent:'space-between'}}>
                  <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>Total</Text>
                  <Text style={{fontSize:18, fontWeight:'800', color:BRAND}}>{(totalPrice + (orderMode === 'delivery' ? 9.99 : 0)).toFixed(2).replace('.',',')} €</Text>
                </View>
              </View>

              {/* Nombre articles */}
              <Text style={{fontSize:12, color:'#9CA3AF', textAlign:'center', marginTop:10}}>
                {cartItems.filter((_, i) => selectedCart[i]).length} article{cartItems.filter((_, i) => selectedCart[i]).length > 1 ? 's' : ''} sélectionné{cartItems.filter((_, i) => selectedCart[i]).length > 1 ? 's' : ''}
              </Text>
            </ScrollView>

            {/* Boutons */}
            <View style={{paddingHorizontal:20, marginTop:10, gap:10}}>
              <TouchableOpacity
                onPress={() => {
                  setConfirmVisible(false);
                  setOrderVisible(true);
                }}
                style={{height:52, borderRadius:14, backgroundColor:BRAND, flexDirection:'row', alignItems:'center', justifyContent:'center'}}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginRight:8}} />
                <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>Confirmer la commande</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setConfirmVisible(false)}
                style={{height:44, borderRadius:14, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:'#666', fontWeight:'600'}}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Popup ajouter produits du shop */}
      <Modal visible={!!addProductShop} animationType="slide" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
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
            <Text style={{paddingHorizontal:20, fontSize:13, color:'#6B7280', marginBottom:12}}>Sélectionnez les produits à ajouter</Text>
            <FlatList
              data={cartItems.map((it, idx) => ({...it, _idx: idx})).filter(it => !selectedCart[it._idx] && (it.shop || 'Autre') === addProductShop)}
              keyExtractor={(it, i) => String(i)}
              style={{paddingHorizontal:20}}
              renderItem={({item}) => (
                <View style={{flexDirection:'row', alignItems:'center', paddingVertical:10}}>
                  <ProductThumb name={item.name || item.title} size={40} />
                  <View style={{flex:1, marginLeft:12}}>
                    <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{item.name || item.title}</Text>
                    <Text style={{fontSize:12, color:'#9CA3AF'}}>{item.detail || ''}</Text>
                  </View>
                  <Text style={{fontSize:14, fontWeight:'700', color:'#111', marginRight:12}}>{Number(item.price||0).toFixed(2).replace('.',',')} €</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCart(prev => ({...prev, [item._idx]: true}));
                    }}
                    style={{paddingHorizontal:14, paddingVertical:8, borderRadius:10, backgroundColor:BRAND}}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={{alignItems:'center', paddingVertical:30}}>
                  <Ionicons name="checkmark-circle" size={32} color={BRAND} />
                  <Text style={{fontSize:14, color:'#6B7280', marginTop:8}}>Tous les produits sont déjà ajoutés</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <OrderTracker
        visible={orderVisible}
        items={cartItems}
        total={totalPrice}
        onCancel={() => setOrderVisible(false)}
        onClose={async () => {
          setOrderVisible(false);
          // Save to order history
          try {
            const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
            const history = raw ? JSON.parse(raw) : [];
            const shops = [...new Set(cartItems.map(i => i.shop).filter(Boolean))];
            history.unshift({ id: Date.now(), date: new Date().toISOString(), items: cartItems, total: totalPrice, shops });
            await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(history));
          } catch(e) {}
          // Clear cart after order
          setCartItems([]);
          setSelectedCart({});
          await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
        }}
      />
    </SafeAreaView>
  );
};

function MainNavigator() {
  const { t } = useTranslation();
  
  const ICONS = {
    "profile": { focused: "person", unfocused: "person-outline" },
    "myList": { focused: "reorder-three", unfocused: "reorder-three-outline" },
    "products": { focused: "cart",           unfocused: "cart-outline" },
    "favorites":  { focused: "heart",          unfocused: "heart-outline" },
    "cart":   { focused: "bag-handle",     unfocused: "bag-handle-outline" }
  };

  const getTabName = (key) => {
    const tabNames = {
      myList: t('tabs.myList'),
      products: t('tabs.products'),
      favorites: t('tabs.favorites'),
      cart: t('tabs.cart'),
      profile: 'Profil'
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
        tabBarStyle: { height: 62 },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = ICONS[route.name] || { focused:"ellipse", unfocused:"ellipse-outline" };
          const name = focused ? iconSet.focused : iconSet.unfocused;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="myList" component={ListScreen} />
      <Tab.Screen name="products" component={ProductsScreen} />
      <Tab.Screen name="favorites" component={FavoritesScreen} />
      <Tab.Screen name="cart"  component={CartScreen} />
      <Tab.Screen name="profile" component={FakeProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <MainNavigator />
    </NavigationContainer>
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

  row:{ flexDirection:"row", alignItems:"center", paddingVertical:10, paddingHorizontal:GUTTER },
  qtyInline:{ flexDirection:"row", alignItems:"center", marginLeft:12 },
  qtyBtn:{ width:28, height:28, borderRadius:8, borderWidth:1, borderColor:"#E5E7EB", alignItems:"center", justifyContent:"center" },
  qtyInput:{ width:48, height:32, borderWidth:1, borderColor:"#E5E7EB", borderRadius:8, textAlign:"center", fontSize:15, marginHorizontal:4 },

  itemLabel:{ fontSize:16, color:"#111", marginLeft:12 },
  crossed:{ textDecorationLine:"line-through", color:"#999" },
  trashBtn:{ paddingHorizontal:6, marginLeft:6 },

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


function FakeProfileScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = React.useState({ nom: '', prenom: '', pseudo: '', photo: null });
  const [editVisible, setEditVisible] = React.useState(false);
  const [editNom, setEditNom] = React.useState('');
  const [editPrenom, setEditPrenom] = React.useState('');
  const [editPseudo, setEditPseudo] = React.useState('');
  const [orders, setOrders] = React.useState([]);
  const [expandedOrder, setExpandedOrder] = React.useState(null);

  const loadProfile = React.useCallback(async () => {
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

  useFocusEffect(React.useCallback(() => { loadProfile(); loadOrders(); }, [loadProfile, loadOrders]));

  const saveProfile = async () => {
    const updated = { ...profile, nom: editNom.trim(), prenom: editPrenom.trim(), pseudo: editPseudo.trim() };
    setProfile(updated);
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    setEditVisible(false);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à vos photos pour changer votre image de profil.');
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
    }
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return iso; }
  };

  const initials = (profile.prenom?profile.prenom[0]:'') + (profile.nom?profile.nom[0]:'');

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ paddingBottom:20 }} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={{ alignItems:'center', paddingVertical:24 }}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={{ width:100, height:100, marginBottom:12 }}>
            <View style={{
              width:100, height:100, borderRadius:50, backgroundColor:'#E0F7F1',
              alignItems:'center', justifyContent:'center',
              borderWidth:3, borderColor:'#00C29B', overflow:'hidden'
            }}>
              {profile.photo && (profile.photo.startsWith('/') || profile.photo.startsWith('file')) ? (
                <Image source={{ uri: profile.photo }} style={{ width:100, height:100 }} />
              ) : (
                <Text style={{ fontSize:36, fontWeight:'800', color:'#00C29B' }}>{initials || '👤'}</Text>
              )}
            </View>
            <View style={{ position:'absolute', bottom:0, right:0, width:30, height:30, borderRadius:15,
              backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#fff', zIndex:10 }}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize:10, color:'#9CA3AF', marginBottom:6 }}>Appuyez pour changer</Text>

          {/* Profile Info Card */}
          <View style={{ backgroundColor:'#fff', borderRadius:14, padding:16, marginTop:8, width:'85%',
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
              <Ionicons name="at" size={18} color="#00C29B" />
              <Text style={{ fontSize:13, color:'#6B7280', marginLeft:6, width:60 }}>Pseudo</Text>
              <Text style={{ fontSize:15, fontWeight:'700', color: profile.pseudo ? '#111' : '#D1D5DB', flex:1 }}>
                {profile.pseudo || 'Non défini'}
              </Text>
            </View>
            <View style={{ height:1, backgroundColor:'#F3F4F6', marginBottom:10 }} />
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
              <Ionicons name="person-outline" size={18} color="#00C29B" />
              <Text style={{ fontSize:13, color:'#6B7280', marginLeft:6, width:60 }}>Prénom</Text>
              <Text style={{ fontSize:15, fontWeight:'700', color: profile.prenom ? '#111' : '#D1D5DB', flex:1 }}>
                {profile.prenom || 'Non défini'}
              </Text>
            </View>
            <View style={{ height:1, backgroundColor:'#F3F4F6', marginBottom:10 }} />
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Ionicons name="person-outline" size={18} color="#00C29B" />
              <Text style={{ fontSize:13, color:'#6B7280', marginLeft:6, width:60 }}>Nom</Text>
              <Text style={{ fontSize:15, fontWeight:'700', color: profile.nom ? '#111' : '#D1D5DB', flex:1 }}>
                {profile.nom || 'Non défini'}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => { setEditNom(profile.nom); setEditPrenom(profile.prenom); setEditPseudo(profile.pseudo||''); setEditVisible(true); }} style={{
            marginTop:14, paddingHorizontal:20, paddingVertical:10, borderRadius:10,
            backgroundColor:'#00C29B'
          }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>
              {profile.nom ? 'Modifier le profil' : 'Configurer le profil'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order History */}
        <View style={{ paddingHorizontal:16 }}>
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111', marginBottom:12 }}>
            Historique des commandes
          </Text>

          {orders.length === 0 ? (
            <View style={{ backgroundColor:'#fff', borderRadius:12, padding:24, alignItems:'center' }}>
              <Ionicons name="receipt-outline" size={40} color="#E5E7EB" />
              <Text style={{ color:'#9CA3AF', marginTop:8 }}>Aucune commande pour le moment</Text>
            </View>
          ) : (
            orders.map((order) => (
              <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                style={{ backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10,
                  shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
                }}>
                <View style={{ flexDirection:'row', alignItems:'center' }}>
                  <View style={{ width:36, height:36, borderRadius:18, backgroundColor:'#E0F7F1',
                    alignItems:'center', justifyContent:'center', marginRight:10, flexShrink:0 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#00C29B" />
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{ fontWeight:'700', color:'#111' }} numberOfLines={1}>Commande #{String(order.id).slice(-4)}</Text>
                    {(order.shops && order.shops.length > 0) ? (
                      <Text style={{ fontSize:13, color:'#374151', marginTop:2 }} numberOfLines={1}>{order.shops.join(', ')}</Text>
                    ) : null}
                    <Text style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{fmtDate(order.date)}</Text>
                  </View>
                  <View style={{ alignItems:'flex-end', marginLeft:10, flexShrink:0 }}>
                    <Text style={{ fontWeight:'800', color:'#00C29B', fontSize:15 }}>
                      {(order.total||0).toFixed(2).replace('.',',')} €
                    </Text>
                    <Ionicons name={expandedOrder === order.id ? "chevron-up" : "chevron-down"} size={14} color="#9CA3AF" style={{marginTop:4}} />
                  </View>
                </View>

                {expandedOrder === order.id && (
                  <View style={{ marginTop:10, borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:10 }}>
                    {/* Group items by shop */}
                    {(() => {
                      const byShop = {};
                      (order.items||[]).forEach(it => {
                        const s = it.shop || 'Autre';
                        if (!byShop[s]) byShop[s] = [];
                        byShop[s].push(it);
                      });
                      return Object.entries(byShop).map(([shop, items]) => (
                        <View key={shop} style={{ marginBottom:10 }}>
                          <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                            <Ionicons name="storefront-outline" size={14} color="#00C29B" />
                            <Text style={{ fontSize:14, fontWeight:'700', color:'#111', marginLeft:6 }}>{shop}</Text>
                          </View>
                          {items.map((it, idx) => (
                            <View key={idx} style={{ flexDirection:'row', alignItems:'center', paddingVertical:6, paddingLeft:8, borderLeftWidth:2, borderLeftColor:'#E5E7EB', marginLeft:6 }}>
                              <ProductThumb name={it.name||it.title} size={32} />
                              <View style={{ flex:1, marginLeft:8 }}>
                                <Text style={{ fontSize:14, fontWeight:'600', color:'#374151' }} numberOfLines={1}>{it.name||it.title}</Text>
                                <Text style={{ fontSize:12, color:'#9CA3AF' }}>Qté: {it.qty||1}</Text>
                              </View>
                              <Text style={{ fontWeight:'700', color:'#374151', fontSize:14 }}>
                                {((it.price||0)*(it.qty||1)).toFixed(2).replace('.',',')} €
                              </Text>
                            </View>
                          ))}
                        </View>
                      ));
                    })()}
                    <View style={{ flexDirection:'row', justifyContent:'space-between', borderTopWidth:1, borderTopColor:'#E5E7EB', paddingTop:8, marginTop:4 }}>
                      <Text style={{ fontSize:13, color:'#9CA3AF' }}>
                        {(order.items||[]).length} article{(order.items||[]).length>1?'s':''}
                      </Text>
                      <Text style={{ fontSize:14, fontWeight:'800', color:'#00C29B' }}>
                        Total: {(order.total||0).toFixed(2).replace('.',',')} €
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Disconnect Button */}
        <View style={{ paddingHorizontal:16, marginTop:16, marginBottom:0 }}>
          <TouchableOpacity onPress={() => {
            Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Déconnecter', style: 'destructive', onPress: async () => {
                await AsyncStorage.removeItem(KEY_PROFILE);
                await AsyncStorage.removeItem(KEY_ORDER_HISTORY);
                setProfile({ nom: '', prenom: '', pseudo: '', photo: null });
                setOrders([]);
              }}
            ]);
          }} style={{
            paddingVertical:14, borderRadius:12,
            backgroundColor:'#EF4444', alignItems:'center', flexDirection:'row', justifyContent:'center'
          }}>
            <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight:8 }} />
            <Text style={{ fontSize:16, fontWeight:'700', color:'#fff' }}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:16, padding:20 }}>
            <Text style={{ fontSize:18, fontWeight:'800', marginBottom:16 }}>Modifier le profil</Text>

            <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>Prénom</Text>
            <TextInput value={editPrenom} onChangeText={setEditPrenom} placeholder="Votre prénom"
              style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:12, fontSize:16 }} />

            <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>Nom</Text>
            <TextInput value={editNom} onChangeText={setEditNom} placeholder="Votre nom"
              style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:20, fontSize:16 }} />

            <View style={{ flexDirection:'row' }}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={{
                flex:1, paddingVertical:12, borderRadius:10, borderWidth:1, borderColor:'#E5E7EB',
                alignItems:'center', marginRight:8
              }}>
                <Text style={{ fontWeight:'600', color:'#6B7280' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveProfile} style={{
                flex:1, paddingVertical:12, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center'
              }}>
                <Text style={{ fontWeight:'700', color:'#fff' }}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
