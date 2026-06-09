import { useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'

const experiences = [
  { icon: '🕯️', title: 'Candlelit Ambiance', desc: 'Soft candlelight sets the mood for an unforgettable evening in our stone-walled dining rooms.' },
  { icon: '🎶', title: 'Live Oud Music', desc: 'Traditional Palestinian oud performances every Thursday and Friday evening.' },
  { icon: '🍷', title: 'Curated Wine Cellar', desc: 'A selection of Palestinian and international wines, expertly paired with our dishes.' },
  { icon: '👑', title: 'Private Dining', desc: 'Exclusive rooms for celebrations, business dinners, and intimate gatherings.' },
  { icon: '🌿', title: 'Garden Terrace', desc: 'Dine under the stars on our rooftop terrace overlooking the old city of Ramallah.' },
  { icon: '🎁', title: 'Gift Experiences', desc: 'Gift your loved ones a Darna dining experience they will never forget.' },
]

export default function Experience() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-5%', '5%'])

  return (
    <section ref={ref} style={{ background: 'var(--dark)', position: 'relative', overflow: 'hidden' }}>
      {/* Parallax BG text */}
      <motion.div style={{ y, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 'clamp(100px, 18vw, 220px)',
          fontWeight: 900,
          color: 'rgba(201,168,76,0.03)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '10px',
        }}>
          DARNA
        </div>
      </motion.div>

      <div className="container" style={{ position: 'relative', zIndex: 2 }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '70px' }}
        >
          <p className="section-tag">The Darna Experience</p>
          <div className="divider" style={{ justifyContent: 'center' }}>
            <div className="divider-line" style={{ maxWidth: '80px' }} />
            <div className="divider-diamond" />
            <div className="divider-line" style={{ maxWidth: '80px' }} />
          </div>
          <h2 className="section-title">
            More Than a <span className="gold-gradient">Meal</span>
          </h2>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(201,168,76,0.1)' }}>
          {experiences.map((exp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              style={{
                padding: '48px 40px',
                background: 'var(--dark)',
                transition: 'background 0.3s ease',
                textAlign: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--dark)'}
            >
              <motion.div
                whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
                style={{ fontSize: '40px', marginBottom: '20px', display: 'block' }}
              >
                {exp.icon}
              </motion.div>
              <h3 style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '20px',
                fontWeight: 700,
                marginBottom: '12px',
                color: 'var(--gold-light)',
              }}>{exp.title}</h3>
              <p style={{ color: 'var(--gray)', fontSize: '14px', lineHeight: 1.7 }}>{exp.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.7 }}
          style={{ textAlign: 'center', marginTop: '70px' }}
        >
          <a href="#reservation" className="btn-gold">
            <span>Experience Darna Tonight</span>
          </a>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          #experience-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          #experience-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
