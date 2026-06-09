import { createContext, useContext, useState, useCallback } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])

  const addToCart = useCallback((item, selectedAddons = [], quantity = 1) => {
    const cartItemId = `${item._id}-${JSON.stringify(selectedAddons)}`
    setCart(prev => {
      const existing = prev.find(c => c.cartItemId === cartItemId)
      if (existing) {
        return prev.map(c => c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + quantity } : c)
      }
      return [...prev, { ...item, cartItemId, selectedAddons, quantity }]
    })
  }, [])

  const removeFromCart = useCallback((cartItemId) => {
    setCart(prev => prev.filter(c => c.cartItemId !== cartItemId))
  }, [])

  const updateQuantity = useCallback((cartItemId, qty) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.cartItemId !== cartItemId))
    } else {
      setCart(prev => prev.map(c => c.cartItemId === cartItemId ? { ...c, quantity: qty } : c))
    }
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)
  const subtotal = cart.reduce((s, c) => {
    const addonsTotal = (c.selectedAddons || []).reduce((a, ad) => a + (ad.price || 0), 0)
    return s + (c.price + addonsTotal) * c.quantity
  }, 0)

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
