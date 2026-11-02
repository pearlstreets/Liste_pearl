// Mises à jour OTA plus rapides.
//
// Par défaut (app.json, fallbackToCacheTimeout: 0), une mise à jour est téléchargée en fond au
// premier lancement et ne s'affiche qu'au lancement suivant. Ici :
// - au lancement, on vérifie tout de suite ; si la mise à jour est trouvée ET téléchargée en moins
//   de 5 s, on recharge aussitôt (l'utilisateur la voit dès ce lancement) ;
// - au retour au premier plan après plus de 30 min en arrière-plan, même vérification.
// On ne recharge jamais pendant le mode cuisine, un paiement ou une saisie au clavier : la mise à
// jour téléchargée s'appliquera simplement au prochain lancement (comportement d'avant).
// Tout est protégé : aucun plantage, aucun message, une seule vérification à la fois et au plus
// une toutes les 30 min. Sans expo-updates (web, développement), la fonction est sans effet.
import { Keyboard, Platform } from 'react-native';
import { cookScreenOpen } from './cookAlerts';

export const DELAI_MAX_MS = 5000;
export const INTERVALLE_MIN_MS = 30 * 60 * 1000;

/* ------------------------------ paiement en cours ------------------------------ */

const paiements = new Set();
/** Signale qu'un écran de paiement est ouvert (actif = true) ou fermé. Ne lève jamais. */
export function marquerPaiement(cle, actif) {
  try {
    if (actif) paiements.add(cle);
    else paiements.delete(cle);
  } catch {}
}

/** Vrai quand rien n'empêche de recharger l'app maintenant. */
export function rechargementPossible() {
  try {
    if (cookScreenOpen()) return false;
    if (paiements.size > 0) return false;
    if (Keyboard && typeof Keyboard.isVisible === 'function' && Keyboard.isVisible()) return false;
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------- expo-updates --------------------------------- */

function enDeveloppement() {
  try {
    return typeof __DEV__ !== 'undefined' && !!__DEV__;
  } catch {
    return false;
  }
}

function updatesModule() {
  if (Platform.OS === 'web' || enDeveloppement()) return null;
  try {
    const m = require('expo-updates');
    if (
      m &&
      m.isEnabled &&
      typeof m.checkForUpdateAsync === 'function' &&
      typeof m.fetchUpdateAsync === 'function' &&
      typeof m.reloadAsync === 'function'
    ) {
      return m;
    }
  } catch {}
  return null;
}

/* --------------------------------- vérification --------------------------------- */

let enCours = false;
let derniereVerification = 0;

/**
 * Cherche et télécharge une mise à jour ; recharge si tout tient dans DELAI_MAX_MS et si
 * rechargementPossible(). Renvoie 'recharge', 'aucune', 'trop-lent', 'occupe', 'bloque' ou
 * 'indisponible'. Ne lève jamais.
 */
export async function verifierEtRecharger() {
  const U = updatesModule();
  if (!U) return 'indisponible';
  if (enCours) return 'occupe';
  enCours = true;
  derniereVerification = Date.now();
  let minuteur;
  try {
    const delai = new Promise((resolve) => {
      minuteur = setTimeout(() => resolve('trop-lent'), DELAI_MAX_MS);
    });
    const travail = (async () => {
      const r = await U.checkForUpdateAsync();
      if (!r || !r.isAvailable) return 'aucune';
      const f = await U.fetchUpdateAsync();
      return f && f.isNew === false ? 'aucune' : 'prete';
    })();
    // Une fois le délai dépassé, le téléchargement continue en fond : la mise à jour
    // s'appliquera au prochain lancement. On évite seulement une erreur non rattrapée.
    travail.catch(() => {});
    const issue = await Promise.race([travail, delai]);
    if (issue !== 'prete') return issue;
    if (!rechargementPossible()) return 'bloque';
    await U.reloadAsync();
    return 'recharge';
  } catch {
    return 'aucune';
  } finally {
    clearTimeout(minuteur);
    enCours = false;
  }
}

/* ----------------------------------- démarrage ----------------------------------- */

let demarre = false;

/**
 * À appeler une fois au démarrage avec AppState. Vérifie au lancement, puis au retour au premier
 * plan après plus de 30 min en arrière-plan. Renvoie une fonction d'arrêt. Ne lève jamais.
 */
export function demarrerOtaRapide(AppState) {
  if (demarre || !updatesModule()) return () => {};
  demarre = true;
  let enFondDepuis = 0;
  let abonnement = null;
  try {
    verifierEtRecharger().catch(() => {});
    if (AppState && typeof AppState.addEventListener === 'function') {
      abonnement = AppState.addEventListener('change', (etat) => {
        try {
          if (etat === 'background' || etat === 'inactive') {
            if (!enFondDepuis) enFondDepuis = Date.now();
            return;
          }
          if (etat !== 'active') return;
          const depuis = enFondDepuis;
          enFondDepuis = 0;
          const maintenant = Date.now();
          if (!depuis || maintenant - depuis < INTERVALLE_MIN_MS) return;
          if (maintenant - derniereVerification < INTERVALLE_MIN_MS) return;
          verifierEtRecharger().catch(() => {});
        } catch {}
      });
    }
  } catch {}
  return () => {
    try {
      if (abonnement && typeof abonnement.remove === 'function') abonnement.remove();
    } catch {}
    demarre = false;
  };
}

export function _resetOtaRapidePourTests() {
  paiements.clear();
  enCours = false;
  derniereVerification = 0;
  demarre = false;
}
