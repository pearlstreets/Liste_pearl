// Questionnaire « Personnaliser mes menus » : 4 pages, tout est facultatif, chaque réglage est enregistré
// aussitôt (rien ne se perd si l'app est fermée au milieu). Proposé à la première ouverture (Onboarding.js)
// et refaisable depuis les réglages. Mêmes blocs que l'écran Réglages (ProfileForms.js).
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '../ui/IoniconsSens';
import { T } from './theme';
import { PrimaryButton, GhostButton, Chip } from './ui';
import {
  HouseholdModeChips,
  HouseholdCounts,
  MembersSection,
  BudgetCard,
  keptMembers,
  MealsSection,
  DietSection,
  PrefsSwitches,
  QuickPicker,
  TreatsPicker,
  CuisinesPicker,
} from './ProfileForms';
import { GOALS, ADULT_AGE } from '../../lib/menus/needs';
import { useMenus } from './MenusContext';
import useT from './useT';

const PAGES = [
  { emoji: '🏡', title: 'questionnaire.p1Title', text: 'questionnaire.p1Text' },
  { emoji: '🎯', title: 'questionnaire.p2Title', text: 'questionnaire.p2Text' },
  { emoji: '🥗', title: 'questionnaire.p3Title', text: 'questionnaire.p3Text' },
  { emoji: '⏱️', title: 'questionnaire.p4Title', text: 'questionnaire.p4Text' },
];

// Page 1 : « Simple » (adultes et enfants) ou « Personnalisé » (une fiche par personne).
function PageHousehold({ profile, onChange }) {
  const simple = profile.mode === 'simple' || (!profile.mode && keptMembers(profile).length === 0);
  const members = useMemo(() => keptMembers(profile), [profile.members, profile.dormant]);
  const t = useT();
  // Sans choix encore fait, « Simple » est affiché ; le mode n'est écrit qu'au premier choix.
  const view = { ...profile, mode: simple ? 'simple' : 'perso' };
  return (
    <View>
      <HouseholdModeChips profile={view} onChange={onChange} />
      <View style={{ marginTop: 14 }}>
        {simple ? (
          <>
            <HouseholdCounts profile={profile} onChange={onChange} />
            {members.length ? (
              <Text style={s.hint}>{t('questionnaire.keptHint')}</Text>
            ) : null}
          </>
        ) : (
          <MembersSection profile={profile} members={members} onChange={onChange} />
        )}
      </View>
    </View>
  );
}

// Page 2 : objectif de chaque adulte (masqué sous 18 ans) et repas plaisir par semaine.
function PageGoals({ profile, onChange }) {
  const t = useT();
  const perso = profile.mode !== 'simple' && Array.isArray(profile.members) && profile.members.length > 0;
  const members = perso ? profile.members : [];
  const adult = (m) => (m.age !== null && m.age !== undefined ? m.age >= ADULT_AGE : !m.child);
  const setGoal = (id, goal) =>
    onChange({ members: members.map((m) => (m.id === id ? { ...m, goal } : m)) });
  return (
    <View>
      {!perso ? <Text style={s.hint}>{t('questionnaire.goalNeedsPerso')}</Text> : null}
      {members.map((m, i) =>
        adult(m) ? (
          <View key={m.id} style={s.card}>
            <Text style={s.cardTitle}>{m.name.trim() || t('nutri.person', { n: i + 1 })}</Text>
            <Text style={s.cardHint}>{t('nutri.goal')}</Text>
            <View style={s.wrap}>
              {GOALS.map((g) => (
                <Chip
                  key={g}
                  label={t(`nutri.goal_${g}`)}
                  on={m.goal === g}
                  onPress={() => setGoal(m.id, m.goal === g ? null : g)}
                />
              ))}
            </View>
          </View>
        ) : null
      )}
      {perso && !members.some(adult) ? <Text style={s.hint}>{t('nutri.goalMinor')}</Text> : null}
      <TreatsPicker profile={profile} onChange={onChange} />
    </View>
  );
}

