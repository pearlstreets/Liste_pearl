// Semaine d'un proche, en lecture seule : on peut en reprendre un repas, jamais la modifier.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from './theme';
import { Empty, GhostButton, SectionTitle } from './ui';
import RecipeVisual from './RecipeVisual';
import { PlanPickSheet } from './Sheets';
import { useMenus } from './MenusContext';
import useT from './useT';
import { weekLabel } from './WeekScreen';

function titleOf(meal, known, texts, t) {
  if (meal.free) return t('week.free');
  if (known) return texts.recipeTitle(known.id);
  if (meal.recipeId) return t('shared.unknown');
  return meal.title || t('shared.personal');
}

function Meal({ meal, onAddWeek }) {
  const t = useT();
  const { recipeById, texts, ingredients, sendRecipeToList, persons } = useMenus();
  const known = meal.recipeId ? recipeById.get(meal.recipeId) : null;
  const [note, setNote] = useState('');
  const visual =
    known || (meal.photo ? { id: meal.key, custom: true, photoUrl: meal.photo } : null);

  const addShop = useCallback(async () => {
    const n = meal.persons || persons(meal.day, meal.slot);
    const r = await sendRecipeToList(known.id, n);
    const st = r && r.status;
    setNote(
      st === 'ok'
        ? t('shared.addedShop')
        : st === 'already'
          ? t('added.already')
          : t('added.err.error')
    );
  }, [known, meal, persons, sendRecipeToList, t]);

  return (
    <View style={s.meal}>
      <View style={s.row}>
        {visual ? (
          <View style={s.thumb}>
            <RecipeVisual recipe={visual} ingredients={ingredients} height={52} radius={12} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={s.when}>
            {t(`days.long.${meal.day}`)} · {t(`slot.${meal.slot}`)}
          </Text>
          <Text style={s.name} numberOfLines={2}>
            {titleOf(meal, known, texts, t)}
          </Text>
          {meal.persons ? (
            <Text style={s.when}>{t('week.persons', { count: meal.persons })}</Text>
          ) : null}
        </View>
      </View>
      {known ? (
        <View style={s.actions}>
          <GhostButton icon="cart-outline" label={t('shared.addShop')} onPress={addShop} />
          <GhostButton
            icon="calendar-outline"
            label={t('shared.addWeek')}
            onPress={() => onAddWeek(known, setNote)}
          />
        </View>
      ) : null}
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}

export default function SharedWeekScreen({ weeks, onClose }) {
  const t = useT();
  const { lang } = useMenus();
  const [pick, setPick] = useState(null);
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.head}>
        <TouchableOpacity
          onPress={onClose}
          style={s.close}
          accessibilityLabel={t('common.back')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={T.ink} />
        </TouchableOpacity>
        <Text style={s.title}>{t('shared.title')}</Text>
        <View style={s.close} />
      </View>
      {weeks.length === 0 ? (
        <Empty emoji="🗓️" title={t('shared.emptyTitle')} text={t('shared.emptyText')} />
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {weeks.map((w) => (
            <View key={`${w.name}:${w.weekStart}`}>
              <SectionTitle
                title={t('shared.weekOf', { name: w.name })}
                hint={weekLabel(w.weekStart, lang, t)}
              />
              {w.meals.map((x) => (
                <Meal
                  key={x.key}
                  meal={x}
                  onAddWeek={(recipe, done) => setPick({ recipe, done })}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
      {pick ? (
        <PlanPickSheet
          recipe={pick.recipe}
          onClose={() => setPick(null)}
          onDone={() => pick.done(t('shared.addedWeek'))}
        />
      ) : null}
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
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: T.ink },
  body: { paddingHorizontal: 20, paddingBottom: 60 },
  meal: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.borderInput },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 52, marginRight: 12, borderRadius: 12, overflow: 'hidden' },
  when: { fontSize: 13, color: T.muted },
  name: { fontSize: 16, fontWeight: '700', color: T.ink, marginVertical: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  note: { fontSize: 13, color: T.brandDark, fontWeight: '700', marginTop: 2 },
});
