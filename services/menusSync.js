// Sauvegarde des menus sur le compte Pearl Streets. Le serveur stocke sans fusionner : chaque
// passage lit l'état du compte, fusionne clé par clé (lib/menus/sync.js), écrit le résultat ici,
// puis renvoie ce que le serveur n'a pas. Hors ligne ou en erreur, rien n'est perdu : les clés
// restent "à envoyer" et repartent à la prochaine écriture, au prochain lancement ou au prochain
// retour au premier plan. Aucune nouvelle tentative automatique, donc aucune boucle.
import { apiJsonWithStatus, getTokens } from './api';
import { getSecureItem } from './secureStorage';
import { SYNC_KEYS, lireEtatServeur, mergeSync, mergeFirstLogin } from '../lib/menus/sync';
import {
  applySyncEntries,
  clearAllMenus,
  confirmSyncSent,
  readSyncSnapshot,
  readSyncState,
  setMenusSyncListener,
} from '../lib/menus/storage';

const SYNC_PATH = '/users/list-menus/sync/';
export const PUSH_DELAY_MS = 3000;
export const FLUSH_TIMEOUT_MS = 2500;
export const MAX_PUT_ATTEMPTS = 3;

let timer = null;
let running = null;
let again = false;
let session = 0; // change à la déconnexion : tout échange en cours est alors abandonné
let appStateSub = null;
let lastAppState = null;

const mergeListeners = new Set();
const statusListeners = new Set();

/** fn({ keys, filled }) après une fusion qui a changé des données locales. */
export function onMenusRemoteChange(fn) {
  mergeListeners.add(fn);
  return () => mergeListeners.delete(fn);
}
export function onMenusSyncStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function notifyMerge(keys, filled) {
  if (keys.length === 0) return;
  for (const fn of [...mergeListeners]) {
    try {
      fn({ keys, filled });
    } catch {}
  }
}
function notifyStatus() {
  for (const fn of [...statusListeners]) {
    try {
      fn();
    } catch {}
  }
}

async function readAuth() {
  try {
    const raw = await getSecureItem('KEY_AUTH');
    const auth = raw ? JSON.parse(raw) : null;
    return auth && typeof auth === 'object' ? auth : null;
  } catch {
    return null;
  }
}

// Identifiant du compte connecté : uniquement s'il y a une session (jetons) et un identifiant.
async function currentOwner() {
  try {
    const tokens = await getTokens();
    if (!tokens || !tokens.access) return null;
  } catch {
    return null;
  }
  const auth = await readAuth();
  const id = auth && auth.id;
  return id === null || id === undefined || id === '' ? null : String(id);
}

/** État affiché dans les réglages. */
export async function loadMenusSyncStatus() {
  const owner = await currentOwner();
  if (!owner) return { connected: false, account: '', lastSyncAt: 0, pending: false };
  const auth = await readAuth();
  const st = await readSyncState();
  const same = st.owner === owner;
  return {
    connected: true,
    account: String((auth && (auth.email || auth.pseudo || auth.username)) || ''),
    lastSyncAt: same ? st.lastSyncAt : 0,
    pending: !same || Object.keys(st.dirty).length > 0,
  };
}

const pick = (data, keys) => {
  const out = {};
  for (const k of keys) out[k] = data[k];
  return out;
};
const stampsOf = (data) => {
  const out = {};
  for (const [k, e] of Object.entries(data)) if (e && Number.isFinite(e.u)) out[k] = e.u;
  return out;
};

