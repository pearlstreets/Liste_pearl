// Carte d'un repas de la semaine : visuel, badges, infos, et les gestes (changer, verrouiller, libre).
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from './theme';
import RecipeVisual from './RecipeVisual';
import useT from './useT';

const Badge = ({ icon, label, tone }) => (
  <View
    style={[
      s.badge,
      tone === 'accent' && { backgroundColor: T.accentSoft },
      tone === 'info' && { backgroundColor: T.infoSoft },
    ]}
  >
    {icon ? (
      <Ionicons
        name={icon}
        size={12}
        color={tone === 'accent' ? '#B45309' : tone === 'info' ? '#1D4ED8' : T.ink}
        style={{ marginRight: 4 }}
      />
    ) : null}
    <Text
      style={[
        s.badgeTxt,
        tone === 'accent' && { color: '#B45309' },
        tone === 'info' && { color: '#1D4ED8' },
      ]}
    >
      {label}
    </Text>
  </View>
);

const Action = ({ icon, label, onPress, active }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    accessibilityRole="button"
    style={[s.action, active && { backgroundColor: T.brandSoft }]}
  >
    <Ionicons name={icon} size={17} color={active ? T.brandDark : T.ink} />
    <Text
      style={[s.actionTxt, active && { color: T.brandDark }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

function MealCard({
  meal,
  recipe,
  title,
  ingredients,
  priceText,
  onOpen,
  onChange,
  onLock,
  onFree,
  nearby,
  onOpenShop,
}) {
  const t = useT();
  const slotLabel = t(`slot.${meal.slot}`);

  if (meal.free) {
    return (
      <View style={[s.card, s.free]}>
        <View style={s.freeRow}>
          <View style={s.freeIcon}>
            <Ionicons name="restaurant" size={24} color={T.brandDark} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.slot}>{slotLabel}</Text>
            <Text style={s.freeTitle}>{t('week.freeTitle')}</Text>
            <Text style={s.freeText}>{t('week.freeText')}</Text>
          </View>
        </View>
        {Array.isArray(nearby) && nearby.length > 0 ? (
          <View style={s.nearby}>
            <Text style={s.nearbyTitle}>{t('pearl.freeCta')}</Text>
            {nearby.map((sh) => (
              <TouchableOpacity
                key={String(sh.id)}
                activeOpacity={0.8}
                onPress={() => onOpenShop && onOpenShop(sh)}
                style={s.nearbyRow}
                accessibilityRole="button"
                accessibilityLabel={sh.name}
              >
                <Text style={s.nearbyName} numberOfLines={1}>
                  {sh.name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={T.muted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={s.actions}>
          <Action icon="book-outline" label={t('week.takeRecipe')} onPress={() => onFree(false)} />
        </View>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={[s.card, s.free, { paddingVertical: 18 }]}>
        <Text style={s.slot}>{slotLabel}</Text>
        <Text style={s.freeText}>{t('week.noMeal')}</Text>
        <View style={s.actions}>
          <Action icon="shuffle" label={t('week.change')} onPress={onChange} />
          <Action icon="restaurant-outline" label={t('week.free')} onPress={() => onFree(true)} />
        </View>
      </View>
    );
  }

  const left = !!meal.leftoverOf;
  return (
    <View style={s.card}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <RecipeVisual recipe={recipe} ingredients={ingredients} height={132} radius={22} />
        <View style={s.badges}>
          {left ? <Badge icon="repeat" label={t('week.leftover')} tone="info" /> : null}
          {meal.cookPersons > meal.persons + 0.01 && !meal.leftoverOf && !meal.free ? (
            <Badge icon="people" label={t('week.cookDouble')} tone="accent" />
          ) : null}
          {meal.locked ? <Badge icon="lock-closed" label={t('week.locked')} /> : null}
        </View>
        <View style={s.body}>
          <Text style={s.slot}>
            {slotLabel} · {t('week.persons', { count: Math.round(meal.persons * 10) / 10 })}
          </Text>
          <Text style={s.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={s.metaRow}>
            <View style={s.meta}>
              <Ionicons name="time-outline" size={14} color={T.muted} />
              <Text style={s.metaTxt}>{t('recipe.minutes', { n: recipe.timeMin })}</Text>
            </View>
            <View style={s.meta}>
              <Ionicons name="pricetag-outline" size={14} color={T.muted} />
              <Text style={s.metaTxt}>{left ? t('week.alreadyCooked') : priceText}</Text>
            </View>
            <View style={s.meta}>
              <Ionicons name="flame-outline" size={14} color={T.muted} />
              <Text style={s.metaTxt}>{recipe.kcal} kcal</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      <View style={s.actions}>
        <Action icon="shuffle" label={t('week.change')} onPress={onChange} />
        <Action
          icon={meal.locked ? 'lock-closed' : 'lock-open-outline'}
          label={meal.locked ? t('week.unlock') : t('week.lock')}
          active={meal.locked}
          onPress={onLock}
        />
        <Action icon="restaurant-outline" label={t('week.free')} onPress={() => onFree(true)} />
      </View>
    </View>
  );
}

export default memo(MealCard);

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadow,
  },
  free: { padding: 16, backgroundColor: '#FAFFFD', borderStyle: 'dashed', borderColor: T.brand },
  freeRow: { flexDirection: 'row', alignItems: 'center' },
  freeIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: T.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeTitle: { fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 2 },
  freeText: { fontSize: 13, color: T.muted, marginTop: 2, lineHeight: 18 },
  badges: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 4,
  },
  badgeTxt: { fontSize: 12, fontWeight: '800', color: T.ink },
  body: { padding: 16, paddingBottom: 12 },
  slot: {
    fontSize: 12,
    fontWeight: '800',
    color: T.brandDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 19, fontWeight: '800', color: T.ink, marginTop: 4, lineHeight: 25 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 2 },
  metaTxt: { fontSize: 13, color: T.muted, fontWeight: '600', marginLeft: 4 },
  nearby: { paddingHorizontal: 12, paddingTop: 10 },
  nearbyTitle: { fontSize: 13, fontWeight: '800', color: T.ink, marginBottom: 4 },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 5,
  },
  nearbyName: { flex: 1, fontSize: 14, fontWeight: '700', color: T.ink },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.subtle,
    borderRadius: 14,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  actionTxt: { fontSize: 12.5, fontWeight: '800', color: T.ink, marginLeft: 6, flexShrink: 1 },
});
