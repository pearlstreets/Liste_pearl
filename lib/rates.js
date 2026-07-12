// Live exchange rates fetcher with 30-min cache and graceful fallback.
// Primary source: open.er-api.com (base EUR, ~160 currencies incl. exotic /
//   hyperinflation ones like VES, ARS, NGN...).
// Fallback: frankfurter.app (ECB, ~30 major currencies) — used only if open.er-api
//   is unreachable. NB: frankfurter answers HTTP 200 with a PARTIAL dict and silently
//   omits every non-ECB currency, so it must NOT be primary (would freeze ~110
//   currencies on stale static rates).
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
  // Primary: open.er-api — base EUR, full currency coverage (~160), so exotic /
  // hyperinflation currencies (VES, ARS, NGN...) get a real live rate.
  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/EUR');
    const data = await resp.json();
    // Guard against a truncated/error body: require an explicit success flag or a
    // clearly-populated rates map before trusting it.
    if (data && data.rates && (data.result === 'success' || Object.keys(data.rates).length > 20)) {
      _liveRates = data.rates;
      _liveRatesTs = Date.now();
      return _liveRates;
    }
  } catch (_) {
    /* fall through to frankfurter */
  }
  // Fallback: frankfurter (ECB reference rates, ~30 majors) — only reached when
  // open.er-api is unreachable. Covers the common currencies; the rest stay on
  // the static rates shipped in data/currencies.js until open.er-api is back.
  try {
    const codes = CURRENCIES.filter((c) => c.code !== 'EUR')
      .map((c) => c.code)
      .join(',');
    const resp2 = await fetch('https://api.frankfurter.app/latest?from=EUR&to=' + codes);
    if (resp2.ok) {
      const data2 = await resp2.json();
      if (data2 && data2.rates) {
        _liveRates = data2.rates;
        _liveRatesTs = Date.now();
        return _liveRates;
      }
    }
  } catch (__) {
    /* swallow — callers fall back to static rates */
  }
  return null;
}

export function getCurrencyWithLiveRate(currObj, liveRates) {
  if (!liveRates || currObj.code === 'EUR') return currObj;
  const liveRate = liveRates[currObj.code];
  if (liveRate && isFinite(liveRate)) return { ...currObj, rate: liveRate };
  return currObj;
}
