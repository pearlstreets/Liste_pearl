// Feuilles du bas : changer un plat (3 idées) et confirmation d'ajout à la liste.
import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '../ui/IoniconsSens';
import { formatEur, cleanMembers, guestsOf, headsFor } from '../../lib/menus';
import { T } from './theme';
import { PrimaryButton, GhostButton, Empty, Stepper } from './ui';
import RecipeVisual, { IngredientThumb } from './RecipeVisual';
import { portionTarget, recipePortionScale } from '../../lib/menus/needs';
import { useMenus } from './MenusContext';
import useT from './useT';

export function Sheet({ onClose, children, label }) {
  return (
    <View style={s.overlay} pointerEvents="box-none">
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={label} />
      <View style={s.sheet}>
        <View style={s.grab} />
        {children}
      </View>
    </View>
  );
}

/** "gluten, lait" : ce que l'avertissement a repéré, en clair. */
export function warningList(w, t) {
  const propres = ['porc', 'viande', 'alcool'];
  return [
    ...w.allergens.map((a) => t(propres.includes(a) ? `myRecipes.allergen.${a}` : `allergens.${a}`)),
    ...w.ingredients,
  ].join(', ');
}

/** Recette personnelle posée à la main : profil restreint = accord explicite d'abord. */
function confirmManual(warning, t, onOk) {
  if (!warning) {
    onOk();
    return;
  }
  Alert.alert(
    t('myRecipes.confirmTitle'),
    warning.found
      ? t('myRecipes.warnFound', { list: warningList(warning, t) })
      : t('myRecipes.warnUnknown'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('myRecipes.confirmAdd'), onPress: onOk },
    ]
  );
}

