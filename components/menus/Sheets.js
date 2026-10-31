// Feuilles du bas : changer un plat (3 idées) et confirmation d'ajout à la liste.
import React, { memo, useEffect, useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatEur } from '../../lib/menus';
import { T } from './theme';
import { PrimaryButton, GhostButton, Empty } from './ui';
import RecipeVisual from './RecipeVisual';
import { useMenus } from './MenusContext';
import useT from './useT';

function Sheet({ onClose, children, label }) {
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

/** Changer un plat : 3 idées au choix, ou une surprise. */
export const SwapSheet = memo(function SwapSheet({ mealKey, onClose }) {
  const t = useT();
  const { suggest, swap, texts, ingredients, lang, costOf, plan } = useMenus();
  const [ideas, setIdeas] = useState([]);
  const meal = plan && plan.meals.find((m) => m.key === mealKey);
  useEffect(() => {
    setIdeas(suggest(3));
  }, [mealKey, suggest]);
  const persons = (meal && meal.persons) || 2;
  const pick = async (id) => {
    onClose();
    await swap(mealKey, id);
  };
  return (
    <Sheet onClose={onClose} label={t('common.close')}>
      <Text style={s.title}>{t('swap.title')}</Text>
      <Text style={s.sub}>{t('swap.sub')}</Text>
      <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
        {ideas.length === 0 ? (
          <Empty emoji="🤔" title={t('swap.noneTitle')} text={t('swap.noneText')} />
        ) : (
          ideas.map((r) => {
            const c = costOf(r, persons);
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
                    {t('recipe.minutes', { n: r.timeMin })} ·{' '}
                    {t('week.perPerson', { price: formatEur(c.perPerson, lang) })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={T.faint} />
              </TouchableOpacity>
            );
          })
        )}
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

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 10,
    ...T.shadow,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.border,
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '900', color: T.ink },
  sub: { fontSize: 14, color: T.muted, marginTop: 4, marginBottom: 12, lineHeight: 20 },
  idea: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  ideaTitle: { fontSize: 16, fontWeight: '800', color: T.ink },
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
});
