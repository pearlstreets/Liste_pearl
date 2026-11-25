// Menu en une phrase : demande (tapée ou dictée au clavier), menu proposé à confirmer, « vous avez peut-être
// déjà… », choix de l'enseigne (livraison, drive, magasin) puis panier prêt.
// Rien n'est enregistré avant « Confirmer le menu ». Logique : lib/menus/express.js et lib/menus/enseignes.js.
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '../ui/IoniconsSens';
import { T, SERIF, TAILLES } from './theme';
import { MARCHE } from '../ui/marche';
import { Chip, PrimaryButton, GhostButton, Field } from './ui';
import { useMenus } from './MenusContext';
import useT from './useT';
import RecipeVisual, { IngredientThumb } from './RecipeVisual';
import { formatEur } from '../../lib/menus';
import { lineTexts } from '../../lib/menus/lineText';
import { parseRequest, draftMeals } from '../../lib/menus/express';
import {
  MODES,
  enseignesFor,
  enseigneById,
  adapterFor,
  estimateCart,
  openUrl,
  storeMapUrl,
} from '../../lib/menus/enseignes';
import { prefillProducts } from '../../lib/menus/listBridge';
import { allerA } from '../../app/onglets';

const STORE_KEY = 'menus.express.store'; // dernière enseigne et dernier mode choisis
const LOADING_MIN_MS = 1400; // l'écran « menu parfait » reste lisible même quand le calcul est immédiat

function Header({ title, onBack, t, icon = 'close' }) {
  return (
    <View style={s.top}>
      <TouchableOpacity
        onPress={onBack}
        style={s.x}
        accessibilityRole="button"
        accessibilityLabel={t(icon === 'close' ? 'common.close' : 'common.back')}
      >
        <Ionicons name={icon === 'close' ? 'close' : 'chevron-back'} size={26} color={T.ink} />
      </TouchableOpacity>
      <Text style={s.topTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.x} />
    </View>
  );
}

/* ---------------------------------- demande ---------------------------------- */

function understoodChips(req, t) {
  const out = [];
  const u = new Set(req.understood);
  if (u.has('count')) out.push(t('express.uCount', { count: req.count }));
  if (req.slot === 'midi') out.push(t('express.uMidi'));
  if (req.slot === 'both') out.push(t('express.uBoth'));
  if (u.has('time')) out.push(t('express.uTime', { n: req.maxTime }));
  if (u.has('persons')) out.push(t('express.uPersons', { count: req.persons }));
  for (const d of req.diets) out.push(t(`tags.${d}`));
  for (const l of req.likes) {
    const k = ['pates', 'riz'].includes(l) ? `likes.b_${l}` : `likes.p_${l}`;
    out.push(t(k));
  }
  for (const c of req.cuisines) out.push(t(`discover.cuisines.${c}`));
  if (u.has('balanced')) out.push(t('express.uBalanced'));
  if (u.has('cheap')) out.push(t('express.uCheap'));
  return out;
}

const Ask = memo(function Ask({ text, setText, onCompose, onClose, t, error }) {
  const req = useMemo(() => parseRequest(text), [text]);
  const chips = useMemo(() => understoodChips(req, t), [req, t]);
  const ok = text.trim().length > 0;
  return (
    <View style={s.root}>
      <Header title={t('express.open')} onBack={onClose} t={t} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.big}>{t('express.title')}</Text>
        <Text style={s.intro}>{t('express.intro')}</Text>
        <Field
          value={text}
          onChangeText={setText}
          placeholder={t('express.placeholder')}
          multiline
          autoFocus
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={() => ok && onCompose()}
          style={s.input}
          accessibilityLabel={t('express.title')}
        />
        <View style={s.hintRow}>
          <Ionicons name="mic-outline" size={16} color={T.muted} />
          <Text style={s.hint}>{t('express.dictate')}</Text>
        </View>
        {ok && chips.length ? (
          <>
            <Text style={s.section}>{t('express.understood')}</Text>
            <View style={s.chips}>
              {chips.map((c, i) => (
                <View key={`${c}-${i}`} style={s.chipGap}>
                  <Chip small on label={c} />
                </View>
              ))}
            </View>
          </>
        ) : null}
        {!ok ? (
          <>
            <Text style={s.section}>{t('express.examples')}</Text>
            {['ex1', 'ex2', 'ex3'].map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setText(t(`express.${k}`))}
                style={s.example}
                accessibilityRole="button"
              >
                <Ionicons name="sparkles-outline" size={16} color={T.brandDark} />
                <Text style={s.exampleTxt}>{t(`express.${k}`)}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
        {error ? <Text style={s.warn}>{error}</Text> : null}
      </ScrollView>
      <View style={s.bottom}>
        <PrimaryButton
          icon="sparkles"
          label={t('express.compose')}
          disabled={!ok}
          onPress={onCompose}
          style={[s.btn, s.btnNoir]}
        />
      </View>
    </View>
  );
});

/* ---------------------------------- chargement ---------------------------------- */

function Composing({ t }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % 3), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={[s.root, s.center]}>
      <View style={s.bubble}>
        <Ionicons name="restaurant" size={40} color={T.brandDark} />
      </View>
      <Text style={[s.big, { textAlign: 'center', marginTop: 22 }]}>
        {t(`express.loading${i + 1}`)}
      </Text>
      <ActivityIndicator style={{ marginTop: 22 }} color={T.brand} />
    </View>
  );
}

