// Libellé d'onglet lisible jusqu'à 320 pt avec 6 onglets : une ligne, taille réduite.
import React from 'react';
import { Text } from 'react-native';

// iPad (libellé à côté de l'icône) : marge à gauche pour que la pastille du
// compteur, posée sur le coin haut droit de l'icône, ne morde pas sur le mot.
export default function TabLabel({ label, color, position }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      allowFontScaling={false}
      style={[{ color, fontSize: 10, fontWeight: '500', maxWidth: '100%', textAlign: 'center' }, position === 'beside-icon' && { marginStart: 14 }]}
    >
      {label}
    </Text>
  );
}
