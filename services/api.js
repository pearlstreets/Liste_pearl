import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from './config';
import { sanitizeResponse, isTokenExpired, requestFingerprint } from './security';

// Base URL from config
const BASE_URL = CONFIG.API_URL;
const TOKEN_KEY = 'MARKETPLACE_TOKENS';
const API_TIMEOUT = 8000; // 8s timeout

// ========== TOKEN MANAGEMENT ==========

export async function saveTokens(access, refresh) {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify({ access, refresh, savedAt: Date.now() }));
}

export async function getTokens() {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearTokens() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ========== TOKEN REFRESH ==========

// Rafraîchissement des jetons CLIENT par la route commune `/token/refresh/`
// (même route que l'app AppUser). Corps `{ refresh }`, réponse
// `{ access, refresh }` : le serveur fait TOURNER le jeton de rafraîchissement
// (l'ancien est mis en liste noire), il faut donc enregistrer le nouveau.
// L'ancienne route `/admin/refresh-token/` (réservée à l'espace admin) n'est
// plus appelée.
const REFRESH_PATH = '/token/refresh/';

// Un seul rafraîchissement à la fois : avec la rotation, deux appels parallèles
// présentant le même jeton feraient refuser le second. Les appels concurrents
// attendent la même promesse.
let refreshInFlight = null;

export function refreshTokens(staleRefresh) {
  if (!staleRefresh) return Promise.resolve(null);
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      // Déjà tourné par un autre appel entre-temps : on reprend la paire neuve.
      const current = await getTokens();
      if (current?.refresh && current.refresh !== staleRefresh && current.access && !isTokenExpired(current.access)) {
        return current;
      }
      const res = await fetchWithTimeout(`${BASE_URL}${REFRESH_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: staleRefresh }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      // Lire les deux formes (`access` sur /token/refresh/, `access_token` ailleurs).
      const newAccess = data.access || data.access_token;
      if (!newAccess) return null;
      const newRefresh = data.refresh || data.refresh_token || staleRefresh;
      await saveTokens(newAccess, newRefresh);
      return { access: newAccess, refresh: newRefresh };
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// ========== SECURE FETCH ==========

async function apiFetch(endpoint, options = {}) {
  const tokens = await getTokens();
  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': requestFingerprint(), // Track requests
    ...(options.headers || {}),
  };

  // Auto-refresh if token expired
  let refreshed = null;
  if (tokens?.access && isTokenExpired(tokens.access) && tokens?.refresh) {
    refreshed = await refreshTokens(tokens.refresh);
    if (refreshed?.access) headers['Authorization'] = `Bearer ${refreshed.access}`;
  } else if (tokens?.access) {
    headers['Authorization'] = `Bearer ${tokens.access}`;
  }

  const url = `${BASE_URL}${endpoint}`;
  let res = await fetchWithTimeout(url, { ...options, headers });

  // If 401, try refresh once more
  const refreshToUse = refreshed?.refresh || tokens?.refresh;
  if (res.status === 401 && refreshToUse) {
    const again = await refreshTokens(refreshToUse);
    if (again?.access) {
      headers['Authorization'] = `Bearer ${again.access}`;
      res = await fetchWithTimeout(url, { ...options, headers });
    }
  }

  return res;
}

// Fetch with AbortController timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ========== API METHODS (with response sanitization) ==========

export async function apiGet(endpoint) {
  const res = await apiFetch(endpoint, { method: 'GET' });
  const data = await res.json();
  return sanitizeResponse(data);
}

export async function apiPost(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return sanitizeResponse(data);
}

export async function apiPut(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return sanitizeResponse(data);
}

export async function apiDelete(endpoint, body) {
  const opts = { method: 'DELETE' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await apiFetch(endpoint, opts);
  const data = await res.json();
  return sanitizeResponse(data);
}

// Variante qui garde le statut HTTP, pour les appels où un `message` dans le
// corps ne suffit pas à distinguer succès et échec (suppression de compte).
// Ne lève pas si le corps n'est pas du JSON (page d'erreur HTML d'un 502) ;
// lève seulement si le réseau est coupé ou le délai dépassé, comme les autres.
export async function apiDeleteWithStatus(endpoint, body) {
  const opts = { method: 'DELETE' };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await apiFetch(endpoint, opts);
  let data = null;
  try {
    data = sanitizeResponse(await res.json());
  } catch {
    data = null;
  }
  return { ok: !!res.ok, status: res.status, data };
}

// `method` : POST par défaut ; PUT pour les vues qui n'acceptent que PUT
// (ex. /users/update-profile/).
export async function apiUpload(endpoint, formData, method = 'POST') {
  const tokens = await getTokens();
  const headers = { 'X-Request-ID': requestFingerprint() };
  if (tokens?.access) {
    headers['Authorization'] = `Bearer ${tokens.access}`;
  }
  const res = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: formData,
  });
  const data = await res.json();
  return sanitizeResponse(data);
}

export { BASE_URL };
