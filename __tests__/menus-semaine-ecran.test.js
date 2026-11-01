// Ecran Ma semaine : nombre entier de convives sur les cartes, bandeau « semaine modifiee depuis le dernier ajout »
// affiche seulement apres un ajout a la liste pour cette semaine.
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (x) => x },
  DeviceEventEmitter: { addListener: () => ({ remove() {} }), emit() {} },
  InteractionManager: { runAfterInteractions: (f) => (f(), { cancel() {} }) },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
  Platform: { OS: 'android', select: (o) => o.android },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k, i18n: {} }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../components/ui/IoniconsSens', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../components/menus/RecipeVisual', () => 'RecipeVisual');
jest.mock('../components/menus/theme', () => ({ T: {} }));
jest.mock('../components/menus/ui', () => ({}));
jest.mock('../components/menus/Sheets', () => ({}));
jest.mock('../components/menus/MenusContext', () => ({ useMenus: () => null }));
jest.mock('../components/menus/usePearl', () => ({}));
jest.mock('../components/menus/useT', () => () => (k) => k);
jest.mock('../lib/menus/listBridge', () => ({}));
jest.mock('../lib/menus/pearl', () => ({ nearbyShops: () => [] }));
describe('ecran Ma semaine : convives et bandeau', () => {
  const { headcountFor, changedSinceLastSend } = require('../components/menus/WeekScreen');

  test('convives : nombre entier de personnes (adultes + enfants), enfants a la cantine le midi en semaine', () => {
    const p = { adults: 2, children: 2, kidsCantine: true };
    expect(headcountFor(p, 0, 'midi')).toBe(2);
    expect(headcountFor(p, 0, 'soir')).toBe(4);
    expect(headcountFor(p, 5, 'midi')).toBe(4);
    expect(headcountFor({ adults: 1 }, 0, 'midi')).toBe(1);
    expect(headcountFor(null, 0, 'midi')).toBeGreaterThanOrEqual(1);
  });

  test('bandeau : seulement apres un ajout a la liste de cette semaine, puis une modification', () => {
    const plan = {
      weekStart: '2026-11-02',
      meals: [
        { key: '0-midi', day: 0, slot: 'midi', recipeId: 'a', persons: 2 },
        { key: '0-soir', day: 0, slot: 'soir', recipeId: 'b', persons: 2 },
      ],
    };
    expect(changedSinceLastSend(plan, [])).toBe(false);
    expect(changedSinceLastSend(plan, [{ ...plan, weekStart: '2026-10-26', meals: [] }])).toBe(false);
    expect(changedSinceLastSend(plan, [{ ...plan, savedAt: 1 }])).toBe(false);
    const swapped = { ...plan, meals: [plan.meals[0], { ...plan.meals[1], recipeId: 'c' }] };
    expect(changedSinceLastSend(swapped, [{ ...plan, savedAt: 1 }])).toBe(true);
    // le dernier envoi de la semaine compte
    expect(changedSinceLastSend(swapped, [{ ...plan, savedAt: 1 }, { ...swapped, savedAt: 2 }])).toBe(false);
  });
});
