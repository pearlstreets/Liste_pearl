import AsyncStorage from '@react-native-async-storage/async-storage';

// Stockage chiffré (Keychain iOS, Keystore Android) des données sensibles :
// jetons de session, identité du compte, profil (téléphone, adresse, date de
// naissance). Même interface que AsyncStorage (chaînes), avec :
// - migration sans déconnexion : on lit d'abord le stockage chiffré, sinon
//   l'ancienne valeur AsyncStorage, qu'on recopie puis qu'on efface SEULEMENT
//   après relecture réussie ;
// - repli sûr : si le stockage chiffré est absent (web, tests) ou échoue, la
//   valeur reste dans AsyncStorage, personne n'est déconnecté ;
// - valeurs de plus de 2 Ko (limite conseillée par expo-secure-store) gardées
//   dans AsyncStorage.

let SecureStore = null;
try {
  // eslint-disable-next-line global-require
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

// Clés gérées ici (à effacer à la déconnexion et après une réinstallation).
export const SECURE_KEYS = ['MARKETPLACE_TOKENS', 'KEY_AUTH', 'KEY_PROFILE'];

const MAX_SECURE_BYTES = 2048;
// Le trousseau iOS survit à la désinstallation de l'app : ce repère, gardé dans
// AsyncStorage (effacé, lui, à la désinstallation), signale une installation
// neuve, auquel cas les restes de l'installation précédente sont effacés.
const INSTALL_MARKER = 'PEARL_SECURE_STORE_INSTALL';

const OPTIONS = SecureStore
  ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }
  : {};

let availability = null;
let installCheck = null;
let disabled = false;
const locks = {};

function utf8Bytes(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

async function secureAvailable() {
  if (!SecureStore || disabled) return false;
  if (!availability) {
    availability = (async () => {
      try {
        return !!(await SecureStore.isAvailableAsync());
      } catch {
        return false;
      }
    })();
  }
  if (!(await availability)) return false;
  if (!installCheck) {
    installCheck = (async () => {
      try {
        const marker = await AsyncStorage.getItem(INSTALL_MARKER);
        if (marker === null) {
          for (const k of SECURE_KEYS) {
            try {
              await SecureStore.deleteItemAsync(k, OPTIONS);
            } catch {}
          }
          await AsyncStorage.setItem(INSTALL_MARKER, '1');
        }
      } catch {
        // Repère illisible ou non écrit : on reste sur AsyncStorage pour cette
        // session (jamais d'effacement du trousseau sur une erreur).
        disabled = true;
      }
    })();
  }
  await installCheck;
  return !disabled;
}

// Une opération à la fois par clé : une migration en cours ne peut pas
// écraser une valeur plus récente (jeton tourné entre-temps).
function withLock(key, fn) {
  const prev = locks[key] || Promise.resolve();
  const run = prev.then(fn, fn);
  locks[key] = run.catch(() => {});
  return run;
}

async function readSecure(key) {
  try {
    return { value: await SecureStore.getItemAsync(key, OPTIONS) };
  } catch {
    try {
      // Une seconde tentative (trousseau momentanément indisponible).
      return { value: await SecureStore.getItemAsync(key, OPTIONS) };
    } catch {
      return { value: null };
    }
  }
}

export function getSecureItem(key) {
  return withLock(key, async () => {
    if (!(await secureAvailable())) return AsyncStorage.getItem(key);
    // Une valeur encore présente dans AsyncStorage est la plus récente
    // (ancienne version de l'app, ou repli après un échec d'écriture chiffrée) :
    // elle prime, et on tente de la migrer.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null && legacy !== undefined) {
      if (utf8Bytes(legacy) <= MAX_SECURE_BYTES) {
        try {
          await SecureStore.setItemAsync(key, legacy, OPTIONS);
          const check = await SecureStore.getItemAsync(key, OPTIONS);
          if (check === legacy) await AsyncStorage.removeItem(key);
        } catch {}
      }
      return legacy;
    }
    const secure = await readSecure(key);
    return secure.value ?? null;
  });
}

export function setSecureItem(key, value) {
  return withLock(key, async () => {
    if ((await secureAvailable()) && utf8Bytes(value) <= MAX_SECURE_BYTES) {
      try {
        await SecureStore.setItemAsync(key, value, OPTIONS);
        try {
          await AsyncStorage.removeItem(key);
        } catch {}
        return;
      } catch {}
    }
    await AsyncStorage.setItem(key, value);
    // La copie chiffrée, plus ancienne, ne doit pas masquer cette valeur.
    if (SecureStore && !disabled) {
      try {
        await SecureStore.deleteItemAsync(key, OPTIONS);
      } catch {}
    }
  });
}

export function removeSecureItem(key) {
  return withLock(key, async () => {
    if (await secureAvailable()) {
      try {
        await SecureStore.deleteItemAsync(key, OPTIONS);
      } catch {}
    }
    await AsyncStorage.removeItem(key);
  });
}

export async function removeSecureItems(keys) {
  await Promise.all(keys.map((k) => removeSecureItem(k).catch(() => {})));
}
