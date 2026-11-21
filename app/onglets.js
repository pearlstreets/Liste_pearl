// Noms des onglets du bas et passage d'un onglet à l'autre.
// L'onglet « Acheter » réunit les anciens onglets Produits (segment « Comparer
// ma liste ») et Boutiques (segment « Boutiques »). Les anciens noms de route
// 'products' et 'shops' restent valables : ils ouvrent Acheter sur le bon segment.

export const ROUTE_ACHETER = 'acheter';
export const SEGMENT_COMPARER = 'comparer';
export const SEGMENT_BOUTIQUES = 'boutiques';
export const ANCIENNES_ROUTES = { products: SEGMENT_COMPARER, shops: SEGMENT_BOUTIQUES };

/**
 * Route réelle d'un nom d'onglet : { name, params }. Un ancien nom ('products',
 * 'shops', par exemple lu dans CLE_ONGLET_APRES_RECHARGEMENT) devient Acheter
 * avec son segment ; tout autre nom est rendu tel quel.
 */
export function routeDOnglet(nom, params) {
  const segment = ANCIENNES_ROUTES[nom];
  if (segment) return { name: ROUTE_ACHETER, params: { ...(params || {}), segment, n: Date.now() } };
  return { name: nom, params };
}

/** navigation.navigate tolérant aux anciens noms d'onglet. Ne lève jamais. */
export function allerA(navigation, nom, params) {
  try {
    const r = routeDOnglet(nom, params);
    if (r.params === undefined) navigation.navigate(r.name);
    else navigation.navigate(r.name, r.params);
    return true;
  } catch {
    return false;
  }
}
