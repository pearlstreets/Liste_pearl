// Isolement des expressions « nombre + unité latine » dans un texte en arabe.
import { isolerUnitesLatines } from '../lib/texteBidi';

const iso = (s) => `\u2066${s}\u2069`;

describe('isolerUnitesLatines', () => {
  test('arabe : température isolée en gauche à droite', () => {
    expect(isolerUnitesLatines('سخنوا الفرن على 200 °C.', 'ar')).toBe(
      `سخنوا الفرن على ${iso('200 °C')}.`
    );
    expect(isolerUnitesLatines('إلى 180°C و', 'ar')).toBe(`إلى ${iso('180°C')} و`);
    expect(isolerUnitesLatines('على 350 °F', 'ar')).toBe(`على ${iso('350 °F')}`);
  });

  test('arabe : quantités et durées, même collées à une lettre arabe', () => {
    expect(isolerUnitesLatines('ورق الغار و60 cl من الماء', 'ar')).toBe(
      `ورق الغار و${iso('60 cl')} من الماء`
    );
    expect(isolerUnitesLatines('لمدة 1 h 30، مع', 'ar')).toBe(`لمدة ${iso('1 h 30')}، مع`);
    expect(isolerUnitesLatines('لمدة 2 h.', 'ar')).toBe(`لمدة ${iso('2 h')}.`);
    expect(isolerUnitesLatines('250 g و 1,5 kg و 120 kcal و 10 min', 'ar')).toBe(
      `${iso('250 g')} و ${iso('1,5 kg')} و ${iso('120 kcal')} و ${iso('10 min')}`
    );
    expect(isolerUnitesLatines('على 180-200 °C', 'ar')).toBe(`على ${iso('180-200 °C')}`);
  });

  test('arabe : rien à isoler sans unité latine, ni dans un mot latin', () => {
    expect(isolerUnitesLatines('أضيفوا 3 بيضات', 'ar')).toBe('أضيفوا 3 بيضات');
    expect(isolerUnitesLatines('محار n°3 Marennes', 'ar')).toBe('محار n°3 Marennes');
    expect(isolerUnitesLatines('B12g', 'ar')).toBe('B12g');
    expect(isolerUnitesLatines('5 grammes', 'ar')).toBe('5 grammes');
  });

  test('idempotent', () => {
    const une = isolerUnitesLatines('على 200 °C', 'ar');
    expect(isolerUnitesLatines(une, 'ar')).toBe(une);
  });

  test('autres langues : texte inchangé', () => {
    for (const lang of ['fr', 'en', 'sv', 'zh', undefined]) {
      expect(isolerUnitesLatines('Préchauffez le four à 200 °C, 60 cl, 1 h 30.', lang)).toBe(
        'Préchauffez le four à 200 °C, 60 cl, 1 h 30.'
      );
    }
    expect(isolerUnitesLatines(null, 'ar')).toBe(null);
  });
});
