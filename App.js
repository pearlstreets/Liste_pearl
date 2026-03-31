import { autocorrectName } from "./utils/spellcheck";
import { isOptimized, setOptimized, getMode } from "./utils/distributionMode";
import React, { useEffect, useMemo, useState } from "react";

// Marketplace API Services
import { loginUser, registerUser, logoutUser, forgotPassword as apiForgotPassword, updatePassword as apiUpdatePassword } from "./services/auth";
import { getAllProducts, getCompanyProducts, searchProducts as apiSearchProducts, getCategories } from "./services/products";
import { getAllShops, getShopDetails } from "./services/shops";
import { getCart, saveCart, addToCart as apiAddToCart, removeFromCart as apiRemoveFromCart, clearCart, placeOrder } from "./services/orders";
import { getProfile as apiGetProfile, updateProfile as apiUpdateProfile, uploadProfilePhoto } from "./services/profile";
import { getTokens } from "./services/api";
import { createDeliveryOrder, trackDelivery, getDeliveryStatus, DELIVERY_STATUS, getDeliveryStatusInfo } from "./services/delivery";

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
const KEY_AUTH = "KEY_AUTH";
const KEY_ACCOUNTS = "KEY_ACCOUNTS";
const DEFAULT_ACCOUNT = { pseudo: 'Remsko', prenom: 'Remsko', nom: 'Ganja', email: 'reguerville@gmail.com', password: 'Remsko123' };
const GUTTER = 24;
const CTRL = 20;
const GAP = 10;

// Stripe-supported currencies with symbols and approximate rates vs EUR
const CURRENCIES = [
  { code:'EUR', symbol:'€', rate:1, name:'Euro', flag:'🇪🇺' },
  { code:'USD', symbol:'$', rate:1.09, name:'US Dollar', flag:'🇺🇸' },
  { code:'GBP', symbol:'£', rate:0.86, name:'British Pound', flag:'🇬🇧' },
  { code:'CHF', symbol:'CHF', rate:0.97, name:'Swiss Franc', flag:'🇨🇭' },
  { code:'CAD', symbol:'CA$', rate:1.48, name:'Canadian Dollar', flag:'🇨🇦' },
  { code:'AUD', symbol:'A$', rate:1.66, name:'Australian Dollar', flag:'🇦🇺' },
  { code:'JPY', symbol:'¥', rate:163, name:'Japanese Yen', flag:'🇯🇵', decimals:0 },
  { code:'CNY', symbol:'¥', rate:7.85, name:'Chinese Yuan', flag:'🇨🇳' },
  { code:'INR', symbol:'₹', rate:90.5, name:'Indian Rupee', flag:'🇮🇳' },
  { code:'BRL', symbol:'R$', rate:5.42, name:'Brazilian Real', flag:'🇧🇷' },
  { code:'MXN', symbol:'MX$', rate:18.7, name:'Mexican Peso', flag:'🇲🇽' },
  { code:'PLN', symbol:'zł', rate:4.32, name:'Polish Zloty', flag:'🇵🇱' },
  { code:'SEK', symbol:'kr', rate:11.2, name:'Swedish Krona', flag:'🇸🇪' },
  { code:'NOK', symbol:'kr', rate:11.5, name:'Norwegian Krone', flag:'🇳🇴' },
  { code:'DKK', symbol:'kr', rate:7.46, name:'Danish Krone', flag:'🇩🇰' },
  { code:'CZK', symbol:'Kč', rate:25.3, name:'Czech Koruna', flag:'🇨🇿' },
  { code:'HUF', symbol:'Ft', rate:393, name:'Hungarian Forint', flag:'🇭🇺', decimals:0 },
  { code:'RON', symbol:'lei', rate:4.97, name:'Romanian Leu', flag:'🇷🇴' },
  { code:'BGN', symbol:'лв', rate:1.96, name:'Bulgarian Lev', flag:'🇧🇬' },
  { code:'HRK', symbol:'kn', rate:7.53, name:'Croatian Kuna', flag:'🇭🇷' },
  { code:'TRY', symbol:'₺', rate:34.8, name:'Turkish Lira', flag:'🇹🇷' },
  { code:'ZAR', symbol:'R', rate:19.8, name:'South African Rand', flag:'🇿🇦' },
  { code:'THB', symbol:'฿', rate:37.5, name:'Thai Baht', flag:'🇹🇭' },
  { code:'SGD', symbol:'S$', rate:1.46, name:'Singapore Dollar', flag:'🇸🇬' },
  { code:'HKD', symbol:'HK$', rate:8.52, name:'Hong Kong Dollar', flag:'🇭🇰' },
  { code:'NZD', symbol:'NZ$', rate:1.79, name:'New Zealand Dollar', flag:'🇳🇿' },
  { code:'KRW', symbol:'₩', rate:1420, name:'Korean Won', flag:'🇰🇷', decimals:0 },
  { code:'TWD', symbol:'NT$', rate:34.2, name:'Taiwan Dollar', flag:'🇹🇼' },
  { code:'ILS', symbol:'₪', rate:3.92, name:'Israeli Shekel', flag:'🇮🇱' },
  { code:'AED', symbol:'د.إ', rate:4.0, name:'UAE Dirham', flag:'🇦🇪' },
  { code:'SAR', symbol:'﷼', rate:4.09, name:'Saudi Riyal', flag:'🇸🇦' },
  { code:'MYR', symbol:'RM', rate:4.82, name:'Malaysian Ringgit', flag:'🇲🇾' },
  { code:'IDR', symbol:'Rp', rate:16800, name:'Indonesian Rupiah', flag:'🇮🇩', decimals:0 },
  { code:'PHP', symbol:'₱', rate:61.2, name:'Philippine Peso', flag:'🇵🇭' },
  { code:'CLP', symbol:'CL$', rate:1015, name:'Chilean Peso', flag:'🇨🇱', decimals:0 },
  { code:'COP', symbol:'COL$', rate:4350, name:'Colombian Peso', flag:'🇨🇴', decimals:0 },
  { code:'ARS', symbol:'AR$', rate:940, name:'Argentine Peso', flag:'🇦🇷', decimals:0 },
  { code:'PEN', symbol:'S/', rate:4.05, name:'Peruvian Sol', flag:'🇵🇪' },
  { code:'NGN', symbol:'₦', rate:1690, name:'Nigerian Naira', flag:'🇳🇬', decimals:0 },
  { code:'EGP', symbol:'E£', rate:52.3, name:'Egyptian Pound', flag:'🇪🇬' },
  { code:'KES', symbol:'KSh', rate:140, name:'Kenyan Shilling', flag:'🇰🇪', decimals:0 },
  { code:'MAD', symbol:'د.م.', rate:10.7, name:'Moroccan Dirham', flag:'🇲🇦' },
  { code:'RUB', symbol:'₽', rate:99.5, name:'Russian Ruble', flag:'🇷🇺' },
];
// Live exchange rates cache
let _liveRates = null;
let _liveRatesTs = 0;
const RATES_CACHE_MS = 30 * 60 * 1000; // 30 min cache

async function fetchLiveRates() {
  // Return cached if fresh
  if (_liveRates && (Date.now() - _liveRatesTs) < RATES_CACHE_MS) return _liveRates;
  try {
    const codes = CURRENCIES.filter(c => c.code !== 'EUR').map(c => c.code).join(',');
    const resp = await fetch('https://api.frankfurter.app/latest?from=EUR&to=' + codes);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    if (data && data.rates) {
      _liveRates = data.rates;
      _liveRatesTs = Date.now();
      return _liveRates;
    }
  } catch (e) {
    // Fallback: try exchangerate.host
    try {
      const resp2 = await fetch('https://open.er-api.com/v6/latest/EUR');
      const data2 = await resp2.json();
      if (data2 && data2.rates) {
        _liveRates = data2.rates;
        _liveRatesTs = Date.now();
        return _liveRates;
      }
    } catch (_) {}
  }
  return null; // Will use hardcoded fallback rates
}

