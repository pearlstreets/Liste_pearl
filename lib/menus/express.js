// Menu express : une phrase (tapée ou dictée au clavier) devient une demande de menu.
// « Prépare-moi 5 recettes pour la semaine, 30 minutes max, végétarien » -> { count: 5, maxTime: 30, diets: ['vegetarien'] }.
// Tout est lu sur place, sans aucun service extérieur. Ce qui n'est pas compris est simplement ignoré.
import { estObjet, arr } from './util';
import { normalizeProfile, cleanPrefs } from './profile';

export const EXPRESS_MIN = 1;
export const EXPRESS_MAX = 14;
export const EXPRESS_DEFAULT = 5;

const NOMBRES = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fourteen: 14,
};

// Sans accents, en minuscules, apostrophes et ponctuation remplacées par des espaces.
export function plain(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MOTS_REPAS =
  '(?:recettes?|repas|plats?|diners?|dejeuners?|soirs?|soirees?|recipes?|meals?|dinners?|lunch(?:es)?)';
const NOMBRE = `(\\d{1,2}|${Object.keys(NOMBRES).join('|')})`;

const lireNombre = (x) => (/^\d+$/.test(x) ? Number(x) : NOMBRES[x] || null);
const borne = (n, a, b) => Math.min(b, Math.max(a, n));

// Mots repérés -> réglages (régimes = tags exigés des recettes, goûts = prefs.likes, cuisines = prefs.cuisines).
const REGIMES = [
  [/\b(vegan|vegane|vegetalien(ne)?)s?\b/, 'vegan'],
  [/\b(vegetarien(ne)?s?|veggie|vege|sans viande|vegetarian)\b/, 'vegetarien'],
  [/\bsans gluten|gluten free\b/, 'sans-gluten'],
  [/\bsans (lactose|lait)|lactose free\b/, 'sans-lactose'],
  [/\bsans porc|no pork\b/, 'sans-porc'],
  [/\bhalal\b/, 'halal-possible'],
];
const GOUTS = [
  [/\b(poulet|volaille|dinde|chicken)\b/, 'volaille'],
  [/\b(boeuf|steak|beef)\b/, 'boeuf'],
  [/\b(poissons?|saumon|cabillaud|thon|fish)\b/, 'poisson'],
  [/\b(oeufs?|eggs?)\b/, 'oeufs'],
  [/\b(lentilles|pois chiches|legumineuses|haricots rouges)\b/, 'legumineuses'],
  [/\b(pates|pasta)\b/, 'pates'],
  [/\b(riz|rice)\b/, 'riz'],
];
const CUISINES_MOTS = [
  [/\b(italien(ne)?s?|italie|italian)\b/, 'italie'],
  [/\b(asiatiques?|asie|chinois(e)?|japonais(e)?|thai|asian)\b/, 'asie'],
  [/\b(indien(ne)?s?|inde|indian|curry)\b/, 'inde'],
  [/\b(orientale?s?|maghreb|marocain(e)?|libanais(e)?)\b/, 'maghreb-orient'],
  [/\b(mexicain(e)?s?|americain(e)?s?|mexican)\b/, 'ameriques'],
  [/\b(espagnol(e)?s?|portugais(e)?)\b/, 'espagne-portugal'],
  [/\b(grec(que)?s?|greek)\b/, 'grece'],
  [/\b(francais(e)?s?|french)\b/, 'france'],
];

/**
 * Lit une demande de menu. Renvoie toujours un objet complet :
 * { count, maxTime|null, persons|null, slot 'soir'|'midi'|'both', diets[], likes[], cuisines[], balanced, cheap, understood[] }
 * `understood` liste ce qui a été reconnu (pour le montrer à la personne).
 */
export function parseRequest(text) {
  const s = ` ${plain(text)} `;
  const out = {
    count: EXPRESS_DEFAULT,
    maxTime: null,
    persons: null,
    slot: 'soir',
    diets: [],
    likes: [],
    cuisines: [],
    balanced: false,
    cheap: false,
    understood: [],
  };

  // Nombre de recettes : « 5 recettes », « cinq repas », « recettes x 5 ».
  const mCount = s.match(new RegExp(`\\b${NOMBRE} (?:[a-z]+ ){0,2}${MOTS_REPAS}\\b`));
  if (mCount) {
    const n = lireNombre(mCount[1]);
    if (n) {
      out.count = borne(n, EXPRESS_MIN, EXPRESS_MAX);
      out.understood.push('count');
    }
  } else if (
    /\b(toute la semaine|pour la semaine|whole week|for the week)\b/.test(s) &&
    !/\b\d/.test(s)
  ) {
    out.count = 7;
    out.understood.push('count');
  }

  // Temps : « 30 min », « 30 minutes max », « moins de 20 minutes », « une demi heure », « rapide ».
  const mTime = s.match(/\b(\d{1,3}) ?(?:min|mins|minutes?|mn)\b/);
  const mHeure = s.match(/\b(une|1) ?(?:h|heure|hour)\b/);
  if (mTime) out.maxTime = borne(Number(mTime[1]), 10, 180);
  else if (/\bdemi heure|half an hour\b/.test(s)) out.maxTime = 30;
  else if (mHeure) out.maxTime = 60;
  else if (/\b(rapides?|vite|express|quick|fast)\b/.test(s)) out.maxTime = 30;
  if (out.maxTime) out.understood.push('time');

  // Personnes : « pour 4 personnes », « pour quatre » (mais « pour 5 recettes » n'en est pas).
  const mPers = s.match(
    new RegExp(`\\b(?:pour|for) ${NOMBRE}(?: (personnes?|pers|people|persons?|adultes?))?\\b`)
  );
  if (mPers) {
    const n = lireNombre(mPers[1]);
    const apres =
      s
        .slice(mPers.index + mPers[0].length)
        .trim()
        .split(' ')[0] || '';
    if (n && (mPers[2] || !new RegExp(`^${MOTS_REPAS}$`).test(apres))) {
      out.persons = borne(n, 1, 12);
      out.understood.push('persons');
    }
  }

  // Midi ou soir.
  const midi = /\b(midi|dejeuners?|lunch(es)?)\b/.test(s);
  const soir = /\b(soirs?|diners?|dinners?)\b/.test(s);
  if (midi && soir) out.slot = 'both';
  else if (midi) out.slot = 'midi';

  for (const [re, v] of REGIMES) if (re.test(s) && !out.diets.includes(v)) out.diets.push(v);
  // vegan implique végétarien : on ne garde que vegan
  if (out.diets.includes('vegan')) out.diets = out.diets.filter((d) => d !== 'vegetarien');
  if (out.diets.length) out.understood.push('diets');
  for (const [re, v] of GOUTS) if (re.test(s) && !out.likes.includes(v)) out.likes.push(v);
  if (out.likes.length) out.understood.push('likes');
  for (const [re, v] of CUISINES_MOTS)
    if (re.test(s) && !out.cuisines.includes(v)) out.cuisines.push(v);
  if (out.cuisines.length) out.understood.push('cuisines');
  if (/\b(equilibres?|equilibrees?|healthy|sain(e)?s?|leger(e)?s?|light|balanced)\b/.test(s)) {
    out.balanced = true;
    out.understood.push('balanced');
  }
  if (/\b(pas cher(e)?s?|economiques?|petit budget|cheap|budget)\b/.test(s)) {
    out.cheap = true;
    out.understood.push('cheap');
  }
  return out;
}

const CLE_REPAS = /^[0-6]-(midi|soir)$/;

/**
 * Créneaux de la demande : les N premiers soirs (ou midis), du lundi au dimanche ; au-delà de 7, midi et soir.
 * Menu confirmé : `req.keys` (créneaux gardés après les « Retirer ») passe avant le nombre.
 */
export function expressSlots(req) {
  const r = estObjet(req) ? req : {};
  const n = borne(Number(r.count) || EXPRESS_DEFAULT, EXPRESS_MIN, EXPRESS_MAX);
  const slots = {};
  for (let d = 0; d < 7; d++) {
    slots[`${d}-matin`] = false;
    slots[`${d}-midi`] = false;
    slots[`${d}-soir`] = false;
  }
  const gardes = arr(r.keys).filter((k) => CLE_REPAS.test(String(k)));
  if (gardes.length) {
    for (const k of gardes) slots[k] = true;
    return slots;
  }
  const ordre = [];
  if (r.slot === 'both' || n > 7) {
    for (let d = 0; d < 7; d++) ordre.push(`${d}-soir`, `${d}-midi`);
  } else {
    const sl = r.slot === 'midi' ? 'midi' : 'soir';
    for (let d = 0; d < 7; d++) ordre.push(`${d}-${sl}`);
  }
  for (const k of ordre.slice(0, n)) slots[k] = true;
  return slots;
}

/**
 * Profil utilisé pour composer le menu express : le foyer et ses interdits restent ceux de la personne,
 * la demande s'y ajoute (jamais l'inverse : une allergie du profil n'est jamais levée par la phrase).
 */
export function expressProfile(profile, req) {
  const p = normalizeProfile(profile);
  const r = estObjet(req) ? req : parseRequest('');
  const prefs = cleanPrefs(p.prefs);
  const out = {
    ...profile,
    ...p,
    slots: expressSlots(r),
    useLeftovers: false, // N recettes demandées = N plats différents à cuisiner
    kidsCantine: false,
    diets: [...new Set([...p.diets, ...arr(r.diets)])],
    prefs: cleanPrefs({
      ...prefs,
      balanced: prefs.balanced || !!r.balanced,
      likes: [...new Set([...prefs.likes, ...arr(r.likes)])],
      cuisines: [...new Set([...prefs.cuisines, ...arr(r.cuisines)])],
    }),
  };
  if (r.maxTime) out.maxTimeMin = p.maxTimeMin ? Math.min(p.maxTimeMin, r.maxTime) : r.maxTime;
  if (r.persons && !p.members) {
    out.adults = r.persons;
    out.children = 0;
  }
  // « pas cher » : seulement des recettes économiques (tag des recettes), le budget du profil reste le sien.
  if (r.cheap && !out.diets.includes('economique')) out.diets.push('economique');
  return out;
}

/** Recettes d'un menu express (dans l'ordre des jours), sans les repas libres ni les restes. */
export function draftMeals(plan) {
  return arr(plan && plan.meals).filter(
    (m) => estObjet(m) && m.recipeId && !m.leftoverOf && !m.free
  );
}

/** Retire un repas du brouillon (« Retirer »). */
export function dropDraftMeal(plan, key) {
  if (!estObjet(plan)) return plan;
  return { ...plan, meals: arr(plan.meals).filter((m) => !(estObjet(m) && m.key === key)) };
}
