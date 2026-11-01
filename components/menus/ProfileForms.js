// Blocs de réglages partagés entre la présentation (3 écrans) et l'écran Réglages.
import React, { memo, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { norm, ALLERGEN_CHOICES } from '../../lib/menus';
import { T } from './theme';
import { Chip, Stepper, Field } from './ui';
import useT from './useT';

export const DIETS = [
  'vegetarien',
  'vegan',
  'sans-gluten',
  'sans-lactose',
  'sans-porc',
  'halal-possible',
  'sans-fruits-a-coque',
];
// Allergies proposées : les 14 allergènes de l'Union européenne et le miel (lib/menus/allergens.js).
export const ALLERGENS = ALLERGEN_CHOICES;
export const TIMES = [null, 20, 30, 45, 60];

const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
const RowLabel = ({ title, hint }) => (
  <View style={{ flex: 1, paddingRight: 12 }}>
    <Text style={s.rowTitle}>{title}</Text>
    {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
  </View>
);

export const HouseholdSection = memo(function HouseholdSection({ profile, onChange }) {
  const t = useT();
  const hasBudget = profile.budget != null;
  return (
    <View>
      <Card>
        <View style={s.row}>
          <RowLabel title={t('profile.adults')} hint={t('profile.adultsHint')} />
          <Stepper
            value={profile.adults}
            min={1}
            max={12}
            onChange={(v) => onChange({ adults: v })}
            label={t('profile.adults')}
          />
        </View>
        <View style={s.sep} />
        <View style={s.row}>
          <RowLabel title={t('profile.children')} hint={t('profile.childrenHint')} />
          <Stepper
            value={profile.children}
            min={0}
            max={12}
            onChange={(v) => onChange({ children: v })}
            label={t('profile.children')}
          />
        </View>
      </Card>
      <Card style={{ marginTop: 14 }}>
        <View style={s.row}>
          <RowLabel
            title={t('profile.budget')}
            hint={hasBudget ? t('profile.budgetHint') : t('profile.noBudget')}
          />
          <Switch
            value={hasBudget}
            onValueChange={(on) => onChange({ budget: on ? 80 : null })}
            trackColor={{ true: T.brand, false: '#CBD5E1' }}
            thumbColor="#fff"
          />
        </View>
        {hasBudget ? (
          <View style={[s.row, { marginTop: 14, justifyContent: 'center' }]}>
            <Stepper
              value={profile.budget}
              min={20}
              max={500}
              step={5}
              format={(v) => `${v} €`}
              onChange={(v) => onChange({ budget: v })}
              label={t('profile.budget')}
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
});

export const MealsSection = memo(function MealsSection({ profile, onChange }) {
  const t = useT();
  const setSlots = (fn) => {
    const slots = {};
    for (let d = 0; d < 7; d++)
      for (const sl of ['midi', 'soir']) slots[`${d}-${sl}`] = !!fn(d, sl);
    onChange({ slots });
  };
  const toggle = (k) => onChange({ slots: { ...profile.slots, [k]: !profile.slots[k] } });
  const all = Object.values(profile.slots).every(Boolean);
  const soirOnly = Object.entries(profile.slots).every(([k, v]) => (k.endsWith('soir') ? v : !v));
  const weekdays = Object.entries(profile.slots).every(([k, v]) => (Number(k[0]) <= 4 ? v : !v));
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label={t('meals.all')} on={all} onPress={() => setSlots(() => true)} />
        <Chip
          label={t('meals.soirOnly')}
          on={soirOnly}
          onPress={() => setSlots((d, sl) => sl === 'soir')}
        />
        <Chip label={t('meals.weekdays')} on={weekdays} onPress={() => setSlots((d) => d <= 4)} />
      </View>
      <Card>
        <View style={s.gridRow}>
          <View style={s.gridHead} />
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <Text
              key={d}
              style={s.gridDay}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {t(`days.short.${d}`)}
            </Text>
          ))}
        </View>
        {['midi', 'soir'].map((sl) => (
          <View key={sl} style={s.gridRow}>
            <View style={s.gridHead}>
              <Text style={s.gridHeadTxt} numberOfLines={1}>
                {t(`slot.${sl}`)}
              </Text>
            </View>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const on = !!profile.slots[`${d}-${sl}`];
              return (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.8}
                  onPress={() => toggle(`${d}-${sl}`)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${t(`days.long.${d}`)} ${t(`slot.${sl}`)}`}
                  style={s.gridCellWrap}
                >
                  <View style={[s.gridCell, on ? s.gridOn : s.gridOff]}>
                    {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </Card>
      <Card style={{ marginTop: 14 }}>
        {profile.children > 0 ? (
          <>
            <View style={s.row}>
              <RowLabel title={t('meals.cantine')} hint={t('meals.cantineHint')} />
              <Switch
                value={profile.kidsCantine}
                onValueChange={(v) => onChange({ kidsCantine: v })}
                trackColor={{ true: T.brand, false: '#CBD5E1' }}
                thumbColor="#fff"
              />
            </View>
            <View style={s.sep} />
          </>
        ) : null}
        <View style={s.row}>
          <RowLabel title={t('meals.leftovers')} hint={t('meals.leftoversHint')} />
          <Switch
            value={profile.useLeftovers}
            onValueChange={(v) => onChange({ useLeftovers: v })}
            trackColor={{ true: T.brand, false: '#CBD5E1' }}
            thumbColor="#fff"
          />
        </View>
      </Card>
    </View>
  );
});

export const DietSection = memo(function DietSection({
  profile,
  onChange,
  texts,
  ingredients,
  compact,
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const toggleIn = (field, v) => {
    const cur = profile[field];
    onChange({ [field]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const found = useMemo(() => {
    const n = norm(q);
    if (n.length < 2) return [];
    const out = [];
    for (const key of Object.keys(ingredients || {})) {
      if (profile.excludedIngredients.includes(key)) continue;
      const name = texts.ingredientName(key);
      if (norm(name).includes(n)) out.push({ key, name, emoji: ingredients[key].emoji });
      if (out.length >= 8) break;
    }
    return out;
  }, [q, ingredients, texts, profile.excludedIngredients]);
  const ingExcluded = profile.excludedIngredients.filter((k) => !ALLERGENS.includes(k));
  return (
    <View>
      <Text style={s.label}>{t('diet.diets')}</Text>
      <View style={s.wrap}>
        {DIETS.map((d) => (
          <Chip
            key={d}
            label={t(`tags.${d}`)}
            on={profile.diets.includes(d)}
            onPress={() => toggleIn('diets', d)}
          />
        ))}
      </View>
      <Text style={s.label}>{t('diet.allergies')}</Text>
      <View style={s.wrap}>
        {ALLERGENS.map((a) => (
          <Chip
            key={a}
            label={t(`allergens.${a}`)}
            on={profile.excludedIngredients.includes(a)}
            onPress={() => toggleIn('excludedIngredients', a)}
          />
        ))}
      </View>
      {!compact ? (
        <>
          <Text style={s.label}>{t('diet.dislikes')}</Text>
          <Field
            value={q}
            onChangeText={setQ}
            placeholder={t('diet.dislikesPlaceholder')}
            autoCorrect={false}
            returnKeyType="search"
          />
          {found.length ? (
            <View style={[s.wrap, { marginTop: 10 }]}>
              {found.map((f) => (
                <Chip
                  key={f.key}
                  emoji={f.emoji}
                  label={f.name}
                  on={false}
                  onPress={() => {
                    toggleIn('excludedIngredients', f.key);
                    setQ('');
                  }}
                />
              ))}
            </View>
          ) : null}
          {ingExcluded.length ? (
            <View style={[s.wrap, { marginTop: 10 }]}>
              {ingExcluded.map((k) => (
                <Chip
                  key={k}
                  emoji={ingredients[k] && ingredients[k].emoji}
                  icon="close"
                  label={texts.ingredientName(k)}
                  on
                  onPress={() => toggleIn('excludedIngredients', k)}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <Text style={s.label}>{t('diet.maxTime')}</Text>
      <View style={s.wrap}>
        {TIMES.map((m) => (
          <Chip
            key={String(m)}
            label={m ? t('diet.upTo', { n: m }) : t('diet.noLimit')}
            on={profile.maxTimeMin === m}
            onPress={() => onChange({ maxTimeMin: m })}
          />
        ))}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadowSm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: T.ink },
  rowHint: { fontSize: 13, color: T.muted, marginTop: 2, lineHeight: 18 },
  sep: { height: 1, backgroundColor: T.border, marginVertical: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 18, marginBottom: 10 },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  gridHead: { width: 54, paddingRight: 4 },
  gridHeadTxt: { fontSize: 12, fontWeight: '700', color: T.muted },
  gridDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800', color: T.muted },
  gridCellWrap: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  gridCell: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  gridOn: { backgroundColor: T.brand, borderColor: T.brand },
  gridOff: { backgroundColor: '#fff', borderColor: T.borderInput },
});