function getCurrencyWithLiveRate(currObj, liveRates) {
  if (!liveRates || currObj.code === 'EUR') return currObj;
  const liveRate = liveRates[currObj.code];
  if (liveRate && isFinite(liveRate)) return { ...currObj, rate: liveRate };
  return currObj; // fallback to hardcoded rate
}

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
      position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 20, right: 20, zIndex: 9999,
      backgroundColor: '#111', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      opacity, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
    }}>
      <Ionicons name="checkmark-circle" size={20} color={BRAND} style={{ marginRight: 8 }} />
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{message}</Text>
    </Animated.View>
  );
};

const RepeatButton = ({ onPress, onLongAction, style, children }) => {
  const intervalRef = React.useRef(null);
  const cbRef = React.useRef(onLongAction);
  React.useEffect(() => { cbRef.current = onLongAction; }, [onLongAction]);
  React.useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  const startRepeat = () => {
    intervalRef.current = setInterval(() => { cbRef.current(); }, 80);
  };
  const stopRepeat = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={startRepeat}
      onPressOut={stopRepeat}
      delayLongPress={200}
      style={style}
    >
      {children}
    </TouchableOpacity>
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
        const idx = base.findIndex(b => b.name.toLowerCase() === p.name.toLowerCase());
        if (idx >= 0) base[idx] = { ...base[idx], qty: (base[idx].qty || 1) + p.qty };
        else base.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), name: p.name, qty: p.qty, crossed: false, selected: true });
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
  const toggleSelected = id => setItems(items.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleCrossed  = id => setItems(items.map(it => it.id === id ? { ...it, crossed: !it.crossed, selected: it.crossed ? it.selected : false } : it));
  const removeOne      = id => setItems(items.filter(it => it.id !== id));

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
    <View style={styles.row}>
      {/* Checkbox — grisée si barré */}
      <View style={isCrossed ? {opacity:0.3} : undefined}>
        <Square value={!!item.selected} onPress={() => !isCrossed && toggleSelected(item.id)} />
      </View>

      {/* Quantité — grisée si barré */}
      <View style={[styles.qtyInline, isCrossed && {opacity:0.3}]}>
        <RepeatButton onPress={() => !isCrossed && onMinus(item.id)} onLongAction={() => !isCrossed && onMinus(item.id)} style={[styles.qtyBtn, isCrossed && { borderColor:'#E5E7EB' }]}><Ionicons name="remove" size={16} color={isCrossed ? '#D1D5DB' : undefined} /></RepeatButton>
        {isCrossed ? (
          <Text style={{ width:48, height:32, lineHeight:32, textAlign:'center', fontSize:15, color:'#9CA3AF' }}>{item.qty || 1}</Text>
        ) : (
          <QtyInput value={item.qty || 1} onCommit={(q) => setQty(item.id, q)} />
        )}
        <RepeatButton onPress={() => !isCrossed && onPlus(item.id)} onLongAction={() => !isCrossed && onPlus(item.id)} style={[styles.qtyBtn, isCrossed && { borderColor:'#E5E7EB' }]}><Ionicons name="add" size={16} color={isCrossed ? '#D1D5DB' : undefined} /></RepeatButton>
      </View>

      {/* Nom — barré si crossed */}
      <TouchableOpacity onPress={() => !isCrossed && openEdit(item)} style={{ flex:1, opacity: isCrossed ? 0.4 : 1 }}>
        <Text numberOfLines={1} style={[styles.itemLabel, isCrossed && styles.crossed]}>{item.name}</Text>
      </TouchableOpacity>

      {/* Poubelle — toujours visible */}
      <TouchableOpacity onPress={() => removeOne(item.id)} style={{padding:4, marginLeft:0}}>
        <Ionicons name="trash-outline" size={18} color="#C33" />
      </TouchableOpacity>
      {/* Radio barrer/débarrer — toujours visible et non grisé */}
      <Radio style={{ marginLeft: 2, marginRight: 20 }} value={isCrossed} onPress={() => toggleCrossed(item.id)} />
    </View>
    );
  };

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

      <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:GUTTER, marginTop:14 }}>
        {/* Toggle Tout sélectionner / Tout barrer */}
        <View style={{ flexDirection:'row' }}>
          <TouchableOpacity onPress={toggleSelectAll} style={{
            paddingVertical:6, paddingHorizontal:12, alignItems:'center', borderRadius:8, marginRight:8,
            backgroundColor: selectAll ? BRAND : 'transparent',
            borderWidth: selectAll ? 0 : 1.5, borderColor: selectAll ? BRAND : '#D1D5DB'
          }}>
            <Text style={{ fontSize:12, fontWeight:'600', color: selectAll ? '#fff' : '#555' }}>{t('listScreen.selectAll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleStrikeAll} style={{
            paddingVertical:6, paddingHorizontal:12, alignItems:'center', borderRadius:8,
            backgroundColor: strikeAll ? BRAND : 'transparent',
            borderWidth: strikeAll ? 0 : 1.5, borderColor: strikeAll ? BRAND : '#D1D5DB'
          }}>
            <Text style={{ fontSize:12, fontWeight:'600', color: strikeAll ? '#fff' : '#555' }}>{t('listScreen.strikeAll')}</Text>
          </TouchableOpacity>
        </View>

        {/* Bouton supprimer */}
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
          }} style={{ marginLeft:'auto', flexDirection:'row', alignItems:'center',
            paddingVertical:6, paddingHorizontal:12, borderRadius:8, backgroundColor:'#FEE2E2' }}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={{ color:'#EF4444', fontWeight:'700', fontSize:12, marginLeft:4 }}>{items.filter(it => it.selected).length}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={{flex:1}}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={visible}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems:'center', justifyContent:'center', paddingTop:200, paddingHorizontal:40 }}>
            <Ionicons name="list-outline" size={56} color="#E5E7EB" />
            <Text style={{ textAlign:'center', marginTop:16, fontSize:16, fontWeight:'600', color:'#374151' }}>{t('listScreen.noItems')}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 160 }}
      />

      <View style={styles.bottomAreaWrap}>
        <View style={styles.switchCenterRow}>
          <Switch value={hideCrossed} onValueChange={setHideCrossed} style={{ transform:[{ scale:0.9 }] }} />
          <Text style={styles.switchLabel}>{t('listScreen.hideStriked')}</Text>
        </View>
        <TouchableOpacity style={styles.bottomBtn} onPress={async ()=>{
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
    <TouchableOpacity onPress={onPress} style={[{paddingVertical:6,paddingHorizontal:10,borderRadius:10,borderWidth:1,borderColor:"#ddd",marginHorizontal:4}, active && {backgroundColor:BRAND,borderColor:BRAND}]}>
      <Text style={[{fontWeight:"500"}, active && {color:"#fff"}]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{flex:1}}>
      {/* Header avec titre + bouton effacer */}
      <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:14, paddingBottom:8}}>
        <Text style={{fontSize:22, fontWeight:'900', color:'#111'}}>{t('tabs.products')}</Text>
        {groups.length > 0 && (
          <TouchableOpacity onPress={async () => {
            await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
            setGroups([]); setSummary({price:0,time:0,shops:0});
            setPopupSelectedItems([]); setCheckedShops({});
            setShowingDefaults(true);
          }} style={{padding:6}}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
      {/* Mode */}
      <View style={{flexDirection:"row",marginHorizontal:16}}>
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
        <Text style={{marginTop:4}}>{t('productsScreen.total')}<Text style={{fontWeight:"700"}}>{fmtPrice(summary.price)}</Text>{t('productsScreen.time')}<Text style={{fontWeight:"700"}}>{summary.time}{t('productsScreen.minutes')}</Text>{t('productsScreen.shops')}<Text style={{fontWeight:"700"}}>{summary.shops}</Text></Text>
      </View>

     
      {/* Bandeau info quand liste vide */}
      {showingDefaults && !loading && (
        <View style={{marginHorizontal:16, marginTop:8, padding:14, borderRadius:12, backgroundColor:'#FEF3C7', flexDirection:'row', alignItems:'center'}}>
          <Ionicons name="information-circle" size={18} color="#F59E0B" style={{marginRight:10}} />
          <Text style={{flex:1, fontSize:13, color:'#92400E'}}>{t('productsScreen.defaultProducts') || 'Ajoutez des articles dans Ma Liste puis appuyez sur "Trouver produits exacts" pour voir les résultats ici.'}</Text>
        </View>
      )}

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
                const wasChecked = !!checkedShops[index];
                setCheckedShops(prev=>({...prev,[index]:!wasChecked}));
                setPopupSelectedItems(prev => prev.map(si => si.shopIndex === index ? {...si, checked: !wasChecked} : si));
              }}
              style={{backgroundColor:"#fff",padding:16,marginVertical:8,marginHorizontal:16,borderRadius:12,shadowColor:"#000",shadowOpacity:0.05,shadowRadius:5,
                borderWidth: checkedShops[index] ? 2 : 0, borderColor: checkedShops[index] ? BRAND : "transparent"
              }}>
              <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                <View style={{flexDirection:"row",alignItems:"center",flex:1}}>
                  <Square value={!!checkedShops[index]} onPress={()=>{
                    const wasChecked = !!checkedShops[index];
                    setCheckedShops(prev=>({...prev,[index]:!wasChecked}));
                    setPopupSelectedItems(prev => prev.map(si => si.shopIndex === index ? {...si, checked: !wasChecked} : si));
                  }} />
                  <Text style={{fontWeight:"bold",fontSize:16,marginLeft:popupSelectedItems.length > 0 ? 10 : 0}}>{item?.name||t('productsScreen.defaultShop')}</Text>
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
              {mode==="delivery" ? <Text style={{color:"#666",marginTop:6}}>{t('productsScreen.deliveryFee')}{fmtPrice(item?.deliveryFee||0)}</Text> : null}

              {/* Display original products with quantity controls */}
              {(Array.isArray(item?.products)?item.__renderItems:[]).map((p,i)=>(
                <View key={i} style={{marginTop:12}}>
                  <View style={{flexDirection:"row",alignItems:"center"}}>
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
                      return <><Text style={{fontSize:14,fontWeight:"800",color:qtyColor,marginRight:6}}>x{needed}</Text>
                    <Text numberOfLines={1} style={{flex:1,fontSize:15,fontWeight:"600",color:"#111",marginRight:10}}>{String(p?.title||'')}</Text>
                    {isMatched ? (
                      <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#ECFDF5',paddingHorizontal:10,paddingVertical:6,borderRadius:6}}>
                        <Ionicons name="checkmark-circle" size={14} color={BRAND} style={{marginRight:4}} />
                        <Text style={{color:BRAND,fontWeight:"700",fontSize:13}}>{t('cart.added') || 'Ajouté'}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={{backgroundColor:BRAND,paddingHorizontal:10,paddingVertical:6,borderRadius:6}} onPress={()=>{ __setActiveQuery(String(p?.title||p?.name||''));  __setInitialQuery(String(p?.title||p?.name||"")); __setActiveShopName(String(item?.name||'')); __setActiveShopIndex(index); __setSearchVisible(true); }}><Text style={{color:"#fff",fontWeight:"600",fontSize:13}}>{t('productsScreen.search')}</Text></TouchableOpacity>
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
                            <View style={{flexDirection:"row",alignItems:"center",marginTop:4}}>
                              <Text style={{fontSize:16,fontWeight:"800",color:"#111"}}>{fmtPrice(selectedItem.price)}</Text>
                              {selectedItem.unitPrice && <Text style={{fontSize:11,color:"#9CA3AF",marginLeft:6}}>{selectedItem.unitPrice}</Text>}
                              <TouchableOpacity onPress={() => toggleProductFav(selectedItem)} style={{marginLeft:8}}>
                                <Ionicons name={favProductNames.has(selectedItem.name) ? "heart" : "heart-outline"} size={18} color={favProductNames.has(selectedItem.name) ? "#EF4444" : "#9CA3AF"} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={{flexDirection:"row",alignItems:"center",marginLeft:"auto"}}>
                            {(selectedItem.qty || 1) <= 1 ? (
                              <TouchableOpacity
                                onPress={() => setPopupSelectedItems(prev => prev.filter(si => si.id !== selectedItem.id))}
                                style={{width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:"#EF4444",alignItems:"center",justifyContent:"center"}}
                              >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            ) : (
                              <RepeatButton
                                onPress={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: (si.qty || 1) - 1} : si))}
                                onLongAction={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: Math.max(1, (si.qty || 1) - 1)} : si))}
                                style={{width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:"#D1D5DB",alignItems:"center",justifyContent:"center"}}
                              >
                                <Ionicons name="remove" size={14} color="#555" />
                              </RepeatButton>
                            )}
                            <Text style={{fontSize:15,fontWeight:"700",color:"#111",marginHorizontal:6,minWidth:18,textAlign:"center"}}>{selectedItem.qty || 1}</Text>
                            <RepeatButton
                              onPress={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: (si.qty || 1) + 1} : si))}
                              onLongAction={() => setPopupSelectedItems(prev => prev.map(si => si.id === selectedItem.id ? {...si, qty: (si.qty || 1) + 1} : si))}
                              style={{width:28,height:28,borderRadius:14,backgroundColor:BRAND,alignItems:"center",justifyContent:"center"}}
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
                    onPress={() => { __setActiveQuery(''); __setInitialQuery(''); __setActiveShopName(String(item?.name||'')); __setActiveShopIndex(index); __setSearchVisible(true); }}
                    style={{marginTop:10, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:BRAND, borderStyle:'dashed'}}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={BRAND} style={{marginRight:6}} />
                    <Text style={{color:BRAND, fontWeight:'600', fontSize:14}}>{t('productsScreen.addProduct') || 'Ajouter un produit'}</Text>
                  </TouchableOpacity>

                  <View style={{marginTop:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                    <Text style={{fontSize:15,fontWeight:"700",color:"#374151"}}>{t('productsScreen.productsTotal')}</Text>
                    <Text style={{fontSize:15,fontWeight:"700",color:"#374151"}}>{shopSelected.length} ({liveQty} {t('productsScreen.quantity') || 'quantité'})</Text>
                  </View>
                  <View style={{marginTop:6,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                    <Text style={{fontSize:15,fontWeight:"700", color:"#111"}}>{t('cart.total') + ' ' + t('cart.totalPrice', {defaultValue: 'prix'})}</Text>
                    <Text style={{fontWeight:"700", fontSize:15, color:BRAND}}>{fmtPrice(liveTotal)}</Text>
                  </View>
                  {mode==="delivery" ? (
                    <View style={{marginTop:4,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                      <Text style={{color:"#444"}}>{t('productsScreen.totalWithDelivery')}</Text>
                      <Text style={{fontWeight:"700"}}>{fmtPrice(liveTotalWithDelivery)}</Text>
                    </View>
                  ) : null}
                </>;
              })()}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{flex:1, alignItems:'center', justifyContent:'center', paddingTop:80, paddingHorizontal:40}}>
              <Ionicons name="cart-outline" size={56} color="#E5E7EB" />
              <Text style={{textAlign:"center", marginTop:16, fontSize:16, fontWeight:'600', color:"#374151"}}>{t('productsScreen.addFromList') || 'Ajoutez des produits dans Ma Liste'}</Text>
              <Text style={{textAlign:"center", marginTop:8, fontSize:13, color:"#9CA3AF"}}>{t('productsScreen.addFromListSub') || 'Puis appuyez sur "Trouver produits exacts"'}</Text>
            </View>
          }
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
                // Ajouter tous les produits des shops cochés
                popupSelectedItems.forEach(si => {
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
                  setConfirmCartItems(merged);
                  setConfirmCartVisible(true);
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
              {t('cart.addToCart')} ({Object.values(checkedShops).filter(v=>v).length} {Object.values(checkedShops).filter(v=>v).length>1 ? t('common.shops') : t('common.shop')})
            </Text>
          </TouchableOpacity>
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
  );
};
const KEY_FAV_PRODUCTS = "KEY_FAV_PRODUCTS";

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
          <Text style={{ color: '#6B7280', marginTop: 4 }}>N° {orderNumber}</Text>
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
      // Auto-sélectionner tous les produits
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
                  {group.items.reduce((s, it) => s + Number(it.qty || 1), 0)} {t('productsScreen.quantity')} • {fmtPrice(group.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0))}
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
                  <TouchableOpacity onPress={() => { setTempAddress(deliveryAddress); setTempInfo(deliveryInfo); setAddressSuggestions([]); setEditingAddress(true); }}>
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
                        onPress={() => { setDeliveryAddress(tempAddress); setDeliveryInfo(tempInfo); setEditingAddress(false); setAddressSuggestions([]); }}
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

              {/* Créneau de livraison */}
              <View style={{marginTop:12}}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom:14}}>
                  <View style={{width:32, height:32, borderRadius:16, backgroundColor:'#F0FDF4', alignItems:'center', justifyContent:'center'}}>
                    <Ionicons name="time-outline" size={18} color={BRAND} />
                  </View>
                  <Text style={{fontSize:15, fontWeight:'700', color:'#111', marginLeft:10}}>{t('cart.deliverySlot')}</Text>
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

              {/* Total + résumé créneau */}
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
                  setOrderVisible(true);
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
                {/* Résumé produits ajoutés */}
                {(() => {
                  const added = cartItems.filter(it => (it.shop || '__other__') === addProductShop && (it._addQty || 0) > 0);
                  if (added.length === 0) return null;
                  return (
                    <View style={{paddingHorizontal:20, paddingTop:10, paddingBottom:4}}>
                      <Text style={{fontSize:13, fontWeight:'700', color:'#111', marginBottom:4}}>{added.length} {t('cart.productsSelected', {count: added.length})}</Text>
                      {added.map((it, i) => (
                        <Text key={i} style={{fontSize:12, color:'#6B7280'}}>• {it.name || it.title} x{it._addQty}</Text>
                      ))}
                    </View>
                  );
                })()}
                {/* Bouton Ajouter en bas */}
                <View style={{paddingHorizontal:20, paddingTop:8}}>
                  <TouchableOpacity
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
              deliveryStatus: orderMode === 'delivery' ? DELIVERY_STATUS.PENDING : null,
            };
            history.unshift(order);
            await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(history));

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
    </SafeAreaView>
  );
};

