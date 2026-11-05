/**
 * Provenance publicitaire de l'installation, envoyée dans l'en-tête
 * `X-Pearl-Provenance` des requêtes POST (le serveur la range sur le compte à
 * sa création : Users.signup_source / signup_campaign / signup_app).
 *
 *  - Android : provenance d'installation Play (`utm_source=...&gclid=...`),
 *    lue une seule fois par `expo-application`, déjà dans le binaire.
 *  - Toutes plateformes : paramètres utm_* / gclid / fbclid / ttclid de
 *    l'adresse qui a ouvert l'app (lien de pub), s'il y en a.
 *
 * Gardée dans le stockage de l'app. Ne fait JAMAIS échouer ni attendre une
 * requête : lecture au chargement du module, les requêtes lisent la mémoire.
 */
import { Linking, Platform } from 'react-native';

export const EN_TETE_PROVENANCE = 'X-Pearl-Provenance';
const CLE = '@pearlstreets:provenance-installation';
const CHAMPS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'ttclid',
];

let provenance = '';

const nettoyer = (brut) => {
  try {
    const texte = String(brut || '');
    const debut = texte.indexOf('?');
    const requete = (debut >= 0 ? texte.slice(debut + 1) : texte).split('#')[0];
    const garde = [];
    requete.split('&').forEach((paire) => {
      const [cle, valeur = ''] = paire.split('=');
      const nom = decodeURIComponent(cle || '').toLowerCase();
      if (CHAMPS.includes(nom) && valeur) {
        garde.push(`${nom}=${encodeURIComponent(decodeURIComponent(valeur).slice(0, 100))}`);
      }
    });
    return garde.join('&');
  } catch (_e) {
    return '';
  }
};

const stockage = () => {
  try {
    return require('@react-native-async-storage/async-storage').default || null;
  } catch (_e) {
    return null;
  }
};

const garder = async (valeur) => {
  if (!valeur) {
    return;
  }
  provenance = valeur;
  try {
    await stockage()?.setItem(CLE, valeur);
  } catch (_e) {}
};

const charger = async () => {
  try {
    const deja = await stockage()?.getItem(CLE);
    if (deja) {
      provenance = deja;
    }
    // Lien de pub qui a ouvert l'app : le plus récent l'emporte.
    try {
      const lien = nettoyer(await Linking.getInitialURL());
      if (lien) {
        await garder(lien);
        return;
      }
    } catch (_e) {}
    if (deja || Platform.OS !== 'android') {
      return;
    }
    const Application = require('expo-application');
    if (typeof Application?.getInstallReferrerAsync !== 'function') {
      return;
    }
    const brut = await Application.getInstallReferrerAsync();
    const net = brut && brut !== 'unknown' ? nettoyer(brut) : '';
    // Rien de connu : on note « vu » pour ne plus redemander.
    if (net) {
      await garder(net);
    } else {
      await stockage()?.setItem(CLE, 'utm_source=aucune');
      provenance = 'utm_source=aucune';
    }
  } catch (_e) {}
};

charger();

/** Query string à envoyer : app d'origine + provenance publicitaire connue. */
export const provenanceInstallation = () =>
  provenance && provenance !== 'utm_source=aucune' ? `app=list&${provenance}` : 'app=list';