/** Choisir le repas du plan où poser une recette personnelle. */
export const PlanPickSheet = memo(function PlanPickSheet({ recipe, onClose, onDone }) {
  const t = useT();
  const { plan, swap, texts, warningOf } = useMenus();
  const meals = ((plan && plan.meals) || []).filter((x) => x && !x.leftoverOf);
  const pick = (key) =>
    confirmManual(warningOf(recipe), t, async () => {
      await swap(key, recipe.id, { manual: true });
      onClose();
      onDone();
    });
  return (
    <Sheet onClose={onClose} label={t('common.close')}>
      <Text style={s.title}>{t('myRecipes.planTitle')}</Text>
      {meals.length === 0 ? (
        <Empty
          icon="calendar-outline"
          title={t('myRecipes.noPlanTitle')}
          text={t('myRecipes.noPlanText')}
        />
      ) : (
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {meals.map((x) => (
            <TouchableOpacity
              key={x.key}
              activeOpacity={0.85}
              onPress={() => pick(x.key)}
              style={s.idea}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={s.ideaTitle}>
                  {t(`days.long.${x.day}`)} · {t(`slot.${x.slot}`)}
                </Text>
                <Text style={s.ideaMeta} numberOfLines={1}>
                  {x.recipeId ? texts.recipeTitle(x.recipeId) : t('week.free')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={T.faint} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <GhostButton label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
});

/** Changer un plat : 3 idées au choix, ou une surprise. */
export const SwapSheet = memo(function SwapSheet({ mealKey, onClose }) {
  const t = useT();
  const { suggest, swap, texts, ingredients, lang, costOf, plan, myRecipes, warningOf, profile } =
    useMenus();
  const [ideas, setIdeas] = useState([]);
  const meal = plan && plan.meals.find((m) => m.key === mealKey);
  useEffect(() => {
    setIdeas(suggest(3, mealKey));
  }, [mealKey, suggest]);
  const persons = (meal && meal.persons) || 2;
  const pt = portionTarget(profile);
  const pick = async (id) => {
    onClose();
    await swap(mealKey, id);
  };
  const pickMine = (r) =>
    confirmManual(warningOf(r), t, async () => {
      onClose();
      await swap(mealKey, r.id, { manual: true });
    });
  const mine = myRecipes.filter((r) => !ideas.some((x) => x.id === r.id));
  return (
    <Sheet onClose={onClose} label={t('common.close')}>
      <Text style={s.title}>{t('swap.title')}</Text>
      <Text style={s.sub}>{t('swap.sub')}</Text>
      <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
        {ideas.length === 0 ? (
          <Empty icon="help-circle-outline" title={t('swap.noneTitle')} text={t('swap.noneText')} />
        ) : (
          ideas.map((r) => {
            // Portions réellement cuisinées, comme le prix de la carte une fois le plat choisi.
            const sc = pt ? recipePortionScale(profile, r, pt) : 1;
            const c = costOf(r, persons * sc);
            const perPerson =
              sc === 1 ? c.perPerson : Math.round((c.total / persons) * 100) / 100;
            return (
              <TouchableOpacity
                key={r.id}
                activeOpacity={0.85}
                onPress={() => pick(r.id)}
                style={s.idea}
                accessibilityRole="button"
              >
                <RecipeVisual recipe={r} ingredients={ingredients} height={64} round />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.ideaTitle} numberOfLines={2}>
                    {texts.recipeTitle(r.id)}
                  </Text>
                  <Text style={s.ideaMeta}>
                    {t('recipe.minutes', { n: r.timeMin })}
                    {r.custom
                      ? ''
                      : ` · ${t('week.perPerson', { price: formatEur(perPerson, lang) })}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={T.faint} />
              </TouchableOpacity>
            );
          })
        )}
        {mine.length ? <Text style={s.mineLabel}>{t('discover.modes.myRecipes')}</Text> : null}
        {mine.map((r) => (
          <TouchableOpacity
            key={r.id}
            activeOpacity={0.85}
            onPress={() => pickMine(r)}
            style={s.idea}
            accessibilityRole="button"
          >
            <RecipeVisual recipe={r} ingredients={ingredients} height={64} round />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.ideaTitle} numberOfLines={2}>
                {r.title}
              </Text>
              <Text style={s.ideaMeta}>{t('recipe.minutes', { n: r.timeMin })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={T.faint} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ marginTop: 14 }}>
        <PrimaryButton
          soft
          icon="shuffle"
          label={t('swap.surprise')}
          onPress={() => pick(undefined)}
        />
        <GhostButton label={t('common.cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
});

/** Texte de la ligne « Pour qui ? » d'un repas : noms des convives ou nombre de personnes, '' = tout le foyer. */
export function guestsText(profile, meal, t) {
  try {
    const g = guestsOf(profile, meal);
    if (!g) return '';
    if (g.eaters) {
      const all = cleanMembers(profile && profile.members);
      return g.eaters
        .map((id) => {
          const i = all.findIndex((m) => m.id === id);
          return all[i].name.trim() || t('nutri.person', { n: i + 1 });
        })
        .join(', ');
    }
    return t('week.persons', { count: g.heads });
  } catch {
    return '';
  }
}

/** Pour qui ? Les personnes qui mangent ce repas (cases), ou leur nombre sans personnes renseignées. */
export const GuestsSheet = memo(function GuestsSheet({ mealKey, onClose }) {
  const t = useT();
  const { plan, profile, setGuests } = useMenus();
  const meal = plan && plan.meals.find((m) => m.key === mealKey);
  const members = useMemo(() => cleanMembers(profile && profile.members), [profile]);
  const have = meal ? guestsOf(profile, meal) : null;
  const [sel, setSel] = useState(() =>
    have && have.eaters ? have.eaters : members.map((m) => m.id)
  );
  const [heads, setHeads] = useState(() =>
    have && have.heads ? have.heads : meal ? headsFor(profile, meal.day, meal.slot).heads : 2
  );
  if (!meal) return null;
  const detailed = members.length > 0;
  const toggle = (id) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const ok = detailed ? sel.length > 0 : true;
  const save = async () => {
    if (!ok) return;
    onClose();
    await setGuests(mealKey, detailed ? { eaters: sel } : { heads });
  };
  const reset = async () => {
    onClose();
    await setGuests(mealKey, {});
  };
  return (
    <Sheet onClose={onClose} label={t('common.close')}>
      <Text style={s.title}>{t('guests.title')}</Text>
      <Text style={s.sub}>{t(detailed ? 'guests.sub' : 'guests.subHeads')}</Text>
      {detailed ? (
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {members.map((m, i) => {
            const on = sel.includes(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.85}
                onPress={() => toggle(m.id)}
                style={s.idea}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={on ? T.brandDark : T.faint}
                  style={{ marginRight: 12 }}
                />
                <Text style={s.ideaTitle} numberOfLines={1}>
                  {m.name.trim() || t('nutri.person', { n: i + 1 })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Stepper value={heads} onChange={setHeads} min={1} max={24} label={t('guests.title')} />
        </View>
      )}
      {!ok ? <Text style={s.hint}>{t('guests.atLeast')}</Text> : null}
      <View style={{ marginTop: 12 }}>
        <PrimaryButton label={t('guests.done')} onPress={save} disabled={!ok} />
        {have ? <GhostButton label={t('guests.all')} onPress={reset} /> : null}
        <GhostButton label={t('common.cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
});

/** Confirmation après l'envoi des courses vers une liste Pearl. */
export const AddedSheet = memo(function AddedSheet({
  result,
  listName,
  onClose,
  onSeeList,
  onCompare,
}) {
  const t = useT();
  const st = result && result.status;
  const ok = st === 'ok';
  const already = st === 'already';
  const bad = !ok && !already;
  const icon = ok ? 'checkmark' : already ? 'checkmark-done' : 'alert';
  return (
    <Sheet onClose={onClose} label={t('common.close')}>
      <View style={{ alignItems: 'center', paddingTop: 6 }}>
        <View style={[s.badge, bad && { backgroundColor: T.dangerSoft }]}>
          <Ionicons
            name={icon}
            size={34}
            color={bad ? T.danger : '#fff'}
            style={bad ? null : undefined}
          />
        </View>
        <Text style={[s.title, { textAlign: 'center', marginTop: 14 }]}>
          {ok
            ? t('added.ok', { count: result.count })
            : already
              ? t('added.already')
              : t(`added.err.${st}`, { defaultValue: t('added.err.error') })}
        </Text>
        {!bad ? (
          <Text style={[s.sub, { textAlign: 'center' }]}>
            {ok
              ? result.delta
                ? t('added.deltaText', { name: listName })
                : t('added.okText', { name: listName })
              : t('added.alreadyText', { name: listName })}
          </Text>
        ) : null}
      </View>
      <View style={{ marginTop: 18 }}>
        {!bad ? (
          <>
            <PrimaryButton icon="list" label={t('added.seeList')} onPress={onSeeList} />
            <View style={{ height: 10 }} />
            <PrimaryButton soft icon="pricetags" label={t('added.compare')} onPress={onCompare} />
            <Text style={s.hint}>{t('added.compareHint')}</Text>
          </>
        ) : null}
        <GhostButton label={t('common.close')} onPress={onClose} />
      </View>
    </Sheet>
  );
});

/** Choisir les produits d'une recette avant de les ajouter à la liste. */
export const PickProductsSheet = memo(function PickProductsSheet({
  lines,
  initialOff,
  onClose,
  onConfirm,
}) {
  const t = useT();
  const { texts } = useMenus();
  const [sel, setSel] = useState(() => {
    const o = {};
    for (const l of lines || []) o[l.key] = !(initialOff && initialOff[l.key]);
    return o;
  });
  const keys = (lines || []).map((l) => l.key);
  const chosen = keys.filter((k) => sel[k]);
  const allOn = keys.length > 0 && chosen.length === keys.length;
  const setAll = (on) => {
    const o = {};
    for (const k of keys) o[k] = on;
    setSel(o);
  };
  return (
    <Sheet onClose={onClose} label={t('common.close')}>
      <View style={s.pickHead}>
        <Text style={[s.title, { flex: 1 }]}>{t('recipe.pickTitle')}</Text>
        {keys.length > 0 ? (
          <TouchableOpacity onPress={() => setAll(!allOn)} accessibilityRole="button" hitSlop={8}>
            <Text style={s.pickAll}>{allOn ? t('recipe.selectNone') : t('recipe.selectAll')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
        {(lines || []).map((l) => {
          const on = !!sel[l.key];
          return (
            <TouchableOpacity
              key={l.key}
              activeOpacity={0.8}
              onPress={() => setSel((x) => ({ ...x, [l.key]: !x[l.key] }))}
              style={s.pickRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <View style={[s.pickBox, on && s.pickBoxOn]}>
                {on ? <Ionicons name="checkmark" size={14} color={T.card} /> : null}
              </View>
              <IngredientThumb ingKey={l.key} style={{ marginLeft: 10 }} />
              <View style={{ width: 10 }} />
              <Text style={s.pickName} numberOfLines={2}>
                {texts.ingredientName(l.key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={{ marginTop: 14 }}>
        <PrimaryButton
          icon="cart"
          label={t('recipe.addCount', { count: chosen.length })}
          disabled={chosen.length === 0}
          onPress={() => onConfirm(chosen)}
        />
        <GhostButton label={t('common.cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
});

const s = StyleSheet.create({
  mineLabel: { fontSize: 14, fontWeight: '600', color: T.ink, marginTop: 14, marginBottom: 8 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 0,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 10,
    ...T.shadow, borderWidth: 1, borderColor: T.border },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.border,
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '600', color: T.ink },
  sub: { fontSize: 14, color: T.muted, marginTop: 4, marginBottom: 12, lineHeight: 20 },
  idea: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  ideaTitle: { fontSize: 16, fontWeight: '600', color: T.ink },
  ideaMeta: { fontSize: 13, color: T.muted, marginTop: 3 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, color: T.faint, textAlign: 'center', marginTop: 8 },
  pickHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  pickAll: { fontSize: 14, fontWeight: '600', color: T.brandDark, marginLeft: 10 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  pickBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: T.borderInput,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBoxOn: { backgroundColor: T.brand, borderColor: T.brand },
  pickName: { flex: 1, fontSize: 16, fontWeight: '700', color: T.ink },
});
