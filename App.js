import './i18n';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { initOneSignalOnce } from './services/oneSignalInit';
import { BRAND } from './constants/brand';
import { KEY_AUTH, KEY_GUEST } from './constants/storageKeys';
import { CURRENCIES, fetchLiveRates, getCurrencyWithLiveRate, RATES_CACHE_MS, _liveRates } from './constants/currencies';
import CurrencyContext from './context/CurrencyContext';
import { CartProvider } from './context/CartContext';
import ErrorBoundary from './components/ErrorBoundary';
import { retryUnsyncedOrders } from './services/orders';
import MainNavigator from './navigation/MainNavigator';
import AuthScreen from './screens/AuthScreen';

// Initialize OneSignal once at module load. The helper is a no-op when the
// native module isn't bundled or when expo.extra.oneSignalAppId is empty,
// so the app continues to boot identically until a build with credentials
// ships. Required to be called before render so OneSignal can attach its
// notification handlers ahead of the first user interaction.
initOneSignalOnce();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: BRAND, background: "#fff" } };

export default function App() {
  const [isAuth, setIsAuth] = React.useState(null);
  const [isGuest, setIsGuest] = React.useState(false);
  const [proBlocked, setProBlocked] = React.useState(false);
  const [currency, setCurrencyState] = React.useState(CURRENCIES[0]);
  const [liveRates, setLiveRates] = React.useState(null);

  // Check if pro user needs verification
  React.useEffect(() => {
    (async () => {
      const authRaw = await AsyncStorage.getItem(KEY_AUTH);
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
    const formatted = n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formatted} ${currency.symbol}`;
  }, [currency]);

  const setCurrency = React.useCallback(async (cur) => {
    const updated = getCurrencyWithLiveRate(cur, liveRates || _liveRates);
    setCurrencyState(updated);
    await AsyncStorage.setItem('APP_CURRENCY', cur.code);
  }, [liveRates]);

  // Restore auth state, saved currency, and retry unsynced orders
  React.useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY_AUTH);
      const guest = await AsyncStorage.getItem(KEY_GUEST);
      setIsAuth(!!raw);
      if (!raw && guest === '1') setIsGuest(true);
      if (raw) retryUnsyncedOrders().catch(() => {});
      const savedCur = await AsyncStorage.getItem('APP_CURRENCY');
      if (savedCur) {
        const found = CURRENCIES.find(c => c.code === savedCur);
        if (found) {
          const updated = getCurrencyWithLiveRate(found, _liveRates);
          setCurrencyState(updated);
        }
      }
    })();
  }, []);

  if (isAuth === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  const handleLogin = () => { setIsAuth(true); setIsGuest(false); AsyncStorage.removeItem(KEY_GUEST); };
  const handleGuest = () => { setIsGuest(true); AsyncStorage.setItem(KEY_GUEST, '1'); };
  const handleLogout = () => {
    setIsAuth(false); setIsGuest(false);
    AsyncStorage.removeItem(KEY_GUEST);
  };

  if (!isAuth && !isGuest) {
    return (
      <ErrorBoundary>
        <CurrencyContext.Provider value={{ currency, setCurrency, fmtPrice }}>
          <AuthScreen onLogin={handleLogin} onContinueAsGuest={handleGuest} />
        </CurrencyContext.Provider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <CurrencyContext.Provider value={{ currency, setCurrency, fmtPrice }}>
        <CartProvider>
          <NavigationContainer theme={navTheme}>
            <MainNavigator
              onLogout={handleLogout}
              isGuest={isGuest}
              onLogin={handleLogin}
            />
          </NavigationContainer>
        </CartProvider>
      </CurrencyContext.Provider>
    </ErrorBoundary>
  );
}
