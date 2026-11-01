// Prix dans les cartes en arabe : le montant est isole en gauche a droite (« 3.24 € » ne devient plus « € 3.24 »),
// aucune retouche dans les langues ecrites de gauche a droite.
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (x) => x },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k, i18n: {} }) }));
jest.mock('../components/ui/IoniconsSens', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../components/menus/RecipeVisual', () => 'RecipeVisual');
jest.mock('../components/menus/theme', () => ({ T: {} }));

const { isolerPrix } = require('../components/menus/MealCard');
const { formatEur } = require('../lib/menus/pricing');

// montant isole, espaces insecables (le montant et sa devise restent sur la meme ligne)
const iso = (x) => `\u2066${x.replace(/\s/g, '\u00a0')}\u2069`;

describe('isolerPrix', () => {
  test('arabe : montant isole, texte arabe intact', () => {
    const prix = formatEur(3.24, 'ar');
    expect(isolerPrix(`${prix} للشخص`, 'ar')).toBe(`${iso(prix)} للشخص`);
    expect(isolerPrix('25 دقيقة · 3.24 € للشخص', 'ar')).toBe(`25 دقيقة · ${iso('3.24 €')} للشخص`);
    expect(isolerPrix('~12.50 € و €3.00', 'ar')).toBe(`${iso('~12.50 €')} و ${iso('€3.00')}`);
    expect(isolerPrix('7 € x', 'ar-SA')).toBe(`${iso('7 €')} x`);
    // fin de phrase : « 20.98 € » garde sa devise, aucune espace secable dans le montant isole
    const fin = isolerPrix('نحو 20.98 €.', 'ar');
    expect(fin).toBe(`نحو ${iso('20.98 €')}.`);
    expect(fin).toContain('20.98 €');
  });

  test('langues de gauche a droite : texte inchange (francais compris)', () => {
    for (const lang of ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'sv', 'th']) {
      const txt = `${formatEur(3.24, lang)} / pers.`;
      expect(isolerPrix(txt, lang)).toBe(txt);
    }
  });

  test('entrees vides ou non textuelles : renvoyees telles quelles', () => {
    expect(isolerPrix('', 'ar')).toBe('');
    expect(isolerPrix(undefined, 'ar')).toBe(undefined);
    expect(isolerPrix(null, 'ar')).toBe(null);
    expect(isolerPrix('sans prix', 'ar')).toBe('sans prix');
  });
});
