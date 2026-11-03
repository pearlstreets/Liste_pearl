// Besoins nutritionnels estimés de chaque personne du foyer (facultatif). Module pur : aucun React,
// aucun stockage, jamais d'exception. Estimation indicative, pas un avis médical.
//
// Une personne (profile.members[i]) : { id, name, age, sex 'f'|'m', heightCm, weightKg,
// activity 'faible'|'moderee'|'elevee'|'intense', goal 'perdre'|'maintenir'|'prendre', child }.
// Tout est facultatif (null si absent). `child` ne sert que si l'âge manque (personne ajoutée comme
// « enfant » sans âge). Enfant = moins de 12 ans (âge de la cantine du primaire, et des petites
// portions de l'ancien réglage « enfants ») ; de 12 à 17 ans, adolescent : portion calculée, sans régime.
import { estObjet, arr, coupeTexte } from './util';

export const SEXES = ['f', 'm'];
export const ACTIVITIES = ['faible', 'moderee', 'elevee', 'intense'];
export const GOALS = ['perdre', 'maintenir', 'prendre'];
export const CHILD_AGE = 12; // strictement moins de 12 ans = enfant
export const ADULT_AGE = 18; // l'objectif (perdre, prendre) ne s'applique qu'à partir de 18 ans
export const MEMBERS_MAX = 12;
/** Besoins du jour d'un adulte de référence : une portion des recettes vaut 1 pour lui. */
export const REF_KCAL = 2100;
const STD_CHILD_FACTOR = 0.6; // = CHILD_FACTOR de profile.js (sans import : pas de dépendance circulaire)

// Facteurs d'activité de Mifflin-St Jeor : peu ou pas de sport, 1 à 3 séances, 3 à 5, 6 à 7 ou métier physique.
const ACTIVITY_FACTOR = { faible: 1.2, moderee: 1.375, elevee: 1.55, intense: 1.725 };
// Enfants : les références sont données pour une activité moyenne, ajustées autour d'elle.
const CHILD_ACTIVITY = { faible: 0.9, moderee: 1, elevee: 1.1, intense: 1.2 };
const GOAL_KCAL = { perdre: 0.82, maintenir: 1, prendre: 1.12 };
const PROTEIN_PER_KG = { perdre: 1.4, maintenir: 0.8, prendre: 1.8 };
// Plancher sûr pour un objectif « perdre » (kcal par jour).
const FLOOR = { f: 1200, m: 1500, x: 1350 };
// Valeurs par défaut quand une mesure manque.
const DEF_HEIGHT = { f: 163, m: 176, x: 169 };
const DEF_WEIGHT = { f: 64, m: 78, x: 71 };
const DEF_AGE = 40;
// Références par âge (kcal par jour, activité moyenne ; protéines g par jour), filles / garçons.
const CHILD_REF = [
  { max: 0, kcal: [700, 750], protein: [10, 10] },
  { max: 3, kcal: [1000, 1050], protein: [13, 13] },
  { max: 6, kcal: [1350, 1450], protein: [19, 19] },
  { max: 10, kcal: [1700, 1850], protein: [28, 28] },
  { max: 14, kcal: [2050, 2300], protein: [42, 45] },
  { max: 17, kcal: [2200, 2750], protein: [46, 55] },
];

const entre = (v, min, max) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const parmi = (v, liste) => (liste.includes(v) ? v : null);
const r10 = (n) => Math.round(n / 10) * 10;

/** Une personne assainie (champs manquants ou hors bornes = null), ou null si ce n'est pas un objet. */
export function cleanMember(m, i = 0) {
  if (!estObjet(m)) return null;
  const id =
    typeof m.id === 'string' && m.id.trim() ? coupeTexte(m.id.trim(), 40) : `p${(i || 0) + 1}`;
  const age = entre(m.age, 0, 110);
  return {
    id,
    name: typeof m.name === 'string' ? coupeTexte(m.name, 40) : '', // non rogné : la saisie garde ses espaces
    age: age === null ? null : Math.floor(age),
    sex: parmi(m.sex, SEXES),
    heightCm: (() => {
      const h = entre(m.heightCm, 45, 230);
      return h === null ? null : Math.round(h);
    })(),
    weightKg: (() => {
      const w = entre(m.weightKg, 2, 300);
      return w === null ? null : Math.round(w * 10) / 10;
    })(),
    activity: parmi(m.activity, ACTIVITIES),
    goal: parmi(m.goal, GOALS),
    child: m.child === true,
  };
}

/** Liste assainie : objets seulement, identifiants uniques, au plus MEMBERS_MAX. */
export function cleanMembers(list) {
  const out = [];
  const ids = new Set();
  for (const raw of arr(list)) {
    if (out.length >= MEMBERS_MAX) break;
    const m = cleanMember(raw, out.length);
    if (!m) continue;
    let id = m.id;
    for (let n = 2; ids.has(id); n++) id = `${m.id}-${n}`;
    ids.add(id);
    out.push({ ...m, id });
  }
  return out;
}

