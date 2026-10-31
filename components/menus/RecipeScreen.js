// Fiche recette : visuel, portions, ingrédients cochables, nutrition estimée, favori, note, étapes.
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  useWindowDimensions,
  DeviceEventEmitter,
  Alert,
} from 'react-native';
import { prefillProducts } from '../../lib/menus/listBridge';
import { Ionicons } from '@expo/vector-icons';
import {
  scaleIngredients,
  formatEur,
  recipeNutrition,
  normalizeLang,
  readMyLists,
} from '../../lib/menus';
import { T } from './theme';
import { PrimaryButton, Stepper, Field, Empty, RoundIcon } from './ui';
import RecipeVisual from './RecipeVisual';
import { AddedSheet, PlanPickSheet, warningList } from './Sheets';
import { useMenus } from './MenusContext';
import useT from './useT';
import { matchLines } from '../../lib/menus/pearl';
import { getTexts } from '../../lib/menus/recipes';
import { usePearlShops, openShopFromMenus } from './usePearl';

const Dots = ({ n }) => (
  <View style={{ flexDirection: 'row', marginRight: 6 }}>
    {[1, 2, 3].map((i) => (
      <View key={i} style={[s.dot, i <= n && { backgroundColor: T.brand }]} />
    ))}
  </View>
);

