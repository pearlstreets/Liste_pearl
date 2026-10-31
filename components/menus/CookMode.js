// Mode cuisine : une étape à la fois, en grand, avec minuteurs (sans son, sans module natif).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scaleIngredients, normalizeLang } from '../../lib/menus';
import { T } from './theme';
import { PrimaryButton } from './ui';
import { useMenus } from './MenusContext';
import useT from './useT';

const fmt = (sec) => {
  const x = Math.max(0, sec);
  const mm = Math.floor(x / 60);
  const ss = x % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

export default function CookMode({ id, persons, onClose }) {
  const t = useT();
  const { recipeById, texts, ingredients, lang, markCooked } = useMenus();
  const recipe = recipeById.get(id);
  const steps = useMemo(() => (recipe ? texts.recipeSteps(id) : []), [recipe, texts, id]);
  const [idx, setIdx] = useState(0);
  const [showIng, setShowIng] = useState(false);
  // minuteurs : { [étape]: { total, left, endAt } } ; endAt = fin prévue quand il tourne
  const [timers, setTimers] = useState({});
  const [now, setNow] = useState(Date.now());

  const running = Object.values(timers).some((x) => x.endAt);
  useEffect(() => {
    if (!running) return undefined;
    const h = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(h);
  }, [running]);

  // Un minuteur arrivé à zéro s'arrête (visuel seulement).
  useEffect(() => {
    if (!running) return;
    setTimers((cur) => {
      let ch = false;
      const next = { ...cur };
      for (const [k, v] of Object.entries(cur)) {
        if (v.endAt && v.endAt <= now) {
          next[k] = { ...v, endAt: null, left: 0 };
          ch = true;
        }
      }
      return ch ? next : cur;
    });
  }, [now, running]);

  const timerOf = useCallback(
    (i) => {
      const secs = recipe && recipe.stepTimers && Number(recipe.stepTimers[String(i)]);
      if (!secs || !(secs > 0)) return null;
      const cur = timers[i] || { total: secs, left: secs, endAt: null };
      const left = cur.endAt ? Math.max(0, Math.ceil((cur.endAt - now) / 1000)) : cur.left;
      return { ...cur, total: secs, left };
    },
    [recipe, timers, now]
  );

  const startPause = (i) => {
    const cur = timerOf(i);
    if (!cur) return;
    setNow(Date.now());
    setTimers((all) => {
      if (cur.endAt) return { ...all, [i]: { total: cur.total, left: cur.left, endAt: null } };
      const left = cur.left > 0 ? cur.left : cur.total;
      return { ...all, [i]: { total: cur.total, left, endAt: Date.now() + left * 1000 } };
    });
  };
  const reset = (i) => {
    const cur = timerOf(i);
    if (cur)
      setTimers((all) => ({ ...all, [i]: { total: cur.total, left: cur.total, endAt: null } }));
  };

  const lines = useMemo(
    () => (recipe ? scaleIngredients(recipe, persons, { lang: normalizeLang(lang) }) : []),
    [recipe, persons, lang]
  );
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

  if (!recipe || steps.length === 0) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={s.stepTxt}>{t('cook.none')}</Text>
        <View style={{ height: 16 }} />
        <PrimaryButton label={t('common.close')} onPress={onClose} />
      </View>
    );
  }

  const last = idx === steps.length - 1;
  const tm = timerOf(idx);
  const others = Object.keys(timers)
    .map((k) => Number(k))
    .filter((k) => k !== idx && timers[k].endAt);

  const finish = async () => {
    await markCooked(id);
    onClose();
  };

  return (
    <View style={s.root}>
      <View style={s.top}>
        <TouchableOpacity
          onPress={onClose}
          style={s.x}
          accessibilityLabel={t('cook.quit')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={26} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.counter}>{t('cook.stepOf', { n: idx + 1, total: steps.length })}</Text>
          <Text style={s.name} numberOfLines={1}>
            {texts.recipeTitle(id)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowIng(!showIng)}
          style={s.x}
          accessibilityLabel={t('recipe.ingredients')}
        >
          <Ionicons
            name={showIng ? 'list' : 'list-outline'}
            size={24}
            color={showIng ? T.brandDark : T.ink}
          />
        </TouchableOpacity>
      </View>
      <View style={s.progress}>
        <View style={[s.progressFill, { width: `${((idx + 1) / steps.length) * 100}%` }]} />
      </View>

      {others.length ? (
        <View style={s.running}>
          {others.map((k) => (
            <TouchableOpacity key={k} onPress={() => setIdx(k)} style={s.runPill}>
              <Ionicons name="timer-outline" size={15} color={T.brandDark} />
              <Text style={s.runTxt}>
                {t('cook.stepShort', { n: k + 1 })} {fmt(timerOf(k).left)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {showIng ? (
          <View style={s.ingBox}>
            {lines.map((l) => {
              const u = labels[l.displayUnit] !== undefined ? labels[l.displayUnit] : l.displayUnit;
              return (
                <Text key={l.key} style={s.ingTxt}>
                  {(ingredients[l.key] && ingredients[l.key].emoji) || '•'}{' '}
                  {texts.ingredientName(l.key)} : {u ? `${l.amount} ${u}` : l.amount}
                </Text>
              );
            })}
          </View>
        ) : null}
        <Text style={s.stepTxt}>{steps[idx]}</Text>
        {tm ? (
          <View style={[s.timer, tm.left === 0 && !tm.endAt && { backgroundColor: T.accentSoft }]}>
            <Text style={s.timerLabel}>
              {tm.left === 0 && !tm.endAt ? t('cook.timerDone') : t('cook.timer')}
            </Text>
            <Text style={s.timerVal}>{fmt(tm.left)}</Text>
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <PrimaryButton
                style={{ flex: 1, marginRight: 8, minHeight: 48 }}
                icon={tm.endAt ? 'pause' : 'play'}
                label={
                  tm.endAt
                    ? t('cook.pause')
                    : tm.left > 0 && tm.left < tm.total
                      ? t('cook.resume')
                      : t('cook.start')
                }
                onPress={() => startPause(idx)}
              />
              <PrimaryButton
                soft
                style={{ minHeight: 48 }}
                icon="refresh"
                label={t('cook.reset')}
                onPress={() => reset(idx)}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.nav}>
        <PrimaryButton
          soft
          style={{ flex: 1, marginRight: 10 }}
          icon="chevron-back"
          label={t('cook.prev')}
          disabled={idx === 0}
          onPress={() => setIdx(idx - 1)}
        />
        {last ? (
          <PrimaryButton
            style={{ flex: 1.4 }}
            icon="checkmark-circle"
            label={t('cook.done')}
            onPress={finish}
          />
        ) : (
          <PrimaryButton
            style={{ flex: 1.4 }}
            icon="chevron-forward"
            label={t('cook.next')}
            onPress={() => setIdx(idx + 1)}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  counter: {
    fontSize: 13,
    fontWeight: '900',
    color: T.brandDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: { fontSize: 14, fontWeight: '700', color: T.muted, marginTop: 2 },
  progress: {
    height: 6,
    backgroundColor: T.subtle,
    marginHorizontal: 18,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: T.brand, borderRadius: 3 },
  running: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 10 },
  runPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  runTxt: { fontSize: 13, fontWeight: '800', color: T.brandDark, marginLeft: 5 },
  body: { padding: 22, paddingBottom: 30 },
  stepTxt: { fontSize: 27, lineHeight: 38, fontWeight: '700', color: T.ink },
  ingBox: { backgroundColor: T.subtle, borderRadius: 18, padding: 16, marginBottom: 20 },
  ingTxt: { fontSize: 16, color: T.ink, fontWeight: '600', lineHeight: 28 },
  timer: {
    backgroundColor: T.brandSoft,
    borderRadius: 24,
    padding: 20,
    marginTop: 28,
    alignItems: 'stretch',
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: T.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  timerVal: { fontSize: 56, fontWeight: '900', color: T.ink, textAlign: 'center', marginTop: 4 },
  nav: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
});
