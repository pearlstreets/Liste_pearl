// Recettes personnelles : format, nettoyage, brouillon du formulaire, rapprochement avec le
// catalogue d'ingrédients. Pur : ni stockage, ni réseau, ni React.
// Une recette personnelle a la forme d'une recette du catalogue (id, servings, timeMin, course,
// ingredients:[{ key, name, qty, unit }]) plus custom:true, title, steps et sa photo. Tout ingrédient
// a une clé : celle du catalogue quand le nom correspond, sinon une clé libre "libre:<nom>".
import { estObjet, arr, norm, coupeTexte, hashString, FREE_PREFIX, isFreeKey, freeLabel } from './util';

export const MY_RECIPE_ID = /^my-[A-Za-z0-9_-]{1,60}$/;
export const MAX_MY_RECIPES = 300; // la sauvegarde du compte est limitée à 512 Ko
export const UNITS = ['g', 'kg', 'ml', 'cl', 'dl', 'l', 'cs', 'cc', 'u'];
export const COURSES = ['plat', 'entree', 'dessert', 'petit-dejeuner'];

const MAX_TITLE = 120;
const MAX_NAME = 80;
const MAX_STEP = 1000;
const MAX_STEPS = 40;
const MAX_INGREDIENTS = 60;
const MAX_URL = 2048;
const MAX_QTY = 100000;
const PHOTO_FILE = /^menus-photos\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|heic)$/i;

const UNIT_ALIAS = {
  gr: 'g',
  gramme: 'g',
  grammes: 'g',
  gram: 'g',
  grams: 'g',
  kilo: 'kg',
  kilos: 'kg',
  kilogramme: 'kg',
  kilogrammes: 'kg',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  centilitre: 'cl',
  centilitres: 'cl',
  decilitre: 'dl',
  decilitres: 'dl',
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  cas: 'cs',
  'c a s': 'cs',
  'cuillere a soupe': 'cs',
  'cuilleres a soupe': 'cs',
  tbsp: 'cs',
  tablespoon: 'cs',
  tablespoons: 'cs',
  cac: 'cc',
  'c a c': 'cc',
  'cuillere a cafe': 'cc',
  'cuilleres a cafe': 'cc',
  tsp: 'cc',
  teaspoon: 'cc',
  teaspoons: 'cc',
  piece: 'u',
  pieces: 'u',
  unite: 'u',
  unites: 'u',
};

/** Unité connue de l'application ; tout le reste (pincée, botte...) se compte à la pièce. */
export function normalizeUnit(u) {
  if (u === 'L') return 'l';
  if (UNITS.includes(u)) return u;
  const n = norm(u);
  if (UNITS.includes(n)) return n;
  return UNIT_ALIAS[n] || 'u';
}

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/** "1,5", "1/2", "1 1/2", "½", 2 -> nombre positif, sinon null (pas de quantité). */
export function parseQty(v) {
  let x = null;
  if (typeof v === 'number') x = v;
  else if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    const melange = /^(\d+)?\s*(?:(\d+)\/(\d+)|([½¼¾⅓⅔⅛]))$/.exec(s);
    if (melange && (melange[1] || melange[2] || melange[4])) {
      const frac = melange[4] ? FRACTIONS[melange[4]] : Number(melange[2]) / Number(melange[3]);
      x = Number(melange[1] || 0) + frac;
    } else if (/^\d*\.?\d+$/.test(s)) x = Number(s);
  }
  if (x === null || !Number.isFinite(x) || x <= 0) return null;
  return Math.min(x, MAX_QTY);
}

const texte = (v, max) => (typeof v === 'string' ? coupeTexte(v.trim(), max) : '');
const borne = (v, min, max, def) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(max, Math.max(min, n));
};

/** Adresse https seule : ni data: (base64 interdit dans la sauvegarde), ni file:, ni chemin local. */
export function cleanRemoteUrl(v) {
  if (typeof v !== 'string' || v.length > MAX_URL) return null;
  const s = v.trim();
  return /^https:\/\/[^\s]+$/i.test(s) ? s : null;
}
/** Fichier relatif au dossier documents, jamais un chemin temporaire ou absolu. */
export function cleanPhotoFile(v) {
  return typeof v === 'string' && PHOTO_FILE.test(v) && !v.includes('..') ? v : null;
}

/** Clé d'un ingrédient libre : deux noms identiques (casse, accents, espaces) donnent la même clé. */
export function freeKeyOf(name) {
  const n = norm(name);
  return FREE_PREFIX + (n || hashString(String(name)));
}

