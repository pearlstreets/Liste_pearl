// Blocs de réglages partagés entre la présentation (3 écrans) et l'écran Réglages.
import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { norm, ALLERGEN_CHOICES } from '../../lib/menus';
import {
  cleanMembers,
  isChildMember,
  memberNeeds,
  ACTIVITIES,
  GOALS,
  ADULT_AGE,
  MEMBERS_MAX,
} from '../../lib/menus/needs';
import { cleanPrefs, QUICK_CHOICES, TREAT_CHOICES } from '../../lib/menus/profile';
import { CUISINES } from '../../lib/menus/healthy';
import { T } from './theme';
import { Chip, Stepper, Field, GhostButton } from './ui';
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

// Champ numérique : le texte tapé reste affiché, seule une valeur dans les bornes (ou vide) est enregistrée.
const parseNum = (txt, min, max) => {
  const brut = String(txt).replace(',', '.').trim();
  if (brut === '') return null;
  const v = Number(brut);
  return Number.isFinite(v) && v >= min && v <= max ? v : undefined;
};
const NumField = ({ value, onCommit, min, max, decimals }) => {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setTxt((cur) => (parseNum(cur, min, max) === value ? cur : value == null ? '' : String(value)));
  }, [value, min, max]);
  return (
    <Field
      value={txt}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      maxLength={5}
      style={s.numField}
      onChangeText={(v) => {
        setTxt(v);
        const n = parseNum(v, min, max);
        if (n !== undefined && n !== value) onCommit(n);
      }}
      onEndEditing={() => {
        if (parseNum(txt, min, max) === undefined) setTxt(value == null ? '' : String(value));
      }}
    />
  );
};

const nouvelId = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const vide = (child) => ({ id: nouvelId(), name: '', child: !!child });

// Une personne : un encadré, une phrase, les champs dessous, ses besoins estimés en une ligne.
const MemberCard = ({ m, index, onPatch, onRemove }) => {
  const t = useT();
  const n = memberNeeds(m);
  const mineur = m.age !== null ? m.age < ADULT_AGE : m.child;
  return (
    <Card style={{ marginTop: 14 }}>
      <Text style={s.rowTitle}>{m.name.trim() || t('nutri.person', { n: index + 1 })}</Text>
      <Text style={s.rowHint}>{t('nutri.personHint')}</Text>
      <Text style={s.fieldLabel}>{t('nutri.name')}</Text>
      <Field
        value={m.name}
        onChangeText={(v) => onPatch({ name: v })}
        placeholder={t('nutri.name')}
        maxLength={40}
      />
      <View style={s.numRow}>
        <View style={s.numCol}>
          <Text style={s.fieldLabel}>{t('nutri.age')}</Text>
          <NumField value={m.age} min={0} max={110} onCommit={(v) => onPatch({ age: v })} />
        </View>
        <View style={s.numCol}>
          <Text style={s.fieldLabel}>{t('nutri.height')}</Text>
          <NumField
            value={m.heightCm}
            min={45}
            max={230}
            onCommit={(v) => onPatch({ heightCm: v })}
          />
        </View>
        <View style={s.numCol}>
          <Text style={s.fieldLabel}>{t('nutri.weight')}</Text>
          <NumField
            value={m.weightKg}
            min={2}
            max={300}
            decimals
            onCommit={(v) => onPatch({ weightKg: v })}
          />
        </View>
      </View>
      <Text style={s.fieldLabel}>{t('nutri.sex')}</Text>
      <View style={s.wrap}>
        {['f', 'm'].map((x) => (
          <Chip
            key={x}
            label={t(x === 'f' ? 'nutri.female' : 'nutri.male')}
            on={m.sex === x}
            onPress={() => onPatch({ sex: m.sex === x ? null : x })}
          />
        ))}
      </View>
      <Text style={s.fieldLabel}>{t('nutri.activity')}</Text>
      <View style={s.wrap}>
        {ACTIVITIES.map((a) => (
          <Chip
            key={a}
            label={t(`nutri.act_${a}`)}
            on={m.activity === a}
            onPress={() => onPatch({ activity: m.activity === a ? null : a })}
          />
        ))}
      </View>
      {m.activity ? <Text style={s.rowHint}>{t(`nutri.actHint_${m.activity}`)}</Text> : null}
      <Text style={s.fieldLabel}>{t('nutri.goal')}</Text>
      {mineur ? (
        <Text style={s.rowHint}>{t('nutri.goalMinor')}</Text>
      ) : (
        <View style={s.wrap}>
          {GOALS.map((g) => (
            <Chip
              key={g}
              label={t(`nutri.goal_${g}`)}
              on={m.goal === g}
              onPress={() => onPatch({ goal: m.goal === g ? null : g })}
            />
          ))}
        </View>
      )}
      <View style={s.sep} />
      <Text style={s.needs}>{t('nutri.needs', { kcal: n.kcal, protein: n.protein })}</Text>
      <View style={{ alignItems: 'flex-start', marginTop: 6 }}>
        <GhostButton label={t('nutri.remove')} icon="trash-outline" danger onPress={onRemove} />
      </View>
    </Card>
  );
};

