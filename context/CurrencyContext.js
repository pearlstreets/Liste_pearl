import React from 'react';

const CurrencyContext = React.createContext({ currency: { code: 'EUR', symbol: '€', rate: 1 }, fmtPrice: (n) => n.toFixed(2) + ' €' });

export const useCurrency = () => React.useContext(CurrencyContext);
export default CurrencyContext;