function cleanIngredient(i) {
  if (!estObjet(i)) return null;
  const name = texte(i.name, MAX_NAME);
  const key = typeof i.key === 'string' && i.key.length <= 160 ? i.key : '';
  if (!name && !key) return null;
  const unit = normalizeUnit(i.unit);
  const out = {
    key: key || freeKeyOf(name),
    name: name || (isFreeKey(key) ? freeLabel(key) : ''),
    qty: parseQty(i.qty),
    unit,
  };
  if (i.optional) out.optional = true;
  return out;
}

/** Une recette propre, ou null si elle est inutilisable. Lecture tolérante, jamais d'exception. */
export function cleanMyRecipe(r) {
  if (!estObjet(r) || typeof r.id !== 'string' || !MY_RECIPE_ID.test(r.id)) return null;
  const title = texte(r.title, MAX_TITLE);
  const ingredients = arr(r.ingredients).map(cleanIngredient).filter(Boolean).slice(0, MAX_INGREDIENTS);
  if (!title || ingredients.length === 0) return null;
  const out = {
    id: r.id,
    custom: true,
    title,
    servings: borne(r.servings, 1, 24, 4),
    timeMin: borne(r.timeMin, 1, 1440, 30),
    course: COURSES.includes(r.course) ? r.course : 'plat',
    tags: [], // tags inconnus : voir allergens.js et rejectReason
    ingredients,
    steps: arr(r.steps)
      .map((s) => texte(s, MAX_STEP))
      .filter(Boolean)
      .slice(0, MAX_STEPS),
    photoUrl: cleanRemoteUrl(r.photoUrl),
    photoFile: cleanPhotoFile(r.photoFile),
    sourceUrl: typeof r.sourceUrl === 'string' && /^https?:\/\//i.test(r.sourceUrl) ? r.sourceUrl.slice(0, MAX_URL) : null,
    updatedAt: Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
  };
  return out;
}

/** Photos encore à envoyer au compte. */
export const photosToUpload = (list) => arr(list).filter((r) => r && r.photoFile && !r.photoUrl);

export function cleanMyRecipes(v) {
  const parId = new Map();
  for (const x of arr(v)) {
    const c = cleanMyRecipe(x);
    if (c) parId.set(c.id, c);
  }
  return [...parId.values()];
}

/** Union de deux listes (première connexion) : par id, la version modifiée le plus tard gagne. */
export function mergeMyRecipes(a, b) {
  const parId = new Map();
  for (const r of [...arr(a), ...arr(b)]) {
    if (!estObjet(r) || typeof r.id !== 'string') continue;
    const cur = parId.get(r.id);
    if (!cur || (Number(r.updatedAt) || 0) >= (Number(cur.updatedAt) || 0)) parId.set(r.id, r);
  }
  return [...parId.values()];
}

/* -------------------------- rapprochement avec le catalogue -------------------------- */

const singulier = (n) => (n.length > 3 ? n.replace(/(?<=[a-z])[sx]$/, '') : n);

/**
 * Index nom -> clé d'ingrédient. textsList : textes de la langue de l'utilisateur d'abord, puis le
 * français ; le premier arrivé garde le nom.
 */
export function buildNameIndex(ingredients, textsList) {
  const idx = new Map();
  for (const texts of arr(textsList)) {
    for (const key of Object.keys(estObjet(ingredients) ? ingredients : {})) {
      let n = '';
      try {
        n = norm(texts.ingredientName(key));
      } catch {
        n = '';
      }
      if (!n) continue;
      if (!idx.has(n)) idx.set(n, key);
      const sg = singulier(n);
      if (!idx.has(sg)) idx.set(sg, key);
    }
  }
  return idx;
}

/** Clé du catalogue pour ce nom, ou null. Comparaison stricte : jamais de "à peu près". */
export function matchIngredientKey(name, nameIndex) {
  if (!(nameIndex instanceof Map)) return null;
  const n = norm(name);
  if (!n) return null;
  return nameIndex.get(n) || nameIndex.get(singulier(n)) || null;
}

/* ---------------------------------- brouillon ---------------------------------- */

const ligneVide = () => ({ name: '', qty: '', unit: 'g' });
const qtyTexte = (q) => (q > 0 ? String(Math.round(q * 1000) / 1000).replace('.', ',') : '');

export function emptyDraft(servings = 4) {
  return {
    id: null,
    title: '',
    servings: borne(servings, 1, 24, 4),
    timeMin: 30,
    ingredients: [ligneVide()],
    steps: [''],
    photoUrl: null,
    photoFile: null,
    photoTemp: null,
    sourceUrl: null,
  };
}

