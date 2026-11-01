// Sens d'écriture de l'app (droite à gauche pour l'arabe).
//
// React Native lit le sens (I18nManager.isRTL) une seule fois, au chargement du
// JS. I18nManager.forceRTL l'enregistre côté natif pour le prochain chargement :
// quand il ne correspond pas à la langue, on recharge le JS une fois. Tout passe
// par le JS (aucune config native), donc par une simple mise à jour OTA.

export const LANGUES_RTL = ['ar'];

// Clé AsyncStorage : sens visé par le dernier rechargement ('rtl' ou 'ltr').
// Si, au lancement suivant, le sens n'a toujours pas changé, on ne recharge plus
// (pas de boucle de rechargement).
export const CLE_RECHARGEMENT = 'APP_RTL_RELOAD';

export function langueEstRTL(lang) {
  const base = String(lang || '').toLowerCase().split(/[-_]/)[0];
  return LANGUES_RTL.includes(base);
}

// Décision pure : faut-il recharger l'app pour appliquer le sens de `lang` ?
// - isRTL : valeur effective actuelle (I18nManager.isRTL)
// - dejaTente : sens ('rtl'/'ltr') déjà visé par un rechargement précédent
//   resté sans effet, ou null.
export function decisionSens(lang, isRTL, dejaTente) {
  const voulu = langueEstRTL(lang);
  const sens = voulu ? 'rtl' : 'ltr';
  if (!!isRTL === voulu) return { voulu, sens, recharger: false };
  if (dejaTente === sens) return { voulu, sens, recharger: false };
  return { voulu, sens, recharger: true };
}

let rechargementLance = false;

// Applique le sens de `lang` et recharge l'app si besoin (une seule fois).
// deps : { I18nManager, storage (AsyncStorage), recharger: () => Promise }
export async function appliquerSensEcriture(lang, deps) {
  const { I18nManager, storage, recharger } = deps;
  if (!I18nManager || !lang) return false;
  const voulu = langueEstRTL(lang);
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(voulu);
  } catch (_) {
    return false;
  }
  let dejaTente = null;
  try { dejaTente = storage ? await storage.getItem(CLE_RECHARGEMENT) : null; } catch (_) {}
  const d = decisionSens(lang, I18nManager.isRTL, dejaTente);
  if (!d.recharger) {
    // Sens déjà bon : on efface la trace pour permettre un prochain changement.
    if (!!I18nManager.isRTL === d.voulu && dejaTente && storage) {
      try { await storage.removeItem(CLE_RECHARGEMENT); } catch (_) {}
    }
    return false;
  }
  if (rechargementLance) return false;
  rechargementLance = true;
  try { if (storage) await storage.setItem(CLE_RECHARGEMENT, d.sens); } catch (_) {}
  try {
    await recharger();
    return true;
  } catch (_) {
    rechargementLance = false;
    return false;
  }
}

// Réservé aux tests.
export function _reinitialiserPourTests() {
  rechargementLance = false;
}
