// Rappels des menus : notifications LOCALES uniquement, aucune poussée serveur.
//
// Le module natif est chargé par un require protégé : un binaire qui ne le contient pas (mise à
// jour OTA sur un ancien build, web) ne plante jamais, tout devient simplement sans effet. Chaque
// appel natif est aussi protégé, car le JS du module peut se charger sans sa partie native.
//
// Cet orchestrateur vit au niveau de l'application, pas dans l'onglet Menus : l'onglet n'est monté
// qu'à sa première ouverture, or le calendrier doit être remis à jour dès le lancement.
import { Platform } from 'react-native';
import { getIngredients, getRecipes, getTexts, normalizeLang } from '../lib/menus/recipes';
import { withMyTexts } from '../lib/menus/myRecipes';
import { loadMyRecipes, loadPlan, loadReminders, onMenusLocalWrite } from '../lib/menus/storage';
import {
  anyReminderOn,
  buildReminderSchedule,
  reminderTarget,
  REMINDER_ID_PREFIX,
} from '../lib/menus/reminders';
import { onMenusRemoteChange } from './menusSync';

export const REMINDER_CHANNEL_ID = 'menus-rappels';
export const REFRESH_DELAY_MS = 800;
const CLES_UTILES = ['plan', 'reminders', 'myRecipes'];

let notifications; // undefined = pas encore essayé, null = indisponible
let i18nRef = null;
let timer = null;
let file = Promise.resolve();
let generation = 0; // change à la déconnexion : un calcul en cours n'écrit plus rien
let demarre = false;
let enAttente = null; // destination d'une notification touchée, pas encore ouverte
const traitees = new Set();
const ouvertures = new Set();
const arrets = [];

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

const PERMISSION_ABSENTE = {
  available: false,
  granted: false,
  status: 'unavailable',
  canAskAgain: false,
};

function lirePermission(p) {
  if (!p || typeof p !== 'object') return PERMISSION_ABSENTE;
  const ios = p.ios && typeof p.ios === 'object' ? p.ios.status : undefined;
  // Sur iOS, l'autorisation provisoire (3) et éphémère (4) permettent aussi d'afficher.
  const granted = p.granted === true || p.status === 'granted' || ios === 3 || ios === 4;
  return {
    available: true,
    granted,
    status: granted ? 'granted' : String(p.status || 'undetermined'),
    canAskAgain: p.canAskAgain !== false,
  };
}

/** État de la permission sur CET appareil. Ne demande rien, ne lève jamais. */
export async function getMenuReminderPermission() {
  const nat = native();
  if (!nat) return PERMISSION_ABSENTE;
  try {
    return lirePermission(await nat.getPermissionsAsync());
  } catch {
    return PERMISSION_ABSENTE;
  }
}

/** Demande la permission : appelé uniquement quand on active un rappel. Ne lève jamais. */
export async function requestMenuReminderPermission() {
  const nat = native();
  if (!nat) return PERMISSION_ABSENTE;
  try {
    return lirePermission(
      await nat.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: true },
      })
    );
  } catch {
    return PERMISSION_ABSENTE;
  }
}

const traduire = (cle, opts) => {
  try {
    return i18nRef ? i18nRef.t(`menus.${cle}`, opts) : '';
  } catch {
    return '';
  }
};

async function creerCanal(nat) {
  if (Platform.OS !== 'android' || typeof nat.setNotificationChannelAsync !== 'function') return;
  try {
    await nat.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: traduire('reminders.channelName') || 'Pearl List',
      importance: nat.AndroidImportance ? nat.AndroidImportance.DEFAULT : 3,
    });
  } catch {}
}

async function nosRappels(nat) {
  try {
    const tout = await nat.getAllScheduledNotificationsAsync();
    return (Array.isArray(tout) ? tout : [])
      .map((x) => x && x.identifier)
      .filter((id) => typeof id === 'string' && id.startsWith(REMINDER_ID_PREFIX));
  } catch {
    return [];
  }
}

