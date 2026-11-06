// Toucher d'une notification de commande (push du serveur, services/pushDirect.js) :
// ouverture du Profil puis du détail de la commande concernée.
//
// Importé tout en haut d'App.js : l'abonnement est pris AU CHARGEMENT du module,
// pour capter aussi le toucher qui LANCE l'app (même modèle que l'app livreur).
// La destination est gardée en attente, 120 s au plus, jusqu'à ce que la
// navigation soit prête et la session rechargée (isAuth vrai). Un même toucher
// n'est traité qu'une fois, même après un rechargement du JS (changement de
// langue, pliage) : le dernier traité est gardé quelques minutes en stockage.
//
// Les rappels des menus (data.source === 'menus') et le mode cuisine
// (data.cuisine === true) ne passent jamais par ici : services/menuReminders.js
// garde la main sur eux.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLE_DERNIER_TAP = 'push.dernierTap';
export const DUREE_DERNIER_TAP = 5 * 60 * 1000;
export const DUREE_DESTINATION = 120 * 1000;
export const EVENEMENT_OUVRIR = 'PUSH_OUVRIR_COMMANDE';
// Demande de partage de liste (push ou lien pearl-list://partage) : Profil puis
// la fenêtre « Demandes de partage ».
export const EVENEMENT_PARTAGE = 'PUSH_OUVRIR_PARTAGE';
const ROUTE_PARTAGE = 'partage';
const KEY_ORDER_HISTORY = 'KEY_ORDER_HISTORY';
const ONGLET_PROFIL = 'profile';
const ROUTES = ['commande', 'suivi', 'plainte'];

let notifications; // undefined = pas encore essayé, null = indisponible
let _navRef = null;
let _connecte = false;
let _destination = null; // { route, client_order_id, external_order_id, at }
let _commandeAOuvrir = null; // { route, client_order_id, external_order_id }
let _partageAOuvrir = false;
const _vus = new Set();
const _arrets = [];

function native() {
  if (notifications !== undefined) return notifications;
  notifications = null;
  try {
    const m = require('expo-notifications');
    if (m && typeof m.addNotificationResponseReceivedListener === 'function') notifications = m;
  } catch {
    notifications = null;
  }
  return notifications;
}

function emetteur() {
  try {
    return require('react-native').DeviceEventEmitter || null;
  } catch {
    return null;
  }
}

const nonVide = (o) => !!o && typeof o === 'object' && Object.keys(o).length > 0;

/**
 * Données d'une push List : content.data, sinon iOS request.trigger.payload,
 * sinon Android request.trigger.remoteMessage.data. null pour tout le reste
 * (rappels, mode cuisine, autre app). Ne lève jamais.
 */
export function donneesPushListe(requete) {
  try {
    const content = requete && requete.content;
    const trigger = requete && requete.trigger;
    // Première source qui porte app 'liste' : content.data peut arriver réduit.
    const sources = [
      content && content.data,
      trigger && trigger.payload,
      trigger && trigger.remoteMessage && trigger.remoteMessage.data,
    ];
    const data = sources.find(
      (d) => nonVide(d) && (d.app === 'liste' || d.type === 'list_share_request')
    );
    if (!data || data.source === 'menus' || data.cuisine === true) return null;
    return data;
  } catch {
    return null;
  }
}

async function dejaTraite(cle) {
  try {
    const brut = await AsyncStorage.getItem(CLE_DERNIER_TAP);
    const dernier = brut ? JSON.parse(brut) : null;
    if (dernier && dernier.cle === cle && Date.now() - dernier.at < DUREE_DERNIER_TAP) return true;
    await AsyncStorage.setItem(CLE_DERNIER_TAP, JSON.stringify({ cle, at: Date.now() }));
  } catch {
    /* stockage illisible : traité */
  }
  return false;
}

/** Réponse à une notification (écouteur ou dernière réponse au lancement). */
export async function traiterReponse(reponse) {
  try {
    const nat = native();
    const notification = reponse && reponse.notification;
    const requete = notification && notification.request;
    if (!requete) return;
    const action = reponse.actionIdentifier;
    const parDefaut = nat && nat.DEFAULT_ACTION_IDENTIFIER;
    if (parDefaut && action && action !== parDefaut) return;
    const data = donneesPushListe(requete);
    if (!data) return;
    const cle = String(data.notification_id || data.event_key || requete.identifier || '');
    if (cle) {
      // Lancement à froid : l'écouteur et la dernière réponse se recoupent.
      if (_vus.has(cle)) return;
      _vus.add(cle);
      if (await dejaTraite(cle)) return;
    }
    // Réponse traitée : oubliée par le système (jamais pour un rappel).
    try {
      if (nat && typeof nat.clearLastNotificationResponseAsync === 'function')
        Promise.resolve(nat.clearLastNotificationResponseAsync()).catch(() => {});
    } catch {
      /* sans gravité */
    }
    _destination = {
      route: data.type === 'list_share_request' ? ROUTE_PARTAGE : String(data.route || ''),
      client_order_id: String(data.client_order_id || ''),
      external_order_id: String(data.external_order_id || ''),
      at: Date.now(),
    };
    consommerDestination();
  } catch {
    /* jamais bloquant */
  }
}

