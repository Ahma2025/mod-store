import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { CheckCircle } from 'lucide-react';

export default function Checkout() {
  const { cart, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ customerName: '', customerPhone: '', customerAddress: '', deliveryType: 'delivery', notes: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const fee = form.deliveryType === 'delivery' ? 10 : 0;
  const total = cartTotal + fee;
  const valid = form.customerName.trim() && form.customerPhone.trim() && (form.deliveryType === 'pickup' || form.customerAddress.trim());

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      const items = cart.map(i => ({ menuItem: i._id, name: i.name, price: i.price, quantity: i.quantity, selectedAddons: i.selectedAddons || [] }));
      await axios.post('/api/orders', { ...form, items });
      clearCart();
      setDone({ name: form.customerName, phone: form.customerPhone });
    } catch { alert('حدث خطأ، حاول مرة أخرى'); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: 24 }}>
      <CheckCircle size={80} color="#22c55e" />
      <div style={{ fontWeight: 900, fontSize: 'clamp(24px,6vw,32px)', color: '#fff' }}>تم استلام طلبك! 🎉</div>
      <div style={{ color: '#666', fontSize: 16 }}>شكراً <span style={{ color: '#e63946', fontWeight: 700 }}>{done.name}</span></div>
      <div style={{ color: '#555', fontSize: 14 }}>سنتواصل معك على <span style={{ color: '#fff', fontFamily: 'monospace' }} dir="ltr">{done.phone}</span></div>
      <button onClick={() => navigate('/')} className="btn-red" style={{ padding: '13px 36px', borderRadius: 14, fontSize: 15, marginTop: 8 }}>
        العودة للرئيسية
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#111', padding: '80px 14px 60px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link to="/cart" style={{ color: '#555', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(18px,4vw,24px)', color: '#fff' }}>🧾 إتمام الطلب</h1>
        </div>

        {/* Grid — summary on right (order:2 mobile), form on left (order:1 mobile) */}
        <div className="checkout-grid">

          {/* Summary */}
          <div className="checkout-summary" style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 20, padding: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', marginBottom: 14 }}>ملخص طلبك</div>
            {cart.map(item => {
              const a = (item.selectedAddons || []).reduce((s, x) => s + x.price, 0);
              return (
                <div key={item._cartKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#ccc', fontSize: 13, fontWeight: 700 }}>{item.name} × {item.quantity}</span>
                    {item.selectedAddons?.length > 0 && (
                      <div style={{ color: '#e63946', fontSize: 11, marginTop: 2 }}>+ {item.selectedAddons.map(x => x.name).join('، ')}</div>
                    )}
                  </div>
                  <span style={{ color: '#ffd166', fontWeight: 900, fontSize: 13, whiteSpace: 'nowrap' }}>₪{(item.price + a) * item.quantity}</span>
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid #2a2a2a', marginTop: 12, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginBottom: 6 }}>
                <span>المجموع الفرعي</span><span>₪{cartTotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                <span style={{ color: '#555' }}>التوصيل</span>
                <span style={{ color: fee > 0 ? '#e63946' : '#4ade80', fontWeight: 700 }}>{fee > 0 ? `+₪${fee}` : 'مجاني'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20 }}>
                <span style={{ color: '#fff' }}>الإجمالي</span>
                <span style={{ color: '#ffd166' }}>₪{total}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="checkout-form">

            {/* Delivery type */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', marginBottom: 12 }}>طريقة الاستلام</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { val: 'delivery', icon: '🚗', label: 'توصيل', sub: '+₪10' },
                  { val: 'pickup', icon: '🏪', label: 'استلام', sub: 'مجاناً' },
                ].map(o => (
                  <div key={o.val} onClick={() => set('deliveryType', o.val)} style={{
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer', transition: 'all 0.25s',
                    background: form.deliveryType === o.val ? 'rgba(230,57,70,0.1)' : '#1c1c1c',
                    border: `2px solid ${form.deliveryType === o.val ? '#e63946' : '#2a2a2a'}`,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{o.icon}</span>
                      <span style={{ fontWeight: 900, color: '#fff', fontSize: 14 }}>{o.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: o.val === 'delivery' ? '#e63946' : '#4ade80', fontWeight: 700 }}>{o.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', marginBottom: 12 }}>بياناتك الشخصية</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { k: 'customerName', label: 'الاسم الكامل *', ph: 'اسمك الكامل' },
                  { k: 'customerPhone', label: 'رقم الهاتف *', ph: '05x-xxx-xxxx' },
                  ...(form.deliveryType === 'delivery' ? [{ k: 'customerAddress', label: 'العنوان الكامل *', ph: 'الشارع، المنطقة، أي تفاصيل...' }] : []),
                ].map(f => (
                  <div key={f.k}>
                    <label style={{ fontSize: 12, color: '#888', fontWeight: 700, marginBottom: 6, display: 'block' }}>{f.label}</label>
                    <input value={form[f.k]} onChange={e => set(f.k, e.target.value)}
                      placeholder={f.ph} className="inp" />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, color: '#888', fontWeight: 700, marginBottom: 6, display: 'block' }}>ملاحظات (اختياري)</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="أي طلبات خاصة..." rows={3}
                    className="inp" style={{ resize: 'none' }} />
                </div>
              </div>
            </div>

            <button onClick={submit} disabled={!valid || loading} className="btn-red"
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading
                ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> جاري الإرسال...</>
                : '📤 أرسل الطلب'
              }
            </button>
            {!valid && <p style={{ textAlign: 'center', color: '#e63946', fontSize: 12, marginTop: 8, opacity: 0.7 }}>يرجى تعبئة جميع الحقول المطلوبة</p>}
          </div>

        </div>
      </div>
    </div>
  );
}
