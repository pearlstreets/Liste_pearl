// Marketplace + Delivery API Configuration
// Switch between environments by changing the active config

import Constants from 'expo-constants';

const ENV = {
  local: {
    API_URL: 'http://localhost:8000/api/v1',
    DELIVERY_API_URL: 'http://localhost:8000/api/v1/delivery',
    WEB_URL: 'http://localhost:7002',
    ADMIN_URL: 'http://localhost:7001',
    PRO_URL: 'http://localhost:7003',
  },
  staging: {
    API_URL: 'https://pythonapi.digiexports.in/api/v1',
    DELIVERY_API_URL: 'https://pythonapi.digiexports.in/api/v1/delivery',
    WEB_URL: 'https://marketplace.digiexports.in',
    ADMIN_URL: 'https://admin.digiexports.in',
    PRO_URL: 'https://pro.digiexports.in',
  },
  production: {
    // MÊME backend que l'app mobile AppUser (env.js -> PROD_API) et que le site
    // WebsiteUser : api.pearlstreets.com SANS le préfixe /app-api.
    // Compte utilisateur unique (inscription / connexion / suppression partagées)
    // et annuaire d'utilisateurs peuplé.
    // ⚠️ NE PAS remettre /app-api : c'est un second backend (port 8095) sur une
    // base quasi vide — AppUser ne l'utilise pas (cf. AppUser/APPSTORE_SUBMISSION.md).
    API_URL: 'https://api.pearlstreets.com/api/v1',
    DELIVERY_API_URL: 'https://api.pearlstreets.com/api/v1/delivery',
    WEB_URL: 'https://marche.pearlstreets.com',
    ADMIN_URL: 'https://admin.pearlstreets.com',
    PRO_URL: 'https://pro.pearlstreets.com',
  },
};

// Active environment - selected automatically by build mode
// "staging" = pythonapi.digiexports.in (needs deployed backend)
// "local" = localhost:8000 (needs local Django server)
// "production" = api.pearlstreets.com (release builds)
// The app always falls back to local accounts if API is unavailable
//
// TOUJOURS la prod : les comptes Marketplace des utilisateurs sont en base PROD
// (api.pearlstreets.com). En dev (Expo Go) l'app pointait sur localhost:8000, qui
// n'a pas les comptes prod → "Aucun compte trouvé". Repasser sur `__DEV__ ? 'local'
// : 'production'` uniquement pour développer contre le backend Django local.
const ACTIVE_ENV = 'production';

export const CONFIG = ENV[ACTIVE_ENV];

// Clé publishable Stripe (identique à AppUser / .env prod). Une publishable key
// est safe à embarquer côté client. Source: app.json extra.stripePublishableKey,
// fallback en dur pour les cas où expoConfig.extra n'est pas résolu.
export const STRIPE_PUBLISHABLE_KEY =
  (Constants?.expoConfig?.extra?.stripePublishableKey) ||
  'pk_live_51R8hqCArfIzMjUBjIDVUlchS37nktlFM2cdugW3ocvqBwdi8GxPuKkaKTlnGdX2Qb0yVbAK9JivZlUOAvgygP8Pe00JEBclh24';

export default CONFIG;
