// Fiche recette complète : allergènes réglementaires, ustensiles, temps de préparation et de cuisson,
// basiques du placard, valeurs pour 100 g, conservation, difficulté. Tout est déduit des données des
// recettes (ingrédients, minuteurs des étapes, textes français des étapes) ; une valeur qu'on ne peut pas
// établir de façon sûre vaut null et n'est pas affichée. Fonctions pures, jamais d'exception.
import { estObjet, arr, norm } from './util';
import { DERIVES_ALLERGENE } from './allergens';
import { PIECE_G, vegGrams, cuisineOf } from './healthy';
import { noStepsText } from './packs';

/** Les 14 allergènes à déclaration obligatoire (règlement UE 1169/2011, annexe II), dans l'ordre officiel. */
export const ALLERGENES_14 = [
  'gluten',
  'crustaces',
  'oeuf',
  'poisson',
  'arachide',
  'soja',
  'lait',
  'fruits-a-coque',
  'celeri',
  'moutarde',
  'sesame',
  'sulfites',
  'lupin',
  'mollusques',
];
const UE = new Set(ALLERGENES_14);

// La base d'ingrédients range l'arachide avec les fruits à coque et les mollusques avec les crustacés
// (même exclusion pour le profil) : la fiche les sépare, comme l'étiquetage.
const ARACHIDE = new Set(['cacahuete', 'beurre-cacahuete']);
const MOLLUSQUES = new Set(['calamar', 'saint-jacques', 'palourde', 'sauce-huitre']);

function allergensOfKey(key, ing) {
  const out = [];
  for (const a of arr(ing && ing.allergens)) {
    let v = a;
    if (a === 'fruits-a-coque' && ARACHIDE.has(key)) v = 'arachide';
    if (a === 'crustaces' && MOLLUSQUES.has(key)) v = 'mollusques';
    // Lupin noté sur les pains et pâtes : farine qui en contient selon la marque, donc « peut contenir ».
    if (v === 'lupin') continue;
    if (UE.has(v)) out.push(v);
  }
  return out;
}