/** Enfant (moins de 12 ans) ; sans âge, selon `child` (ajouté comme enfant). */
export const isChildMember = (m) =>
  !!m && (m.age !== null && m.age !== undefined ? m.age < CHILD_AGE : m.child === true);

// Au moins une information renseignée : sinon la personne compte comme un adulte ou un enfant standard.
const aDesInfos = (m) =>
  ['age', 'sex', 'heightCm', 'weightKg', 'activity', 'goal'].some(
    (k) => m[k] !== null && m[k] !== undefined
  );

const macros = (kcal, protein) => {
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
};

/**
 * Besoins par jour d'une personne : { kcal, protein, carbs, fat, child, complete }.
 * Adulte (18 ans et plus) : Mifflin-St Jeor x activité, puis objectif (perdre -18 %, jamais sous
 * 1200 kcal pour une femme, 1500 pour un homme ; prendre +12 %) ; protéines 0,8 g/kg (maintenir),
 * 1,4 (perdre), 1,8 (prendre) ; lipides 30 % des kcal, glucides le reste.
 * Moins de 18 ans : références par âge, objectif ignoré. Personne sans aucune information :
 * adulte de référence (2100 kcal) ou enfant standard (0,6 x 2100). `complete` : âge, sexe, taille
 * et poids renseignés.
 */
export function memberNeeds(member) {
  const m = cleanMember(member) || cleanMember({});
  const child = isChildMember(m);
  const complete = m.age !== null && !!m.sex && m.heightCm !== null && m.weightKg !== null;
  if (!aDesInfos(m)) {
    const kcal = r10(REF_KCAL * (child ? STD_CHILD_FACTOR : 1));
    return { ...macros(kcal, Math.round((kcal * 0.15) / 4)), child, complete: false };
  }
  const sx = m.sex || 'x';
  const si = m.sex === 'f' ? 0 : m.sex === 'm' ? 1 : -1;
  const pick = (pair) => (si < 0 ? (pair[0] + pair[1]) / 2 : pair[si]);
  const mineur = m.age !== null ? m.age < ADULT_AGE : child;
  if (mineur) {
    const age = m.age !== null ? m.age : 7;
    const ref = CHILD_REF.find((r) => age <= r.max) || CHILD_REF[CHILD_REF.length - 1];
    const kcal = r10(pick(ref.kcal) * CHILD_ACTIVITY[m.activity || 'moderee']);
    const protein = Math.round(m.weightKg !== null ? m.weightKg * 0.95 : pick(ref.protein));
    return { ...macros(kcal, protein), child, complete };
  }
  const w = m.weightKg !== null ? m.weightKg : DEF_WEIGHT[sx];
  const h = m.heightCm !== null ? m.heightCm : DEF_HEIGHT[sx];
  const age = m.age !== null ? m.age : DEF_AGE;
  const s = m.sex === 'm' ? 5 : m.sex === 'f' ? -161 : -78;
  const bmr = 10 * w + 6.25 * h - 5 * age + s;
  const maint = bmr * ACTIVITY_FACTOR[m.activity || 'moderee'];
  const goal = m.goal || 'maintenir';
  let kcal = maint * GOAL_KCAL[goal];
  if (goal === 'perdre') kcal = Math.min(maint, Math.max(kcal, FLOOR[sx]));
  kcal = r10(kcal);
  const protein = Math.round(w * PROTEIN_PER_KG[goal]);
  return { ...macros(kcal, protein), child, complete };
}

/** Facteur de portion par rapport à l'adulte de référence (pas de 0,05, borné 0,4 à 1,8). */
export function portionFactor(member) {
  const m = cleanMember(member) || cleanMember({});
  if (!aDesInfos(m)) return isChildMember(m) ? STD_CHILD_FACTOR : 1;
  const f = Math.round((memberNeeds(m).kcal / REF_KCAL) * 20) / 20;
  return Math.round(Math.min(1.8, Math.max(0.4, f)) * 100) / 100;
}

/**
 * Part des apports du jour pour un repas : midi 0,35 et soir 0,35 (les deux repas planifiés),
 * petit-déjeuner 0,2 et collation 0,1 (non planifiés, laissés hors des menus). Inconnu : 0,35.
 */
const SHARES = { midi: 0.35, soir: 0.35, matin: 0.2, collation: 0.1 };
export const mealShare = (slot) => SHARES[slot] || 0.35;

/**
 * Mode du foyer : 'simple' (nombre d'adultes et d'enfants) ou 'perso' (une fiche par personne). Absent = 'perso'
 * (comportement d'avant). En simple, les personnes renseignées sont gardées mais ignorées dans tous les calculs :
 * normalizeProfile les range alors sous profile.dormant, et les fonctions ci-dessous les ignorent aussi.
 */
export const isSimpleMode = (profile) => estObjet(profile) && profile.mode === 'simple';

