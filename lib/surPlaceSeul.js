// Restaurant au seul sur place (règle serveur du 13/10/2026) : ses plats ne
// s'achètent pas en ligne. Le serveur refuse avec `reason:
// 'onsite_only_no_purchase'` : 400 sur la course (create-order), 200
// `status: false` sur l'ajout au panier, 400 sur la création de commande.
export const RAISON_SUR_PLACE_SEUL = 'onsite_only_no_purchase';

// Vrai si `x` porte ce refus : erreur levée par deliveryFetch (`body`),
// erreur portant `refus`, ou corps de réponse lu directement.
export function estRefusSurPlaceSeul(x) {
  if (!x || typeof x !== 'object') return false;
  const corps = [x, x.body, x.refus];
  return corps.some((c) => !!c && typeof c === 'object' && c.reason === RAISON_SUR_PLACE_SEUL);
}
