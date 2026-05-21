import AsyncStorage from '@react-native-async-storage/async-storage';

// ========== INPUT VALIDATION ==========

// Sanitize text input - prevent XSS
export function sanitize(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// Validate email format
export function isValidEmail(email) {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
}

// Validate password strength
export function isStrongPassword(password) {
  if (!password || password.length < 6) return { valid: false, reason: 'min6' };
  if (password.length > 128) return { valid: false, reason: 'tooLong' };
  return { valid: true };
}

// Sanitize phone number
export function sanitizePhone(phone) {
  return String(phone || '')
    .replace(/[^0-9+\s()-]/g, '')
    .trim();
}

// ========== RATE LIMITING ==========

const rateLimits = {};

// Rate limit: max attempts per window
export function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimits[key]) rateLimits[key] = [];

  // Clean old attempts
  rateLimits[key] = rateLimits[key].filter((t) => now - t < windowMs);

  if (rateLimits[key].length >= maxAttempts) {
    const waitMs = windowMs - (now - rateLimits[key][0]);
    return { allowed: false, waitSeconds: Math.ceil(waitMs / 1000) };
  }

  rateLimits[key].push(now);
  return { allowed: true };
}

// ========== SECURE STORAGE ==========

// Store sensitive data with prefix
const SECURE_PREFIX = '__SECURE__';

export async function secureStore(key, value) {
  try {
    const data = JSON.stringify({ v: value, t: Date.now() });
    await AsyncStorage.setItem(SECURE_PREFIX + key, data);
  } catch {}
}

export async function secureGet(key) {
  try {
    const raw = await AsyncStorage.getItem(SECURE_PREFIX + key);
    if (!raw) return null;
    const { v } = JSON.parse(raw);
    return v;
  } catch {
    return null;
  }
}

export async function secureRemove(key) {
  await AsyncStorage.removeItem(SECURE_PREFIX + key);
}

// ========== TOKEN SECURITY ==========

// Check if JWT token is expired
export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// ========== ANTI-TAMPERING ==========

// Simple hash for data integrity
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Verify data integrity
export async function storeWithIntegrity(key, data) {
  const json = JSON.stringify(data);
  const hash = simpleHash(json);
  await AsyncStorage.setItem(key, json);
  await AsyncStorage.setItem(key + '_hash', hash);
}

export async function getWithIntegrity(key) {
  const json = await AsyncStorage.getItem(key);
  const storedHash = await AsyncStorage.getItem(key + '_hash');
  if (!json) return null;
  const hash = simpleHash(json);
  if (storedHash && hash !== storedHash) {
    // Data tampered — clear it
    await AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem(key + '_hash');
    return null;
  }
  return JSON.parse(json);
}

// ========== REQUEST SECURITY ==========

// Generate request fingerprint
export function requestFingerprint() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Sanitize API response — strip potentially dangerous fields
export function sanitizeResponse(data) {
  if (!data || typeof data !== 'object') return data;
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const clean = Array.isArray(data) ? [] : {};
  for (const key of Object.keys(data)) {
    if (dangerous.includes(key)) continue;
    clean[key] = typeof data[key] === 'object' ? sanitizeResponse(data[key]) : data[key];
  }
  return clean;
}
