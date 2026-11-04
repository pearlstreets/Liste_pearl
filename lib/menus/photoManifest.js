// Manifeste distant des photos de Menus : quelles recettes et quels ingrédients ont une photo en ligne.
// Une photo distante n'est demandée que si son identifiant y figure : chaque photo envoyée apparaît
// sans nouvelle mise à jour de l'application, et aucune adresse absente n'est jamais essayée.
//
// Format (JSON, quelques Ko) : { v, genN?, gen, recettes: [ids], ingredients: [clés] }
//   gen : bitset en base 64 (alphabet de ./b64), 6 cases par caractère ; la recette générée g-<r en
//   base 36> a une photo si (readInt(gen, (r / 6) | 0, 1) >> (r % 6)) & 1.
// Aucun travail sur les recettes générées au chargement : le bitset reste une chaîne, lue à la demande.
import { readInt, B64_ALPHABET } from './b64';
import { recipePhotoUri, ingredientPhotoSource, INGREDIENT_IMAGES } from './photoUrls';

export const PHOTOS_ROOT = 'https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus';
export const MANIFEST_URL = `${PHOTOS_ROOT}/manifeste.json`;

const MAX_GEN = 8192; // caractères : 49 152 cases, bien au-delà du catalogue
const MAX_LISTE = 5000;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,159}$/;
const GEN_RE = /^g-([0-9a-z]{1,8})$/;
const GEN_OK = new RegExp(`^[${B64_ALPHABET.replace(/[+/]/g, '\\$&')}]*$`);

function liste(a) {
  if (!Array.isArray(a) || a.length > MAX_LISTE) return null;
  const out = new Set();
  for (const x of a) if (typeof x === 'string' && ID_RE.test(x)) out.add(x);
  return out;
}

/** Manifeste propre, ou null s'il est invalide (rien n'est alors remplacé). Accepte l'objet ou le texte JSON. */
export function parseManifest(raw) {
  let o = raw;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const v = o.v !== undefined ? o.v : o.version;
  if (!Number.isInteger(v) || v < 1 || v > 999) return null;
  const gen = o.gen === undefined ? '' : o.gen;
  if (typeof gen !== 'string' || gen.length > MAX_GEN || !GEN_OK.test(gen)) return null;
  const recettes = liste(o.recettes === undefined ? [] : o.recettes);
  const ingredients = liste(o.ingredients === undefined ? [] : o.ingredients);
  if (!recettes || !ingredients) return null;
  const genN =
    Number.isInteger(o.genN) && o.genN >= 0 ? Math.min(o.genN, gen.length * 6) : gen.length * 6;
  return { v, gen, genN, recettes, ingredients };
}

/** Forme JSON d'un manifeste propre (pour le garder sur le téléphone). */
export function serializeManifest(m) {
  return JSON.stringify({
    v: m.v,
    genN: m.genN,
    gen: m.gen,
    recettes: [...m.recettes],
    ingredients: [...m.ingredients],
  });
}

/** La recette a-t-elle une photo en ligne ? Test en temps constant. */
export function hasRecipePhoto(m, id) {
  if (!m || typeof id !== 'string') return false;
  const g = GEN_RE.exec(id);
  if (g) {
    const r = parseInt(g[1], 36);
    if (!(r >= 0) || r >= m.genN || r.toString(36) !== g[1]) return false;
    const c = readInt(m.gen, (r / 6) | 0, 1);
    return c >= 0 && ((c >> (r % 6)) & 1) === 1;
  }
  return m.recettes.has(id);
}

export function hasIngredientPhoto(m, key) {
  return !!m && typeof key === 'string' && m.ingredients.has(key);
}

// État courant, partagé par tous les écrans ; changé seulement par un manifeste valide.
let courant = null;
let version = 0;
const abonnes = new Set();

export function getManifest() {
  return courant;
}

export function getManifestVersion() {
  return version;
}

/** Remplace le manifeste courant ; un manifeste invalide est ignoré (renvoie false). */
export function setManifest(m) {
  if (!m || typeof m !== 'object' || !(m.recettes instanceof Set)) return false;
  courant = m;
  version += 1;
  for (const f of abonnes) {
    try {
      f();
    } catch {}
  }
  return true;
}

export function subscribeManifest(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Pour les tests. */
export function resetManifest() {
  courant = null;
  version += 1;
}

const base = (m) => `${PHOTOS_ROOT}/v${m.v}`;

/** Adresse de la photo en ligne d'une recette du catalogue, ou null (absente du manifeste). */
export function remoteRecipePhotoUri(recipe, m = courant) {
  if (!recipe || recipe.custom || !hasRecipePhoto(m, recipe.id)) return null;
  return recipePhotoUri(recipe, base(m));
}

/** Vignette d'un ingrédient : celle du paquet, sinon celle en ligne si le manifeste la liste, sinon null. */
export function remoteIngredientSource(key, m = courant, images = INGREDIENT_IMAGES) {
  const enLigne = hasIngredientPhoto(m, key) ? `${base(m)}/ingredients` : '';
  return ingredientPhotoSource(key, images, enLigne);
}
