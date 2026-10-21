// Détail produit tel qu'il est AFFICHÉ (« Origine France · 1kg »).
// La valeur brute (« Origine France – 1kg ») reste l'identifiant : clés
// productDetails des locales, data/search-map.json, favoris enregistrés sur
// le serveur. On ne la modifie jamais, on la normalise seulement à l'écran.
const TIRETS = /\s*[–—]\s*/g;

export function normaliserDetail(detail) {
  if (detail === null || detail === undefined) return '';
  return String(detail).replace(TIRETS, ' · ');
}

// Avec `t`, traduit d'abord par la clé brute (productDetails.<valeur brute>),
// puis normalise le résultat ; sans `t`, normalise seulement.
export function libelleDetail(detail, t) {
  if (!detail) return '';
  const brut = String(detail);
  const texte = typeof t === 'function' ? t('productDetails.' + brut, { defaultValue: brut }) : brut;
  return normaliserDetail(texte);
}
