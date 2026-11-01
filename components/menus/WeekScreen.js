// Accueil "Ma semaine" : budget estimé, jours, cartes repas, validation en un geste.
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  DeviceEventEmitter,
  useWindowDimensions,
} from 'react-native';
import { prefillProducts, readMyLists } from '../../lib/menus/listBridge';
import { Ionicons } from '@expo/vector-icons';
import { mealsByDay, formatEur } from '../../lib/menus';
import { T } from './theme';
import { PrimaryButton, Empty, Loading, ErrorBox, RoundIcon } from './ui';
import MealCard, { isolerPrix } from './MealCard';
import { SwapSheet, AddedSheet } from './Sheets';
import { useMenus } from './MenusContext';
import useT from './useT';
import { weekTarget, parseISO, dayIndexIn } from '../../lib/menus/weeks';
import { nearbyShops } from '../../lib/menus/pearl';
import { usePearlShops, useKnownPlace, openShopFromMenus } from './usePearl';

/** Libellé exact de la semaine ("Semaine du 2 novembre"), jamais une formule vague. */
export function weekLabel(weekStart, lang, t) {
  const iso = parseISO(weekStart) ? weekStart : weekTarget().start;
  const date = parseISO(iso);
  let txt = iso;
  try {
    txt = date.toLocaleDateString(lang || undefined, { day: 'numeric', month: 'long' });
  } catch {}
  return t('week.weekOf', { date: txt });
}

const DayPill = React.memo(function DayPill({ d, selected, count, today, onPress, label, a11y }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(d)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      style={[s.pill, selected && s.pillOn]}
    >
      <Text style={[s.pillTxt, selected && { color: '#fff' }]}>{label}</Text>
      <View style={s.pillDots}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              s.pillDot,
              i < count && { backgroundColor: selected ? '#fff' : T.brand },
              selected && i >= count && { backgroundColor: 'rgba(255,255,255,0.4)' },
            ]}
          />
        ))}
      </View>
      {today ? <View style={[s.today, selected && { backgroundColor: '#fff' }]} /> : null}
    </TouchableOpacity>
  );
});

