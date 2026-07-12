// Tunnel commande RÉELLE Marketplace : cart/add → order/create → paiement.
// Une commande payée (is_paid=True) devient visible dans le dashboard du PRO.
// Endpoints IDENTIQUES à ceux d'AppUser (flux prod éprouvé). BASE_URL inclut déjà
// /api/v1, donc les chemins commencent à /users et /payment.
import { apiGet, apiPost, apiPut, apiDelete } from './api';

// ===== Cartes enregistrées (UserSaveCard) — mêmes endpoints qu'AppUser =====
// Une carte = { id, stripe_payment_method_id, brand, last4, exp_month, exp_year }.

// Liste les cartes enregistrées du user (pur appel API, marche même en Expo Go).
export async function getSavedCardsApi() {
  const data = await apiGet('/payment/user/saved-cards/');
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.cards)) return data.cards;
  return [];
}

// Enregistre une carte tokenisée (PaymentMethod) pour réutilisation. Idempotent
// côté serveur sur (user, stripe_payment_method_id).
export function saveCardApi(stripePaymentMethodId) {
  return apiPost('/payment/user/save-card/', { stripe_payment_method_id: stripePaymentMethodId });
}

// Supprime une carte enregistrée (détache de Stripe + retire la ligne).
export function deleteSavedCardApi(cardId) {
  return apiDelete(`/payment/user/saved-cards/${cardId}/`);
}

// 1) Ajoute un produit au panier serveur du user.
//    order_type_key = INT (mapping cart/add) : 3=Delivery, 2=Click and Collect.
export function addToCartApi(body) {
  return apiPost('/users/cart/add/', body);
}

// 2) (Delivery) fige order_type + adresse avant le checkout.
//    orderType = CLÉ STRING d'URL (ORDER_TYPE_MAP) : '3'=Delivery, '2'=Click and Collect.
//    (Attention : mapping distinct de cart/add.)
export function updateCartMetaApi(companyId, orderType, body) {
  return apiPut(`/users/cart/update-meta/${companyId}/${orderType}/`, body);
}

// 3) Crée la commande depuis le panier. SANS card_id → defer_payment :
//    is_paid=False / orderStatus='awaiting_payment'. Réponse: { order_id: <string> }.
export function createOrderApi(companyId, categoryId, body = {}) {
  return apiPost(`/users/order/create/${companyId}/${categoryId}/`, body);
}

// 4a) S'assure que le Stripe Customer du user existe (à appeler avant de payer).
export function createStripeCustomerApi() {
  return apiPost('/payment/user/order/create-stripe-customer/', {});
}

// 4b) Paie une commande existante via Connect (charge_customer_for_vendor) :
//     body { orderId, paymentMode:'card', payment_method_id }. Passe is_paid=True
//     → la commande atteint le PRO. Renvoie 402/requires_action pour le 3DS.
export function payOrderApi(body) {
  return apiPost('/payment/user/order/payment/', body);
}
