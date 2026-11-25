// Mesure d'usage anonyme de l'onglet Menus : des compteurs par jour et par langue, rien d'autre.
// L'envoi ne porte ni jeton, ni compte, ni identifiant d'appareil. Il est groupé, en arrière-plan,
// et ne bloque ni n'affiche jamais rien. La file est bornée : au-delà, les plus anciens tombent.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';
import { addDaysISO, mondayISO } from '../lib/menus/weeks';

export const USAGE_KEY = 'MENUS_USAGE';
export const USAGE_PATH = '/users/list-menus/usage/';
export const USAGE_QUEUE_MAX = 50; // aussi le maximum accepté par le serveur en un envoi
export const USAGE_DELAY_MS = 30000;
export const USAGE_TIMEOUT_MS = 8000;

// Paniers du menu express : un « panier_<enseigne> » par panier envoyé et un « euros_<enseigne> »
// qui porte le montant estimé arrondi à l'euro (n). Ni article, ni adresse, ni compte.
export const ENSEIGNES_PANIER = [
  'pearl',
  'leclerc',
  'auchan',
  'carrefour',
  'intermarche',
  'monoprix',
  'lidl',
];
export const EUROS_MAX = 2000;
const EVENEMENTS = [
  'plan_genere',
  'courses_envoyees',
  'retour_semaine_suivante',
  ...ENSEIGNES_PANIER.map((x) => `panier_${x}`),
  ...ENSEIGNES_PANIER.map((x) => `euros_${x}`),
];
const estEuros = (event) => typeof event === 'string' && event.startsWith('euros_');
const LANGUES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'pt', 'ru', 'sv', 'th', 'zh'];

const VIDE = { queue: [], lastWeek: null, returnWeek: null };

let file = Promise.resolve();
let timer = null;
let envoi = null;
let abonnement = null;

/** Une écriture à la fois : deux événements proches ne s'écrasent pas. */
function enFile(fn) {
  const p = file.then(fn);
  file = p.catch(() => {});
  return p.catch(() => null);
}

function langueDe(lang) {
  const base = String(lang || '')
    .toLowerCase()
    .split(/[-_]/)[0];
  return LANGUES.includes(base) ? base : 'en';
}

function valide(x) {
  if (!x || !EVENEMENTS.includes(x.event) || !LANGUES.includes(x.lang)) return false;
  if (!estEuros(x.event)) return x.n === undefined;
  return Number.isInteger(x.n) && x.n >= 1 && x.n <= EUROS_MAX;
}

async function lire() {
  try {
    const brut = JSON.parse(await AsyncStorage.getItem(USAGE_KEY));
    if (!brut || typeof brut !== 'object') return { enabled: true, ...VIDE };
    return {
      enabled: brut.enabled !== false,
      queue: Array.isArray(brut.queue) ? brut.queue.filter(valide).slice(-USAGE_QUEUE_MAX) : [],
      lastWeek: typeof brut.lastWeek === 'string' ? brut.lastWeek : null,
      returnWeek: typeof brut.returnWeek === 'string' ? brut.returnWeek : null,
    };
  } catch {
    return { enabled: true, ...VIDE };
  }
}

const ecrire = (st) => AsyncStorage.setItem(USAGE_KEY, JSON.stringify(st));

function ajouter(st, event, lang, n) {
  const x = { event, lang: langueDe(lang) };
  if (n !== undefined) x.n = n;
  st.queue = [...st.queue, x].slice(-USAGE_QUEUE_MAX);
}

function arreterMinuteur() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function programmer() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flushMenusUsage();
  }, USAGE_DELAY_MS);
}

export function trackMenusUsage(event, lang) {
  if (!EVENEMENTS.includes(event)) return Promise.resolve();
  return enFile(async () => {
    const st = await lire();
    if (!st.enabled) return;
    ajouter(st, event, lang);
    await ecrire(st);
    programmer();
  });
}

/** Panier du menu express envoyé chez une enseigne (ou chez les commerçants Pearl Streets). */
export function trackMenusBasket(store, euros, lang) {
  if (!ENSEIGNES_PANIER.includes(store)) return Promise.resolve();
  const n = Math.min(EUROS_MAX, Math.round(Number(euros) || 0));
  return enFile(async () => {
    const st = await lire();
    if (!st.enabled) return;
    ajouter(st, `panier_${store}`, lang);
    if (n >= 1) ajouter(st, `euros_${store}`, lang, n);
    await ecrire(st);
    programmer();
  });
}

/** Ouverture de l'onglet : compte un retour si la semaine ISO précédente a été visitée. */
export function noteMenusVisit(lang, now = new Date()) {
  return enFile(async () => {
    const st = await lire();
    if (!st.enabled) return;
    const lundi = mondayISO(now);
    if (st.lastWeek === lundi) return;
    if (st.lastWeek === addDaysISO(lundi, -7) && st.returnWeek !== lundi) {
      ajouter(st, 'retour_semaine_suivante', lang);
      st.returnWeek = lundi;
      programmer();
    }
    st.lastWeek = lundi;
    await ecrire(st);
  });
}

async function poster(events) {
  const ctrl = new AbortController();
  const garde = setTimeout(() => ctrl.abort(), USAGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${USAGE_PATH}`, {
      method: 'POST',
      credentials: 'omit', // aucun cookie de l'appareil ne doit accompagner les compteurs
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      signal: ctrl.signal,
    });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(garde);
  }
}

/** Un seul essai par passage : ce qui n'est pas parti attend le prochain événement ou lancement. */
export function flushMenusUsage() {
  if (envoi) return envoi;
  envoi = (async () => {
    try {
      const st = await enFile(lire);
      if (!st || !st.enabled || st.queue.length === 0) return;
      const lot = st.queue.slice(0, USAGE_QUEUE_MAX);
      const code = await poster(lot);
      const parti = code >= 200 && code < 300;
      const refuse = code === 400 || code === 413; // renvoyer le même lot ne servirait à rien
      if (!parti && !refuse) return;
      await enFile(async () => {
        const cur = await lire();
        cur.queue = cur.queue.slice(lot.length);
        await ecrire(cur);
      });
    } catch {
      // Jamais d'erreur visible.
    } finally {
      envoi = null;
    }
  })();
  return envoi;
}

export async function isMenusUsageEnabled() {
  const st = await enFile(lire);
  return !st || st.enabled;
}

/** Couper efface aussi ce qui attendait : rien ne part après la désactivation. */
export function setMenusUsageEnabled(enabled) {
  arreterMinuteur();
  return enFile(() => ecrire({ enabled: !!enabled, ...VIDE }));
}

/** À l'ouverture de l'onglet ; un seul abonnement, même si l'écran est remonté. */
export function startMenusUsage(appState) {
  programmer();
  if (abonnement || !appState) return;
  abonnement = appState.addEventListener('change', (etat) => {
    if (etat !== 'background' && etat !== 'inactive') return;
    arreterMinuteur();
    flushMenusUsage();
  });
}