/** Navigation de l'app (App.js), pour ouvrir le Profil. */
export function brancherNavigation(navRef) {
  _navRef = navRef || null;
}

/** Session : la destination n'est ouverte que connecté (isAuth vrai). */
export function definirConnexion(connecte) {
  _connecte = connecte === true;
}

/**
 * Ouvre la destination en attente si la navigation est prête et la session
 * chargée. Appelée par l'écouteur, onReady de la navigation, le passage à
 * isAuth vrai et le retour dans l'app. Ne lève jamais.
 */
export function consommerDestination() {
  try {
    if (!_destination) return;
    if (Date.now() - _destination.at > DUREE_DESTINATION) {
      _destination = null;
      return;
    }
    if (!_connecte || !_navRef || typeof _navRef.isReady !== 'function' || !_navRef.isReady())
      return;
    const d = _destination;
    _destination = null;
    if (d.route === ROUTE_PARTAGE) {
      _commandeAOuvrir = null;
      _partageAOuvrir = true;
      _navRef.navigate(ONGLET_PROFIL);
      const ep = emetteur();
      if (ep) ep.emit(EVENEMENT_PARTAGE);
      return;
    }
    // Route inconnue : le Profil seul.
    _commandeAOuvrir = ROUTES.includes(d.route)
      ? {
          route: d.route,
          client_order_id: d.client_order_id,
          external_order_id: d.external_order_id,
        }
      : null;
    _navRef.navigate(ONGLET_PROFIL);
    const e = emetteur();
    if (e && _commandeAOuvrir) e.emit(EVENEMENT_OUVRIR);
  } catch {
    /* jamais bloquant */
  }
}

/**
 * Lien pearl-list://partage (app Pearl Streets, e-mail) : même destination
 * qu'une push de demande de partage. Ne lève jamais.
 */
export function ouvrirDemandesPartage() {
  _destination = { route: ROUTE_PARTAGE, client_order_id: '', external_order_id: '', at: Date.now() };
  consommerDestination();
}

/** Vrai une seule fois si les demandes de partage sont à ouvrir (Profil). */
export function prendrePartageAOuvrir() {
  const v = _partageAOuvrir;
  _partageAOuvrir = false;
  return v;
}

/** Rend la commande à ouvrir et l'oublie (Profil, au focus ou sur l'évènement). */
export function prendreCommandeAOuvrir() {
  const c = _commandeAOuvrir;
  _commandeAOuvrir = null;
  return c;
}

/** Déconnexion, données effacées : plus rien à ouvrir pour ce compte. */
export function oublierDestination() {
  _destination = null;
  _commandeAOuvrir = null;
  _partageAOuvrir = false;
}

/**
 * Commande locale visée, relue dans l'historique de l'appareil : d'abord par
 * son id local (client_order_id de la course), sinon par la commande
 * Marketplace (marketplaceOrderIds). null si introuvable (réinstallation,
 * autre téléphone).
 */
export async function trouverCommande(cible) {
  if (!cible) return null;
  let historique = [];
  try {
    const brut = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
    const liste = brut ? JSON.parse(brut) : [];
    historique = Array.isArray(liste) ? liste : [];
  } catch {
    return null;
  }
  const local = String(cible.client_order_id || '');
  if (local) {
    const o = historique.find((x) => x && String(x.id) === local);
    if (o) return o;
  }
  const externe = String(cible.external_order_id || '');
  if (externe) {
    const o = historique.find(
      (x) =>
        x &&
        (Array.isArray(x.marketplaceOrderIds) ? x.marketplaceOrderIds : [])
          .map(String)
          .includes(externe)
    );
    if (o) return o;
  }
  return null;
}

function demarrer() {
  const nat = native();
  if (nat) {
    try {
      const sub = nat.addNotificationResponseReceivedListener((r) => traiterReponse(r));
      if (sub && sub.remove) _arrets.push(() => sub.remove());
    } catch {
      /* sans module natif */
    }
    try {
      Promise.resolve(nat.getLastNotificationResponseAsync())
        .then((r) => {
          if (r) traiterReponse(r);
        })
        .catch(() => {});
    } catch {
      /* sans module natif */
    }
  }
  const e = emetteur();
  if (e && typeof e.addListener === 'function') {
    try {
      const sub = e.addListener('USER_DATA_CLEARED', oublierDestination);
      if (sub && sub.remove) _arrets.push(() => sub.remove());
    } catch {
      /* sans gravité */
    }
  }
}

/** Pour les tests : remet le module à zéro et le redémarre. */
export function _resetPushToucherForTests() {
  while (_arrets.length) {
    try {
      _arrets.pop()();
    } catch {
      /* déjà retiré */
    }
  }
  notifications = undefined;
  _navRef = null;
  _connecte = false;
  _destination = null;
  _commandeAOuvrir = null;
  _partageAOuvrir = false;
  _vus.clear();
  demarrer();
}

try {
  demarrer();
} catch {
  /* jamais bloquant */
}