function MainNavigator({ onLogout }) {
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
      <Tab.Screen name="cart"  component={CartScreen} />
      <Tab.Screen name="favorites" component={FavoritesScreen} />
      <Tab.Screen name="profile">{() => <FakeProfileScreen onLogout={onLogout} />}</Tab.Screen>
    </Tab.Navigator>
  );
}

function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = React.useState(true);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pseudo, setPseudo] = React.useState('');
  const [prenom, setPrenom] = React.useState('');
  const [nom, setNom] = React.useState('');
  const [error, setError] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [forgotVisible, setForgotVisible] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotMsg, setForgotMsg] = React.useState('');
  const [forgotError, setForgotError] = React.useState('');

  const [loading, setLoading] = React.useState(false);

  const handleForgotPassword = async () => {
    setForgotError(''); setForgotMsg('');
    if (!forgotEmail.trim()) { setForgotError(t('auth.errorEmailRequired')); return; }
    try {
      // Try Marketplace API first
      const result = await apiForgotPassword(forgotEmail.trim());
      if (result.status) {
        setForgotMsg(t('auth.successPasswordSent') + forgotEmail.trim());
        return;
      }
      // Fallback to local accounts
      const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      const accounts = raw ? JSON.parse(raw) : [];
      const idx = accounts.findIndex(a => a.email.toLowerCase() === forgotEmail.trim().toLowerCase());
      if (idx < 0) { setForgotError(result.message || t('auth.errorNoAccount')); return; }
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let newPwd = '';
      for (let i = 0; i < 8; i++) newPwd += chars[Math.floor(Math.random() * chars.length)];
      accounts[idx].password = newPwd;
      await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
      setForgotMsg(t('auth.successPasswordSent') + forgotEmail.trim());
      Alert.alert(t('auth.newPassword'), t('auth.newPasswordMsg') + newPwd + '\n\n' + t('auth.noteBeforeClosing'));
    } catch(e) { setForgotError(t('auth.errorRetry')); }
  };

  // Init default account on first load
  React.useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      if (!raw) {
        const accounts = [DEFAULT_ACCOUNT];
        await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
      }
    })();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) { setError(t('auth.errorEmpty')); return; }
    setLoading(true);
    try {
      // Try Marketplace API login first
      const result = await loginUser(email.trim(), password);
      if (result.success) {
        // Initialize empty lists for the user
        await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
        setLoading(false);
        onLogin();
        return;
      }
      // Fallback to local accounts if API fails
      const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      const accounts = raw ? JSON.parse(raw) : [];
      const input = email.trim().toLowerCase();
      const found = accounts.find(a => (a.email.toLowerCase() === input || (a.pseudo && a.pseudo.toLowerCase() === input)) && a.password === password);
      if (!found) { setError(result.message || t('auth.errorLoginFailed')); setLoading(false); return; }
      const userKey = 'USER_' + found.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await AsyncStorage.setItem(KEY_AUTH, JSON.stringify({...found, userKey}));
      const savedData = await AsyncStorage.getItem(userKey + '_DATA');
      if (savedData) {
        const data = JSON.parse(savedData);
        if (data.profile) await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(data.profile));
        if (data.items) await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify(data.items));
        if (data.cart) await AsyncStorage.setItem(KEY_CART, JSON.stringify(data.cart));
        if (data.orders) await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(data.orders));
        if (data.favShops) await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify(data.favShops));
        if (data.favs) await AsyncStorage.setItem(KEY_FAVS, JSON.stringify(data.favs));
        await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify(data.selected || []));
      } else {
        await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify({ pseudo: found.pseudo, prenom: found.prenom, nom: found.nom, email: found.email, photo: null }));
        await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_FAVS, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
      }
      setLoading(false);
      onLogin();
    } catch(e) {
      setError(t('auth.errorRetry'));
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!email.trim() || !password.trim() || !pseudo.trim() || !prenom.trim() || !nom.trim()) { setError(t('auth.errorEmpty')); return; }
    if (password.length < 6) { setError(t('auth.errorPasswordLength')); return; }
    setLoading(true);
    try {
      // Try Marketplace API registration first
      const result = await registerUser({
        username: pseudo.trim(),
        email: email.trim(),
        password,
        firstName: prenom.trim(),
        lastName: nom.trim(),
      });
      if (result.success) {
        await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify([]));
        await AsyncStorage.setItem(KEY_FAVS, JSON.stringify([]));
        setLoading(false);
        onLogin();
        return;
      }
      // Fallback to local accounts
      const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      const accounts = raw ? JSON.parse(raw) : [];
      if (accounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase())) { setError(t('auth.errorEmailExists')); setLoading(false); return; }
      if (accounts.find(a => a.pseudo && a.pseudo.toLowerCase() === pseudo.trim().toLowerCase())) { setError(t('auth.errorPseudoTaken')); setLoading(false); return; }
      const newAccount = { pseudo: pseudo.trim(), prenom: prenom.trim(), nom: nom.trim(), email: email.trim(), password };
      accounts.push(newAccount);
      await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
      const userKey = 'USER_' + newAccount.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await AsyncStorage.setItem(KEY_AUTH, JSON.stringify({...newAccount, userKey}));
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify({ pseudo: newAccount.pseudo, prenom: newAccount.prenom, nom: newAccount.nom, email: newAccount.email, photo: null }));
      await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
      await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
      await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
      await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify([]));
      await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify([]));
      await AsyncStorage.setItem(KEY_FAVS, JSON.stringify([]));
      setLoading(false);
      onLogin();
    } catch(e) {
      setError(t('auth.errorRetry'));
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
      <ScrollView contentContainerStyle={{flexGrow:1, justifyContent:'center', paddingHorizontal:24}} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={{alignItems:'center', marginBottom:32}}>
          <View style={{width:80, height:80, borderRadius:40, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', marginBottom:16}}>
            <Ionicons name="cart" size={40} color="#fff" />
          </View>
          <Text style={{fontSize:28, fontWeight:'900', color:'#111'}}>Smart Grocery</Text>
          <Text style={{fontSize:14, color:'#6B7280', marginTop:4}}>{isLogin ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={{backgroundColor:'#FEE2E2', borderRadius:10, padding:12, marginBottom:16, flexDirection:'row', alignItems:'center'}}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={{color:'#EF4444', fontSize:13, marginLeft:8, flex:1}}>{error}</Text>
          </View>
        ) : null}

        {/* Signup fields */}
        {!isLogin && (
          <>
            <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('profile.pseudo')}</Text>
            <TextInput value={pseudo} onChangeText={setPseudo} placeholder={t('profile.pseudoPlaceholder')}
              style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />
            <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('profile.firstName')}</Text>
            <TextInput value={prenom} onChangeText={setPrenom} placeholder={t('profile.firstNamePlaceholder')}
              style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />
            <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('profile.lastName')}</Text>
            <TextInput value={nom} onChangeText={setNom} placeholder={t('profile.lastNamePlaceholder')}
              style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />
          </>
        )}

        {/* Email / Pseudo */}
        <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{isLogin ? t('auth.emailOrPseudo') : t('profile.email')}</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder={isLogin ? t('auth.emailOrPseudoPlaceholder') : t('auth.emailPlaceholder')} keyboardType={isLogin ? "default" : "email-address"} autoCapitalize="none"
          style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />

        {/* Password */}
        <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('auth.password')}</Text>
        <View style={{flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, marginBottom:20}}>
          <TextInput value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} secureTextEntry={!showPwd}
            style={{flex:1, padding:14, fontSize:15, color:'#111'}} />
          <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{paddingRight:14}}>
            <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Forgot password link */}
        {isLogin && (
          <TouchableOpacity onPress={() => { setForgotEmail(''); setForgotMsg(''); setForgotError(''); setForgotVisible(true); }} style={{alignSelf:'flex-end', marginBottom:16, marginTop:-8}}>
            <Text style={{color:BRAND, fontSize:13, fontWeight:'600'}}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
        )}

        {/* Button */}
        <TouchableOpacity onPress={isLogin ? handleLogin : handleSignup} disabled={loading}
          style={{height:52, borderRadius:14, backgroundColor: loading ? '#9CA3AF' : BRAND, alignItems:'center', justifyContent:'center', marginBottom:16}}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{isLogin ? t('auth.loginBtn') : t('auth.signupBtn')}</Text>
          )}
        </TouchableOpacity>

        {/* Switch */}
        <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(''); }} style={{alignItems:'center', paddingVertical:8}}>
          <Text style={{color:'#6B7280', fontSize:14}}>
            {isLogin ? t('auth.noAccount') + ' ' : t('auth.hasAccount') + ' '}
            <Text style={{color:BRAND, fontWeight:'700'}}>{isLogin ? t('auth.signupBtn') : t('auth.loginBtn')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={forgotVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24}}>
          <View style={{backgroundColor:'#fff', borderRadius:16, padding:20}}>
            <View style={{flexDirection:'row', alignItems:'center', marginBottom:16}}>
              <Text style={{fontSize:18, fontWeight:'800', color:'#111', flex:1}}>{t('auth.forgotPassword')}</Text>
              <TouchableOpacity onPress={() => setForgotVisible(false)}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={{fontSize:13, color:'#6B7280', marginBottom:12}}>
              {t('auth.forgotPasswordMsg')}
            </Text>

            {forgotError ? (
              <View style={{backgroundColor:'#FEE2E2', borderRadius:8, padding:10, marginBottom:12, flexDirection:'row', alignItems:'center'}}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={{color:'#EF4444', fontSize:12, marginLeft:6}}>{forgotError}</Text>
              </View>
            ) : null}
            {forgotMsg ? (
              <View style={{backgroundColor:'#D1FAE5', borderRadius:8, padding:10, marginBottom:12, flexDirection:'row', alignItems:'center'}}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={{color:'#059669', fontSize:12, marginLeft:6}}>{forgotMsg}</Text>
              </View>
            ) : null}

            <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('profile.email')}</Text>
            <TextInput value={forgotEmail} onChangeText={setForgotEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none"
              style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, fontSize:15, marginBottom:16, color:'#111'}} />

            <TouchableOpacity onPress={handleForgotPassword} style={{
              height:48, borderRadius:10, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', marginBottom:10
            }}>
              <Text style={{color:'#fff', fontWeight:'700', fontSize:15}}>{t('auth.send')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setForgotVisible(false)} style={{alignItems:'center', paddingVertical:8}}>
              <Text style={{color:'#6B7280', fontSize:14}}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const useCurrency = () => React.useContext(CurrencyContext);

