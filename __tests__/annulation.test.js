// Annulation d'une commande livrée par le client : bouton montré seulement pour
// une course en attente, refus 409 « trop tard » reconnu, appel du serveur.

import { annulationPossible, refusAnnulation, statutDeLaCourse } from '../lib/annulation';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(JSON.stringify({ access: 'tok', refresh: 'r' }))),
  removeItem: jest.fn(),
}));

jest.mock('../services/config', () => ({
  CONFIG: {
    API_URL: 'https://api.test/api/v1',
    DELIVERY_API_URL: 'https://api.test/api/v1/delivery',
  },
}));

describe('annulationPossible', () => {
  const livraison = { id: 1, mode: 'delivery', deliveryStatus: 'pending' };

  test('livraison en attente : bouton montré', () => {
    expect(annulationPossible(livraison, undefined)).toBe(true);
    expect(annulationPossible(livraison, { status: 'PENDING' })).toBe(true);
  });

  test('prise en charge, préparation, livrée ou annulée : bouton masqué', () => {
    ['accepted', 'pickup', 'en_route', 'arrived', 'delivered', 'cancelled'].forEach((s) => {
      expect(annulationPossible(livraison, { status: s })).toBe(false);
    });
  });

  test('retrait, refus déjà reçu, données absentes : bouton masqué', () => {
    expect(annulationPossible({ ...livraison, mode: 'collect' }, undefined)).toBe(false);
    expect(annulationPossible({ ...livraison, cancelRefused: true }, undefined)).toBe(false);
    expect(annulationPossible({ id: 2, mode: 'delivery' }, undefined)).toBe(false);
    expect(annulationPossible(null, undefined)).toBe(false);
    expect(statutDeLaCourse(undefined, undefined)).toBe('');
  });
});

describe('refusAnnulation', () => {
  test('409 already_in_preparation / already_picked_up : refus « trop tard »', () => {
    expect(refusAnnulation({ status: 409, body: { reason: 'already_in_preparation' } })).toBe(
      'already_in_preparation'
    );
    expect(refusAnnulation({ status: 409, body: { reason: 'already_picked_up' } })).toBe(
      'already_picked_up'
    );
  });

  test('autres réponses : null', () => {
    expect(refusAnnulation(null)).toBeNull();
    expect(refusAnnulation(new Error('réseau'))).toBeNull();
    expect(refusAnnulation({ status: 400, body: { reason: 'already_in_preparation' } })).toBeNull();
    expect(refusAnnulation({ status: 409, body: { reason: 'out_of_stock' } })).toBeNull();
    expect(refusAnnulation({ status: 409, body: null })).toBeNull();
  });
});

describe('cancelDelivery', () => {
  const { cancelDelivery } = require('../services/delivery');

  afterEach(() => {
    delete global.fetch;
  });

  test('POST /customer-cancel/<id>/', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ status: 'success' }) })
    );
    await expect(cancelDelivery(1759500000000)).resolves.toEqual({ status: 'success' });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/delivery/customer-cancel/1759500000000/');
    expect(opts.method).toBe('POST');
  });

  test('un refus 409 garde sa raison', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ reason: 'already_in_preparation', message: 'x' }),
      })
    );
    const err = await cancelDelivery(5).catch((e) => e);
    expect(refusAnnulation(err)).toBe('already_in_preparation');
  });
});
