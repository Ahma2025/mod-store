import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../context/CartContext'

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, subtotal, totalItems } = useCart()

  if (totalItems === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <div style={{ fontSize: 80 }}>🛒</div>
      <h2 style={{ fontSize: 24, fontWeight: 800 }}>كارتك فاضي!</h2>
      <p style={{ color: 'var(--gray)', fontSize: 15 }}>أضف وجبات من القائمة</p>
      <Link to="/" className="btn-red">🍔 تصفح القائمة</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: 'var(--dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ color: 'var(--red)', fontWeight: 700, textDecoration: 'none', fontSize: 22 }}>←</Link>
        <h1 style={{ fontWeight: 800, fontSize: 20 }}>🛒 كارتك ({totalItems} عناصر)</h1>
      </div>

      <div className="container" style={{ padding: '24px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <AnimatePresence>
              {cart.map(item => {
                const addonsTotal = (item.selectedAddons || []).reduce((s, a) => s + (a.price || 0), 0)
                const itemTotal = (item.price + addonsTotal) * item.quantity
                return (
                  <motion.div
                    key={item.cartItemId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    className="card"
                    style={{ padding: '18px 20px' }}
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 70, height: 70, borderRadius: 12, flexShrink: 0,
                        background: 'linear-gradient(135deg, rgba(230,57,70,0.15), rgba(255,140,66,0.1))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden',
                      }}>
                        {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : item.emoji || '🍔'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{item.name_ar}</div>
                        {item.selectedAddons?.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 8 }}>
                            + {item.selectedAddons.map(a => a.name_ar).join(', ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {/* Qty controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--dark3)', borderRadius: 8, padding: '4px 12px' }}>
                            <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>−</button>
                            <span style={{ fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>+</button>
                          </div>
                          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--red)' }}>₪{itemTotal.toFixed(2)}</span>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.cartItemId)}
                        style={{ background: 'rgba(230,57,70,0.12)', border: 'none', color: 'var(--red)', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>
                        🗑️
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 24, position: 'sticky', top: 80 }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>ملخص الطلب</h3>

            {cart.map(item => {
              const addonsTotal = (item.selectedAddons || []).reduce((s, a) => s + (a.price || 0), 0)
              return (
                <div key={item.cartItemId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                  <span style={{ color: 'var(--gray-light)' }}>{item.name_ar} × {item.quantity}</span>
                  <span>₪{((item.price + addonsTotal) * item.quantity).toFixed(2)}</span>
                </div>
              )
            })}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 16, paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--gray)', marginBottom: 8 }}>
                <span>المجموع الفرعي</span><span>₪{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--gray)', marginBottom: 16 }}>
                <span>التوصيل</span><span style={{ color: 'var(--orange)' }}>+₪10 (للتوصيل)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20, marginBottom: 20 }}>
                <span>المجموع</span>
                <span style={{ color: 'var(--red)' }}>₪{subtotal.toFixed(2)}+</span>
              </div>
              <Link to="/checkout" className="btn-red" style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
                إتمام الطلب ←
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`@media(max-width:768px){.container>div{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
