// Ouverture du Panier (commande) ou de Ma Liste (demandes de partage, lien
// pearl-list://partage) : importé en premier, l'abonnement est pris au chargement.
import { brancherNavigation, consommerDestination, oublierDestination, definirConnexion, ouvrirDemandesPartage } from "../services/pushToucher";
import { autocorrectName } from "../utils/spellcheck";
import React from "react";

// Marketplace API Services
import { forgotPassword as apiForgotPassword, purgeLegacyLocalAccounts } from "../services/auth";
import { blockUser } from "../services/sharedLists";
import { getAllProducts, getCompanyProducts, searchProducts as apiSearchProducts, getCategories, getShopsByCategory } from "../services/products";
import { getAllShops, getShopDetails } from "../services/shops";
import { getCart, saveCart, addToCart as apiAddToCart, removeFromCart as apiRemoveFromCart } from "../services/orders";
import { getSecureItem } from "../services/secureStorage";
import { trackDelivery, toggleDriverMode, setDriverCountry, COUNTRY_LIMITS, getCountryLimit } from "../services/delivery";


function itemsToRenderForShop(allUserItems, assignedForThisShop, optimized){
  const A = Array.isArray(allUserItems) ? allUserItems : [];
  const B = Array.isArray(assignedForThisShop) ? assignedForThisShop : [];
  const opt = typeof optimized === "boolean" ? optimized : false;
  return opt ? B : A;
}

import i18nApi, { CLE_ONGLET_APRES_RECHARGEMENT } from '../i18n';
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter, AppState } from 'react-native';
// Modal de react-native, sauf sur l'ecran deplie d'un pliable Android :
// liste a gauche, page ouverte a droite (voir le fichier).
import Modal, { DeuxEcrans, AuMilieu } from '../components/DeuxEcrans';
import { View, ActivityIndicator, Animated, InputAccessoryView, Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from "@react-navigation/native";
import { startMenusSync } from "../services/menusSync";
import { startMenuReminders, onMenuReminderOpen, hasPendingMenuReminder } from "../services/menuReminders";
import { demarrerOtaRapide } from "../services/otaRapide";

import { PRODUCT_IMAGES, DEFAULT_PRODUCT, CATEGORY_FALLBACKS } from "../lib/productImages";
import { CURRENCIES } from "../data/currencies";
import { RATES_CACHE_MS, fetchLiveRates, getCurrencyWithLiveRate, getCachedLiveRates } from "../lib/rates";
import { BRAND, THEME } from "../components/commun/theme";
import { CurrencyContext } from "../components/commun/devise";
import { KEY_AUTH } from "../lib/constants";
import AuthScreen, { oublierModeAuth } from "../screens/auth/AuthScreen";
import FirstLaunchLanguage from "../screens/auth/FirstLaunchLanguage";
import { purgerSessionSiNonConservee } from "../screens/auth/session";
import MainNavigator from "./MainNavigator";
import MargesCotes from "./MargesCotes";
import { routeDOnglet } from "./onglets";











// Notification de rappel touchée : ouverture de l'onglet Menus, qui prend ensuite le bon écran.
const navRef = createNavigationContainerRef();
// Notification de commande touchée : Panier > Mes commandes puis détail (services/pushToucher.js).
brancherNavigation(navRef);
const ouvrirMenusDepuisRappel = () => {
  if (navRef.isReady() && hasPendingMenuReminder()) navRef.navigate('menus');
};
// Lien pearl-list://partage (notification touchée dans l'app Pearl Streets) :
// Ma Liste puis « Demandes de partage », au lancement comme app déjà ouverte.
const estLienPartage = (url) => typeof url === 'string' && /^pearl-list:\/\/+partage/i.test(url);
try {
  Linking.getInitialURL().then((u) => { if (estLienPartage(u)) ouvrirDemandesPartage(); }).catch(() => {});
  Linking.addEventListener('url', (e) => { if (estLienPartage(e && e.url)) ouvrirDemandesPartage(); });
} catch {}
// Onglet mémorisé avant un rechargement dû au changement de langue : lu une
// seule fois au démarrage, effacé aussitôt, ouvert quand la navigation est prête.
let ongletApresRechargement = AsyncStorage.getItem(CLE_ONGLET_APRES_RECHARGEMENT)
  .then((nom) => {
    if (nom) AsyncStorage.removeItem(CLE_ONGLET_APRES_RECHARGEMENT).catch(() => {});
    return nom;
  })
  .catch(() => null);
const ouvrirOngletApresRechargement = () => {
  const lecture = ongletApresRechargement;
  ongletApresRechargement = null;
  // Ancien nom mémorisé ('products', 'shops') : onglet Acheter, bon segment.
  if (lecture) lecture.then((nom) => {
    if (!nom || !navRef.isReady()) return;
    const r = routeDOnglet(nom);
    try { if (r.params === undefined) navRef.navigate(r.name); else navRef.navigate(r.name, r.params); } catch {}
  });
};
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: BRAND, background: "#fff" } };





// Toast and RepeatButton extracted to components/ui/