export default function RecipeScreen({ id, mealKey, onClose, onCook, onEdit, navigation }) {
  const t = useT();
  // Petit écran : photo et boutons fixes réduits, sinon la recette ne se voit plus.
  const compact = useWindowDimensions().height < 700;
  const barBtn = compact ? { minHeight: 44 } : null;
  const m = useMenus();
  const { recipeById, texts, ingredients, lang, profile, plan, favorites, notes, cooked } = m;
  const recipe = recipeById.get(id);
  const meal = mealKey && plan ? plan.meals.find((x) => x.key === mealKey) : null;
  const initial = Math.max(
    1,
    Math.round(meal && meal.persons ? meal.persons : profile.adults + profile.children * 0.6)
  );
  const [persons, setPersons] = useState(initial);
  const [have, setHave] = useState({});
  const [added, setAdded] = useState(null);
  const [addedName, setAddedName] = useState('');
  const [adding, setAdding] = useState(false);
  const [planPick, setPlanPick] = useState(false);
  const [note, setNoteTxt] = useState(notes[id] || '');
  const noteFocused = useRef(false);
  useEffect(() => setNoteTxt(notes[id] || ''), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note arrivée du compte : affichée, sauf si la personne est en train d'écrire.
  useEffect(() => {
    if (!noteFocused.current) setNoteTxt(notes[id] || '');
  }, [notes[id]]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const pearlShops = usePearlShops('product_purchase');
  const lines = useMemo(
    () => (recipe ? scaleIngredients(recipe, persons, { lang: normalizeLang(lang) }) : []),
    [recipe, persons, lang]
  );
  const pearlRows = useMemo(() => {
    const fr = getTexts('fr');
    const r = matchLines(
      lines.filter((l) => !l.optional),
      pearlShops,
      (k) => fr.ingredientName(k)
    );
    return r.covered.map((key) => ({
      key,
      count: r.byKey[key].count,
      min: r.byKey[key].min,
      shop: r.byKey[key].offers[0].shop,
    }));
  }, [lines, pearlShops]);
  const { costOf } = m;
  const cost = useMemo(() => (recipe ? costOf(recipe, persons) : null), [recipe, persons, costOf]);
  const steps = useMemo(() => (recipe ? texts.recipeSteps(id) : []), [recipe, texts, id]);

  const addToMyList = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    const r = await m.sendRecipeToList(id, persons);
    let name = t('shop.defaultList');
    try {
      const mine = await readMyLists();
      const l = mine.lists.find((x) => String(x.id) === String(r.listId));
      if (l && l.name) name = l.name;
    } catch {}
    setAddedName(name);
    setAdding(false);
    setAdded(r);
  }, [adding, m, id, persons, t]);
  const goList = async (screen) => {
    setAdded(null);
    if (screen === 'products') {
      await prefillProducts();
      try {
        DeviceEventEmitter.emit('PRODUCTS_RESET');
      } catch {}
    }
    try {
      onClose();
      navigation.navigate(screen);
    } catch {}
  };

  const qtyText = (l) => {
    if (!l.amount) return '';
    const u = labels[l.displayUnit] !== undefined ? labels[l.displayUnit] : l.displayUnit;
    return u ? `${l.amount} ${u}` : `${l.amount}`;
  };

  const askDelete = () =>
    Alert.alert(t('myRecipes.deleteTitle'), t('myRecipes.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('myRecipes.delete'),
        style: 'destructive',
        onPress: async () => {
          if (await m.removeMyRecipe(id)) onClose();
        },
      },
    ]);

  const share = useCallback(async () => {
    if (!recipe) return;
    const text = [
      texts.recipeTitle(id),
      t('share.for', { count: persons }),
      '',
      t('recipe.ingredients') + ' :',
      ...lines
        .filter((l) => !l.optional)
        .map((l) => {
          const q = qtyText(l);
          return `- ${texts.ingredientName(l.key)}${q ? ` : ${q}` : ''}`;
        }),
      '',
      t('recipe.steps') + ' :',
      ...steps.map((st, i) => `${i + 1}. ${st}`),
      '',
      t('share.signature'),
    ].join('\n');
    try {
      await Share.share({ message: text, title: texts.recipeTitle(id) });
    } catch {}
  }, [recipe, texts, id, persons, lines, steps, t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ padding: 14 }}>
          <RoundIcon name="chevron-back" onPress={onClose} label={t('common.back')} />
        </View>
        <Empty emoji="🔍" title={t('recipe.missingTitle')} text={t('recipe.missingText')} />
      </View>
    );
  }

  const fav = favorites.includes(id);
  const mine = !!recipe.custom;
  const nut = mine ? null : recipeNutrition(recipe);
  const warning = mine ? m.warningOf(recipe) : null;
  const times = cooked[id] ? cooked[id].count : 0;
  const shownTags = (recipe.tags || [])
    .filter((x) => !['hiver', 'printemps', 'ete', 'automne'].includes(x))
    .slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <RecipeVisual recipe={recipe} ingredients={ingredients} height={compact ? 170 : 250} />
          <View style={s.topBtns}>
            <RoundIcon
              name="chevron-back"
              onPress={onClose}
              label={t('common.back')}
              bg="rgba(255,255,255,0.95)"
            />
            <View style={{ flexDirection: 'row' }}>
              {mine ? (
                <>
                  <RoundIcon
                    name="trash-outline"
                    onPress={askDelete}
                    label={t('myRecipes.delete')}
                    bg="rgba(255,255,255,0.95)"
                  />
                  <View style={{ width: 10 }} />
                  <RoundIcon
                    name="create-outline"
                    onPress={() => onEdit(id)}
                    label={t('myRecipes.edit')}
                    bg="rgba(255,255,255,0.95)"
                  />
                  <View style={{ width: 10 }} />
                </>
              ) : null}
              <RoundIcon
                name="share-outline"
                onPress={share}
                label={t('recipe.share')}
                bg="rgba(255,255,255,0.95)"
              />
              <View style={{ width: 10 }} />
              <RoundIcon
                name={fav ? 'heart' : 'heart-outline'}
                onPress={() => m.toggleFav(id)}
                label={t('recipe.favorite')}
                bg="rgba(255,255,255,0.95)"
                color={fav ? T.danger : T.ink}
              />
            </View>
          </View>
        </View>
        <View style={s.sheet}>
          <Text style={s.course}>{t(`course.${recipe.course}`)}</Text>
          <Text style={s.title}>{texts.recipeTitle(id)}</Text>
          <View style={s.metaRow}>
            <View style={s.meta}>
              <Ionicons name="time-outline" size={16} color={T.muted} />
              <Text style={s.metaTxt}>{t('recipe.minutes', { n: recipe.timeMin })}</Text>
            </View>
            {mine ? null : (
              <View style={s.meta}>
                <Dots n={recipe.difficulty} />
                <Text style={s.metaTxt}>{t(`recipe.difficulty.${recipe.difficulty}`)}</Text>
              </View>
            )}
            {times > 0 ? (
              <View style={s.meta}>
                <Ionicons name="checkmark-circle" size={16} color={T.brandDark} />
                <Text style={s.metaTxt}>{t('recipe.cookedTimes', { count: times })}</Text>
              </View>
            ) : null}
          </View>
          {warning ? (
            <View style={[s.warn, warning.found && s.warnFound]}>
              <Ionicons
                name={warning.found ? 'warning' : 'information-circle-outline'}
                size={20}
                color={warning.found ? T.danger : T.muted}
              />
              <Text style={s.warnTxt}>
                {warning.found
                  ? t('myRecipes.warnFound', { list: warningList(warning, t) })
                  : t('myRecipes.warnUnknown')}
              </Text>
            </View>
          ) : null}
          <View style={s.tags}>
            {shownTags.map((x) => (
              <View key={x} style={s.tag}>
                <Text style={s.tagTxt}>{t(`tags.${x}`)}</Text>
              </View>
            ))}
          </View>

          <View style={s.portion}>
            <View style={{ flex: 1 }}>
              <Text style={s.portionTitle}>{t('recipe.servings')}</Text>
              {cost && mine ? (
                cost.unpriced > 0 ? null : (
                  <Text style={s.portionHint}>
                    {t('recipe.costNote', {
                      total: formatEur(cost.total, lang),
                      per: formatEur(cost.perPerson, lang),
                    })}
                  </Text>
                )
              ) : null}
              {cost && !mine ? (
                <Text style={s.portionHint}>
                  {t('recipe.costNote', {
                    total: formatEur(cost.total, lang),
                    per: formatEur(cost.perPerson, lang),
                  })}
                </Text>
              ) : null}
            </View>
            <Stepper
              value={persons}
              min={1}
              max={24}
              onChange={setPersons}
              label={t('recipe.servings')}
            />
          </View>

          <Text style={s.h2}>{t('recipe.ingredients')}</Text>
          {lines.map((l, i) => {
            const ing = ingredients[l.key] || {};
            const on = !!have[l.key];
            return (
              <TouchableOpacity
                key={`${l.key}-${i}`}
                activeOpacity={0.8}
                onPress={() => setHave((h) => ({ ...h, [l.key]: !h[l.key] }))}
                style={s.ing}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <View style={[s.check, on && s.checkOn]}>
                  {on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
                <Text style={{ fontSize: 22, marginHorizontal: 10 }}>{ing.emoji || '🍽️'}</Text>
                <Text
                  style={[s.ingName, on && { opacity: 0.45, textDecorationLine: 'line-through' }]}
                  numberOfLines={2}
                >
                  {texts.ingredientName(l.key)}
                  {l.optional ? ` (${t('recipe.optional')})` : ''}
                </Text>
                <Text style={[s.ingQty, on && { opacity: 0.45 }]}>{qtyText(l)}</Text>
              </TouchableOpacity>
            );
          })}

          {pearlRows.length > 0 ? (
            <View style={s.pearl}>
              <Text style={s.pearlTitle}>{t('pearl.recipeTitle')}</Text>
              {pearlRows.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  activeOpacity={0.8}
                  onPress={() => openShopFromMenus(navigation, r.shop)}
                  style={s.pearlRow}
                  accessibilityRole="button"
                >
                  <Text style={s.pearlName} numberOfLines={1}>
                    {texts.ingredientName(r.key)}
                  </Text>
                  <Text style={s.pearlVal} numberOfLines={1}>
                    {t('pearl.line', { count: r.count, price: formatEur(r.min, lang) })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {nut ? (
          <View style={s.nutri}>
            <Text style={s.nutriTitle}>{t('recipe.nutrition')}</Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <View style={s.nutriBox}>
                <Text style={s.nutriVal}>{nut.kcal}</Text>
                <Text style={s.nutriLab}>kcal</Text>
              </View>
              <View style={s.nutriBox}>
                <Text style={s.nutriVal}>{nut.protein}</Text>
                <Text style={s.nutriLab}>{t('recipe.protein')}</Text>
              </View>
            </View>
            <Text style={s.nutriNote}>{t('recipe.nutritionNote')}</Text>
          </View>
          ) : null}

          <Text style={s.h2}>{t('recipe.steps')}</Text>
          {steps.map((st, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepNum}>
                <Text style={s.stepNumTxt}>{i + 1}</Text>
              </View>
              <Text style={s.stepTxt}>{st}</Text>
            </View>
          ))}

          <Text style={s.h2}>{t('recipe.note')}</Text>
          <Field
            value={note}
            onChangeText={setNoteTxt}
            onFocus={() => {
              noteFocused.current = true;
            }}
            onBlur={() => {
              noteFocused.current = false;
              m.setNote(id, note);
            }}
            placeholder={t('recipe.notePlaceholder')}
            multiline
            style={{ minHeight: 84, textAlignVertical: 'top' }}
          />
        </View>
      </ScrollView>
      <View style={s.bar}>
        {mine ? (
          <PrimaryButton
            soft
            icon="calendar-outline"
            label={t('myRecipes.addToPlan')}
            onPress={() => setPlanPick(true)}
            style={[{ marginBottom: compact ? 6 : 10 }, barBtn]}
          />
        ) : null}
        <PrimaryButton
          soft
          icon="cart"
          label={t('recipe.addToList')}
          loading={adding}
          onPress={addToMyList}
          style={[{ marginBottom: compact ? 6 : 10 }, barBtn]}
        />
        <PrimaryButton
          icon="play"
          label={t('recipe.cook')}
          onPress={() => onCook(id, persons)}
          style={barBtn}
        />
      </View>
      {planPick ? (
        <PlanPickSheet recipe={recipe} onClose={() => setPlanPick(false)} onDone={onClose} />
      ) : null}
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
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: T.subtle,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  warnFound: { backgroundColor: T.dangerSoft },
  warnTxt: { flex: 1, marginLeft: 8, fontSize: 14, lineHeight: 20, color: T.ink, fontWeight: '600' },
  topBtns: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheet: {
    marginTop: -28,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  course: {
    fontSize: 12,
    fontWeight: '800',
    color: T.brandDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: 28, fontWeight: '900', color: T.ink, lineHeight: 34, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  metaTxt: { fontSize: 14, color: T.muted, fontWeight: '700', marginLeft: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border, marginRight: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  tag: {
    backgroundColor: T.subtle,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  tagTxt: { fontSize: 12, fontWeight: '700', color: T.ink },
  portion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.brandSoft,
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
  },
  portionTitle: { fontSize: 16, fontWeight: '800', color: T.ink },
  portionHint: { fontSize: 12, color: T.muted, marginTop: 3, paddingRight: 8, lineHeight: 17 },
  pearl: { marginTop: 18 },
  pearlTitle: { fontSize: 14, fontWeight: '800', color: T.muted, marginBottom: 4 },
  pearlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  pearlName: { flex: 1, fontSize: 14, color: T.ink, marginRight: 8 },
  pearlVal: { fontSize: 13, fontWeight: '700', color: T.brandDark },
  h2: { fontSize: 22, fontWeight: '900', color: T.ink, marginTop: 28, marginBottom: 10 },
  ing: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
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
  ingName: { flex: 1, fontSize: 16, fontWeight: '700', color: T.ink },
  ingQty: { fontSize: 15, fontWeight: '800', color: T.ink, marginLeft: 8 },
  nutri: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    padding: 16,
    marginTop: 24,
    ...T.shadowSm,
  },
  nutriTitle: { fontSize: 16, fontWeight: '800', color: T.ink },
  nutriBox: {
    flex: 1,
    backgroundColor: T.subtle,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  nutriVal: { fontSize: 22, fontWeight: '900', color: T.ink },
  nutriLab: { fontSize: 12, color: T.muted, fontWeight: '700', marginTop: 2 },
  nutriNote: { fontSize: 12, color: T.faint, marginTop: 10, lineHeight: 17 },
  step: { flexDirection: 'row', marginBottom: 16 },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  stepNumTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
  stepTxt: { flex: 1, fontSize: 16, color: T.ink, lineHeight: 24 },
  bar: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: '#fff',
  },
});