export default function App() {
  const [isAuth, setIsAuth] = React.useState(null); // null = loading, true/false
  const [currency, setCurrencyState] = React.useState(CURRENCIES[0]);
  const [liveRates, setLiveRates] = React.useState(null);

  // === ONE-TIME RESET: clear everything except profile — remove this block after first launch ===
  React.useEffect(() => {
    (async () => {
      const didReset = await AsyncStorage.getItem('__RESET_V2__');
      if (!didReset) {
        // Keep: KEY_PROFILE, KEY_AUTH, KEY_ACCOUNTS, APP_CURRENCY, MARKETPLACE_TOKENS
        const keysToDelete = [KEY_ITEMS, KEY_SELECTED, KEY_CART, KEY_ORDER_HISTORY, KEY_FAV_SHOPS, KEY_FAVS];
        await Promise.all(keysToDelete.map(k => AsyncStorage.removeItem(k)));
        await AsyncStorage.setItem('__RESET_V2__', '1');
        console.log('[RESET] Data cleared (profile kept)');
      }
    })();
  }, []);
  // === END RESET ===

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
    const updated = getCurrencyWithLiveRate(cur, liveRates || _liveRates);
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
          const updated = getCurrencyWithLiveRate(found, _liveRates);
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

  if (!isAuth) {
    return (
      <CurrencyContext.Provider value={{ currency, setCurrency, fmtPrice }}>
        <AuthScreen onLogin={() => setIsAuth(true)} />
      </CurrencyContext.Provider>
    );
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, fmtPrice }}>
      <NavigationContainer theme={navTheme}>
        <MainNavigator onLogout={() => setIsAuth(false)} />
      </NavigationContainer>
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
  qtyInput:{ width:48, height:32, borderWidth:1, borderColor:"#E5E7EB", borderRadius:8, textAlign:"center", fontSize:15, marginHorizontal:4 },

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

