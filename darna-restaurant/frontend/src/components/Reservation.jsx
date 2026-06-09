import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import toast from 'react-hot-toast'

const timeSlots = ['12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM']
const guestOptions = [1, 2, 3, 4, 5, 6, 7, 8]

export default function Reservation() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [form, setForm] = useState({ name: '', email: '', phone: '', date: '', time: '', guests: '', special_requests: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone || !form.date || !form.time || !form.guests) {
      toast.error('Please fill in all required fields.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, guests: Number(form.guests) }),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        toast.success('🎉 Your table has been reserved!')
      } else {
        toast.error(data.message || 'Something went wrong.')
      }
    } catch {
      toast.error('Cannot connect to server. Please try again.')
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
    WebkitAppearance: 'none',
  }

  return (
    <section id="reservation" ref={ref} style={{ background: 'var(--dark)', position: 'relative', overflow: 'hidden' }}>
      {/* Decor */}
      <div style={{
        position: 'absolute', top: '50%', left: '-200px', transform: 'translateY(-50%)',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '80px', alignItems: 'start' }}>
          {/* Left info */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <p className="section-tag">Book a Table</p>
            <div className="divider"><div className="divider-line" style={{ maxWidth: '60px' }} /><div className="divider-diamond" /></div>
            <h2 className="section-title" style={{ marginBottom: '24px' }}>
              Reserve Your<br /><span className="gold-gradient">Experience</span>
            </h2>
            <p style={{ color: 'var(--gray)', lineHeight: 1.8, marginBottom: '48px', fontSize: '15px' }}>
              Every table at Darna is a special place. Reserve yours and let us craft an unforgettable evening for you and your guests.
            </p>

            {/* Info cards */}
            {[
              { icon: '📍', label: 'Location', value: 'Al-Masyoun, Ramallah, Palestine' },
              { icon: '📞', label: 'Phone', value: '+970 2 298 0000' },
              { icon: '🕐', label: 'Opening Hours', value: 'Lunch: 12PM–4PM · Dinner: 7PM–11PM' },
              { icon: '📅', label: 'Reservations', value: 'Walk-ins welcome, booking preferred' },
            ].map((info, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1 }}
                style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px' }}
              >
                <div style={{
                  width: '44px', height: '44px',
                  background: 'rgba(201,168,76,0.1)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', flexShrink: 0,
                }}>
                  {info.icon}
                </div>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '4px' }}>{info.label}</div>
                  <div style={{ color: 'var(--gray-light)', fontSize: '14px' }}>{info.value}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  textAlign: 'center',
                  padding: '80px 40px',
                  border: '1px solid rgba(201,168,76,0.3)',
                  background: 'rgba(201,168,76,0.05)',
                }}
              >
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: 'var(--gold-light)', marginBottom: '16px' }}>
                  Reservation Confirmed!
                </h3>
                <p style={{ color: 'var(--gray)', lineHeight: 1.7 }}>
                  Thank you, <strong style={{ color: 'var(--white)' }}>{form.name}</strong>!<br />
                  We look forward to welcoming you to Darna.<br />
                  A confirmation will be sent to {form.email}.
                </p>
                <button onClick={() => { setSubmitted(false); setForm({ name:'',email:'',phone:'',date:'',time:'',guests:'',special_requests:'' }) }}
                  className="btn-outline" style={{ marginTop: '32px' }}>
                  Make Another Reservation
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} style={{
                background: 'rgba(201,168,76,0.03)',
                border: '1px solid rgba(201,168,76,0.15)',
                padding: '48px',
              }}>
                <h3 style={{
                  fontFamily: 'Playfair Display, serif', fontSize: '22px',
                  marginBottom: '32px', paddingBottom: '20px',
                  borderBottom: '1px solid rgba(201,168,76,0.15)',
                }}>Table Reservation</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Full Name *</label>
                    <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Phone *</label>
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="+970 xx xxx xxxx" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="your@email.com" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Date *</label>
                    <input name="date" type="date" value={form.date} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'dark' }}
                      onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Time *</label>
                    <select name="time" value={form.time} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Select time</option>
                      {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Guests *</label>
                    <select name="guests" value={form.guests} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Guests</option>
                      {guestOptions.map(g => <option key={g} value={g}>{g} {g === 1 ? 'Person' : 'People'}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <label style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '8px' }}>Special Requests</label>
                  <textarea name="special_requests" value={form.special_requests} onChange={handleChange}
                    placeholder="Allergies, special occasions, seating preferences..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'}
                  />
                </div>

                <button type="submit" className="btn-gold" disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1, clipPath: 'none', padding: '18px' }}>
                  <span>{loading ? 'Confirming...' : 'Confirm Reservation'}</span>
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          #reservation .container > div { grid-template-columns: 1fr !important; gap: 50px !important; }
        }
        @media (max-width: 600px) {
          #reservation form > div:nth-child(4) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
