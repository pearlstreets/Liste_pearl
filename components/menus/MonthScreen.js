// Calendrier du mois : repas de chaque jour (semaines passées en lecture seule, semaine en cours, semaine suivante
// à préparer), changer un repas ou choisir une recette précise. Contient aussi « Ajouter à ma semaine ».
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '../ui/IoniconsSens';
import {
  mealsByDay,
  searchRecipes,
  searchCatalog,
  buildSearchIndex,
  catalogActive,
  resultRecipes,
} from '../../lib/menus';
import {
  parseISO,
  toISO,
  mondayISO,
  monthGrid,
  shiftMonth,
  weeksIndex,
  weekKind,
} from '../../lib/menus/weeks';
import { T } from './theme';
import { PrimaryButton, GhostButton, Field, Empty } from './ui';
import RecipeVisual from './RecipeVisual';
import { Sheet, SwapSheet, warningList } from './Sheets';
import { useMenus, conflictList } from './MenusContext';
import useT from './useT';
import { weekLabel } from './WeekScreen';

// Majuscule en tete seulement : le reste suit la langue (« mardi 3 novembre » en francais au milieu,
// « Dienstag, 3. November » en allemand, « Tuesday, November 3 » en anglais).
const capFirst = (s) => (typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SLOTS = ['midi', 'soir'];
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

/** Titre d'un repas du plan : recette, « Libre », ou rien de prévu. Ne lève pas. */
function mealTitle(meal, m, t) {
  if (!meal) return t('week.noMeal');
  if (meal.free) return t('week.free');
  if (!meal.recipeId) return t('week.noMeal');
  try {
    return m.recipeById.get(meal.recipeId)
      ? m.texts.recipeTitle(meal.recipeId)
      : t('week.unavailable');
  } catch {
    return t('week.unavailable');
  }
}

/** Remplacer un repas par une recette : accord explicite d'abord (et alerte si elle ne convient pas au profil). */
function askReplace(m, t, oldTitle, recipe, onOk) {
  let warn = '';
  try {
    const w = m.conflictOf(recipe);
    if (w)
      warn = w.found
        ? t('myRecipes.warnFound', { list: recipe.custom ? warningList(w, t) : conflictList(w, t) })
        : t('myRecipes.warnUnknown');
  } catch {
    warn = '';
  }
  let newTitle = recipe.id;
  try {
    newTitle = m.texts.recipeTitle(recipe.id);
  } catch {}
  Alert.alert(
    t('month.addTitle'),
    `${t('month.replaceQ', { old: oldTitle, new: newTitle })}${warn ? `\n\n${warn}` : ''}`,
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('month.replace'), onPress: onOk },
    ]
  );
}

