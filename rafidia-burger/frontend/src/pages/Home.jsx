import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../context/CartContext'
import toast from 'react-hot-toast'

// ── Addon Modal ──────────────────────────────────────────────
function AddonModal({ item, onClose, onConfirm }) {
  const [selected, setSelected] = useState([])
  const [qty, setQty] = useState(1)

  const toggle = (addon) => {
    setSelected(prev =>
      prev.find(a => a.id === addon.id)
        ? prev.filter(a => a.id !== addon.id)
        : [...prev, addon]
    )
  }

  const addonsTotal = selected.reduce((s, a) => s + (a.price || 0), 0)
  const total = (item.price + addonsTotal) * qty

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--dark)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', padding: '28px 24px 40px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{item.name_ar}</div>
            <div style={{ color: 'var(--gray)', fontSize: 13, marginTop: 2 }}>{item.description}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--white)', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Price */}
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--red)', marginBottom: 20 }}>₪{item.price}</div>

        {/* Addons */}
        {item.addons?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-light)', marginBottom: 12, letterSpacing: 1 }}>🍟 المرفقات الإضافية</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {item.addons.map(addon => {
                const isSelected = selected.find(a => a.id === addon.id)
                return (
                  <motion.div
                    key={addon.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggle(addon)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: isSelected ? 'rgba(230,57,70,0.12)' : 'var(--dark2)',
                      border: `1px solid ${isSelected ? 'var(--red)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: `2px solid ${isSelected ? 'var(--red)' : 'var(--gray)'}`,
                        background: isSelected ? 'var(--red)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}>
                        {isSelected && <span style={{ color: 'white', fontSize: 13 }}>✓</span>}
                      </div>
                      <span style={{ fontWeight: 600 }}>{addon.name_ar}</span>
                    </div>
                    <span style={{ color: addon.price > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                      {addon.price > 0 ? `+₪${addon.price}` : 'مجاناً'}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>الكمية:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'var(--dark2)', color: 'white', cursor: 'pointer', fontSize: 18 }}>−</button>
            <span style={{ fontWeight: 900, fontSize: 20, minWidth: 24, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--red)', color: 'white', cursor: 'pointer', fontSize: 18 }}>+</button>
          </div>
        </div>

        {/* Add to cart */}
        <button className="btn-red" style={{ width: '100%', justifyContent: 'center', fontSize: 17, padding: '16px' }}
          onClick={() => onConfirm(selected, qty)}>
          أضف إلى الكارت — ₪{total.toFixed(2)}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Menu Card ─────────────────────────────────────────────────
function MenuCard({ item, onAdd }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="card"
      style={{ cursor: 'pointer' }}
      onClick={() => onAdd(item)}
    >
      {/* Image / Emoji */}
      <div style={{
        height: 160,
        background: `linear-gradient(135deg, rgba(230,57,70,0.15), rgba(255,140,66,0.1))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 72, position: 'relative', overflow: 'hidden',
      }}>
        {item.image ? (
          <img src={item.image} alt={item.name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        ) : (
          <span style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}>{item.emoji || '🍔'}</span>
        )}
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <span className="tag">{item.category}</span>
        </div>
        {item.addons?.length > 0 && (
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'var(--gray-light)' }}>
            {item.addons.length} إضافة متاحة
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{item.name_ar}</div>
        <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.5, marginBottom: 14, minHeight: 36 }}>{item.description}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--red)' }}>₪{item.price}</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="btn-red"
            style={{ padding: '8px 18px', fontSize: 14, borderRadius: 8 }}
            onClick={e => { e.stopPropagation(); onAdd(item) }}
          >
            + أضف
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Home Page ─────────────────────────────────────────────────
export default function Home() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('الكل')
  const [selectedItem, setSelectedItem] = useState(null)
  const { addToCart, totalItems, subtotal } = useCart()

  useEffect(() => {
    fetch('/api/menu')
      .then(r => r.json())
      .then(d => { setItems(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categories = ['الكل', ...new Set(items.map(i => i.category))]
  const filtered = activeCategory === 'الكل' ? items : items.filter(i => i.category === activeCategory)

  const handleConfirmAdd = (addons, qty) => {
    addToCart(selectedItem, addons, qty)
    toast.success(`✅ تم إضافة ${selectedItem.name_ar} للكارت`)
    setSelectedItem(null)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-generic.svg" alt="logo" style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(230,57,70,0.5)' }} />
            <div>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: 2, color: 'var(--red)' }}>
                مطعمك
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: -3 }}>اطلب وجبتك أونلاين 🍔</div>
            </div>
          </div>
        </div>

        <Link to="/cart" style={{ position: 'relative', textDecoration: 'none' }}>
          <motion.div
            whileTap={{ scale: 0.92 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: totalItems > 0 ? 'linear-gradient(135deg, var(--red-dark), var(--red))' : 'var(--dark2)',
              padding: '10px 20px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', transition: 'all 0.3s',
            }}
          >
            <span style={{ fontSize: 20 }}>🛒</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>
              {totalItems > 0 ? `${totalItems} — ₪${subtotal.toFixed(2)}` : 'الكارت'}
            </span>
            {totalItems > 0 && (
              <motion.div
                key={totalItems}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                className="badge"
                style={{ position: 'absolute', top: -8, left: -8, width: 24, height: 24, fontSize: 13 }}
              >
                {totalItems}
              </motion.div>
            )}
          </motion.div>
        </Link>
      </nav>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, #1a0305 0%, #0D0D0D 60%)`,
        padding: '60px 20px 40px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,215,0,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, type: 'spring', stiffness: 100 }}
            style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}
          >
            <div style={{
              width: 150, height: 150,
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(245,192,0,0.4), 0 0 80px rgba(204,17,17,0.2)',
              border: '2px solid rgba(245,192,0,0.6)',
            }}>
              <img src="/logo-generic.svg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </motion.div>

          <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 4, letterSpacing: 2, textTransform: 'uppercase' }}>
            🍔 اطلب وجبتك المفضلة أونلاين
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 8 }}>
            موقعك الإلكتروني جاهز 🚀
          </div>
          <p style={{ color: 'var(--gray)', fontSize: 14, maxWidth: 420, margin: '0 auto', marginBottom: 0 }}>
            📍 مدينتك — فلسطين
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            {['🚗 توصيل سريع', '🏪 استلام مجاني', '💳 ادفع عند الاستلام', '⭐ جودة عالية'].map(t => (
              <span key={t} style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 14px', borderRadius: 20, fontSize: 13, color: 'var(--gray-light)' }}>{t}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Categories */}
      <div style={{ padding: '24px 20px 0', overflowX: 'auto', display: 'flex', gap: 10, scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <motion.button key={cat} whileTap={{ scale: 0.95 }} onClick={() => setActiveCategory(cat)}
            style={{
              padding: '10px 22px', borderRadius: 24, whiteSpace: 'nowrap',
              border: activeCategory === cat ? 'none' : '1px solid rgba(255,255,255,0.1)',
              background: activeCategory === cat ? 'linear-gradient(135deg, var(--red-dark), var(--red))' : 'var(--dark2)',
              color: activeCategory === cat ? 'white' : 'var(--gray-light)',
              fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
            {cat}
          </motion.button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="container" style={{ padding: '24px 20px 100px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 280, borderRadius: 16 }} />)}
          </div>
        ) : (
          <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            <AnimatePresence>
              {filtered.map(item => <MenuCard key={item._id} item={item} onAdd={setSelectedItem} />)}
            </AnimatePresence>
          </motion.div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
            <div style={{ fontSize: 18 }}>لا يوجد أصناف في هذا القسم</div>
          </div>
        )}
      </div>

      {/* Addon Modal */}
      <AnimatePresence>
        {selectedItem && (
          <AddonModal item={selectedItem} onClose={() => setSelectedItem(null)} onConfirm={handleConfirmAdd} />
        )}
      </AnimatePresence>
    </div>
  )
}
