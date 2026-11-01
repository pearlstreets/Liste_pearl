// Cuisine en lot : choisir de 2 à 5 recettes, voir la session, la suivre pas à pas, la reprendre.
import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MIN_RECIPES,
  MAX_RECIPES,
  buildSession,
  followIds,
  sessionProgress,
  planBatchMeals,
  proposeBatch,
  linkedMealKeys,
  formatQtyText,
  normalizeLang,
} from '../../lib/menus';
import { parseISO, toISO } from '../../lib/menus/weeks';
import { T } from './theme';
import { Empty, PrimaryButton, GhostButton, Stepper } from './ui';
import { useMenus } from './MenusContext';
import CookMode from './CookMode';
import useT from './useT';

const KIND_ICON = { four: 'flame', feu: 'bonfire-outline', repos: 'hourglass-outline' };

const Check = memo(function Check({ on, onPress, disabled, title, text, meta, icon, children }) {
  return (
    <View style={s.row}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!on, disabled: !!disabled }}
        accessibilityLabel={title}
        style={[s.rowMain, disabled && { opacity: 0.45 }]}
      >
        <Ionicons
          name={on ? 'checkbox' : 'square-outline'}
          size={24}
          color={on ? T.brandDark : T.muted}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          {meta ? (
            <View style={s.metaRow}>
              {icon ? (
                <Ionicons name={icon} size={13} color={T.muted} style={{ marginRight: 4 }} />
              ) : null}
              <Text style={s.meta}>{meta}</Text>
            </View>
          ) : null}
          <Text style={[s.rowTitle, on && !children && s.rowDone]}>{title}</Text>
          {text ? <Text style={s.rowText}>{text}</Text> : null}
        </View>
      </TouchableOpacity>
      {children}
    </View>
  );
});

function Header({ title, onClose, t }) {
  return (
    <View style={s.top}>
      <TouchableOpacity
        onPress={onClose}
        style={s.x}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Ionicons name="close" size={26} color={T.ink} />
      </TouchableOpacity>
      <Text style={s.topTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.x} />
    </View>
  );
}

function Chooser({ onClose }) {
  const t = useT();
  const m = useMenus();
  const { plan, ingredients, profile, recipeById, texts } = m;
  const fromWeek = useMemo(() => planBatchMeals(plan, recipeById), [plan, recipeById]);
  const proposed = useMemo(() => {
    const week = new Set(fromWeek.map((x) => x.recipeId));
    return proposeBatch({ recipes: recipeById, ingredients, profile, count: MAX_RECIPES }).filter(
      (id) => !week.has(id)
    );
  }, [fromWeek, recipeById, ingredients, profile]);
  const basePersons = Math.max(1, Math.ceil(Number(m.persons(0, 'soir')) || 1));
  const [picked, setPicked] = useState({});
  const [saving, setSaving] = useState(false);
  const count = Object.keys(picked).length;

  const toggle = (item) =>
    setPicked((cur) => {
      if (cur[item.recipeId]) {
        const { [item.recipeId]: _out, ...rest } = cur;
        return rest;
      }
      return { ...cur, [item.recipeId]: item };
    });
  const setPersons = (id, persons) =>
    setPicked((cur) => (cur[id] ? { ...cur, [id]: { ...cur[id], persons } } : cur));

  const create = async () => {
    if (saving) return;
    setSaving(true);
    await m.startBatch(Object.values(picked));
    setSaving(false);
  };

  const row = (item) => {
    const on = !!picked[item.recipeId];
    return (
      <Check
        key={item.recipeId}
        on={on}
        disabled={!on && count >= MAX_RECIPES}
        title={texts.recipeTitle(item.recipeId)}
        onPress={() => toggle(item)}
      >
        {on ? (
          <View style={s.stepper}>
            <Stepper
              value={picked[item.recipeId].persons}
              min={1}
              max={24}
              label={t('batch.persons')}
              format={(v) => t('week.persons', { count: v })}
              onChange={(v) => setPersons(item.recipeId, v)}
            />
          </View>
        ) : null}
      </Check>
    );
  };

  return (
    <View style={s.root}>
      <Header title={t('batch.title')} onClose={onClose} t={t} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>{t('batch.intro', { min: MIN_RECIPES, max: MAX_RECIPES })}</Text>
        {fromWeek.length ? <Text style={s.section}>{t('batch.fromWeek')}</Text> : null}
        {fromWeek.map(row)}
        {proposed.length ? <Text style={s.section}>{t('batch.proposed')}</Text> : null}
        {proposed.map((id) => row({ recipeId: id, persons: basePersons, mealKeys: [] }))}
      </ScrollView>
      <View style={s.bottom}>
        <PrimaryButton
          icon="layers"
          label={t('batch.create', { count })}
          disabled={count < MIN_RECIPES}
          loading={saving}
          onPress={create}
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    </View>
  );
}

