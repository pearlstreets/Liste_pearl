import { initialWindowMetrics } from "react-native-safe-area-context";
import { MARCHE } from "../ui/marche";

export const BRAND = "#1C1917";

// Design system tokens — "modern delivery marketplace" look.
// Barre de gestes / navigation Android : marge sous la derniere carte des pages.
export const INSET_BAS = (initialWindowMetrics && initialWindowMetrics.insets && initialWindowMetrics.insets.bottom) || 0;

export const THEME = {
  brand: MARCHE.noir, brandDark: MARCHE.noir, brandSoft: MARCHE.subtle,
  bg: MARCHE.bg, card: MARCHE.card, subtle: MARCHE.subtle,
  ink: MARCHE.ink, muted: MARCHE.muted, faint: MARCHE.faint,
  border: MARCHE.border, borderInput: MARCHE.borderInput, danger: '#EF4444', dangerSoft: '#FEE2E2',
  accent: MARCHE.terra, accentSoft: MARCHE.terraSoft, info: '#3B82F6', infoSoft: '#DBEAFE',
  terra: MARCHE.terra, terraDark: MARCHE.terraDark, terraSoft: MARCHE.terraSoft,
  // Cartes à contour fin, sans ombre.
  // Ombre très douce des boutons blancs, pour qu'ils ressortent sur le fond crème.
  shadow: { shadowColor: MARCHE.ink, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  shadowSm: { shadowOpacity: 0, elevation: 0 },
};
