/**
 * Push en envoi direct, sans OneSignal : jeton Firebase (Android) ou Apple
 * (iPhone) du téléphone, enregistré sur notre serveur, qui envoie lui-même
 * les notifications des commandes passées depuis Pearl List (même modèle que
 * l'app livreur, services/pushDirect.js de Livraison-app).
 *
 * Le serveur cible l'id du compte connecté (UserApp/api/notifications_views.py,
 * `_direct_external_id`), et choisit la langue de chaque notification d'après
 * la langue envoyée ici (celle de l'app, pas celle du compte).
 *
 * Tout est fail-open : sans autorisation, sans réseau ou sans module natif
 * (web, ancien binaire), l'app continue normalement, simplement sans push.
 * Les rappels des menus (services/menuReminders.js) ne passent pas par ici.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiJsonWithStatus } from './api';

export const APP_KIND = 'liste';
// Canal Android des notifications de commande : importance haute, donc
// bandeau et son. Le serveur l'impose à chaque envoi Firebase. Les canaux des
// rappels (« menus-rappels », canal par défaut d'app.json) et du mode cuisine
// ne sont pas touchés.
export const CANAL_ANDROID = 'commandes';

// Clés AsyncStorage hors du ménage de la déconnexion (services/auth.js,
// USER_KEYS_TO_REMOVE et isUserScopedKey) : les révocations en attente
// doivent survivre à l'effacement des données du compte.
export const CLE_APPAREIL = 'pushDirect.cleAppareil';
// Clés dont le retrait côté serveur a échoué (réseau, session perdue),
// rejouées au prochain enregistrement.
export const CLE_REVOCATIONS = 'pushDirect.revocationsEnAttente';
// Autorisation déjà demandée une fois sur ce téléphone : jamais redemandée.
export const CLE_PERMISSION_DEMANDEE = 'pushDirect.permissionDemandee';

// La base de l'API contient déjà /api/v1 (services/config.js).
const ROUTE_ENREGISTRER = '/notifications/device-tokens/direct/';
const ROUTE_RETIRER = '/notifications/device-tokens/current/?player_id=';
const DELAI_RETRAIT_MS = 4000;

const LANGUES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'pt', 'ru', 'sv', 'th', 'zh'];

let notifications; // undefined = pas encore essayé, null = indisponible
let _abonnementJeton = null;
let _enCours = null;
let _dejaDemande = false;

function plateforme() {
  try {
    return require('react-native').Platform.OS;
  } catch {
    return 'web';
  }
}

function native() {
  if (notifications !== undefined) return notifications;
  notifications = null;
  if (plateforme() === 'web') return notifications;
  try {
    const m = require('expo-notifications');
    if (m && typeof m.getDevicePushTokenAsync === 'function') notifications = m;
  } catch {
    notifications = null;
  }
  return notifications;
}

// Même lecture que les rappels : sur iOS, l'autorisation provisoire (3) et
// éphémère (4) permettent aussi d'afficher.
function autorise(p) {
  if (!p || typeof p !== 'object') return false;
  const ios = p.ios && typeof p.ios === 'object' ? p.ios.status : undefined;
  return p.granted === true || p.status === 'granted' || ios === 3 || ios === 4;
}

function langueCourante() {
  try {
    const lng = String(require('../i18n').default.language || '')
      .toLowerCase()
      .split(/[-_]/)[0];
    return LANGUES.includes(lng) ? lng : '';
  } catch {
    return '';
  }
}

function versionApp() {
  try {
    const C = require('expo-constants').default;
    return String((C && C.expoConfig && C.expoConfig.version) || '');
  } catch {
    return '';
  }
}

async function preparerCanal(nat) {
  if (plateforme() !== 'android') return;
  try {
    const i18n = require('../i18n').default;
    await nat.setNotificationChannelAsync(CANAL_ANDROID, {
      name: i18n.t('notifications.channelOrders'),
      importance: nat.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch {
    // Canal non créé : Android affiche quand même, dans le canal de repli.
  }
}

/**
 * Demande l'autorisation une seule fois (premier passage connecté), avec
 * exactement les options iOS des rappels. Refusée : jamais redemandée ici
 * (les rappels gardent leur propre demande). Renvoie true si permise. Ne
 * lève jamais.
 */
