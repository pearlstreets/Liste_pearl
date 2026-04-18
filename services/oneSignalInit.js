/**
 * Initialize OneSignal exactly once at app start.
 *
 * The app id comes from `app.json` -> expo.extra.oneSignalAppId (or the
 * EAS build env profile if you override it there). When the id is empty
 * OR the native module isn't bundled (pre-rebuild), this is a silent
 * no-op and the app keeps working — no crash, no error log spam.
 *
 * Call this from App.js top-level so it runs before any screen mounts
 * (OneSignal needs to be initialized before .login() is useful).
 */
import Constants from 'expo-constants';

let _initialized = false;

export function initOneSignalOnce() {
  if (_initialized) return;
  _initialized = true;

  try {
    const moduleName = 'react-native-onesignal';
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(moduleName);
    const OneSignal = (mod && mod.OneSignal) || mod.default || mod;
    if (!OneSignal || typeof OneSignal.initialize !== 'function') return;

    const extra =
      (Constants.expoConfig && Constants.expoConfig.extra) ||
      (Constants.manifest && Constants.manifest.extra) ||
      {};
    const appId = extra.oneSignalAppId || '';
    if (!appId) {
      // Intentionally don't throw — dev builds commonly run without an
      // OneSignal app id. Silent so we don't nag during local testing.
      return;
    }

    OneSignal.initialize(appId);
    // Ask for push permission once; OneSignal persists the answer.
    if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
      OneSignal.Notifications.requestPermission(true).catch(() => {});
    }
  } catch (e) {
    // react-native-onesignal not installed / native module missing.
    // Silent — the app keeps booting normally.
  }
}

export default initOneSignalOnce;
