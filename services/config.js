// Marketplace + Delivery API Configuration
// Switch between environments by changing the active config

const ENV = {
  local: {
    // IP LAN du Mac dev (compat physical device + simulator). Si DHCP
    // change l'IP, mettre à jour ici (ifconfig en0). Cohérent avec
    // AppPro/.env, AppUser/.env, pearl-delivery/.env (toutes les apps
    // mobiles tapent la même URL → même Django local).
    API_URL: "http://192.168.1.15:8000/api/v1",
    DELIVERY_API_URL: "http://192.168.1.15:8000/api/v1/delivery",
    WEB_URL: "http://localhost:7002",
    ADMIN_URL: "http://localhost:7001",
    PRO_URL: "http://localhost:7003",
  },
  staging: {
    API_URL: "https://pythonapi.digiexports.in/api/v1",
    DELIVERY_API_URL: "https://pythonapi.digiexports.in/api/v1/delivery",
    WEB_URL: "https://marketplace.digiexports.in",
    ADMIN_URL: "https://admin.digiexports.in",
    PRO_URL: "https://pro.digiexports.in",
  },
  production: {
    API_URL: "https://api.pearlstreets.com/api/v1",
    DELIVERY_API_URL: "https://api.pearlstreets.com/api/v1/delivery",
    WEB_URL: "https://marche.pearlstreets.com",
    ADMIN_URL: "https://admin.pearlstreets.com",
    PRO_URL: "https://pro.pearlstreets.com",
  },
};

// Active environment - change this to switch
// "staging" = pythonapi.digiexports.in (needs deployed backend)
// "local"   = localhost:8000 (needs local Django server) ← actif depuis 2026-04-25
// "production" = api.pearlstreets.com
//
// Audit 2026-04-25 : passage staging → local pour unifier le backend avec
// les 4 apps marketplace (WebsitePro, WebsiteUser, AppPro, AppUser) qui
// pointent toutes sur localhost:8000 (resp. 192.168.1.15:8000 côté mobile).
// Conséquence : un produit créé dans WebsitePro sous catégorie
// "product_purchase" est immédiatement visible dans pearl-list via les
// endpoints marketplace (/api/v1/users/...). L'app conserve son fallback
// "local accounts" si Django down.
//
// IMPORTANT pour test sur device physique : remplace "localhost" par l'IP
// LAN du Mac (`ipconfig getifaddr en0` → ex: 192.168.1.15) car localhost
// résout sur le téléphone, pas sur ton Mac.
const ACTIVE_ENV = "production";

export const CONFIG = ENV[ACTIVE_ENV];
export default CONFIG;