export async function demanderPermission() {
  const nat = native();
  if (!nat) return false;
  try {
    await preparerCanal(nat);
    const actuel = await nat.getPermissionsAsync();
    if (autorise(actuel)) return true;
    if (_dejaDemande || (actuel && actuel.canAskAgain === false)) return false;
    let dejaDemande = null;
    try {
      dejaDemande = await AsyncStorage.getItem(CLE_PERMISSION_DEMANDEE);
    } catch {
      /* illisible */
    }
    if (dejaDemande) return false;
    _dejaDemande = true;
    try {
      await AsyncStorage.setItem(CLE_PERMISSION_DEMANDEE, '1');
    } catch {
      /* sans gravité */
    }
    const reponse = await nat.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return autorise(reponse);
  } catch {
    return false;
  }
}

// Environnement Apple réellement signé dans le binaire : un build de
// développement reçoit par le bac à sable, tout autre build par la prod.
// Se tromper rendrait le jeton refusé (et révoqué) par Apple.
async function fournisseurIos() {
  try {
    const Application = require('expo-application');
    if (typeof Application.getIosPushNotificationServiceEnvironmentAsync === 'function') {
      const env = await Application.getIosPushNotificationServiceEnvironmentAsync();
      if (env === 'development') return 'apns_sandbox';
      if (env === 'production') return 'apns';
    }
  } catch {
    // Module absent : repli ci-dessous.
  }
  return __DEV__ ? 'apns_sandbox' : 'apns';
}

