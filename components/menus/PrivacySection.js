// Réglages : partage de la semaine avec les proches, mesure d'usage anonyme.
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SectionTitle } from './ui';
import { Ligne } from './RemindersSection';
import { useMenus } from './MenusContext';
import useT from './useT';
import { isMenusUsageEnabled, setMenusUsageEnabled } from '../../services/menusUsage';
import { LEGAL_URLS } from '../../services/config';
import { T } from './theme';

export default function PrivacySection({ connected }) {
  const t = useT();
  const { familyShare, updateFamilyShare } = useMenus();
  const [usage, setUsage] = useState(true);
  useEffect(() => {
    let vivant = true;
    isMenusUsageEnabled().then((on) => vivant && setUsage(on));
    return () => {
      vivant = false;
    };
  }, []);
  const changeUsage = useCallback((on) => {
    setUsage(on);
    setMenusUsageEnabled(on);
  }, []);
  return (
    <>
      <SectionTitle title={t('settings.privacy')} />
      {connected ? (
        <Ligne
          label={t('settings.familyShareLabel')}
          hint={t('settings.familyShareHint')}
          on={familyShare.enabled}
          onChange={updateFamilyShare}
        />
      ) : null}
      <Ligne
        label={t('settings.usageLabel')}
        hint={t('settings.usageHint')}
        on={usage}
        onChange={changeUsage}
      />
      <View style={s.legal}>
        <Text style={s.legalTxt}>
          {t('settings.privacyNote', {
            defaultValue: 'Le détail des données utilisées et de vos droits figure dans notre politique de confidentialité.',
          })}
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(LEGAL_URLS.privacy).catch(() => {})}
          accessibilityRole="link"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={s.legalLink}>{t('settings.privacyLink', { defaultValue: 'Politique de confidentialité' })}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  legal: { paddingVertical: 6 },
  legalTxt: { fontSize: 13, color: T.muted, lineHeight: 18 },
  legalLink: { fontSize: 14, fontWeight: '700', color: T.brandDark, marginTop: 4, textDecorationLine: 'underline' },
});
