// Expressions « nombre + unité latine » (200 °C, 60 cl, 1 h 30, 250 g...) dans
// un texte en arabe : sans précaution, l'algorithme bidi les retourne
// (« 200 °C » s'affiche « C° 200 »). On les isole en gauche à droite avec
// U+2066 (LRI) et U+2069 (PDI), pris en charge par Android et iOS.
// Aucun changement pour les langues écrites de gauche à droite.
import { langueEstRTL } from './sensEcriture';

const LRI = '⁦';
const PDI = '⁩';

// (début ou caractère qui n'est ni chiffre ni lettre latine ni LRI déjà posé)
// nombre (décimale, plage 180-200 ou 1/2 permises), espace facultative,
// unité latine, rien de latin collé derrière.
const MOTIF =
  /(^|[^0-9A-Za-z.,⁦])(\d+(?:[.,]\d+)?(?:\s?[-/]\s?\d+(?:[.,]\d+)?)?\s?(?:°\s?[CF]|kcal|kg|mg|g|ml|cl|dl|l|min|h(?:\s?\d{1,2}(?!\d))?))(?![A-Za-z0-9])/g;

export function isolerUnitesLatines(texte, lang) {
  if (typeof texte !== 'string' || !texte || !langueEstRTL(lang)) return texte;
  return texte.replace(MOTIF, (_, avant, expr) => `${avant}${LRI}${expr}${PDI}`);
}
