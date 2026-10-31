// Ouverture de la fiche d'une boutique depuis un autre écran (Menus). L'onglet Boutiques
// peut ne pas être monté : la demande est gardée jusqu'à ce qu'il la prenne.
import { DeviceEventEmitter } from 'react-native';

export const OPEN_SHOP_EVENT = 'OPEN_SHOP';
let pending = null;

export function requestOpenShop(shop) {
  if (!shop || shop.id === undefined || shop.id === null) return false;
  pending = shop;
  try {
    DeviceEventEmitter.emit(OPEN_SHOP_EVENT);
  } catch {}
  return true;
}

export function takePendingShop() {
  const s = pending;
  pending = null;
  return s;
}

/** Abonnement de l'onglet Boutiques ; renvoie la fonction de désabonnement. */
export function onOpenShop(fn) {
  const sub = DeviceEventEmitter.addListener(OPEN_SHOP_EVENT, fn);
  return () => sub.remove();
}
