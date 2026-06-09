import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function OwnerLogin() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('owner_token', data.token)
        toast.success('مرحباً يا أونر! 👋')
        navigate('/owner/orders')
      } else {
        toast.error(data.message || 'خطأ في تسجيل الدخول')
      }
    } catch { toast.error('تعذر الاتصال') }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🔐</div>
          <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 6 }}>لوحة تحكم الأونر</h1>
          <p style={{ color: 'var(--gray)', fontSize: 14 }}>نظام الطلبات الإلكتروني 🍔</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 8 }}>اسم المستخدم</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="owner" className="input" required autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--gray)', display: 'block', marginBottom: 8 }}>كلمة المرور</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" className="input" required />
          </div>
          <button type="submit" className="btn-red" disabled={loading}
            style={{ justifyContent: 'center', padding: '16px', marginTop: 8, fontSize: 16 }}>
            {loading ? '⏳ جاري الدخول...' : '🚀 دخول'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 16, background: 'rgba(230,57,70,0.06)', borderRadius: 12, border: '1px solid rgba(230,57,70,0.15)', fontSize: 13, color: 'var(--gray)' }}>
          💡 بيانات الدخول الافتراضية:<br />
          المستخدم: <strong style={{ color: 'var(--white)' }}>owner</strong> | كلمة المرور: <strong style={{ color: 'var(--white)' }}>owner123</strong>
        </div>
      </motion.div>
    </div>
  )
}
