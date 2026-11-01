// Pluriels i18next (format v4) : formes justes pour ar, ru, fr, en, avec Intl.PluralRules
// du moteur et avec les regles de secours de i18n.js (moteur sans Intl.PluralRules).
jest.mock('react-native', () => ({ I18nManager: {}, DevSettings: { reload: () => {} } }), { virtual: true });
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => {} } }), { virtual: true });
jest.mock('expo-localization', () => ({ locale: 'fr-FR' }), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
}), { virtual: true });
jest.mock('../lib/sensEcriture', () => ({ appliquerSensEcriture: () => Promise.resolve() }));

const i18next = require('i18next');
const { categoriePluriel, installerPluralRulesDeSecours } = require('../i18n');

const LANGUES = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ar', 'sv', 'th'];
const resources = {};
for (const l of LANGUES) resources[l] = { translation: require(`../locales/${l}.json`) };

function instance(lng) {
  const i = i18next.createInstance();
  i.init({ resources, lng, fallbackLng: false, initAsync: false, interpolation: { escapeValue: false } });
  return i;
}

const NOMBRES = [0, 1, 2, 3, 11, 100];
const ATTENDU = {
  ar: ['0 منتج', 'منتج واحد', 'منتجان', '3 منتجات', '11 منتجًا', '100 منتج'],
  ru: ['0 товаров', '1 товар', '2 товара', '3 товара', '11 товаров', '100 товаров'],
  fr: ['0 produit', '1 produit', '2 produits', '3 produits', '11 produits', '100 produits'],
  en: ['0 products', '1 product', '2 products', '3 products', '11 products', '100 products'],
};

function verifierFormes() {
  for (const [lng, formes] of Object.entries(ATTENDU)) {
    const i = instance(lng);
    NOMBRES.forEach((n, k) => {
      expect(i.t('counts.products', { count: n })).toBe(formes[k]);
    });
  }
  const ru = instance('ru');
  expect(ru.t('counts.shops', { count: 21 })).toBe('21 магазин');
  expect(ru.t('counts.shops', { count: 24 })).toBe('24 магазина');
  expect(ru.t('counts.shops', { count: 112 })).toBe('112 магазинов');
  const ar = instance('ar');
  expect(ar.t('counts.items', { count: 0 })).toBe('0 منتج');
  expect(ar.t('counts.shops', { count: 102 })).toBe('102 متجر');
  expect(ar.t('counts.shops', { count: 105 })).toBe('105 متاجر');
  const fr = instance('fr');
  expect(fr.t('menus.share.for', { count: 1 })).toBe('Pour 1 personne');
  expect(fr.t('menus.share.for', { count: 4 })).toBe('Pour 4 personnes');
  expect(fr.t('counts.products', { count: 1000000 })).toBe('1000000 produits');
  const en = instance('en');
  expect(en.t('menus.history.meals', { count: 1 })).toBe('1 meal');
  expect(en.t('menus.history.meals', { count: 3 })).toBe('3 meals');
}

describe('pluriels', () => {
  test('formes justes avec Intl.PluralRules du moteur', () => {
    verifierFormes();
  });

  test('regles de secours identiques a CLDR (Intl de Node) pour les 13 langues', () => {
    const entiers = [];
    for (let n = 0; n <= 1200; n++) entiers.push(n);
    entiers.push(1000000, 2000000, 1000001);
    for (const l of LANGUES) {
      const pr = new Intl.PluralRules(l);
      for (const n of entiers) expect(`${l} ${n} ${categoriePluriel(l, n)}`).toBe(`${l} ${n} ${pr.select(n)}`);
    }
  });

  test('regles de secours installees seulement si Intl.PluralRules manque', () => {
    expect(installerPluralRulesDeSecours()).toBe(false);
    const g = { Intl: {} };
    expect(installerPluralRulesDeSecours(g)).toBe(true);
    const pr = new g.Intl.PluralRules('ar');
    expect(pr.select(11)).toBe('many');
    expect(pr.resolvedOptions().pluralCategories).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
    expect(installerPluralRulesDeSecours({})).toBe(true);
  });

  test('formes justes sans Intl.PluralRules (moteur JS sans Intl complet)', () => {
    const origine = Intl.PluralRules;
    try {
      Intl.PluralRules = undefined;
      expect(installerPluralRulesDeSecours()).toBe(true);
      verifierFormes();
    } finally {
      Intl.PluralRules = origine;
    }
  });

  test('chaque cle counts.* a toutes les formes de chaque langue', () => {
    for (const l of LANGUES) {
      const cats = new Intl.PluralRules(l).resolvedOptions().pluralCategories;
      const c = resources[l].translation.counts;
      for (const cle of Object.keys(resources.fr.translation.counts)) {
        if (/_(zero|one|two|few|many|other)$/.test(cle)) continue;
        expect(typeof c[cle]).toBe('string');
        for (const cat of cats) expect(`${l} ${cle}_${cat} ${typeof c[`${cle}_${cat}`]}`).toBe(`${l} ${cle}_${cat} string`);
      }
    }
  });
});
