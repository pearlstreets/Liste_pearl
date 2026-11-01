// Courses du menu : par rayon, "je l'ai déjà", choix de la liste Pearl, ajout (différence seulement).
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  DeviceEventEmitter,
} from 'react-native';
import { prefillProducts } from '../../lib/menus/listBridge';
import { Ionicons } from '../ui/IoniconsSens';
import { useIsFocused } from '@react-navigation/native';
import { formatEur, readMyLists, pendingLines } from '../../lib/menus';
import { T } from './theme';
import { Chip, PrimaryButton, Empty } from './ui';
import { AddedSheet } from './Sheets';
import { useMenus } from './MenusContext';
import useT from './useT';
import { lineTexts } from '../../lib/menus/lineText';
import { matchLines } from '../../lib/menus/pearl';
import { getTexts } from '../../lib/menus/recipes';
import { usePearlShops, openShopFromMenus } from './usePearl';

const Row = React.memo(function Row({
  line,
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
      style={[s.row, have && { opacity: 0.5 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: have }}
      accessibilityLabel={`${name}, ${haveLabel}`}
    >
      <View style={s.emoji}>
        <Text style={{ fontSize: 22 }}>{line.emoji || '🛒'}</Text>
      </View>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={[s.name, have && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={s.detail} numberOfLines={2}>
          {packText ? `${qtyText} · ${packText}` : qtyText}
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
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.price}>{priceText}</Text>
        <View style={[s.check, have && s.checkOn]}>
          {have ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
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
        const diff = await pendingLines(listId, activeLines, (l) => texts.ingredientName(l.key));
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
  }, [activeLines, listId, added, focused, texts]);

  const send = useCallback(async () => {
    if (sending) return;
    setSending(true);
    const r = await m.sendToList(listId, activeLines);
    setSending(false);
    setAdded(r);
  }, [m, listId, activeLines, sending]);

  const goList = async (screen) => {
    setAdded(null);
    if (screen === 'products') {
      await prefillProducts();
      try {
        DeviceEventEmitter.emit('PRODUCTS_RESET');
      } catch {}
    }
    try {
      navigation.navigate(screen);
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
    ({ item }) => {
      const lt = lineTexts(item, t, { lang, labels: qtyLabels });
      return (
        <Row
          line={item}
          name={texts.ingredientName(item.key)}
          have={removedSet.has(item.key)}
          onToggle={toggleHave}
          qtyText={lt.qtyText}
          packText={lt.packText}
          priceText={item.free ? '' : `${item.priceKnown ? '' : '~'}${formatEur(item.estimatedEur, lang)}`}
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
        emoji="🛒"
        title={t('shop.emptyTitle')}
        text={t('shop.emptyText')}
        action={
          <PrimaryButton
            soft
            icon="calendar"
            label={t('shop.goPlan')}
            onPress={onOpenPlan}
            style={{ alignSelf: 'stretch' }}
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
        : t('shop.add');

  const header = (
    <View style={{ paddingBottom: 6 }}>
      <Text style={s.big}>{t('shop.title')}</Text>
      <Text style={s.sub}>{t('shop.summary', { count, total: formatEur(total, lang) })}</Text>
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
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHead}>
            <Text style={s.sectionTxt}>{t(`aisles.${section.aisle}`)}</Text>
            <Text style={s.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Empty emoji="🧺" title={t('shop.noneTitle')} text={t('shop.noneText')} />
        }
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
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
          disabled={state.kind === 'already' || state.kind === 'empty'}
          loading={sending}
          onPress={send}
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
  big: { fontSize: 34, fontWeight: '900', color: T.ink, letterSpacing: -0.5, marginTop: 6 },
  sub: { fontSize: 15, color: T.ink, fontWeight: '700', marginTop: 2 },
  note: { fontSize: 12, color: T.faint, marginTop: 4, lineHeight: 17 },
  label: { fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 18, marginBottom: 10 },
  hint: { fontSize: 12, color: T.muted, marginTop: 8 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 6,
  },
  sectionTxt: { fontSize: 18, fontWeight: '900', color: T.ink },
  sectionCount: {
    fontSize: 13,
    fontWeight: '800',
    color: T.brandDark,
    backgroundColor: T.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadowSm,
  },
  emoji: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: T.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: T.ink },
  detail: { fontSize: 13, color: T.muted, marginTop: 2 },
  used: { fontSize: 12, color: T.faint, marginTop: 1 },
  pearl: { fontSize: 12, color: T.brandDark, fontWeight: '700', marginTop: 2 },
  pearlBox: {
    backgroundColor: T.brandSoft,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  pearlTitle: { fontSize: 14, fontWeight: '800', color: T.ink },
  pearlNote: { fontSize: 12, color: T.muted, marginTop: 2 },
  pearlSub: { fontSize: 13, fontWeight: '800', color: T.ink, marginTop: 10, marginBottom: 4 },
  pearlShop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
  },
  pearlShopName: { fontSize: 14, fontWeight: '800', color: T.ink },
  pearlShopSub: { fontSize: 12, color: T.muted, marginTop: 1 },
  price: { fontSize: 14, fontWeight: '800', color: T.ink, marginBottom: 6 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: T.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: T.brand, borderColor: T.brand },
  bar: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
});
