import {
  parseRequest,
  expressSlots,
  expressProfile,
  draftMeals,
  dropDraftMeal,
} from '../lib/menus/express';
import {
  enseignesFor,
  adapterFor,
  estimateCart,
  registerPartner,
  unregisterPartner,
} from '../lib/menus/enseignes';

const on = (slots) => Object.keys(slots).filter((k) => slots[k]);

describe('parseRequest', () => {
  test('phrase complète en français', () => {
    const r = parseRequest(
      'Prépare-moi 5 recettes pour la semaine, 30 minutes max, végétarien, pour 4 personnes'
    );
    expect(r.count).toBe(5);
    expect(r.maxTime).toBe(30);
    expect(r.persons).toBe(4);
    expect(r.diets).toEqual(['vegetarien']);
  });
  test('nombre en lettres, midi, pas cher', () => {
    const r = parseRequest('trois déjeuners pas chers');
    expect(r.count).toBe(3);
    expect(r.slot).toBe('midi');
    expect(r.cheap).toBe(true);
  });
  test('« pour 5 recettes » n’est pas un nombre de personnes', () => {
    expect(parseRequest('pour 5 recettes').persons).toBeNull();
  });
  test('vegan remplace végétarien, bornes du nombre', () => {
    expect(parseRequest('20 repas vegan végétarien').diets).toEqual(['vegan']);
    expect(parseRequest('20 repas').count).toBe(14);
  });
  test('anglais', () => {
    const r = parseRequest('4 quick dinners with chicken for 2 people');
    expect(r).toMatchObject({ count: 4, maxTime: 30, persons: 2, likes: ['volaille'] });
  });
  test('phrase vide : 5 soirs par défaut', () => {
    expect(parseRequest('').count).toBe(5);
    expect(parseRequest('').understood).toEqual([]);
  });
});

describe('expressSlots', () => {
  test('N premiers soirs, jamais le matin', () => {
    expect(on(expressSlots({ count: 3, slot: 'soir' }))).toEqual(['0-soir', '1-soir', '2-soir']);
  });
  test('au-delà de 7 : midi et soir', () => {
    expect(on(expressSlots({ count: 9 })).length).toBe(9);
  });
  test('créneaux confirmés prioritaires', () => {
    const s = expressSlots({ count: 5, keys: ['2-soir', '4-midi', 'x'] });
    expect(on(s).sort()).toEqual(['2-soir', '4-midi']);
  });
});

describe('expressProfile', () => {
  test('ajoute la demande sans lever les interdits du profil', () => {
    const p = expressProfile(
      { diets: ['sans-porc'], maxTimeMin: 20 },
      parseRequest('5 recettes végétariennes 45 minutes pas cher')
    );
    expect(p.diets).toEqual(expect.arrayContaining(['sans-porc', 'vegetarien', 'economique']));
    expect(p.maxTimeMin).toBe(20);
    expect(p.useLeftovers).toBe(false);
  });
});

describe('brouillon', () => {
  test('draftMeals ignore restes et repas libres, dropDraftMeal retire', () => {
    const plan = {
      meals: [
        { key: '0-soir', recipeId: 'a' },
        { key: '1-soir', recipeId: 'a', leftoverOf: '0-soir' },
        { key: '2-soir', free: true },
      ],
    };
    expect(draftMeals(plan).map((m) => m.key)).toEqual(['0-soir']);
    expect(draftMeals(dropDraftMeal(plan, '0-soir'))).toEqual([]);
  });
});

describe('enseignes', () => {
  test('modes', () => {
    expect(enseignesFor('magasin').map((e) => e.id)).toEqual(['lidl']);
    expect(enseignesFor('drive').map((e) => e.id)).not.toContain('monoprix');
  });
  test('panier estimé : liens de recherche et total', () => {
    const c = estimateCart(
      [
        { key: 'tomate', estimatedEur: 1.2, priceKnown: true },
        { key: 'riz', estimatedEur: 0.9, priceKnown: true },
      ],
      'auchan',
      (k) => k
    );
    expect(c.total).toBe(2.1);
    expect(c.approx).toBe(true);
    expect(c.items[0].searchUrl).toBe('https://www.auchan.fr/recherche?text=tomate');
    expect(estimateCart([{ key: 'riz' }], 'lidl').items[0].searchUrl).toBeNull();
  });
  test('partenaire branché puis retiré', () => {
    expect(registerPartner('inconnu', {})).toBe(false);
    expect(registerPartner('leclerc', { capabilities: { cart: true } })).toBe(true);
    expect(adapterFor('leclerc')).toMatchObject({
      partner: true,
      capabilities: { cart: true, prices: false },
    });
    unregisterPartner('leclerc');
    expect(adapterFor('leclerc').partner).toBe(false);
  });
});
