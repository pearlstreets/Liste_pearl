import React from "react";
import { CURRENCIES } from "../../data/currencies";

export const CurrencyContext = React.createContext({ currency: CURRENCIES[0], fmtPrice: (n) => n.toFixed(2) + ' €' });

export const useCurrency = () => React.useContext(CurrencyContext);
