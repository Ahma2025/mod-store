import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';

const EMOJIS = { 'بيتزا': '🍕', 'مشروبات': '🥤', 'مقبلات': '🍟', 'حلويات': '🍰', 'دجاج': '🍗', 'باستا': '🍝' };

export default function MenuItemCard({ item }) {
  const [modal, setModal] = useState(false);
  const [sel, setSel]     = useState([]);
  const [added, setAdded] = useState(false);
  const { addToCart }     = useCart();

  const toggle = (a) => setSel(p => p.find(x => x.name === a.name) ? p.filter(x => x.name !== a.name) : [...p, a]);

  const doAdd = (addons) => {
    addToCart({ ...item, selectedAddons: addons });
    setModal(false); setSel([]);
    setAdded(true); setTimeout(() => setAdded(false), 1800);
  };

  const emoji = EMOJIS[item.category] || '🍕';
  const addonTotal = sel.reduce((s, a) => s + a.price, 0);

  return (
    <>
      <div style={{
        background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 18,
        overflow: 'hidden', transition: 'all 0.3s', cursor: 'default',
        display: 'flex', flexDirection: 'column', height: '100%',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>

        {/* Image / Emoji */}
        <div style={{
          position: 'relative', height: 150, overflow: 'hidden',
          background: item.image ? '#0f0f0f' : 'linear-gradient(135deg, #1f0a00, #2a1000)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {item.image
            ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.08)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'} />
            : <span style={{ fontSize: 60, filter: 'drop-shadow(0 4px 12px rgba(255,107,53,0.4))' }} className="fl">{emoji}</span>
          }
          <span style={{ position: 'absolute', top: 8, right: 8 }} className="badge-red">{item.category}</span>
          {item.addons?.length > 0 && (
            <span style={{ position: 'absolute', top: 8, left: 8 }} className="badge-gray">{item.addons.length} إضافة</span>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', lineHeight: 1.3 }}>{item.name}</div>
          {item.description && (
            <div style={{
              fontSize: 12, color: '#666', lineHeight: 1.5,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>{item.description}</div>
          )}

          {/* Bottom row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, gap: 8 }}>
            <button
              onClick={() => item.addons?.length ? setModal(true) : doAdd([])}
              className="btn-red"
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 5,
                background: added ? '#16a34a' : undefined,
                transition: 'all 0.25s', flexShrink: 0,
              }}>
              {added ? <><Check size={13} /> أُضيف!</> : <><Plus size={13} /> أضف</>}
            </button>
            <span style={{ fontWeight: 900, fontSize: 17, color: '#ffd166' }}>₪{item.price}</span>
          </div>
        </div>
      </div>

      {/* ── ADDONS MODAL ── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: 0,
        }} onClick={e => { if (e.target === e.currentTarget) { setModal(false); setSel([]); } }}>
          <div style={{
            background: '#1c1c1c', border: '1px solid #333',
            borderRadius: '24px 24px 0 0',
            width: '100%', maxWidth: 520,
            maxHeight: '88vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -12px 60px rgba(0,0,0,0.7)',
            animation: 'fadeUp 0.3s ease',
          }}>

            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#333' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '12px 20px 14px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>{item.name}</div>
                <div style={{ fontSize: 13, color: '#e63946', marginTop: 2 }}>اختر إضافاتك</div>
              </div>
              <button onClick={() => { setModal(false); setSel([]); }}
                style={{ background: '#2a2a2a', border: 'none', color: '#888', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Addons list */}
            <div style={{ overflowY: 'auto', padding: '10px 16px', flex: 1 }}>
              {item.addons.map((a, i) => {
                const on = !!sel.find(x => x.name === a.name);
                return (
                  <div key={i} onClick={() => toggle(a)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 14px', borderRadius: 14, marginBottom: 8, cursor: 'pointer',
                    background: on ? 'rgba(230,57,70,0.1)' : '#242424',
                    border: `1.5px solid ${on ? '#e63946' : '#333'}`,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: `2px solid ${on ? '#e63946' : '#444'}`,
                        background: on ? '#e63946' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}>
                        {on && <Check size={13} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{a.name}</span>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 14, color: a.price > 0 ? '#ffd166' : '#4ade80', whiteSpace: 'nowrap' }}>
                      {a.price > 0 ? `+${a.price}₪` : 'مجاني'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#666', fontSize: 14 }}>الإجمالي</span>
                <span style={{ fontWeight: 900, fontSize: 22, color: '#ffd166' }}>₪{item.price + addonTotal}</span>
              </div>
              <button onClick={() => doAdd(sel)} className="btn-red"
                style={{ width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Plus size={17} /> أضف للكارت
              </button>
              <button onClick={() => doAdd([])}
                style={{ width: '100%', marginTop: 8, padding: '9px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, fontFamily: 'Cairo,sans-serif' }}>
                بدون إضافات
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
