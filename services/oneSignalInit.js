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

  const tag = '[OneSignal]';
  try {
    const moduleName = 'react-native-onesignal';
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(moduleName);
    const OneSignal = (mod && mod.OneSignal) || mod.default || mod;
    if (!OneSignal || typeof OneSignal.initialize !== 'function') {
      console.warn(`${tag} module loaded but OneSignal.initialize() missing — check SDK version`);
      return;
    }

    const extra =
      (Constants.expoConfig && Constants.expoConfig.extra) ||
      (Constants.manifest && Constants.manifest.extra) ||
      {};
    const appId = extra.oneSignalAppId || '';
    if (!appId) {
      console.warn(`${tag} no appId in expo.extra.oneSignalAppId — skipping init (expected in dev)`);
      return;
    }

    // Verbose native logs so Xcode / adb logcat surface the full registration flow.
    // Safe to leave enabled in TestFlight builds; a future commit can downgrade to WARN
    // once subscription is confirmed stable.
    if (OneSignal.Debug && typeof OneSignal.Debug.setLogLevel === 'function') {
      try { OneSignal.Debug.setLogLevel(6 /* VERBOSE */); } catch (_) {}
    }

    OneSignal.initialize(appId);
    console.log(`${tag} initialized — appId=${appId}`);

    // Ask for push permission once; OneSignal persists the answer.
    if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
      OneSignal.Notifications.requestPermission(true)
        .then((granted) => console.log(`${tag} permission result: granted=${granted}`))
        .catch((e) => console.warn(`${tag} requestPermission error: ${e && e.message ? e.message : e}`));
    }

    // Show notifications when app is in foreground (SDK v5 requires explicit display() call).
    if (OneSignal.Notifications && typeof OneSignal.Notifications.addForegroundWillDisplayListener === 'function') {
      OneSignal.Notifications.addForegroundWillDisplayListener((event) => {
        event.preventDefault();
        event.getNotification().display();
      });
    }

    // Surface the subscription id as soon as APNs token is registered server-side.
    // This is the single most useful diagnostic: if you never see this log,
    // OneSignal never received the device token (= 0 subscribers on dashboard).
    try {
      const sub = OneSignal.User && OneSignal.User.pushSubscription;
      if (sub && typeof sub.addEventListener === 'function') {
        sub.addEventListener('change', (event) => {
          const cur = (event && event.current) || {};
          console.log(
            `${tag} pushSubscription change — id=${cur.id || 'null'} token=${cur.token ? 'present' : 'absent'} optedIn=${cur.optedIn}`
          );
        });
      }
    } catch (subErr) {
      console.warn(`${tag} pushSubscription listener failed: ${subErr && subErr.message ? subErr.message : subErr}`);
    }
  } catch (e) {
    // react-native-onesignal not installed / native module missing. No crash,
    // but log so TestFlight builds don't fail silently like before.
    console.warn(`${tag} init failed: ${e && e.message ? e.message : e}`);
  }
}

export default initOneSignalOnce;
