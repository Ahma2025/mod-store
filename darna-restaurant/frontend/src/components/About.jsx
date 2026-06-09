import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const features = [
  { icon: '🏛️', title: '200-Year-Old Stone Building', desc: 'Housed in a beautifully restored historic Palestinian stone mansion.' },
  { icon: '👨‍🍳', title: 'Master Chefs', desc: 'Our culinary team blends generations of Palestinian recipes with modern techniques.' },
  { icon: '🌿', title: 'Locally Sourced', desc: 'Fresh ingredients from Palestinian farms, supporting our local community.' },
  { icon: '🏆', title: 'Award Winning', desc: 'Recognized as the finest dining experience in the West Bank since 2005.' },
]

export default function About() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="about" ref={ref} style={{ background: 'var(--dark)', position: 'relative', overflow: 'hidden' }}>
      {/* BG decor */}
      <div style={{
        position: 'absolute', top: '-100px', right: '-100px',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '100px', alignItems: 'center' }}>
          {/* Left: Visual */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'relative' }}
          >
            {/* Main visual box */}
            <div style={{
              width: '100%',
              aspectRatio: '4/5',
              background: `
                linear-gradient(135deg, rgba(201,168,76,0.15), rgba(139,105,20,0.05)),
                repeating-linear-gradient(45deg, rgba(201,168,76,0.03) 0px, rgba(201,168,76,0.03) 1px, transparent 1px, transparent 20px)
              `,
              border: '1px solid rgba(201,168,76,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '120px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <span style={{ filter: 'drop-shadow(0 0 40px rgba(201,168,76,0.5))' }}>🏛️</span>

              {/* Corner accents */}
              {['top:0;left:0', 'top:0;right:0', 'bottom:0;left:0', 'bottom:0;right:0'].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  ...Object.fromEntries(pos.split(';').map(p => p.split(':'))),
                  width: '30px', height: '30px',
                  borderTop: i < 2 ? '2px solid var(--gold)' : 'none',
                  borderBottom: i >= 2 ? '2px solid var(--gold)' : 'none',
                  borderLeft: i % 2 === 0 ? '2px solid var(--gold)' : 'none',
                  borderRight: i % 2 === 1 ? '2px solid var(--gold)' : 'none',
                }} />
              ))}
            </div>

            {/* Floating badge */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                bottom: '-30px', right: '-30px',
                background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
                color: 'var(--black)',
                padding: '24px',
                textAlign: 'center',
                minWidth: '130px',
              }}
            >
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '42px', fontWeight: 900, lineHeight: 1 }}>25+</div>
              <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Years of Excellence</div>
            </motion.div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="section-tag">Our Story</p>
            <div className="divider"><div className="divider-line" style={{ maxWidth: '60px' }} /><div className="divider-diamond" /></div>
            <h2 className="section-title" style={{ marginBottom: '24px' }}>
              A Taste of<br />
              <span className="gold-gradient">Palestinian Heritage</span>
            </h2>
            <p style={{ color: 'var(--gray)', lineHeight: 1.8, marginBottom: '16px', fontSize: '15px' }}>
              Nestled in the heart of Ramallah within a beautifully restored 200-year-old stone building,
              Darna is more than a restaurant — it is a living testament to Palestinian culture, warmth, and culinary artistry.
            </p>
            <p style={{ color: 'var(--gray)', lineHeight: 1.8, marginBottom: '40px', fontSize: '15px' }}>
              Each dish we serve is a love letter to our homeland, crafted with recipes passed down through generations
              and elevated with contemporary technique. Come, sit at our table — it is yours.
            </p>

            {/* Features grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  style={{
                    padding: '20px',
                    border: '1px solid rgba(201,168,76,0.15)',
                    background: 'rgba(201,168,76,0.03)',
                    transition: 'border-color 0.3s, background 0.3s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'
                    e.currentTarget.style.background = 'rgba(201,168,76,0.06)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)'
                    e.currentTarget.style.background = 'rgba(201,168,76,0.03)'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{f.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gold-light)', marginBottom: '6px' }}>{f.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gray)', lineHeight: 1.6 }}>{f.desc}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #about .container > div { grid-template-columns: 1fr !important; gap: 60px !important; }
        }
      `}</style>
    </section>
  )
}
