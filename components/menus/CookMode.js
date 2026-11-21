// Mode cuisine. Une recette : mode optimisé (KitchenMode, maquette v15). Cuisine en lot (guided) :
// une étape à la fois, en grand, avec minuteurs, dans l'ordre calculé par la session.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { scaleIngredients, normalizeLang } from '../../lib/menus';
import { T, SERIF, TAILLES } from './theme';
import { MARCHE } from '../ui/marche';
import { useMenus } from './MenusContext';
import useT from './useT';
import { IngredientThumb } from './RecipeVisual';
import { isolerUnitesLatines } from '../../lib/texteBidi';
import KitchenMode from './KitchenMode';
import {
  feedback,
  keepScreenOn,
  askCookPermission,
  scheduleCookAlarms,
  cancelCookAlarms,
} from '../../services/cookAlerts';

// minuteurs de la cuisine en lot : alarmes à part de celles des recettes, fins gardées si l'app est tuée
const LOT_GROUP = 'lot';
const LOT_KEY = 'menus.cuisineLotMinuteurs';
const LOT_MAX_MS = 12 * 3600 * 1000;
const lotSig = (steps) => {
  const str = steps.join('|');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return `${steps.length}:${h}`;
};

// Mode cuisine en style Marché : fond sombre, textes crème, accents terracotta.
const CREME = '#F7F1E8';
const SECOND = '#D9BFAE';
const AVENIR = '#5E4234';
const CONTOUR = '#6E5143';
const CARTE = '#4A2F21';

