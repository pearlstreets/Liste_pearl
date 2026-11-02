// Jetons de style de l'onglet Menus : mêmes valeurs que THEME dans App.js (design Graphite),
// sauf la couleur principale (brand, brandDark, brandSoft) qui reste verte côté recettes.
export const T = {
  brand: '#09d7aa',
  brandDark: '#07b896',
  brandSoft: '#E0FAF3',
  bg: '#FAFAF9',
  card: '#FFFFFF',
  subtle: '#F5F5F4',
  ink: '#1C1917',
  muted: '#78716C',
  faint: '#A8A29E',
  border: '#E7E5E4',
  borderInput: '#D6D3D1',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  accent: '#FFB547',
  accentSoft: '#FFF3E0',
  info: '#3B82F6',
  infoSoft: '#DBEAFE',
  // Cartes à contour fin, sans ombre.
  shadow: { shadowOpacity: 0, elevation: 0 },
  shadowSm: { shadowOpacity: 0, elevation: 0 },
};

// Teinte du visuel d'une recette selon son type (repli quand il n'y a pas de photo).
export const COURSE_TINT = {
  plat: '#E0FAF3',
  entree: '#FFF3E0',
  dessert: '#FCE7F3',
  'petit-dejeuner': '#FEF9C3',
};
