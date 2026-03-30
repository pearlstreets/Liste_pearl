import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "./config";

// Base URL from config (local/staging/production)
const BASE_URL = CONFIG.API_URL;

const TOKEN_KEY = "MARKETPLACE_TOKENS";

// Store JWT tokens
export async function saveTokens(access, refresh) {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify({ access, refresh }));
}

// Get stored tokens
export async function getTokens() {
  const raw = await AsyncStorage.getItem(TOKEN_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Clear tokens on logout
export async function clearTokens() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// Generic fetch with JWT auth and auto-refresh
async function apiFetch(endpoint, options = {}) {
  const tokens = await getTokens();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }

  const url = `${BASE_URL}${endpoint}`;

  let res = await fetch(url, { ...options, headers });

  // If 401, try to refresh the token
  if (res.status === 401 && tokens?.refresh) {
    const refreshRes = await fetch(`${BASE_URL}/admin/refresh-token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      if (data.access) {
        await saveTokens(data.access, tokens.refresh);
        headers["Authorization"] = `Bearer ${data.access}`;
        res = await fetch(url, { ...options, headers });
      }
    }
  }

  return res;
}

// Convenience methods
export async function apiGet(endpoint) {
  const res = await apiFetch(endpoint, { method: "GET" });
  return res.json();
}

export async function apiPost(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiPut(endpoint, body) {
  const res = await apiFetch(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiDelete(endpoint) {
  const res = await apiFetch(endpoint, { method: "DELETE" });
  return res.json();
}

// Multipart form data upload (for images, files)
export async function apiUpload(endpoint, formData) {
  const tokens = await getTokens();
  const headers = {};
  if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });
  return res.json();
}

export { BASE_URL };
