// Live exchange rates fetcher with 30-min cache and graceful fallback.
// Primary source: frankfurter.app  ·  Fallback: open.er-api.com
// If both fail, callers keep the hardcoded rates shipped in data/currencies.js.

import { CURRENCIES } from '../data/currencies';

export const RATES_CACHE_MS = 30 * 60 * 1000; // 30 min

let _liveRates = null;
let _liveRatesTs = 0;

// Returns the currently-cached live-rates map, or null if nothing cached yet.
// Callers that need a fresh fetch should await fetchLiveRates().
export function getCachedLiveRates() {
  return _liveRates;
}

// Exposed for tests only — resets module-level cache between cases.
export function __resetRatesCacheForTests() {
  _liveRates = null;
  _liveRatesTs = 0;
}

export async function fetchLiveRates() {
  if (_liveRates && Date.now() - _liveRatesTs < RATES_CACHE_MS) return _liveRates;
  try {
    const codes = CURRENCIES.filter((c) => c.code !== 'EUR')
      .map((c) => c.code)
      .join(',');
    const resp = await fetch('https://api.frankfurter.app/latest?from=EUR&to=' + codes);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    if (data && data.rates) {
      _liveRates = data.rates;
      _liveRatesTs = Date.now();
      return _liveRates;
    }
  } catch (_) {
    try {
      const resp2 = await fetch('https://open.er-api.com/v6/latest/EUR');
      const data2 = await resp2.json();
      if (data2 && data2.rates) {
        _liveRates = data2.rates;
        _liveRatesTs = Date.now();
        return _liveRates;
      }
    } catch (__) {
      /* swallow — callers fall back to static rates */
    }
  }
  return null;
}

export function getCurrencyWithLiveRate(currObj, liveRates) {
  if (!liveRates || currObj.code === 'EUR') return currObj;
  const liveRate = liveRates[currObj.code];
  if (liveRate && isFinite(liveRate)) return { ...currObj, rate: liveRate };
  return currObj;
}
