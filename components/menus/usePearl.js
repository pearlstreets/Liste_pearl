// Données Pearl Streets pour Menus : chargées APRÈS l'ouverture, jamais bloquantes.
// Hors ligne ou sans réponse : null / vide, aucune erreur affichée.
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { peekShops, loadShops, subscribeShops } from '../../lib/shopsCache';
import { requestOpenShop } from '../../lib/openShop';
import { getSecureItem } from '../../services/secureStorage';

/** Vraies boutiques d'une catégorie (cache partagé). null = pas (encore) de donnée. */
export function usePearlShops(slug, enabled = true) {
  const [shops, setShops] = useState(() => peekShops(slug));
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const un = subscribeShops(slug, (d) => alive && setShops(d));
    const task = InteractionManager.runAfterInteractions(() => {
      loadShops(slug, { timeoutMs: 12000 }).then(
        (d) => alive && setShops(d),
        () => {}
      );
    });
    return () => {
      alive = false;
      un();
      if (task && task.cancel) task.cancel();
    };
  }, [slug, enabled]);
  return shops;
}

/** Ville / code postal déjà connus de l'appli (profil enregistré sur l'appareil). Aucune demande de position. */
export function useKnownPlace(enabled = true) {
  const [place, setPlace] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    (async () => {
      try {
        const raw = await getSecureItem('KEY_PROFILE');
        const p = raw ? JSON.parse(raw) : null;
        if (alive && p && (p.city || p.postalCode)) setPlace({ city: p.city || '', postalCode: p.postalCode || '' });
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);
  return place;
}

/** Ouvre la fiche existante de la boutique (onglet Boutiques). */
export function openShopFromMenus(navigation, shop) {
  if (!requestOpenShop(shop)) return;
  try {
    navigation.navigate('shops');
  } catch {}
}
