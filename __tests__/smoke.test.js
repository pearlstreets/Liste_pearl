// Smoke tests — verify pure helpers load and behave correctly.
import { normalizeText } from '../utils/spellcheck';

describe('normalizeText', () => {
  test('strips diacritics', () => {
    expect(normalizeText('Café')).toBe('cafe');
    expect(normalizeText('Crème brûlée')).toBe('creme brulee');
  });

  test('lowercases and trims whitespace', () => {
    expect(normalizeText('  HELLO   world  ')).toBe('hello world');
  });

  test('removes special punctuation but keeps hyphen and apostrophe', () => {
    expect(normalizeText('Saint-Émilion')).toBe('saint-emilion');
    expect(normalizeText("d'Artagnan!")).toBe("d'artagnan");
  });

  test('handles empty input without throwing', () => {
    expect(normalizeText('')).toBe('');
    expect(() => normalizeText(null)).not.toThrow();
    expect(() => normalizeText(undefined)).not.toThrow();
  });
});

describe('app structure', () => {
  test('essential modules can be required without error', () => {
    expect(() => require('../utils/spellcheck')).not.toThrow();
    expect(() => require('../utils/distributionMode')).not.toThrow();
  });
});