export default function WeekScreen({
  navigation,
  onOpenRecipe,
  onOpenShop,
  onOpenBatch,
  onOpenShared,
}) {
  const t = useT();
  // Petit écran : en-tête et pied resserrés, le premier repas reste visible sans défiler.
  const compact = useWindowDimensions().height < 700;
  const m = useMenus();
  const { plan, busy, genError, dirty, texts, recipeById, ingredients, lang } = m;
  const todayIdx = plan ? dayIndexIn(plan.weekStart) : -1;
  const [day, setDay] = useState(Math.max(0, todayIdx));
  const weekKey = plan ? plan.weekStart : null;
  useEffect(() => {
    setDay(Math.max(0, weekKey ? dayIndexIn(weekKey) : -1));
  }, [weekKey]);
  const target0 = weekTarget();
  // Restaurants et traiteurs autour de vous : seulement si un repas libre est prévu et que la ville est déjà connue.
  const hasFree = !!plan && plan.meals.some((x) => x && x.free);
  const restaurants = usePearlShops('food_drink', hasFree);
  const knownPlace = useKnownPlace(hasFree);
  const nearby = useMemo(
    () => (hasFree ? nearbyShops(restaurants, knownPlace) : []),
    [hasFree, restaurants, knownPlace]
  );
  const [swapKey, setSwapKey] = useState(null);
  const [added, setAdded] = useState(null);
  const [addedName, setAddedName] = useState('');
  const [sending, setSending] = useState(false);

  const days = useMemo(() => (plan ? mealsByDay(plan) : []), [plan]);
  const costs = useMemo(() => {
    const out = {};
    if (plan) {
      for (const meal of plan.meals) {
        const r = meal.recipeId && recipeById.get(meal.recipeId);
        if (r && !meal.free) out[meal.key] = m.costOf(r, meal.persons).perPerson;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, recipeById, m.costOf]);

  const onValidate = useCallback(async () => {
    if (sending) return;
    setSending(true);
    const r = await m.sendToList(null, m.activeLines);
    const { lists, activeId } = await readMyLists().catch(() => ({ lists: [], activeId: null }));
    const l = lists.find((x) => x.id === activeId);
    setAddedName((l && l.name) || t('shop.defaultList'));
    setSending(false);
    setAdded(r);
  }, [m, sending, t]);

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

  if (busy && !plan) return <Loading label={t('week.composing')} />;

  if (!plan) {
    return (
      <View style={{ flex: 1 }}>
        <Empty
          emoji="🥘"
          title={t('week.emptyTitle')}
          text={`${weekLabel(target0.start, lang, t)}\n${t('week.emptyText')}`}
          action={
            <PrimaryButton
              icon="sparkles"
              label={t('week.compose')}
              loading={busy}
              onPress={() => m.generate({ fresh: true })}
              style={{ alignSelf: 'stretch' }}
            />
          }
        />
        {onOpenShared ? (
          <TouchableOpacity onPress={onOpenShared} style={s.barLink} accessibilityRole="button">
            <Text style={s.barLinkTxt}>{t('week.sharedLink')}</Text>
          </TouchableOpacity>
        ) : null}
        {genError ? (
          <View style={{ paddingHorizontal: 20 }}>
            <ErrorBox
              text={t('week.error')}
              onRetry={() => m.generate({ fresh: true })}
              retryLabel={t('common.retry')}
            />
          </View>
        ) : null}
      </View>
    );
  }

  const b = plan.budget || {};
  const target = b.target;
  const ratio = target ? Math.min(1, (b.estimated || 0) / target) : 0;
  const over = target && b.estimated > target;
  const cur = days[day] || { midi: null, soir: null };
  const warn = (plan.warnings || []).find((w) =>
    ['no_eligible', 'few_recipes', 'over_budget', 'no_slots', 'no_recipes'].includes(w.code)
  );
  const hasMeals = plan.meals.some((x) => x.recipeId || x.free);

  const renderMeal = (meal) => {
    if (!meal) return null;
    const recipe = meal.recipeId ? recipeById.get(meal.recipeId) : null;
    const price = costs[meal.key];
    return (
      <MealCard
        key={meal.key}
        meal={meal}
        recipe={recipe}
        title={recipe ? texts.recipeTitle(recipe.id) : ''}
        ingredients={ingredients}
        priceText={t('week.perPerson', { price: formatEur(price || 0, lang) })}
        onOpen={() => onOpenRecipe(meal.recipeId, meal.key)}
        onChange={() => setSwapKey(meal.key)}
        onLock={() => m.toggleLock(meal.key)}
        onFree={(free) => m.setFree(meal.key, free)}
        nearby={meal.free ? nearby : undefined}
        onOpenShop={(sh) => openShopFromMenus(navigation, sh)}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.big, compact && s.bigCompact]}>{t('week.title')}</Text>
            <Text style={s.sub}>{weekLabel(plan.weekStart, lang, t)}</Text>
          </View>
          <RoundIcon
            name="refresh"
            label={t('week.regenerate')}
            onPress={() => m.generate()}
            bg={T.brandSoft}
            color={T.brandDark}
          />
          {compact ? (
            <View style={{ marginLeft: 8 }}>
              <RoundIcon
                name="layers"
                label={t(m.batch ? 'batch.resumeOpen' : 'batch.open')}
                onPress={onOpenBatch}
                bg={T.brandSoft}
                color={T.brandDark}
              />
            </View>
          ) : null}
        </View>

        {!compact ? (
          <PrimaryButton
            soft
            icon="layers"
            label={t(m.batch ? 'batch.resumeOpen' : 'batch.open')}
            onPress={onOpenBatch}
            style={{ alignSelf: 'stretch', marginTop: 12, minHeight: 46 }}
          />
        ) : null}
        {onOpenShared ? (
          <TouchableOpacity onPress={onOpenShared} style={s.barLink} accessibilityRole="button">
            <Text style={s.barLinkTxt}>{t('week.sharedLink')}</Text>
          </TouchableOpacity>
        ) : null}

        {target0.proposeNext && plan.weekStart !== target0.next ? (
          <View style={s.nextBox}>
            <Text style={s.nextTxt}>
              {t('week.nextBanner', { date: weekLabel(target0.next, lang, t) })}
            </Text>
            <PrimaryButton
              icon="sparkles"
              label={t('week.composeNext')}
              loading={busy}
              onPress={() => m.generate({ fresh: true, weekStart: target0.next })}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : null}

        <View style={[s.gauge, compact && s.gaugeCompact]}>
          <View style={s.gaugeTop}>
            <View>
              <Text style={s.gaugeLabel}>{t('week.estimated')}</Text>
              <Text style={[s.gaugeVal, compact && s.gaugeValCompact]}>{formatEur(b.estimated || 0, lang)}</Text>
            </View>
            {target ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.gaugeLabel}>{t('week.budget')}</Text>
                <Text style={s.gaugeTarget}>{formatEur(target, lang)}</Text>
              </View>
            ) : (
              <View style={s.gaugeNoBudget}>
                <Text style={s.gaugeNoBudgetTxt}>{t('week.noBudget')}</Text>
              </View>
            )}
          </View>
          {target ? (
            <>
              <View style={s.track}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${Math.max(4, Math.round(ratio * 100))}%`,
                      backgroundColor: over ? T.accent : T.brand,
                    },
                  ]}
                />
              </View>
              <Text style={[s.gaugeNote, over && { color: '#B45309' }]}>
                {over
                  ? t('week.overBudget', { amount: formatEur(b.estimated - target, lang) })
                  : t('week.underBudget', {
                      amount: formatEur(Math.max(0, target - (b.estimated || 0)), lang),
                    })}
              </Text>
              {over && b.unreachable && b.minimum > 0 ? (
                <Text style={[s.gaugeNote, { color: '#B45309' }]}>
                  {isolerPrix(
                    t('week.warn.budget_unreachable', { minimum: formatEur(b.minimum, lang) }),
                    lang
                  )}
                </Text>
              ) : null}
            </>
          ) : null}
          {!compact ? <Text style={s.gaugeFoot}>{t('week.estimateNote')}</Text> : null}
          {!compact && m.shopping && m.shopping.unpricedCount > 0 ? (
            <Text style={s.gaugeFoot}>
              {t('shop.unpriced', { count: m.shopping.unpricedCount })}
            </Text>
          ) : null}
        </View>

        {dirty ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => m.generate()}
            style={s.banner}
            accessibilityRole="button"
          >
            <Ionicons name="options" size={18} color="#B45309" />
            <Text style={s.bannerTxt}>{t('week.dirty')}</Text>
            <Text style={s.bannerAct}>{t('week.dirtyAction')}</Text>
          </TouchableOpacity>
        ) : null}
        {warn && warn.code !== 'over_budget' ? (
          <ErrorBox text={t(`week.warn.${warn.code}`)} />
        ) : null}
        {genError ? (
          <ErrorBox
            text={t('week.error')}
            onRetry={() => m.generate()}
            retryLabel={t('common.retry')}
          />
        ) : null}

        <View style={[s.pills, compact && { marginTop: 12 }]}>
          {days.map((dd) => {
            const count = [dd.midi, dd.soir].filter((x) => x && (x.recipeId || x.free)).length;
            return (
              <DayPill
                key={dd.day}
                d={dd.day}
                selected={dd.day === day}
                count={count}
                today={dd.day === todayIdx}
                onPress={setDay}
                label={t(`days.short.${dd.day}`)}
                a11y={t(`days.long.${dd.day}`)}
              />
            );
          })}
        </View>
        <Text style={[s.dayTitle, compact && s.dayTitleCompact]}>{t(`days.long.${day}`)}</Text>

        {busy ? <Text style={s.composing}>{t('week.composing')}</Text> : null}
        {renderMeal(cur.midi)}
        {renderMeal(cur.soir)}
        {!cur.midi && !cur.soir ? <Text style={s.none}>{t('week.noMeal')}</Text> : null}
      </ScrollView>

      <View style={s.bar}>
        <PrimaryButton
          icon="cart"
          label={t('week.validate')}
          disabled={!hasMeals || !m.shopping || m.activeLines.length === 0}
          loading={sending}
          onPress={onValidate}
          style={compact ? { minHeight: 44 } : null}
        />
        <TouchableOpacity
          onPress={onOpenShop}
          style={[s.barLink, compact && { paddingTop: 6 }]}
          accessibilityRole="button"
        >
          <Text style={s.barLinkTxt}>{t('week.reviewShopping')}</Text>
        </TouchableOpacity>
      </View>

      {swapKey ? <SwapSheet mealKey={swapKey} onClose={() => setSwapKey(null)} /> : null}
      {added ? (
        <AddedSheet
          result={added}
          listName={addedName}
          onClose={() => setAdded(null)}
          onSeeList={() => goList('myList')}
          onCompare={() => goList('products')}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  nextBox: {
    backgroundColor: T.brandSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  nextTxt: { color: T.brandDark, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  scroll: { paddingHorizontal: 18, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  big: { fontSize: 34, fontWeight: '900', color: T.ink, letterSpacing: -0.5 },
  bigCompact: { fontSize: 28 },
  sub: { fontSize: 14, color: T.muted, fontWeight: '600', marginTop: 2 },
  gauge: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadow,
  },
  gaugeCompact: { padding: 12, marginTop: 10, borderRadius: 18 },
  gaugeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  gaugeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: T.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gaugeVal: { fontSize: 32, fontWeight: '900', color: T.ink, marginTop: 2 },
  gaugeValCompact: { fontSize: 24 },
  gaugeTarget: { fontSize: 20, fontWeight: '800', color: T.ink, marginTop: 2 },
  gaugeNoBudget: {
    backgroundColor: T.subtle,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gaugeNoBudgetTxt: { fontSize: 12, fontWeight: '700', color: T.muted },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: T.subtle,
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: 10, borderRadius: 5 },
  gaugeNote: { fontSize: 13, fontWeight: '700', color: T.brandDark, marginTop: 8 },
  gaugeFoot: { fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 17 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.accentSoft,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  bannerTxt: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '600', marginHorizontal: 8 },
  bannerAct: { fontSize: 13, fontWeight: '900', color: '#92400E', textDecorationLine: 'underline' },
  pills: { flexDirection: 'row', marginTop: 20 },
  pill: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: T.subtle,
  },
  pillOn: { backgroundColor: T.brand },
  pillTxt: { fontSize: 13, fontWeight: '800', color: T.ink },
  pillDots: { flexDirection: 'row', marginTop: 6 },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.border,
    marginHorizontal: 1.5,
  },
  today: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.brand,
  },
  dayTitle: { fontSize: 22, fontWeight: '900', color: T.ink, marginTop: 20, marginBottom: 12 },
  dayTitleCompact: { fontSize: 18, marginTop: 10, marginBottom: 8 },
  composing: { fontSize: 13, color: T.muted, marginBottom: 8, fontWeight: '600' },
  none: { fontSize: 15, color: T.muted, textAlign: 'center', paddingVertical: 24 },
  bar: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  barLink: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  barLinkTxt: { fontSize: 14, fontWeight: '800', color: T.muted },
});