// Bouton du mode cuisine : plein (fond blanc, texte noir) ou contour fin (texte crème), même hauteur.
function CookButton({ label, icon, onPress, disabled, outline, style }) {
  const color = outline ? CREME : MARCHE.noir;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[s.btn, outline ? s.btnOutline : s.btnFull, disabled && { opacity: 0.45 }, style]}
    >
      {icon ? <Ionicons name={icon} size={19} color={color} style={{ marginRight: 8 }} /> : null}
      <Text
        style={[s.btnTxt, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const fmt = (sec) => {
  const x = Math.max(0, sec);
  const mm = Math.floor(x / 60);
  const ss = x % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

// guided (cuisine en lot) : { steps:[{ text, title, timerSec }], startIdx, onAdvance(i), onFinish() }.
export default function CookMode({ id, persons, onClose, guided }) {
  if (!guided) return <KitchenMode id={id} persons={persons} onClose={onClose} />;
  return <StepCook id={id} persons={persons} onClose={onClose} guided={guided} />;
}

function StepCook({ id, persons, onClose, guided }) {
  const t = useT();
  const { recipeById, texts, ingredients, lang, markCooked } = useMenus();
  const recipe = recipeById.get(id);
  const seq = guided ? guided.steps : null;
  const steps = useMemo(
    () => (seq ? seq.map((x) => x.text) : recipe ? texts.recipeSteps(id) : []),
    [seq, recipe, texts, id]
  );
  const [idx, setIdx] = useState(() => (guided ? Number(guided.startIdx) || 0 : 0));
  const [showIng, setShowIng] = useState(false);
  // minuteurs : { [étape]: { total, left, endAt } } ; endAt = fin prévue quand il tourne
  const [timers, setTimers] = useState({});
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const asked = useRef(false);
  const sig = useMemo(() => lotSig(steps), [steps]);

  useEffect(() => {
    keepScreenOn(true);
    return () => keepScreenOn(false);
  }, []);

  // reprise des minuteurs après fermeture de l'écran ou de l'application
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOT_KEY);
        const v = raw ? JSON.parse(raw) : null;
        if (v && v.sig === sig && Date.now() - v.at < LOT_MAX_MS && v.timers && vivant) {
          // fini pendant l'absence : l'alarme a déjà sonné, il reste affiché à zéro
          const back = {};
          for (const [k, x] of Object.entries(v.timers))
            back[k] = x.endAt && x.endAt <= Date.now() ? { ...x, endAt: null, left: 0 } : x;
          setTimers(back);
        }
      } catch {}
      if (vivant) setLoaded(true);
    })();
    return () => {
      vivant = false;
    };
  }, [sig]);

  // sauvegarde et alarmes à chaque changement de minuteur (lancé, en pause, remis, terminé)
  useEffect(() => {
    if (!loaded) return;
    const list = [];
    for (const [k, v] of Object.entries(timers)) {
      if (!v.endAt) continue;
      list.push({
        id: `etape-${k}`,
        inSec: (v.endAt - Date.now()) / 1000,
        title: t('cook.timerDone'),
        body: steps[Number(k)] || '',
      });
    }
    scheduleCookAlarms(list, t('cook.k.channel'), LOT_GROUP);
    try {
      if (Object.keys(timers).length)
        AsyncStorage.setItem(LOT_KEY, JSON.stringify({ sig, at: Date.now(), timers })).catch(
          () => {}
        );
      else AsyncStorage.removeItem(LOT_KEY).catch(() => {});
    } catch {}
  }, [timers, loaded, sig, steps, t]);

  const running = Object.values(timers).some((x) => x.endAt);
  useEffect(() => {
    if (!running) return undefined;
    const h = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(h);
  }, [running]);

  // Un minuteur arrivé à zéro s'arrête et sonne.
  useEffect(() => {
    if (!running) return;
    if (Object.values(timers).some((v) => v.endAt && v.endAt <= now)) feedback('timer');
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
  }, [now, running, timers]);

  const timerOf = useCallback(
    (i) => {
      const secs = seq
        ? seq[i] && Number(seq[i].timerSec)
        : recipe &&
          Number(
            (recipe.stepTimers && recipe.stepTimers[String(i)]) ||
              (recipe.stepDurations && recipe.stepDurations[String(i)])
          );
      if (!secs || !(secs > 0)) return null;
      const cur = timers[i] || { total: secs, left: secs, endAt: null };
      const left = cur.endAt ? Math.max(0, Math.ceil((cur.endAt - now) / 1000)) : cur.left;
      return { ...cur, total: secs, left };
    },
    [seq, recipe, timers, now]
  );

  const startPause = (i) => {
    const cur = timerOf(i);
    if (!cur) return;
    setNow(Date.now());
    if (!cur.endAt && !asked.current) {
      asked.current = true;
      // permission accordée : les alarmes sont reprogrammées
      askCookPermission()
        .then(() => setTimers((all) => ({ ...all })))
        .catch(() => {});
    }
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
    () =>
      recipe ? scaleIngredients(recipe, persons, { lang: normalizeLang(lang), ingredients }) : [],
    [recipe, persons, lang, ingredients]
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

  if ((!recipe && !seq) || steps.length === 0) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={s.stepTxt}>{t('cook.none')}</Text>
        <View style={{ height: 16 }} />
        <CookButton label={t('common.close')} onPress={onClose} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const cur = Math.min(idx, steps.length - 1);
  const last = cur === steps.length - 1;
  const tm = timerOf(cur);
  const others = Object.keys(timers)
    .map((k) => Number(k))
    .filter((k) => k !== cur && timers[k].endAt);

  const finish = async () => {
    cancelCookAlarms(LOT_GROUP);
    AsyncStorage.removeItem(LOT_KEY).catch(() => {});
    if (guided) {
      await guided.onAdvance(cur);
      await guided.onFinish();
    } else await markCooked(id);
    onClose();
  };
  const next = () => {
    if (guided) guided.onAdvance(cur);
    setIdx(cur + 1);
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
          <Ionicons name="close" size={26} color={CREME} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.counter}>{t('cook.stepOf', { n: cur + 1, total: steps.length })}</Text>
          <Text style={s.name} numberOfLines={1}>
            {seq ? seq[cur].title : texts.recipeTitle(id)}
          </Text>
        </View>
        {seq ? (
          <View style={s.x} />
        ) : (
          <TouchableOpacity
            onPress={() => setShowIng(!showIng)}
            style={s.x}
            accessibilityLabel={t('recipe.ingredients')}
          >
            <Ionicons
              name={showIng ? 'list' : 'list-outline'}
              size={24}
              color={showIng ? T.brand : CREME}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={s.progress}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              s.seg,
              i > 0 && { marginLeft: 4 },
              { backgroundColor: i <= cur ? T.brand : AVENIR },
            ]}
          />
        ))}
      </View>

      {others.length ? (
        <View style={s.running}>
          {others.map((k) => (
            <TouchableOpacity key={k} onPress={() => setIdx(k)} style={s.runPill}>
              <Ionicons name="timer-outline" size={15} color={T.brand} />
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
            {lines.map((l, i) => {
              const u = labels[l.displayUnit] !== undefined ? labels[l.displayUnit] : l.displayUnit;
              // nom au pluriel au-dela d'une piece (comme la fiche recette), sinon le nom habituel
              const pl = l.plural ? t(`recipe.plural.${l.key}`, { defaultValue: '' }) : '';
              const nom = pl && !pl.includes('recipe.plural.') ? pl : texts.ingredientName(l.key);
              return (
                <View key={`${l.key}-${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IngredientThumb ingKey={l.key} size={22} style={{ marginRight: 8 }} />
                  <Text style={[s.ingTxt, { flex: 1 }]}>
                    {nom}
                    {l.toTaste
                      ? ` : ${t('recipe.toTaste')}`
                      : l.amount
                        ? ` : ${u ? `${l.amount} ${u}` : l.amount}`
                        : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
        <Text style={s.stepTxt}>{isolerUnitesLatines(steps[cur], lang)}</Text>
        {tm ? (
          <View style={s.timer}>
            <View style={[s.ring, tm.left === 0 && !tm.endAt && s.ringDone]}>
              <Text style={s.timerLabel} numberOfLines={2}>
                {tm.left === 0 && !tm.endAt ? t('cook.timerDone') : t('cook.timer')}
              </Text>
              <Text style={s.timerVal} numberOfLines={1} adjustsFontSizeToFit>
                {fmt(tm.left)}
              </Text>
            </View>
            <View style={s.timerBtns}>
              <CookButton
                style={{ flex: 1, marginRight: 10 }}
                icon={tm.endAt ? 'pause' : 'play'}
                label={
                  tm.endAt
                    ? t('cook.pause')
                    : tm.left > 0 && tm.left < tm.total
                      ? t('cook.resume')
                      : t('cook.start')
                }
                onPress={() => startPause(cur)}
              />
              <CookButton
                outline
                style={{ flex: 1 }}
                icon="refresh"
                label={t('cook.reset')}
                onPress={() => reset(cur)}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.nav}>
        <CookButton
          outline
          style={{ flex: 1, marginRight: 10 }}
          icon="chevron-back"
          label={t('cook.prev')}
          disabled={cur === 0}
          onPress={() => setIdx(cur - 1)}
        />
        {last ? (
          <CookButton
            style={{ flex: 1 }}
            icon="checkmark-circle"
            label={t('cook.done')}
            onPress={finish}
          />
        ) : (
          <CookButton
            style={{ flex: 1 }}
            icon="chevron-forward"
            label={t('cook.next')}
            onPress={next}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: MARCHE.nuit },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TAILLES.marge - 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  x: {
    width: TAILLES.icone,
    height: TAILLES.icone,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    fontSize: 12,
    fontWeight: '600',
    color: SECOND,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  name: { fontSize: 14, fontWeight: '600', color: CREME, marginTop: 3, textAlign: 'center' },
  progress: { flexDirection: 'row', height: 4, marginHorizontal: TAILLES.marge },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  running: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: TAILLES.marge,
    paddingTop: 12,
  },
  runPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: TAILLES.boutonPetit,
    backgroundColor: CARTE,
    borderWidth: 1,
    borderColor: CONTOUR,
    borderRadius: TAILLES.boutonPetit / 2,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  runTxt: { fontSize: 13, fontWeight: '600', color: CREME, marginLeft: 6 },
  body: { paddingHorizontal: TAILLES.marge, paddingTop: 24, paddingBottom: 30 },
  stepTxt: { fontFamily: SERIF, fontSize: 24, lineHeight: 36, fontWeight: '400', color: CREME },
  ingBox: {
    backgroundColor: CARTE,
    borderRadius: TAILLES.rayonCarte,
    padding: 16,
    marginBottom: 20,
  },
  ingTxt: { fontSize: 16, color: CREME, fontWeight: '600', lineHeight: 28 },
  timer: { marginTop: 32, alignItems: 'center' },
  ring: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 6,
    borderColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  ringDone: { backgroundColor: 'rgba(200, 98, 59, 0.22)' },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SECOND,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  timerVal: {
    fontSize: 48,
    fontWeight: '600',
    color: CREME,
    textAlign: 'center',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  timerBtns: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 24 },
  btn: {
    height: TAILLES.bouton,
    borderRadius: TAILLES.rayonBouton,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { backgroundColor: MARCHE.blanc },
  btnOutline: { borderWidth: 1, borderColor: CONTOUR, backgroundColor: 'transparent' },
  btnTxt: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  nav: {
    flexDirection: 'row',
    paddingHorizontal: TAILLES.marge,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: AVENIR,
    backgroundColor: MARCHE.nuit,
  },
});
