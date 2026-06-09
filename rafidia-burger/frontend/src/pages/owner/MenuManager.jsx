import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

const EMOJIS = ['🍔', '🌶️', '🍗', '🥪', '🍟', '🌮', '🥗', '🍕', '🥤', '🧃', '🍰', '🍩', '🫔', '🍜', '🥩', '🧆', '🍱', '🫕']
const token = () => localStorage.getItem('owner_token')

const DEFAULT_CATEGORIES = ['برجر', 'دجاج', 'مشاوي', 'سندويشات', 'مقبلات', 'مشروبات', 'حلويات', 'وجبات عائلية']

function AddonEditor({ addons, onChange }) {
  const add = () => onChange([...addons, { id: Date.now().toString(), name: '', name_ar: '', price: 0 }])
  const remove = (id) => onChange(addons.filter(a => a.id !== id))
  const update = (id, field, val) => onChange(addons.map(a => a.id === id ? { ...a, [field]: val } : a))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 600 }}>المرفقات / الإضافات</label>
        <button type="button" onClick={add}
          style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.3)', color: 'var(--red)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'Cairo, sans-serif' }}>
          + إضافة
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {addons.map(addon => (
          <div key={addon.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 36px', gap: 8, alignItems: 'center' }}>
            <input value={addon.name_ar} onChange={e => update(addon.id, 'name_ar', e.target.value)}
              placeholder="اسم الإضافة (عربي)" className="input" style={{ fontSize: 13, padding: '10px 14px' }} />
            <input value={addon.name} onChange={e => update(addon.id, 'name', e.target.value)}
              placeholder="Name (English)" className="input" style={{ fontSize: 13, padding: '10px 14px' }} />
            <input type="number" min="0" value={addon.price} onChange={e => update(addon.id, 'price', parseFloat(e.target.value) || 0)}
              placeholder="₪0" className="input" style={{ fontSize: 13, padding: '10px 14px' }} />
            <button type="button" onClick={() => remove(addon.id)}
              style={{ background: 'rgba(230,57,70,0.12)', border: 'none', color: 'var(--red)', borderRadius: 8, height: 38, cursor: 'pointer', fontSize: 16 }}>🗑</button>
          </div>
        ))}
        {addons.length === 0 && (
          <div style={{ color: 'var(--gray)', fontSize: 13, padding: '10px 0' }}>لا يوجد مرفقات — اضغط "إضافة" لإضافة مرفق</div>
        )}
      </div>
    </div>
  )
}

