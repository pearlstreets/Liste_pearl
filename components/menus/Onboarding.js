// Présentation de la première ouverture : 3 écrans courts, valeurs par défaut, "Passer".
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from './theme';
import { PrimaryButton, GhostButton } from './ui';
import { HouseholdSection, MealsSection, DietSection } from './ProfileForms';
import { useMenus } from './MenusContext';
import useT from './useT';

const STEPS = [
  { emoji: '🏡', title: 'onboarding.s1Title', text: 'onboarding.s1Text' },
  { emoji: '🍽️', title: 'onboarding.s2Title', text: 'onboarding.s2Text' },
  { emoji: '🥗', title: 'onboarding.s3Title', text: 'onboarding.s3Text' },
];

export default function Onboarding() {
  const t = useT();
  const { profile, finishOnboarding, startOnboarding, texts, ingredients } = useMenus();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const change = useCallback(
    (patch) => {
      startOnboarding();
      setDraft((d) => ({ ...d, ...patch }));
    },
    [startOnboarding]
  );
  const last = step === STEPS.length - 1;
  const st = STEPS[step];

  const done = async (skip) => {
    if (busy) return;
    setBusy(true);
    await finishOnboarding(skip ? null : draft);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.top}>
        {step > 0 ? (
          <TouchableOpacity
            onPress={() => setStep(step - 1)}
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
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i === step && s.dotOn, i < step && { backgroundColor: T.brand }]}
            />
          ))}
        </View>
        <GhostButton label={t('onboarding.skip')} onPress={() => done(true)} />
      </View>
      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Text style={{ fontSize: 44 }}>{st.emoji}</Text>
        </View>
        <Text style={s.step}>{t('onboarding.step', { n: step + 1, total: STEPS.length })}</Text>
        <Text style={s.title}>{t(st.title)}</Text>
        <Text style={s.text}>{t(st.text)}</Text>
        <View style={{ marginTop: 22 }}>
          {step === 0 ? <HouseholdSection profile={draft} onChange={change} /> : null}
          {step === 1 ? <MealsSection profile={draft} onChange={change} /> : null}
          {step === 2 ? (
            <DietSection
              profile={draft}
              onChange={change}
              texts={texts}
              ingredients={ingredients}
              compact
            />
          ) : null}
        </View>
        <Text style={s.later}>{t('onboarding.later')}</Text>
      </ScrollView>
      <View style={s.footer}>
        <PrimaryButton
          label={last ? t('onboarding.finish') : t('onboarding.next')}
          icon={last ? 'sparkles' : undefined}
          loading={busy}
          onPress={() => (last ? done(false) : (startOnboarding(), setStep(step + 1)))}
        />
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
  hero: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: T.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  step: {
    fontSize: 13,
    fontWeight: '800',
    color: T.brandDark,
    marginTop: 18,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: { fontSize: 30, fontWeight: '900', color: T.ink, marginTop: 6, lineHeight: 36 },
  text: { fontSize: 16, color: T.muted, marginTop: 8, lineHeight: 23 },
  later: { fontSize: 13, color: T.faint, textAlign: 'center', marginTop: 24 },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: '#fff',
  },
});
