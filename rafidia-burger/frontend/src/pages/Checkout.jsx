import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCart } from '../context/CartContext'
import toast from 'react-hot-toast'

export default function Checkout() {
  const { cart, subtotal, totalItems, clearCart } = useCart()
  const navigate = useNavigate()
  const [deliveryType, setDeliveryType] = useState('delivery')
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [loading, setLoading] = useState(false)

  const deliveryFee = deliveryType === 'delivery' ? 10 : 0
  const total = subtotal + deliveryFee

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const isValid = form.name && form.phone && (deliveryType === 'pickup' || form.address)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid) { toast.error('يرجى تعبئة كل الحقول المطلوبة'); return }

    setLoading(true)
    try {
      const orderItems = cart.map(item => ({
        _id: item._id,
        name: item.name,
        name_ar: item.name_ar,
        emoji: item.emoji,
        price: item.price,
        quantity: item.quantity,
        selectedAddons: item.selectedAddons || [],
      }))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.name,
          customer_phone: form.phone,
          customer_address: form.address,
          delivery_type: deliveryType,
          items: orderItems,
          notes: form.notes,
        }),
      })
      const data = await res.json()
      if (data.success) {
        clearCart()
        navigate('/order-success', { state: { order: data.data } })
      } else {
        toast.error(data.message || 'حدث خطأ')
      }
    } catch { toast.error('تعذر الاتصال بالخادم') }
    setLoading(false)
  }

  if (totalItems === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 60 }}>🛒</div>
      <p style={{ color: 'var(--gray)' }}>الكارت فاضي</p>
      <Link to="/" className="btn-red">العودة للقائمة</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: 'var(--dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/cart" style={{ color: 'var(--red)', fontWeight: 700, textDecoration: 'none', fontSize: 22 }}>←</Link>
        <h1 style={{ fontWeight: 800, fontSize: 20 }}>📋 إتمام الطلب</h1>
      </div>

      <div className="container" style={{ padding: '28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
          {/* Form */}
          <motion.form initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleSubmit}>

            {/* Delivery type */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>طريقة الاستلام</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { value: 'delivery', label: '🚗 توصيل', sub: 'رسوم إضافية +₪10' },
                  { value: 'pickup', label: '🏪 استلام من المحل', sub: 'مجاناً' },
                ].map(opt => (
                  <div key={opt.value} onClick={() => setDeliveryType(opt.value)} style={{
                    padding: '18px 20px', borderRadius: 14, cursor: 'pointer',
                    border: `2px solid ${deliveryType === opt.value ? 'var(--red)' : 'rgba(255,255,255,0.08)'}`,
                    background: deliveryType === opt.value ? 'rgba(230,57,70,0.1)' : 'var(--dark2)',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{opt.label}</div>
                    <div style={{ color: 'var(--gray)', fontSize: 13, marginTop: 4 }}>{opt.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personal info */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>بياناتك الشخصية</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>الاسم الكامل *</label>
                  <input name="name" value={form.name} onChange={handleChange} placeholder="اسمك الكامل" className="input" required />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>رقم الهاتف *</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="05x-xxx-xxxx" className="input" required />
                </div>
                {deliveryType === 'delivery' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>العنوان الكامل *</label>
                    <textarea name="address" value={form.address} onChange={handleChange} placeholder="الشارع، المنطقة، أي تفاصيل مهمة..."
                      rows={3} className="input" style={{ resize: 'none' }} required />
                  </motion.div>
                )}
                <div>
                  <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>ملاحظات (اختياري)</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="أي طلبات خاصة..." rows={2} className="input" style={{ resize: 'none' }} />
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              className="btn-red"
              disabled={!isValid || loading}
              whileHover={isValid && !loading ? { scale: 1.01 } : {}}
              whileTap={isValid && !loading ? { scale: 0.98 } : {}}
              style={{ width: '100%', justifyContent: 'center', fontSize: 17, padding: '17px', opacity: isValid ? 1 : 0.45, cursor: isValid ? 'pointer' : 'not-allowed' }}
            >
              {loading ? '⏳ جاري الإرسال...' : `✅ إرسال الطلب — ₪${total.toFixed(2)}`}
            </motion.button>
          </motion.form>

          {/* Order Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 24, position: 'sticky', top: 80 }}>
            <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 18 }}>ملخص طلبك</h3>
            {cart.map(item => {
              const addonsTotal = (item.selectedAddons || []).reduce((s, a) => s + (a.price || 0), 0)
              return (
                <div key={item.cartItemId} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
                    <span>{item.emoji} {item.name_ar} × {item.quantity}</span>
                    <span>₪{((item.price + addonsTotal) * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.selectedAddons?.length > 0 && (
                    <div style={{ color: 'var(--gray)', fontSize: 12, marginTop: 4, paddingRight: 8 }}>
                      + {item.selectedAddons.map(a => `${a.name_ar}${a.price > 0 ? ` (+₪${a.price})` : ''}`).join(' · ')}
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 16, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gray)', fontSize: 14 }}>
                <span>المجموع الفرعي</span><span>₪{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gray)', fontSize: 14 }}>
                <span>التوصيل</span>
                <span style={{ color: deliveryFee > 0 ? 'var(--orange)' : 'var(--green)' }}>
                  {deliveryFee > 0 ? `+₪${deliveryFee}` : 'مجاناً'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20, marginTop: 8 }}>
                <span>الإجمالي</span>
                <span style={{ color: 'var(--red)' }}>₪{total.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <style>{`@media(max-width:768px){.container>div{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
