import React, { useEffect, useState, useMemo } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, Modal, Keyboard, Platform, KeyboardAvoidingView, InputAccessoryView, Switch, Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DeviceEventEmitter } from 'react-native';
import { useCartEvents } from '../context/CartContext';
import { autocorrectName } from '../utils/spellcheck';
import { setOptimized, isOptimized } from '../utils/distributionMode';
import { BRAND, GUTTER } from '../constants/brand';
import { KEY_ITEMS, KEY_SELECTED } from '../constants/storageKeys';
import { ProductThumb } from '../constants/productImages';
import { Square } from '../components/Square';
import { QtyInput } from '../components/QtyInput';
import { RepeatButton } from '../components/RepeatButton';
import { PillScan } from '../components/PillScan';
import { Toast } from '../components/Toast';
import { Radio } from '../components/Radio';
import { styles } from '../styles/shared';
import { ListSharingSection } from '../components/ui/ListSharing';

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

function ListScreen({ isGuest = false, onLogin }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { notifyCartUpdate, notifyProductsReset } = useCartEvents();
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
        ListFooterComponent={() => (
          <ListSharingSection
            ownerPseudo=""
            requireAuth={isGuest && onLogin ? onLogin : undefined}
          />
        )}
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
        notifyProductsReset();
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

export { parseMulti };
export default ListScreen;
