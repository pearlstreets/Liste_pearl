import { normaliserDetail, libelleDetail } from '../lib/libelleDetail';
import SEARCH_MAP from '../data/search-map.json';
import fr from '../locales/fr.json';

describe('normaliserDetail', () => {
  it('remplace le demi-cadratin et le cadratin par un point médian', () => {
    expect(normaliserDetail('Origine France – 1kg')).toBe('Origine France · 1kg');
    expect(normaliserDetail('Barquette – 350g – 5%')).toBe('Barquette · 350g · 5%');
    expect(normaliserDetail('Sachet—500g')).toBe('Sachet · 500g');
  });
  it('laisse intact un libellé sans tiret et gère les valeurs vides', () => {
    expect(normaliserDetail('Pièce')).toBe('Pièce');
    expect(normaliserDetail('Sans-gluten')).toBe('Sans-gluten');
    expect(normaliserDetail(null)).toBe('');
    expect(normaliserDetail(undefined)).toBe('');
  });
});

describe('libelleDetail', () => {
  const tFr = (key, opts) => {
    const k = key.replace(/^productDetails\./, '');
    return Object.prototype.hasOwnProperty.call(fr.productDetails, k) ? fr.productDetails[k] : opts.defaultValue;
  };

  it('traduit par la clé brute (identifiant inchangé)', () => {
    const t = jest.fn(tFr);
    expect(libelleDetail('Origine France – 1kg', t)).toBe('Origine France · 1kg');
    expect(t).toHaveBeenCalledWith('productDetails.Origine France – 1kg', { defaultValue: 'Origine France – 1kg' });
  });

  it('aucun détail de search-map ne s affiche avec un tiret, traduit ou non', () => {
    const details = new Set();
    Object.values(SEARCH_MAP).forEach((arr) => arr.forEach((it) => it.detail && details.add(it.detail)));
    details.forEach((d) => {
      expect(libelleDetail(d, tFr)).not.toMatch(/[–—]/);
      expect(libelleDetail(d)).not.toMatch(/[–—]/);
    });
  });

  it('ancienne valeur de favori serveur : affichée normalisée', () => {
    expect(libelleDetail('Bouteille – 1,5L')).toBe('Bouteille · 1,5L');
    expect(libelleDetail('')).toBe('');
  });
});
