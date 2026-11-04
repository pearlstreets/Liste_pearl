// Téléchargement du manifeste des photos de Menus : au démarrage de Menus, puis au plus toutes les
// 30 min tant que Menus est ouvert. Le dernier bon manifeste est gardé sur le téléphone : hors ligne,
// erreur réseau ou réponse invalide, il reste en place et rien ne casse.
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MANIFEST_URL,
  parseManifest,
  serializeManifest,
  setManifest,
  getManifest,
  getManifestVersion,
  subscribeManifest,
} from '../lib/menus/photoManifest';

export const MANIFEST_KEY = 'MENUS_PHOTOS_MANIFEST';
export const REFRESH_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 15000;
const MAX_OCTETS = 512 * 1024;

let charge = null; // promesse de lecture du manifeste gardé (une seule fois)
let dernierEssai = 0;
let enCours = null;

/** Lit le manifeste gardé sur le téléphone (une fois), s'il n'y en a pas déjà un plus récent en mémoire. */
export function loadStoredManifest() {
  if (!charge)
    charge = (async () => {
      try {
        const m = parseManifest(await AsyncStorage.getItem(MANIFEST_KEY));
        if (m && !getManifest()) setManifest(m);
      } catch {}
    })();
  return charge;
}

/**
 * Télécharge le manifeste si le dernier essai date d'au moins 30 min (ou force). Un manifeste
 * invalide, une erreur réseau ou une réponse non 200 ne changent rien. Rend true si un manifeste
 * valide a été pris.
 */
export async function refreshManifest({ force = false, now = Date.now(), fetchImpl } = {}) {
  if (enCours) return enCours;
  if (!force && dernierEssai && now - dernierEssai < REFRESH_MS) return false;
  dernierEssai = now;
  enCours = (async () => {
    const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) return false;
    let timer = null;
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      if (ctrl) timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const rep = await f(MANIFEST_URL, ctrl ? { signal: ctrl.signal } : undefined);
      if (!rep || !rep.ok) return false;
      const texte = await rep.text();
      if (typeof texte !== 'string' || texte.length > MAX_OCTETS) return false;
      const m = parseManifest(texte);
      if (!m) return false;
      await loadStoredManifest(); // le manifeste gardé ne repasse jamais par-dessus le nouveau
      setManifest(m);
      try {
        await AsyncStorage.setItem(MANIFEST_KEY, serializeManifest(m));
      } catch {}
      return true;
    } catch {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  })();
  try {
    return await enCours;
  } finally {
    enCours = null;
  }
}

/** Pour les tests. */
export function resetManifestService() {
  charge = null;
  dernierEssai = 0;
  enCours = null;
}

/** Menus ouvert : manifeste gardé, puis téléchargement, puis toutes les 30 min tant qu'il reste ouvert. */
export function usePhotoManifestRefresh(active) {
  useEffect(() => {
    if (!active) return undefined;
    loadStoredManifest().then(() => refreshManifest());
    const id = setInterval(() => refreshManifest(), REFRESH_MS);
    return () => clearInterval(id);
  }, [active]);
}

/** Numéro qui change à chaque nouveau manifeste : recalcule les photos à afficher. */
export function useManifestVersion() {
  return useSyncExternalStore(subscribeManifest, getManifestVersion, getManifestVersion);
}
