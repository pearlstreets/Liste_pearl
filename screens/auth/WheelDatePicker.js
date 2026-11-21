import React from "react";
import { View, Text, TouchableOpacity, Pressable, ScrollView } from "react-native";
// Modal de react-native, sauf sur l'ecran deplie d'un pliable Android (voir le fichier).
import Modal from "../../components/DeuxEcrans";
import { TAILLES } from "../../components/ui/marche";
import { THEME } from "../../components/commun/theme";
import { lstyles } from "../../components/commun/lstyles";

// ---- Roulette de date (JS pur, sans module natif) ----
const WHEEL_ITEM_H = 42;
const WHEEL_VISIBLE = 5; // impair -> ligne centrale = sélection

function WheelColumn({ data, initialIndex, onSettle, width, formatItem }) {
  const ref = React.useRef(null);
  const pad = (WHEEL_VISIBLE - 1) / 2;
  const [sel, setSel] = React.useState(initialIndex);
  React.useEffect(() => {
    const tm = setTimeout(() => ref.current?.scrollTo({ y: initialIndex * WHEEL_ITEM_H, animated: false }), 30);
    return () => clearTimeout(tm);
  }, []);
  const settle = (y) => {
    let idx = Math.round(y / WHEEL_ITEM_H);
    idx = Math.max(0, Math.min(data.length - 1, idx));
    setSel(idx);
    onSettle(idx);
    ref.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: true });
  };
  return (
    <ScrollView
      ref={ref}
      style={{ width, height: WHEEL_ITEM_H * WHEEL_VISIBLE }}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_H}
      decelerationRate="fast"
      nestedScrollEnabled
      onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
      contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * pad }}
    >
      {data.map((d, i) => (
        <View key={i} style={{ height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 19, fontWeight: i === sel ? '600' : '500', color: i === sel ? THEME.ink : THEME.faint }}>
            {formatItem ? formatItem(d) : d}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

export default function WheelDatePicker({ visible, value, onCancel, onConfirm, t }) {
  if (!visible) return null;
  const now = new Date();
  const maxYear = now.getFullYear() - 13;      // 13+ (comme un compte user)
  const minYear = now.getFullYear() - 100;
  const years = []; for (let y = maxYear; y >= minYear; y--) years.push(y);
  const months = [1,2,3,4,5,6,7,8,9,10,11,12];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value || '');
  const init = m ? { y: +m[1], mo: +m[2], d: +m[3] } : { y: maxYear - 12, mo: 1, d: 1 };
  const sel = React.useRef({
    y: Math.max(0, years.indexOf(init.y)),
    mo: Math.max(0, Math.min(11, init.mo - 1)),
    d: Math.max(0, Math.min(30, init.d - 1)),
  });
  const confirm = () => {
    const y = years[sel.current.y];
    const mo = months[sel.current.mo];
    const maxD = new Date(y, mo, 0).getDate();          // jours du mois
    const d = Math.min(days[sel.current.d], maxD);
    onConfirm(`${y}-${pad2(mo)}-${pad2(d)}`);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={lstyles.modalBackdrop} onPress={onCancel}>
        <Pressable style={[lstyles.modalBox, { paddingHorizontal: 10 }]} onPress={() => {}}>
          <Text style={[lstyles.modalTitle, { textAlign: 'center' }]}>{t('auth.dob', 'Date de naissance')}</Text>
          <View style={{ height: WHEEL_ITEM_H * WHEEL_VISIBLE, justifyContent: 'center' }}>
            {/* bande de sélection centrale */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 8, top: WHEEL_ITEM_H * 2, height: WHEEL_ITEM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: THEME.border, backgroundColor: THEME.brandSoft, borderRadius: 10 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <WheelColumn data={days} initialIndex={sel.current.d} onSettle={(i) => { sel.current.d = i; }} width={70} formatItem={pad2} />
              <WheelColumn data={months} initialIndex={sel.current.mo} onSettle={(i) => { sel.current.mo = i; }} width={70} formatItem={pad2} />
              <WheelColumn data={years} initialIndex={sel.current.y} onSettle={(i) => { sel.current.y = i; }} width={90} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, gap: 10 }}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.8} style={{ paddingHorizontal: 16, height: TAILLES.boutonPetit, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '700', color: THEME.muted }}>{t('listScreen.cancel', 'Annuler')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, borderRadius: TAILLES.rayonBouton, paddingHorizontal: 22, height: TAILLES.boutonPetit, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '600', color: THEME.ink }}>{t('auth.confirm', 'Confirmer')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
