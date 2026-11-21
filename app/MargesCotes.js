import React from "react";
import { View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME } from "../components/commun/theme";

// Ecran exterieur de l'iPhone Duo (camera et heure sur le cote) : marges gauche et droite
// appliquees une seule fois ici, puis remises a zero pour les ecrans en dessous.
// Sans marge laterale (tous les autres telephones), rien ne change.
export default function MargesCotes({ children }) {
  const insets = useSafeAreaInsets();
  if (!insets.left && !insets.right) return children;
  return (
    <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: THEME.bg }}>
      <SafeAreaInsetsContext.Provider value={{ ...insets, left: 0, right: 0 }}>{children}</SafeAreaInsetsContext.Provider>
    </View>
  );
}
