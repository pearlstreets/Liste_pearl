import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext({
  cartVersion: 0,
  productsVersion: 0,
  notifyCartUpdate: () => {},
  notifyProductsReset: () => {},
});

export function CartProvider({ children }) {
  const [cartVersion, setCartVersion] = useState(0);
  const [productsVersion, setProductsVersion] = useState(0);

  const notifyCartUpdate = useCallback(() => {
    setCartVersion(v => v + 1);
  }, []);

  const notifyProductsReset = useCallback(() => {
    setProductsVersion(v => v + 1);
  }, []);

  return (
    <CartContext.Provider value={{ cartVersion, productsVersion, notifyCartUpdate, notifyProductsReset }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCartEvents = () => useContext(CartContext);
export default CartContext;