function FakeProfileScreen({ onLogout }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const { currency, setCurrency, fmtPrice } = useCurrency();
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
  const [langVisible, setLangVisible] = React.useState(false);
  const [pendingLang, setPendingLang] = React.useState(null);
  const [currencyVisible, setCurrencyVisible] = React.useState(false);
  const [pendingCurrency, setPendingCurrency] = React.useState(null);
  const [addressVisible, setAddressVisible] = React.useState(false);
  const [editAddress, setEditAddress] = React.useState('');
  const [editAddressSupplement, setEditAddressSupplement] = React.useState('');
  const [editCity, setEditCity] = React.useState('');
  const [editPostalCode, setEditPostalCode] = React.useState('');
  const [editCountry, setEditCountry] = React.useState('');

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

  useFocusEffect(React.useCallback(() => { loadProfile(); loadOrders(); }, [loadProfile, loadOrders]));

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

  const saveAddress = async () => {
    const updated = { ...profile, address: editAddress.trim(), addressSupplement: editAddressSupplement.trim(), city: editCity.trim(), postalCode: editPostalCode.trim(), country: editCountry.trim() };
    setProfile(updated);
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    setAddressVisible(false);
  };

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

  const initials = (profile.prenom?profile.prenom[0]:'') + (profile.nom?profile.nom[0]:'');

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
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111', marginBottom:4 }}>{profile.pseudo || t('profile.pseudo')}</Text>

          <TouchableOpacity onPress={() => { setEditNom(profile.nom); setEditPrenom(profile.prenom); setEditPseudo(profile.pseudo||''); setEditEmail(profile.email||''); setShowPwdChange(false); setPwdError(''); setPwdSuccess(''); setEditVisible(true); }} style={{
            marginTop:6, paddingHorizontal:20, paddingVertical:10, borderRadius:10,
            backgroundColor:'#00C29B'
          }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Order History */}
        <View style={{ paddingHorizontal:16 }}>
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111', marginBottom:12 }}>
            {t('profile.orderHistory')}
          </Text>

          {orders.length === 0 ? (
            <View style={{ backgroundColor:'#fff', borderRadius:12, padding:24, alignItems:'center' }}>
              <Ionicons name="receipt-outline" size={40} color="#E5E7EB" />
              <Text style={{ color:'#9CA3AF', marginTop:8 }}>{t('profile.noOrders')}</Text>
            </View>
          ) : (
            <>
              {orders.slice(0,3).map((order) => {
                const status = getOrderStatus(order);
                return (
                <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => setDetailOrder(order)}
                  style={{ backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10,
                    shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
                  }}>
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <View style={{ width:36, height:36, borderRadius:18, backgroundColor: '#D1FAE5',
                      alignItems:'center', justifyContent:'center', marginRight:10, flexShrink:0 }}>
                      <Ionicons name={status.icon} size={18} color={status.color} />
                    </View>
                    <View style={{flex:1}}>
                      <Text style={{ fontWeight:'700', color:'#111' }} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                      <View style={{ flexDirection:'row', alignItems:'center', marginTop:3 }}>
                        <View style={{ width:8, height:8, borderRadius:4, backgroundColor: status.color, marginRight:6 }} />
                        <Text style={{ fontSize:12, fontWeight:'600', color: status.color }}>{status.label}</Text>
                      </View>
                      {(order.shops && order.shops.length > 0) ? (
                        <Text style={{ fontSize:12, color:'#374151', marginTop:2 }} numberOfLines={1}>{order.shops.join(', ')}</Text>
                      ) : null}
                      <Text style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{fmtDate(order.date)}</Text>
                    </View>
                    <View style={{ alignItems:'flex-end', marginLeft:10, flexShrink:0 }}>
                      <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:6, marginBottom:4,
                        backgroundColor:'#D1FAE5' }}>
                        <Text style={{ fontSize:10, fontWeight:'700', color:'#059669' }}>
                          {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                        </Text>
                      </View>
                      <Text style={{ fontWeight:'800', color:'#00C29B', fontSize:15 }}>
                        {fmtPrice(order.total||0)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{marginTop:4}} />
                    </View>
                  </View>
                </TouchableOpacity>
                );
              })}
              {orders.length > 0 && (
                <TouchableOpacity onPress={() => setAllOrdersVisible(true)} style={{
                  paddingVertical:12, borderRadius:10, backgroundColor:'#111', alignItems:'center', marginTop:4
                }}>
                  <Text style={{ color:'#fff', fontWeight:'700', fontSize:14 }}>{t('profile.openAllHistory')} ({orders.length})</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Address Button */}
        <View style={{ paddingHorizontal:16, marginTop:8, marginBottom:4 }}>
          <TouchableOpacity onPress={() => { setEditAddress(profile.address||''); setEditAddressSupplement(profile.addressSupplement||''); setEditCity(profile.city||''); setEditPostalCode(profile.postalCode||''); setEditCountry(profile.country||''); setAddressVisible(true); }} style={{
            flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            backgroundColor:'#fff', borderRadius:12, padding:14,
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
          }}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Ionicons name="location-outline" size={20} color="#00C29B" style={{ marginRight:10 }} />
              <Text style={{ fontSize:15, fontWeight:'600', color:'#111' }}>{t('profile.deliveryAddress')}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Text style={{ fontSize:14, color:'#6B7280', marginRight:6 }} numberOfLines={1}>
                {profile.address ? (profile.address.length > 20 ? profile.address.substring(0,20)+'…' : profile.address) : t('profile.noAddress')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Language Button */}
        <View style={{ paddingHorizontal:16, marginTop:4, marginBottom:4 }}>
          <TouchableOpacity onPress={() => setLangVisible(true)} style={{
            flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            backgroundColor:'#fff', borderRadius:12, padding:14,
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
          }}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Ionicons name="language-outline" size={20} color="#00C29B" style={{ marginRight:10 }} />
              <Text style={{ fontSize:15, fontWeight:'600', color:'#111' }}>{t('profile.language')}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Text style={{ fontSize:14, color:'#6B7280', marginRight:6 }}>
                {({'fr':'Français','en':'English','es':'Español','zh':'中文','ar':'العربية','de':'Deutsch','nl':'Nederlands','it':'Italiano','pt':'Português','ja':'日本語','th':'ไทย','sv':'Svenska','ru':'Русский'})[i18nInstance.language] || i18nInstance.language}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Currency Button */}
        <View style={{ paddingHorizontal:16, marginBottom:8 }}>
          <TouchableOpacity onPress={() => setCurrencyVisible(true)} style={{
            flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            backgroundColor:'#fff', borderRadius:12, padding:14,
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
          }}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Text style={{ fontSize:20, marginRight:10 }}>💱</Text>
              <Text style={{ fontSize:15, fontWeight:'600', color:'#111' }}>{t('profile.currency')}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Text style={{ fontSize:14, color:'#6B7280', marginRight:6 }}>
                {currency.flag} {currency.code}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Disconnect Button */}
        <View style={{ paddingHorizontal:16, marginTop:16, marginBottom:0 }}>
          <TouchableOpacity onPress={() => {
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
                // Nettoyer les données courantes
                await AsyncStorage.removeItem(KEY_AUTH);
                // Logout from Marketplace API
                try { await logoutUser(); } catch(e) {}
                await AsyncStorage.removeItem(KEY_PROFILE);
                await AsyncStorage.removeItem(KEY_ORDER_HISTORY);
                await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
                await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
                await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
                await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify([]));
                await AsyncStorage.setItem(KEY_FAVS, JSON.stringify([]));
                if (onLogout) onLogout();
              }}
            ]);
          }} style={{
            paddingVertical:14, borderRadius:12,
            backgroundColor:'#EF4444', alignItems:'center', flexDirection:'row', justifyContent:'center'
          }}>
            <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight:8 }} />
            <Text style={{ fontSize:16, fontWeight:'700', color:'#fff' }}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Full Page Modal */}
      <Modal visible={editVisible} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={{ marginRight:12 }}>
                <Ionicons name="arrow-back" size={24} color="#111" />
              </TouchableOpacity>
              <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.editProfile')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding:20 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.pseudo')}</Text>
              <TextInput value={editPseudo} onChangeText={setEditPseudo} placeholder={t('profile.pseudoPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.firstName')}</Text>
              <TextInput value={editPrenom} onChangeText={setEditPrenom} placeholder={t('profile.firstNamePlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.lastName')}</Text>
              <TextInput value={editNom} onChangeText={setEditNom} placeholder={t('profile.lastNamePlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.email')}</Text>
              <TextInput value={editEmail} onChangeText={setEditEmail} placeholder={t('profile.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none"
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              {/* Password change section */}
              {!showPwdChange ? (
                <TouchableOpacity onPress={() => { setShowPwdChange(true); setPwdError(''); setPwdSuccess(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  style={{ flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:16, borderRadius:10, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', marginBottom:24 }}>
                  <Ionicons name="lock-closed-outline" size={18} color="#00C29B" />
                  <Text style={{ fontSize:15, fontWeight:'600', color:'#111', marginLeft:10, flex:1 }}>{t('profile.changePassword')}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <View style={{ backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'#E5E7EB', padding:16, marginBottom:24 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:14 }}>
                    <Ionicons name="lock-closed-outline" size={18} color="#00C29B" />
                    <Text style={{ fontSize:15, fontWeight:'700', color:'#111', marginLeft:8, flex:1 }}>{t('profile.changePassword')}</Text>
                    <TouchableOpacity onPress={() => setShowPwdChange(false)}>
                      <Ionicons name="close" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  {pwdError ? (
                    <View style={{ backgroundColor:'#FEE2E2', borderRadius:8, padding:10, marginBottom:12, flexDirection:'row', alignItems:'center' }}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={{ color:'#EF4444', fontSize:12, marginLeft:6 }}>{pwdError}</Text>
                    </View>
                  ) : null}
                  {pwdSuccess ? (
                    <View style={{ backgroundColor:'#D1FAE5', borderRadius:8, padding:10, marginBottom:12, flexDirection:'row', alignItems:'center' }}>
                      <Ionicons name="checkmark-circle" size={16} color="#059669" />
                      <Text style={{ color:'#059669', fontSize:12, marginLeft:6 }}>{pwdSuccess}</Text>
                    </View>
                  ) : null}

                  <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.oldPassword')}</Text>
                  <TextInput value={oldPassword} onChangeText={setOldPassword} placeholder={t('profile.currentPasswordPlaceholder')} secureTextEntry
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:12, fontSize:15, backgroundColor:'#F8FAFC' }} />

                  <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.newPassword')}</Text>
                  <TextInput value={newPassword} onChangeText={setNewPassword} placeholder={t('profile.newPassword')} secureTextEntry
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:12, fontSize:15, backgroundColor:'#F8FAFC' }} />

                  <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.confirmPassword')}</Text>
                  <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('profile.confirmPassword')} secureTextEntry
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:14, fontSize:15, backgroundColor:'#F8FAFC' }} />

                  <TouchableOpacity onPress={handleChangePassword} style={{
                    paddingVertical:12, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center'
                  }}>
                    <Text style={{ fontWeight:'700', color:'#fff', fontSize:15 }}>{t('profile.validate')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ flexDirection:'row' }}>
                <TouchableOpacity onPress={() => setEditVisible(false)} style={{
                  flex:1, paddingVertical:14, borderRadius:10, borderWidth:1, borderColor:'#E5E7EB',
                  alignItems:'center', marginRight:8, backgroundColor:'#fff'
                }}>
                  <Text style={{ fontWeight:'600', color:'#6B7280' }}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveProfile} style={{
                  flex:1, paddingVertical:14, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center'
                }}>
                  <Text style={{ fontWeight:'700', color:'#fff' }}>{t('profile.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Language Selector Full Page Modal */}
      <Modal visible={langVisible} animationType="slide" onShow={() => setPendingLang(null)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
            <TouchableOpacity onPress={() => { setPendingLang(null); setLangVisible(false); }} style={{ marginRight:12 }}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.language')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
            {LANGUAGES.map(lang => {
              const currentLang = i18nInstance.language || 'fr';
              const isActive = currentLang === lang.code || currentLang.startsWith(lang.code);
              const isSelected = pendingLang === lang.code || (!pendingLang && isActive);
              return (
                <TouchableOpacity key={lang.code} onPress={() => setPendingLang(lang.code)} style={{
                  flexDirection:'row', alignItems:'center', backgroundColor: isSelected ? '#E0F7F1' : '#fff',
                  borderRadius:12, padding:16, marginBottom:8,
                  borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? '#00C29B' : '#E5E7EB'
                }}>
                  <Text style={{ fontSize:24, marginRight:14 }}>{lang.flag}</Text>
                  <Text style={{ fontSize:16, fontWeight: isSelected ? '800' : '500', color: isSelected ? '#00C29B' : '#111', flex:1 }}>{lang.label}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="#00C29B" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor:'#F8FAFC' }}>
            <View style={{ paddingHorizontal:16, paddingVertical:12 }}>
              <TouchableOpacity onPress={async () => {
                const lang = pendingLang || i18nInstance.language;
                i18nInstance.changeLanguage(lang);
                await AsyncStorage.setItem('APP_LANGUAGE', lang);
                setPendingLang(null);
                setLangVisible(false);
              }} style={{
                height:50, borderRadius:14, backgroundColor: pendingLang ? '#00C29B' : '#9CA3AF',
                alignItems:'center', justifyContent:'center'
              }}>
                <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Currency Selector Full Page Modal */}
      <Modal visible={currencyVisible} animationType="slide" onShow={() => setPendingCurrency(null)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
            <TouchableOpacity onPress={() => { setPendingCurrency(null); setCurrencyVisible(false); }} style={{ marginRight:12 }}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.currency')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
            {CURRENCIES.map(curr => {
              const isSelected = pendingCurrency === curr.code || (!pendingCurrency && currency.code === curr.code);
              return (
                <TouchableOpacity key={curr.code} onPress={() => setPendingCurrency(curr.code)} style={{
                  flexDirection:'row', alignItems:'center', backgroundColor: isSelected ? '#E0F7F1' : '#fff',
                  borderRadius:12, padding:16, marginBottom:8,
                  borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? '#00C29B' : '#E5E7EB'
                }}>
                  <Text style={{ fontSize:24, marginRight:14 }}>{curr.flag}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize:16, fontWeight: isSelected ? '800' : '500', color: isSelected ? '#00C29B' : '#111' }}>{curr.name}</Text>
                    <Text style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{curr.code}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="#00C29B" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor:'#F8FAFC' }}>
            <View style={{ paddingHorizontal:16, paddingVertical:12 }}>
              <TouchableOpacity onPress={() => {
                const code = pendingCurrency || currency.code;
                const found = CURRENCIES.find(c => c.code === code);
                if (found) setCurrency(found);
                setPendingCurrency(null);
                setCurrencyVisible(false);
              }} style={{
                height:50, borderRadius:14, backgroundColor: pendingCurrency ? '#00C29B' : '#9CA3AF',
                alignItems:'center', justifyContent:'center'
              }}>
                <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Delivery Address Full Page Modal */}
      <Modal visible={addressVisible} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
              <TouchableOpacity onPress={() => setAddressVisible(false)} style={{ marginRight:12 }}>
                <Ionicons name="arrow-back" size={24} color="#111" />
              </TouchableOpacity>
              <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.deliveryAddress')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding:20 }} keyboardShouldPersistTaps="handled">
              <View style={{ alignItems:'center', marginBottom:24 }}>
                <View style={{ width:60, height:60, borderRadius:30, backgroundColor:'#E0F7F1', alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="location" size={30} color="#00C29B" />
                </View>
              </View>

              <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.street')}</Text>
              <TextInput value={editAddress} onChangeText={setEditAddress} placeholder={t('profile.streetPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.addressSupplement')}</Text>
              <TextInput value={editAddressSupplement} onChangeText={setEditAddressSupplement} placeholder={t('profile.supplementPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <View style={{ flexDirection:'row', gap:12, marginBottom:16 }}>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.postalCode')}</Text>
                  <TextInput value={editPostalCode} onChangeText={setEditPostalCode} placeholder={t('profile.postalCodePlaceholder')} keyboardType="number-pad"
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, fontSize:16, backgroundColor:'#fff' }} />
                </View>
                <View style={{ flex:2 }}>
                  <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.city')}</Text>
                  <TextInput value={editCity} onChangeText={setEditCity} placeholder={t('profile.cityPlaceholder')}
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, fontSize:16, backgroundColor:'#fff' }} />
                </View>
              </View>

              <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.country')}</Text>
              <TextInput value={editCountry} onChangeText={setEditCountry} placeholder={t('profile.countryPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:24, fontSize:16, backgroundColor:'#fff' }} />

              <View style={{ flexDirection:'row' }}>
                <TouchableOpacity onPress={() => setAddressVisible(false)} style={{
                  flex:1, paddingVertical:14, borderRadius:10, borderWidth:1, borderColor:'#E5E7EB',
                  alignItems:'center', marginRight:8, backgroundColor:'#fff'
                }}>
                  <Text style={{ fontWeight:'600', color:'#6B7280' }}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveAddress} style={{
                  flex:1, paddingVertical:14, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center'
                }}>
                  <Text style={{ fontWeight:'700', color:'#fff' }}>{t('profile.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* All Orders Full Page Modal */}
      <Modal visible={allOrdersVisible} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
            <TouchableOpacity onPress={() => setAllOrdersVisible(false)} style={{ marginRight:12 }}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.allOrders')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding:16, paddingBottom:40 }}>
            {orders.map((order) => {
              const status = getOrderStatus(order);
              return (
              <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => { setAllOrdersVisible(false); setTimeout(() => setDetailOrder(order), 300); }}
                style={{ backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10,
                  shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
                }}>
                <View style={{ flexDirection:'row', alignItems:'center' }}>
                  <View style={{ width:36, height:36, borderRadius:18, backgroundColor: '#D1FAE5',
                    alignItems:'center', justifyContent:'center', marginRight:10, flexShrink:0 }}>
                    <Ionicons name={status.icon} size={18} color={status.color} />
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{ fontWeight:'700', color:'#111' }} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                    <View style={{ flexDirection:'row', alignItems:'center', marginTop:3 }}>
                      <View style={{ width:8, height:8, borderRadius:4, backgroundColor: status.color, marginRight:6 }} />
                      <Text style={{ fontSize:12, fontWeight:'600', color: status.color }}>{status.label}</Text>
                    </View>
                    {(order.shops && order.shops.length > 0) ? (
                      <Text style={{ fontSize:12, color:'#374151', marginTop:2 }} numberOfLines={1}>{order.shops.join(', ')}</Text>
                    ) : null}
                    <Text style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{fmtDate(order.date)}</Text>
                  </View>
                  <View style={{ alignItems:'flex-end', marginLeft:10, flexShrink:0 }}>
                    <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:6, marginBottom:4,
                      backgroundColor:'#D1FAE5' }}>
                      <Text style={{ fontSize:10, fontWeight:'700', color:'#059669' }}>
                        {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                      </Text>
                    </View>
                    <Text style={{ fontWeight:'800', color:'#00C29B', fontSize:15 }}>
                      {fmtPrice(order.total||0)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{marginTop:4}} />
                  </View>
                </View>
              </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Order Detail Full Page Modal */}
      <Modal visible={!!detailOrder} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
            <TouchableOpacity onPress={() => setDetailOrder(null)} style={{ marginRight:12 }}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>
              {t('profile.orderNumber')} #{detailOrder ? String(detailOrder.id).slice(-4) : ''}
            </Text>
            {detailOrder && (
              <View style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:8,
                backgroundColor:'#D1FAE5' }}>
                <Text style={{ fontSize:11, fontWeight:'700', color:'#059669' }}>
                  {detailOrder.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                </Text>
              </View>
            )}
          </View>
          {detailOrder && (
            <ScrollView contentContainerStyle={{ padding:20, paddingBottom:40 }}>
              {/* Infos commande */}
              <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:14,
                shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                  <Ionicons name="calendar-outline" size={16} color="#00C29B" />
                  <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{t('profile.orderedOn')}</Text>
                  <Text style={{ fontSize:13, fontWeight:'700', color:'#111', marginLeft:6 }}>{fmtDate(detailOrder.date)}</Text>
                </View>
                {detailOrder.slot ? (
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                    <Ionicons name="time-outline" size={16} color="#00C29B" />
                    <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{detailOrder.mode === 'collect' ? t('cart.collect') : t('cart.delivery')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'700', color:'#111', marginLeft:6 }}>
                      {detailOrder.deliveryDate ? detailOrder.deliveryDate + ', ' : ''}{detailOrder.slot}
                    </Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'delivery' && detailOrder.address ? (
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                    <Ionicons name="home-outline" size={16} color="#00C29B" />
                    <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{t('profile.address')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'700', color:'#111', marginLeft:6, flex:1 }} numberOfLines={2}>{detailOrder.address}</Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'collect' ? (
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                    <Ionicons name="storefront-outline" size={16} color="#00C29B" />
                    <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{t('profile.storePickup')}</Text>
                  </View>
                ) : null}
                {/* Driver info (from Livraison-app) */}
                {detailOrder.mode === 'delivery' && (detailOrder.driverName || deliveryStatuses[detailOrder.id]?.driver_name) ? (
                  <View style={{ backgroundColor:'#F0FDF4', borderRadius:10, padding:12, marginBottom:10, flexDirection:'row', alignItems:'center' }}>
                    <View style={{ width:36, height:36, borderRadius:18, backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                      <Ionicons name="bicycle" size={18} color="#fff" />
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontSize:13, fontWeight:'700', color:'#111' }}>
                        {deliveryStatuses[detailOrder.id]?.driver_name || detailOrder.driverName}
                      </Text>
                      <Text style={{ fontSize:12, color:'#6B7280' }}>
                        {deliveryStatuses[detailOrder.id]?.estimated_arrival || detailOrder.estimatedArrival || t('orderStatus.onTheWay')}
                      </Text>
                    </View>
                    {(deliveryStatuses[detailOrder.id]?.driver_phone || detailOrder.driverPhone) ? (
                      <TouchableOpacity style={{ width:36, height:36, borderRadius:18, backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center' }}>
                        <Ionicons name="call" size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
                {/* Coûts */}
                <View style={{ borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:10, marginTop:2 }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
                    <Text style={{ fontSize:13, color:'#6B7280' }}>{t('profile.subtotal')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'600', color:'#111' }}>{fmtPrice(detailOrder.subtotal != null ? detailOrder.subtotal : (detailOrder.total||0) - (detailOrder.deliveryFee||0))}</Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
                    <Text style={{ fontSize:13, color:'#6B7280' }}>{detailOrder.mode === 'delivery' ? t('profile.deliveryFee') : t('profile.collectFee')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'600', color: (detailOrder.deliveryFee||0) === 0 ? '#00C29B' : '#111' }}>
                      {(detailOrder.deliveryFee||0) === 0 ? t('cart.free') : fmtPrice(detailOrder.deliveryFee||0)}
                    </Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:6, marginTop:4 }}>
                    <Text style={{ fontSize:16, fontWeight:'800', color:'#111' }}>{t('cart.total')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'900', color:'#00C29B' }}>{fmtPrice(detailOrder.total||0)}</Text>
                  </View>
                </View>
              </View>

              {/* Étapes de suivi */}
              <Text style={{ fontSize:16, fontWeight:'800', color:'#111', marginBottom:12 }}>{t('profile.orderTracking')}</Text>
              <OrderSteps mode={detailOrder.mode || 'delivery'} />

              {/* Produits par shop */}
              <Text style={{ fontSize:16, fontWeight:'800', color:'#111', marginBottom:12, marginTop:8 }}>{t('profile.productDetails')}</Text>
              {(() => {
                const byShop = {};
                (detailOrder.items||[]).forEach(it => {
                  const s = it.shop || '__other__';
                  if (!byShop[s]) byShop[s] = [];
                  byShop[s].push(it);
                });
                return Object.entries(byShop).map(([shop, items]) => (
                  <View key={shop} style={{ backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:12,
                    shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                      <Ionicons name="storefront-outline" size={16} color="#00C29B" />
                      <Text style={{ fontSize:15, fontWeight:'700', color:'#111', marginLeft:8 }}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                    </View>
                    {items.map((it, idx) => (
                      <View key={idx} style={{ flexDirection:'row', alignItems:'center', paddingVertical:8,
                        borderTopWidth: idx > 0 ? 1 : 0, borderTopColor:'#F3F4F6' }}>
                        <ProductThumb name={it.name||it.title} size={36} />
                        <View style={{ flex:1, marginLeft:10 }}>
                          <Text style={{ fontSize:14, fontWeight:'600', color:'#374151' }} numberOfLines={1}>{it.name||it.title}</Text>
                          <Text style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{t('cart.qty')}: {it.qty||1} × {fmtPrice((it.price||0))}</Text>
                        </View>
                        <Text style={{ fontWeight:'700', color:'#374151', fontSize:14 }}>
                          {fmtPrice((it.price||0)*(it.qty||1))}
                        </Text>
                      </View>
                    ))}
                  </View>
                ));
              })()}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