/** Personnes prises en compte dans les calculs : aucune en mode simple. */
export const activeMembers = (profile) =>
  estObjet(profile) && !isSimpleMode(profile) ? cleanMembers(profile.members) : [];

/**
 * Convives choisis pour un repas (meal.eaters = ids de profile.members) : les ids de la liste qui existent,
 * dans l'ordre des personnes, ou null (absent, vide ou aucun id connu = tout le foyer comme avant).
 */
export function cleanEaters(profile, eaters) {
  if (!Array.isArray(eaters) || eaters.length === 0 || !estObjet(profile)) return null;
  const want = new Set(eaters.filter((x) => typeof x === 'string'));
  const ids = cleanMembers(profile.members)
    .filter((m) => want.has(m.id))
    .map((m) => m.id);
  return ids.length ? ids : null;
}

/** Personnes présentes à ce repas (enfants à la cantine absents le midi en semaine ; sans jour, tous).
 *  Avec `meal.eaters` : exactement les convives choisis (le choix prime sur la cantine). */
export function membersAt(profile, day, slot, meal) {
  const p = estObjet(profile) ? profile : {};
  const members = activeMembers(p);
  const chosen = estObjet(meal) ? cleanEaters(p, meal.eaters) : null;
  if (chosen) return members.filter((m) => chosen.includes(m.id));
  const d = day === null || day === undefined ? null : Number(day);
  const cantine = !!p.kidsCantine && slot === 'midi' && d !== null && d >= 0 && d <= 4;
  return cantine ? members.filter((m) => !isChildMember(m)) : members;
}

/**
 * Besoins des convives d'un repas : { kcal, protein, carbs, fat, portions, perPortionKcal,
 * perPortionProtein, count }, ou null sans `profile.members`. kcal et protein : total du repas pour
 * tous les convives ; portions : somme des facteurs (= personsFor) ; perPortion* : cible par portion
 * de recette (comparable à recipe.kcal et recipe.protein, donnés par portion adulte).
 */
export function householdMealNeeds(profile, day, slot, meal) {
  if (!activeMembers(profile).length) return null;
  const share = mealShare(slot);
  const out = { kcal: 0, protein: 0, carbs: 0, fat: 0, portions: 0, count: 0 };
  for (const m of membersAt(profile, day, slot, meal)) {
    const n = memberNeeds(m);
    out.kcal += n.kcal * share;
    out.protein += n.protein * share;
    out.carbs += n.carbs * share;
    out.fat += n.fat * share;
    out.portions += portionFactor(m);
    out.count++;
  }
  out.portions = Math.round(out.portions * 100) / 100;
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) out[k] = Math.round(out[k]);
  out.perPortionKcal = out.portions ? Math.round(out.kcal / out.portions) : 0;
  out.perPortionProtein = out.portions ? Math.round((out.protein / out.portions) * 10) / 10 : 0;
  return out;
}

/**
 * Cible d'une portion de recette pour un repas : { kcal, protein } (comparables à recipe.kcal et
 * recipe.protein), ou null sans profile.members. L'objectif de chacun est déjà dans ses besoins (donc dans le
 * facteur de portion) : la cible n'y ajoute rien, pour ne pas le compter deux fois.
 */
export function mealTarget(profile, day, slot, meal) {
  const n = householdMealNeeds(profile, day, slot, meal);
  if (!n || !n.portions || !n.perPortionKcal) return null;
  return {
    kcal: r10(n.perPortionKcal),
    protein: n.perPortionProtein,
  };
}

/** Bornes de l'ajustement d'une portion de recette aux besoins (moitié à double). */
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 2;

/**
 * Ajustement de la portion d'une recette aux besoins des personnes renseignées (mode personnalisé), comme les
 * applications de nutrition : la portion de chacun (portionFactor) est agrandie ou réduite pour que le plat
 * approche la cible du repas. -> nombre (pas de 0,05, borné SCALE_MIN à SCALE_MAX), 1 sans personnes renseignées
 * (mode simple compris) ou sans kcal connues. La cible par portion de référence vaut presque la même chose pour
 * chaque repas et chaque convive (besoins du jour x part du repas / facteur de portion), d'où la cible du foyer
 * le soir : l'ajustement ne dépend que de la recette, pour les Courses, le budget et l'affichage des apports.
 * `target` (facultatif) : portionTarget(profile) déjà calculé.
 */
export function recipePortionScale(profile, recipe, target) {
  const k = Number(recipe && recipe.kcal);
  if (!(k > 0)) return 1;
  const t = target !== undefined ? target : portionTarget(profile);
  if (!t || !(t.kcal > 0)) return 1;
  const s = Math.round((t.kcal / k) * 20) / 20;
  return Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, s)) * 100) / 100;
}

/** Cible d'une portion de référence pour le foyer (le soir, tous présents) : { kcal, protein } ou null. */
export const portionTarget = (profile) => mealTarget(profile, null, 'soir');
