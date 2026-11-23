import React from "react";
import { separerDoublons, cumulerQuantite, ajouterAuPanier, champsCommande } from "../../lib/panier";
import { matchProduct } from "../../lib/matchProduct";
import { loadShops, peekShops, hydrateShops } from "../../lib/shopsCache";
import { libelleDetail } from "../../lib/libelleDetail";
import { useTranslation } from "react-i18next";
import { DeviceEventEmitter } from "react-native";
import SearchPopup from "../../components/SearchPopup";
import Modal from "../../components/DeuxEcrans";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { SqueletteComparer } from "../../components/ui/Squelette";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { loadListItems } from "../../lib/listStore";
import RepeatButton from "../../components/ui/RepeatButton";
import { MARCHE, SERIF, TAILLES } from "../../components/ui/marche";
import { BRAND, THEME } from "../../components/commun/theme";
import { useCurrency } from "../../components/commun/devise";
import { ProductThumb, ProductImage } from "../../components/commun/ProductImage";
import { Square } from "../../components/commun/Coches";
import { KEY_ITEMS, KEY_ACTIVE_LIST, DEFAULT_LIST_ID, listItemsKey, KEY_SELECTED, KEY_CART, KEY_FAV_SHOPS, KEY_FAV_PRODUCTS } from "../../lib/constants";
import { sousCategorie } from "../../lib/sousCategorie";

function __getUserItems(){
  try { if (typeof items !== "undefined" && Array.isArray(items)) return items; } catch(_) {}
  try { if (typeof list !== "undefined" && Array.isArray(list)) return list; } catch(_) {}
  try { if (typeof userItems !== "undefined" && Array.isArray(userItems)) return userItems; } catch(_) {}
  try { if (typeof myList !== "undefined" && Array.isArray(myList)) return myList; } catch(_) {}
  return [];
}

const SEARCH_MAP = require('../../data/search-map.json');

const prodStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: TAILLES.marge, paddingTop: 10, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: SERIF, fontSize: 26, fontWeight: '400', color: THEME.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  clearBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },

  segment: { flexDirection: 'row', marginTop: 16, backgroundColor: THEME.subtle, borderRadius: TAILLES.rayonCarte, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.boutonPetit, borderRadius: 12 },
  segBtnOn: { backgroundColor: THEME.card, ...THEME.shadowSm, borderWidth: 1, borderColor: THEME.border },
  segTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.muted, marginLeft: 6 },
  segTxtOn: { color: THEME.ink },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  chip: { height: TAILLES.boutonPetit, justifyContent: 'center', paddingHorizontal: 14, borderRadius: TAILLES.boutonPetit / 2, marginRight: 8, marginBottom: 8, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  chipOn: { backgroundColor: MARCHE.noir, borderColor: MARCHE.noir },
  chipTxt: { fontSize: 12.5, fontWeight: '700', color: THEME.muted },
  chipTxtOn: { color: MARCHE.blanc },

  summaryCard: { marginTop: 12, marginHorizontal: TAILLES.marge, padding: 14, borderRadius: 16, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: THEME.muted },
  summaryStats: { flexDirection: 'row', marginTop: 10 },
  statBox: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: '600', color: THEME.ink },
  statLabel: { fontSize: 11.5, fontWeight: '600', color: THEME.faint, marginTop: 1 },
  statDivider: { width: 1, backgroundColor: THEME.border, marginHorizontal: 4 },

  infoBanner: { marginHorizontal: TAILLES.marge, marginTop: 10, padding: 14, borderRadius: 16, backgroundColor: THEME.brandSoft, flexDirection: 'row', alignItems: 'center' },
  infoTxt: { flex: 1, fontSize: 13, color: THEME.ink, fontWeight: '600', marginLeft: 10, lineHeight: 18 },

  card: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginHorizontal: TAILLES.marge, marginTop: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  cardOn: { borderColor: THEME.brand, borderWidth: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  shopIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  shopName: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.subtle, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginTop: 2 },
  metaTxt: { fontSize: 12, color: THEME.muted, marginLeft: 4, fontWeight: '600' },
  shopFavBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  feeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  feeTxt: { fontSize: 12.5, color: THEME.muted, fontWeight: '600', marginLeft: 4 },

  productRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.border },
  productLine: { flexDirection: 'row', alignItems: 'center' },
  qtyBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginRight: 8 },
  qtyBadgeTxt: { fontSize: 12.5, fontWeight: '600' },
  productTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: THEME.ink, marginRight: 10 },
  addedTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.terraSoft, paddingHorizontal: 10, height: 32, borderRadius: 16 },
  addedTagTxt: { color: THEME.terraDark, fontWeight: '700', fontSize: 12.5, marginLeft: 4 },
  searchBtn: { borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, paddingHorizontal: 14, height: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  searchBtnTxt: { color: MARCHE.noir, fontWeight: '700', fontSize: 12.5, marginLeft: 4 },

  picked: { marginTop: 10, padding: 12, backgroundColor: THEME.subtle, borderRadius: 16 },
  pickedRow: { flexDirection: 'row', alignItems: 'center' },
  pickedBody: { flex: 1, marginLeft: 10 },
  pickedName: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  pickedDetail: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  pickedPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  pickedPrice: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  pickedUnit: { fontSize: 11, color: THEME.faint, marginLeft: 6, fontWeight: '600' },
  pickedFav: { marginLeft: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, height: 34, paddingHorizontal: 3, borderWidth: 1, borderColor: THEME.border, marginLeft: 'auto' },
  stepBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepBtnAdd: { width: 28, height: 28, borderRadius: 9, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  stepBtnDel: { width: 28, height: 28, borderRadius: 9, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },
  stepQty: { fontSize: 15, fontWeight: '700', color: THEME.ink, marginHorizontal: 6, minWidth: 18, textAlign: 'center' },

  addMoreBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.boutonPetit, borderRadius: TAILLES.boutonPetit / 2, borderWidth: 1, borderColor: THEME.borderInput, borderStyle: 'dashed', backgroundColor: THEME.card },
  addMoreTxt: { color: MARCHE.noir, fontWeight: '700', fontSize: 13.5, marginLeft: 6 },
  totalsBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13.5, fontWeight: '700', color: THEME.muted },
  totalValue: { fontSize: 13.5, fontWeight: '700', color: THEME.ink },
  grandLabel: { fontSize: 15, fontWeight: '600', color: THEME.ink },
  grandValue: { fontSize: 15, fontWeight: '600', color: THEME.brand },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 50 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: '400', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  bottomWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: THEME.card, borderRadius: 24, borderWidth: 1, borderColor: THEME.border, paddingTop: 6, paddingBottom: 12, ...THEME.shadow },
  bottomList: { maxHeight: 220, paddingHorizontal: TAILLES.marge, paddingTop: 6 },
  bottomItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.border },
  bottomItemBody: { flex: 1, marginLeft: 10 },
  bottomItemName: { fontSize: 13.5, fontWeight: '700', color: THEME.ink },
  bottomItemShop: { fontSize: 11.5, color: THEME.muted, fontWeight: '600', marginTop: 1 },
  bottomItemQty: { fontSize: 12.5, fontWeight: '700', color: THEME.muted, marginRight: 10 },
  bottomItemPrice: { fontSize: 13.5, fontWeight: '600', color: THEME.brand },
  bottomSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: TAILLES.marge, paddingTop: 10, paddingBottom: 8 },
  bottomCount: { fontSize: 14, fontWeight: '700', color: THEME.muted },
  bottomTotal: { fontSize: 18, fontWeight: '600', color: THEME.brand },
  cta: { marginHorizontal: TAILLES.marge, height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  ctaTxt: { color: MARCHE.noir, fontWeight: '600', fontSize: 16, marginLeft: 8 },
});

