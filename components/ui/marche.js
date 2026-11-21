// Style Marché (choisi par le user le 21/11/2026) : fond crème, encre brun profond,
// terracotta pour les accents, titres à empattements. Les boutons pleins restent
// NOIRS ou BLANCS (règle du user), le terracotta ne sert qu'aux accents
// (icônes, pastilles, barres de progression, minuteur). Les vraies photos ne
// sont jamais remplacées.
import { Platform } from 'react-native';

export const MARCHE = {
  bg: '#F7F1E8',
  card: '#FFFFFF',
  subtle: '#F0E6DA',
  ink: '#2E1C12',
  muted: '#7A5A48',
  faint: '#A88E7E',
  border: '#E9DCCF',
  borderInput: '#DCC9B8',
  terra: '#C8623B',
  terraDark: '#9E4A2A',
  terraSoft: '#F6E3D8',
  noir: '#1C1917',
  blanc: '#FFFFFF',
  nuit: '#3B2418', // fond du mode cuisine
};

// Titres à empattements sans police à télécharger (OTA possible).
export const SERIF = Platform.select
  ? Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' })
  : 'Georgia';

// Mesures communes : mêmes hauteurs de boutons partout.
export const TAILLES = {
  bouton: 50,        // bouton principal (pleine largeur ou paire en bas d'écran)
  boutonPetit: 40,   // bouton secondaire en ligne, pastille d'action
  icone: 40,         // bouton rond d'icône (retour, partage, fermer)
  champ: 48,         // champ de saisie et barre de recherche
  rayonCarte: 16,
  rayonBouton: 25,   // bouton en pilule
  marge: 18,         // marge latérale des écrans
};
