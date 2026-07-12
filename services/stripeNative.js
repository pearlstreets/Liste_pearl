// Isolation du SDK natif @stripe/stripe-react-native.
//
// POURQUOI ce module : le SDK Stripe est un module NATIF. Il n'existe PAS dans
// Expo Go. Un import statique planterait le bundle au démarrage (le module
// appelle TurboModuleRegistry.getEnforcing('StripeSdk') à l'init). On centralise
// donc l'unique référence au package derrière un require CONDITIONNEL + try/catch,
// gardé par la détection d'Expo Go. Tout le reste du code importe Stripe via ce
// module UNIQUEMENT.
//
// Conséquence :
//  - Expo Go        → StripeAvailable=false, StripeProvider = passthrough neutre,
//                     useStripe()=null, CardField/CardForm=null. Le tunnel carte
//                     n'est jamais monté → l'app tourne, zéro crash, le flux local
//                     + la course livreur restent intacts.
//  - Build natif    → require résout le module, StripeAvailable=true, le paiement
//    (dev-client/EAS)  carte s'active.

import Constants from 'expo-constants';

// Expo Go se signale par executionEnvironment==='storeClient' (SDK 54) ; on garde
// appOwnership==='expo' en filet (API dépréciée mais encore présente).
const isExpoGo =
  Constants?.executionEnvironment === 'storeClient' ||
  Constants?.appOwnership === 'expo';

let S = null;
if (!isExpoGo) {
  try {
    // eslint-disable-next-line global-require
    S = require('@stripe/stripe-react-native');
  } catch (e) {
    S = null;
  }
}

// true seulement dans un build natif où le module natif Stripe est réellement lié.
export const StripeAvailable = !!(S && S.StripeProvider);

// Passthrough neutre en l'absence de Stripe : rend simplement les enfants, aucun
// natif touché.
export const StripeProvider =
  (S && S.StripeProvider) || (({ children }) => children);

export const useStripe = (S && S.useStripe) || (() => null);
export const CardField = (S && S.CardField) || null;
export const CardForm = (S && S.CardForm) || null;
