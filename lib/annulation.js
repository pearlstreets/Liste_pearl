// Annulation d'une commande livrée par le client (bouton du suivi de commande).
//
// Le serveur décide : possible tant qu'aucune boutique n'a commencé la
// préparation et qu'aucun livreur n'a récupéré la course ; sinon 409
// `already_in_preparation` / `already_picked_up`. Côté app, le bouton n'est
// montré que pour une course encore en attente (aucun livreur, aucune
// préparation visible) et jamais après un refus. Fonctions pures, sans lever.

export const RAISONS_TROP_TARD = ['already_in_preparation', 'already_picked_up'];

// Statut de la course : celui relu au serveur, sinon celui gardé localement.
export function statutDeLaCourse(order, apiStatus) {
  const brut = (apiStatus && apiStatus.status) || (order && order.deliveryStatus) || '';
  return String(brut).trim().toLowerCase();
}

// Bouton montré : livraison, course encore en attente, aucun refus reçu.
export function annulationPossible(order, apiStatus) {
  if (!order || typeof order !== 'object' || order.mode !== 'delivery') return false;
  if (order.cancelRefused) return false;
  return statutDeLaCourse(order, apiStatus) === 'pending';
}

// Refus « trop tard » (409 + raison connue), sinon null. `err` = erreur levée
// par deliveryFetch (status + body).
export function refusAnnulation(err) {
  if (!err || err.status !== 409) return null;
  const body = err.body && typeof err.body === 'object' ? err.body : {};
  return RAISONS_TROP_TARD.includes(body.reason) ? body.reason : null;
}