export function draftFromRecipe(r, texts) {
  const nom = (i) =>
    i.name || (texts && typeof texts.ingredientName === 'function' ? texts.ingredientName(i.key) : '');
  return {
    id: r.id,
    title: r.title,
    servings: r.servings,
    timeMin: r.timeMin,
    course: r.course,
    ingredients: arr(r.ingredients).map((i) => ({
      name: nom(i),
      qty: qtyTexte(i.qty),
      unit: i.unit || 'u',
      key: i.key,
      nameAtLoad: nom(i),
      optional: !!i.optional,
    })),
    steps: arr(r.steps).length ? [...r.steps] : [''],
    photoUrl: r.photoUrl || null,
    photoFile: r.photoFile || null,
    photoTemp: null,
    sourceUrl: r.sourceUrl || null,
  };
}

/** Réponse de import-recipe -> brouillon à corriger. Toute donnée inattendue est ignorée. */
export function draftFromImport(d, base) {
  const src = estObjet(d) ? d : {};
  const out = { ...(estObjet(base) ? base : emptyDraft()) };
  const title = texte(src.title, MAX_TITLE);
  if (title) out.title = title;
  out.servings = borne(src.servings, 1, 24, out.servings);
  out.timeMin = borne(src.time_min, 1, 1440, out.timeMin);
  const ing = arr(src.ingredients)
    .filter(estObjet)
    .map((i) => {
      const q = parseQty(i.qty);
      return { name: texte(i.name, MAX_NAME), qty: qtyTexte(q), unit: normalizeUnit(i.unit) };
    })
    .filter((i) => i.name)
    .slice(0, MAX_INGREDIENTS);
  if (ing.length) out.ingredients = ing;
  const steps = arr(src.steps)
    .map((s) => texte(s, MAX_STEP))
    .filter(Boolean)
    .slice(0, MAX_STEPS);
  if (steps.length) out.steps = steps;
  const photo = cleanRemoteUrl(src.image_url);
  if (photo) {
    out.photoUrl = photo;
    out.photoFile = null;
    out.photoTemp = null;
  }
  out.sourceUrl = cleanRemoteUrl(src.source_url) || out.sourceUrl || null;
  return out;
}

/** { ok, errors:['title','ingredients'] } */
export function validateDraft(d) {
  const errors = [];
  if (!estObjet(d) || !texte(d.title, MAX_TITLE)) errors.push('title');
  if (!estObjet(d) || !arr(d.ingredients).some((i) => estObjet(i) && texte(i.name, MAX_NAME)))
    errors.push('ingredients');
  return { ok: errors.length === 0, errors };
}

const nouvelId = () =>
  `my-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Brouillon -> recette enregistrable (ou null). opts : { nameIndex, now, idGen }.
 * Un nom inchangé à l'édition garde sa clé ; un nom nouveau est rapproché du catalogue.
 */
export function recipeFromDraft(d, opts = {}) {
  if (!validateDraft(d).ok) return null;
  const o = estObjet(opts) ? opts : {};
  const ingredients = arr(d.ingredients)
    .filter((i) => estObjet(i) && texte(i.name, MAX_NAME))
    .map((i) => {
      const name = texte(i.name, MAX_NAME);
      const garde = i.key && i.nameAtLoad === i.name;
      return {
        key: garde ? i.key : matchIngredientKey(name, o.nameIndex) || freeKeyOf(name),
        name,
        qty: parseQty(i.qty),
        unit: normalizeUnit(i.unit),
        ...(i.optional ? { optional: true } : {}),
      };
    });
  return cleanMyRecipe({
    id: d.id || (typeof o.idGen === 'function' ? o.idGen() : nouvelId()),
    title: d.title,
    servings: d.servings,
    timeMin: d.timeMin,
    course: d.course,
    ingredients,
    steps: d.steps,
    photoUrl: d.photoUrl,
    photoFile: d.photoFile,
    sourceUrl: d.sourceUrl,
    updatedAt: Number.isFinite(o.now) ? o.now : Date.now(),
  });
}

/* -------------------------------- textes à l'écran -------------------------------- */

/** Textes du catalogue complétés par ceux des recettes personnelles (titres, étapes, noms libres). */
export function withMyTexts(base, myRecipes) {
  const parId = new Map();
  const noms = new Map();
  for (const r of arr(myRecipes)) {
    if (!estObjet(r)) continue;
    parId.set(r.id, r);
    for (const i of arr(r.ingredients))
      if (estObjet(i) && isFreeKey(i.key) && i.name && !noms.has(i.key)) noms.set(i.key, i.name);
  }
  return {
    ...base,
    recipeTitle: (id) => (parId.has(id) ? parId.get(id).title : base.recipeTitle(id)),
    recipeSteps: (id) => (parId.has(id) ? arr(parId.get(id).steps) : base.recipeSteps(id)),
    ingredientName: (key) => {
      if (isFreeKey(key)) {
        const k = String(key).split('|')[0];
        if (noms.has(k)) return noms.get(k);
      }
      return base.ingredientName(key);
    },
  };
}
