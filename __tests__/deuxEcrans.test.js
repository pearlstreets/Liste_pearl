// Ecran deplie d'un pliable Android : deux moities (components/DeuxEcrans.js).
jest.mock('react-native', () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, hairlineWidth: 1 },
  Platform: { OS: 'android' },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContext: React.createContext(undefined),
    NavigationRouteContext: React.createContext(undefined),
  };
});

const { estDeplie, estEnColonne } = require('../components/DeuxEcrans');

describe('estDeplie', () => {
  it('pliable Android deplie (841 x 701) : deux moities', () => {
    expect(estDeplie('android', 841, 701)).toBe(true);
  });

  it('telephone ou pliable plie : rien ne change', () => {
    expect(estDeplie('android', 411, 797)).toBe(false);
    expect(estDeplie('android', 797, 411)).toBe(false);
  });

  it('deplie tenu en portrait : pas deux moities', () => {
    expect(estDeplie('android', 701, 841)).toBe(false);
  });

  it('iPad ou tablette Android en paysage : deux moities', () => {
    expect(estDeplie('ios', 1194, 834)).toBe(true);
    expect(estDeplie('android', 1280, 800)).toBe(true);
  });

  it('iPhone et web : rien ne change', () => {
    expect(estDeplie('ios', 932, 430)).toBe(false);
    expect(estDeplie('web', 1194, 834)).toBe(false);
  });
});

describe('estEnColonne', () => {
  it('tablette en portrait : colonne centree', () => {
    expect(estEnColonne('ios', 834, 1194)).toBe(true);
    expect(estEnColonne('android', 701, 841)).toBe(true);
  });

  it('paysage, telephone ou web : pas de colonne', () => {
    expect(estEnColonne('ios', 1194, 834)).toBe(false);
    expect(estEnColonne('ios', 430, 932)).toBe(false);
    expect(estEnColonne('web', 834, 1194)).toBe(false);
  });
});
