// Vraies boutiques Pearl Streets (getShopsByCategory) : UNE requête partagée par catégorie.
// Écran Produits, Boutiques et Menus lisent la même donnée ; jamais d'erreur levée vers l'écran.
import { getShopsByCategory } from '../services/products';

export const TTL_MS = 5 * 60 * 1000;
const store = new Map(); // slug -> { data, at }
const inflight = new Map(); // slug -> Promise
const listeners = new Map(); // slug -> Set<fn>

const fresh = (e) => !!e && Array.isArray(e.data) && e.data.length > 0 && Date.now() - e.at < TTL_MS;

/** Dernière donnée connue (même ancienne), ou null. Synchrone, aucun appel réseau. */
export function peekShops(slug) {
  const e = store.get(slug);
  return e ? e.data : null;
}

export function subscribeShops(slug, fn) {
  if (!listeners.has(slug)) listeners.set(slug, new Set());
  listeners.get(slug).add(fn);
  return () => listeners.get(slug) && listeners.get(slug).delete(fn);
}

function fetchShared(slug) {
  if (inflight.has(slug)) return inflight.get(slug);
  const p = Promise.resolve()
    .then(() => getShopsByCategory(slug))
    .then((data) => {
      const arr = Array.isArray(data) ? data : [];
      // Une réponse vide (hors ligne, serveur muet) n'écrase pas une donnée déjà connue.
      if (arr.length > 0 || !store.get(slug)) store.set(slug, { data: arr, at: Date.now() });
      (listeners.get(slug) || new Set()).forEach((fn) => {
        try {
          fn(store.get(slug).data);
        } catch {}
      });
      return arr;
    })
    .finally(() => inflight.delete(slug));
  inflight.set(slug, p);
  return p;
}

/**
 * loadShops(slug, { force, timeoutMs }) -> Promise<boutiques[]>.
 * Donnée récente en cache : renvoyée sans requête. Sinon une seule requête, partagée.
 * Rejette en cas d'échec ou de délai dépassé (la requête continue et alimente le cache).
 */
export function loadShops(slug, { force = false, timeoutMs = 0 } = {}) {
  const e = store.get(slug);
  if (!force && fresh(e)) return Promise.resolve(e.data);
  const p = fetchShared(slug);
  if (!(timeoutMs > 0)) return p;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    p.then(
      (d) => {
        clearTimeout(t);
        resolve(d);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      }
    );
  });
}

/** Pour les tests. */
export function resetShopsCache() {
  store.clear();
  inflight.clear();
  listeners.clear();
}
