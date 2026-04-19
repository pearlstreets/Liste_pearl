import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, Modal, ScrollView, Switch, Alert, Animated, Platform, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DeviceEventEmitter } from 'react-native';
import { ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { isOptimized, setOptimized, getMode } from '../utils/distributionMode';
import { autocorrectName } from '../utils/spellcheck';
import SearchPopup from '../components/SearchPopup';
import { Square } from '../components/Square';
import { RepeatButton } from '../components/RepeatButton';
import { Toast } from '../components/Toast';
import { BRAND, GUTTER } from '../constants/brand';
import { KEY_ITEMS, KEY_SELECTED, KEY_CART, KEY_FAV_SHOPS, KEY_FAV_PRODUCTS } from '../constants/storageKeys';
import { ProductThumb } from '../constants/productImages';
import CurrencyContext from '../context/CurrencyContext';
import { useCartEvents } from '../context/CartContext';
import { styles } from '../styles/shared';

const useCurrency = () => React.useContext(CurrencyContext);

const SEARCH_MAP = require('../data/search-map.json');

function itemsToRenderForShop(allUserItems, assignedForThisShop, optimized){
  const A = Array.isArray(allUserItems) ? allUserItems : [];
  const B = Array.isArray(assignedForThisShop) ? assignedForThisShop : [];
  const opt = typeof optimized === "boolean" ? optimized : false;
  return opt ? B : A;
}

export function parseMulti(input){
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
  const { fmtPrice } = useCurrency();
  const navigation = useNavigation();
  const { notifyCartUpdate, notifyProductsReset } = useCartEvents();
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

  // Tous les produits du catalogue comme defaut quand la liste est vide
  // On extrait les cles uniques (singulier) de search-map pour eviter les doublons
  const DEFAULT_PRODUCTS = React.useMemo(() => {
    const seen = new Set();
    const products = [];
    // Cles singulieres prioritaires pour eviter doublons singulier/pluriel
    const keys = Object.keys(SEARCH_MAP).sort((a, b) => a.length - b.length);
    keys.forEach(key => {
      // Skip les categories generiques (fruits, legumes, viande, etc.)
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
    // Only load from KEY_SELECTED -- set by "Trouver produits exacts" button
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
      {name:"Intermarche Sud", distance:"0.8 km", time:"10 min", fee:Number(seededRand(hashStr("fee_inter"),1.5,4.0).toFixed(2))},
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
    const alpha=0.25; // euro/min
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
      return n.includes('pat') || n.includes('pat') || n.includes('pizza') || n.includes('riz') || n.includes('lait') || n.includes('oeuf') || n.includes('oeuf') || n.includes('poulet');
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
      // 4. Fuzzy match (Damerau-Levenshtein) -- find closest product even with typos
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
        // Always add -- every shop should show every product
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

      {/* Strategies */}
      <View style={{flexDirection:"row",justifyContent:"center",marginTop:8}}>
        <Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>setStrategy('balanced')} />
        <Chip label={t('productsScreen.strategies.totalPrice')}  active={strategy==='eco'} onPress={()=>setStrategy('eco')} />
        <Chip label={t('productsScreen.strategies.time')}  active={strategy==='fast'} onPress={()=>setStrategy('fast')} />
        <Chip label={t('productsScreen.strategies.singleShop')}  active={strategy==='single'} onPress={()=>setStrategy('single')} />
      </View>

      {/* Resume */}
      <View style={{marginTop:10,marginHorizontal:16,padding:12,borderRadius:12,backgroundColor:"#F4F6F6"}}>
        <Text style={{fontWeight:"600"}}>{t('productsScreen.proposal')}{strategy==="balanced"?t('productsScreen.proposalTypes.balanced'):strategy==="eco"?t('productsScreen.proposalTypes.economic'):strategy==="fast"?t('productsScreen.proposalTypes.fast'):t('productsScreen.proposalTypes.singleShop')}</Text>
        <Text style={{marginTop:4}}>{t('productsScreen.total')}<Text style={{fontWeight:"700"}}>{fmtPrice(summary.price)}</Text>{t('productsScreen.time')}<Text style={{fontWeight:"700"}}>{summary.time}{t('productsScreen.minutes')}</Text>{t('productsScreen.shops')}<Text style={{fontWeight:"700"}}>{summary.shops}</Text></Text>
      </View>


      {/* Bandeau info quand liste vide */}
      {showingDefaults && !loading && (
        <View style={{marginHorizontal:16, marginTop:8, padding:14, borderRadius:12, backgroundColor:'#FEF3C7', flexDirection:'row', alignItems:'center'}}>
          <Ionicons name="information-circle" size={18} color="#F59E0B" style={{marginRight:10}} />
          <Text style={{flex:1, fontSize:13, color:'#92400E'}}>{t('productsScreen.defaultProducts') || 'Ajoutez des articles dans Ma Liste puis appuyez sur "Trouver produits exacts" pour voir les resultats ici.'}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{marginTop:24}} />
      ) : (
        <FlatList
          data={(function(){
      const src = Array.isArray(groups)?groups:[];
      const user = [];
      const mapped = src.map(g=>{
        const assigned = g.items || g.products || g.lines || [];
        return { ...g, __renderItems: (Array.isArray(assigned)&&assigned.length>0 ? assigned : user) };
      });
      // Tri : favoris en haut, puis si balanced -> plus de produits en premier
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
                  <Text style={{color:"#666"}}>{(item?.distance||"")+(item?.time?(" \u2022 "+item.time):"")}</Text>
                </View>
              </View>
              {mode==="delivery" ? <Text style={{color:"#666",marginTop:6}}>{t('productsScreen.deliveryFee')}{fmtPrice(item?.deliveryFee||0)}</Text> : null}
              {/* Display original products with quantity controls */}
              {(Array.isArray(item?.products)?item.__renderItems:[]).map((p,i)=>(
                <View key={i} style={{marginTop:12}}>
                  <View style={{flexDirection:"row",alignItems:"center"}}>
                    {/* Qty + Title -- green if matched product found, red if not */}
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
                        <Text style={{color:BRAND,fontWeight:"700",fontSize:13}}>{t('cart.added') || 'Ajoute'}</Text>
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
                  {/* Bouton ajouter un produit supplementaire */}
                  <TouchableOpacity
                    onPress={() => { __setActiveQuery(''); __setInitialQuery(''); __setActiveShopName(String(item?.name||'')); __setActiveShopIndex(index); __setSearchVisible(true); }}
                    style={{marginTop:10, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:BRAND, borderStyle:'dashed'}}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={BRAND} style={{marginRight:6}} />
                    <Text style={{color:BRAND, fontWeight:'600', fontSize:14}}>{t('productsScreen.addProduct') || 'Ajouter un produit'}</Text>
                  </TouchableOpacity>

                  <View style={{marginTop:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                    <Text style={{fontSize:15,fontWeight:"700",color:"#374151"}}>{t('productsScreen.productsTotal')}</Text>
                    <Text style={{fontSize:15,fontWeight:"700",color:"#374151"}}>{shopSelected.length} ({liveQty} {t('productsScreen.quantity') || 'quantite'})</Text>
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

      {/* Panneau produits selectionnes en bas */}
      {Object.values(checkedShops).some(v=>v) && (
        <View style={{position:"absolute",bottom:0,left:0,right:0,backgroundColor:'#fff',borderTopLeftRadius:20,borderTopRightRadius:20,shadowColor:"#000",shadowOpacity:0.15,shadowRadius:10,elevation:8,paddingBottom:Platform.OS==='ios'?30:16}}>
          {/* Liste des produits selectionnes -- max 3.5 visibles */}
          <FlatList
            data={popupSelectedItems.filter(si => checkedShops[si.shopIndex])}
            keyExtractor={(item) => String(item.id)}
            horizontal={false}
            style={{maxHeight:220, paddingHorizontal:16, paddingTop:12}}
            showsVerticalScrollIndicator={true}
            renderItem={({item: si}) => (
              <View style={{flexDirection:'row', alignItems:'center', paddingVertical:6, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
                <ProductThumb name={si.name} size={32} />
                <View style={{flex:1, marginLeft:8}}>
                  <Text style={{fontSize:13, fontWeight:'600', color:'#111'}} numberOfLines={1}>{si.name}</Text>
                  <Text style={{fontSize:11, color:'#6B7280'}}>{si.shop}</Text>
                </View>
                <Text style={{fontSize:12, fontWeight:'600', color:'#374151', marginRight:8}}>x{si.qty||1}</Text>
                <Text style={{fontSize:13, fontWeight:'700', color:BRAND}}>{fmtPrice((si.price||0)*(si.qty||1))}</Text>
              </View>
            )}
          />
          {/* Nombre de produits selectionnes + total */}
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingTop:8, paddingBottom:6}}>
            <Text style={{fontSize:14, fontWeight:'700', color:'#374151'}}>
              {popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (si.qty||1), 0)} {t('productsScreen.quantity') || 'produits'}
            </Text>
            <Text style={{fontSize:16, fontWeight:'800', color:BRAND}}>
              {fmtPrice(popupSelectedItems.filter(si => checkedShops[si.shopIndex]).reduce((s, si) => s + (Number(si.price||0) * Number(si.qty||1)), 0))}
            </Text>
          </View>
          {/* Bouton ajouter au panier */}
          <View style={{paddingHorizontal:16}}>
            <TouchableOpacity
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
              style={{height:50,borderRadius:14,backgroundColor:BRAND,flexDirection:"row",alignItems:"center",justifyContent:"center"}}
            >
              <Ionicons name="cart" size={20} color="#fff" style={{marginRight:8}} />
              <Text style={{color:"#fff",fontSize:16,fontWeight:"700"}}>
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
                  notifyCartUpdate();

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
                    {shopCount} {shopCount > 1 ? 'shops' : 'shop'} \u2022 {totalQty} {t('productsScreen.quantity') || 'quantite'}
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
                    notifyCartUpdate();

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

      {/* Modal succes ajout panier */}
      <Modal visible={cartSuccessVisible} transparent animationType="fade">
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center'}}>
          <View style={{backgroundColor:'#fff', borderRadius:24, padding:30, marginHorizontal:30, alignItems:'center', width:'85%'}}>
            <View style={{width:64, height:64, borderRadius:32, backgroundColor:'#ECFDF5', alignItems:'center', justifyContent:'center', marginBottom:16}}>
              <Ionicons name="checkmark-circle" size={40} color={BRAND} />
            </View>
            <Text style={{fontSize:20, fontWeight:'800', color:'#111', textAlign:'center'}}>{t('cart.addedToCart')}</Text>
            <Text style={{fontSize:14, color:'#6B7280', marginTop:8, textAlign:'center'}}>{cartSuccessCount} {t('productsScreen.quantity') || 'produits'} {t('cart.addedToCartSub') || 'ajoutes au panier'}</Text>
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

export default ProductsScreen;
