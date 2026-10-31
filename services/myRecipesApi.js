// Appels serveur des recettes personnelles. Aucune exception ne sort d'ici : chaque appel rend un
// statut, l'écran n'a plus qu'à choisir son message. La route peut ne pas exister encore (404).
import { Platform } from 'react-native';
import { apiJsonWithStatus, apiUploadWithStatus, getTokens } from './api';

const IMPORT_PATH = '/users/list-menus/import-recipe/';
const PHOTO_PATH = '/users/list-menus/recipe-photo/';
const IMPORT_TIMEOUT_MS = 30000; // le serveur doit aller lire la page
const PHOTO_TIMEOUT_MS = 60000;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Première adresse web du texte collé, ou null. */
export function extractUrl(text) {
  const m = /https?:\/\/[^\s<>"']+/i.exec(String(text || ''));
  if (m) return m[0];
  const nu = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.exec(String(text || '').trim());
  return nu ? `https://${nu[0]}` : null;
}

async function connecte() {
  const tokens = await getTokens();
  return !!(tokens && tokens.access);
}

/** -> { status:'ok', data } | { status:'invalid_url'|'login'|'offline'|'not_a_recipe'|'rate_limited'|'unavailable' } */
export async function importRecipe(text) {
  const url = extractUrl(text);
  if (!url) return { status: 'invalid_url' };
  let r;
  try {
    if (!(await connecte())) return { status: 'login' };
    r = await apiJsonWithStatus('POST', IMPORT_PATH, { url }, { timeoutMs: IMPORT_TIMEOUT_MS });
  } catch {
    return { status: 'offline' };
  }
  if (r.ok && r.data && typeof r.data === 'object') return { status: 'ok', data: r.data };
  if (r.status === 422) return { status: 'not_a_recipe' };
  if (r.status === 429) return { status: 'rate_limited' };
  if (r.status === 401 || r.status === 403) return { status: 'login' };
  return { status: 'unavailable' };
}

/** -> { status:'ok', url } | { status:'offline'|'login'|'unavailable'|'rejected' } */
export async function uploadRecipePhoto(fileUri) {
  try {
    if (!(await connecte())) return { status: 'login' };
    const nom = String(fileUri).split('/').pop() || 'photo.jpg';
    const ext = (nom.split('.').pop() || 'jpg').toLowerCase();
    const body = new FormData();
    body.append('photo', {
      uri: Platform.OS === 'ios' ? String(fileUri).replace('file://', '') : fileUri,
      name: nom,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });
    const r = await apiUploadWithStatus(PHOTO_PATH, body, { timeoutMs: PHOTO_TIMEOUT_MS });
    if (r.ok && r.data && typeof r.data.url === 'string') return { status: 'ok', url: r.data.url };
    if (r.status === 401 || r.status === 403) return { status: 'login' };
    if (r.status === 400 || r.status === 413 || r.status === 415) return { status: 'rejected' };
    return { status: 'unavailable' };
  } catch {
    return { status: 'offline' };
  }
}
