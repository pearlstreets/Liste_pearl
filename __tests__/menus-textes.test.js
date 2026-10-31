// Pluriels russes et arabes, vouvoiement italien et arabe, emoji coupé.
import i18next from 'i18next';
import ru from '../locales/ru.json';
import ar from '../locales/ar.json';
import it from '../locales/it.json';
import fr from '../locales/fr.json';
import { coupeTexte } from '../lib/menus/util';
import { cleanMyRecipe } from '../lib/menus/myRecipes';

const creer = async () => {
  const i = i18next.createInstance();
  await i.init({
    lng: 'ru',
    fallbackLng: 'fr',
    resources: { ru: { translation: ru }, ar: { translation: ar }, fr: { translation: fr } },
    interpolation: { escapeValue: false },
  });
  return i;
};

describe('pluriels', () => {
  test.each([
    [1, 'В 1 рецепте'],
    [3, 'В 3 рецептах'],
    [5, 'В 5 рецептах'],
    [21, 'В 21 рецепте'],
  ])('russe, %i recette(s)', async (count, attendu) => {
    const i = await creer();
    expect(i.t('menus.shop.usedIn', { count, lng: 'ru' })).toBe(attendu);
  });

  test('russe, repas', async () => {
    const i = await creer();
    const t = (count) => i.t('menus.history.meals', { count, lng: 'ru' });
    expect([t(1), t(2), t(5)]).toEqual(['1 блюдо', '2 блюда', '5 блюд']);
  });

  test('arabe : un, deux, peu, beaucoup', async () => {
    const i = await creer();
    const t = (count) => i.t('menus.shop.usedIn', { count, lng: 'ar' });
    expect(t(1)).toBe('في وصفة واحدة');
    expect(t(2)).toBe('في وصفتين');
    expect(t(3)).toBe('في 3 وصفات');
    expect(t(11)).toBe('في 11 وصفة');
  });

  test('le français reste inchangé', async () => {
    const i = await creer();
    expect(i.t('menus.shop.usedIn', { count: 2, lng: 'fr' })).toBe(fr.menus.shop.usedIn.replace('{{count}}', '2'));
  });
});

describe('vouvoiement', () => {
  const textes = (o) =>
    Object.values(o).flatMap((v) => (v && typeof v === 'object' ? textes(v) : [String(v)]));

  test('italien : aucun impératif de tutoiement', () => {
    const tu = /^(Apri|Autorizza|Trova|Reimposta|Aggiungi|Importa|Rimuovi|Cambia|Salva|Esci|Elimina|Riprendi|Prepara|Segui)\b/;
    expect(textes(it.menus).filter((t) => tu.test(t))).toEqual([]);
  });

  test('arabe : aucun impératif au singulier', () => {
    const tu = /(^| )(أضف|اختر|تحقق|سجل|الصق|اسمح|جرب|اضغط|حدد|حاول|أدخل|أنشئ)( |$)/;
    expect(textes(ar.menus).filter((t) => tu.test(t))).toEqual([]);
  });
});

describe('texte coupé', () => {
  test('une moitié d emoji ne reste jamais en bout de texte', () => {
    const t = coupeTexte('ab😀', 3);
    expect(t).toBe('ab');
    expect(() => encodeURIComponent(t)).not.toThrow();
  });

  test('un emoji entier est gardé', () => {
    expect(coupeTexte('a😀b', 10)).toBe('a😀b');
  });

  test('le titre d une recette personnelle reste envoyable', () => {
    const r = cleanMyRecipe({ id: 'my-1', title: `${'x'.repeat(119)}😀😀`, ingredients: [{ name: 'riz', unit: 'g' }], steps: [] });
    expect(() => encodeURIComponent(r.title)).not.toThrow();
  });
});
