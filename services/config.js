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

// Active environment - selected automatically by build mode
// "staging" = pythonapi.digiexports.in (needs deployed backend)
// "local" = localhost:8000 (needs local Django server)
// "production" = api.pearlstreets.com (release builds)
// The app always falls back to local accounts if API is unavailable
const ACTIVE_ENV = __DEV__ ? 'local' : 'production';

export const CONFIG = ENV[ACTIVE_ENV];
export default CONFIG;
