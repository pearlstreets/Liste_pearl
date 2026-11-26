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
// Exception, les jetons de session (CLES_SANS_CLAIR) : jamais en clair dans
// AsyncStorage sur un appareil qui a un trousseau. Au-delà de 2 Ko ils sont
// découpés sur plusieurs entrées chiffrées ; si le trousseau échoue, ils restent
// en mémoire seulement (perdus à la fermeture de l'app). Une ancienne copie
// AsyncStorage est relue une fois, réécrite chiffrée, puis effacée. Sans
// trousseau du tout (web, tests), AsyncStorage comme avant.

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
// Jetons : jamais en clair, découpés au-delà de 2 Ko.
const CLES_SANS_CLAIR = ['MARKETPLACE_TOKENS'];
const MARQUE_MORCEAUX = '__pearl_morceaux__:';
const MAX_MORCEAUX = 16;
// Repli en mémoire des clés sans clair quand le trousseau échoue.
const memoire = {};
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
            if (CLES_SANS_CLAIR.includes(k)) {
              for (let i = 0; i < MAX_MORCEAUX; i++) {
                try {
                  await SecureStore.deleteItemAsync(cleMorceau(k, i), OPTIONS);
                } catch {}
              }
            }
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

function cleMorceau(key, i) {
  return `${key}.part${i}`;
}

// Découpe en morceaux de 2 Ko au plus (en octets UTF-8).
function decouper(value) {
  const parts = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of value) {
    const b = utf8Bytes(ch);
    if (curBytes + b > MAX_SECURE_BYTES) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts;
}

function nbMorceaux(head) {
  if (typeof head !== 'string' || !head.startsWith(MARQUE_MORCEAUX)) return 0;
  const n = parseInt(head.slice(MARQUE_MORCEAUX.length), 10);
  return n > 0 && n <= MAX_MORCEAUX ? n : 0;
}

async function effacerMorceaux(key, depuis = 0) {
  for (let i = depuis; i < MAX_MORCEAUX; i++) {
    try {
      await SecureStore.deleteItemAsync(cleMorceau(key, i), OPTIONS);
    } catch {}
  }
}

// Écrit chiffré (découpé si besoin) et relit pour vérifier ; lève sur échec.
async function ecrireDecoupe(key, value) {
  const avant = nbMorceaux((await readSecure(key)).value);
  let apres = 0;
  if (utf8Bytes(value) <= MAX_SECURE_BYTES) {
    await SecureStore.setItemAsync(key, value, OPTIONS);
  } else {
    const parts = decouper(value);
    if (parts.length > MAX_MORCEAUX) throw new Error('valeur trop grande');
    for (let i = 0; i < parts.length; i++) {
      await SecureStore.setItemAsync(cleMorceau(key, i), parts[i], OPTIONS);
    }
    await SecureStore.setItemAsync(key, MARQUE_MORCEAUX + parts.length, OPTIONS);
    apres = parts.length;
  }
  if (avant > apres) await effacerMorceaux(key, apres);
  if ((await lireDecoupe(key)) !== value) throw new Error('relecture');
}

async function lireDecoupe(key) {
  const head = (await readSecure(key)).value;
  const n = nbMorceaux(head);
  if (!n) return head ?? null;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const part = (await readSecure(cleMorceau(key, i))).value;
    if (part === null || part === undefined) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function effacerDecoupe(key) {
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch {}
  await effacerMorceaux(key);
}

// Clés sans clair, sur un appareil qui a un trousseau.
function getSansClair(key) {
  return withLock(key, async () => {
    if (Object.prototype.hasOwnProperty.call(memoire, key)) return memoire[key];
    // Ancienne copie en clair : relue une fois, réécrite chiffrée, effacée.
    let legacy = null;
    try {
      legacy = await AsyncStorage.getItem(key);
    } catch {}
    if (legacy !== null && legacy !== undefined) {
      try {
        await ecrireDecoupe(key, legacy);
      } catch {
        memoire[key] = legacy;
      }
      try {
        await AsyncStorage.removeItem(key);
      } catch {}
      return legacy;
    }
    return lireDecoupe(key);
  });
}

function setSansClair(key, value) {
  return withLock(key, async () => {
    try {
      await ecrireDecoupe(key, value);
      delete memoire[key];
    } catch {
      // Trousseau en échec : mémoire seulement, et la copie chiffrée, plus
      // ancienne, est retirée pour ne pas resurgir.
      memoire[key] = value;
      await effacerDecoupe(key);
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  });
}

async function trousseauPresent() {
  await secureAvailable();
  if (!SecureStore || !availability) return false;
  return !!(await availability);
}

export function getSecureItem(key) {
  if (CLES_SANS_CLAIR.includes(key)) {
    return trousseauPresent().then((present) => (present ? getSansClair(key) : getSecureItemClassique(key)));
  }
  return getSecureItemClassique(key);
}

function getSecureItemClassique(key) {
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
  if (CLES_SANS_CLAIR.includes(key)) {
    return trousseauPresent().then((present) => (present ? setSansClair(key, value) : setSecureItemClassique(key, value)));
  }
  return setSecureItemClassique(key, value);
}

function setSecureItemClassique(key, value) {
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
    delete memoire[key];
    if (await secureAvailable()) {
      try {
        await SecureStore.deleteItemAsync(key, OPTIONS);
      } catch {}
    }
    if (CLES_SANS_CLAIR.includes(key) && (await trousseauPresent())) {
      await effacerMorceaux(key);
    }
    await AsyncStorage.removeItem(key);
  });
}

export async function removeSecureItems(keys) {
  await Promise.all(keys.map((k) => removeSecureItem(k).catch(() => {})));
}