/* ---------------------------------- menu ---------------------------------- */

const MealCard = memo(function MealCard({
  meal,
  recipe,
  title,
  when,
  price,
  canPortions,
  onSwap,
  onDrop,
  onPortions,
  t,
}) {
  const persons = Math.max(1, Math.round(Number(meal.heads || meal.persons) || 1));
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <RecipeVisual recipe={recipe} height={72} round />
        <View style={s.cardBody}>
          <Text style={s.when}>{when}</Text>
          <Text style={s.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={s.meta}>
            {[recipe && recipe.timeMin ? `${recipe.timeMin} min` : '', price]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {canPortions ? (
            <View style={s.portions}>
              <TouchableOpacity
                onPress={() => onPortions(meal.key, Math.max(1, persons - 1))}
                disabled={persons <= 1}
                style={[s.miniBtn, persons <= 1 && { opacity: 0.4 }]}
                accessibilityLabel="-"
              >
                <Ionicons name="remove" size={16} color={T.ink} />
              </TouchableOpacity>
              <Text
                style={s.miniVal}
                accessibilityLabel={t('express.uPersons', { count: persons })}
              >
                {t('express.uPersons', { count: persons })}
              </Text>
              <TouchableOpacity
                onPress={() => onPortions(meal.key, Math.min(12, persons + 1))}
                disabled={persons >= 12}
                style={[s.miniBtn, persons >= 12 && { opacity: 0.4 }]}
                accessibilityLabel="+"
              >
                <Ionicons name="add" size={16} color={T.ink} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={s.meta}>{t('express.uPersons', { count: persons })}</Text>
          )}
        </View>
      </View>
      <View style={s.cardActions}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => onSwap(meal.key)}
          style={s.action}
          accessibilityRole="button"
        >
          <Ionicons name="swap-horizontal" size={16} color={T.ink} />
          <Text style={s.actionTxt}>{t('express.replace')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDrop(meal.key)}
          style={[s.action, { marginLeft: 8 }]}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={16} color={T.danger} />
          <Text style={[s.actionTxt, { color: T.danger }]}>{t('express.remove')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

/* ---------------------------------- écran ---------------------------------- */

export default function ExpressScreen({ onClose, onDone, navigation }) {
  const t = useT();
  const m = useMenus();
  const { texts, recipeById, lang, profile } = m;
  const [step, setStep] = useState('ask'); // ask | loading | menu | have | store | cart
  const [text, setText] = useState('');
  const [req, setReq] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [haveLines, setHaveLines] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('livraison');
  const [store, setStore] = useState(null); // id d'enseigne ou 'pearl'
  const [sent, setSent] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );

  // Dernier choix d'enseigne gardé (comme une enseigne favorite).
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        const v = raw ? JSON.parse(raw) : null;
        if (v && MODES.includes(v.mode)) setMode(v.mode);
      })
      .catch(() => {});
  }, []);

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

  const compose = useCallback(async () => {
    Keyboard.dismiss();
    const r = parseRequest(text);
    setReq(r);
    setError('');
    setStep('loading');
    const started = Date.now();
    let plan = null;
    try {
      plan = await m.expressDraft(r);
    } catch {
      plan = null;
    }
    const wait = LOADING_MIN_MS - (Date.now() - started);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    if (!alive.current) return;
    if (!plan) {
      setError(t('express.none'));
      setStep('ask');
      return;
    }
    setDraft(plan);
    setStep('menu');
  }, [text, m, t]);

  const meals = useMemo(() => draftMeals(draft), [draft]);
  const priceOf = useCallback(
    (meal) => {
      const r = recipeById.get(meal.recipeId);
      return r ? m.costOf(r, meal.persons).total || 0 : 0;
    },
    [recipeById, m]
  );
  const menuTotal = useMemo(() => meals.reduce((a, x) => a + priceOf(x), 0), [meals, priceOf]);

  const onSwap = useCallback((key) => setDraft((d) => m.expressSwap(d, key, req)), [m, req]);
  const onDrop = useCallback((key) => setDraft((d) => m.expressDrop(d, key)), [m]);
  const onPortions = useCallback(
    (key, v) => setDraft((d) => m.expressPortions(d, key, v, req)),
    [m, req]
  );

  const toHave = useCallback(() => {
    const lines = m.expressLines(draft).filter((l) => l.maybeHave);
    setHaveLines(lines);
    setRemoved(
      lines.map((l) => l.key).filter((k) => ((profile && profile.pantry) || []).includes(k))
    );
    if (lines.length) setStep('have');
    else confirm([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, draft, profile]);

  const confirm = useCallback(
    async (rem) => {
      if (saving) return;
      setSaving(true);
      let next = null;
      try {
        next = await m.expressConfirm(draft, req, rem);
      } catch {
        next = null;
      }
      if (!alive.current) return;
      setSaving(false);
      if (!next) {
        setError(t('express.error'));
        return;
      }
      setError('');
      setStep('store');
    },
    [saving, m, draft, req, t]
  );

  const chooseStore = useCallback(
    (id) => {
      setStore(id);
      setSent(false);
      setStep('cart');
      AsyncStorage.setItem(STORE_KEY, JSON.stringify({ mode, id })).catch(() => {});
    },
    [mode]
  );

  const sendList = useCallback(async () => {
    let r = null;
    try {
      r = await m.sendToList(null, m.activeLines);
    } catch {
      r = null;
    }
    if (!alive.current) return r;
    if (r && (r.status === 'ok' || r.status === 'already')) setSent(true);
    return r;
  }, [m]);

  const goPearl = useCallback(async () => {
    const r = await sendList();
    try {
      await prefillProducts(r && r.listId != null ? r.listId : null);
    } catch {}
    try {
      DeviceEventEmitter.emit('PRODUCTS_RESET');
    } catch {}
    allerA(navigation, 'products');
    onDone();
  }, [sendList, navigation, onDone]);

  /* ------------------------------ rendu par étape ------------------------------ */

  if (step === 'ask')
    return (
      <Ask
        text={text}
        setText={setText}
        onCompose={compose}
        onClose={onClose}
        t={t}
        error={error}
      />
    );

  if (step === 'loading') return <Composing t={t} />;

  if (step === 'menu') {
    const canPortions = !(profile && profile.members);
    return (
      <View style={s.root}>
        <Header title={t('express.menuTitle')} onBack={() => setStep('ask')} t={t} icon="back" />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.intro}>
            {t('express.menuSub', { count: meals.length, price: formatEur(menuTotal, lang) })}
          </Text>
          {meals.map((meal) => {
            const r = recipeById.get(meal.recipeId);
            return (
              <MealCard
                key={meal.key}
                meal={meal}
                recipe={r}
                title={r ? texts.recipeTitle(r.id) : ''}
                when={`${t(`days.long.${meal.day}`)} · ${t(`slot.${meal.slot}`)}`}
                price={`~${formatEur(priceOf(meal), lang)}`}
                canPortions={canPortions}
                onSwap={onSwap}
                onDrop={onDrop}
                onPortions={onPortions}
                t={t}
              />
            );
          })}
          {m.plan && m.plan.meals && m.plan.meals.some((x) => x && x.recipeId) ? (
            <Text style={s.note}>{t('express.keepsHistory')}</Text>
          ) : null}
          {error ? <Text style={s.warn}>{error}</Text> : null}
        </ScrollView>
        <View style={s.bottom}>
          <PrimaryButton
            icon="checkmark"
            label={t('express.confirm')}
            disabled={meals.length === 0}
            loading={saving}
            onPress={toHave}
            style={[s.btn, s.btnNoir]}
          />
          <GhostButton label={t('express.edit')} onPress={() => setStep('ask')} />
        </View>
      </View>
    );
  }

  if (step === 'have') {
    const rem = new Set(removed);
    return (
      <View style={s.root}>
        <Header title={t('express.haveTitle')} onBack={() => setStep('menu')} t={t} icon="back" />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.intro}>{t('express.haveIntro')}</Text>
          <TouchableOpacity
            onPress={() => setRemoved(haveLines.map((l) => l.key))}
            style={s.removeAll}
            accessibilityRole="button"
          >
            <Text style={s.removeAllTxt}>{t('express.removeAll')}</Text>
          </TouchableOpacity>
          {haveLines.map((l) => {
            const off = rem.has(l.key);
            const lt = lineTexts(l, t, { lang, labels: qtyLabels });
            return (
              <View key={l.key} style={s.line}>
                <IngredientThumb ingKey={l.key} />
                <View style={s.lineBody}>
                  <Text style={[s.lineName, off && s.lineOff]} numberOfLines={1}>
                    {texts.ingredientName(l.key)}
                  </Text>
                  {lt.qtyText ? <Text style={s.meta}>{lt.qtyText}</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setRemoved((r) => (off ? r.filter((k) => k !== l.key) : [...r, l.key]))
                  }
                  style={s.action}
                  accessibilityRole="button"
                >
                  <Text style={[s.actionTxt, !off && { color: T.danger }]}>
                    {t(off ? 'express.putBack' : 'express.remove')}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {error ? <Text style={s.warn}>{error}</Text> : null}
        </ScrollView>
        <View style={s.bottom}>
          <PrimaryButton
            icon="arrow-forward"
            label={t('express.continue')}
            loading={saving}
            onPress={() => confirm(removed)}
            style={[s.btn, s.btnNoir]}
          />
        </View>
      </View>
    );
  }

  if (step === 'store') {
    const list = enseignesFor(mode);
    return (
      <View style={s.root}>
        <Header title={t('express.storeTitle')} onBack={onDone} t={t} />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.seg}>
            {MODES.map((x) => (
              <TouchableOpacity
                key={x}
                onPress={() => setMode(x)}
                style={[s.segBtn, mode === x && s.segOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === x }}
              >
                <Text style={[s.segTxt, mode === x && { color: '#fff' }]} numberOfLines={1}>
                  {t(`express.mode_${x}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {mode === 'livraison' ? (
            <StoreRow
              color={T.brand}
              initial="P"
              name={t('express.pearlName')}
              text={t('express.pearlText')}
              onPress={() => chooseStore('pearl')}
            />
          ) : null}
          {list.map((e) => (
            <StoreRow
              key={e.id}
              color={e.color}
              initial={e.name.replace(/^E\./, '').charAt(0)}
              name={e.name}
              text={t(mode === 'magasin' ? 'express.storeShop' : 'express.storeSite')}
              onPress={() => chooseStore(e.id)}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  // panier
  const isPearl = store === 'pearl';
  const e = isPearl ? null : enseigneById(store);
  const name = isPearl ? t('express.pearlName') : e ? e.name : '';
  const ad = isPearl ? null : adapterFor(store);
  const inStore = mode === 'magasin' || (e && !e.search);
  const cart = estimateCart(m.activeLines, isPearl ? null : store, (k) => texts.ingredientName(k));
  const info = isPearl
    ? t('express.cartPearl')
    : inStore
      ? t('express.cartShop', { name })
      : t('express.cartLink', { name });
  return (
    <View style={s.root}>
      <Header
        title={t('express.cartTitle', { name })}
        onBack={() => setStep('store')}
        t={t}
        icon="back"
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {cart.items.length ? (
          <>
            <Text style={s.intro}>
              {t('express.cartSub', {
                count: cart.items.length,
                price: formatEur(cart.total, lang),
              })}
            </Text>
            {ad && ad.partner ? null : <Text style={s.note}>{info}</Text>}
            {cart.items.map((it) => {
              const lt = lineTexts(it.line, t, { lang, labels: qtyLabels });
              return (
                <View key={it.key} style={s.line}>
                  <IngredientThumb ingKey={it.key} />
                  <View style={s.lineBody}>
                    <Text style={s.lineName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {[
                        lt.packText || lt.qtyText,
                        it.line.free ? '' : `~${formatEur(it.line.estimatedEur, lang)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {it.searchUrl && !inStore ? (
                    <TouchableOpacity
                      onPress={() => openUrl(it.searchUrl)}
                      style={s.action}
                      accessibilityRole="link"
                    >
                      <Ionicons name="search" size={15} color={T.ink} />
                      <Text style={s.actionTxt}>{t('express.search')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : (
          <Text style={s.intro}>{t('express.cartEmpty')}</Text>
        )}
        {error ? <Text style={s.warn}>{error}</Text> : null}
      </ScrollView>
      <View style={s.bottom}>
        {cart.items.length ? (
          isPearl ? (
            <PrimaryButton
              icon="bicycle"
              label={t('express.pearlGo')}
              onPress={goPearl}
              style={[s.btn, s.btnNoir]}
            />
          ) : ad && ad.partner && ad.capabilities.cart ? (
            <PrimaryButton
              icon="cart"
              label={t('express.fillCart', { name })}
              onPress={async () => {
                try {
                  const r = await ad.fillCart(cart.items, { mode });
                  if (r && r.url) openUrl(r.url);
                } catch {
                  setError(t('express.error'));
                }
              }}
              style={[s.btn, s.btnNoir]}
            />
          ) : inStore ? (
            <PrimaryButton
              icon="navigate"
              label={t('express.route')}
              onPress={() => openUrl(storeMapUrl(store))}
              style={[s.btn, s.btnNoir]}
            />
          ) : (
            <PrimaryButton
              icon="open-outline"
              label={t('express.openSite', { name })}
              onPress={() => openUrl(ad && ad.siteUrl)}
              style={[s.btn, s.btnNoir]}
            />
          )
        ) : null}
        {cart.items.length && !isPearl ? (
          <PrimaryButton
            soft
            icon={sent ? 'checkmark' : 'list'}
            label={t(sent ? 'express.sent' : 'express.toList')}
            disabled={sent}
            onPress={sendList}
            style={[s.btn, { marginTop: 10 }]}
          />
        ) : null}
        <GhostButton label={t('express.done')} onPress={onDone} />
      </View>
    </View>
  );
}

const StoreRow = memo(function StoreRow({ color, initial, name, text, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.store} accessibilityRole="button">
      <View style={[s.logo, { backgroundColor: color }]}>
        <Text style={s.logoTxt}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.storeName}>{name}</Text>
        <Text style={s.meta}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={T.faint} />
    </TouchableOpacity>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TAILLES.marge - 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: SERIF,
    fontSize: 19,
    fontWeight: '600',
    color: T.ink,
  },
  x: {
    width: TAILLES.icone,
    height: TAILLES.icone,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: TAILLES.marge, paddingBottom: 32 },
  big: { fontFamily: SERIF, fontSize: 26, fontWeight: '600', color: T.ink, marginTop: 8 },
  intro: { fontSize: 15, lineHeight: 22, color: T.muted, fontWeight: '600', marginTop: 6 },
  input: { minHeight: 110, marginTop: 16, paddingTop: 14, textAlignVertical: 'top', fontSize: 16 },
  hintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  hint: { marginLeft: 6, fontSize: 13, color: T.muted, fontWeight: '600', flexShrink: 1 },
  section: {
    fontFamily: SERIF,
    fontSize: 19,
    fontWeight: '600',
    color: T.ink,
    marginTop: 22,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chipGap: { marginRight: 6, marginBottom: 6 },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  exampleTxt: { marginLeft: 8, fontSize: 15, color: T.ink, fontWeight: '600', flexShrink: 1 },
  bubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: T.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: TAILLES.rayonCarte,
    padding: 12,
    marginTop: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardBody: { flex: 1, marginLeft: 12 },
  when: { fontSize: 12, fontWeight: '700', color: T.brandDark },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: T.ink, marginTop: 2 },
  meta: { fontSize: 13, color: T.muted, fontWeight: '600', marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  portions: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  miniBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: T.borderInput,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniVal: { minWidth: 56, textAlign: 'center', fontSize: 14, fontWeight: '700', color: T.ink },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.borderInput,
    backgroundColor: '#fff',
  },
  actionTxt: { marginLeft: 4, fontSize: 13, fontWeight: '700', color: T.ink },
  note: { fontSize: 13, lineHeight: 19, color: T.muted, fontWeight: '600', marginTop: 12 },
  warn: { fontSize: 13, lineHeight: 19, color: T.danger, fontWeight: '700', marginTop: 10 },
  removeAll: { alignSelf: 'flex-end', paddingVertical: 8 },
  removeAllTxt: { fontSize: 14, fontWeight: '700', color: T.danger },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    minHeight: 56,
  },
  lineBody: { flex: 1, marginLeft: 10, marginRight: 8 },
  lineName: { fontSize: 15, fontWeight: '700', color: T.ink },
  lineOff: { color: T.faint, textDecorationLine: 'line-through' },
  seg: {
    flexDirection: 'row',
    height: TAILLES.bouton,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: TAILLES.rayonBouton,
    padding: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TAILLES.rayonBouton - 4,
  },
  segOn: { backgroundColor: MARCHE.noir },
  segTxt: { fontSize: 14, fontWeight: '600', color: T.muted },
  store: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: TAILLES.rayonCarte,
    padding: 14,
    marginTop: 10,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  storeName: { fontSize: 16, fontWeight: '700', color: T.ink },
  bottom: {
    paddingHorizontal: TAILLES.marge,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  btn: {
    alignSelf: 'stretch',
    height: TAILLES.bouton,
    minHeight: TAILLES.bouton,
    borderRadius: TAILLES.rayonBouton,
  },
  btnNoir: { backgroundColor: MARCHE.noir },
});