// « Peut contenir » : ingrédients qui en contiennent souvent selon la marque (moutarde, bouillon, curry...).
// La noix de coco n'est pas un fruit à coque pour l'Union européenne : pas d'alerte de ce côté.
const PEUT_CONTENIR = (() => {
  const m = new Map();
  for (const [a, keys] of Object.entries(DERIVES_ALLERGENE)) {
    if (!UE.has(a)) continue;
    for (const k of keys) {
      if (a === 'fruits-a-coque' && k.includes('coco')) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
  }
  return m;
})();

const lignes = (recipe) =>
  arr(estObjet(recipe) && recipe.ingredients).filter(
    (l) => estObjet(l) && typeof l.key === 'string' && l.key
  );

const ordre = (set) => ALLERGENES_14.filter((a) => set.has(a));

/**
 * allergensOf(recipe, ingredients) -> { contains: [..], mayContain: [..] } ou null.
 * contains : allergènes des ingrédients (lignes facultatives comprises) ; mayContain : présents selon la
 * marque. null si un ingrédient est absent de la base (on ne peut rien affirmer).
 */
export function allergensOf(recipe, ingredients) {
  if (!estObjet(ingredients)) return null;
  const ls = lignes(recipe);
  if (!ls.length) return null;
  const has = new Set();
  const may = new Set();
  for (const l of ls) {
    const ing = ingredients[l.key];
    if (!estObjet(ing)) return null;
    for (const a of allergensOfKey(l.key, ing)) has.add(a);
    for (const a of PEUT_CONTENIR.get(l.key) || []) may.add(a);
    if (arr(ing.allergens).includes('lupin')) may.add('lupin');
  }
  for (const a of has) may.delete(a);
  return { contains: ordre(has), mayContain: ordre(may) };
}

/* ------------------------------------- ustensiles ------------------------------------- */

// Ordre d'affichage et mots des étapes (texte français normalisé : minuscules, sans accents ni tirets).
export const USTENSILES = [
  ['four', /\b(four|enfourner|enfournez|enfourne)\b/],
  ['plat-four', /\bplats? (a gratin|allant au four|a four|de cuisson)\b/],
  ['plaque', /\b(plaque|plaques)\b/],
  ['moule', /\bmoule\b|\bmoules a (muffins|tartelettes|cannele|canneles|madeleines|manque)\b/],
  ['poele', /\b(poele|poeles|poeler|poelez|poelee|poelees)\b/],
  ['sauteuse', /\bsauteuse\b/],
  ['wok', /\bwok\b/],
  ['casserole', /\b(casserole|casseroles|bain marie)\b/],
  ['cocotte', /\b(cocotte|faitout|marmite)\b/],
  ['vapeur', /\b(a la vapeur|cuit vapeur|panier vapeur)\b/],
  ['micro-ondes', /\bmicro ondes?\b/],
  ['mixeur', /\b(mixer|mixez|mixe|mixee|mixes|mixees|mixeur|blender)\b/],
  ['robot', /\brobot\b/],
  ['fouet', /\b(fouet|fouetter|fouettez|fouette|fouettee|fouettes|fouettees|en neige)\b/],
  ['saladier', /\bsaladiers?\b/],
  ['passoire', /\b(passoire|egoutter|egouttez|egoutte|egouttes|egouttee|egouttees)\b/],
  ['rape', /\b(raper|rapez|zester|zestez)\b/],
  ['rouleau', /\brouleau a patisserie\b/],
];

/** utensilsOf(recipe, stepsFr) -> [clés de USTENSILES] lues dans les étapes françaises (et le minuteur four). */
export function utensilsOf(recipe, stepsFr) {
  const txt = arr(stepsFr)
    .map((s) => norm(s))
    .join(' | ');
  const kinds =
    estObjet(recipe) && estObjet(recipe.stepKinds) ? Object.values(recipe.stepKinds) : [];
  const out = [];
  for (const [key, re] of USTENSILES) {
    if (re.test(txt) || (key === 'four' && kinds.includes('four'))) out.push(key);
  }
  return out;
}

/* ---------------------------------------- temps ---------------------------------------- */

// Mots de cuisson : une étape qui en parle sans minuteur rend la répartition incertaine.
const CUISSON =
  /\b(cuire|cuisez|cuit|cuits|cuite|cuites|cuisson|revenir|dorer|mijoter|mijotez|bouillir|ebullition|enfourner|enfournez|griller|grillez|frire|rotir|poeler|poelez|saisir|saisissez|fondre|chauffer|chauffez|rechauffer|blanchir|fremissements?|caramelis\w*|reduire|braiser|toaster|torrefier)\b/;
// Étapes menées en parallèle : les minuteurs se chevauchent, leur somme n'est plus la durée de cuisson.
const PARALLELE =
  /\b(pendant ce temps|pendant la cuisson|pendant que|en attendant|en meme temps)\b/;
const DUREE = /\b\d+(?:[.,]\d+)?\s?(?:min|mn|minute|minutes|h|heure|heures)\b/g;

/**
 * timesOf(recipe, stepsFr) -> { total, prep, cook, rest } en minutes, ou null.
 * Cuisson et repos : minuteurs des étapes (four et feu ; repos). Préparation : le reste du temps total.
 * null dès qu'une étape parle de cuisson ou d'une durée sans minuteur, qu'une étape cite plusieurs durées
 * (seule la plus longue a un minuteur) ou que les minuteurs dépassent le temps total.
 */
export function timesOf(recipe, stepsFr) {
  if (!estObjet(recipe)) return null;
  const total = Number(recipe.timeMin);
  const steps = arr(stepsFr);
  if (!(total > 0) || !steps.length) return null;
  const timers = estObjet(recipe.stepTimers) ? recipe.stepTimers : {};
  const kinds = estObjet(recipe.stepKinds) ? recipe.stepKinds : {};
  let cook = 0;
  let rest = 0;
  for (let i = 0; i < steps.length; i++) {
    const t = norm(steps[i]);
    const sec = Number(timers[i]) || 0;
    if (PARALLELE.test(t)) return null;
    const nDur = (t.match(DUREE) || []).length;
    if (!(sec > 0)) {
      if (CUISSON.test(t) || nDur > 0) return null;
      continue;
    }
    if (nDur > 1) return null;
    const k = kinds[i];
    if (k === 'repos') rest += sec;
    else if (k === 'four' || k === 'feu') cook += sec;
    else return null;
  }
  for (const k of Object.keys(timers)) if (!(Number(k) < steps.length)) return null;
  const c = Math.round(cook / 60);
  const r = Math.round(rest / 60);
  if (!(c > 0) || total - c - r < 5) return null;
  return { total, prep: total - c - r, cook: c, rest: r };
}

/* -------------------------------------- difficulté -------------------------------------- */

const TECHNIQUE =
  /\b(en neige|bain marie|flamber|flambez|caramel|temperer|monter au beurre|emulsionner|abaisser|feuilletage|pocher|pochez|siphon|poche a douille|tamiser)\b/;

/**
 * difficultyOf(recipe, stepsFr) -> 1, 2 ou 3. Celle de la recette quand elle est connue ; sinon déduite :
 * nombre d'étapes, temps total et techniques (blancs en neige, bain-marie, caramel...). null sans étapes.
 */
export function difficultyOf(recipe, stepsFr) {
  if (!estObjet(recipe)) return null;
  const d = Number(recipe.difficulty);
  if (d === 1 || d === 2 || d === 3) return d;
  const steps = arr(stepsFr);
  if (!steps.length) return null;
  const time = Number(recipe.timeMin) || 0;
  let n = 1;
  if (steps.length > 6 || time > 60) n++;
  if (TECHNIQUE.test(steps.map((s) => norm(s)).join(' | '))) n++;
  return Math.min(3, n);
}

/* ----------------------------------- placard, restes ----------------------------------- */

/** pantryOf(recipe, ingredients) -> clés des basiques du placard (sel, poivre, huile...), sans doublon. */
export function pantryOf(recipe, ingredients) {
  if (!estObjet(ingredients)) return [];
  const out = [];
  for (const l of lignes(recipe)) {
    const ing = ingredients[l.key];
    if (estObjet(ing) && ing.pantry === true && !out.includes(l.key)) out.push(l.key);
  }
  return out;
}

/** storageOf(recipe) -> { fridgeDays, freezable } ou null (restes déconseillés ou durée inconnue). */
export function storageOf(recipe) {
  if (!estObjet(recipe) || recipe.leftoverOk !== true) return null;
  const days = Number(recipe.keepDays);
  if (!(Number.isInteger(days) && days > 0 && days <= 14)) return null;
  return { fridgeDays: days, freezable: recipe.freezable === true };
}

/* ------------------------------------- pour 100 g ------------------------------------- */

// Poids d'une pièce entièrement mangée (au-delà des légumes de PIECE_G). Citron, avocat, mangue... : la
// part utilisée varie (jus, zeste, noyau, peau), leur poids n'est pas connu.
const PIECE_EXTRA = {
  ail: 5,
  oeuf: 50,
  yaourt: 125,
  'pate-brisee': 230,
  'pate-feuilletee': 230,
  'pate-sablee': 230,
  laurier: 0,
  'gousse-vanille': 0,
};

// Ingrédients qui gonflent ou boivent l'eau de cuisson : le poids cru ne dit rien du plat servi.
const GONFLENT = new Set([
  'riz',
  'riz-arborio',
  'riz-basmati',
  'pates',
  'pates-lasagne',
  'nouilles',
  'nouilles-riz',
  'semoule',
  'boulgour',
  'quinoa',
  'polenta',
  'sarrasin',
  'lentilles',
  'lentilles-corail',
  'pois-chiches',
  'pois-casses',
  'haricots-rouges',
  'haricots-blancs',
  'flocons-avoine',
  'chia',
  'farine',
  'farine-pois-chiches',
  'galette-riz',
  'glacons',
  'agar',
  'gelatine',
]);
// De l'eau ajoutée dans les étapes (hors eau de fleur d'oranger, eau de coco) : poids final inconnu.
const EAU = /\beau\b(?! de fleur| de coco| fleur)|\bbouillon\b/;

function gramsOf(l) {
  const q = Number(l.qty);
  if (!(q > 0)) return null;
  switch (l.unit) {
    case 'g':
    case 'ml':
      return q;
    case 'kg':
    case 'l':
      return q * 1000;
    case 'cs':
      return q * 15;
    case 'cc':
      return q * 5;
    case 'u': {
      const p = PIECE_EXTRA[l.key] !== undefined ? PIECE_EXTRA[l.key] : PIECE_G[l.key];
      return p === undefined ? null : q * p;
    }
    default:
      return null;
  }
}

/**
 * per100Of(recipe, stepsFr) -> { kcal, protein, portionG } ou null.
 * Rapporte les valeurs par portion au poids des ingrédients crus d'une portion (lignes facultatives non
 * comptées). null si une quantité est inconnue (pièce sans poids, « à goût »), si un ingrédient gonfle à la
 * cuisson (riz, pâtes, légumineuses...), si les étapes ajoutent de l'eau, ou si le résultat est invraisemblable.
 */
export function per100Of(recipe, stepsFr) {
  const portionG = portionGramsOf(recipe, stepsFr);
  if (portionG === null) return null;
  const kcal = Number(recipe.kcal);
  const protein = Number(recipe.protein);
  const k100 = Math.round((kcal / portionG) * 100);
  if (k100 < 10 || k100 > 900) return null;
  return {
    kcal: k100,
    protein: protein >= 0 ? Math.round((protein / portionG) * 1000) / 10 : null,
    portionG: Math.round(portionG / 10) * 10,
  };
}

// Poids cru d'une portion (non arrondi) sur lequel per100Of rapporte ses valeurs, ou null (mêmes règles).
function portionGramsOf(recipe, stepsFr) {
  if (!estObjet(recipe)) return null;
  const kcal = Number(recipe.kcal);
  const serv = Number(recipe.servings);
  // sans les étapes, on ne sait pas si de l'eau est ajoutée
  if (!(kcal > 0) || !(serv > 0) || !arr(stepsFr).length) return null;
  let g = 0;
  for (const l of lignes(recipe)) {
    if (l.optional) continue;
    if (GONFLENT.has(l.key)) return null;
    const w = gramsOf(l);
    if (w === null) return null;
    g += w;
  }
  if (
    EAU.test(
      arr(stepsFr)
        .map((s) => norm(s))
        .join(' | ')
    )
  )
    return null;
  const portionG = g / serv;
  return portionG >= 50 ? portionG : null;
}

/* ------------------------------- valeurs nutritionnelles ------------------------------- */

// Lignes du tableau, dans l'ordre de l'étiquetage (règlement UE 1169/2011, annexe XV).
export const NUTRIMENTS = [
  'kj',
  'kcal',
  'lipides',
  'satures',
  'glucides',
  'sucres',
  'fibres',
  'proteines',
  'sel',
];
// Part du poids des ingrédients qui doit avoir une valeur pour qu'une ligne du tableau s'affiche.
export const SEUIL_COUVERTURE = 0.9;
// Écart toléré entre les kcal recalculées avec la table Ciqual et celles de la recette.
export const ECART_KCAL_MAX = 0.25;
// Hors du poids servant au seuil (quantités infimes ou sans nutriment) ; leurs valeurs restent comptées.
const HORS_SEUIL = new Set(['sel', 'poivre', 'eau', 'glacons']);
// Poids d'estimation d'une ligne de poids inconnu (par pièce), comptée comme non couverte dans le seuil.
const POIDS_INCONNU_G = 100;

// Table Ciqual chargée à la première fiche ouverte seulement (inutile ailleurs).
let NUTRIENTS = null;
function nutrientsDb() {
  if (NUTRIENTS === null) {
    try {
      NUTRIENTS = require('../../data/menus/nutrients.json');
    } catch {
      NUTRIENTS = false;
    }
  }
  return NUTRIENTS || null;
}

function nutriGramsOf(l, pieces) {
  const q = Number(l.qty);
  if (!(q > 0)) return null;
  switch (l.unit) {
    case 'g':
    case 'ml':
      return q;
    case 'kg':
    case 'l':
      return q * 1000;
    case 'cs':
      return q * 15;
    case 'cc':
      return q * 5;
    case 'u': {
      const p = Number(pieces[l.key]) > 0 ? Number(pieces[l.key]) : PIECE_G[l.key];
      return p > 0 ? q * p : null;
    }
    default:
      return null;
  }
}

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

function arrondi(o) {
  const out = {};
  for (const n of NUTRIMENTS) {
    const x = o[n];
    if (x === null || !Number.isFinite(x)) out[n] = null;
    else if (n === 'kj' || n === 'kcal') out[n] = Math.round(x);
    else out[n] = n === 'sel' ? r2(x) : r1(x);
  }
  return out;
}

/**
 * nutritionOf(recipe, nutrients, stepsFr) -> { perPortion, per100 } ou null.
 * Tableau de valeurs nutritionnelles d'après la table Ciqual (data/menus/nutrients.json) : chaque objet a
 * les clés de NUTRIMENTS, à null pour une ligne qu'on ne peut pas établir. Une ligne n'a de valeur que si au
 * moins 90 % du poids des ingrédients en a une (lignes facultatives exclues ; sel, poivre, eau et glaçons
 * hors du poids) ; une ligne de poids inconnu n'est pas comptée et compte comme non couverte. Énergie et
 * protéines : celles de la recette (kJ = kcal x 4,184), pour concorder avec le reste de l'application.
 * null pour une recette personnelle ou sans kcal, ou si les kcal recalculées avec la table s'écartent de
 * plus de 25 % de celles de la recette. per100 : seulement quand per100Of donne un résultat, rapporté au
 * même poids. Jamais d'exception.
 */
export function nutritionOf(recipe, nutrients, stepsFr) {
  try {
    if (!estObjet(recipe) || recipe.custom) return null;
    const kcal = Number(recipe.kcal);
    const serv = Number(recipe.servings);
    if (!(kcal > 0) || !(serv > 0)) return null;
    const db = estObjet(nutrients) && estObjet(nutrients.valeurs) ? nutrients.valeurs : null;
    if (!db) return null;
    const champs = arr(nutrients._champs);
    const idx = NUTRIMENTS.map((n) => champs.indexOf(n));
    if (idx.some((i) => i < 0)) return null;
    const pieces = estObjet(nutrients._poidsPiece) ? nutrients._poidsPiece : {};
    const sum = NUTRIMENTS.map(() => 0);
    const couvert = NUTRIMENTS.map(() => 0);
    let total = 0;
    for (const l of lignes(recipe)) {
      if (l.optional) continue;
      const w = nutriGramsOf(l, pieces);
      const seuil = !HORS_SEUIL.has(l.key);
      if (w === null) {
        if (seuil) total += POIDS_INCONNU_G * (Number(l.qty) > 0 ? Number(l.qty) : 1);
        continue;
      }
      if (seuil) total += w;
      const v = arr(db[l.key]);
      for (let i = 0; i < NUTRIMENTS.length; i++) {
        const x = v[idx[i]];
        if (typeof x !== 'number' || !Number.isFinite(x)) continue;
        sum[i] += (w * x) / 100;
        if (seuil) couvert[i] += w;
      }
    }
    if (!(total > 0)) return null;
    const ok = couvert.map((c) => c / total >= SEUIL_COUVERTURE);
    const iK = NUTRIMENTS.indexOf('kcal');
    // garde-fou : énergie Ciqual mal couverte ou trop loin des kcal de la recette, pas de tableau
    if (!ok[iK] || Math.abs(sum[iK] / serv - kcal) / kcal > ECART_KCAL_MAX) return null;
    const protein = Number(recipe.protein);
    const portion = {};
    NUTRIMENTS.forEach((n, i) => {
      portion[n] = ok[i] ? sum[i] / serv : null;
    });
    portion.kcal = kcal;
    portion.kj = kcal * 4.184;
    portion.proteines = protein >= 0 ? protein : null;
    const p100 = per100Of(recipe, stepsFr);
    const g = p100 ? portionGramsOf(recipe, stepsFr) : null;
    let per100 = null;
    if (p100 && g > 0) {
      const o = {};
      for (const n of NUTRIMENTS) o[n] = portion[n] === null ? null : (portion[n] / g) * 100;
      per100 = arrondi(o);
      // mêmes chiffres que la phrase « Pour 100 g » de la fiche
      per100.kcal = p100.kcal;
      per100.kj = Math.round(p100.kcal * 4.184);
      if (p100.protein !== null) per100.proteines = p100.protein;
    }
    return { perPortion: arrondi(portion), per100 };
  } catch {
    return null;
  }
}

/* ---------------------------------------- tout ---------------------------------------- */

/**
 * ficheInfos(recipe, { ingredients, stepsFr, nutrients }) -> tout ce que la fiche peut afficher en plus, chaque partie
 * à null (ou liste vide) quand elle ne peut pas être établie.
 */
export function ficheInfos(recipe, { ingredients, stepsFr: brut, nutrients } = {}) {
  if (!estObjet(recipe)) return null;
  // Étapes pas encore chargées (texte de remplacement) : tout ce qui en dépend reste inconnu.
  const sans = noStepsText('fr');
  const stepsFr = arr(brut).some((s) => typeof s !== 'string' || s === sans) ? [] : arr(brut);
  let veg = 0;
  let cuisine = null;
  try {
    veg = vegGrams(recipe, ingredients);
    cuisine = cuisineOf(recipe);
  } catch {
    /* repères santé indisponibles : non affichés */
  }
  return {
    times: timesOf(recipe, stepsFr),
    difficulty: difficultyOf(recipe, stepsFr),
    utensils: utensilsOf(recipe, stepsFr),
    pantry: pantryOf(recipe, ingredients),
    allergens: allergensOf(recipe, ingredients),
    per100: per100Of(recipe, stepsFr),
    nutrition: nutritionOf(recipe, nutrients === undefined ? nutrientsDb() : nutrients, stepsFr),
    storage: storageOf(recipe),
    vegPerPortion: veg > 0 ? veg : null,
    cuisine: cuisine || null,
  };
}