/** « Ajouter à ma semaine » : choisir le jour et le repas du plan en cours que cette recette remplace. */
export const AddToWeekSheet = memo(function AddToWeekSheet({ recipe, onClose, onDone }) {
  const t = useT();
  const m = useMenus();
  const { plan, lang } = m;
  const busy = useRef(false);
  const meals = useMemo(
    () =>
      ((plan && plan.meals) || [])
        .filter((x) => x && /^[0-6]-(midi|soir)$/.test(String(x.key)))
        .sort((a, b) => a.day - b.day || (a.slot === b.slot ? 0 : a.slot === 'midi' ? -1 : 1)),
    [plan]
  );
  const pick = (meal) =>
    askReplace(m, t, mealTitle(meal, m, t), recipe, async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        await m.swap(meal.key, recipe.id, { manual: true });
        onClose();
        if (onDone) onDone();
      } finally {
        busy.current = false;
      }
    });
  return (
    <Sheet onClose={onClose} label={t('common.close')}>
      <Text style={s.sheetTitle}>{t('month.addTitle')}</Text>
      {meals.length === 0 ? (
        <Empty emoji="🗓️" title={t('myRecipes.noPlanTitle')} text={t('myRecipes.noPlanText')} />
      ) : (
        <>
          <Text style={s.sheetSub}>
            {weekLabel(plan.weekStart, lang, t)}
            {'\n'}
            {t('month.addSub')}
          </Text>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {meals.map((x) => (
              <TouchableOpacity
                key={x.key}
                activeOpacity={0.85}
                onPress={() => pick(x)}
                style={s.idea}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.ideaTitle}>
                    {t(`days.long.${x.day}`)} · {t(`slot.${x.slot}`)}
                  </Text>
                  <Text style={s.ideaMeta} numberOfLines={1}>
                    {mealTitle(x, m, t)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={T.faint} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
      <GhostButton label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
});

/** Choix libre d'une recette précise (recherche) pour un repas : plein écran, le clavier ne masque rien. */
function RecipePicker({ onPick, onClose }) {
  const t = useT();
  const { recipeById, recipes, texts, ingredients, lang, favorites } = useMenus();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 200);
    return () => clearTimeout(id);
  }, [q]);
  const useCat = catalogActive(recipeById);
  const tl = texts.lang || lang;
  useEffect(() => {
    if (!useCat) return undefined;
    let off = false;
    buildSearchIndex(tl, {
      yieldFn: () => new Promise((r) => setTimeout(r, 0)),
      cancelled: () => off,
    }).catch(() => {});
    return () => {
      off = true;
    };
  }, [useCat, tl]);
  const list = useMemo(() => {
    if (!dq)
      return favorites
        .map((id) => recipeById.get(id))
        .filter(Boolean)
        .slice(0, 20);
    const opts = {
      query: dq,
      filters: {},
      titleOf: (r) => texts.recipeTitle(r.id),
      ingredientNameOf: (k) => texts.ingredientName(k),
    };
    if (useCat) {
      try {
        return resultRecipes(
          searchCatalog({ ...opts, catalog: recipeById, lang: tl, limit: 25 }),
          recipeById
        );
      } catch {
        /* repli : recettes écrites à la main seules */
      }
    }
    try {
      return searchRecipes(recipes, { ...opts, limit: 25 });
    } catch {
      return [];
    }
  }, [dq, favorites, recipeById, recipes, texts, useCat, tl]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 60 }]}>
      <View style={s.head}>
        <TouchableOpacity
          onPress={onClose}
          style={s.close}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={HIT}
        >
          <Ionicons name="chevron-back" size={26} color={T.ink} />
        </TouchableOpacity>
        <Text style={s.title}>{t('week.takeRecipe')}</Text>
        <View style={s.close} />
      </View>
      <View style={{ paddingHorizontal: 18 }}>
        <Field
          value={q}
          onChangeText={setQ}
          placeholder={t('month.searchPh')}
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, flexGrow: 1 }}
        ListHeaderComponent={!dq ? <Text style={s.hint}>{t('month.searchHint')}</Text> : null}
        ListEmptyComponent={
          dq ? (
            <Empty
              emoji="🔎"
              title={t('discover.noResultsTitle')}
              text={t('discover.noResultsText')}
            />
          ) : null
        }
        renderItem={({ item: r }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPick(r)}
            style={s.idea}
            accessibilityRole="button"
          >
            <RecipeVisual recipe={r} ingredients={ingredients} height={64} round />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.ideaTitle} numberOfLines={2}>
                {texts.recipeTitle(r.id)}
              </Text>
              <Text style={s.ideaMeta}>{t('recipe.minutes', { n: r.timeMin })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={T.faint} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const Cell = memo(function Cell({ iso, date, inMonth, selected, today, count, onPress, a11y }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(iso)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      style={[s.cell, selected && s.cellOn, !inMonth && s.cellOut]}
    >
      <Text style={[s.cellTxt, selected && { color: '#fff' }]}>{date}</Text>
      <View style={s.dots}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              s.dot,
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

export default function MonthScreen({ onClose, onOpenRecipe, onOpenWeek }) {
  const t = useT();
  const m = useMenus();
  const { plan, history, lang, busy } = m;
  const todayISO = toISO(new Date());
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [sel, setSel] = useState(todayISO);
  const [swapKey, setSwapKey] = useState(null);
  const [picking, setPicking] = useState(null);
  const [working, setWorking] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const index = useMemo(() => weeksIndex(plan, history), [plan, history]);
  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  // repas de chaque semaine affichée : { lundi -> 7 jours { midi, soir } }
  const daysOf = useMemo(() => {
    const out = new Map();
    for (const w of grid) {
      const known = index.get(w.weekStart);
      if (known) out.set(w.weekStart, mealsByDay(known.plan));
    }
    return out;
  }, [grid, index]);

  const go = useCallback(
    (delta) => {
      const next = shiftMonth(cursor.year, cursor.month, delta);
      setCursor(next);
      const n = new Date();
      setSel(
        next.year === n.getFullYear() && next.month === n.getMonth()
          ? toISO(n)
          : toISO(new Date(next.year, next.month, 1))
      );
    },
    [cursor]
  );

  const monthTitle = useMemo(() => {
    try {
      return capFirst(
        new Date(cursor.year, cursor.month, 1).toLocaleDateString(lang || undefined, {
          month: 'long',
          year: 'numeric',
        })
      );
    } catch {
      return `${cursor.year}-${cursor.month + 1}`;
    }
  }, [cursor, lang]);

  const selDate = parseISO(sel);
  const weekStart = selDate ? mondayISO(selDate) : null;
  const dayIdx = selDate ? (selDate.getDay() + 6) % 7 : 0;
  const kind = weekStart ? weekKind(weekStart, plan, index) : 'none';
  const known = weekStart ? index.get(weekStart) : null;
  const dayMeals = known && daysOf.get(weekStart) ? daysOf.get(weekStart)[dayIdx] : null;
  const dayTitle = useMemo(() => {
    try {
      return capFirst(
        selDate.toLocaleDateString(lang || undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      );
    } catch {
      return sel;
    }
  }, [selDate, sel, lang]);

  const run = useCallback(
    async (fn) => {
      if (working) return;
      setWorking(true);
      try {
        await fn();
      } finally {
        if (mounted.current) setWorking(false);
      }
    },
    [working]
  );

  const onPrepare = () => run(() => m.generate({ fresh: true, weekStart }));
  const onResume = () => run(() => m.openWeek(weekStart));
  const onRedo = () =>
    Alert.alert(t('month.redoTitle'), t('month.redoAsk'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('history.redo'),
        onPress: () =>
          run(async () => {
            const r = await m.refaire(known.plan);
            if (r && onOpenWeek) onOpenWeek();
          }),
      },
    ]);

  const onPickRecipe = (r) => {
    const key = picking;
    const cur = plan && plan.meals.find((x) => x && x.key === key);
    askReplace(m, t, mealTitle(cur, m, t), r, () =>
      run(async () => {
        await m.swap(key, r.id, { manual: true });
        if (mounted.current) setPicking(null);
      })
    );
  };

  const editable = kind === 'edit';
  const renderMeal = (slot) => {
    const meal = dayMeals ? dayMeals[slot] : null;
    const openable = !!(meal && meal.recipeId && !meal.free);
    return (
      <View key={slot} style={s.meal}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!openable}
          onPress={() => onOpenRecipe(meal.recipeId, editable ? meal.key : undefined)}
          accessibilityRole={openable ? 'button' : undefined}
          style={s.mealMain}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.slot}>{t(`slot.${slot}`)}</Text>
            <Text style={[s.mealTitle, !meal && { color: T.muted }]} numberOfLines={2}>
              {mealTitle(meal, m, t)}
            </Text>
          </View>
          {openable ? <Ionicons name="chevron-forward" size={18} color={T.faint} /> : null}
        </TouchableOpacity>
        {editable && meal ? (
          <View style={s.acts}>
            <GhostButton
              icon="swap-horizontal"
              label={t('week.change')}
              onPress={() => setSwapKey(meal.key)}
            />
            <GhostButton
              icon="search"
              label={t('week.takeRecipe')}
              onPress={() => setPicking(meal.key)}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.head}>
        <TouchableOpacity
          onPress={onClose}
          style={s.close}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={HIT}
        >
          <Ionicons name="chevron-back" size={26} color={T.ink} />
        </TouchableOpacity>
        <Text style={s.title}>{t('nav.week')}</Text>
        <View style={s.close} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.monthRow}>
          <TouchableOpacity
            onPress={() => go(-1)}
            style={s.close}
            accessibilityRole="button"
            accessibilityLabel={t('month.prev')}
          >
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </TouchableOpacity>
          <Text style={s.monthTitle}>{monthTitle}</Text>
          <TouchableOpacity
            onPress={() => go(1)}
            style={s.close}
            accessibilityRole="button"
            accessibilityLabel={t('month.next')}
          >
            <Ionicons name="chevron-forward" size={22} color={T.ink} />
          </TouchableOpacity>
        </View>
        <View style={s.line}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <Text key={d} style={s.dayHead}>
              {t(`days.short.${d}`)}
            </Text>
          ))}
        </View>
        {grid.map((w) => {
          const days = daysOf.get(w.weekStart);
          return (
            <View key={w.weekStart} style={s.line}>
              {w.days.map((d, i) => {
                const dm = days ? days[i] : null;
                const count = dm
                  ? SLOTS.filter((k) => dm[k] && (dm[k].recipeId || dm[k].free)).length
                  : 0;
                return (
                  <Cell
                    key={d.iso}
                    iso={d.iso}
                    date={d.date}
                    inMonth={d.inMonth}
                    selected={d.iso === sel}
                    today={d.iso === todayISO}
                    count={count}
                    onPress={setSel}
                    a11y={`${t(`days.long.${i}`)} ${d.date}`}
                  />
                );
              })}
            </View>
          );
        })}

        <Text style={s.dayTitle}>{dayTitle}</Text>
        {weekStart ? <Text style={s.weekSub}>{weekLabel(weekStart, lang, t)}</Text> : null}

        {known ? (
          <>
            {SLOTS.map(renderMeal)}
            {kind === 'past' ? <Text style={s.note}>{t('month.past')}</Text> : null}
          </>
        ) : (
          <Text style={s.none}>{t('week.noMeal')}</Text>
        )}

        {kind === 'past' ? (
          <PrimaryButton
            soft
            icon="refresh"
            label={t('history.redo')}
            loading={working || busy}
            onPress={onRedo}
            style={s.action}
          />
        ) : null}
        {kind === 'resume' ? (
          <PrimaryButton
            soft
            icon="create-outline"
            label={t('month.resume')}
            loading={working || busy}
            onPress={onResume}
            style={s.action}
          />
        ) : null}
        {kind === 'prepare' ? (
          <>
            <PrimaryButton
              icon="sparkles"
              label={t('month.prepare')}
              loading={working || busy}
              onPress={onPrepare}
              style={s.action}
            />
            {plan && plan.weekStart && plan.weekStart !== weekStart ? (
              <Text style={s.note}>{t('month.prepareNote')}</Text>
            ) : null}
          </>
        ) : null}
        {kind === 'far' ? <Text style={s.note}>{t('month.far')}</Text> : null}
      </ScrollView>
      {swapKey ? <SwapSheet mealKey={swapKey} onClose={() => setSwapKey(null)} /> : null}
      {picking ? <RecipePicker onPick={onPickRecipe} onClose={() => setPicking(null)} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: T.ink },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 20, fontWeight: '600', color: T.ink },
  line: { flexDirection: 'row', marginTop: 6 },
  dayHead: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: T.muted },
  cell: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.border,
  },
  cellOn: { backgroundColor: T.brand, borderColor: T.brand },
  cellOut: { opacity: 0.45 },
  cellTxt: { fontSize: 14, fontWeight: '600', color: T.ink },
  dots: { flexDirection: 'row', marginTop: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.border, marginHorizontal: 1.5 },
  today: {
    position: 'absolute',
    top: 4,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.brand,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: T.ink,
    marginTop: 22,
  },
  weekSub: { fontSize: 13, color: T.muted, marginTop: 2, marginBottom: 8 },
  meal: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderInput },
  mealMain: { flexDirection: 'row', alignItems: 'center' },
  slot: { fontSize: 13, color: T.muted },
  mealTitle: { fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 2 },
  acts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  note: { fontSize: 13, color: T.muted, marginTop: 10, lineHeight: 19 },
  none: { fontSize: 15, color: T.muted, textAlign: 'center', paddingVertical: 20 },
  action: { alignSelf: 'stretch', marginTop: 14 },
  hint: { fontSize: 14, color: T.muted, marginVertical: 12, lineHeight: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '600', color: T.ink },
  sheetSub: { fontSize: 14, color: T.muted, marginTop: 4, marginBottom: 12, lineHeight: 20 },
  idea: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  ideaTitle: { fontSize: 16, fontWeight: '600', color: T.ink },
  ideaMeta: { fontSize: 13, color: T.muted, marginTop: 3 },
});
