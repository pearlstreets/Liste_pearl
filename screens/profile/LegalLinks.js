import React from "react";
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { LEGAL_URLS } from "../../services/config";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { THEME } from "../../components/commun/theme";
import { profStyles } from "./profStyles";

// Pages légales publiques (politique de confidentialité, conditions d'utilisation), visibles avec ou sans compte.
export default function LegalLinks() {
  const { t } = useTranslation();
  const ouvrir = (url) => { Linking.openURL(url).catch(() => {}); };
  return (
    <View style={profStyles.section}>
      <Text style={profStyles.guestPrefTitle}>{t('profile.legalTitle', 'Informations légales')}</Text>
      <View style={profStyles.settingsCard}>
        <TouchableOpacity activeOpacity={0.8} accessibilityRole="link" onPress={() => ouvrir(LEGAL_URLS.privacy)} style={[profStyles.settingRow, profStyles.settingDivider]}>
          <View style={profStyles.settingIcon}>
            <Ionicons name="shield-checkmark-outline" size={19} color="#1C1917" />
          </View>
          <View style={profStyles.settingBody}>
            <Text style={profStyles.settingLabel}>{t('profile.privacyPolicy', 'Politique de confidentialité')}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={THEME.faint} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} accessibilityRole="link" onPress={() => ouvrir(LEGAL_URLS.terms)} style={profStyles.settingRow}>
          <View style={profStyles.settingIcon}>
            <Ionicons name="document-text-outline" size={19} color="#1C1917" />
          </View>
          <View style={profStyles.settingBody}>
            <Text style={profStyles.settingLabel}>{t('profile.termsOfUse', "Conditions d'utilisation")}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={THEME.faint} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
