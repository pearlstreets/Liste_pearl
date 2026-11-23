// Style Pearl List (piste A choisie par le user le 23/11/2026, reprend les
// couleurs de l'icône) : fond blanc cassé, encre anthracite, vert de l'icône
// pour les accents (texte vert un peu plus foncé pour rester lisible), jaune en
// touche rare. Les boutons pleins restent NOIRS ou BLANCS (règle du user).
// Les clés gardent leurs anciens noms (terra...) pour ne rien casser ailleurs.
// Les vraies photos ne sont jamais remplacées.
import { Platform } from 'react-native';

export const MARCHE = {
  bg: '#FAFAF7',
  card: '#FFFFFF',
  subtle: '#F1F4F0',
  ink: '#1F2421',
  muted: '#4A524C',
  faint: '#8A928C',
  border: '#E3E7E2',
  borderInput: '#D5DBD4',
  terra: '#2E9E3B', // vert lisible (texte, prix, onglet actif),
  terraDark: '#237A2E',
  terraSoft: '#E8F6EA',
  noir: '#1C1917',
  blanc: '#FFFFFF',
  vert: '#3DBE4A', // vert exact de l'icône (pastilles, puces)
  jaune: '#FFC21F', // touche rare
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
