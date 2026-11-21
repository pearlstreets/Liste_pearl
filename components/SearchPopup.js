import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
// Ecran deplie d'un pliable : rendue sur la moitie qui l'ouvre.
import Modal from './DeuxEcrans';
import { useTranslation } from 'react-i18next';
import { addProduct } from '../lib/SelectedProducts';
import { autocorrectName } from '../utils/spellcheck';
import SEARCH_MAP from '../data/search-map.json';
import { libelleDetail } from '../lib/libelleDetail';
import { Ionicons } from '@expo/vector-icons';
import { MARCHE, SERIF, TAILLES } from './ui/marche';

const BRAND = MARCHE.noir;

const RptBtn = ({ onPress, onLongAction, style, children }) => {
  const ref = React.useRef(null);
  const cbRef = React.useRef(onLongAction);
  React.useEffect(() => {
    cbRef.current = onLongAction;
  }, [onLongAction]);
  React.useEffect(
    () => () => {
      if (ref.current) clearInterval(ref.current);
    },
    []
  );
  const start = () => {
    ref.current = setInterval(() => {
      cbRef.current();
    }, 80);
  };
  const stop = () => {
    if (ref.current) {
      clearInterval(ref.current);
      ref.current = null;
    }
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={start}
      onPressOut={stop}
      delayLongPress={200}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
};

const EMOJI_MAP = {
  pain: '🥖',
  baguette: '🥖',
  brioche: '🍞',
  croissant: '🥐',
  pomme: '🍎',
  banane: '🍌',
  tomate: '🍅',
  poulet: '🍗',
  yaourt: '🥛',
  lait: '🥛',
  fromage: '🧀',
  beurre: '🧈',
  oeuf: '🥚',
  riz: '🍚',
  pate: '🍝',
  pasta: '🍝',
  poisson: '🐟',
  saumon: '🐟',
  carotte: '🥕',
  salade: '🥬',
  orange: '🍊',
  citron: '🍋',
  eau: '💧',
  jus: '🧃',
  cafe: '☕',
  chocolat: '🍫',
  biscuit: '🍪',
  pizza: '🍕',
  viande: '🥩',
  steak: '🥩',
  jambon: '🥓',
  saucisse: '🌭',
  crevette: '🦐',
  oignon: '🧅',
  ail: '🧄',
  patate: '🥔',
  avocat: '🥑',
  champignon: '🍄',
  mais: '🌽',
  chips: '🍿',
  raisin: '🍇',
  fraise: '🍓',
  cerise: '🍒',
  melon: '🍈',
  ananas: '🍍',
  mangue: '🥭',
  poire: '🍐',
  peche: '🍑',
  huile: '🫒',
  sel: '🧂',
  sucre: '🍬',
  miel: '🍯',
  glace: '🍦',
  gateau: '🎂',
  boeuf: '🥩',
  porc: '🥩',
  dinde: '🍗',
  thon: '🐟',
  courgette: '🥒',
  concombre: '🥒',
  poivron: '🫑',
  brocoli: '🥦',
  aubergine: '🍆',
  haricot: '🫘',
  lentille: '🫘',
  soupe: '🥣',
  burger: '🍔',
  sandwich: '🥪',
  sushi: '🍣',
  kebab: '🥙',
  tacos: '🌮',
  wrap: '🌯',
  kiwi: '🥝',
  coco: '🥥',
  soda: '🥤',
  biere: '🍺',
  vin: '🍷',
  the: '🍵',
  savon: '🧴',
  shampoing: '🧴',
  lessive: '🧺',
  creme: '🥛',
  compote: '🍎',
  confiture: '🍯',
  moutarde: '🟡',
  ketchup: '🍅',
  sauce: '🥫',
  conserve: '🥫',
  sardine: '🐟',
  lardon: '🥓',
  bacon: '🥓',
  farine: '🌾',
  cereale: '🌾',
};
function getEmoji(name) {
  const n = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const [k, v] of Object.entries(EMOJI_MAP)) {
    if (n.includes(k)) return v;
  }
  return '🛒';
}

function stripDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(s) {
  return stripDiacritics(
    String(s || '')
      .toLowerCase()
      .trim()
  );
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
    if (u === 'g') return { qty: qty / 1000, unit: 'kg' };
    if (u === 'l') return { qty: qty, unit: 'l' };
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
  if (!isFinite(v)) return '';
  return Number(v).toFixed(2).replace('.', ',');
}
function unitPriceFromDetail(price, detail, priceFmt) {
  const u = parseUnit(detail);
  if (!u.qty || !u.unit) return '';
  const per = price && isFinite(price) ? price / u.qty : 0;
  const label = u.unit === 'kg' ? '/KG' : '/L';
  if (priceFmt) return priceFmt(per) + label;
  return fmtEuro(per) + ' €' + label;
}

function enrich(item, priceFmt) {
  if (!item || typeof item !== 'object') return item;
  const name = item.name || item.title || '';
  const price = Number.isFinite(item.price) ? item.price : parseFloat(item.price) || 0;
  let subtitle =
    item.detail || item.subtitle || item.subTitle || item.description || item.info || '';
  if (!subtitle) subtitle = 'Origine France – 1kg';
  let unitPrice =
    item.unitPrice || item.pricePerKg || item.price_per_kg || item.secondaryPrice || '';
  if (!unitPrice) unitPrice = unitPriceFromDetail(price, subtitle, priceFmt);

  return {
    ...item,
    id: item.id || norm(name + '|' + subtitle),
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

const SearchItem = React.memo(
  ({ item, selectedItems, onQtyChange, onQtyDelta, t, formatPrice, getEmoji }) => {
    const emoji = getEmoji(item.name);
    const translatedName = t('productNames.' + item.name, { defaultValue: item.name });
    const translatedDetail = libelleDetail(item.detail, t);
    const itemId = String(item.id);
    const selEntry = selectedItems[itemId];
    const qty = selEntry ? selEntry.qty : 0;
    const hasQty = qty > 0;

    const setQty = (newQty) => {
      if (newQty <= 0) {
        onQtyChange(item, 0);
      } else {
        onQtyChange(item, newQty);
      }
    };
    const inc = () => onQtyDelta(item, 1);
    const dec = () => onQtyDelta(item, -1);

    return (
      <View
        style={{
          backgroundColor: hasQty ? MARCHE.subtle : MARCHE.card,
          borderRadius: TAILLES.rayonCarte,
          padding: 14,
          marginVertical: 6,
          borderWidth: hasQty ? 1.5 : 1,
          borderColor: hasQty ? BRAND : MARCHE.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {(!hasQty && item.image) ? (
            <Image
              source={{ uri: item.image }}
              style={{ width: 44, height: 44, borderRadius: 14, marginRight: 12, backgroundColor: MARCHE.subtle }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: hasQty ? MARCHE.terraSoft : MARCHE.subtle,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              {hasQty ? (
                <Ionicons name="checkmark-circle" size={24} color={MARCHE.terra} />
              ) : (
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              )}
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: MARCHE.ink }} numberOfLines={1}>
              {translatedName}
            </Text>
            {!!translatedDetail && (
              <Text style={{ fontSize: 12, color: MARCHE.muted, marginTop: 2 }} numberOfLines={1}>
                {translatedDetail}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: MARCHE.ink }}>
                {formatPrice(item.price)}
              </Text>
              {!!item.unitPrice && (
                <Text style={{ marginLeft: 8, color: MARCHE.faint }}>{item.unitPrice}</Text>
              )}
            </View>
          </View>
          {qty === 0 ? (
            <RptBtn
              onPress={() => setQty(1)}
              onLongAction={inc}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: 1, borderColor: MARCHE.borderInput, backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color={MARCHE.noir} />
            </RptBtn>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {qty === 1 ? (
                <RptBtn
                  onPress={() => setQty(0)}
                  onLongAction={() => setQty(0)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: '#EF4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </RptBtn>
              ) : (
                <RptBtn
                  onPress={dec}
                  onLongAction={dec}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: MARCHE.borderInput,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="remove" size={16} color={MARCHE.muted} />
                </RptBtn>
              )}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: MARCHE.ink,
                  marginHorizontal: 6,
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {qty}
              </Text>
              <RptBtn
                onPress={inc}
                onLongAction={inc}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 1, borderColor: MARCHE.borderInput, backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={16} color={MARCHE.noir} />
              </RptBtn>
            </View>
          )}
        </View>
      </View>
    );
  }
);

export default function SearchPopup({
  visible,
  initialQuery = '',
  data,
  _shopNameFilter,
  shopName,
  onClose,
  onSelect,
  fmtPrice: fmtPriceProp,
  realShopMode = false,
}) {
  const { t } = useTranslation();
  const formatPrice = useMemo(() => fmtPriceProp || ((v) => fmtEuro(v) + ' €'), [fmtPriceProp]);
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  // Track items with qty > 0: { [itemId]: { item, qty } }
  const [selectedItems, setSelectedItems] = useState({});

  useEffect(() => {
    setQuery(initialQuery || '');
  }, [initialQuery]);
  useEffect(() => {
    if (visible) setSelectedItems({});
  }, [visible]);

  const dataset = useMemo(() => {
    const base = Array.isArray(data) ? data : [];
    return base.map((it, idx) => ({
      id: it.id || 'd-' + idx,
      name: it.name || it.title || '',
      detail: it.detail || it.subtitle || it.description || '',
      price: typeof it.price === 'number' ? it.price : parseFloat(it.price) || 0,
      unitPrice: it.unitPrice || it.pricePerKg || it.price_per_kg || it.secondaryPrice || '',
      available: typeof it.available === 'boolean' ? it.available : true,
      thumb: it.thumb || null,
      image: it.image || '',
    }));
  }, [data]);

  // Mode « boutique réelle » : on cherche UNIQUEMENT dans les vrais produits de
  // la boutique (jamais le catalogue local search-map). Forcé par realShopMode
  // (optimiseur) même si la liste est momentanément vide → « Aucun résultat »
  // honnête plutôt qu'un produit local sans rapport (ex. « papier toilette »).
  const hasData = Array.isArray(data) && data.length > 0;
  const realMode = realShopMode || hasData;

  useEffect(() => {
    // En mode boutique réelle : NE PAS « corriger » la requête. Le correcteur
    // (dictionnaire épicerie) peut remonter un produit sans rapport. Texte brut.
    const q = realMode ? (query || '') : autocorrectName(query || '');
    const qn = norm(q);
    if (!qn) {
      // Recherche vide : en mode boutique réelle → tous les produits de la
      // boutique ; sinon (legacy) → tout le catalogue local.
      if (realMode) {
        setResults(dataset.map((it) => enrich(it, fmtPriceProp)));
        return;
      }
      const all = [];
      const seen = new Set();
      const skipCat = new Set([
        'fruits',
        'legumes',
        'viande',
        'poisson',
        'surgeles',
        'boisson',
        'petit dejeuner',
        'hygiene',
        'menage',
      ]);
      Object.keys(SEARCH_MAP || {}).forEach((k) => {
        if (skipCat.has(k)) return;
        (SEARCH_MAP[k] || []).forEach((raw) => {
          const put = enrich(raw, fmtPriceProp);
          if (!seen.has(put.name)) {
            seen.add(put.name);
            all.push(put);
          }
        });
      });
      setResults(all);
      return;
    }
    const out = [];
    for (const it of dataset) {
      const inName = norm(it.name).includes(qn);
      const inDetail = norm(it.detail).includes(qn);
      if (inName || inDetail) out.push(enrich(it, fmtPriceProp));
    }
    // Repli sur le catalogue local UNIQUEMENT hors mode boutique réelle : en mode
    // boutique réelle, si le produit n'est pas dans la boutique → « Aucun résultat ».
    if (out.length === 0 && !realMode) {
      const seen = new Set();
      Object.keys(SEARCH_MAP || {}).forEach((k) => {
        const kn = norm(k);
        if (qn === kn || qn.includes(kn) || kn.includes(qn)) {
          (SEARCH_MAP[k] || []).forEach((raw) => {
            const put = enrich(raw, fmtPriceProp);
            const key = put.id;
            if (!seen.has(key)) {
              seen.add(key);
              out.push(put);
            }
          });
        }
      });
      if (out.length === 0) {
        Object.values(SEARCH_MAP || {})
          .flat()
          .forEach((raw) => {
            const nn = norm(raw.name);
            if (nn.includes(qn) || qn.includes(nn)) {
              const put = enrich(raw, fmtPriceProp);
              const key = put.id;
              if (!seen.has(key)) {
                seen.add(key);
                out.push(put);
              }
            }
          });
      }
    }
    setResults(out);
  }, [query, dataset, fmtPriceProp, realMode]);

  const onQtyChange = useCallback((item, qty) => {
    setSelectedItems((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[String(item.id)];
        return next;
      }
      return { ...prev, [String(item.id)]: { item, qty } };
    });
  }, []);

  const onQtyDelta = useCallback((item, delta) => {
    setSelectedItems((prev) => {
      const cur = prev[String(item.id)]?.qty || 0;
      const next = cur + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[String(item.id)];
        return copy;
      }
      return { ...prev, [String(item.id)]: { item, qty: next } };
    });
  }, []);

  const handleRemove = useCallback((itemId) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      delete next[String(itemId)];
      return next;
    });
  }, []);

  const handleFinish = useCallback(() => {
    // Add all selected items to cart
    const items = Object.values(selectedItems);
    for (const { item, qty } of items) {
      const enriched = { ...item, qty };
      try {
        addProduct(enriched);
      } catch {}
      try {
        onSelect && onSelect(enriched);
      } catch {}
    }
    onClose();
  }, [selectedItems, onSelect, onClose]);

  const selList = Object.values(selectedItems).reverse();
  const totalCount = selList.reduce((s, a) => s + a.qty, 0);

  const renderItem = useCallback(
    ({ item }) => (
      <SearchItem
        item={item}
        selectedItems={selectedItems}
        onQtyChange={onQtyChange}
        onQtyDelta={onQtyDelta}
        t={t}
        formatPrice={formatPrice}
        getEmoji={getEmoji}
      />
    ),
    [selectedItems, onQtyChange, onQtyDelta, t, formatPrice]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleFinish}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(46,28,18,0.45)' }}>
          <TouchableWithoutFeedback onPress={handleFinish}>
            <View style={{ height: '10%' }} />
          </TouchableWithoutFeedback>

          <View
            style={{
              flex: 1,
              backgroundColor: MARCHE.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <View style={{ paddingHorizontal: TAILLES.marge, paddingTop: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: MARCHE.ink,
                    fontWeight: '600',
                    fontSize: 20,
                    flexShrink: 1,
                  }}
                >
                  {shopName || t('searchPopup.title') || 'What do you need?'}
                </Text>
                <TouchableOpacity
                  onPress={handleFinish}
                  style={{
                    width: TAILLES.icone,
                    height: TAILLES.icone,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: -8,
                  }}
                >
                  <Text style={{ fontSize: 22, color: MARCHE.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchPopup.placeholder') || 'Search a product'}
                autoFocus={false}
                autoCapitalize="sentences"
                keyboardType="default"
                textContentType="none"
                autoCorrect={true}
                spellCheck={true}
                placeholderTextColor={MARCHE.faint}
                style={{
                  backgroundColor: MARCHE.card,
                  borderWidth: 1,
                  borderColor: MARCHE.borderInput,
                  height: TAILLES.champ,
                  paddingHorizontal: 14,
                  borderRadius: TAILLES.rayonCarte,
                  fontSize: 16,
                  color: MARCHE.ink,
                }}
              />
            </View>

            {/* Search results */}
            <FlatList
              data={results}
              keyExtractor={(it) => String(it.id)}
              renderItem={renderItem}
              extraData={selectedItems}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: MARCHE.faint, marginTop: 24 }}>
                  {t('searchPopup.noResults') || 'No results'}
                </Text>
              }
              contentContainerStyle={{
                paddingHorizontal: TAILLES.marge,
                paddingBottom: 20,
                paddingTop: 10,
              }}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
            />

            {/* Bottom: selected items list + Terminer */}
            <SafeAreaView style={{ backgroundColor: MARCHE.card }}>
              {selList.length > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: MARCHE.border }}>
                  <ScrollView
                    style={{ paddingHorizontal: TAILLES.marge, maxHeight: 120 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {selList.map((a) => {
                      const nm = t('productNames.' + a.item.name, { defaultValue: a.item.name });
                      const em = getEmoji(a.item.name);
                      const lineTotal = a.item.price * a.qty;
                      return (
                        <View
                          key={String(a.item.id)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            minHeight: 40,
                            paddingVertical: 7,
                            borderBottomWidth: 1,
                            borderBottomColor: MARCHE.border,
                          }}
                        >
                          <Text style={{ fontSize: 16, marginRight: 8 }}>{em}</Text>
                          <Text
                            style={{ flex: 1, fontSize: 13, fontWeight: '600', color: MARCHE.ink }}
                            numberOfLines={1}
                          >
                            {nm}
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: MARCHE.ink,
                              marginRight: 8,
                            }}
                          >
                            {formatPrice(lineTotal)}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {a.qty === 1 ? (
                              <RptBtn
                                onPress={() => handleRemove(a.item.id)}
                                onLongAction={() => handleRemove(a.item.id)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  borderWidth: 1.5,
                                  borderColor: '#EF4444',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                              </RptBtn>
                            ) : (
                              <RptBtn
                                onPress={() => onQtyDelta(a.item, -1)}
                                onLongAction={() => onQtyDelta(a.item, -1)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  borderWidth: 1.5,
                                  borderColor: MARCHE.borderInput,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="remove" size={14} color={MARCHE.muted} />
                              </RptBtn>
                            )}
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: MARCHE.ink,
                                marginHorizontal: 5,
                                minWidth: 16,
                                textAlign: 'center',
                              }}
                            >
                              {a.qty}
                            </Text>
                            <RptBtn
                              onPress={() => onQtyDelta(a.item, 1)}
                              onLongAction={() => onQtyDelta(a.item, 1)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                borderWidth: 1, borderColor: MARCHE.borderInput, backgroundColor: '#FFFFFF',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="add" size={14} color={MARCHE.noir} />
                            </RptBtn>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                  {/* Nombre de produits sélectionnés */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: TAILLES.marge,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: MARCHE.ink }}>
                      {t('counts.items', { count: selList.reduce((s, a) => s + a.qty, 0) })}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND }}>
                      {formatPrice(selList.reduce((s, a) => s + a.item.price * a.qty, 0))}
                    </Text>
                  </View>
                </View>
              )}
              <View style={{ paddingHorizontal: TAILLES.marge, paddingVertical: 10 }}>
                <TouchableOpacity
                  onPress={handleFinish}
                  activeOpacity={0.9}
                  style={{
                    borderWidth: 1, borderColor: MARCHE.borderInput, backgroundColor: '#FFFFFF',
                    height: TAILLES.bouton,
                    borderRadius: TAILLES.rayonBouton,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="cart" size={18} color={MARCHE.noir} style={{ marginRight: 8 }} />
                  <Text style={{ color: MARCHE.noir, fontWeight: '700', fontSize: 16 }}>
                    {t('cart.addToCart') || 'Ajouter'} ({totalCount})
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
