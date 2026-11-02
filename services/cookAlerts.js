// Mode cuisine : sons, vibrations, notifications de fin de cuisson et écran allumé.
//
// Tout est protégé, comme les rappels des menus : un binaire sans le module natif (mise à jour OTA
// sur un ancien build, web) ne plante jamais, la fonction devient simplement sans effet.
// - Sons : sur le web, fabriqués par le navigateur. Sur téléphone, les mêmes sons en fichiers
//   (assets/sounds/cuisine) quand le build contient expo-audio, avec une vibration ; sans lui, seule
//   la notification de fin de cuisson sonne (son du système), même écran verrouillé.
// - Notifications : programmées à l'heure de fin de chaque cuisson et de chaque minuteur, refaites
//   à chaque changement (pause, annulation, défaire), annulées à la fin du repas.
import { Platform, Vibration } from 'react-native';
import { getMenuReminderPermission, requestMenuReminderPermission } from './menuReminders';

export const COOK_ID_PREFIX = 'cuisine-';
export const COOK_CHANNEL_ID = 'menus-cuisine';

let notifications; // undefined = pas encore essayé, null = indisponible
function native() {
  if (notifications !== undefined) return notifications;
  notifications = null;
  if (Platform.OS === 'web') return notifications;
  try {
    const m = require('expo-notifications');
    if (m && typeof m.scheduleNotificationAsync === 'function') notifications = m;
  } catch {
    notifications = null;
  }
  return notifications;
}

let keepAwake; // idem
function awakeModule() {
  if (keepAwake !== undefined) return keepAwake;
  keepAwake = null;
  try {
    const m = require('expo-keep-awake');
    if (m && typeof m.activateKeepAwakeAsync === 'function') keepAwake = m;
  } catch {
    keepAwake = null;
  }
  return keepAwake;
}

const AWAKE_TAG = 'pearl-mode-cuisine';

/** Garde l'écran allumé pendant la cuisine. Ne lève jamais. */
export function keepScreenOn(on) {
  ecranOuvert = !!on;
  const m = awakeModule();
  if (!m) return;
  try {
    if (on) Promise.resolve(m.activateKeepAwakeAsync(AWAKE_TAG)).catch(() => {});
    else Promise.resolve(m.deactivateKeepAwake(AWAKE_TAG)).catch(() => {});
  } catch {}
}

/* ---------------------------------- sons ---------------------------------- */

let audio = null;
function webAudio() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    if (!audio) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      audio = new C();
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function tone(f, at, dur, type = 'sine', vol = 0.25) {
  const a = webAudio();
  if (!a) return;
  try {
    const t = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {}
}

// mêmes sons que la maquette v15
const TONES = {
  go: () => {
    tone(660, 0, 0.12);
    tone(990, 0.08, 0.18);
  },
  ok: () => {
    tone(784, 0, 0.12);
    tone(1047, 0.09, 0.12);
    tone(1319, 0.18, 0.25);
  },
  undo: () => {
    tone(523, 0, 0.12);
    tone(392, 0.1, 0.2);
  },
  pause: () => tone(440, 0, 0.15, 'triangle', 0.2),
  cancel: () => tone(330, 0, 0.2, 'triangle', 0.2),
  timer: () => {
    for (let i = 0; i < 3; i++) tone(1760, i * 0.32, 0.18, 'square', 0.12);
  },
  ready: () => {
    for (let r = 0; r < 2; r++) {
      tone(1319, r * 0.9, 0.5);
      tone(1047, r * 0.9 + 0.3, 0.7);
    }
  },
  bravo: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 3 ? 0.6 : 0.2)),
};

// Android suit le motif ; iOS vibre d'un coup, seulement pour ce qui demande d'agir
const PATTERNS = {
  go: [0, 25],
  ok: [0, 25, 60, 25],
  undo: [0, 40],
  pause: [0, 20],
  cancel: [0, 60],
  timer: [0, 300, 150, 300, 150, 300],
  ready: [0, 500, 200, 500],
  bravo: [0, 80, 60, 80, 60, 200],
};
const IOS_BUZZ = new Set(['timer', 'ready', 'bravo']);

// Téléphone : les mêmes sons en fichiers, joués par expo-audio quand le build le contient.
const FICHIERS = {
  go: require('../assets/sounds/cuisine/go.wav'),
  ok: require('../assets/sounds/cuisine/ok.wav'),
  undo: require('../assets/sounds/cuisine/undo.wav'),
  pause: require('../assets/sounds/cuisine/pause.wav'),
  cancel: require('../assets/sounds/cuisine/cancel.wav'),
  timer: require('../assets/sounds/cuisine/timer.wav'),
  ready: require('../assets/sounds/cuisine/ready.wav'),
  bravo: require('../assets/sounds/cuisine/bravo.wav'),
};

