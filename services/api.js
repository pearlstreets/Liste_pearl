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

// ========== SECURE FETCH ==========

async function apiFetch(endpoint, options = {}) {
  const tokens = await getTokens();
  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': requestFingerprint(), // Track requests
    ...(options.headers || {}),
  };

  // Auto-refresh if token expired
  if (tokens?.access && isTokenExpired(tokens.access) && tokens?.refresh) {
    try {
      const refreshRes = await fetchWithTimeout(`${BASE_URL}/admin/refresh-token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.access) {
          await saveTokens(data.access, data.refresh || tokens.refresh);
          headers['Authorization'] = `Bearer ${data.access}`;
        }
      }
    } catch (_e) {
      /* refresh failed */
    }
  } else if (tokens?.access) {
    headers['Authorization'] = `Bearer ${tokens.access}`;
  }

  const url = `${BASE_URL}${endpoint}`;
  let res = await fetchWithTimeout(url, { ...options, headers });

  // If 401, try refresh once more
  if (res.status === 401 && tokens?.refresh) {
    try {
      const refreshRes = await fetchWithTimeout(`${BASE_URL}/admin/refresh-token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.access) {
          await saveTokens(data.access, data.refresh || tokens.refresh);
          headers['Authorization'] = `Bearer ${data.access}`;
          res = await fetchWithTimeout(url, { ...options, headers });
        }
      }
    } catch (_e) {
      /* refresh failed */
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

// Parse response safely - never crashes on HTML/empty/malformed bodies.
// Throws a clean Error with .status and .data on HTTP errors.
async function parseResponse(res, method, endpoint) {
  const contentType = res.headers?.get?.('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (_e) {
      data = null;
    }
  }
  if (!res.ok) {
    const err = new Error(`API ${method} ${endpoint} failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return sanitizeResponse(data || {});
}

export async function apiGet(endpoint) {
  const res = await apiFetch(endpoint, { method: 'GET' });
  return parseResponse(res, 'GET', endpoint);
}

export async function apiPost(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return parseResponse(res, 'POST', endpoint);
}

export async function apiPut(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return parseResponse(res, 'PUT', endpoint);
}

export async function apiDelete(endpoint) {
  const res = await apiFetch(endpoint, { method: 'DELETE' });
  return parseResponse(res, 'DELETE', endpoint);
}

export async function apiUpload(endpoint, formData) {
  const tokens = await getTokens();
  const headers = { 'X-Request-ID': requestFingerprint() };
  if (tokens?.access) {
    headers['Authorization'] = `Bearer ${tokens.access}`;
  }
  const res = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return parseResponse(res, 'POST', endpoint);
}

export { BASE_URL };
