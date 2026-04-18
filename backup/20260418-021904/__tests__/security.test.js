// Tests for security helpers (pure functions, no AsyncStorage required).
// We mock the AsyncStorage import so the module loads cleanly in node.
import {
  sanitize,
  isValidEmail,
  isStrongPassword,
  sanitizePhone,
  checkRateLimit,
} from '../services/security';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('sanitize', () => {
  test('escapes HTML-sensitive chars', () => {
    expect(sanitize('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;'
    );
  });
  test('escapes quotes', () => {
    expect(sanitize(`"hi" 'there'`)).toBe('&quot;hi&quot; &#x27;there&#x27;');
  });
  test('returns empty for non-string', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(42)).toBe('');
  });
  test('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
});

describe('isValidEmail', () => {
  test.each([
    ['user@example.com', true],
    ['user.name+tag@example.co.uk', true],
    ['', false],
    ['no-at-symbol', false],
    ['@missing-user.com', false],
    ['missing@domain', false],
    ['spaces @nope.com', false],
  ])('isValidEmail(%j) → %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

describe('isStrongPassword', () => {
  test('rejects passwords shorter than 6 chars', () => {
    expect(isStrongPassword('abc')).toEqual({ valid: false, reason: 'min6' });
    expect(isStrongPassword('')).toEqual({ valid: false, reason: 'min6' });
  });
  test('rejects passwords over 128 chars', () => {
    expect(isStrongPassword('a'.repeat(129))).toEqual({ valid: false, reason: 'tooLong' });
  });
  test('accepts normal passwords', () => {
    expect(isStrongPassword('hunter2')).toEqual({ valid: true });
  });
});

describe('sanitizePhone', () => {
  test('keeps digits, + and common separators', () => {
    expect(sanitizePhone('+33 (6) 12-34-56-78')).toBe('+33 (6) 12-34-56-78');
  });
  test('strips letters and symbols', () => {
    expect(sanitizePhone('06abc78!!')).toBe('0678');
  });
  test('handles null-ish input', () => {
    expect(sanitizePhone(null)).toBe('');
    expect(sanitizePhone(undefined)).toBe('');
  });
});

describe('checkRateLimit', () => {
  test('allows up to max attempts, then blocks', () => {
    const key = 'test_rate_' + Math.random();
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60000);
    expect(blocked.allowed).toBe(false);
    expect(typeof blocked.waitSeconds).toBe('number');
  });
});