/** Personnes renseignées : celles du calcul, ou celles gardées de côté en mode simple (profile.dormant). */
export const keptMembers = (profile) => {
  const p = profile || {};
  const l = cleanMembers(p.members);
  return l.length ? l : cleanMembers(p.dormant);
};

/** Une personne par adulte et par enfant déjà déclarés, sans aucune information (départ du mode personnalisé). */
export const starterMembers = (profile) => {
  const adults = Math.max(0, Math.round(Number(profile && profile.adults) || 0));
  const children = Math.max(0, Math.round(Number(profile && profile.children) || 0));
  const list = [];
  for (let i = 0; i < Math.max(1, adults); i++) list.push(vide(false));
  for (let i = 0; i < children; i++) list.push(vide(true));
  return list.slice(0, MEMBERS_MAX);
};

/** Passe du mode simple au mode personnalisé (et inversement) : rien n'est perdu, les personnes sont gardées. */
export const changeMode = (profile, onChange, mode) => {
  if (mode === 'perso' && !keptMembers(profile).length) {
    const list = starterMembers(profile);
    const children = list.filter(isChildMember).length;
    return onChange({ mode, members: list, adults: list.length - children, children });
  }
  return onChange({ mode });
};

// Personnes détaillées (facultatif). Sans elles, adultes et enfants restent comme avant.
export const MembersSection = ({ profile, members, onChange }) => {
  const t = useT();
  // Adultes et enfants suivent les personnes (comme normalizeProfile) ; tout effacer les garde tels quels.
  const set = (list) => {
    if (!list.length) return onChange({ members: [] });
    const children = cleanMembers(list).filter(isChildMember).length;
    return onChange({ members: list, adults: list.length - children, children });
  };
  if (!members.length) {
    const depart = () => set(starterMembers(profile));
    return (
      <Card style={{ marginTop: 14 }}>
        <View style={s.row}>
          <RowLabel title={t('nutri.title')} hint={t('nutri.intro')} />
        </View>
        <View style={[s.wrap, { marginTop: 12 }]}>
          <Chip label={t('nutri.start')} icon="person-add-outline" on={false} onPress={depart} />
        </View>
      </Card>
    );
  }
  return (
    <View>
      <Text style={[s.label, { marginTop: 0 }]}>{t('nutri.title')}</Text>
      <Text style={s.rowHint}>{t('nutri.intro')}</Text>
      {members.map((m, i) => (
        <MemberCard
          key={m.id}
          m={m}
          index={i}
          onPatch={(patch) => set(members.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))}
          onRemove={() => set(members.filter((x) => x.id !== m.id))}
        />
      ))}
      {members.length < MEMBERS_MAX ? (
        <View style={[s.wrap, { marginTop: 14 }]}>
          <Chip
            label={t('nutri.addAdult')}
            icon="add"
            on={false}
            onPress={() => set([...members, vide(false)])}
          />
          <Chip
            label={t('nutri.addChild')}
            icon="add"
            on={false}
            onPress={() => set([...members, vide(true)])}
          />
        </View>
      ) : null}
      <Text style={[s.rowHint, { marginTop: 10 }]}>{t('nutri.disclaimer')}</Text>
      <View style={{ alignItems: 'flex-start', marginTop: 6 }}>
        <GhostButton
          label={t('nutri.clear')}
          icon="close-circle-outline"
          danger
          onPress={() => set([])}
        />
      </View>
    </View>
  );
};