async function lireRevocations() {
  try {
    const brut = await AsyncStorage.getItem(CLE_REVOCATIONS);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

async function ecrireRevocations(liste) {
  try {
    if (liste.length) await AsyncStorage.setItem(CLE_REVOCATIONS, JSON.stringify(liste));
    else await AsyncStorage.removeItem(CLE_REVOCATIONS);
  } catch {
    /* sans gravité */
  }
}

async function marquerRevocation(cle) {
  if (!cle) return;
  const liste = await lireRevocations();
  if (!liste.includes(cle)) await ecrireRevocations([...liste, cle]);
}

// Retrait d'une clé côté serveur. true si c'est fait (2xx, ou 404 : déjà
// absente), false sinon (autre statut, réseau coupé, délai dépassé).
async function retirerCle(cle) {
  try {
    const res = await apiJsonWithStatus(
      'DELETE',
      ROUTE_RETIRER + encodeURIComponent(cle),
      undefined,
      { timeoutMs: DELAI_RETRAIT_MS }
    );
    return !!(res && (res.ok || res.status === 404));
  } catch {
    return false;
  }
}

// Rejouées AVANT l'envoi du jeton : la même clé peut ensuite revenir au
// compte connecté. Avec un autre compte, la route filtre par propriétaire
// et ne retire rien, la révocation est alors abandonnée.
async function rejouerRevocations() {
  const liste = await lireRevocations();
  if (!liste.length) return;
  const restantes = [];
  for (const cle of liste) {
    if (!(await retirerCle(cle))) restantes.push(cle);
  }
  await ecrireRevocations(restantes);
}

// Envoyé à CHAQUE passage, comme l'app livreur : le serveur est idempotent
// (même ligne, `revoked_at` remis à vide). Une ligne révoquée par le serveur
// sur un refus de Firebase ou d'Apple alors que le jeton du téléphone n'a pas
// changé (réglage faux corrigé ensuite) est ainsi réactivée au prochain retour
// dans l'app. Sauter l'envoi sur un jeton inchangé la laissait éteinte pour
// toujours, et le client ne recevait plus rien.
async function envoyerJeton(jeton) {
  if (!jeton || !jeton.data) return;
  const ios = plateforme() === 'ios';
  const corps = {
    app_kind: APP_KIND,
    platform: ios ? 'ios' : 'android',
    provider: ios ? await fournisseurIos() : 'fcm',
    push_token: String(jeton.data),
    app_version: versionApp(),
    langue: langueCourante(),
  };
  let ancienne = null;
  try {
    ancienne = await AsyncStorage.getItem(CLE_APPAREIL);
  } catch {
    /* illisible */
  }
  if (ancienne) corps.replaces_player_id = ancienne;
  const res = await apiJsonWithStatus('POST', ROUTE_ENREGISTRER, corps);
  const cle =
    res && res.ok && res.data && res.data.onesignal_player_id
      ? String(res.data.onesignal_player_id)
      : null;
  if (!cle) return;
  // Jeton renouvelé : l'ancienne ligne du serveur est retirée.
  if (ancienne && ancienne !== cle && !(await retirerCle(ancienne))) {
    await marquerRevocation(ancienne);
  }
  try {
    await AsyncStorage.setItem(CLE_APPAREIL, cle);
  } catch {
    /* nouvel envoi au prochain passage */
  }
}

/**
 * Enregistre ce téléphone pour le compte connecté. Le jeton part à chaque
 * appel (voir envoyerJeton), la langue courante avec. Ne demande jamais
 * l'autorisation (voir demanderPermission). Une seule promesse en vol. Ne
 * lève jamais.
 */
export function enregistrerAppareil() {
  if (_enCours) return _enCours;
  _enCours = (async () => {
    try {
      const nat = native();
      if (!nat) return;
      try {
        await rejouerRevocations();
      } catch {
        /* nouvel essai au prochain */
      }
      if (!autorise(await nat.getPermissionsAsync())) return;
      await preparerCanal(nat);
      // Jeton renouvelé par Firebase ou Apple : on renvoie le nouveau. Posé
      // avant l'envoi, pour rester en place même si celui-ci échoue.
      if (!_abonnementJeton && typeof nat.addPushTokenListener === 'function') {
        _abonnementJeton = nat.addPushTokenListener((nouveau) =>
          envoyerJeton(nouveau).catch(() => {})
        );
      }
      const jeton = await nat.getDevicePushTokenAsync();
      await envoyerJeton(jeton);
    } catch {
      // Pas de jeton (réseau, Play Services absent) : nouvel essai au
      // prochain retour dans l'app.
    } finally {
      _enCours = null;
    }
  })();
  return _enCours;
}

function arreterAbonnement() {
  if (_abonnementJeton) {
    try {
      _abonnementJeton.remove();
    } catch {
      /* déjà retiré */
    }
    _abonnementJeton = null;
  }
}

async function effacerLocal() {
  try {
    await AsyncStorage.removeItem(CLE_APPAREIL);
  } catch {
    /* sans gravité */
  }
}

/**
 * Retire ce téléphone du compte. À appeler AVANT d'effacer la session (la
 * route exige d'être connecté). Ne lève jamais : un échec n'empêche pas la
 * déconnexion, le retrait est alors rejoué au prochain enregistrement.
 */
export async function retirerAppareil() {
  try {
    arreterAbonnement();
    let cle = null;
    try {
      cle = await AsyncStorage.getItem(CLE_APPAREIL);
    } catch {
      /* illisible */
    }
    if (!cle) return;
    // Délai court : la déconnexion n'attend jamais plus de 4 secondes.
    if (!(await retirerCle(cle))) await marquerRevocation(cle);
    await effacerLocal();
  } catch {
    /* jamais bloquant */
  }
}

/** Pour les tests : remet le module à zéro. */
export function _resetPushDirectForTests() {
  notifications = undefined;
  _abonnementJeton = null;
  _enCours = null;
  _dejaDemande = false;
}
