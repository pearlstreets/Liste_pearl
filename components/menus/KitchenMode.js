// Mode cuisine optimisé (maquette v15) : la recette en liste, dans l'ordre qui fait gagner le plus de
// temps. Pendant une cuisson on fait la suite ; ce qui vient d'être prêt passe devant ; ce qui se
// sert chaud est lancé juste à temps. Plan : lib/menus/cookPlan.js ; déroulé : lib/menus/cookEngine.js.
// Le repas en cours est sauvegardé : fermer l'écran ou l'application ne perd rien.
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AppState,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { scaleIngredients, normalizeLang } from '../../lib/menus';
import { getTexts } from '../../lib/menus/recipes';
import { buildCookPlan } from '../../lib/menus/cookPlan';
import {
  initState,
  validState,
  current,
  stuck,
  can,
  missing,
  waitSec,
  allDone,
  doneCount,
  active,
  launch,
  finish,
  toggleStep,
  toggleCook,
  toggleAll,
  cancelCook,
  undo as undoState,
  advance,
  remaining,
  cookTaskIndex,
  MAX_UNDO,
} from '../../lib/menus/cookEngine';
import {
  feedback,
  keepScreenOn,
  askCookPermission,
  scheduleCookAlarms,
  cancelCookAlarms,
} from '../../services/cookAlerts';
import { T } from './theme';
import { useMenus } from './MenusContext';
import useT from './useT';
import { isolerUnitesLatines } from '../../lib/texteBidi';

// ancienne clé unique (un seul repas en cours pour toutes les recettes) : relue une fois pour migrer
export const SAVE_KEY = 'menus.cuisineEnCours';
// une sauvegarde par recette : cuisiner B ne fait plus perdre la progression ni les alarmes de A
export const saveKeyOf = (id) => `${SAVE_KEY}.${id}`;
const SAVE_MAX_MS = 12 * 3600 * 1000;
const TICK_MS = 500;

