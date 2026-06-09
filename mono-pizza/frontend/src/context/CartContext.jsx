import { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = (item) => {
    setCart(prev => {
      const key = item._id + JSON.stringify(item.selectedAddons);
      const existing = prev.find(i => i._cartKey === key);
      if (existing) {
        return prev.map(i => i._cartKey === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, _cartKey: key }];
    });
  };

  const removeFromCart = (cartKey) => setCart(prev => prev.filter(i => i._cartKey !== cartKey));

  const updateQty = (cartKey, qty) => {
    if (qty < 1) return removeFromCart(cartKey);
    setCart(prev => prev.map(i => i._cartKey === cartKey ? { ...i, quantity: qty } : i));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => {
    const addonsTotal = (i.selectedAddons || []).reduce((a, b) => a + b.price, 0);
    return s + (i.price + addonsTotal) * i.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQty, clearCart, cartCount, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
