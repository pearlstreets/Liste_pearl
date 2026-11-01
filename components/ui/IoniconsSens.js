// Ionicons qui suit le sens d'écriture : en droite à gauche (arabe), les icônes
// directionnelles (chevron, flèche, caret « forward »/« back ») sont retournées
// en miroir. En gauche à droite, rendu strictement identique à Ionicons.
import React from 'react';
import { I18nManager } from 'react-native';
import { Ionicons as IoniconsBase } from '@expo/vector-icons';

const DIRECTIONNELLE = /^(chevron|arrow|caret)-(forward|back)(-|$)/;
const MIROIR = { transform: [{ scaleX: -1 }] };

export function estIconeDirectionnelle(name) {
  return typeof name === 'string' && DIRECTIONNELLE.test(name);
}

export function Ionicons(props) {
  if (I18nManager.isRTL && estIconeDirectionnelle(props.name)) {
    return <IoniconsBase {...props} style={[props.style, MIROIR]} />;
  }
  return <IoniconsBase {...props} />;
}

Ionicons.glyphMap = IoniconsBase.glyphMap;
Ionicons.getImageSource = IoniconsBase.getImageSource;
Ionicons.loadFont = IoniconsBase.loadFont;
Ionicons.font = IoniconsBase.font;

export default Ionicons;