export default function App() {
  const { i18n: i18nApp } = useTranslation();
  const [isAuth, setIsAuth] = React.useState(null); // null = loading, true/false
  const [needLangChoice, setNeedLangChoice] = React.useState(null); // null = loading, true = 1er lancement
  const [proBlocked, setProBlocked] = React.useState(false);
  const [authVisible, setAuthVisible] = React.useState(false);
  const [authSignup, setAuthSignup] = React.useState(false);
  const authRetour = React.useRef(null);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_AUTH', (params) => {
      oublierModeAuth();
      setAuthSignup(params && params.signup === true);
      setAuthVisible(true);
    });
    return () => sub.remove();
  }, []);

  // Check if pro user needs verification
  React.useEffect(() => {
    (async () => {
      await purgerSessionSiNonConservee();
      const authRaw = await getSecureItem(KEY_AUTH);
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        if (auth.role === 'professionaluser' && !auth.isVerified) {
          setProBlocked(true);
        } else {
          setProBlocked(false);
        }
      }
    })();
  }, [isAuth]);

  const [currency, setCurrencyState] = React.useState(CURRENCIES[0]);
  const [liveRates, setLiveRates] = React.useState(null);

  // Fetch live exchange rates on mount and every 30 min
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const rates = await fetchLiveRates();
      if (mounted && rates) setLiveRates(rates);
    };
    load();
    const interval = setInterval(load, RATES_CACHE_MS);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // When liveRates arrive, update current currency rate
  React.useEffect(() => {
    if (liveRates && currency.code !== 'EUR') {
      const live = liveRates[currency.code];
      if (live && isFinite(live) && live !== currency.rate) {
        setCurrencyState(prev => ({ ...prev, rate: live }));
      }
    }
  }, [liveRates]);

  const fmtPrice = React.useCallback((eurAmount) => {
    const n = Number(eurAmount || 0) * currency.rate;
    const dec = currency.decimals !== undefined ? currency.decimals : 2;
    let formatted = n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    // Francais : virgule decimale (12,50 EUR).
    if ((i18nApp.language || '').startsWith('fr')) formatted = formatted.replace('.', ',');
    return `${formatted} ${currency.symbol}`;
  }, [currency, i18nApp.language]);

  const setCurrency = React.useCallback(async (cur) => {
    // Apply live rate if available
    const updated = getCurrencyWithLiveRate(cur, liveRates || getCachedLiveRates());
    setCurrencyState(updated);
    await AsyncStorage.setItem('APP_CURRENCY', cur.code);
  }, [liveRates]);

  React.useEffect(() => onMenuReminderOpen(ouvrirMenusDepuisRappel), []);

  // Destination en attente (lien pearl-list://partage) ouverte une fois la
  // session chargée, et au retour dans l'app. Déconnexion : la destination en
  // attente n'est plus pour ce compte. Ce binaire n'a pas les notifications de
  // commande en envoi direct : aucun enregistrement du téléphone.
  const etaitConnecte = React.useRef(false);
  React.useEffect(() => {
    definirConnexion(isAuth === true);
    if (isAuth === true) {
      consommerDestination();
    } else if (isAuth === false && etaitConnecte.current) {
      oublierDestination();
    }
    etaitConnecte.current = isAuth === true;
    if (isAuth !== true) return undefined;
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      consommerDestination();
    });
    return () => { sub.remove(); };
  }, [isAuth]);

  // Mises à jour OTA appliquées dès ce lancement quand c'est rapide (voir services/otaRapide.js).
  React.useEffect(() => demarrerOtaRapide(AppState), []);

  React.useEffect(() => {
    (async () => {
      await purgerSessionSiNonConservee();
      await purgeLegacyLocalAccounts();
      startMenusSync(AppState);
      startMenuReminders(AppState, i18nApp);
      const raw = await getSecureItem(KEY_AUTH);
      // 1er lancement = aucune langue enregistrée → on présentera le choix de langue.
      const savedLang = await AsyncStorage.getItem('APP_LANGUAGE');
      setNeedLangChoice(!savedLang);
      // Restaure la devise choisie AVANT de lever l'écran de chargement (setIsAuth) :
      // sinon un utilisateur non-EUR voit une frame de prix en € (taux 1) au cold boot.
      const savedCur = await AsyncStorage.getItem('APP_CURRENCY');
      if (savedCur) {
        const found = CURRENCIES.find(c => c.code === savedCur);
        if (found) {
          const updated = getCurrencyWithLiveRate(found, getCachedLiveRates());
          setCurrencyState(updated);
        }
      }
      setIsAuth(!!raw);
    })();
  }, []);

  if (isAuth === null || needLangChoice === null) {
    return (
      <View style={{flex:1, backgroundColor:THEME.bg, alignItems:'center', justifyContent:'center'}}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  if (needLangChoice) {
    return <MargesCotes><AuMilieu><StatusBar style="dark" /><FirstLaunchLanguage onDone={() => setNeedLangChoice(false)} /></AuMilieu></MargesCotes>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <StatusBar style="dark" />
    <CurrencyContext.Provider value={{ currency, setCurrency, fmtPrice }}>
      <DeuxEcrans>
      <MargesCotes>
      <NavigationContainer ref={navRef} onReady={() => { ouvrirOngletApresRechargement(); ouvrirMenusDepuisRappel(); consommerDestination(); }} theme={navTheme}>
        <MainNavigator onLogout={() => setIsAuth(false)} isAuth={isAuth} />
      </NavigationContainer>
      </MargesCotes>
      <Modal visible={authVisible} animationType="slide" onRequestClose={() => {
        if (authRetour.current && authRetour.current()) return;
        oublierModeAuth(); setAuthVisible(false);
      }}>
        <AuthScreen
          key={authSignup ? 'signup' : 'login'}
          initialIsLogin={!authSignup}
          retourRef={authRetour}
          onLogin={() => { oublierModeAuth(); setIsAuth(true); setAuthVisible(false); }}
          onClose={() => { oublierModeAuth(); setAuthVisible(false); }}
        />
      </Modal>
      </DeuxEcrans>
    </CurrencyContext.Provider>
    </GestureHandlerRootView>
  );
}
