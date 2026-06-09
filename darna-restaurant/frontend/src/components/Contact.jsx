import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import toast from 'react-hot-toast'

export default function Contact() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill all required fields.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('✉️ Message sent! We\'ll get back to you soon.')
        setForm({ name: '', email: '', subject: '', message: '' })
      } else {
        toast.error(data.message || 'Failed to send.')
      }
    } catch {
      toast.error('Cannot connect to server.')
    }
    setLoading(false)
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(201,168,76,0.2)',
    color: 'var(--white)',
    padding: '16px 20px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    width: '100%',
    transition: 'border-color 0.3s',
  }

  return (
    <section id="contact" ref={ref} style={{ background: 'var(--black)' }}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '70px' }}
        >
          <p className="section-tag">Get in Touch</p>
          <div className="divider" style={{ justifyContent: 'center' }}>
            <div className="divider-line" style={{ maxWidth: '80px' }} />
            <div className="divider-diamond" />
            <div className="divider-line" style={{ maxWidth: '80px' }} />
          </div>
          <h2 className="section-title">Contact <span className="gold-gradient">Us</span></h2>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px' }}>
          {/* Map placeholder */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div style={{
              width: '100%',
              aspectRatio: '1',
              background: `
                linear-gradient(135deg, rgba(201,168,76,0.1), rgba(139,105,20,0.05)),
                repeating-linear-gradient(0deg, rgba(201,168,76,0.04) 0px, rgba(201,168,76,0.04) 1px, transparent 1px, transparent 40px),
                repeating-linear-gradient(90deg, rgba(201,168,76,0.04) 0px, rgba(201,168,76,0.04) 1px, transparent 1px, transparent 40px)
              `,
              border: '1px solid rgba(201,168,76,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '32px',
            }}>
              <div style={{ fontSize: '60px' }}>📍</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '16px' }}>Darna Restaurant</div>
                <div style={{ color: 'var(--gray)', fontSize: '14px', marginTop: '4px' }}>Al-Masyoun, Ramallah</div>
                <div style={{ color: 'var(--gray)', fontSize: '14px' }}>West Bank, Palestine</div>
              </div>
            </div>

            {/* Social links */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { icon: '📸', label: 'Instagram', handle: '@darna_ramallah' },
                { icon: '📘', label: 'Facebook', handle: 'Darna Restaurant' },
                { icon: '🐦', label: 'Twitter', handle: '@darnaramallah' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    border: '1px solid rgba(201,168,76,0.15)',
                    background: 'rgba(201,168,76,0.03)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.background = 'rgba(201,168,76,0.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)'; e.currentTarget.style.background = 'rgba(201,168,76,0.03)' }}
                >
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{s.icon}</div>
                  <div style={{ fontSize: '10px', color: 'var(--gold)', letterSpacing: '1px', textTransform: 'uppercase' }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gray)', marginTop: '2px' }}>{s.handle}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              background: 'rgba(201,168,76,0.03)',
              border: '1px solid rgba(201,168,76,0.15)',
              padding: '48px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Name *</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
              </div>
              <div>
                <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="your@email.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Subject</label>
              <input name="subject" value={form.subject} onChange={handleChange} placeholder="How can we help?" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Message *</label>
              <textarea name="message" value={form.message} onChange={handleChange} placeholder="Your message..." rows={6}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
            </div>
            <button type="submit" className="btn-gold" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', clipPath: 'none', opacity: loading ? 0.7 : 1, padding: '18px' }}>
              <span>{loading ? 'Sending...' : 'Send Message'}</span>
            </button>
          </motion.form>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #contact .container > div { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
