// Marketplace + Delivery API Configuration
// Switch between environments by changing the active config

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
    API_URL: 'https://api.pearlstreets.com/api/v1',
    DELIVERY_API_URL: 'https://api.pearlstreets.com/api/v1/delivery',
    WEB_URL: 'https://marche.pearlstreets.com',
    ADMIN_URL: 'https://admin.pearlstreets.com',
    PRO_URL: 'https://pro.pearlstreets.com',
  },
};

// Active environment - change this to switch
// "production" = api.pearlstreets.com (live Pearl Streets marketplace)
// "staging" = pythonapi.digiexports.in (currently DOWN - NXDOMAIN)
// "local" = localhost:8000 (needs local Django server)
// The app always falls back to local accounts and demo data if API is unavailable
const ACTIVE_ENV = 'production';

export const CONFIG = ENV[ACTIVE_ENV];

// Feature flags — hide UI for features whose backend endpoints are
// currently 404 on production so users don't hit dead buttons.
// Flip to true when the corresponding /delivery/* and /users/favorites/*
// routes are deployed on api.pearlstreets.com.
export const FEATURES = {
  // /delivery/* entirely 404 on prod (no driver assignment backend).
  // When false: hide "Become a driver" CTA, hide delivery-mode selector
  // in checkout, don't poll delivery status.
  delivery: ACTIVE_ENV !== 'production',
  // /users/favorites/* 404 on prod. Local favorites still work (they
  // persist in AsyncStorage), so keep this true — favorites UI remains
  // usable, just without cross-device sync.
  favoritesBackend: ACTIVE_ENV !== 'production',
  // /users/register/ and /userprofessional/register/ return 500 on prod.
  // Signup UI stays visible but shows a clearer error when the 500 hits.
  signup: true,
};

export default CONFIG;