const fmt = (sec) => {
  const x = Math.max(0, Math.ceil(sec));
  const m = Math.floor(x / 60);
  const s = x % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
const minutes = (sec) => Math.max(1, Math.round(sec / 60));
const planSig = (plan) =>
  plan.tasks.map((x) => `${x.src}:${x.d}:${x.cook ? x.cook.k : ''}`).join('|');

export default function KitchenMode({ id, persons, onClose }) {
  const t = useT();
  const { recipeById, texts, ingredients, lang, markCooked } = useMenus();
  const recipe = recipeById.get(id);
  const steps = useMemo(() => (recipe ? texts.recipeSteps(id) : []), [recipe, texts, id]);
  const plan = useMemo(() => {
    if (!recipe || !steps.length) return { tasks: [], seqSec: 0 };
    let fr = { recipeSteps: () => [], ingredientName: (k) => k };
    try {
      fr = getTexts('fr');
    } catch {}
    let frSteps = [];
    try {
      frSteps = fr.recipeSteps(id);
    } catch {}
    try {
      return buildCookPlan({ recipe, steps, frSteps, ingredientName: fr.ingredientName });
    } catch {
      // repli sûr : les étapes dans l'ordre, une à la fois
      return {
        tasks: steps.map((text, i) => ({
          src: i,
          text,
          keys: [],
          d: 120,
          est: true,
          need: [],
          after: i ? [i - 1] : [],
          prev: i - 1,
        })),
        seqSec: steps.length * 120,
      };
    }
  }, [recipe, steps, id]);
  const best = useMemo(() => (plan.tasks.length ? remaining(plan, initState(plan)) : 0), [plan]);
  // une synchro distante recrée le plan à l'identique : seule une signature changée relance la reprise
  const sig = useMemo(() => planSig(plan), [plan]);
  const planRef = useRef(plan);
  planRef.current = plan;
  const saveKey = saveKeyOf(id);
  const alarmGroup = String(id);

  const [S, setS] = useState(() => initState(plan));
  const [hist, setHist] = useState([]);
  const [up, setUp] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showIng, setShowIng] = useState(false);
  const last = useRef(Date.now());
  const SRef = useRef(S);
  SRef.current = S;
  const asked = useRef(false);
  const histRef = useRef(hist);
  histRef.current = hist;

  // quantités, dans la langue et pour le nombre de personnes choisi
  const lines = useMemo(
    () =>
      recipe ? scaleIngredients(recipe, persons, { lang: normalizeLang(lang), ingredients }) : [],
    [recipe, persons, lang, ingredients]
  );
  const unitLabel = useCallback(
    (u) => {
      const k = `units.${u}`;
      const v = t(k);
      return v && v !== `menus.${k}` && v !== k ? v : u;
    },
    [t]
  );
  const lineText = useCallback(
    (l) => {
      const pl = l.plural ? t(`recipe.plural.${l.key}`, { defaultValue: '' }) : '';
      const nom = pl && !pl.includes('recipe.plural.') ? pl : texts.ingredientName(l.key);
      if (l.toTaste) return `${nom} : ${t('recipe.toTaste')}`;
      if (!l.amount) return nom;
      const u = l.displayUnit ? unitLabel(l.displayUnit) : '';
      return `${u ? `${l.amount} ${u}` : l.amount} ${nom}`;
    },
    [t, texts, unitLabel]
  );
  const qtyOf = useCallback(
    (task) =>
      task.keys
        .map((k) => lines.find((l) => l.key === k))
        .filter(Boolean)
        .map(lineText)
        .join(', '),
    [lines, lineText]
  );
  const textOf = useCallback(
    (task) => {
      if (!task) return '';
      if (task.label) {
        const o = { ...(task.label.opts || {}) };
        if (o.key) o.name = texts.ingredientName(o.key);
        return t(task.label.key, o);
      }
      return isolerUnitesLatines(task.text || '', lang);
    },
    [t, texts, lang]
  );
  const kindOf = (k) => {
    const j = cookTaskIndex(plan, k);
    return j >= 0 ? plan.tasks[j].cook.kind : 'cuisson';
  };
  // libellé selon la cuisson : l'eau, le four, ou une autre cuisson
  const byKind = (k, eau, four, other) => t({ eau, four }[kindOf(k)] || other);
  const alertTitle = (k) => byKind(k, 'cook.k.waterAlert', 'cook.k.ovenAlert', 'cook.k.cookAlert');
  const consumerOf = (St, k) =>
    plan.tasks.findIndex((x, i) => x.need.includes(k) && St.st[i].s !== 'done');

  /* ------------------------------ sauvegarde ------------------------------ */

  useEffect(() => {
    let vivant = true;
    const plan = planRef.current;
    // plan changé (langue, recette modifiée) : l'état doit avoir une ligne par tâche
    setS((cur) => (cur.st.length === plan.tasks.length ? cur : initState(plan)));
    setHist([]);
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(saveKeyOf(id));
        if (!raw) {
          // migration : l'ancienne sauvegarde unique, si elle est celle de cette recette
          const old = await AsyncStorage.getItem(SAVE_KEY);
          const o = old ? JSON.parse(old) : null;
          if (o && o.id === id) {
            raw = old;
            await AsyncStorage.setItem(saveKeyOf(id), old);
            await AsyncStorage.removeItem(SAVE_KEY);
          }
        }
        const v = raw ? JSON.parse(raw) : null;
        if (v && v.id === id && v.sig === sig && Date.now() - v.at < SAVE_MAX_MS) {
          const st = validState(plan, v.S);
          if (st && vivant) {
            const dt = (Date.now() - v.at) / 1000;
            const res = advance(plan, st, dt);
            setS(res.S);
            setHist(Array.isArray(v.H) ? v.H.map((h) => validState(plan, h)).filter(Boolean) : []);
            setResumed(true);
          }
        }
      } catch {}
      if (vivant) {
        last.current = Date.now();
        setLoaded(true);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [id, sig]);

  const save = useCallback(
    (St) => {
      try {
        const fini = allDone(plan, St);
        const vide = doneCount(St) === 0 && !St.cooks.length && !St.st.some((x) => x.s === 'run');
        if (fini || vide) AsyncStorage.removeItem(saveKey).catch(() => {});
        else
          AsyncStorage.setItem(
            saveKey,
            JSON.stringify({
              id,
              sig: planSig(plan),
              at: Date.now(),
              S: St,
              H: histRef.current.slice(-20),
            })
          ).catch(() => {});
      } catch {}
    },
    [id, plan, saveKey]
  );

  /* ------------------------------ alarmes ------------------------------ */

  const syncAlarms = useCallback(
    (St) => {
      if (St.pz || allDone(plan, St)) {
        cancelCookAlarms(alarmGroup);
        return;
      }
      const list = [];
      St.cooks.forEach((c) => {
        if (c.ok || c.pz) return;
        const j = consumerOf(St, c.k);
        list.push({
          id: c.k,
          inSec: c.r,
          title: alertTitle(c.k),
          body: j >= 0 ? textOf(plan.tasks[j]) : textOf(plan.tasks[c.task]),
        });
      });
      St.st.forEach((x, i) => {
        if (x.s !== 'run' || x.pz || plan.tasks[i].est) return;
        list.push({
          id: `etape-${i}`,
          inSec: x.r,
          title: t('cook.timerDone'),
          body: textOf(plan.tasks[i]),
        });
      });
      scheduleCookAlarms(list, t('cook.k.channel'), alarmGroup);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, textOf, t, alarmGroup]
  );

  /* ------------------------------ temps ------------------------------ */

  const tick = useCallback(() => {
    const now = Date.now();
    const dt = (now - last.current) / 1000;
    last.current = now;
    const St = SRef.current;
    if (St.pz || allDone(plan, St) || dt <= 0) return;
    const before = current(plan, St);
    const res = advance(plan, St, dt);
    if (res.ready.length) feedback('ready');
    else if (res.over.some((i) => !plan.tasks[i].est)) feedback('timer');
    const after = current(plan, res.S);
    if (after !== before && after >= 0) {
      const x = plan.tasks[after];
      if (x.need.length || x.sync) {
        setUp((n) => n + 1);
        if (!res.ready.length) feedback('go');
      }
    }
    setS(res.S);
    if (res.ready.length || res.over.length) save(res.S);
  }, [plan, save]);

  useEffect(() => {
    if (!loaded) return undefined;
    const h = setInterval(tick, TICK_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') tick();
      else save(SRef.current);
    });
    return () => {
      clearInterval(h);
      if (sub && sub.remove) sub.remove();
    };
  }, [loaded, tick, save]);

  useEffect(() => {
    keepScreenOn(true);
    return () => keepScreenOn(false);
  }, []);

  // chaque action : historique pour Défaire, son, sauvegarde, alarmes
  const act = (fn, sound, { history = true } = {}) => {
    const St = SRef.current;
    const next = fn(St);
    if (history) {
      const h = [...histRef.current.slice(-(MAX_UNDO - 1)), St];
      histRef.current = h;
      setHist(h);
    }
    setS(next);
    SRef.current = next;
    feedback(allDone(plan, next) ? 'bravo' : sound);
    save(next);
    syncAlarms(next);
  };

  const onLaunch = (i) => {
    if (!asked.current) {
      asked.current = true;
      askCookPermission().then(() => syncAlarms(SRef.current));
    }
    act((St) => launch(plan, St, i), 'go');
  };
  const onDone = (i) => act((St) => finish(plan, St, i), 'ok');
  const onStepPause = (i) => act((St) => toggleStep(St, i), 'pause', { history: false });
  const onCookPause = (k) => act((St) => toggleCook(St, k), 'pause', { history: false });
  const onCancel = (k) => act((St) => cancelCook(plan, St, k), 'cancel');
  const onAll = () => {
    last.current = Date.now();
    act((St) => toggleAll(St), 'pause', { history: false });
  };
  const onUndo = () => {
    if (!hist.length) return;
    const prev = hist[hist.length - 1];
    const h = hist.slice(0, -1);
    histRef.current = h;
    setHist(h);
    act((St) => undoState(plan, St, prev), 'undo', { history: false });
  };
  const onRestart = () => {
    setHist([]);
    setResumed(false);
    const St = initState(plan);
    setS(St);
    SRef.current = St;
    AsyncStorage.removeItem(saveKey).catch(() => {});
    cancelCookAlarms(alarmGroup);
  };
  const onFinish = async () => {
    try {
      await markCooked(id);
    } catch {}
    AsyncStorage.removeItem(saveKey).catch(() => {});
    cancelCookAlarms(alarmGroup);
    onClose();
  };

  /* ------------------------------ défilement ------------------------------ */

  const scroll = useRef(null);
  const nowY = useRef(0);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!up) return;
    // la carte monte un peu et apparaît, sans passer sur les étapes suivantes
    anim.setValue(1);
    Animated.timing(anim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (scroll.current)
      scroll.current.scrollTo({
        // un bandeau d'alerte est en haut de la liste : il reste visible en entier
        y: SRef.current.cooks.some((c) => c.ok && consumerOf(SRef.current, c.k) >= 0)
          ? 0
          : Math.max(0, nowY.current - 80),
        animated: true,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [up, anim]);

  /* ------------------------------ rendu ------------------------------ */

  if (!recipe || !plan.tasks.length) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.nt}>{t('cook.none')}</Text>
        <TouchableOpacity
          style={[s.btn, { marginTop: 16, alignSelf: 'stretch' }]}
          onPress={onClose}
        >
          <Text style={s.btnTxt}>{t('common.close')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const N = plan.tasks.length;
  if (S.st.length !== N) return <View style={s.root} />;
  const fini = allDone(plan, S);
  const nDone = doneCount(S);
  const rest = fini ? 0 : remaining(plan, S);
  let cur = current(plan, S);
  if (cur < 0) cur = stuck(plan, S);
  const shown = new Set();
  const body = [];

  const quantity = (task) => {
    const q = qtyOf(task);
    return q ? (
      <View style={s.qt}>
        <Text style={s.qtTxt}>{q}</Text>
      </View>
    ) : null;
  };

  if (fini) {
    body.push(
      <View key="fin" style={s.fin}>
        <Text style={s.finTitle}>{t('cook.k.bonAppetit')}</Text>
        <Text style={s.nd}>{t('cook.k.readyAfter', { min: minutes(S.t) })}</Text>
        <TouchableOpacity
          style={[s.btn, { marginTop: 22, alignSelf: 'stretch' }]}
          onPress={onFinish}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.btnTxt}>{t('cook.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    // bandeau : une cuisson est prête et une étape l'attend
    S.cooks.forEach((c) => {
      if (!c.ok) return;
      const j = consumerOf(S, c.k);
      if (j < 0) return;
      body.push(
        <View key={`al-${c.k}`} style={s.al}>
          <Text style={s.alTitle}>{alertTitle(c.k)}</Text>
          <Text style={s.alTxt} numberOfLines={2}>
            {t('cook.k.toDo', { what: textOf(plan.tasks[j]) })}
          </Text>
        </View>
      );
    });
    // faites
    plan.tasks.forEach((x, i) => {
      if (S.st[i].s !== 'done' || (x.cook && S.cooks.some((c) => c.k === x.cook.k))) return;
      shown.add(i);
      body.push(
        <View key={`d-${i}`} style={s.rw}>
          <View style={[s.dot, s.dotDone]}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
          <Text style={[s.rt, s.rtDone]} numberOfLines={2}>
            {textOf(x)}
          </Text>
        </View>
      );
    });
    // cuissons
    plan.tasks.forEach((x, i) => {
      const c = x.cook && S.cooks.find((k) => k.k === x.cook.k);
      if (!c || S.st[i].s !== 'done') return;
      shown.add(i);
      const p = c.pz || S.pz;
      const name =
        x.cook.kind === 'eau'
          ? t(c.ok ? 'cook.k.waterReady' : 'cook.k.waterHeating')
          : x.cook.kind === 'four'
            ? t(c.ok ? 'cook.k.ovenReady' : 'cook.k.ovenHeating')
            : textOf(x);
      body.push(
        <View key={`c-${i}`} style={[s.ck, c.ok && s.ckOk]}>
          <View style={[s.dot, c.ok ? s.dotOk : s.dotCook]}>
            {c.ok ? (
              <Ionicons name="checkmark" size={16} color={T.brandDark} />
            ) : (
              <Ionicons name="flame-outline" size={15} color="#B45309" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.ckName} numberOfLines={2}>
              {name}
              {p && !c.ok ? ` (${t('cook.k.paused')})` : ''}
            </Text>
            {!c.ok && !S.pz ? (
              <View style={s.mini}>
                <TouchableOpacity style={s.miniBtn} onPress={() => onCookPause(c.k)}>
                  <Text style={s.miniTxt}>{c.pz ? t('cook.resume') : t('cook.pause')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.miniBtn} onPress={() => onCancel(c.k)}>
                  <Text style={s.miniTxt}>{t('cook.k.cancel')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <Text style={[s.ckTime, c.ok && { color: T.brandDark, fontSize: 18 }]}>
            {c.ok ? t('cook.k.ready') : fmt(c.r)}
          </Text>
        </View>
      );
    });
    // à faire maintenant, ou rien à faire pour l'instant
    if (S.pz) {
      body.push(
        <View key="pz" style={s.wait}>
          <Text style={s.nt}>{t('cook.k.allPaused')}</Text>
          <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={onAll}>
            <Text style={s.btnTxt}>{t('cook.k.resumeAll')}</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (cur >= 0) {
      shown.add(cur);
      const x = plan.tasks[cur];
      const st = S.st[cur];
      body.push(
        <Animated.View
          key={`now-${cur}`}
          style={[
            s.nw,
            {
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) },
              ],
            },
          ]}
          onLayout={(e) => {
            nowY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={s.nl}>{t('cook.k.now')}</Text>
          <Text style={s.nowTitle}>{textOf(x)}</Text>
          {quantity(x)}
          {st.s === 'todo' ? (
            <>
              <Text style={s.nd}>
                {x.cook
                  ? x.cook.kind === 'eau' || x.cook.kind === 'four'
                    ? t('cook.k.heatSelf', { min: minutes(x.d) })
                    : t('cook.k.cookSelf', { min: minutes(x.d) })
                  : x.sync
                    ? t('cook.k.aboutSync', { min: minutes(x.d) })
                    : t('cook.k.about', { min: minutes(x.d) })}
              </Text>
              <TouchableOpacity style={[s.btn, s.btnBig]} onPress={() => onLaunch(cur)}>
                <Ionicons
                  name={x.cook ? 'flame' : 'play'}
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={s.btnBigTxt}>{x.cook ? t('cook.k.launchCook') : t('cook.start')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[s.big, st.pz && { color: T.faint }]}>{fmt(st.r)}</Text>
              <View style={s.bar}>
                <View
                  style={[
                    s.barIn,
                    { width: `${Math.max(0, Math.min(100, 100 - (st.r / x.d) * 100))}%` },
                  ]}
                />
              </View>
              {st.r <= 0 ? <Text style={s.over}>{t('cook.k.timeUp')}</Text> : null}
              <View style={s.btns}>
                <TouchableOpacity
                  style={[s.btn, s.btnBig, { flex: 1, marginTop: 0 }]}
                  onPress={() => onDone(cur)}
                >
                  <Text style={s.btnBigTxt}>{t('cook.k.done')}</Text>
                </TouchableOpacity>
                {st.r > 0 ? (
                  <TouchableOpacity
                    style={[s.btnSec, { marginLeft: 8 }]}
                    onPress={() => onStepPause(cur)}
                  >
                    <Text style={s.btnSecTxt}>{st.pz ? t('cook.resume') : t('cook.pause')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}
        </Animated.View>
      );
    } else {
      // la plus proche des attentes
      let w = -1;
      let bestW = Infinity;
      plan.tasks.forEach((x, j) => {
        if (S.st[j].s !== 'todo') return;
        const sec = waitSec(plan, S, j);
        if (sec !== null && sec < bestW) {
          bestW = sec;
          w = j;
        }
      });
      if (w >= 0) {
        const m = missing(plan, S, w);
        body.push(
          <View key="wait" style={s.wait} onLayout={(e) => (nowY.current = e.nativeEvent.layout.y)}>
            <Text style={[s.nl, { color: '#B45309' }]}>{t('cook.k.idle')}</Text>
            <Text style={[s.nt, { textAlign: 'center' }]}>
              {m
                ? byKind(m, 'cook.k.waterIn', 'cook.k.ovenIn', 'cook.k.cookIn')
                : t('cook.k.launchInTitle')}
            </Text>
            <Text style={[s.big, { color: '#B45309' }]}>{fmt(bestW)}</Text>
            <Text style={[s.nd, { textAlign: 'center' }]}>
              {t('cook.k.then', { what: textOf(plan.tasks[w]) })}
            </Text>
          </View>
        );
      }
    }
    // en cours, à côté de la tâche principale
    plan.tasks.forEach((x, i) => {
      if (shown.has(i) || S.st[i].s !== 'run') return;
      shown.add(i);
      const st = S.st[i];
      body.push(
        <View key={`r-${i}`} style={s.ec}>
          <View style={[s.dot, { borderColor: T.brand }]}>
            <Text style={[s.dotTxt, { color: T.brandDark }]}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.ckName} numberOfLines={2}>
              {textOf(x)}
            </Text>
            <View style={s.mini}>
              <TouchableOpacity style={[s.miniBtn, s.miniOn]} onPress={() => onDone(i)}>
                <Text style={[s.miniTxt, { color: '#fff' }]}>{t('cook.k.done')}</Text>
              </TouchableOpacity>
              {st.r > 0 ? (
                <TouchableOpacity style={s.miniBtn} onPress={() => onStepPause(i)}>
                  <Text style={s.miniTxt}>{st.pz ? t('cook.resume') : t('cook.pause')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <Text style={[s.ckTime, { color: T.brandDark }]}>{fmt(st.r)}</Text>
        </View>
      );
    });
    // la suite
    plan.tasks.forEach((x, i) => {
      if (shown.has(i) || S.st[i].s !== 'todo') return;
      const m = missing(plan, S, i);
      let sub;
      let waiting = true;
      if (m) sub = byKind(m, 'cook.k.waitWater', 'cook.k.waitOven', 'cook.k.waitCook');
      else if (x.sync && !can(plan, S, i) && waitSec(plan, S, i) !== null)
        sub = t('cook.k.launchIn', { time: fmt(waitSec(plan, S, i)) });
      else if (x.sync && !can(plan, S, i)) sub = t('cook.k.duringCook');
      else {
        waiting = false;
        sub = x.cook
          ? t('cook.k.cookMin', { min: minutes(x.d) })
          : t('cook.k.min', { min: minutes(x.d) });
      }
      body.push(
        <View key={`t-${i}`} style={s.rw}>
          <View style={s.dot}>
            <Text style={s.dotTxt}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rt}>{textOf(x)}</Text>
            <Text style={[s.rs, waiting && { color: '#B45309' }]}>{sub}</Text>
          </View>
        </View>
      );
    });
  }

  return (
    <View style={s.root}>
      <View style={s.hd}>
        <View style={s.hdTop}>
          <TouchableOpacity
            onPress={onClose}
            style={s.x}
            accessibilityLabel={t('cook.quit')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color={T.ink} />
          </TouchableOpacity>
          <Text style={s.h1} numberOfLines={2}>
            {texts.recipeTitle(id)}
          </Text>
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
        <View style={s.h2}>
          <Text style={s.h2Txt}>
            {t('cook.k.forPersons', { count: persons })} ·{' '}
            {t('cook.k.doneOf', { n: nDone, total: N })}
          </Text>
          <Text style={s.h2Ok}>
            {fini ? t('cook.k.finished') : t('cook.k.readyInMin', { min: minutes(rest) })}
          </Text>
        </View>
        {best > 0 && plan.seqSec - best >= 60 ? (
          <Text style={[s.h2Txt, { marginTop: 2 }]}>
            {t('cook.k.optimized', { opt: minutes(best), seq: minutes(plan.seqSec) })}
          </Text>
        ) : null}
        <View style={s.pb}>
          <View style={[s.pbIn, { width: `${(nDone / N) * 100}%` }]} />
        </View>
        {resumed && !fini ? (
          <View style={s.resumed}>
            <Text style={s.resumedTxt}>{t('cook.k.resumed')}</Text>
            <TouchableOpacity
              onPress={onRestart}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.restart}>{t('cook.k.restart')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scroll}
        style={s.ls}
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
      >
        {showIng ? (
          <View style={s.ingBox}>
            {lines.map((l, i) => (
              <Text key={`${l.key}-${i}`} style={s.ingTxt}>
                {(ingredients[l.key] && ingredients[l.key].emoji) || '•'} {lineText(l)}
              </Text>
            ))}
          </View>
        ) : null}
        {body}
      </ScrollView>

      {fini ? null : (
        <View style={s.ft}>
          <TouchableOpacity
            style={[s.ftBtn, !hist.length && s.ftOff]}
            onPress={onUndo}
            disabled={!hist.length}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={18}
              color={hist.length ? T.ink : '#CBD5E1'}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.ftTxt, !hist.length && { color: '#CBD5E1' }]}>{t('cook.k.undo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.ftBtn, { marginLeft: 8 }, S.pz && s.ftOn, !(active(S) || S.pz) && s.ftOff]}
            onPress={onAll}
            disabled={!(active(S) || S.pz)}
          >
            <Ionicons
              name={S.pz ? 'play' : 'pause'}
              size={18}
              color={active(S) || S.pz ? T.ink : '#CBD5E1'}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.ftTxt, !(active(S) || S.pz) && { color: '#CBD5E1' }]}>
              {S.pz ? t('cook.k.resumeAll') : t('cook.k.pauseAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const ORANGE = '#B45309';
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  hd: { backgroundColor: '#fff', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12 },
  hdTop: { flexDirection: 'row', alignItems: 'center' },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  h1: { flex: 1, fontSize: 19, fontWeight: '700', color: T.ink, textAlign: 'center' },
  h2: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 },
  h2Txt: { fontSize: 14, color: T.muted, paddingHorizontal: 4, flexShrink: 1 },
  h2Ok: { fontSize: 14, fontWeight: '700', color: '#07795f' },
  pb: {
    height: 6,
    backgroundColor: '#EEF1F4',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    marginHorizontal: 4,
  },
  pbIn: { height: 6, backgroundColor: T.brand },
  resumed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  resumedTxt: { fontSize: 13, color: T.muted, flexShrink: 1 },
  restart: { fontSize: 13, fontWeight: '700', color: '#07795f', marginLeft: 10 },
  ls: { flex: 1 },
  ingBox: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 },
  ingTxt: { fontSize: 15, color: T.ink, fontWeight: '600', lineHeight: 26 },
  al: {
    backgroundColor: T.brand,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  alTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  alTxt: { color: '#fff', fontSize: 14, marginTop: 2 },
  rw: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 4 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 12,
  },
  dotTxt: { fontSize: 13, color: T.faint, fontWeight: '700' },
  dotDone: { backgroundColor: T.brand, borderColor: T.brand },
  dotCook: { borderColor: T.accent },
  dotOk: { borderColor: T.brand },
  rt: { fontSize: 15, lineHeight: 20, color: '#334155', paddingTop: 3 },
  rtDone: { flex: 1, color: T.faint, textDecorationLine: 'line-through' },
  rs: { fontSize: 13, color: T.faint, marginTop: 2 },
  ck: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7EA',
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
  },
  ckOk: { backgroundColor: T.brandSoft },
  ckName: { fontSize: 15, fontWeight: '700', color: T.ink, lineHeight: 20 },
  ckTime: {
    fontSize: 24,
    fontWeight: '600',
    color: ORANGE,
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
  ec: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: T.brand,
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
  },
  mini: { flexDirection: 'row', marginTop: 6 },
  miniBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    justifyContent: 'center',
    marginRight: 6,
  },
  miniOn: { backgroundColor: T.brand, borderColor: T.brand },
  miniTxt: { fontSize: 13, fontWeight: '600', color: T.ink },
  nw: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: T.brand,
    ...T.shadow,
  },
  nl: { fontSize: 12, fontWeight: '600', color: '#07795f', letterSpacing: 0.5 },
  nowTitle: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    color: T.ink,
    marginTop: 6,
    marginBottom: 6,
  },
  nt: { fontSize: 18, fontWeight: '700', color: T.ink, marginTop: 6 },
  qt: {
    alignSelf: 'flex-start',
    backgroundColor: T.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  qtTxt: { fontSize: 14, fontWeight: '700', color: '#07795f' },
  nd: { fontSize: 14, color: T.muted, lineHeight: 19 },
  big: {
    fontSize: 54,
    fontWeight: '600',
    textAlign: 'center',
    color: T.ink,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  bar: { height: 8, backgroundColor: '#EEF1F4', borderRadius: 4, overflow: 'hidden' },
  barIn: { height: 8, backgroundColor: T.brand },
  over: { textAlign: 'center', color: ORANGE, fontWeight: '700', fontSize: 15, marginTop: 6 },
  btns: { flexDirection: 'row', marginTop: 12 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.brand,
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnBig: { minHeight: 54, marginTop: 12 },
  btnBigTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  btnSec: {
    width: 100,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: T.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecTxt: { color: T.ink, fontSize: 16, fontWeight: '600' },
  wait: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: T.accent,
    alignItems: 'stretch',
  },
  fin: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 10 },
  finTitle: { fontSize: 28, fontWeight: '600', color: T.ink, marginBottom: 6 },
  ft: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEF1F4',
  },
  ftBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ftOn: { backgroundColor: T.accent, borderColor: T.accent },
  ftOff: { borderColor: '#E5E7EB' },
  ftTxt: { fontSize: 15, fontWeight: '600', color: T.ink },
});