// Choix du mode du foyer : « Simple » (adultes et enfants) ou « Personnalisé » (une fiche par personne).
export const HouseholdModeChips = memo(function HouseholdModeChips({ profile, onChange }) {
  const t = useT();
  const mode = profile.mode === 'simple' ? 'simple' : 'perso';
  return (
    <View>
      <View style={s.wrap}>
        <Chip
          label={t('questionnaire.modeSimple')}
          on={mode === 'simple'}
          onPress={() => mode !== 'simple' && changeMode(profile, onChange, 'simple')}
        />
        <Chip
          label={t('questionnaire.modePerso')}
          on={mode === 'perso'}
          onPress={() => mode !== 'perso' && changeMode(profile, onChange, 'perso')}
        />
      </View>
      <Text style={s.rowHint}>
        {t(mode === 'simple' ? 'questionnaire.modeSimpleHint' : 'questionnaire.modePersoHint')}
      </Text>
    </View>
  );
});

// Budget : un encadré, un interrupteur, le montant dessous.
export const BudgetCard = memo(function BudgetCard({ profile, onChange, style }) {
  const t = useT();
  const hasBudget = profile.budget != null;
  return (
    <Card style={style}>
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
  );
});

// Nombre d'adultes et d'enfants (mode simple, ou foyer sans personnes détaillées).
export const HouseholdCounts = memo(function HouseholdCounts({ profile, onChange }) {
  const t = useT();
  return (
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
  );
});

