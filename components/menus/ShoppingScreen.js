// Courses du menu : par rayon, "je l'ai déjà", choix de la liste Pearl, ajout (différence seulement).
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  DeviceEventEmitter,
  Alert,
} from 'react-native';
import { prefillProducts } from '../../lib/menus/listBridge';
import { Ionicons } from '../ui/IoniconsSens';
import { useIsFocused } from '@react-navigation/native';
import { formatEur, readMyLists, pendingLines } from '../../lib/menus';
import { T, SERIF, TAILLES } from './theme';
import { MARCHE } from '../ui/marche';
import { Chip, PrimaryButton, Empty } from './ui';
import { AddedSheet } from './Sheets';
import { useMenus } from './MenusContext';
import useT from './useT';
import { lineTexts } from '../../lib/menus/lineText';
import { matchLines } from '../../lib/menus/pearl';
import { getTexts } from '../../lib/menus/recipes';
import { usePearlShops, openShopFromMenus } from './usePearl';
import { IngredientThumb } from './RecipeVisual';
import { allerA } from '../../app/onglets';

// Icône de chaque rayon (titres de rayon en style Marché).
const AISLE_ICON = {
  'fruits-legumes': 'leaf-outline',
  'viandes-poissons': 'fish-outline',
  cremerie: 'egg-outline',
  epicerie: 'basket-outline',
  surgeles: 'snow-outline',
  boulangerie: 'restaurant-outline',
  boissons: 'wine-outline',
};

const Row = React.memo(function Row({
  line,
  first,
  lastRow,
  name,
  have,
  onToggle,
  qtyText,
  packText,
  priceText,
  usedText,
  haveLabel,
  pearlText,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onToggle(line.key)}
      style={[s.row, first && s.rowFirst, lastRow && s.rowLast, !first && s.rowSep]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: have }}
      accessibilityLabel={`${name}, ${haveLabel}`}
    >
      <View style={[s.check, have && s.checkOn]}>
        {have ? <Ionicons name="checkmark" size={14} color={MARCHE.blanc} /> : null}
      </View>
      <IngredientThumb
        ingKey={String(line.key).split('|')[0]}
        size={40}
        style={[{ marginRight: 12 }, have && { opacity: 0.5 }]}
      />
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={[s.name, have && s.nameHave]} numberOfLines={1}>
          {name}
        </Text>
        {usedText ? (
          <Text style={s.used} numberOfLines={1}>
            {usedText}
          </Text>
        ) : null}
        {pearlText ? (
          <Text style={s.pearl} numberOfLines={1}>
            {pearlText}
          </Text>
        ) : null}
      </View>
      <View style={s.right}>
        <Text style={s.detail} numberOfLines={2}>
          {packText ? `${qtyText} · ${packText}` : qtyText}
        </Text>
        {priceText ? <Text style={[s.price, have && { color: T.faint }]}>{priceText}</Text> : null}
      </View>
    </TouchableOpacity>
  );
});

