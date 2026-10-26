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

const { estDeplie } = require('../components/DeuxEcrans');

describe('estDeplie', () => {
  it('pliable Android deplie (841 x 701) : deux moities', () => {
    expect(estDeplie('android', 841, 701)).toBe(true);
  });

  it('telephone ou pliable plie : rien ne change', () => {
    expect(estDeplie('android', 411, 797)).toBe(false);
    expect(estDeplie('android', 797, 411)).toBe(false);
  });

  it('deplie tenu en portrait : rien ne change', () => {
    expect(estDeplie('android', 701, 841)).toBe(false);
  });

  it('iPhone et iPad : rien ne change', () => {
    expect(estDeplie('ios', 1194, 834)).toBe(false);
  });
});
