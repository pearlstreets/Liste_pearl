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
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Keyboard, FlatList, Modal, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DefaultTheme, useNavigation, useFocusEffect } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { openCamera } from "./utils/openCamera";
const BRAND = "#00C29B";
const KEY_ITEMS = "SG_ITEMS";
const KEY_SELECTED = "SG_SELECTED_FOR_PRODUCTS";
const KEY_CART = "KEY_CART";
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

function ListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [strikeAll, setStrikeAll] = useState(false);
  const [hideCrossed, setHideCrossed] = useState(false);

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
        else base.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), name: p.name, qty: p.qty, crossed: false, selected: false });
      }
      return base;
    });
    setText("");
    Keyboard.dismiss();
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
        <TextInput autoCorrect={true} spellCheck={true} autoCapitalize="none"
          value={text}
          onChangeText={setText}
          placeholder={t('listScreen.inputPlaceholder')}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={addFromInput}   // Entrée = ajoute
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
          <Text style={styles.bottomBtnText} onPress={async ()=>{try{const chosen=Array.isArray(items)?items.filter(it=>it&&(it.selected||it.checked)).map(it=>({name:String(it.name||it.title||'').trim(),qty:Number(it.qty||it.quantity||1)})):[];await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify(chosen));}catch(e){} navigation.navigate('products');}}>{t('listScreen.findExactProducts')}</Text>
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
  const [__activeQuery, __setActiveQuery] = React.useState('');
  const [__selectedByQuery, __setSelectedByQuery] = React.useState({});
  const [popupSelectedItems, setPopupSelectedItems] = React.useState([]); // Items selected from popup

  const [__searchVisible, __setSearchVisible] = React.useState(false); //__search_popup_flag
  const [__initialQuery, __setInitialQuery] = React.useState(''); //__search_popup_flag
  const [__shopFilter, __setShopFilter] = React.useState(null);

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
  const randBetween=(a,b)=> a + Math.random()*(b-a);
  const randPrice=(name)=>{const n=String(name||"").toLowerCase();
    if(n.includes("pain"))return randBetween(1.0,2.0);
    if(n.includes("yaourt"))return randBetween(0.6,1.2);
    if(n.includes("pomme"))return randBetween(0.4,1.0);
    if(n.includes("tomate"))return randBetween(1.5,3.0);
    if(n.includes("poulet"))return randBetween(6.0,11.0);
    return randBetween(0.8,13.0);
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
      {name:"Carrefour Market", distance:"0.9 km", time:"9 min",  fee:Number(randBetween(1.5,4.0).toFixed(2))},
      {name:"Intermarché Sud", distance:"0.8 km", time:"10 min", fee:Number(randBetween(1.5,4.0).toFixed(2))},
      {name:"Primeur Bio",     distance:"0.5 km", time:"7 min",  fee:Number(randBetween(1.5,4.0).toFixed(2))},
      {name:"Leclerc Meaux",   distance:"1.8 km", time:"8 min",  fee:Number(randBetween(1.5,4.0).toFixed(2))},
      {name:"Monoprix Centre", distance:"1.2 km", time:"6 min",  fee:Number(randBetween(1.5,4.0).toFixed(2))}
    ];
    return shops.map(s=>({
      ...s,
      items: items.map(it=>({
        name: it.name, qty: it.qty,
        available: Math.random()<0.85,
        price: Number(randPrice(it.name).toFixed(2))
      }))
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
        best={shop:s,row:{name:it.name,price:randPrice(it.name),qty:it.qty}};}
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
      const row=chosen.items.find(r=>r.name===it.name)||{price:randPrice(it.name)};
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
        const unit=r&&r.available?r.price:randPrice(it.name)*1.1;
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
          const price = ri?ri.price : (rj?rj.price : randPrice(it.name)*1.2);
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
      if(!isFinite(chosen.price)) chosen.price=randPrice(it.name)*1.25;
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
      return src.map(g=>{
        const assigned = g.items || g.products || g.lines || [];
        return { ...g, __renderItems: (Array.isArray(assigned)&&assigned.length>0 ? assigned : user) };
      });
    })()}
          keyExtractor={(g,i)=>String(g?.name||'shop')+'_'+i}
          renderItem={({item,index})=>(
            <View style={{backgroundColor:"#fff",padding:16,marginVertical:8,marginHorizontal:16,borderRadius:12,shadowColor:"#000",shadowOpacity:0.05,shadowRadius:5}}>
              <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                <Text style={{fontWeight:"bold",fontSize:16}}>{item?.name||'Boutique'}</Text>
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
                      <TouchableOpacity style={{backgroundColor:BRAND,paddingHorizontal:10,paddingVertical:6,borderRadius:6}} onPress={()=>{ __setActiveQuery(String(p?.title||p?.name||''));  __setInitialQuery(String(p?.title||p?.name||"")); __setSearchVisible(true); }}><Text style={{color:"#fff",fontWeight:"600"}}>{t('productsScreen.search')}</Text></TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Show matching selected items below each product */}
                  {popupSelectedItems
                    .filter(selected => {
                      const productName = String(p?.title || p?.name || '').toLowerCase();
                      const selectedName = String(selected?.name || '').toLowerCase();
                      return productName.includes('pomme') && selectedName.includes('pomme') ||
                             productName.includes('pain') && selectedName.includes('pain') ||
                             productName.includes('banane') && selectedName.includes('banane');
                    })
                    .map(selectedItem => (
                      <View key={selectedItem.id} style={{marginTop:8,padding:12,backgroundColor:"#F9FAFB",borderRadius:8,marginLeft:20}}>
                        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
                          <View style={{flex:1}}>
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
                            style={{width:40,height:40,borderRadius:999,backgroundColor:"#00C29B",alignItems:"center",justifyContent:"center"}}
                          >
                            <Text style={{color:"#fff",fontSize:24,fontWeight:"900"}}>+</Text>
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
            </View>
          )}
          ListEmptyComponent={<Text style={{textAlign:"center",marginTop:32,color:"#666"}}>{t('productsScreen.noItems')}</Text>}
        />
      )}
          <SearchPopup 
            visible={__searchVisible} 
            initialQuery={__initialQuery} 
            onClose={()=>__setSearchVisible(false)} 
            onSelect={(it)=>{ 
              try{ 
                __setSelectedByQuery(prev=>({ ...(prev||{}), [__activeQuery]: it }));
                // Add the selected item to the popup selected items list
                setPopupSelectedItems(prev => {
                  // Check if item already exists
                  const exists = prev.find(item => item.id === it.id);
                  if (!exists) {
                    return [...prev, { ...it, qty: 1 }];
                  }
                  return prev;
                });
              }catch(e){} 
              __setSearchVisible(false); 
            }} 
          />
    </SafeAreaView>
  );
};
const FavoritesScreen = () => {
  const { t } = useTranslation();
  const [favShops, setFavShops] = React.useState([]);
  const [shopDetails, setShopDetails] = React.useState([]);
  
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
  
  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={shopDetails}
        keyExtractor={(item) => item.name}
        contentContainerStyle={{paddingVertical: 16}}
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
const CartScreen = () => {
  const { t } = useTranslation();
  return <Placeholder title={t('tabs.cart')} />;
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
      cart: t('tabs.cart')
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
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 20, marginBottom: 16 }}>Profile</Text>
      <TouchableOpacity style={{ padding: 12, backgroundColor: "#00C29B", borderRadius: 8 }}>
        <Text style={{ color: "#fff" }}>Connection / Settings</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}


function FakeFakeProfileScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [logged, setLogged] = React.useState(false);

  return (
    <SafeAreaView style={{ flex: 1, padding: 24 }}>
      {!logged ? (
        <>
          <Text style={{ fontSize: 22, marginBottom: 20 }}>Connexion</Text>

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 8,
              padding: 12,
              marginBottom: 12
            }}
          />

          <TextInput
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 8,
              padding: 12,
              marginBottom: 20
            }}
          />

          <TouchableOpacity
            onPress={() => setLogged(true)}
            style={{
              backgroundColor: "#00C29B",
              padding: 14,
              borderRadius: 8,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>Se connecter</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 22, marginBottom: 12 }}>Profil</Text>
          <Text style={{ fontSize: 16 }}>Connecté en tant que :</Text>
          <Text style={{ fontSize: 16, marginTop: 4 }}>{email}</Text>
        </>
      )}
    </SafeAreaView>
  );
}