// Un passage complet : lecture, fusion, écriture locale, envoi si le serveur n'est pas à jour.
async function cycle(sess, owner) {
  const alive = () => sess === session;
  const debut = await readSyncState();
  if (debut.owner && debut.owner !== owner) {
    // Données d'un autre compte encore sur l'appareil : jamais lues, jamais envoyées.
    await clearAllMenus();
    notifyMerge(SYNC_KEYS, []);
  }
  const res = await apiJsonWithStatus('GET', SYNC_PATH);
  if (!alive() || !res.ok) return;
  let remote = lireEtatServeur(res.data);
  if (!remote) return; // réponse inexploitable : surtout ne rien écraser

  for (let essai = 1; essai <= MAX_PUT_ATTEMPTS; essai++) {
    const snap = await readSyncSnapshot();
    if (!alive()) return;
    const { data, toApply, toPush } = snap.state.owner
      ? mergeSync(snap.entries, remote.data, snap.state)
      : mergeFirstLogin(snap.entries, remote.data);
    const applied = await applySyncEntries({
      owner,
      entries: pick(data, toApply),
      stamps: snap.state.stamps,
      dirty: toPush,
    });
    if (!applied.ok) return;
    notifyMerge(applied.applied, applied.filled);
    if (!alive()) return;
    // Clé saisie pendant la fusion : la version du compte reste à réunir au prochain passage.
    const recu = () => {
      const sent = stampsOf(data);
      for (const k of applied.skipped) delete sent[k];
      return sent;
    };

    if (toPush.length === 0) {
      await confirmSyncSent({ owner, sent: recu() });
      return;
    }
    const put = await apiJsonWithStatus('PUT', SYNC_PATH, {
      base_version: remote.version,
      data,
    });
    if (!alive()) return;
    if (put.ok) {
      await confirmSyncSent({ owner, sent: recu() });
      return;
    }
    if (put.status === 413) {
      // Trop volumineux pour le compte : tout reste sur l'appareil, rien n'est bloqué.
      console.warn('[menus] sauvegarde trop volumineuse, données gardées sur l appareil');
      return;
    }
    if (put.status !== 409) return;
    remote = lireEtatServeur(put.data);
    if (!remote) return;
  }
}

async function passage() {
  const sess = session;
  try {
    const owner = await currentOwner();
    if (owner && sess === session) await cycle(sess, owner);
  } catch {
    // Hors ligne ou serveur indisponible : reprise au prochain passage, sans message.
  }
}

/** Lance un passage tout de suite (ou un de plus après celui en cours). Ne lève jamais. */
export function requestMenusSync() {
  if (running) {
    again = true;
    return running;
  }
  running = passage().finally(() => {
    running = null;
    notifyStatus();
    if (again) {
      again = false;
      schedulePush();
    }
  });
  return running;
}

function schedulePush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    requestMenusSync();
  }, PUSH_DELAY_MS);
  if (timer && typeof timer.unref === 'function') timer.unref();
}

setMenusSyncListener(schedulePush);

/** Dernier envoi avant la déconnexion, borné dans le temps. Ne lève jamais. */
export async function flushMenusSync(timeoutMs = FLUSH_TIMEOUT_MS) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    if (!(await currentOwner())) return;
    const st = await readSyncState();
    if (st.owner && Object.keys(st.dirty).length === 0) return;
    let limite;
    await Promise.race([
      (async () => {
        if (running) await running;
        await requestMenusSync();
      })(),
      new Promise((r) => {
        limite = setTimeout(r, timeoutMs);
      }),
    ]);
    clearTimeout(limite);
  } catch {}
}

/** Déconnexion : abandonne tout échange en cours, il ne doit plus rien écrire sur l'appareil. */
export function resetMenusSyncSession() {
  session++;
  again = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  notifyStatus();
}

/** Lecture au lancement et au retour au premier plan, envoi au passage en arrière-plan. */
export function startMenusSync(AppState) {
  if (!appStateSub && AppState && typeof AppState.addEventListener === 'function') {
    lastAppState = AppState.currentState || 'active';
    appStateSub = AppState.addEventListener('change', (next) => {
      const prev = lastAppState;
      lastAppState = next;
      if (next === 'active' && prev !== 'active') requestMenusSync();
      else if (next === 'background' && timer) {
        clearTimeout(timer);
        timer = null;
        requestMenusSync();
      }
    });
  }
  return requestMenusSync();
}

/** Pour les tests : remet le module à zéro. */
export function _resetMenusSyncForTests() {
  resetMenusSyncSession();
  running = null;
  if (appStateSub && appStateSub.remove) appStateSub.remove();
  appStateSub = null;
  lastAppState = null;
  mergeListeners.clear();
  statusListeners.clear();
}
