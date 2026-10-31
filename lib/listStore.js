// Stockage des listes de l'application (clés de App.js).
// SG_ITEMS reste le MIROIR de la liste active (lu par l'ajout au panier). Chaque liste, y compris
// « default », a désormais sa clé canonique : SG_ITEMS__<id>. Avant, « default » n'avait que
// SG_ITEMS, écrasé au passage vers une autre liste (perte de données).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEY_ITEMS = 'SG_ITEMS';
export const KEY_ACTIVE_LIST = 'SG_ACTIVE_LIST';
export const DEFAULT_LIST_ID = 'default';
export const listItemsKey = (id) => `SG_ITEMS__${id || DEFAULT_LIST_ID}`;

/**
 * Lit les articles canoniques d'une liste. Migration prudente : si la clé canonique de « default »
 * n'existe pas encore et que « default » est la liste active, SG_ITEMS (stockage historique) est
 * repris tel quel et copié dans la clé canonique. Jamais d'écrasement d'une clé existante.
 * -> { ok, items } (ok=false : contenu illisible, rien n'est écrit)
 */
export async function loadListItems(id, activeId) {
  const listId = id || DEFAULT_LIST_ID;
  const key = listItemsKey(listId);
  let raw = await AsyncStorage.getItem(key);
  if ((raw === null || raw === undefined) && listId === DEFAULT_LIST_ID) {
    const act = activeId || DEFAULT_LIST_ID;
    if (act === DEFAULT_LIST_ID) {
      const legacy = await AsyncStorage.getItem(KEY_ITEMS);
      if (legacy !== null && legacy !== undefined) {
        try {
          if (!Array.isArray(JSON.parse(legacy))) return { ok: false, items: [] };
          await AsyncStorage.setItem(key, legacy);
          raw = legacy;
        } catch {
          return { ok: false, items: [] };
        }
      }
    }
  }
  if (raw === null || raw === undefined || raw === '') return { ok: true, items: [] };
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? { ok: true, items: v } : { ok: false, items: [] };
  } catch {
    return { ok: false, items: [] };
  }
}

/** Écrit les articles de la liste active : clé canonique ET miroir SG_ITEMS (jamais une autre liste). */
export async function persistActiveItems(activeId, items) {
  const payload = JSON.stringify(Array.isArray(items) ? items : []);
  await AsyncStorage.setItem(listItemsKey(activeId), payload);
  await AsyncStorage.setItem(KEY_ITEMS, payload);
}