let lecteur; // undefined = pas encore essayé, null = indisponible
const lecteurs = {};
function audioModule() {
  if (lecteur !== undefined) return lecteur;
  lecteur = null;
  if (Platform.OS === 'web') return lecteur;
  try {
    const m = require('expo-audio');
    if (m && typeof m.createAudioPlayer === 'function') {
      lecteur = m;
      // respecte le mode silencieux, ne coupe pas la musique
      if (typeof m.setAudioModeAsync === 'function')
        Promise.resolve(
          m.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
        ).catch(() => {});
    }
  } catch {
    lecteur = null;
  }
  return lecteur;
}

function jouer(kind) {
  const m = audioModule();
  if (!m || !FICHIERS[kind]) return;
  try {
    if (!lecteurs[kind]) lecteurs[kind] = m.createAudioPlayer(FICHIERS[kind]);
    const p = lecteurs[kind];
    Promise.resolve(p.seekTo(0)).catch(() => {});
    p.play();
  } catch {}
}

let ecranOuvert = false;
/** Vrai quand l'écran de cuisine joue lui-même ses sons : la notification reste alors muette. */
export const cookScreenPlaysSounds = () => ecranOuvert && !!audioModule();

/** Son et vibration d'une action. Ne lève jamais. */
export function feedback(kind) {
  if (Platform.OS === 'web') {
    if (TONES[kind]) TONES[kind]();
    return;
  }
  jouer(kind);
  try {
    if (Platform.OS === 'ios') {
      if (IOS_BUZZ.has(kind)) Vibration.vibrate();
    } else if (PATTERNS[kind]) Vibration.vibrate(PATTERNS[kind]);
  } catch {}
}

/* ------------------------------ notifications ------------------------------ */

let canal = false;
async function creerCanal(nat, name) {
  if (canal || Platform.OS !== 'android' || typeof nat.setNotificationChannelAsync !== 'function')
    return;
  try {
    await nat.setNotificationChannelAsync(COOK_CHANNEL_ID, {
      name: name || 'Pearl List',
      importance: nat.AndroidImportance ? nat.AndroidImportance.HIGH : 4,
      sound: 'default',
      vibrationPattern: [0, 500, 200, 500],
    });
    canal = true;
  } catch {}
}

/** Demande la permission au premier lancement d'une cuisson, si elle n'a jamais été demandée. */
export async function askCookPermission() {
  try {
    const p = await getMenuReminderPermission();
    if (!p.available || p.granted || !p.canAskAgain) return p.granted;
    return (await requestMenuReminderPermission()).granted;
  } catch {
    return false;
  }
}

async function nosAlarmes(nat) {
  try {
    const tout = await nat.getAllScheduledNotificationsAsync();
    return (Array.isArray(tout) ? tout : [])
      .map((x) => x && x.identifier)
      .filter((id) => typeof id === 'string' && id.startsWith(COOK_ID_PREFIX));
  } catch {
    return [];
  }
}

let file = Promise.resolve();
let derniere = '';

/**
 * Programme les alarmes voulues : [{ id, inSec, title, body }]. Les autres alarmes du mode cuisine
 * sont annulées. Appels mis en file : jamais deux mises à jour en même temps.
 */
export function scheduleCookAlarms(list, channelName) {
  const voulu = (Array.isArray(list) ? list : []).filter((x) => x && x.inSec >= 1);
  const sig = JSON.stringify(voulu.map((x) => [x.id, Math.round(x.inSec / 5)]));
  if (sig === derniere) return file;
  derniere = sig;
  file = file
    .then(async () => {
      const nat = native();
      if (!nat) return;
      const p = await getMenuReminderPermission();
      const anciens = await nosAlarmes(nat);
      for (const id of anciens) {
        try {
          await nat.cancelScheduledNotificationAsync(id);
        } catch {}
      }
      if (!p.granted || !voulu.length) return;
      await creerCanal(nat, channelName);
      const types = nat.SchedulableTriggerInputTypes || {};
      for (const a of voulu) {
        try {
          await nat.scheduleNotificationAsync({
            identifier: `${COOK_ID_PREFIX}${a.id}`,
            content: {
              title: a.title,
              body: a.body,
              sound: 'default',
              data: { cuisine: true },
            },
            trigger: {
              type: types.TIME_INTERVAL || 'timeInterval',
              seconds: Math.max(1, Math.round(a.inSec)),
              repeats: false,
              channelId: COOK_CHANNEL_ID,
            },
          });
        } catch {}
      }
    })
    .catch(() => {});
  return file;
}

/** Annule toutes les alarmes du mode cuisine (repas fini ou recommencé). */
export function cancelCookAlarms() {
  return scheduleCookAlarms([]);
}

/** Pour les tests. */
export function _resetCookAlertsForTests() {
  notifications = undefined;
  keepAwake = undefined;
  lecteur = undefined;
  ecranOuvert = false;
  for (const k of Object.keys(lecteurs)) delete lecteurs[k];
  canal = false;
  derniere = '';
  file = Promise.resolve();
}