export default function ShoppingScreen({ navigation, onOpenPlan }) {
  const t = useT();
  const m = useMenus();
  const { shopping, activeLines, removedSet, toggleHave, texts, lang, pantryOn, setPantryOn } = m;
  const [lists, setLists] = useState({ lists: [], activeId: 'default' });
  const [target, setTarget] = useState(null);
  const [state, setState] = useState({ kind: 'new', count: 0 });
  const [added, setAdded] = useState(null);
  const [sending, setSending] = useState(false);
  const focused = useIsFocused();
  const pearlShops = usePearlShops('product_purchase');
  const pearl = useMemo(() => {
    const fr = getTexts('fr');
    return matchLines(activeLines, pearlShops, (k) => fr.ingredientName(k));
  }, [activeLines, pearlShops]);

  // Les listes peuvent changer pendant que l'on est ailleurs : on relit à chaque retour sur l'onglet.
  useEffect(() => {
    if (!focused) return undefined;
    let alive = true;
    readMyLists().then((r) => {
      if (alive) setLists(r);
    });
    return () => {
      alive = false;
    };
  }, [focused]);
  const listId = target && lists.lists.some((x) => x.id === target) ? target : lists.activeId;
  const listName = useMemo(() => {
    const l = lists.lists.find((x) => x.id === listId);
    return (l && l.name) || t('shop.defaultList');
  }, [lists, listId, t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (activeLines.length === 0) return alive && setState({ kind: 'empty', count: 0 });
      try {
        const diff = await pendingLines(
          listId,
          activeLines,
          (l) => texts.ingredientName(l.key),
          (m.plan && m.plan.weekStart) || null
        );
        if (diff.length === 0) return alive && setState({ kind: 'already', count: 0 });
        const some = diff.length < activeLines.length;
        alive &&
          setState({
            kind: some ? 'delta' : 'new',
            count: diff.length,
          });
      } catch {
        alive && setState({ kind: 'new', count: activeLines.length });
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeLines, listId, added, focused, texts, m.plan]);

  const doSend = useCallback(async () => {
    if (sending) return;
    setSending(true);
    const r = await m.sendToList(listId, activeLines);
    setSending(false);
    setAdded(r);
  }, [m, listId, activeLines, sending]);

  // Repas qui ne conviennent plus aux allergies ou régimes : jamais envoyés à la liste sans accord explicite.
  const nBad = (m.unsuitable || []).length;
  const send = useCallback(() => {
    if (sending) return;
    // Tout est déjà dans la liste : on ouvre la fiche « déjà ajouté » (voir ou comparer la liste) au lieu d'une impasse.
    if (state.kind === 'already') {
      setAdded({ status: 'already', count: 0 });
      return;
    }
    if (nBad === 0) {
      doSend();
      return;
    }
    Alert.alert(t('myRecipes.confirmTitle'), t('week.unsuitableConfirm', { count: nBad }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('week.unsuitableAction', { count: nBad }), onPress: () => m.replaceUnsuitable() },
      { text: t('myRecipes.confirmAdd'), style: 'destructive', onPress: doSend },
    ]);
  }, [sending, state.kind, nBad, doSend, m, t]);

  const goList = async (screen) => {
    setAdded(null);
    if (screen === 'products') {
      await prefillProducts(listId);
      try {
        DeviceEventEmitter.emit('PRODUCTS_RESET');
      } catch {}
    }
    try {
      // Liste remplie autre que l'active : Ma Liste l'ouvre (paramètre lu par ListScreen).
      if (screen === 'myList' && listId !== lists.activeId) {
        allerA(navigation, screen, { listId, n: Date.now() });
      } else {
        allerA(navigation, screen);
      }
    } catch {}
  };

  const sections = useMemo(() => {
    if (!shopping) return [];
    return shopping.byAisle.map((g) => ({ aisle: g.aisle, total: g.totalEur, data: g.lines }));
  }, [shopping]);

  const qtyLabels = useMemo(
    () => ({
      g: t('units.g'),
      kg: t('units.kg'),
      ml: t('units.ml'),
      l: t('units.l'),
      u: t('units.u'),
    }),
    [t]
  );
  const renderItem = useCallback(
    ({ item, index, section }) => {
      const lt = lineTexts(item, t, { lang, labels: qtyLabels });
      return (
        <Row
          line={item}
          first={index === 0}
          lastRow={index === section.data.length - 1}
          name={texts.ingredientName(item.key)}
          have={removedSet.has(item.key)}
          onToggle={toggleHave}
          qtyText={lt.qtyText}
          packText={lt.packText}
          priceText={
            item.free ? '' : `${item.priceKnown ? '' : '~'}${formatEur(item.estimatedEur, lang)}`
          }
          usedText={
            Array.isArray(item.usedIn) && item.usedIn.length > 1
              ? t('shop.usedIn', { count: item.usedIn.length })
              : ''
          }
          haveLabel={t('shop.have')}
          pearlText={
            pearl.byKey[item.key]
              ? t('pearl.line', {
                  count: pearl.byKey[item.key].count,
                  price: formatEur(pearl.byKey[item.key].min, lang),
                })
              : ''
          }
        />
      );
    },
    [texts, removedSet, toggleHave, lang, qtyLabels, t, pearl]
  );

  if (!shopping) {
    return (
      <Empty
        icon="cart-outline"
        title={t('shop.emptyTitle')}
        text={t('shop.emptyText')}
        action={
          <PrimaryButton
            soft
            icon="calendar"
            label={t('shop.goPlan')}
            onPress={onOpenPlan}
            style={[s.btnMain, { alignSelf: 'stretch' }]}
          />
        }
      />
    );
  }

  const count = activeLines.length;
  const total = activeLines.reduce((a, l) => a + (l.estimatedEur || 0), 0);
  const label =
    state.kind === 'already'
      ? t('shop.alreadyAdded')
      : state.kind === 'delta'
        ? t('shop.addDelta', { count: state.count })
        : t('recipe.addToList');

  const header = (
    <View style={{ paddingBottom: 6 }}>
      <Text style={s.sub}>{t('shop.summary', { count, total: formatEur(total, lang) })}</Text>
      <Text style={s.big}>{t('shop.title')}</Text>
      <Text style={s.note}>{t('shop.estimateNote')}</Text>
      {shopping && shopping.unpricedCount > 0 ? (
        <Text style={s.note}>{t('shop.unpriced', { count: shopping.unpricedCount })}</Text>
      ) : null}
      {shopping && shopping.missingRecipes && shopping.missingRecipes.length > 0 ? (
        <Text style={s.note}>{t('shop.missingRecipes')}</Text>
      ) : null}
      {pearl.covered.length > 0 ? (
        <View style={s.pearlBox}>
          <Text style={s.pearlTitle}>
            {t('pearl.summary', {
              count: pearl.covered.length,
              total: formatEur(pearl.totalReal, lang),
            })}
          </Text>
          <Text style={s.pearlNote}>{t('pearl.realNote')}</Text>
          {pearl.best.length > 0 ? <Text style={s.pearlSub}>{t('pearl.coverTitle')}</Text> : null}
          {pearl.best.map((b) => (
            <TouchableOpacity
              key={String(b.shop.id)}
              activeOpacity={0.8}
              onPress={() => openShopFromMenus(navigation, b.shop)}
              style={s.pearlShop}
              accessibilityRole="button"
              accessibilityLabel={b.shop.name}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.pearlShopName} numberOfLines={1}>
                  {b.shop.name}
                </Text>
                <Text style={s.pearlShopSub} numberOfLines={2}>
                  {t('pearl.coverItem', {
                    count: b.count,
                    total: activeLines.length,
                    price: formatEur(b.total, lang),
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.muted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <Text style={s.label}>{t('shop.targetList')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {lists.lists.map((l) => (
          <Chip
            key={l.id}
            icon="list"
            label={l.name || t('shop.defaultList')}
            on={l.id === listId}
            onPress={() => setTarget(l.id)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
        <Chip
          small
          icon={pantryOn ? 'checkmark' : 'add'}
          label={t('shop.showBasics')}
          on={pantryOn}
          onPress={() => setPantryOn(!pantryOn)}
        />
      </View>
      <Text style={s.hint}>{t('shop.haveHint')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHead}>
            <Ionicons
              name={AISLE_ICON[section.aisle] || 'basket-outline'}
              size={17}
              color={T.brand}
              style={{ marginRight: 8 }}
            />
            <Text style={s.sectionTxt} numberOfLines={1}>
              {t(`aisles.${section.aisle}`)}
            </Text>
            <Text style={s.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Empty icon="basket-outline" title={t('shop.noneTitle')} text={t('shop.noneText')} />
        }
        contentContainerStyle={{ paddingHorizontal: TAILLES.marge, paddingBottom: 24 }}
        stickySectionHeadersEnabled={false}
        initialNumToRender={14}
        windowSize={7}
        showsVerticalScrollIndicator={false}
      />
      <View style={s.bar}>
        <PrimaryButton
          icon={state.kind === 'already' ? 'checkmark-done' : 'add-circle'}
          label={label}
          soft={state.kind === 'already'}
          disabled={state.kind === 'empty'}
          loading={sending}
          onPress={send}
          style={[s.btnMain, state.kind !== 'already' && s.btnNoir]}
        />
      </View>
      {added ? (
        <AddedSheet
          result={added}
          listName={listName}
          onClose={() => setAdded(null)}
          onSeeList={() => goList('myList')}
          onCompare={() => goList('products')}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  big: { fontFamily: SERIF, fontSize: 26, fontWeight: '400', color: T.ink, letterSpacing: -0.3, marginTop: 2 },
  sub: { fontSize: 12, color: T.muted, fontWeight: '600', marginTop: 8, letterSpacing: 0.3 },
  note: { fontSize: 12, color: T.faint, marginTop: 4, lineHeight: 17 },
  label: { fontSize: 15, fontWeight: '600', color: T.ink, marginTop: 18, marginBottom: 10 },
  hint: { fontSize: 12, color: T.muted, marginTop: 8 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTxt: { flex: 1, fontFamily: SERIF, fontSize: 15, fontWeight: '600', color: T.ink },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: T.brandDark,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  // Articles d'un même rayon : une seule carte blanche, lignes séparées par un trait fin.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: T.border,
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: TAILLES.rayonCarte,
    borderTopRightRadius: TAILLES.rayonCarte,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: TAILLES.rayonCarte,
    borderBottomRightRadius: TAILLES.rayonCarte,
  },
  rowSep: { borderTopWidth: 1, borderTopColor: T.border },
  name: { fontSize: 16, fontWeight: '600', color: T.ink },
  nameHave: { color: T.faint, textDecorationLine: 'line-through' },
  right: { alignItems: 'flex-end', justifyContent: 'center', maxWidth: '38%' },
  detail: { fontSize: 13, color: T.faint, textAlign: 'right' },
  used: { fontSize: 12, color: T.faint, marginTop: 2 },
  pearl: { fontSize: 12, color: T.brandDark, fontWeight: '700', marginTop: 2 },
  pearlBox: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: TAILLES.rayonCarte,
    padding: 12,
    marginTop: 12,
  },
  pearlTitle: { fontSize: 14, fontWeight: '600', color: T.ink },
  pearlNote: { fontSize: 12, color: T.muted, marginTop: 2 },
  pearlSub: { fontSize: 13, fontWeight: '600', color: T.ink, marginTop: 10, marginBottom: 4 },
  pearlShop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: TAILLES.rayonCarte,
    paddingVertical: 9,
    marginTop: 6,
  },
  pearlShopName: { fontSize: 14, fontWeight: '600', color: T.ink },
  pearlShopSub: { fontSize: 12, color: T.muted, marginTop: 1 },
  price: { fontSize: 14, fontWeight: '600', color: T.ink, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: T.borderInput,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkOn: { backgroundColor: MARCHE.vert, borderColor: MARCHE.vert },
  btnMain: {
    height: TAILLES.bouton,
    minHeight: TAILLES.bouton,
    borderRadius: TAILLES.rayonBouton,
  },
  btnNoir: { backgroundColor: MARCHE.vert },
  bar: {
    paddingHorizontal: TAILLES.marge,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: T.card,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
});
