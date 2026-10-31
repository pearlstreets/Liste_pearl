// Pont vers les listes existantes de l'application (clés de App.js : SG_LISTS,
// SG_ACTIVE_LIST, SG_ITEMS, SG_ITEMS__<id>). Jamais d'écriture sur une liste
// partagée avec moi, jamais d'écrasement d'une liste illisible.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { estObjet, arr } from './util';
import { toListItems, planFingerprint } from './shopping';
import { hasApplied, markApplied, loadSent } from './storage';

import {
  KEY_ITEMS,
  KEY_ACTIVE_LIST,
  DEFAULT_LIST_ID,
  listItemsKey,
  loadListItems,
} from '../listStore';

export { KEY_ITEMS, KEY_ACTIVE_LIST, DEFAULT_LIST_ID, listItemsKey };
export const KEY_LISTS = 'SG_LISTS';

let chain = Promise.resolve();
const enqueue = (fn) => {
  const r = chain.then(fn, fn);
  chain = r.then(
    () => undefined,
    () => undefined
  );
  return r;
};

async function readJson(key) {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, value: null };
  }
}

const isShared = (l) =>
  !!l && (l.shared === true || l.readOnly === true || l.share_id != null || l.shareId != null);

/** Mes listes (jamais les listes partagées) : [{ id, name }], avec l'id de la liste active. */
export async function readMyLists() {
  try {
    const r = await readJson(KEY_LISTS);
    let lists =
      r.ok && Array.isArray(r.value)
        ? r.value.filter((l) => estObjet(l) && l.id != null && !isShared(l))
        : [];
    if (lists.length === 0) lists = [{ id: DEFAULT_LIST_ID, name: '' }];
    let active = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
    if (!lists.some((l) => String(l.id) === String(active))) active = DEFAULT_LIST_ID;
    // La liste « par défaut » figure au registre comme les autres : elle reste proposée quand une autre est active.
    return {
      lists: lists.map((l) => ({ id: String(l.id), name: l.name || '' })),
      activeId: String(active),
    };
  } catch {
    return { lists: [{ id: DEFAULT_LIST_ID, name: '' }], activeId: DEFAULT_LIST_ID };
  }
}

/**
 * addToList(listId, lignes, { nameOf, fingerprint, force, idGen })
 * listId : id d'une de MES listes (null/undefined = liste active).
 * nameOf(ligne) -> nom localisé de l'ingrédient.
 * -> { status, added, merged, listId, fingerprint }
 * status : 'ok' | 'already' (même plan déjà ajouté, rien n'est fait) | 'refused_shared' |
 *          'unknown_list' | 'corrupt' (liste illisible, intacte) | 'empty' | 'error'
 */
export function addToList(listId, lignes, opts = {}) {
  return enqueue(async () => {
    const o = estObjet(opts) ? opts : {};
    const lines = arr(lignes).filter((l) => estObjet(l) && l.key);
    const fingerprint = o.fingerprint || planFingerprint(lines);
    const res = (status, extra) => ({
      status,
      added: 0,
      merged: 0,
      listId: listId == null ? null : String(listId),
      fingerprint,
      ...extra,
    });
    if (lines.length === 0) return res('empty');
    try {
      const rawLists = await readJson(KEY_LISTS);
      const reg =
        rawLists.ok && Array.isArray(rawLists.value)
          ? rawLists.value.filter((l) => estObjet(l) && l.id != null)
          : [];
      const activeId = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
      const id = listId === null || listId === undefined ? String(activeId) : String(listId);
      const entry = reg.find((l) => String(l.id) === id);
      if (isShared(entry)) return res('refused_shared', { listId: id });
      if (!entry && id !== DEFAULT_LIST_ID) return res('unknown_list', { listId: id });
      const isActive =
        id === String(activeId) ||
        (id === DEFAULT_LIST_ID && !reg.some((l) => String(l.id) === String(activeId)));
      if (!o.force && (await hasApplied(id, fingerprint))) return res('already', { listId: id });

      const key = listItemsKey(id);
      const cur = await loadListItems(id, activeId);
      if (!cur.ok) return res('corrupt', { listId: id });
      const existing = cur.items;
      const merged = toListItems(lines, o.nameOf, existing, {
        fingerprint,
        force: true,
        idGen: o.idGen,
        matchOf: o.matchOf,
      });
      const payload = JSON.stringify(merged.items);
      await AsyncStorage.setItem(key, payload);
      if (isActive && key !== KEY_ITEMS) await AsyncStorage.setItem(KEY_ITEMS, payload); // miroir lu par ListScreen
      await markApplied(id, fingerprint);
      return res('ok', { listId: id, added: merged.added, merged: merged.merged });
    } catch {
      return res('error');
    }
  });
}

/** Noms (minuscules) des articles d'une de MES listes ; null si la liste est illisible. */
export async function readListNames(listId) {
  try {
    const activeId = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
    const cur = await loadListItems(listId == null ? DEFAULT_LIST_ID : String(listId), activeId);
    if (!cur.ok) return null;
    return new Set(
      cur.items.filter(estObjet).map((b) =>
        String(b.name || '')
          .trim()
          .toLowerCase()
      )
    );
  } catch {
    return null;
  }
}

/**
 * Lignes à envoyer : paquets voulus moins ceux déjà envoyés ET toujours présents dans la liste
 * (un article supprimé de la liste entre-temps peut être renvoyé).
 */
export async function pendingLines(listId, lignes, nameOf) {
  const all = arr(lignes).filter((l) => estObjet(l) && l.key);
  const [sent, names] = await Promise.all([loadSent(listId), readListNames(listId)]);
  return all
    .map((l) => {
      let nm = '';
      try {
        nm = String((typeof nameOf === 'function' ? nameOf(l) : '') || l.key)
          .trim()
          .toLowerCase();
      } catch {
        nm = String(l.key).toLowerCase();
      }
      const was = names && !names.has(nm) ? 0 : Number(sent[l.key]) || 0;
      return { ...l, packs: l.packs - was };
    })
    .filter((l) => l.packs > 0);
}

export const KEY_SELECTED_PRODUCTS = 'SG_SELECTED_FOR_PRODUCTS';

/**
 * Prépare l'onglet Produits comme le fait « Trouver les produits exacts » de Ma Liste :
 * les articles non barrés et cochés de la liste active (ou de listId) y sont écrits.
 * Retourne le nombre d'articles préparés (0 : rien n'est écrit).
 */
export async function prefillProducts(listId) {
  try {
    const activeId = (await AsyncStorage.getItem(KEY_ACTIVE_LIST)) || DEFAULT_LIST_ID;
    const cur = await loadListItems(listId == null ? activeId : String(listId), activeId);
    if (!cur.ok) return 0;
    const chosen = cur.items
      .filter((it) => estObjet(it) && !it.crossed && (it.selected || it.checked))
      .map((it) => ({
        name: String(it.name || it.title || '').trim(),
        qty: Number(it.qty || it.quantity || 1),
        ...(Array.isArray(it.matchNames) && it.matchNames.length && it.matchFor === it.name
          ? { matchNames: it.matchNames, matchFor: it.name }
          : {}),
      }))
      .filter((it) => it.name);
    if (chosen.length === 0) return 0;
    await AsyncStorage.setItem(KEY_SELECTED_PRODUCTS, JSON.stringify(chosen));
    return chosen.length;
  } catch {
    return 0;
  }
}
