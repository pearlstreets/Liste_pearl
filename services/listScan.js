// Scan de Ma Liste : la photo (liste manuscrite, ticket de caisse, produit) est
// lue par le serveur, qui renvoie les articles trouvés.
// POST /users/list-scan/ (multipart : image, lang), jeton du compte obligatoire.
// Ne lève jamais : renvoie { items } ou { error: 'login' | 'limit' | 'image' | 'unavailable' | 'network' }.
import { apiUploadWithStatus, getTokens } from './api';

const SCAN_PATH = '/users/list-scan/';
const SCAN_TIMEOUT = 40000; // lecture de l'image par le serveur : plus long qu'un appel ordinaire
const LANGUES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'pt', 'ru', 'sv', 'th', 'zh'];
// Unités renvoyées par le serveur, ramenées à celles de la liste (lib/parseMulti).
const UNITES = { u: 'u', g: 'g', kg: 'kg', ml: 'mL', cl: 'cL', l: 'L' };
const NOM_MAX = 80;

export function langueScan(lang) {
  const base = String(lang || '').toLowerCase().split(/[-_]/)[0];
  return LANGUES.includes(base) ? base : 'en';
}

export function assainirArticles(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    if (typeof it.name !== 'string') continue;
    const name = it.name.replace(/\s+/g, ' ').trim().slice(0, NOM_MAX).trim();
    if (!name) continue;
    const n = typeof it.qty === 'number' ? it.qty : parseFloat(String(it.qty ?? '').replace(',', '.'));
    const qty = isFinite(n) && n > 0 ? (Number.isInteger(n) ? n : Math.round(n * 100) / 100) : 1;
    const unit = UNITES[String(it.unit || '').toLowerCase()] || 'u';
    out.push({ name, qty, unit });
  }
  return out;
}

export async function scanListPhoto(uri, lang) {
  try {
    if (!uri) return { error: 'image' };
    const tokens = await getTokens();
    if (!tokens?.access) return { error: 'login' };
    const form = new FormData();
    form.append('image', { uri, name: 'liste.jpg', type: 'image/jpeg' });
    form.append('lang', langueScan(lang));
    const res = await apiUploadWithStatus(SCAN_PATH, form, { timeoutMs: SCAN_TIMEOUT });
    const status = res?.status;
    if (status === 401 || status === 403) return { error: 'login' };
    if (status === 429) return { error: 'limit' };
    if (status === 400) return { error: 'image' };
    if (!res?.ok) return { error: 'unavailable' };
    const data = res.data;
    if (!data || typeof data !== 'object' || !Array.isArray(data.items)) return { error: 'unavailable' };
    return { items: assainirArticles(data.items) };
  } catch {
    return { error: 'network' };
  }
}
