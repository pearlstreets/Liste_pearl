// Réglages des menus : foyer, repas voulus, régimes. Tout est enregistré à chaque changement.
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from './theme';
import { SectionTitle, GhostButton } from './ui';
import { HouseholdSection, MealsSection, DietSection } from './ProfileForms';
import { useMenus } from './MenusContext';
import useT from './useT';

export default function SettingsScreen({ onClose }) {
  const t = useT();
  const { profile, updateProfile, texts, ingredients, resetAll } = useMenus();
  const change = useCallback((patch) => updateProfile(patch), [updateProfile]);

  const confirmReset = () =>
    Alert.alert(t('settings.resetTitle'), t('settings.resetText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.resetAction'),
        style: 'destructive',
        onPress: async () => {
          await resetAll();
          onClose && onClose();
        },
      },
    ]);

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
        <SectionTitle title={t('settings.household')} />
        <HouseholdSection profile={profile} onChange={change} />
        <SectionTitle title={t('settings.meals')} hint={t('settings.mealsHint')} />
        <MealsSection profile={profile} onChange={change} />
        <SectionTitle title={t('settings.diet')} />
        <DietSection profile={profile} onChange={change} texts={texts} ingredients={ingredients} />
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
  title: { fontSize: 18, fontWeight: '800', color: T.ink },
  body: { paddingHorizontal: 20, paddingBottom: 60 },
  intro: { fontSize: 15, color: T.muted, lineHeight: 21 },
});
