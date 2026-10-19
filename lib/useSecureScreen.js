// useSecureScreen : protège un écran sensible contre les captures.
//
// CIBLÉ, PAS GLOBAL : on ne protège que les écrans qui affichent un moyen de
// paiement (saisie de carte, cartes enregistrées). Partager une liste de
// courses par capture reste un usage normal.
//
// Android : FLAG_SECURE, la capture est bloquée et l'écran apparaît noir
// dans les applications récentes. iOS : le système ne permet pas de bloquer
// la capture d'écran ; expo-screen-capture masque au mieux l'enregistrement.
//
// MODALES ANDROID : une <Modal> React Native est une fenêtre séparée qui ne
// reprend FLAG_SECURE de l'activité qu'au moment où elle est créée. Le hook
// renvoie donc `pret` : la modale ne doit s'afficher qu'une fois la
// protection posée (`visible={visible && pret}`), sinon elle s'ouvrirait
// avant et resterait capturable.
//
// Chargement DÉFENSIF du module natif : s'il est absent (Expo Go ancien,
// binaire sans le module), le hook est inerte et `pret` vaut true, l'écran
// s'affiche normalement.
//
// La protection est levée à la sortie de l'écran, et la clé `tag` évite que
// la fermeture d'un écran retire la protection demandée par un autre.
import { useEffect, useState } from 'react';

let ScreenCapture = null;
try {
  const mod = require('expo-screen-capture');
  ScreenCapture =
    mod && typeof mod.preventScreenCaptureAsync === 'function' ? mod : mod?.default || null;
} catch (_e) {
  ScreenCapture = null;
}

const disponible = () =>
  !!(ScreenCapture && typeof ScreenCapture.preventScreenCaptureAsync === 'function');

/**
 * @param {string} tag Nom de l'écran, clé de la protection.
 * @param {boolean} [enabled=true] Protection active (ex. modale visible).
 * @returns {boolean} true quand l'écran peut s'afficher (protection posée,
 *   ou module indisponible).
 */
export default function useSecureScreen(tag, enabled = true) {
  const [pose, setPose] = useState(false);

  useEffect(() => {
    if (!enabled || !disponible()) return undefined;
    let annule = false;
    (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync(tag);
      } catch (_e) {
        // API indisponible : l'écran doit quand même s'afficher.
      }
      if (!annule) setPose(true);
    })();
    return () => {
      annule = true;
      setPose(false);
      try {
        const p = ScreenCapture.allowScreenCaptureAsync(tag);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_e) {
        // rien à faire
      }
    };
  }, [tag, enabled]);

  return !disponible() || pose;
}
