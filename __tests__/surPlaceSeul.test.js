import { estRefusSurPlaceSeul, sansPlatsSurPlaceSeul, RAISON_SUR_PLACE_SEUL } from '../lib/surPlaceSeul';
import { apiGet } from '../services/api';
import { getShopsByCategory } from '../services/products';

jest.mock('../services/config', () => ({ CONFIG: { API_URL: 'https://api.test/api/v1' } }));
jest.mock('../services/api', () => ({ apiGet: jest.fn() }));

describe('estRefusSurPlaceSeul', () => {
  it('reconnaît le 400 de la course (erreur de deliveryFetch)', () => {
    const err = new Error('Delivery API 400 on /create-order/');
    err.status = 400;
    err.body = { reason: RAISON_SUR_PLACE_SEUL, status: false, message: 'x' };
    expect(estRefusSurPlaceSeul(err)).toBe(true);
  });

  it('reconnaît le corps du panier ou de la commande', () => {
    expect(estRefusSurPlaceSeul({ status: false, reason: 'onsite_only_no_purchase' })).toBe(true);
    const err = new Error('cart/add');
    err.refus = { status: false, reason: 'onsite_only_no_purchase' };
    expect(estRefusSurPlaceSeul(err)).toBe(true);
  });

  it('ignore les autres refus et les formes inattendues', () => {
    const stock = new Error('409');
    stock.status = 409;
    stock.body = { reason: 'out_of_stock' };
    expect(estRefusSurPlaceSeul(stock)).toBe(false);
    expect(estRefusSurPlaceSeul(null)).toBe(false);
    expect(estRefusSurPlaceSeul(undefined)).toBe(false);
    expect(estRefusSurPlaceSeul('onsite_only_no_purchase')).toBe(false);
    expect(estRefusSurPlaceSeul({ body: null })).toBe(false);
    expect(estRefusSurPlaceSeul(new Error('réseau'))).toBe(false);
  });
});

describe('sur_place_seul du catalogue', () => {
  it('getShopsByCategory recopie le drapeau, absent = achetable', async () => {
    apiGet.mockResolvedValueOnce({
      count: 3,
      results: [
        { id: 1, company_id: 9, name: 'Plat', price: 12, sur_place_seul: true },
        { id: 2, company_id: 9, name: 'Dessert', price: 6, sur_place_seul: false },
        { id: 3, company_id: 9, name: 'Ancien serveur', price: 5 },
      ],
    });
    const [shop] = await getShopsByCategory('product_purchase', { pages: 1 });
    expect(shop.products.map((p) => p.surPlaceSeul)).toEqual([true, false, false]);
  });

  it('sansPlatsSurPlaceSeul retire ces plats et garde le reste', () => {
    const shops = [
      { id: 1, products: [{ id: 1, surPlaceSeul: true }, { id: 2, surPlaceSeul: false }, { id: 3 }] },
      { id: 2 },
    ];
    const out = sansPlatsSurPlaceSeul(shops);
    expect(out[0].products.map((p) => p.id)).toEqual([2, 3]);
    expect(out[1]).toEqual({ id: 2 });
    expect(shops[0].products).toHaveLength(3);
    expect(sansPlatsSurPlaceSeul(null)).toEqual([]);
  });
});
