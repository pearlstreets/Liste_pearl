// Unité « kcal » affichée dans les cartes et la fiche recette : traduite dans les 13 langues.
const LANGS = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ar', 'sv', 'th'];

describe('menus.kcal', () => {
  test.each(LANGS)('%s : unité présente, courte, sans tiret ni flèche', (l) => {
    const v = require(`../locales/${l}.json`).menus.kcal;
    expect(typeof v).toBe('string');
    expect(v.trim().length).toBeGreaterThan(0);
    expect(v.length).toBeLessThanOrEqual(12);
    expect(v).not.toMatch(/[\u2013\u2014\u2190-\u21FF]/);
  });

  test('kcal gardé là où c’est l’usage, unité locale ailleurs', () => {
    const v = (l) => require(`../locales/${l}.json`).menus.kcal;
    for (const l of ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'ja']) expect(v(l)).toBe('kcal');
    expect(v('ru')).toBe('ккал');
    expect(v('zh')).toBe('千卡');
  });
});
