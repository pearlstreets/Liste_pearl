import { estRefusSurPlaceSeul, RAISON_SUR_PLACE_SEUL } from '../lib/surPlaceSeul';

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
