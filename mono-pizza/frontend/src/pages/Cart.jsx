import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { cart, removeFromCart, updateQty, cartTotal } = useCart();

  if (!cart.length) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 80 }}>🛒</div>
      <div style={{ fontWeight: 900, fontSize: 28, color: '#fff' }}>كارتك فاضي!</div>
      <div style={{ color: '#555', fontSize: 15 }}>أضف وجبات من القائمة</div>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <button className="btn-red" style={{ padding: '13px 36px', borderRadius: 14, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          🍕 تصفح القائمة
        </button>
      </Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#111', padding: '80px 14px 60px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>←</Link>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(18px,4vw,24px)', color: '#fff' }}>
            🛒 كارتك ({cart.length} عناصر)
          </h1>
        </div>

        {/* Two-col on desktop, single col on mobile */}
        <div className="cart-grid">

          {/* Items list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cart.map(item => {
              const addonsTotal = (item.selectedAddons || []).reduce((s, a) => s + a.price, 0);
              const unit = item.price + addonsTotal;
              return (
                <div key={item._cartKey} style={{
                  background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 16,
                  padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12,
                  flexWrap: 'wrap',
                }}>
                  {/* Image */}
                  <div style={{
                    width: 54, height: 54, borderRadius: 12, background: '#252525',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, flexShrink: 0, overflow: 'hidden',
                  }}>
                    {item.image
                      ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🍕'
                    }
                  </div>

                  {/* Name + addons */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>{item.name}</div>
                    {item.selectedAddons?.length > 0 && (
                      <div style={{ fontSize: 11, color: '#e63946', marginTop: 2 }}>
                        + {item.selectedAddons.map(a => a.name).join('، ')}
                      </div>
                    )}
                    <div style={{ fontWeight: 900, fontSize: 15, color: '#ffd166', marginTop: 3 }}>₪{unit * item.quantity}</div>
                  </div>

                  {/* Qty controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#252525', borderRadius: 12, padding: '6px 10px' }}>
                    <button onClick={() => updateQty(item._cartKey, item.quantity + 1)}
                      style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
                      <Plus size={15} />
                    </button>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#fff', minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item._cartKey, item.quantity - 1)}
                      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
                      <Minus size={15} />
                    </button>
                  </div>

                  {/* Delete */}
                  <button onClick={() => removeFromCart(item._cartKey)}
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div style={{
            background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 20,
            padding: 20,
          }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', marginBottom: 14 }}>ملخص الطلب</div>

            {cart.map(item => {
              const a = (item.selectedAddons || []).reduce((s, x) => s + x.price, 0);
              return (
                <div key={item._cartKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 7, gap: 8 }}>
                  <span style={{ flex: 1 }}>{item.name} × {item.quantity}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>₪{(item.price + a) * item.quantity}</span>
                </div>
              );
            })}

            <div style={{ borderTop: '1px solid #2a2a2a', marginTop: 12, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 6 }}>
                <span>المجموع الفرعي</span><span>₪{cartTotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e63946', marginBottom: 14 }}>
                <span>التوصيل</span><span>+₪10 (للتوصيل)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20, color: '#ffd166', marginBottom: 18 }}>
                <span style={{ color: '#fff' }}>المجموع</span>
                <span>₪{cartTotal}</span>
              </div>
              <Link to="/checkout" style={{ textDecoration: 'none' }}>
                <button className="btn-red" style={{ width: '100%', padding: '14px', borderRadius: 14, fontSize: 15 }}>
                  إتمام الطلب ←
                </button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
