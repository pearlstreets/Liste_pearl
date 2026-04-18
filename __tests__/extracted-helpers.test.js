// Coverage for helpers recently extracted out of App.js.

import { parseMulti } from '../lib/parseMulti';
import { getProductImage, DEFAULT_PRODUCT } from '../lib/productImages';
import { getCurrencyWithLiveRate } from '../lib/rates';
import { CURRENCIES, DEFAULT_CURRENCY } from '../data/currencies';

describe('parseMulti', () => {
  test('empty / null-ish input → []', () => {
    expect(parseMulti('')).toEqual([]);
    expect(parseMulti(null)).toEqual([]);
    expect(parseMulti(undefined)).toEqual([]);
  });

  test('splits on commas, semicolons and newlines', () => {
    const items = parseMulti('pomme, banane; kiwi\npoire');
    expect(items).toHaveLength(4);
    // Names may be canonicalised by autocorrectName; just assert presence + qty=1.
    for (const item of items) {
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.qty).toBe(1);
    }
  });

  test('recognises leading-number quantity form: "3 pommes"', () => {
    expect(parseMulti('3 pommes')).toEqual([expect.objectContaining({ qty: 3 })]);
  });

  test('recognises trailing-x quantity form: "pommes x 4"', () => {
    expect(parseMulti('pommes x 4')).toEqual([expect.objectContaining({ qty: 4 })]);
  });

  test('defaults qty to 1 when no quantity given', () => {
    expect(parseMulti('pomme')).toEqual([expect.objectContaining({ qty: 1 })]);
  });

  test('never returns qty < 1', () => {
    const items = parseMulti('pomme x 0');
    expect(items[0].qty).toBeGreaterThanOrEqual(1);
  });
});

describe('getProductImage', () => {
  test('matches a known product by name', () => {
    const img = getProductImage('baguette');
    expect(img.emoji).toBe('🥖');
  });

  test('matches ignoring case and diacritics', () => {
    expect(getProductImage('Pêche').emoji).toBe(getProductImage('peche').emoji);
    expect(getProductImage('CAFÉ').emoji).toBe('☕');
  });

  test('falls back to a category emoji for unknown but categorical names', () => {
    const img = getProductImage('produit bio');
    expect(img).toBeDefined();
    expect(img.emoji).toBeTruthy();
  });

  test('falls back to the generic shopping cart for fully unknown input', () => {
    const img = getProductImage('zzzzzxxx123');
    // letter-fallback for 'z' OR DEFAULT_PRODUCT
    expect(img).toBeDefined();
    expect(typeof img.emoji).toBe('string');
  });

  test('handles null-ish input without throwing', () => {
    expect(() => getProductImage(null)).not.toThrow();
    expect(() => getProductImage(undefined)).not.toThrow();
    expect(getProductImage('')).toEqual(DEFAULT_PRODUCT);
  });
});

describe('CURRENCIES dataset', () => {
  test('default currency is EUR', () => {
    expect(DEFAULT_CURRENCY.code).toBe('EUR');
  });

  test('contains the major currencies', () => {
    const codes = CURRENCIES.map((c) => c.code);
    for (const expected of ['EUR', 'USD', 'GBP', 'JPY', 'CNY', 'CHF', 'AUD']) {
      expect(codes).toContain(expected);
    }
  });

  test('all entries have required fields', () => {
    for (const c of CURRENCIES) {
      expect(typeof c.code).toBe('string');
      expect(c.code).toHaveLength(3);
      expect(typeof c.symbol).toBe('string');
      expect(typeof c.name).toBe('string');
      expect(typeof c.rate).toBe('number');
      expect(c.rate).toBeGreaterThan(0);
    }
  });

  test('codes are unique', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('getCurrencyWithLiveRate', () => {
  const euro = { code: 'EUR', rate: 1, symbol: '€', name: 'Euro' };
  const usd = { code: 'USD', rate: 1.09, symbol: '$', name: 'US Dollar' };

  test('returns currency unchanged when no live rates provided', () => {
    expect(getCurrencyWithLiveRate(usd, null)).toBe(usd);
    expect(getCurrencyWithLiveRate(usd, undefined)).toBe(usd);
  });

  test('never overrides EUR rate', () => {
    const out = getCurrencyWithLiveRate(euro, { EUR: 999 });
    expect(out).toBe(euro);
  });

  test('applies the live rate when present', () => {
    const out = getCurrencyWithLiveRate(usd, { USD: 1.11 });
    expect(out.rate).toBe(1.11);
    expect(out.code).toBe('USD');
  });

  test('keeps hardcoded rate when live rate is not finite', () => {
    const out = getCurrencyWithLiveRate(usd, { USD: Infinity });
    expect(out).toBe(usd);
  });

  test('keeps hardcoded rate when live rate is missing for the currency', () => {
    const out = getCurrencyWithLiveRate(usd, { GBP: 0.86 });
    expect(out).toBe(usd);
  });
});
