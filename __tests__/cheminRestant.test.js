import { enPoints, metres, projeter, recoller, cheminRestant } from '../lib/cheminRestant';

// Rue droite vers l'est (environ 74 m par millième de degré de longitude à
// Paris), puis un virage vers le nord.
const A = { latitude: 48.85, longitude: 2.35 };
const B = { latitude: 48.85, longitude: 2.352 };
const C = { latitude: 48.852, longitude: 2.352 };
const trace = [A, B, C];
const brut = [
  [A.latitude, A.longitude],
  [B.latitude, B.longitude],
  [C.latitude, C.longitude],
];

describe('enPoints', () => {
  it('convertit [[lat, lng], ...] en points', () => {
    expect(enPoints(brut)).toEqual(trace);
  });
  it('rend null sans tracé utilisable', () => {
    expect(enPoints(null)).toBeNull();
    expect(enPoints(undefined)).toBeNull();
    expect(enPoints([[48.85, 2.35]])).toBeNull();
    expect(enPoints([[48.85, 2.35], ['x', 2], [1]])).toBeNull();
  });
});

describe('metres et projeter', () => {
  it('mesure une distance plausible', () => {
    const d = metres(A, B);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(155);
  });
  it('projette sur le segment, bornes comprises', () => {
    const milieu = projeter(A, B, { latitude: 48.8501, longitude: 2.351 });
    expect(milieu.latitude).toBeCloseTo(48.85, 6);
    expect(milieu.longitude).toBeCloseTo(2.351, 6);
    expect(projeter(A, B, { latitude: 48.85, longitude: 2.34 })).toEqual(A);
    expect(projeter(A, A, B)).toEqual(A);
  });
});

describe('recoller', () => {
  it('fait disparaître le chemin déjà parcouru, au milieu d une rue droite', () => {
    const livreur = { latitude: 48.85001, longitude: 2.351 };
    const r = recoller(trace, livreur);
    expect(r[0]).toEqual(livreur);
    expect(r[1].longitude).toBeCloseTo(2.351, 6);
    expect(r.slice(2)).toEqual([B, C]);
    expect(r).not.toContainEqual(A);
  });
  it('part du point du tracé le plus proche au delà de 60 m', () => {
    const loin = { latitude: 48.8492, longitude: 2.351 };
    const r = recoller(trace, loin);
    expect(r[0]).not.toEqual(loin);
    expect(r[0].latitude).toBeCloseTo(48.85, 6);
    expect(r[0].longitude).toBeCloseTo(2.351, 6);
  });
  it('rend null au bout du trajet', () => {
    expect(recoller(trace, C)).toBeNull();
  });
  it('rend le tracé tel quel sans position', () => {
    expect(recoller(trace, null)).toBe(trace);
  });
});

describe('cheminRestant', () => {
  const livreur = { latitude: 48.85001, longitude: 2.351 };
  it('trace le reste du chemin quand le statut a un itinéraire', () => {
    const r = cheminRestant({ status: 'in_transit', itineraire: brut }, livreur);
    expect(r[0]).toEqual(livreur);
    expect(r[r.length - 1]).toEqual(C);
  });
  it('aucun trait sans itinéraire', () => {
    expect(cheminRestant({ status: 'in_transit', itineraire: null }, livreur)).toBeNull();
    expect(cheminRestant({ status: 'in_transit' }, livreur)).toBeNull();
    expect(cheminRestant(undefined, livreur)).toBeNull();
  });
  it('aucun trait une fois arrivé, livré ou annulé', () => {
    ['arrived', 'delivered', 'cancelled', 'DELIVERED'].forEach((status) => {
      expect(cheminRestant({ status, itineraire: brut }, livreur)).toBeNull();
    });
  });
  it('aucun trait au bout du tracé', () => {
    expect(cheminRestant({ status: 'in_transit', itineraire: brut }, C)).toBeNull();
  });
});
