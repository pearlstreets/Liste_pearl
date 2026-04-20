// Crash-proof JSON parser. Returns fallback instead of throwing on:
// - null/undefined/empty input
// - malformed JSON (corrupted AsyncStorage)
// - parsed-but-null values (JSON.parse('null') === null)
export function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (_e) {
    return fallback;
  }
}

// Same, but also guarantees the result is an array. Useful for storage
// that historically held an array (cart, orders, favorites) where a
// corrupted blob could otherwise crash .map/.filter/.find calls.
export function safeParseArray(raw) {
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export default safeParse;