function Session({ onClose, onOpenRecipe }) {
  const t = useT();
  const m = useMenus();
  const { batch, plan, recipeById, ingredients, profile, texts, lang } = m;
  const today = toISO(new Date());
  const view = useMemo(
    () =>
      buildSession({
        session: batch,
        recipes: recipeById,
        ingredients,
        profile,
        stepsOf: (id) => texts.recipeSteps(id),
        today,
      }),
    [batch, recipeById, ingredients, profile, texts, today]
  );
  const progress = sessionProgress(view, batch);
  const [following, setFollowing] = useState(null);
  const [shopMsg, setShopMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  const labels = useMemo(
    () => ({
      g: t('units.g'),
      kg: t('units.kg'),
      ml: t('units.ml'),
      l: t('units.l'),
      u: t('units.u'),
      cs: t('units.cs'),
      cc: t('units.cc'),
    }),
    [t]
  );
  const prepTitle = useCallback(
    (g) => {
      const name = texts.ingredientName(g.key);
      return g.amt > 0
        ? `${name} : ${formatQtyText(g.amt, g.unit, { lang: normalizeLang(lang), labels })}`
        : name;
    },
    [texts, lang, labels]
  );
  const stepText = useCallback(
    (x) => texts.recipeSteps(x.recipeId)[x.stepIndex] || texts.recipeTitle(x.recipeId),
    [texts]
  );
  const seq = useMemo(
    () => [
      ...view.prep.map((g) => ({
        id: g.id,
        text: `${t(`batch.prep.${g.kind}`)}. ${prepTitle(g)}`,
        title: t('batch.prepTitle'),
        timerSec: 0,
      })),
      ...view.steps.map((x) => ({
        id: x.id,
        text: stepText(x),
        title: texts.recipeTitle(x.recipeId),
        timerSec: x.timerSec,
      })),
    ],
    [view, t, prepTitle, stepText, texts]
  );
  const ids = followIds(view);
  const dateText = (iso) => {
    const d = parseISO(iso);
    return d ? d.toLocaleDateString(lang || undefined, { day: 'numeric', month: 'long' }) : '';
  };
  const timeText = (min) => {
    if (min < 60) return t('recipe.minutes', { n: min });
    return t('batch.hours', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
  };

  const linked = linkedMealKeys(plan, batch);
  const prepared =
    linked.length > 0 &&
    linked.every((k) => {
      const meal = plan.meals.find((x) => x && x.key === k);
      return meal && meal.batchOf === batch.id;
    });

  const addShopping = async () => {
    if (adding) return;
    setAdding(true);
    const r = await m.sendBatchToList();
    setAdding(false);
    if (r.status === 'ok') setShopMsg(t('batch.added', { count: r.count }));
    else if (r.status === 'already') setShopMsg(t('batch.already'));
    else setShopMsg(t('batch.addFailed'));
  };
  const discard = () =>
    Alert.alert(t('batch.newTitle'), t('batch.newText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('batch.newConfirm'), style: 'destructive', onPress: () => m.clearBatch() },
    ]);

  if (view.items.length === 0)
    return (
      <View style={s.root}>
        <Header title={t('batch.title')} onClose={onClose} t={t} />
        <Empty emoji="🍲" title={t('batch.goneTitle')} text={t('batch.goneText')} />
        <View style={s.bottom}>
          <PrimaryButton
            label={t('batch.newConfirm')}
            onPress={() => m.clearBatch()}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </View>
    );

  if (following !== null)
    return (
      <CookMode
        onClose={() => setFollowing(null)}
        guided={{
          steps: seq,
          startIdx: following,
          onAdvance: (i) => m.setBatchStep(ids[i], true),
          onFinish: async () => {
            for (const it of view.items) await m.markCooked(it.recipeId);
          },
        }}
      />
    );

  const saved = view.sequentialMin - view.totalMin;
  return (
    <View style={s.root}>
      <Header title={t('batch.title')} onClose={onClose} t={t} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.summary}>
          <Text style={s.summaryVal}>{timeText(view.totalMin)}</Text>
          <Text style={s.summaryTxt}>{t('batch.total', { count: view.items.length })}</Text>
          {saved > 0 ? (
            <Text style={s.summaryTxt}>{t('batch.saved', { time: timeText(saved) })}</Text>
          ) : null}
          {view.restMin > 0 ? (
            <Text style={s.summaryTxt}>{t('batch.rest', { time: timeText(view.restMin) })}</Text>
          ) : null}
        </View>
        {view.missing.length ? (
          <Text style={s.warn}>{t('batch.missing', { count: view.missing.length })}</Text>
        ) : null}

        {progress.complete ? (
          <Text style={s.doneAll}>{t('batch.doneAll')}</Text>
        ) : (
          <PrimaryButton
            icon="play"
            label={t(progress.done > 0 ? 'batch.resume' : 'batch.follow')}
            onPress={() => setFollowing(progress.nextIndex)}
            style={{ alignSelf: 'stretch', marginTop: 14 }}
          />
        )}
        <PrimaryButton
          soft
          icon="cart"
          label={t('batch.addShopping')}
          loading={adding}
          onPress={addShopping}
          style={{ alignSelf: 'stretch', marginTop: 10 }}
        />
        {shopMsg ? <Text style={s.note}>{shopMsg}</Text> : null}
        {linked.length ? (
          <Check
            on={prepared}
            title={t('batch.markPrepared', { count: linked.length })}
            onPress={() => m.setBatchPrepared(!prepared)}
          >
            <View />
          </Check>
        ) : null}

        {view.prep.length ? <Text style={s.section}>{t('batch.prepTitle')}</Text> : null}
        {view.prep.map((g) => (
          <Check
            key={g.id}
            on={batch.done[g.id] === true}
            title={prepTitle(g)}
            meta={t(`batch.prep.${g.kind}`)}
            text={g.recipes.map((id) => texts.recipeTitle(id)).join(', ')}
            onPress={() => m.setBatchStep(g.id, batch.done[g.id] !== true)}
          />
        ))}

        <Text style={s.section}>{t('batch.cookTitle')}</Text>
        {view.steps.map((x) => (
          <Check
            key={x.id}
            on={batch.done[x.id] === true}
            title={stepText(x)}
            meta={`${t('batch.at', { time: timeText(x.startMin) })} · ${texts.recipeTitle(x.recipeId)}`}
            icon={KIND_ICON[x.kind]}
            onPress={() => m.setBatchStep(x.id, batch.done[x.id] !== true)}
          />
        ))}

        <Text style={s.section}>{t('batch.storageTitle')}</Text>
        <Text style={s.note}>{t('batch.cooling')}</Text>
        {!batch.cookedOn ? <Text style={s.note}>{t('batch.storageHint')}</Text> : null}
        {view.storage.map((x) => (
          <View key={x.recipeId} style={s.keep}>
            <TouchableOpacity
              onPress={() => onOpenRecipe(x.recipeId)}
              accessibilityRole="button"
              accessibilityLabel={texts.recipeTitle(x.recipeId)}
            >
              <Text style={s.rowTitle}>{texts.recipeTitle(x.recipeId)}</Text>
            </TouchableOpacity>
            <Text style={s.rowText}>
              {t('batch.fridgeUntil', { date: dateText(x.fridgeUntil) })}
            </Text>
            <Text style={s.rowText}>
              {x.freezable
                ? t('batch.freezerUntil', { date: dateText(x.freezerUntil) })
                : t('batch.noFreeze')}
            </Text>
            {x.mustFreeze ? <Text style={s.warn}>{t('batch.mustFreeze')}</Text> : null}
            {x.tooLate ? <Text style={s.warn}>{t('batch.tooLate')}</Text> : null}
          </View>
        ))}
        <GhostButton
          label={t('batch.newConfirm')}
          onPress={discard}
          style={{ alignSelf: 'center', marginTop: 16 }}
        />
      </ScrollView>
    </View>
  );
}

export default function BatchScreen({ onClose, onOpenRecipe }) {
  const { batch } = useMenus();
  return batch ? (
    <Session onClose={onClose} onOpenRecipe={onOpenRecipe} />
  ) : (
    <Chooser onClose={onClose} />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: T.ink },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingBottom: 32 },
  intro: { fontSize: 15, lineHeight: 22, color: T.muted, fontWeight: '600', marginTop: 4 },
  section: { fontSize: 18, fontWeight: '900', color: T.ink, marginTop: 22, marginBottom: 6 },
  row: { borderBottomWidth: 1, borderBottomColor: T.border },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, minHeight: 48 },
  rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: T.ink },
  rowDone: { color: T.muted, textDecorationLine: 'line-through' },
  rowText: { fontSize: 13, lineHeight: 19, color: T.muted, fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  meta: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: T.brandDark },
  stepper: { paddingBottom: 12, paddingLeft: 36, alignItems: 'flex-start' },
  bottom: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  summary: { backgroundColor: T.brandSoft, borderRadius: 20, padding: 18, marginTop: 4 },
  summaryVal: { fontSize: 32, fontWeight: '900', color: T.ink },
  summaryTxt: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: T.ink, marginTop: 2 },
  note: { fontSize: 13, lineHeight: 19, color: T.muted, fontWeight: '600', marginTop: 8 },
  warn: { fontSize: 13, lineHeight: 19, color: T.danger, fontWeight: '700', marginTop: 6 },
  doneAll: { fontSize: 15, fontWeight: '800', color: T.brandDark, marginTop: 14 },
  keep: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
});