// integre : affiché dans l'onglet Acheter (sous son segment, sans marge du haut).
// actif : segment « Comparer ma liste » choisi ; l'écran se recharge quand il
// devient visible (onglet au premier plan ET segment choisi), comme avant au focus.
const ProductsScreen = ({ integre = false, actif = true, favTick = 0 } = {}) => {
  const { t } = useTranslation();
  const estFocus = useIsFocused();
  const visible = estFocus && actif !== false;
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
    })().catch(() => {});
  }, [favTick]);

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
  const [__activeShopProducts, __setActiveShopProducts] = React.useState([]); // vrais produits de la boutique active (recherche)

  const BRAND="#1C1917";
  const [mode,setMode]=React.useState("collect");
  const [favShops,setFavShops]=React.useState([]);
  const loadFavShops = React.useCallback(async()=>{ try{ const raw=await AsyncStorage.getItem(KEY_FAV_SHOPS); const arr=raw?JSON.parse(raw):[]; setFavShops(Array.isArray(arr)?arr:[]); }catch(e){ setFavShops([]);} },[]);
  React.useEffect(()=>{ if (visible) loadFavShops(); },[visible, loadFavShops, favTick]);
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
  const [strategy,setStrategy]=React.useState("balanced");  // 'eco' | 'fast' | 'balanced'
  const [loading,setLoading]=React.useState(true);
  const [groups,setGroups]=React.useState([]);   // [{name,distance,time,deliveryFee,products:[{title,qty,price}],subtotal,grandTotal}]
  const [summary,setSummary]=React.useState({price:0,time:0,shops:0});
  const [unmatchedNames,setUnmatchedNames]=React.useState([]); // articles de la liste sans correspondance dans les vraies boutiques
  // Vrais shops product_purchase Pearl Streets (null = pas encore chargé → fallback échantillon)
  // Dernière liste connue affichée tout de suite (mémoire, sinon téléphone) ;
  // le réseau la met à jour ensuite, sans rond d'attente.
  const [realShops,setRealShops]=React.useState(()=>{ const d=peekShops('product_purchase'); return Array.isArray(d)&&d.length?d:null; });
  React.useEffect(()=>{ let a=true; (async()=>{
    const local=await hydrateShops('product_purchase');
    if(a&&local) setRealShops(prev=>prev||local);
    try{ const d=await loadShops('product_purchase'); if(a&&(d.length||!local)) setRealShops(d); }
    catch(e){ if(a&&!local) setRealShops([]); }
  })(); return ()=>{a=false}; },[]);


  // Ouvre la recherche « Chercher » verrouillée sur les VRAIS produits de la
  // boutique (capturés à l'ouverture → pas de course avec realShops, jamais de
  // repli sur le catalogue local).
  const openShopSearch = (shopName, shopIndex, query) => {
    const shop = (realShops || []).find(s => s.name === shopName);
    __setActiveShopProducts(shop ? (shop.products || []).map(p => ({
      id: p.id, name: p.name, detail: sousCategorie(p) || p.description || '',
      price: Number(p.price) || 0, image: p.image || '', available: true,
      productId: p.id, companyId: shop.id, shopId: shop.id, category: shop.category || 'product_purchase',
      ...(query ? { listName: query } : {}),
    })) : []);
    __setActiveQuery(query || '');
    __setInitialQuery(query || '');
    __setActiveShopName(shopName);
    __setActiveShopIndex(shopIndex);
    __setSearchVisible(true);
  };

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

  // Chaîne brute de KEY_SELECTED lue au dernier chargement (undefined = jamais lue)
  // et boutiques utilisées : au retour sur l'écran, on ne recharge que si elles ont
  // changé (sinon la sélection et les quantités faites à la main restent).
  const dernierSelRef = React.useRef(undefined);
  const realShopsVusRef = React.useRef(undefined);
  const loadSelected=async()=>{
    // Only load from KEY_SELECTED — set by "Trouver produits exacts" button
    const raw = await AsyncStorage.getItem(KEY_SELECTED);
    dernierSelRef.current = raw;
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
    // VRAIS shops Pearl Streets (product_purchase) si chargés : on matche chaque
    // article de la liste user contre les vrais produits du shop → vrai prix +
    // disponibilité honnête. Frais/ETA/distance = estimations stables par shop
    // (le vrai frais de livraison est résolu à la commande via delivery-options).
    // realShops : null = pas encore chargé (échantillon transitoire) ; [] = chargé
    // mais AUCUNE vraie boutique (vide/hors-ligne) → inventaire vide (on n'affiche
    // JAMAIS l'échantillon comme s'il était réel) ; [..] = vrais shops.
    if (Array.isArray(realShops)) {
      if (realShops.length === 0) return [];
      return realShops.map(shop=>{
        const fee = Number(seededRand(hashStr("fee_"+shop.name),1.5,4.0).toFixed(2));
        const timeMin = 5 + (hashStr("t_"+shop.name) % 15);
        const distKm = (0.4 + (hashStr("d_"+shop.name) % 20)/10).toFixed(1);
        return {
          name: shop.name,
          shopId: shop.id,
          cover: shop.cover, // vraie image de la boutique (Pearl Streets)
          distance: distKm+" km",
          time: timeMin+" min",
          fee,
          items: items.map(it=>{
            // Règle de correspondance : lib/matchProduct.js (partagée avec Menus).
            // Un article venu de Menus porte ses noms français équivalents (matchNames).
            const match = matchProduct(
              (it.matchFor === it.name && Array.isArray(it.matchNames) && it.matchNames.length) ? it.matchNames : it.name,
              shop.products || []
            );
            return {
              name: it.name, qty: it.qty,
              available: !!match,
              // Prix RÉEL du produit s'il existe dans la boutique, sinon null :
              // on n'invente JAMAIS de prix. Un article non trouvé est marqué
              // indisponible et exclu des totaux (badge « à vérifier » côté UI).
              price: match ? Number(Number(match.price).toFixed(2)) : null,
            };
          })
        };
      });
    }
    // realShops === null : catalogue en cours de chargement → AUCUN inventaire.
    // On n'affiche jamais de fausses boutiques (mieux vaut un bref indicateur de
    // chargement qu'un faux catalogue). L'écran gère cet état avec un spinner.
    return [];
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
        best={shop:s,row:{name:it.name,price:null,qty:it.qty}};} // aucune boutique ne l'a → prix null (exclu des totaux)
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
      const row=chosen.items.find(r=>r.name===it.name)||{price:null};
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
        const avail=!!(r&&r.available);
        const unit=avail?r.price:null; // prix réel si dispo, sinon null (jamais inventé)
        // Score interne : prix réel si dispo, sinon forte pénalité (préférer une
        // boutique qui l'a) — sans exposer de prix fabriqué.
        const score=(avail?r.price:9999) + alpha*parseMin(s.time);
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
    // Sécurité : 0 ou 1 boutique (ou aucune paire trouvée) → tout sur la 1ʳᵉ
    // boutique (évite un crash sur best.si quand inv contient moins de 2 shops).
    if(!best){
      const s=inv[0];
      return [{shop:s,products:items.map(it=>{const r=s.items.find(x=>x.name===it.name);return {title:it.name,qty:it.qty,price:(r&&r.available)?r.price:null};})}];
    }
    const res={};
    items.forEach(it=>{
      const ri=best.si.items.find(x=>x.name===it.name);
      const rj=best.sj.items.find(x=>x.name===it.name);
      const pi=ri&&ri.available?ri.price:Infinity;
      const pj=rj&&rj.available?rj.price:Infinity;
      const chosen=(pi<=pj)?{shop:best.si,price:pi}:{shop:best.sj,price:pj};
      if(!isFinite(chosen.price)) chosen.price=null; // aucune des 2 boutiques ne l'a → prix null
      const key=chosen.shop.name; if(!res[key]) res[key]={shop:chosen.shop,products:[]};
      res[key].products.push({title:it.name,qty:it.qty,price:chosen.price});
    });
    return Object.values(res);
  };

  // Normalize: remove accents, lowercase, trim
  const norm = (s) => String(s||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  // Article du panier construit depuis un produit de la comparaison : garde la
  // vraie fiche (productId, companyId, catégorie) pour le paiement et la course.
  const versArticlePanier = (si) => ({
    name: si.name, detail: si.detail||si.subtitle||'',
    unitPrice: si.unitPrice||si.pricePerKg||'',
    qty: si.qty||1, price: si.price||0, shop: si.shop,
    image: si.image||'', shopId: si.shopId,
    ...champsCommande(si),
  });

  // Raye dans Ma Liste les articles réellement mis au panier : égalité du nom
  // normalisé (jamais une inclusion : « chorizo » ne raye pas « riz »), dans la
  // liste d'où ils ont été envoyés (KEY_SELECTED), sinon dans la liste active.
  // Le miroir KEY_ITEMS n'est écrit que si cette liste est encore l'active.
  const rayerDansLaListe = async (noms) => {
    const cibles = new Set((noms || []).map(n => norm(n)).filter(Boolean));
    if (!cibles.size) return;
    let origine = null;
    try {
      const sel = JSON.parse((await AsyncStorage.getItem(KEY_SELECTED)) || 'null');
      const avecListe = Array.isArray(sel) ? sel.find(x => x && x.listId) : null;
      if (avecListe) origine = String(avecListe.listId);
    } catch {}
    const act = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
    const listId = origine || act;
    const cur = await loadListItems(listId, act);
    if (!cur.ok || !cur.items.length) return;
    let change = false;
    const updated = cur.items.map(it => {
      if (it && !it.crossed && cibles.has(norm(it.name || it.title || ''))) { change = true; return { ...it, crossed: true, selected: false }; }
      return it;
    });
    if (!change) return;
    const payload = JSON.stringify(updated);
    await AsyncStorage.setItem(listItemsKey(listId), payload);
    if (listId === act) await AsyncStorage.setItem(KEY_ITEMS, payload);
  };
  // Noms à rayer : l'article de liste d'origine et le nom du produit.
  const nomsDeListe = (items) => {
    const out = [];
    (items || []).forEach(it => { if (!it) return; if (it.listName) out.push(it.listName); out.push(it.name); });
    return out;
  };

  const buildProposal=(items)=>{
    const inv=buildInventory(items);
    // Aucune boutique (vraies boutiques chargées mais vides / hors-ligne).
    if (!Array.isArray(inv) || inv.length === 0) {
      return { groups: [], summary: { price: 0, time: 0, shops: 0 }, unmatched: items.map(i=>i.name) };
    }
    // On ne propose une boutique ET un prix QUE pour les articles réellement
    // trouvés (nom correspondant à un vrai produit d'au moins une boutique).
    // Un article introuvable (ex. « Q », ou une liste sans correspondance) ne
    // génère NI prix NI boutique : il est remonté comme « non trouvé ».
    const isAvail = (it) => inv.some(s => { const r=s.items.find(x=>x.name===it.name); return r && r.available; });
    const availableItems = items.filter(isAvail);
    const unmatched = items.filter(it => !isAvail(it)).map(it => it.name);
    if (availableItems.length === 0) {
      return { groups: [], summary: { price: 0, time: 0, shops: 0 }, unmatched };
    }
    let assigned;
    if(strategy==='eco') assigned=assignEco(availableItems,inv);
    else if(strategy==='fast') assigned=assignFast(availableItems,inv,mode);
    else if(strategy==='single') assigned=assignSingle(availableItems,inv);
    else assigned=assignBalanced(availableItems,inv);

    // Comparaison de prix : dupliquer certains articles TROUVÉS dans d'autres
    // boutiques qui les ont réellement (available).
    const dupeNames = availableItems.filter(it => {
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
        const origItem = availableItems.find(it => it.name === dName);
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
      return {name:g.shop.name,cover:g.shop.cover,distance:g.shop.distance,time:g.shop.time,deliveryFee:fee,products:g.products,subtotal,grandTotal:subtotal+fee};
    });
    // Chaque boutique n'affiche QUE les articles qui lui sont réellement
    // affectés par la stratégie (plus de duplication « tous les produits dans
    // toutes les boutiques » : les cartes étaient identiques et les totaux faux).
    // Favoris en haut de liste.
    groups.sort((a,b) => {
      const aFav = favShops.includes(a.name) ? 0 : 1;
      const bFav = favShops.includes(b.name) ? 0 : 1;
      return aFav - bFav;
    });
    const priceTotal=groups.reduce((a,g)=>a+g.grandTotal,0);
    const time=(mode==='collect')?groups.reduce((a,g)=>a+parseMin(g.time),0):Math.max(...groups.map(g=>parseMin(g.time)),0);
    return {groups,summary:{price:priceTotal,time,shops:groups.length},unmatched};
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

      // N'ajouter le produit qu'aux boutiques où il est RÉELLEMENT affecté par
      // la stratégie (présent dans group.products) — fini « chaque produit dans
      // chaque boutique » qui rendait toutes les cartes identiques.
      groups.forEach((group, shopIndex) => {
        const shopProduct = (group.products || []).find(p => {
          const pName = norm(p.title);
          return pName === key || pName.includes(key) || key.includes(pName);
        });
        if (!shopProduct) return; // non affecté à cette boutique → on ne l'affiche pas
        filled.push({
          id: idCounter++,
          name: product.name,
          detail: product.detail || '',
          unitPrice: product.unitPrice || '',
          price: product.price || shopProduct.price || 0,
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
    realShopsVusRef.current = realShops;
    setLoading(true);
    try{
      const items=await loadSelected();
      const {groups,summary,unmatched}=buildProposal(items);
      setGroups(groups); setSummary(summary);
      setUnmatchedNames(Array.isArray(unmatched) ? unmatched : []);
      // Par DÉFAUT : on résout chaque article trouvé vers le VRAI produit le plus
      // proche de la boutique (nom, prix, image réels) et on l'affiche pré-coché.
      // L'utilisateur peut le changer via « Chercher ». Le matching est le MÊME
      // que buildInventory (jamais un produit sans rapport, ex. pas « papier »
      // pour « panier »).
      const findReal = (shopProducts, itemName) => {
        const inm = norm(itemName); if (!inm) return null;
        return (shopProducts || []).find(p => {
          const pn = norm(p.name); if (!pn) return false;
          if (pn === inm) return true;
          const ptok = pn.split(/\s+/).filter(Boolean);
          const itok = inm.split(/\s+/).filter(Boolean);
          if (itok.length >= 2 && itok.every(w => ptok.includes(w))) return true;
          if (itok.length === 1 && inm.length >= 6 && ptok.includes(inm)) return true;
          return false;
        }) || null;
      };
      const picked = []; let __idc = Date.now(); const csAuto = {};
      groups.forEach((g, shopIndex) => {
        const shop = (realShops || []).find(s => s.name === g.name);
        (g.products || []).forEach(p => {
          const real = shop ? findReal(shop.products, p.title) : null;
          if (!real) return;
          if (picked.some(x => x.shopIndex === shopIndex && x.name === real.name)) return;
          picked.push({ id: __idc++, name: real.name, detail: sousCategorie(real) || '', price: Number(real.price) || 0, image: real.image || '', qty: p.qty || 1, shop: g.name, shopIndex, checked: true,
            // Vraie fiche : le paiement et la course en ont besoin (productId + companyId).
            productId: real.id, companyId: shop.id, shopId: shop.id, category: shop.category || 'product_purchase',
            listName: p.title });
          csAuto[shopIndex] = true;
        });
      });
      setPopupSelectedItems(picked);
      setCheckedShops(csAuto);
    }catch(e){ setGroups([]); setSummary({price:0,time:0,shops:0}); setUnmatchedNames([]); }
    finally{ setLoading(false); }
  },[mode,strategy,realShops]);

  React.useEffect(()=>{ refresh(); },[refresh]);
  React.useEffect(()=>{
    if (!visible) return;
    let vivant = true;
    (async()=>{
      // Jamais chargé : l'effet du dessus s'en charge déjà.
      if (dernierSelRef.current === undefined) return;
      let raw = null;
      try { raw = await AsyncStorage.getItem(KEY_SELECTED); } catch(e) { return; }
      if (!vivant) return;
      if (raw !== dernierSelRef.current || realShopsVusRef.current !== realShops) refresh();
    })();
    return ()=>{ vivant = false; };
  },[visible, refresh, realShops]);

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
    <SafeAreaView style={prodStyles.screen} edges={integre ? [] : ['top']}>
      {/* Header avec titre + bouton effacer */}
      <View style={prodStyles.header}>
        <View style={prodStyles.headerRow}>
          <View style={{flex:1}}>
            <Text style={prodStyles.title}>{integre ? t('acheter.comparer') : t('tabs.products')}</Text>
          </View>
          {/* Nombre de boutiques de la proposition, aligné à droite du titre.
              Même calcul que la carte résumé (Set des shops de popupSelectedItems)
              → toujours cohérent avec le compteur "Boutiques" de la carte. */}
          {(() => {
            const n = new Set((Array.isArray(popupSelectedItems) ? popupSelectedItems : []).map(si => si.shop).filter(Boolean)).size;
            if (n <= 0) return null;
            return (
              <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:THEME.terraSoft, paddingHorizontal:12, height:32, borderRadius:16 }}>
                <Ionicons name="storefront" size={15} color={THEME.terraDark} />
                <Text style={{ marginLeft:6, fontSize:15, fontWeight:'800', color:THEME.ink }}>{n}</Text>
                <Text style={{ marginLeft:4, fontSize:12, fontWeight:'700', color:THEME.muted }}>{t('counts.shopUnit', { count: n })}</Text>
              </View>
            );
          })()}
        </View>
      </View>

      {/* Toute la page défile ensemble : le mode, les stratégies, le résumé, les
          bannières et les boutiques sont dans la même liste défilante. */}
      <FlatList
        keyExtractor={(g,i)=>String(g?.name||'shop')+'_'+i}
        showsVerticalScrollIndicator={false}
        data={(loading || realShops === null) ? [] : (function(){
      const src = Array.isArray(groups)?groups:[];
      const user = __getUserItems();
      const mapped = src.map(g=>{
        const assigned = g.items || g.products || g.lines || [];
        return { ...g, __renderItems: (Array.isArray(assigned)&&assigned.length>0 ? assigned : user) };
      });
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
        ListHeaderComponent={(
          <View>
        <View style={{ paddingHorizontal: TAILLES.marge }}>
        {/* Mode */}
        <View style={[prodStyles.segment, { marginTop: 4 }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={()=>setMode("collect")} style={[prodStyles.segBtn, mode==="collect" && prodStyles.segBtnOn]}>
            <Ionicons name="bag-handle-outline" size={16} color={mode==="collect" ? THEME.terra : THEME.muted} />
            <Text style={[prodStyles.segTxt, mode==="collect" && prodStyles.segTxtOn]}>{t('productsScreen.clickAndCollect')}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} onPress={()=>setMode("delivery")} style={[prodStyles.segBtn, mode==="delivery" && prodStyles.segBtnOn]}>
            <Ionicons name="bicycle-outline" size={16} color={mode==="delivery" ? THEME.terra : THEME.muted} />
            <Text style={[prodStyles.segTxt, mode==="delivery" && prodStyles.segTxtOn]}>{t('productsScreen.delivery')}</Text>
          </TouchableOpacity>
        </View>

        {/* Stratégies */}
        <View style={prodStyles.chipRow}>
          <Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>setStrategy('balanced')} />
          <Chip label={t('productsScreen.strategies.totalPrice')}  active={strategy==='eco'} onPress={()=>setStrategy('eco')} />
          <Chip label={t('productsScreen.strategies.time')}  active={strategy==='fast'} onPress={()=>setStrategy('fast')} />
          {groups.length > 0 && (
            <TouchableOpacity activeOpacity={0.8} onPress={() => {
              Alert.alert(t('productsScreen.clear'), t('productsScreen.clearConfirmMsg'), [
                { text: t('profile.cancel'), style: 'cancel' },
                { text: t('profile.confirm'), style: 'destructive', onPress: async () => {
                  try {
                    await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
                    setGroups([]); setSummary({price:0,time:0,shops:0});
                    setPopupSelectedItems([]); setCheckedShops({});
                    setShowingDefaults(true);
                  } catch(e) {}
                } },
              ]);
            }} style={[prodStyles.clearBtn, { marginLeft: 4, marginBottom: 8 }]}
              accessibilityRole="button" accessibilityLabel={t('productsScreen.clear')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={THEME.danger} />
            </TouchableOpacity>
          )}
        </View>
        </View>

      {/* Résumé — dérivé des produits réellement proposés (source unique :
          popupSelectedItems), cohérent avec les totaux par boutique plus bas.
          Plus de « temps » inventé ni de total gonflé par la duplication. */}
      {realShops !== null && groups.length > 0 && (() => {
        const sel = Array.isArray(popupSelectedItems) ? popupSelectedItems : [];
        const title = t('productsScreen.proposal') + (strategy==="balanced"?t('productsScreen.proposalTypes.balanced'):strategy==="eco"?t('productsScreen.proposalTypes.economic'):strategy==="fast"?t('productsScreen.proposalTypes.fast'):t('productsScreen.proposalTypes.singleShop'));
        // Prix UNIQUEMENT à partir des produits que l'utilisateur a cherchés et
        // choisis. Tant que rien n'est choisi : pas de prix, juste une invite.
        if (sel.length === 0) {
          return (
            <View style={prodStyles.summaryCard}>
              <Text style={prodStyles.summaryTitle}>{title}</Text>
              <View style={{ flexDirection:'row', alignItems:'center', marginTop:10 }}>
                <Ionicons name="search-outline" size={18} color={THEME.brand} />
                <Text style={{ flex:1, marginLeft:10, fontSize:13, color:THEME.muted, fontWeight:'600', lineHeight:18 }}>
                  {t('productsScreen.searchToPrice', 'Appuyez sur « Ajouter un produit » pour choisir vos produits et voir le prix.')}
                </Text>
              </View>
            </View>
          );
        }
        const price = sel.reduce((s,si)=>s+Number(si.price||0)*Number(si.qty||1),0);
        const qty = sel.reduce((s,si)=>s+Number(si.qty||1),0);
        const shopsN = new Set(sel.map(si=>si.shop).filter(Boolean)).size;
        return (
        <View style={prodStyles.summaryCard}>
          <Text style={prodStyles.summaryTitle}>{title}</Text>
          <View style={prodStyles.summaryStats}>
            <View style={prodStyles.statBox}>
              <Text style={prodStyles.statValue}>{fmtPrice(price)}</Text>
              <Text style={prodStyles.statLabel}>{t('productsScreen.total').replace(/[:•]/g,'').trim() || 'Total'}</Text>
            </View>
            <View style={prodStyles.statDivider} />
            <View style={prodStyles.statBox}>
              <Text style={prodStyles.statValue}>{qty}</Text>
              <Text style={prodStyles.statLabel}>{(t('productsScreen.quantity', 'Articles')).replace(/[:•]/g,'').trim()}</Text>
            </View>
            <View style={prodStyles.statDivider} />
            <View style={prodStyles.statBox}>
              <Text style={prodStyles.statValue}>{shopsN}</Text>
              <Text style={prodStyles.statLabel}>{t('productsScreen.shops').replace(/[:•]/g,'').trim() || 'Boutiques'}</Text>
            </View>
          </View>
        </View>
        );
      })()}

      {/* Bandeau info quand liste vide */}
      {showingDefaults && !loading && realShops !== null && (
        <View style={prodStyles.infoBanner}>
          <Ionicons name="information-circle" size={18} color={THEME.brand} />
          <Text style={prodStyles.infoTxt}>{t('productsScreen.defaultProducts', 'Ajoutez des articles dans Ma Liste puis appuyez sur « Comparer ma liste » pour voir les résultats ici.')}</Text>
        </View>
      )}

      {/* Articles non trouvés dans les vraies boutiques (correspondance partielle) */}
      {!loading && realShops !== null && !showingDefaults && groups.length > 0 && unmatchedNames.length > 0 && (
        <View style={[prodStyles.infoBanner, { backgroundColor: THEME.dangerSoft }]}>
          <Ionicons name="alert-circle" size={18} color={THEME.danger} />
          <Text style={[prodStyles.infoTxt, { color: THEME.danger }]}>
            {t('counts.notFound', { count: unmatchedNames.length })} : {unmatchedNames.slice(0,6).join(', ')}{unmatchedNames.length > 6 ? '…' : ''}
          </Text>
        </View>
      )}
          </View>
        )}
          renderItem={({item,index})=>(
            <View
              style={[prodStyles.card, checkedShops[index] && prodStyles.cardOn]}>
              <View style={prodStyles.cardHead}>
                <View style={prodStyles.cardHeadLeft}>
                  <Square value={!!checkedShops[index]} onPress={()=>{
                    const wasChecked = !!checkedShops[index];
                    setCheckedShops(prev=>({...prev,[index]:!wasChecked}));
                    setPopupSelectedItems(prev => prev.map(si => si.shopIndex === index ? {...si, checked: !wasChecked} : si));
                  }} />
                  {item?.cover ? (
                    <Image source={{ uri: item.cover }} style={[prodStyles.shopIcon, { marginLeft: 10 }]} resizeMode="cover" />
                  ) : (
                    <View style={[prodStyles.shopIcon, { marginLeft: 10 }]}>
                      <Ionicons name="storefront" size={22} color={THEME.brand} />
                    </View>
                  )}
                  <View style={{flex:1}}>
                    <Text numberOfLines={1} style={prodStyles.shopName}>{item?.name||t('productsScreen.defaultShop')}</Text>
                    <View style={prodStyles.metaRow}>
                      {/* Info HONNÊTE : nombre d'articles affectés à cette boutique.
                          On n'affiche plus de distance/temps inventés (pas de vraie
                          géoloc/ETA côté app ; le vrai frais est calculé à la commande). */}
                      <View style={prodStyles.metaChip}>
                        <Ionicons name="pricetags-outline" size={12} color={THEME.muted} />
                        <Text style={prodStyles.metaTxt}>{t('counts.products', { count: (item?.products || item?.__renderItems || []).length })}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={()=>toggleShopFav({name:item?.name})}
                  style={[prodStyles.shopFavBtn, {
                    borderColor: isShopFav(item?.name) ? THEME.terra : THEME.border,
                    backgroundColor: isShopFav(item?.name) ? THEME.terraSoft : THEME.card,
                  }]}
                >
                  <Ionicons
                    name={isShopFav(item?.name) ? "heart" : "heart-outline"}
                    size={17}
                    color={isShopFav(item?.name) ? THEME.terra : THEME.muted}
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
                  {/* Ligne « x1 <article> / Ajouté » retirée : le vrai produit résolu
                      est affiché directement ci-dessous. */}

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
                          <ProductImage uri={selectedItem.image} name={selectedItem.name} size={44} />
                          <View style={prodStyles.pickedBody}>
                            <Text style={prodStyles.pickedName}>{selectedItem.name}</Text>
                            {selectedItem.detail ? <Text style={prodStyles.pickedDetail}>{libelleDetail(selectedItem.detail)}</Text> : null}
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
                              <Ionicons name="add" size={14} color="#1C1917" />
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
                    onPress={() => openShopSearch(String(item?.name||''), index, '')}
                    style={prodStyles.addMoreBtn}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={THEME.brandDark} />
                    <Text style={prodStyles.addMoreTxt}>{t('productsScreen.addProduct', 'Ajouter un produit')}</Text>
                  </TouchableOpacity>

                  {shopSelected.length === 0 ? (
                    <View style={[prodStyles.totalsBox, { flexDirection:'row', alignItems:'center' }]}>
                      <Ionicons name="search-outline" size={16} color={THEME.faint} />
                      <Text style={{ marginLeft:8, fontSize:12.5, color:THEME.faint, fontWeight:'600', flex:1 }}>
                        {t('productsScreen.searchToPriceShop', 'Recherchez un produit pour voir le prix.')}
                      </Text>
                    </View>
                  ) : (
                    <View style={prodStyles.totalsBox}>
                      <View style={prodStyles.totalRow}>
                        <Text style={prodStyles.totalLabel}>{t('productsScreen.productsTotal')}</Text>
                        <Text style={prodStyles.totalValue}>{shopSelected.length} ({t('counts.items', { count: liveQty })})</Text>
                      </View>
                      <View style={[prodStyles.totalRow, {marginTop:6}]}>
                        <Text style={prodStyles.grandLabel}>{t('cart.total')}</Text>
                        <Text style={prodStyles.grandValue}>{fmtPrice(liveTotal)}</Text>
                      </View>
                      {mode==="delivery" ? (
                        <View style={[prodStyles.totalRow, {marginTop:6}]}>
                          <Text style={prodStyles.totalLabel}>{t('productsScreen.totalWithDelivery')}</Text>
                          <Text style={prodStyles.totalValue}>{fmtPrice(liveTotalWithDelivery)}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </>;
              })()}
            </View>
          )}
          ListEmptyComponent={
            (loading || realShops === null) ? (
              <SqueletteComparer />
            ) : (
            <View style={prodStyles.empty}>
              {unmatchedNames.length > 0 ? (
                <>
                  <Text style={prodStyles.emptyTitle}>{t('productsScreen.noMatchTitle', 'Aucun produit trouvé\npour votre liste')}</Text>
                  <Text style={prodStyles.emptyHint}>{t('productsScreen.noMatchSub', 'Ces boutiques ne vendent pas ces articles. Vérifiez les noms ou parcourez les Boutiques.')}</Text>
                </>
              ) : (
                <>
                  <Text style={prodStyles.emptyTitle}>{t('productsScreen.addFromList', 'Ajoutez des produits dans Ma Liste')}</Text>
                  <Text style={prodStyles.emptyHint}>{t('productsScreen.addFromListSub', 'Puis appuyez sur « Comparer ma liste »')}</Text>
                </>
              )}
            </View>
            )
          }
          contentContainerStyle={
            ((loading || realShops === null) || !(Array.isArray(groups) && groups.length > 0))
              ? { flexGrow: 1, paddingBottom: 24 }
              : { paddingBottom: 240 }
          }
        />

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
                <ProductImage uri={si.image} name={si.name} size={36} />
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
              {t('counts.items', { count: popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty||1), 0) })}
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
                    // listName : article de liste d'origine (rayage), retiré avant l'écriture du panier.
                    cartItems.push({ ...versArticlePanier(si), ...(si.listName ? { listName: si.listName } : {}) });
                  });
                  const raw = await AsyncStorage.getItem(KEY_CART);
                  const lu = raw ? JSON.parse(raw) : [];
                  const existing = Array.isArray(lu) ? lu : [];
                  // Même article = même fiche + même option quand l'id existe
                  // (comme l'onglet Boutiques), sinon nom + boutique.
                  const { merged, duplicates, newOnly } = separerDoublons(existing, cartItems);
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
              <Ionicons name="cart" size={20} color="#1C1917" />
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
            data={__activeShopProducts}
            realShopMode={true}
            libelleValider={t('searchPopup.addToSelection')}
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
      <Modal onRequestClose={() => setDupModalVisible(false)} visible={dupModalVisible} animationType="slide" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:THEME.card, borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'80%', paddingBottom:40}}>
            {/* Header */}
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:TAILLES.marge, paddingVertical:18, borderBottomWidth:1, borderBottomColor:THEME.border}}>
              <View style={{flex:1, marginRight:10}}>
                <Text style={{fontFamily:SERIF, fontSize:20, fontWeight:'400', color:THEME.ink}}>{t('cart.duplicateProducts')}</Text>
                <Text style={{fontSize:13, color:THEME.muted, marginTop:4}}>{t('counts.duplicates', { count: dupItems.length })}</Text>
              </View>
              <TouchableOpacity onPress={() => setDupModalVisible(false)} style={{width:TAILLES.icone, height:TAILLES.icone, borderRadius:TAILLES.icone / 2, borderWidth:1, borderColor:THEME.border, backgroundColor:THEME.card, alignItems:'center', justifyContent:'center'}}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>

            {/* Liste des produits en doublon */}
            <FlatList
              data={dupItems}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{paddingHorizontal:TAILLES.marge, paddingVertical:16}}
              renderItem={({item: dup, index: di}) => {
                const existingQty = dupMerged[dup.existingIndex]?.qty || 1;
                return (
                  <View style={{
                    flexDirection:'row', alignItems:'center', padding:14, marginBottom:10,
                    backgroundColor: THEME.card, borderRadius:TAILLES.rayonCarte,
                    borderWidth:1, borderColor: THEME.border
                  }}>
                    <ProductThumb name={dup.newItem.name} size={44} />
                    <View style={{flex:1, marginLeft:12, marginRight:8}}>
                      <Text numberOfLines={2} style={{fontSize:15, fontWeight:'700', color:THEME.ink}}>{dup.newItem.name}</Text>
                      <Text numberOfLines={1} style={{fontSize:12, color:THEME.muted, marginTop:2}}>{dup.newItem.shop}</Text>
                      <Text style={{fontSize:12, color:THEME.faint, marginTop:2}}>{t('cart.alreadyInCart')} {existingQty}</Text>
                    </View>
                    <View style={{flexDirection:'row', gap:6}}>
                      <TouchableOpacity
                        onPress={() => setDupItems(prev => prev.map((d, i) => i === di ? {...d, add: false} : d))}
                        style={{
                          paddingHorizontal:12, height:32, borderRadius:16, alignItems:'center', justifyContent:'center', borderWidth:1,
                          borderColor: !dup.add ? MARCHE.noir : THEME.border, backgroundColor: !dup.add ? MARCHE.noir : THEME.card
                        }}
                      >
                        <Text style={{color: !dup.add ? MARCHE.blanc : THEME.muted, fontWeight:'700', fontSize:12}}>{t('cart.ignore')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDupItems(prev => prev.map((d, i) => i === di ? {...d, add: true} : d))}
                        style={{
                          paddingHorizontal:12, height:32, borderRadius:16, alignItems:'center', justifyContent:'center', borderWidth:1,
                          borderColor: dup.add ? MARCHE.noir : THEME.border, backgroundColor: dup.add ? MARCHE.noir : THEME.card
                        }}
                      >
                        <Text style={{color: dup.add ? MARCHE.blanc : THEME.muted, fontWeight:'700', fontSize:12}}>{t('cart.addItem')}</Text>
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
                  try {
                  const finalMerged = [...dupMerged];
                  dupItems.forEach(d => {
                    if (d.add && finalMerged[d.existingIndex]) {
                      // Quantité cumulée plafonnée au stock connu de l'option.
                      finalMerged[d.existingIndex] = cumulerQuantite(finalMerged[d.existingIndex], d.newItem.qty || 1);
                    }
                  });
                  const added = dupItems.filter(d => d.add).length + dupNewOnly;
                  // Tout est doublon ignoré : rien n'est écrit, la comparaison reste.
                  if (added === 0) { setDupModalVisible(false); return; }
                  // Articles réellement mis au panier : les nouveaux + les doublons ajoutés.
                  const pousses = [...(dupNewOnly > 0 ? dupMerged.slice(-dupNewOnly) : []), ...dupItems.filter(d => d.add).map(d => d.newItem)];
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify(finalMerged.map(({ listName: _ln, ...it }) => it)));
                  DeviceEventEmitter.emit('CART_UPDATED');

                  // Cross off added items in Ma Liste
                  try { await rayerDansLaListe(nomsDeListe(pousses)); } catch {}
                  await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
                  setGroups([]); setSummary({price:0,time:0,shops:0});
                  setShowingDefaults(true);
                  setCartPushed(true);
                  setCheckedShops({});
                  setPopupSelectedItems([]);
                  setDupModalVisible(false);
                  setCartSuccessCount(added);
                  setCartSuccessVisible(true);
                  } catch(e) {}
                }}
                style={{height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, borderWidth: 1, borderColor: MARCHE.noir, backgroundColor:MARCHE.noir, alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:MARCHE.blanc, fontWeight:'700', fontSize:16}}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDupModalVisible(false)}
                style={{height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, borderWidth:1, borderColor:THEME.borderInput, backgroundColor:THEME.card, alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:THEME.ink, fontWeight:'600', fontSize:16}}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal confirmation ajout panier */}
      <Modal onRequestClose={() => setConfirmCartVisible(false)} visible={confirmCartVisible} animationType="slide" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:THEME.card, borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'70%', paddingBottom:40}}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:TAILLES.marge, paddingVertical:18, borderBottomWidth:1, borderBottomColor:THEME.border}}>
              <View style={{flex:1, marginRight:10}}>
                <Text style={{fontFamily:SERIF, fontSize:20, fontWeight:'400', color:THEME.ink}}>{t('cart.addToCart')}</Text>
                {(() => {
                  const active = popupSelectedItems.filter(si => checkedShops[si.shopIndex]);
                  const shopCount = new Set(active.map(si => si.shop)).size;
                  const totalQty = active.reduce((s, si) => s + (si.qty || 1), 0);
                  return <Text style={{fontSize:13, color:THEME.muted, marginTop:4}}>
                    {t('counts.shops', { count: shopCount })} • {t('counts.items', { count: totalQty })}
                  </Text>;
                })()}
              </View>
              <TouchableOpacity onPress={() => setConfirmCartVisible(false)} style={{width:TAILLES.icone, height:TAILLES.icone, borderRadius:TAILLES.icone / 2, borderWidth:1, borderColor:THEME.border, backgroundColor:THEME.card, alignItems:'center', justifyContent:'center'}}>
                <Ionicons name="close" size={20} color={THEME.muted} />
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
              contentContainerStyle={{paddingHorizontal:TAILLES.marge, paddingVertical:16}}
              renderItem={({item: group}) => (
                <View style={{marginBottom:12}}>
                  <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                    <Ionicons name="storefront-outline" size={16} color={THEME.terra} />
                    <Text numberOfLines={1} style={{flexShrink:1, fontSize:15, fontWeight:'700', color:THEME.ink, marginLeft:8}}>{group.shop}</Text>
                    <Text style={{fontSize:13, color:THEME.muted, marginLeft:8}}>{fmtPrice(group.items.reduce((s, si) => s + (Number(si.price||0) * Number(si.qty||1)), 0))}</Text>
                  </View>
                  {group.items.map(si => (
                    <View key={si.id} style={{flexDirection:'row', alignItems:'center', padding:10, marginBottom:6, backgroundColor:THEME.subtle, borderRadius:12}}>
                      <ProductImage uri={si.image} name={si.name} size={36} />
                      <View style={{flex:1, marginLeft:10, marginRight:8}}>
                        <Text numberOfLines={2} style={{fontSize:14, fontWeight:'600', color:THEME.ink}}>{si.name}</Text>
                        <Text numberOfLines={1} style={{fontSize:11, color:THEME.muted}}>{libelleDetail(si.detail)}</Text>
                      </View>
                      <View style={{alignItems:'flex-end'}}>
                        <View style={{flexDirection:'row', alignItems:'center', marginBottom:3}}>
                          {(si.qty || 1) <= 1 ? (
                            <RepeatButton
                              onPress={() => setPopupSelectedItems(prev => prev.filter(p => p.id !== si.id))}
                              onLongAction={() => setPopupSelectedItems(prev => prev.filter(p => p.id !== si.id))}
                              style={{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:THEME.danger,backgroundColor:THEME.card,alignItems:'center',justifyContent:'center'}}
                            >
                              <Ionicons name="trash-outline" size={11} color={THEME.danger} />
                            </RepeatButton>
                          ) : (
                            <RepeatButton
                              onPress={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: (p.qty||1)-1} : p))}
                              onLongAction={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: Math.max(1,(p.qty||1)-1)} : p))}
                              style={{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:THEME.borderInput,backgroundColor:THEME.card,alignItems:'center',justifyContent:'center'}}
                            >
                              <Ionicons name="remove" size={11} color={THEME.ink} />
                            </RepeatButton>
                          )}
                          <Text style={{fontSize:13,fontWeight:'800',color:THEME.ink,marginHorizontal:5,minWidth:16,textAlign:'center'}}>{si.qty || 1}</Text>
                          <RepeatButton
                            onPress={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: (p.qty||1)+1} : p))}
                            onLongAction={() => setPopupSelectedItems(prev => prev.map(p => p.id === si.id ? {...p, qty: (p.qty||1)+1} : p))}
                            style={{width:24,height:24,borderRadius:12,borderWidth: 1, borderColor: THEME.borderInput, backgroundColor:THEME.card,alignItems:'center',justifyContent:'center'}}
                          >
                            <Ionicons name="add" size={11} color={MARCHE.noir} />
                          </RepeatButton>
                        </View>
                        <Text style={{fontSize:12, color:THEME.ink, fontWeight:'700'}}>{fmtPrice(si.price * (si.qty || 1))}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            />

            <View style={{paddingHorizontal:TAILLES.marge, gap:10}}>
              {/* Total */}
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:8, borderTopWidth:1, borderTopColor:THEME.border}}>
                <Text style={{fontSize:16, fontWeight:'700', color:THEME.ink}}>{t('productsScreen.productsTotal')}</Text>
                <Text style={{fontSize:16, fontWeight:'700', color:THEME.ink}}>{popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty || 1), 0)}</Text>
              </View>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                <Text style={{fontSize:16, fontWeight:'700', color:THEME.ink}}>{t('cart.total')}</Text>
                <Text style={{fontSize:16, fontWeight:'700', color:BRAND}}>{fmtPrice(popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (Number(si.price||0) * Number(si.qty||1)), 0))}</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const activeItems = popupSelectedItems.filter(si => checkedShops[si.shopIndex]);
                    const count = activeItems.reduce((s, si) => s + (si.qty || 1), 0);
                    // Panier existant GARDÉ : les produits choisis s'y ajoutent (même
                    // fusion que confirmCartItems, refaite sur le panier relu pour
                    // tenir compte des quantités modifiées dans cette feuille).
                    const rawCart = await AsyncStorage.getItem(KEY_CART);
                    const luCart = rawCart ? JSON.parse(rawCart) : [];
                    const newCart = ajouterAuPanier(Array.isArray(luCart) ? luCart : [], activeItems.map(versArticlePanier));
                    await AsyncStorage.setItem(KEY_CART, JSON.stringify(newCart));
                    DeviceEventEmitter.emit('CART_UPDATED');

                    // Cross off added items in Ma Liste (seulement ceux mis au panier)
                    try { await rayerDansLaListe(nomsDeListe(activeItems)); } catch {}

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
                  } catch(e) {}
                }}
                style={{height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, borderWidth: 1, borderColor: MARCHE.noir, backgroundColor:MARCHE.noir, alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:MARCHE.blanc, fontWeight:'700', fontSize:16}}>{t('profile.confirm')} ({popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty || 1), 0)})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setConfirmCartVisible(false)}
                style={{height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, borderWidth:1, borderColor:THEME.borderInput, backgroundColor:THEME.card, alignItems:'center', justifyContent:'center'}}
              >
                <Text style={{color:THEME.ink, fontWeight:'600', fontSize:16}}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal succès ajout panier */}
      <Modal onRequestClose={() => setCartSuccessVisible(false)} visible={cartSuccessVisible} transparent animationType="fade">
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center'}}>
          <View style={{backgroundColor:THEME.card, borderRadius:24, borderWidth:1, borderColor:THEME.border, padding:30, marginHorizontal:30, alignItems:'center', width:'85%'}}>
            <View style={{width:64, height:64, borderRadius:32, backgroundColor:THEME.terraSoft, alignItems:'center', justifyContent:'center', marginBottom:16}}>
              <Ionicons name="checkmark-circle" size={40} color={THEME.terra} />
            </View>
            <Text style={{fontFamily:SERIF, fontSize:22, fontWeight:'400', color:THEME.ink, textAlign:'center'}}>{t('cart.addedToCart')}</Text>
            <Text style={{fontSize:14, color:THEME.muted, marginTop:8, textAlign:'center'}}>{t('counts.addedToCart', { count: cartSuccessCount })}</Text>
            <TouchableOpacity
              onPress={() => { setCartSuccessVisible(false); navigation.navigate('cart', { mode, n: Date.now() }); }}
              style={{marginTop:20, width:'100%', height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, borderWidth: 1, borderColor: MARCHE.noir, backgroundColor:MARCHE.noir, alignItems:'center', justifyContent:'center'}}
            >
              <Text style={{color:MARCHE.blanc, fontWeight:'700', fontSize:16}}>{t('cart.viewCart')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCartSuccessVisible(false)}
              style={{marginTop:10, width:'100%', height:TAILLES.bouton, borderRadius:TAILLES.rayonBouton, borderWidth:1, borderColor:THEME.borderInput, backgroundColor:THEME.card, alignItems:'center', justifyContent:'center'}}
            >
              <Text style={{color:THEME.ink, fontWeight:'600', fontSize:16}}>{t('productsScreen.continueShopping', 'Continuer les courses')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </View>
  );
};

export default ProductsScreen;