async function annuler(nat, ids) {
  for (const id of ids) {
    try {
      await nat.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

// Calendrier voulu : vide si aucun rappel n'est actif ou si la permission manque sur cet appareil.
async function calendrierVoulu(permission) {
  const reminders = await loadReminders();
  if (!permission.granted || !anyReminderOn(reminders)) return [];
  const [plan, myRecipes] = await Promise.all([loadPlan(), loadMyRecipes()]);
  const recipeById = new Map();
  for (const r of [...getRecipes(), ...(Array.isArray(myRecipes) ? myRecipes : [])])
    if (r && r.id) recipeById.set(r.id, r);
  const lang = normalizeLang(i18nRef && i18nRef.language);
  return buildReminderSchedule({
    reminders,
    plan,
    recipeById,
    ingredients: getIngredients(),
    texts: withMyTexts(getTexts(lang), myRecipes),
    t: traduire,
  });
}

function versExpo(nat, trigger) {
  const types = nat.SchedulableTriggerInputTypes || {};
  return {
    ...trigger,
    type: trigger.type === 'date' ? types.DATE || 'date' : types.WEEKLY || 'weekly',
    channelId: REMINDER_CHANNEL_ID,
  };
}

async function appliquer() {
  const nat = native();
  if (!nat) return;
  const gen = generation;
  try {
    const permission = await getMenuReminderPermission();
    const voulu = await calendrierVoulu(permission);
    if (gen !== generation) return;
    const ids = new Set(voulu.map((x) => x.identifier));
    const anciens = await nosRappels(nat);
    await annuler(
      nat,
      anciens.filter((id) => !ids.has(id))
    );
    if (voulu.length) await creerCanal(nat);
    for (const n of voulu) {
      if (gen !== generation) return;
      try {
        // Même identifiant = remplacement : aucun doublon à la reprogrammation.
        await nat.scheduleNotificationAsync({
          identifier: n.identifier,
          content: n.content,
          trigger: versExpo(nat, n.trigger),
        });
      } catch {}
    }
  } catch {
    // Un rappel manqué n'empêche jamais d'utiliser l'application.
  }
}

/** Remet le calendrier à jour tout de suite, un passage à la fois. Ne lève jamais. */
export function refreshMenuReminders() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  file = file.then(appliquer, appliquer);
  return file;
}

function refreshDiffere() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    refreshMenuReminders();
  }, REFRESH_DELAY_MS);
  if (timer && typeof timer.unref === 'function') timer.unref();
}

/** Déconnexion : plus aucun rappel sur l'appareil. Ne lève jamais. */
export async function cancelMenuReminders() {
  generation += 1;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  enAttente = null;
  const nat = native();
  if (!nat) return;
  await file.catch(() => {});
  file = file.then(async () => annuler(nat, await nosRappels(nat)));
  await file;
}

/* ------------------------------ notification touchée ------------------------------ */

function surReponse(reponse) {
  try {
    const nat = native();
    const n = reponse && reponse.notification;
    const req = n && n.request;
    if (!req) return;
    const action = reponse.actionIdentifier;
    if (nat && nat.DEFAULT_ACTION_IDENTIFIER && action && action !== nat.DEFAULT_ACTION_IDENTIFIER)
      return;
    const cible = reminderTarget(req.content && req.content.data);
    if (!cible) return;
    const trace = `${req.identifier}|${n.date}`;
    if (traitees.has(trace)) return; // lancement à froid : l'écouteur et la dernière réponse se recoupent
    traitees.add(trace);
    enAttente = cible;
    for (const fn of [...ouvertures]) {
      try {
        fn(cible);
      } catch {}
    }
  } catch {}
}

/** fn(destination) quand une notification de rappel vient d'être touchée. */
export function onMenuReminderOpen(fn) {
  ouvertures.add(fn);
  return () => ouvertures.delete(fn);
}
export const hasPendingMenuReminder = () => !!enAttente;
/** Rend la destination en attente et l'oublie. */
export function takePendingMenuReminder() {
  const c = enAttente;
  enAttente = null;
  return c;
}

/**
 * Au lancement : réponse aux notifications, reprogrammation, puis mise à jour à chaque changement
 * du plan ou des réglages, de la langue, et au retour dans l'application. Ne lève jamais.
 */
export function startMenuReminders(AppState, i18n) {
  if (i18n) i18nRef = i18n;
  const nat = native();
  if (!nat || demarre) return Promise.resolve();
  demarre = true;
  try {
    if (typeof nat.setNotificationHandler === 'function')
      nat.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    const sub = nat.addNotificationResponseReceivedListener(surReponse);
    if (sub && sub.remove) arrets.push(() => sub.remove());
  } catch {}
  try {
    Promise.resolve(nat.getLastNotificationResponseAsync())
      .then(surReponse)
      .catch(() => {});
  } catch {}
  arrets.push(
    onMenusLocalWrite((noms) => {
      if (noms.some((n) => CLES_UTILES.includes(n))) refreshDiffere();
    })
  );
  arrets.push(onMenusRemoteChange(refreshDiffere));
  if (i18n && typeof i18n.on === 'function') {
    i18n.on('languageChanged', refreshDiffere);
    arrets.push(() => i18n.off && i18n.off('languageChanged', refreshDiffere));
  }
  if (AppState && typeof AppState.addEventListener === 'function') {
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') refreshDiffere();
    });
    if (sub && sub.remove) arrets.push(() => sub.remove());
  }
  return refreshMenuReminders();
}

/** Pour les tests : remet le module à zéro. */
export function _resetMenuRemindersForTests() {
  while (arrets.length) {
    try {
      arrets.pop()();
    } catch {}
  }
  if (timer) clearTimeout(timer);
  timer = null;
  file = Promise.resolve();
  notifications = undefined;
  i18nRef = null;
  demarre = false;
  enAttente = null;
  traitees.clear();
  ouvertures.clear();
}
