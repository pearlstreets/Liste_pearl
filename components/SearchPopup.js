import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addProduct } from "../lib/SelectedProducts";
import { autocorrectName, normalizeText } from "../utils/spellcheck";
import SEARCH_MAP from "../data/search-map.json";

const BRAND = "#00C29B";

function stripDiacritics(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function norm(s) {
  return stripDiacritics(String(s || "").toLowerCase().trim());
}

function parseUnit(detail) {
  const t = norm(detail);
  const pack = t.match(/(\d+)x(\d+[\.,]?\d*)\s*(l)\b/i);
  if (pack) {
    const n = parseInt(pack[1], 10);
    const each = parseFloat(pack[2].replace(',', '.'));
    return { qty: n * each, unit: 'l' };
  }
  const m = t.match(/(\d+[\.,]?\d*)\s*(kg|g|l|cl|ml)\b/i);
  if (m) {
    let qty = parseFloat(m[1].replace(',', '.'));
    const u = m[2].toLowerCase();
    if (u === 'kg') return { qty: qty, unit: 'kg' };
    if (u === 'g')  return { qty: qty / 1000, unit: 'kg' };
    if (u === 'l')  return { qty: qty, unit: 'l' };
    if (u === 'cl') return { qty: qty / 100, unit: 'l' };
    if (u === 'ml') return { qty: qty / 1000, unit: 'l' };
  }
  const totalL = t.match(/(\d+[\.,]?\d*)\s*l\b/i);
  if (totalL) {
    const q = parseFloat(totalL[1].replace(',', '.'));
    return { qty: q, unit: 'l' };
  }
  return { qty: null, unit: null };
}
function fmtEuro(v) {
  if (!isFinite(v)) return "";
  return Number(v).toFixed(2).replace(".", ",");
}
function unitPriceFromDetail(price, detail) {
  const u = parseUnit(detail);
  if (!u.qty || !u.unit) return "";
  const per = price && isFinite(price) ? (price / u.qty) : 0;
  const label = u.unit === "kg" ? "€/KG" : "€/L";
  return fmtEuro(per) + " " + label;
}

function enrich(item) {
  if (!item || typeof item !== "object") return item;
  const name = item.name || item.title || "";
  const price = Number.isFinite(item.price) ? item.price : (parseFloat(item.price) || 0);
  let subtitle = item.detail || item.subtitle || item.subTitle || item.description || item.info || "";
  if (!subtitle) subtitle = "Origine France – 1kg";
  let unitPrice = item.unitPrice || item.pricePerKg || item.price_per_kg || item.secondaryPrice || "";
  if (!unitPrice) unitPrice = unitPriceFromDetail(price, subtitle);

  return {
    ...item,
    id: item.id || norm(name + "|" + subtitle),
    name,
    price,
    detail: subtitle,
    subtitle,
    subTitle: subtitle,
    description: subtitle,
    info: subtitle,
    unitPrice,
    pricePerKg: unitPrice,
    price_per_kg: unitPrice,
    secondaryPrice: unitPrice,
  };
}

export default function SearchPopup({ visible, initialQuery = "", data, shopNameFilter, onClose, onSelect }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState([]);

  useEffect(() => { setQuery(initialQuery || ""); }, [initialQuery]);

  const dataset = useMemo(() => {
    const base = Array.isArray(data) ? data : [];
    return base.map((it, idx) => ({
      id: it.id || "d-" + idx,
      name: it.name || it.title || "",
      detail: it.detail || it.subtitle || it.description || "",
      price: typeof it.price === "number" ? it.price : parseFloat(it.price) || 0,
      unitPrice: it.unitPrice || it.pricePerKg || it.price_per_kg || it.secondaryPrice || "",
      available: typeof it.available === "boolean" ? it.available : true,
      thumb: it.thumb || null,
    }));
  }, [data]);

  useEffect(() => {
    const q = autocorrectName(query || "");
    const qn = norm(q);
    if (!qn) { setResults([]); return; }

    const out = [];

    // 1) Filtre dans les données du shop si présentes
    for (const it of dataset) {
      const inName = norm(it.name).includes(qn);
      const inDetail = norm(it.detail).includes(qn);
      if (inName || inDetail) out.push(enrich(it));
    }

    // 2) Sinon, résultats “mappés” (bananes, fruits => items concrets)
    if (out.length === 0) {
      const seen = new Set();
      Object.keys(SEARCH_MAP || {}).forEach(k => {
        const kn = norm(k);
        if (qn === kn || qn.includes(kn) || kn.includes(qn)) {
          (SEARCH_MAP[k] || []).forEach(raw => {
            const put = enrich(raw);
            const key = put.id;
            if (!seen.has(key)) { seen.add(key); out.push(put); }
          });
        }
      });
      if (out.length === 0) {
        Object.values(SEARCH_MAP || {}).flat().forEach(raw => {
          const nn = norm(raw.name);
          if (nn.includes(qn) || qn.includes(nn)) {
            const put = enrich(raw);
            const key = put.id;
            if (!seen.has(key)) { seen.add(key); out.push(put); }
          }
        });
      }
    }

    setResults(out);
  }, [query, dataset]);

  const handleAdd = (item) => {
    try { addProduct(item); } catch (e) {}
    try { onSelect && onSelect(item); } catch (e) {}
  };

  const Item = ({ item }) => (
    <View style={{ backgroundColor:'#fff', borderRadius:16, padding:14, marginVertical:8, flexDirection:'row', alignItems:'center', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:6 }}>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:16, fontWeight:'800', color:'#111' }} numberOfLines={1}>{item.name}</Text>
        {!!item.detail && <Text style={{ fontSize:12, color:'#6B7280', marginTop:2 }} numberOfLines={1}>{item.detail}</Text>}
        <View style={{ flexDirection:'row', alignItems:'baseline', marginTop:8 }}>
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111' }}>{fmtEuro(item.price)} €</Text>
          {!!item.unitPrice && <Text style={{ marginLeft:8, color:'#9CA3AF' }}>{item.unitPrice}</Text>}
        </View>
      </View>
      <TouchableOpacity onPress={() => handleAdd(item)} activeOpacity={0.9} style={{ width:36, height:36, borderRadius:18, backgroundColor:BRAND, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color:'#fff', fontSize:20, lineHeight:20 }}>+</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity activeOpacity={1} onPress={()=>Keyboard.dismiss()} style={{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'flex-start' }}>
          <SafeAreaView style={{ flex:1, justifyContent:'flex-start' }}>
            <View style={{ backgroundColor:'#F8FAFC', borderBottomLeftRadius:24, borderBottomRightRadius:24, padding:16, maxHeight:'85%', marginTop:0 }}>
              <Text style={{ color:BRAND, fontWeight:'800', marginBottom:8 }}>{t('searchPopup.title') || 'What do you need?'}</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchPopup.placeholder') || 'Search a product'}
                autoFocus={false}
                style={{ backgroundColor:'#fff', paddingHorizontal:14, paddingVertical:12, borderRadius:14, fontSize:16 }}
              />

              <View style={{ flexDirection:'row', marginTop:10, marginBottom:6 }}>
                <View style={{ backgroundColor:'#fff', paddingHorizontal:14, paddingVertical:8, borderRadius:20, marginRight:8 }}>
                  <Text>Filter</Text>
                </View>
                <View style={{ backgroundColor:'#fff', paddingHorizontal:14, paddingVertical:8, borderRadius:20 }}>
                  <Text>Sort</Text>
                </View>
              </View>

              <FlatList
                data={results}
                keyExtractor={(it)=>String(it.id)}
                renderItem={({item}) => <Item item={item} />}
                ListEmptyComponent={<Text style={{ textAlign:'center', color:'#9CA3AF', marginTop:24 }}>{t('searchPopup.noResults') || 'No results'}</Text>}
                contentContainerStyle={{ paddingBottom:20 }}
                keyboardShouldPersistTaps="handled"
              />

              <View style={{ marginTop:8 }}>
                <TouchableOpacity onPress={onClose} activeOpacity={0.9} style={{ backgroundColor:'#0F172A', paddingVertical:14, borderRadius:14, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'800' }}>{t('searchPopup.close') || 'Close'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
