import { useRef, useEffect, useState } from 'react'
import { motion, useInView } from 'framer-motion'

const stats = [
  { value: 25, suffix: '+', label: 'Years of Excellence' },
  { value: 50000, suffix: '+', label: 'Happy Guests' },
  { value: 120, suffix: '+', label: 'Signature Dishes' },
  { value: 15, suffix: '', label: 'International Awards' },
]

function CountUp({ target, suffix, inView }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView) return
    const duration = 2000
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, duration / steps)
    return () => clearInterval(timer)
  }, [inView, target])
  return <>{count.toLocaleString()}{suffix}</>
}

export default function Stats() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section ref={ref} style={{
      padding: '0',
      background: 'linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(139,105,20,0.04) 50%, rgba(201,168,76,0.08) 100%)',
      borderTop: '1px solid rgba(201,168,76,0.15)',
      borderBottom: '1px solid rgba(201,168,76,0.15)',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          padding: '70px 0',
        }}>
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.7 }}
              style={{
                textAlign: 'center',
                padding: '20px',
                borderRight: i < stats.length - 1 ? '1px solid rgba(201,168,76,0.15)' : 'none',
              }}
            >
              <div style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: 'clamp(40px, 5vw, 64px)',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #8B6914, #C9A84C, #E8C97A)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1,
              }}>
                <CountUp target={stat.value} suffix={stat.suffix} inView={inView} />
              </div>
              <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--gray)', textTransform: 'uppercase', marginTop: '8px' }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          section > .container > div { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  )
}
