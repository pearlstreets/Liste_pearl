// Réglages des menus : foyer, repas voulus, régimes. Tout est enregistré à chaque changement.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '../ui/IoniconsSens';
import { T } from './theme';
import { SectionTitle, GhostButton, PrimaryButton } from './ui';
import Questionnaire from './Questionnaire';
import { HouseholdSection, MealsSection, DietSection, PrefsSection } from './ProfileForms';
import RemindersSection from './RemindersSection';
import PrivacySection from './PrivacySection';
import { useMenus } from './MenusContext';
import { loadMenusSyncStatus, onMenusSyncStatus } from '../../services/menusSync';
import useT from './useT';

function syncLine(t, st, lang) {
  if (!st || !st.connected) return t('settings.syncGuest');
  const base = st.account ? t('settings.syncAccount', { account: st.account }) : '';
  let quand = t('settings.syncPending');
  if (st.lastSyncAt) {
    let date = '';
    try {
      date = new Date(st.lastSyncAt).toLocaleString(lang);
    } catch {
      date = new Date(st.lastSyncAt).toLocaleString();
    }
    quand = t('settings.syncLast', { date });
  }
  return base ? `${base}\n${quand}` : quand;
}

export default function SettingsScreen({ onClose }) {
  const t = useT();
  const { profile, updateProfile, texts, ingredients, resetAll, lang, generate } = useMenus();
  const [quest, setQuest] = useState(false);
  const change = useCallback((patch) => updateProfile(patch), [updateProfile]);
  const [sync, setSync] = useState(null);
  useEffect(() => {
    let vivant = true;
    const lire = () =>
      loadMenusSyncStatus()
        .then((st) => vivant && setSync(st))
        .catch(() => {});
    lire();
    const off = onMenusSyncStatus(lire);
    return () => {
      vivant = false;
      off();
    };
  }, []);

  const confirmReset = () =>
    Alert.alert(
      t('settings.resetTitle'),
      t(sync && sync.connected ? 'settings.resetTextAccount' : 'settings.resetText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.resetAction'),
          style: 'destructive',
          onPress: async () => {
            await resetAll();
            onClose && onClose();
          },
        },
      ]
    );

  // « Refaire le questionnaire » : les réponses sont enregistrées au fil des pages ; la fin peut composer la semaine
  // (les repas verrouillés sont gardés).
  if (quest)
    return (
      <Questionnaire
        onClose={() => setQuest(false)}
        onFinish={async (composer) => {
          setQuest(false);
          if (composer) {
            generate();
            onClose && onClose();
          }
        }}
      />
    );

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
        <Text style={s.title}>{t('settings.title')}</Text>
        <View style={s.close} />
      </View>
      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>{t('settings.intro')}</Text>
        <View style={{ marginTop: 14 }}>
          <PrimaryButton
            soft
            icon="options-outline"
            label={t('questionnaire.redo')}
            onPress={() => setQuest(true)}
          />
          <Text style={[s.sync, { marginTop: 8, fontSize: 13 }]}>{t('questionnaire.redoHint')}</Text>
        </View>
        <SectionTitle title={t('settings.household')} />
        <HouseholdSection profile={profile} onChange={change} />
        <SectionTitle title={t('settings.meals')} hint={t('settings.mealsHint')} />
        <MealsSection profile={profile} onChange={change} />
        <SectionTitle title={t('settings.diet')} />
        <DietSection profile={profile} onChange={change} texts={texts} ingredients={ingredients} />
        <SectionTitle title={t('prefs.title')} hint={t('prefs.intro')} />
        <PrefsSection profile={profile} onChange={change} />
        <RemindersSection />
        <PrivacySection connected={!!(sync && sync.connected)} />
        <SectionTitle title={t('settings.sync')} />
        <Text style={s.sync}>{syncLine(t, sync, lang)}</Text>
        <View style={{ marginTop: 34, alignItems: 'center' }}>
          <GhostButton
            danger
            icon="trash-outline"
            label={t('settings.reset')}
            onPress={confirmReset}
          />
        </View>
      </ScrollView>
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
  title: { fontSize: 18, fontWeight: '600', color: T.ink },
  body: { paddingHorizontal: 20, paddingBottom: 60 },
  intro: { fontSize: 15, color: T.muted, lineHeight: 21 },
  sync: { fontSize: 15, color: T.muted, lineHeight: 21 },
});
