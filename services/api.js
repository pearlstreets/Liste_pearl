import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { CONFIG } from "./config";
import { sanitizeResponse, isTokenExpired, requestFingerprint } from "./security";

// Base URL from config
const BASE_URL = CONFIG.API_URL;
const TOKEN_KEY = "MARKETPLACE_TOKENS";
const API_TIMEOUT = 8000; // 8s timeout

// ========== SECURE TOKEN STORAGE ==========
// Uses SecureStore (Keychain/Keystore) on native, AsyncStorage fallback on web

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

async function secureSet(key, value) {
  if (isNative) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureGet(key) {
  if (isNative) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

async function secureRemove(key) {
  if (isNative) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

// ========== TOKEN MANAGEMENT ==========

export async function saveTokens(access, refresh) {
  await secureSet(TOKEN_KEY, JSON.stringify({ access, refresh, savedAt: Date.now() }));
}

export async function getTokens() {
  try {
    const raw = await secureGet(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function clearTokens() {
  await secureRemove(TOKEN_KEY);
}

// ========== SECURE FETCH ==========

async function apiFetch(endpoint, options = {}) {
  const tokens = await getTokens();
  const headers = {
    "Content-Type": "application/json",
    "X-Request-ID": requestFingerprint(),
    "X-Platform": "liste",
    ...(options.headers || {}),
  };

  // Auto-refresh if token expired
  if (tokens?.access && isTokenExpired(tokens.access) && tokens?.refresh) {
    try {
      const refreshRes = await fetchWithTimeout(`${BASE_URL}/admin/refresh-token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.access) {
          await saveTokens(data.access, data.refresh || tokens.refresh);
          headers["Authorization"] = `Bearer ${data.access}`;
        }
      }
    } catch (e) { __DEV__ && console.warn('[api] token refresh failed:', e.message); }
  } else if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }

  const url = `${BASE_URL}${endpoint}`;
  let res = await fetchWithTimeout(url, { ...options, headers });

  // If 401, try refresh once more
  if (res.status === 401 && tokens?.refresh) {
    try {
      const refreshRes = await fetchWithTimeout(`${BASE_URL}/admin/refresh-token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.access) {
          await saveTokens(data.access, data.refresh || tokens.refresh);
          headers["Authorization"] = `Bearer ${data.access}`;
          res = await fetchWithTimeout(url, { ...options, headers });
        }
      }
    } catch (e) { __DEV__ && console.warn('[api] token refresh retry failed:', e.message); }
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

// ========== SAFE JSON PARSE ==========

async function safeJson(res) {
  try {
    const data = await res.json();
    return sanitizeResponse(data);
  } catch (e) {
    __DEV__ && console.warn('[api] JSON parse failed:', e.message, 'status:', res.status);
    return { error: true, message: 'Invalid server response', status: res.status };
  }
}

// ========== API METHODS ==========

export async function apiGet(endpoint) {
  const res = await apiFetch(endpoint, { method: "GET" });
  return safeJson(res);
}

export async function apiPost(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return safeJson(res);
}

export async function apiPut(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return safeJson(res);
}

export async function apiDelete(endpoint) {
  const res = await apiFetch(endpoint, { method: "DELETE" });
  return safeJson(res);
}

export async function apiUpload(endpoint, formData) {
  const tokens = await getTokens();
  const headers = { "X-Request-ID": requestFingerprint() };
  if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }
  const res = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });
  return safeJson(res);
}

export { BASE_URL };
