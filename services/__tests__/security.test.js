import { sanitize, isValidEmail, isStrongPassword, checkRateLimit, sanitizePhone, simpleHash, sanitizeResponse } from '../security';

describe('sanitize', () => {
  it('escapes HTML characters', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
  });
  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
  it('returns empty string for non-string', () => {
    expect(sanitize(123)).toBe('');
    expect(sanitize(null)).toBe('');
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.co')).toBe(true);
  });
  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isStrongPassword', () => {
  it('rejects short passwords', () => {
    expect(isStrongPassword('abc')).toEqual({ valid: false, reason: 'min6' });
  });
  it('rejects too long passwords', () => {
    expect(isStrongPassword('a'.repeat(129))).toEqual({ valid: false, reason: 'tooLong' });
  });
  it('accepts valid passwords', () => {
    expect(isStrongPassword('Test@123')).toEqual({ valid: true });
  });
});

describe('sanitizePhone', () => {
  it('strips invalid characters', () => {
    expect(sanitizePhone('+33 6 12 34 56 78')).toBe('+33 6 12 34 56 78');
    expect(sanitizePhone('abc+33def')).toBe('+33');
  });
});

describe('checkRateLimit', () => {
  it('allows first attempts', () => {
    expect(checkRateLimit('test-key-1', 5, 60000).allowed).toBe(true);
  });
  it('blocks after max attempts', () => {
    const key = 'test-key-block-' + Date.now();
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60000);
    expect(checkRateLimit(key, 5, 60000).allowed).toBe(false);
  });
});

describe('simpleHash', () => {
  it('produces consistent hashes', () => {
    expect(simpleHash('hello')).toBe(simpleHash('hello'));
  });
  it('produces different hashes for different inputs', () => {
    expect(simpleHash('hello')).not.toBe(simpleHash('world'));
  });
});

describe('sanitizeResponse', () => {
  it('preserves safe keys and strips dangerous values', () => {
    const result = sanitizeResponse({ name: 'test', age: 25 });
    expect(result).toEqual({ name: 'test', age: 25 });
  });
  it('recursively sanitizes nested objects', () => {
    const result = sanitizeResponse({ user: { name: 'test', nested: { ok: true } } });
    expect(result.user.nested.ok).toBe(true);
  });
  it('handles arrays', () => {
    const result = sanitizeResponse([{ a: 1 }, { b: 2 }]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
  it('handles null/undefined', () => {
    expect(sanitizeResponse(null)).toBeNull();
    expect(sanitizeResponse(undefined)).toBeUndefined();
  });
});