export const HouseholdSection = memo(function HouseholdSection({ profile, onChange }) {
  const t = useT();
  const members = useMemo(() => keptMembers(profile), [profile.members, profile.dormant]);
  const simple = profile.mode === 'simple';
  return (
    <View>
      {members.length ? (
        <View style={{ marginBottom: 14 }}>
          <HouseholdModeChips profile={profile} onChange={onChange} />
        </View>
      ) : null}
      {simple || !members.length ? <HouseholdCounts profile={profile} onChange={onChange} /> : null}
      {simple && members.length ? (
        <Text style={[s.rowHint, { marginTop: 10 }]}>{t('questionnaire.keptHint')}</Text>
      ) : null}
      {simple ? null : <MembersSection profile={profile} members={members} onChange={onChange} />}
      <BudgetCard profile={profile} onChange={onChange} style={{ marginTop: 14 }} />
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

// Préférences des menus (toutes facultatives, éteintes par défaut) : profile.prefs, rangé avec les personnes.
// Elles servent à la prochaine semaine composée ; la semaine en cours ne change pas.
const usePrefs = (profile, onChange) => {
  const pf = cleanPrefs(profile && profile.prefs);
  const set = (patch) => onChange({ prefs: { ...pf, ...patch } });
  return [pf, set];
};

// Semaine équilibrée et accompagnement de légumes : deux interrupteurs dans un encadré.
export const PrefsSwitches = memo(function PrefsSwitches({ profile, onChange }) {
  const t = useT();
  const [pf, set] = usePrefs(profile, onChange);
  return (
    <Card>
        <View style={s.row}>
          <RowLabel title={t('prefs.balanced')} hint={t('prefs.balancedHint')} />
          <Switch
            value={pf.balanced}
            onValueChange={(v) => set({ balanced: v })}
            trackColor={{ true: T.brand, false: '#CBD5E1' }}
            thumbColor="#fff"
          />
        </View>
        <View style={s.sep} />
        <View style={s.row}>
          <RowLabel title={t('prefs.sides')} hint={t('prefs.sidesHint')} />
          <Switch
            value={pf.sides}
            onValueChange={(v) => set({ sides: v })}
            trackColor={{ true: T.brand, false: '#CBD5E1' }}
            thumbColor="#fff"
          />
        </View>
    </Card>
  );
});

// Repas rapides en semaine : Non, 20 ou 30 minutes.
export const QuickPicker = memo(function QuickPicker({ profile, onChange }) {
  const t = useT();
  const [pf, set] = usePrefs(profile, onChange);
  return (
    <View>
      <Text style={s.label}>{t('prefs.quick')}</Text>
      <View style={s.wrap}>
        {QUICK_CHOICES.map((m) => (
          <Chip
            key={String(m)}
            label={m ? t('diet.upTo', { n: m }) : t('prefs.no')}
            on={pf.quick === m}
            onPress={() => set({ quick: m })}
          />
        ))}
      </View>
    </View>
  );
});

// Repas plaisir par semaine : Libre, 0, 1, 2, 3.
export const TreatsPicker = memo(function TreatsPicker({ profile, onChange }) {
  const t = useT();
  const [pf, set] = usePrefs(profile, onChange);
  return (
    <View>
      <Text style={s.label}>{t('prefs.treats')}</Text>
      <Text style={[s.rowHint, { marginTop: -6, marginBottom: 10 }]}>{t('prefs.treatsHint')}</Text>
      <View style={s.wrap}>
        {[null, ...TREAT_CHOICES].map((n) => (
          <Chip
            key={String(n)}
            label={n === null ? t('prefs.treatsFree') : n === 0 ? t('prefs.treatsNone') : String(n)}
            on={pf.treats === n}
            onPress={() => set({ treats: n })}
          />
        ))}
      </View>
    </View>
  );
});

// Cuisines préférées.
export const CuisinesPicker = memo(function CuisinesPicker({ profile, onChange }) {
  const t = useT();
  const [pf, set] = usePrefs(profile, onChange);
  const toggleCuisine = (c) =>
    set({
      cuisines: pf.cuisines.includes(c) ? pf.cuisines.filter((x) => x !== c) : [...pf.cuisines, c],
    });
  return (
    <View>
      <Text style={s.label}>{t('prefs.cuisines')}</Text>
      <Text style={[s.rowHint, { marginTop: -6, marginBottom: 10 }]}>{t('prefs.cuisinesHint')}</Text>
      <View style={s.wrap}>
        {CUISINES.map((c) => (
          <Chip
            key={c}
            label={t(`discover.cuisines.${c}`)}
            on={pf.cuisines.includes(c)}
            onPress={() => toggleCuisine(c)}
          />
        ))}
      </View>
    </View>
  );
});

export const PrefsSection = memo(function PrefsSection({ profile, onChange }) {
  return (
    <View>
      <PrefsSwitches profile={profile} onChange={onChange} />
      <QuickPicker profile={profile} onChange={onChange} />
      <TreatsPicker profile={profile} onChange={onChange} />
      <CuisinesPicker profile={profile} onChange={onChange} />
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadowSm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: T.ink },
  rowHint: { fontSize: 13, color: T.muted, marginTop: 2, lineHeight: 18 },
  sep: { height: 1, backgroundColor: T.border, marginVertical: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { fontSize: 15, fontWeight: '600', color: T.ink, marginTop: 18, marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: T.muted, marginTop: 12, marginBottom: 6 },
  numRow: { flexDirection: 'row', marginHorizontal: -4 },
  numCol: { flex: 1, paddingHorizontal: 4 },
  numField: { textAlign: 'center' },
  needs: { fontSize: 15, fontWeight: '600', color: T.ink },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  gridHead: { width: 54, paddingRight: 4 },
  gridHeadTxt: { fontSize: 12, fontWeight: '700', color: T.muted },
  gridDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: T.muted },
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
