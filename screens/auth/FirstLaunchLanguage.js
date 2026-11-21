import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useTranslation } from 'react-i18next';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { MARCHE, SERIF, TAILLES } from "../../components/ui/marche";
import { THEME } from "../../components/commun/theme";
import { LANGUAGES } from "../../lib/constants";

// Écran de choix de langue au tout premier lancement (aucune langue enregistrée),
// comme AppUser / AppPro. Affiché avant l'app ; le choix est persisté (APP_LANGUAGE)
// et l'écran ne réapparaît plus.
export default function FirstLaunchLanguage({ onDone }) {
  const { t: tFL, i18n: i18nFL } = useTranslation();
  const [selected, setSelected] = React.useState(i18nFL.language || 'fr');
  const choose = async (code) => {
    setSelected(code);
    try { await i18nFL.changeLanguage(code); await AsyncStorage.setItem('APP_LANGUAGE', code); } catch (_) {}
    onDone();
  };
  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <View style={{ alignItems: 'center', paddingTop: 90, paddingBottom: 18, paddingHorizontal: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="language" size={34} color={THEME.ink} />
        </View>
        <Text style={{ fontSize: 26, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center' }}>{tFL('auth.chooseYourLanguage', 'Choose your language')}</Text>
        {/* Rappel en anglais tant que la langue de l'appareil n'est pas l'anglais. */}
        {!(i18nFL.language || '').startsWith('en') ? (
          <Text style={{ fontSize: 14, color: THEME.muted, marginTop: 6 }}>{tFL('auth.chooseYourLanguage', { lng: 'en', defaultValue: 'Choose your language' })}</Text>
        ) : null}
      </View>
      <FlatList
        data={LANGUAGES}
        keyExtractor={(i) => i.code}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => choose(item.code)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 12, paddingHorizontal: 16, borderRadius: TAILLES.rayonCarte, marginTop: 8, backgroundColor: THEME.card, borderWidth: 1, borderColor: selected === item.code ? MARCHE.noir : THEME.border }}
          >
            <Text style={{ fontSize: 22, marginRight: 12 }}>{item.flag}</Text>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '600', color: THEME.ink }}>{item.label}</Text>
            {selected === item.code && <Ionicons name="checkmark-circle" size={22} color={THEME.terra} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