function ItemForm({ item, allCategories, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    name_ar: item?.name_ar || '',
    description: item?.description || '',
    price: item?.price || '',
    category: item?.category || 'برجر',
    emoji: item?.emoji || '🍔',
    available: item?.available !== false,
    addons: item?.addons || [],
  })
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(item?.image || null)
  const [customCategory, setCustomCategory] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Merge default + existing categories from DB
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...allCategories])]

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name_ar || !form.price) { toast.error('الاسم العربي والسعر مطلوبان'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'addons') fd.append(k, JSON.stringify(v))
        else if (k !== 'available') fd.append(k, v)
      })
      fd.append('available', form.available)
      if (imageFile) fd.append('image', imageFile)

      const url = item?._id ? `/api/owner/menu/${item._id}` : '/api/owner/menu'
      const method = item?._id ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token()}` }, body: fd })
      const data = await res.json()
      if (data.success) { toast.success(item?._id ? '✅ تم التعديل' : '✅ تمت الإضافة'); onSave(data.data) }
      else toast.error(data.message)
    } catch { toast.error('خطأ في الاتصال') }
    setLoading(false)
  }

  const inp = { fontSize: 14, padding: '13px 16px' }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ fontWeight: 800, fontSize: 18 }}>{item?._id ? '✏️ تعديل الصنف' : '➕ إضافة صنف جديد'}</h3>
        <button onClick={onCancel} style={{ background: 'var(--dark3)', border: 'none', color: 'var(--gray)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── صورة المنتج ─────────────────────── */}
        <div>
          <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 10, fontWeight: 600 }}>📸 صورة المنتج</label>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {/* Preview box */}
            <div style={{
              width: 140, height: 140, borderRadius: 16, flexShrink: 0,
              border: `2px dashed ${imagePreview ? 'var(--red)' : 'rgba(255,255,255,0.15)'}`,
              background: imagePreview ? 'transparent' : 'var(--dark3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
              transition: 'border-color 0.3s',
            }}>
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={removeImage}
                    style={{
                      position: 'absolute', top: 6, left: 6,
                      background: 'rgba(0,0,0,0.75)', border: 'none',
                      color: 'white', borderRadius: '50%', width: 26, height: 26,
                      cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 4 }}>{form.emoji}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>لا توجد صورة</div>
                </div>
              )}
            </div>

            {/* Upload area */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="img-upload" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '24px 16px',
                border: '2px dashed rgba(230,57,70,0.3)', borderRadius: 12,
                cursor: 'pointer', background: 'rgba(230,57,70,0.04)',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(230,57,70,0.3)'}
              >
                <span style={{ fontSize: 28 }}>📤</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>اضغط لرفع صورة</span>
                <span style={{ fontSize: 12, color: 'var(--gray)', textAlign: 'center' }}>PNG, JPG, WEBP — حجم أقصى 5MB</span>
              </label>
              <input id="img-upload" type="file" accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }} />
              {imagePreview && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)', textAlign: 'center' }}>✅ تم اختيار الصورة</div>
              )}
            </div>
          </div>
        </div>

        {/* ── الأيقونة (احتياط لو ما في صورة) ── */}
        <div>
          <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 8, fontWeight: 600 }}>
            🎯 الأيقونة <span style={{ fontWeight: 400, fontSize: 12 }}>(تظهر لو ما في صورة)</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EMOJIS.map(em => (
              <button key={em} type="button" onClick={() => set('emoji', em)}
                style={{
                  width: 44, height: 44, fontSize: 22,
                  border: `2px solid ${form.emoji === em ? 'var(--red)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10,
                  background: form.emoji === em ? 'rgba(230,57,70,0.15)' : 'var(--dark3)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}>
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* ── الاسم ───────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6, fontWeight: 600 }}>الاسم (عربي) *</label>
            <input value={form.name_ar} onChange={e => set('name_ar', e.target.value)}
              placeholder="مثال: تشيلي برجر" className="input" style={inp} required />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6, fontWeight: 600 }}>الاسم (إنجليزي)</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Chili Burger" className="input" style={inp} />
          </div>
        </div>

        {/* ── الوصف ───────────────────────────── */}
        <div>
          <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6, fontWeight: 600 }}>الوصف</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="وصف الوجبة..." rows={2} className="input" style={{ ...inp, resize: 'none' }} />
        </div>

        {/* ── السعر + الصنف ───────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6, fontWeight: 600 }}>السعر (₪) *</label>
            <input type="number" min="0" step="0.5" value={form.price}
              onChange={e => set('price', e.target.value)}
              placeholder="18" className="input" style={inp} required />
          </div>

          {/* Category selector */}
          <div>
            <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
              الصنف / القسم *
            </label>
            {!customCategory ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.category} onChange={e => set('category', e.target.value)}
                  className="input" style={{ ...inp, flex: 1 }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => setCustomCategory(true)}
                  title="أضف صنف جديد"
                  style={{
                    flexShrink: 0, width: 46, height: 46,
                    background: 'rgba(230,57,70,0.12)',
                    border: '1px solid rgba(230,57,70,0.3)',
                    color: 'var(--red)', borderRadius: 10,
                    cursor: 'pointer', fontSize: 20,
                  }}>+</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.category} onChange={e => set('category', e.target.value)}
                  placeholder="اكتب اسم الصنف الجديد..." className="input" style={{ ...inp, flex: 1 }} autoFocus />
                <button type="button" onClick={() => setCustomCategory(false)}
                  style={{
                    flexShrink: 0, width: 46, height: 46,
                    background: 'var(--dark3)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--gray)', borderRadius: 10, cursor: 'pointer', fontSize: 18,
                  }}>↩</button>
              </div>
            )}
            {/* Category chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {categories.slice(0, 6).map(c => (
                <span key={c} onClick={() => { set('category', c); setCustomCategory(false) }}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    border: `1px solid ${form.category === c ? 'var(--red)' : 'rgba(255,255,255,0.1)'}`,
                    background: form.category === c ? 'rgba(230,57,70,0.12)' : 'transparent',
                    color: form.category === c ? 'var(--red)' : 'var(--gray)',
                    transition: 'all 0.2s',
                  }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── متاح / غير متاح ─────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={() => set('available', !form.available)} style={{
            width: 48, height: 26, borderRadius: 13,
            background: form.available ? 'var(--red)' : 'var(--dark3)',
            position: 'relative', cursor: 'pointer', transition: 'background 0.3s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 3, transition: 'all 0.3s',
              right: form.available ? 4 : 'auto',
              left: form.available ? 'auto' : 4,
            }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {form.available ? '🟢 متاح للطلب' : '🔴 غير متاح'}
          </span>
        </div>

        {/* ── المرفقات ────────────────────────── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 18 }}>
          <AddonEditor addons={form.addons} onChange={v => set('addons', v)} />
        </div>

        <button type="submit" className="btn-red" disabled={loading}
          style={{ justifyContent: 'center', padding: '16px', fontSize: 16 }}>
          {loading ? '⏳ جاري الحفظ...' : item?._id ? '💾 حفظ التعديلات' : '➕ إضافة الصنف'}
        </button>
      </form>
    </motion.div>
  )
}

export default function MenuManager() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const navigate = useNavigate()

  // Extract unique categories from existing items
  const allCategories = [...new Set(items.map(i => i.category).filter(Boolean))]

  const fetchItems = () => {
    fetch('/api/owner/menu', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => { setItems(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchItems() }, [])

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return
    const res = await fetch(`/api/owner/menu/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    if ((await res.json()).success) { toast.success('تم الحذف'); fetchItems() }
  }

  const handleSave = () => { setShowForm(false); setEditItem(null); fetchItems() }
  const logout = () => { localStorage.removeItem('owner_token'); navigate('/owner/login') }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Owner Nav */}
      <nav style={{ background: 'var(--dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>🍔 لوحة التحكم</div>
          <Link to="/owner/orders" style={{ color: 'var(--gray)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>الطلبات</Link>
          <Link to="/owner/menu" style={{ color: 'var(--red)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>القائمة</Link>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/" target="_blank" style={{ color: 'var(--gray)', fontSize: 13, textDecoration: 'none', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>👁️ عرض الموقع</Link>
          <button onClick={logout} style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.2)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>خروج</button>
        </div>
      </nav>

      <div className="container" style={{ padding: '28px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontWeight: 900, fontSize: 24, marginBottom: 4 }}>📋 إدارة القائمة</h1>
            <p style={{ color: 'var(--gray)', fontSize: 14 }}>{items.length} صنف في القائمة</p>
          </div>
          <button className="btn-red" onClick={() => { setEditItem(null); setShowForm(true) }}>+ إضافة صنف</button>
        </div>

        {/* Form */}
        <AnimatePresence>
          {(showForm || editItem) && (
            <div style={{ marginBottom: 28 }}>
              <ItemForm item={editItem} allCategories={allCategories} onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null) }} />
            </div>
          )}
        </AnimatePresence>

        {/* Items grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {items.map(item => (
              <motion.div key={item._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(230,57,70,0.15), rgba(255,140,66,0.1))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, overflow: 'hidden',
                  }}>
                    {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : item.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{item.name_ar}</div>
                        <span className="tag" style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}>{item.category}</span>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 20, color: 'var(--red)' }}>₪{item.price}</div>
                    </div>
                    {item.addons?.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 6 }}>🍟 {item.addons.length} مرفقات</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button onClick={() => { setEditItem(item); setShowForm(false) }}
                        style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>
                        ✏️ تعديل
                      </button>
                      <button onClick={() => handleDelete(item._id)}
                        style={{ padding: '8px 14px', background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.2)', color: 'var(--red)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                        🗑
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.available ? 'var(--green)' : 'var(--gray)' }} />
                      <span style={{ fontSize: 12, color: item.available ? 'var(--green)' : 'var(--gray)' }}>
                        {item.available ? 'متاح' : 'غير متاح'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
