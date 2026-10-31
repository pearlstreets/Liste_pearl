// Libellé d'onglet lisible jusqu'à 320 pt avec 6 onglets : une ligne, taille réduite.
import React from 'react';
import { Text } from 'react-native';

export default function TabLabel({ label, color }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      allowFontScaling={false}
      style={{ color, fontSize: 10, fontWeight: '500', maxWidth: '100%', textAlign: 'center' }}
    >
      {label}
    </Text>
  );
}
