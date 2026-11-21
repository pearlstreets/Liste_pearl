// Jetons de style de l'onglet Menus : mêmes valeurs que THEME dans App.js (design Graphite),
// avec le terracotta du style Marché comme couleur d'accent (jamais en fond de bouton).
import { MARCHE, SERIF, TAILLES } from '../ui/marche';

export { SERIF, TAILLES };

export const T = {
  brand: MARCHE.terra,
  brandDark: MARCHE.terraDark,
  brandSoft: MARCHE.terraSoft,
  bg: MARCHE.bg,
  card: '#FFFFFF',
  subtle: MARCHE.subtle,
  ink: MARCHE.ink,
  muted: MARCHE.muted,
  faint: MARCHE.faint,
  border: MARCHE.border,
  borderInput: MARCHE.borderInput,
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  accent: MARCHE.terra,
  accentSoft: MARCHE.terraSoft,
  info: '#3B82F6',
  infoSoft: '#DBEAFE',
  // Cartes à contour fin, sans ombre.
  shadow: { shadowOpacity: 0, elevation: 0 },
  shadowSm: { shadowOpacity: 0, elevation: 0 },
};

// Teinte du visuel d'une recette selon son type (repli quand il n'y a pas de photo).
export const COURSE_TINT = {
  plat: '#F6E3D8',
  entree: '#EFE6D2',
  dessert: '#F3DCD3',
  'petit-dejeuner': '#F7EBD0',
};
