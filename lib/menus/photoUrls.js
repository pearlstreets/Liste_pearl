// Photos des recettes et des ingrédients : photo du paquet d'abord, puis adresses distantes
// (source en cours de choix). Tant que les adresses de base sont vides, rien n'est demandé au réseau.

/** Adresse https du dossier des photos de recettes, sans barre finale. Vide : aucune photo distante. */
export const PHOTO_BASE = '';
/** Adresse https du dossier des vignettes d'ingrédients, sans barre finale. Vide : aucune vignette distante. */
export const INGREDIENT_PHOTO_BASE = '';
/** Vignettes d'ingrédients livrées avec l'application : clé ingrédient -> require(...). Vide pour l'instant. */
export const INGREDIENT_IMAGES = {};

const MAX_ID = 160;

function joinUrl(base, id) {
  if (typeof base !== 'string' || !/^https:\/\/[^\s]+$/i.test(base)) return null;
  if (typeof id !== 'string' || !id || id.length > MAX_ID) return null;
  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(id)}.webp`;
}

/** Photo distante d'une recette du catalogue, ou null (recette personnelle, base vide). */
export function recipePhotoUri(recipe, base = PHOTO_BASE) {
  if (!recipe || recipe.custom) return null;
  return joinUrl(base, recipe.id);
}

/** Vignette d'un ingrédient : celle du paquet, sinon l'adresse distante, sinon null (rien à afficher). */
export function ingredientPhotoSource(
  key,
  images = INGREDIENT_IMAGES,
  base = INGREDIENT_PHOTO_BASE
) {
  if (typeof key !== 'string' || !key) return null;
  if (images && Object.prototype.hasOwnProperty.call(images, key) && images[key])
    return images[key];
  const uri = joinUrl(base, key);
  return uri ? { uri } : null;
}

/** Adresses sans vide ni doublon, dans l'ordre : la même photo n'est jamais essayée deux fois. */
export function uniqueUris(list) {
  const out = [];
  for (const u of list || []) if (typeof u === 'string' && u && !out.includes(u)) out.push(u);
  return out;
}

/**
 * Source à afficher : la photo du paquet, sinon l'adresse distante n° failed (les précédentes ont
 * échoué au chargement), sinon null (repli sans photo).
 */
export function pickPhotoSource(local, uris, failed = 0) {
  if (local) return local;
  const uri = (uris || [])[failed];
  return uri ? { uri, cache: 'force-cache' } : null;
}

/**
 * Clé d'une source d'image, pour ne jamais montrer deux fois la même photo dans une rangée :
 * un require() du paquet est un nombre, une photo distante une adresse.
 */
export function photoKey(source) {
  if (source === null || source === undefined || source === false) return null;
  if (typeof source === 'number' || typeof source === 'string') return String(source);
  if (typeof source === 'object' && typeof source.uri === 'string') return source.uri;
  return null;
}

/** Sources sans doublon (même fichier ou même adresse), dans l'ordre, au plus max. */
export function uniquePhotos(sources, max = Infinity) {
  const seen = new Set();
  const out = [];
  for (const src of sources || []) {
    const k = photoKey(src);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(src);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Recettes à montrer en vignettes dans une rangée : seulement celles qui ont une photo, et jamais
 * deux fois la même photo (même recette deux fois dans la semaine, ou photo partagée).
 */
export function distinctPhotoRecipes(recipes, images = {}, max = 5, base = PHOTO_BASE) {
  const seen = new Set();
  const out = [];
  for (const r of recipes || []) {
    if (!r) continue;
    const own = r.custom ? r.photoUrl || r.photoFile : null;
    const k = photoKey((images && images[r.id]) || recipePhotoUri(r, base) || own || null);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** Visionneuse : un glissement vers le bas assez long, ou rapide, ferme la photo. */
export function shouldDismissSwipe(dy, vy) {
  const d = Number(dy) || 0;
  const v = Number(vy) || 0;
  return d > 120 || (d > 40 && v > 0.8);
}

/** Cadre réel d'une image affichée en « contain » dans une boîte (centrée, proportions gardées). */
export function containRect(imgW, imgH, boxW, boxH) {
  const bw = Math.max(0, Number(boxW) || 0);
  const bh = Math.max(0, Number(boxH) || 0);
  const iw = Number(imgW) || 0;
  const ih = Number(imgH) || 0;
  if (!bw || !bh) return { x: 0, y: 0, width: 0, height: 0 };
  // Taille inconnue : un cadre 4:3 sur toute la largeur, le format des photos de recettes.
  const ratio = iw > 0 && ih > 0 ? iw / ih : 4 / 3;
  let width = bw;
  let height = bw / ratio;
  if (height > bh) {
    height = bh;
    width = bh * ratio;
  }
  return { x: (bw - width) / 2, y: (bh - height) / 2, width, height };
}