export default function Questionnaire({ onboarding, onFinish, onClose }) {
  const t = useT();
  const { profile, updateProfile, startOnboarding, texts, ingredients } = useMenus();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const scroll = useRef(null);
  useEffect(() => {
    if (scroll.current && scroll.current.scrollTo) scroll.current.scrollTo({ y: 0, animated: false });
  }, [step]);
  const change = useCallback(
    (patch) => {
      if (onboarding) startOnboarding();
      return updateProfile(patch);
    },
    [onboarding, startOnboarding, updateProfile]
  );
  const last = step === PAGES.length - 1;
  const pg = PAGES[step];

  const finish = async (generate) => {
    if (busy) return;
    setBusy(true);
    try {
      await onFinish(generate);
    } finally {
      setBusy(false);
    }
  };
  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else if (onClose) onClose();
  };
  const next = () => {
    if (onboarding) startOnboarding();
    setStep((x) => Math.min(PAGES.length - 1, x + 1));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.top}>
        {step > 0 || onClose ? (
          <TouchableOpacity
            onPress={goBack}
            style={s.back}
            accessibilityLabel={t('common.back')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={T.ink} />
          </TouchableOpacity>
        ) : (
          <View style={s.back} />
        )}
        <View style={s.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i === step && s.dotOn, i < step && { backgroundColor: T.brand }]}
            />
          ))}
        </View>
        <GhostButton label={t('onboarding.skip')} onPress={() => (last ? finish(false) : next())} />
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.kicker}>{t('onboarding.step', { n: step + 1, total: PAGES.length })}</Text>
        <View style={s.titleRow}>
          <Text style={{ fontSize: 30, marginRight: 10 }}>{pg.emoji}</Text>
          <Text style={[s.title, { flex: 1 }]}>{t(pg.title)}</Text>
        </View>
        <Text style={s.text}>{t(pg.text)}</Text>
        <View style={{ marginTop: 22 }}>
          {step === 0 ? <PageHousehold profile={profile} onChange={change} /> : null}
          {step === 1 ? <PageGoals profile={profile} onChange={change} /> : null}
          {step === 2 ? (
            <View>
              <CuisinesPicker profile={profile} onChange={change} />
              <DietSection
                profile={profile}
                onChange={change}
                texts={texts}
                ingredients={ingredients}
              />
            </View>
          ) : null}
          {step === 3 ? (
            <View>
              <QuickPicker profile={profile} onChange={change} />
              <BudgetCard profile={profile} onChange={change} style={{ marginTop: 18 }} />
              <View style={{ marginTop: 18 }}>
                <PrefsSwitches profile={profile} onChange={change} />
              </View>
              {onboarding ? (
                <View style={{ marginTop: 18 }}>
                  <Text style={s.cardTitle}>{t('settings.meals')}</Text>
                  <Text style={[s.cardHint, { marginBottom: 12 }]}>{t('settings.mealsHint')}</Text>
                  <MealsSection profile={profile} onChange={change} />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <View style={s.footer}>
        {last ? (
          <>
            <PrimaryButton
              label={t('onboarding.finish')}
              icon="sparkles"
              loading={busy}
              onPress={() => finish(true)}
            />
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <GhostButton label={t('questionnaire.later')} onPress={() => finish(false)} />
            </View>
          </>
        ) : (
          <View style={s.footerRow}>
            {step > 0 ? (
              <GhostButton label={t('common.back')} onPress={goBack} />
            ) : (
              <View />
            )}
            <PrimaryButton label={t('onboarding.next')} onPress={next} style={{ minWidth: 150 }} />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  back: { width: 60, height: 44, justifyContent: 'center', paddingLeft: 6 },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border, marginHorizontal: 4 },
  dotOn: { width: 26, backgroundColor: T.brand },
  body: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 24 },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    color: T.brandDark,
    marginTop: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  title: { fontSize: 28, fontWeight: '600', color: T.ink, lineHeight: 34 },
  text: { fontSize: 16, color: T.muted, marginTop: 8, lineHeight: 23 },
  hint: { fontSize: 13, color: T.muted, marginTop: 10, lineHeight: 18 },
  later: { fontSize: 13, color: T.faint, textAlign: 'center', marginTop: 24 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 14,
    ...T.shadowSm,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: T.ink },
  cardHint: { fontSize: 13, color: T.muted, marginTop: 2, marginBottom: 10, lineHeight: 18 },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: '#fff',
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
