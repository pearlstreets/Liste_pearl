// Version web de stripeNative.js : le SDK Stripe natif n'existe pas sur le web et ne doit pas entrer
// dans le bundle. Mêmes exports, inertes : le tunnel carte n'est jamais monté.
export const StripeAvailable = false;
export const StripeProvider = ({ children }) => children;
export const useStripe = () => null;
export const CardField = null;
export const CardForm = null;
