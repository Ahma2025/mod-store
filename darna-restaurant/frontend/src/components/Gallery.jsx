import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'

const galleryItems = [
  { emoji: '🥘', label: 'Mansaf', size: 'large', category: 'food' },
  { emoji: '🏛️', label: 'Our Venue', size: 'small', category: 'venue' },
  { emoji: '🍖', label: 'Mixed Grill', size: 'small', category: 'food' },
  { emoji: '🌿', label: 'Garden', size: 'small', category: 'venue' },
  { emoji: '🫙', label: 'Hummus Art', size: 'small', category: 'food' },
  { emoji: '🍮', label: 'Kunafa', size: 'large', category: 'dessert' },
  { emoji: '👨‍🍳', label: 'Our Chef', size: 'small', category: 'team' },
  { emoji: '🎶', label: 'Live Music', size: 'small', category: 'experience' },
  { emoji: '🥗', label: 'Fattoush', size: 'small', category: 'food' },
]

const filters = ['All', 'Food', 'Venue', 'Dessert', 'Experience']

const BG_COLORS = [
  'linear-gradient(135deg, rgba(139,105,20,0.2), rgba(201,168,76,0.08))',
  'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(139,105,20,0.15))',
  'linear-gradient(135deg, rgba(100,80,15,0.25), rgba(201,168,76,0.05))',
]

export default function Gallery() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)

  const filtered = filter === 'All' ? galleryItems : galleryItems.filter(i => i.category.toLowerCase() === filter.toLowerCase())

  return (
    <section id="gallery" ref={ref} style={{ background: 'var(--black)' }}>
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '50px' }}
        >
          <p className="section-tag">Visual Story</p>
          <div className="divider" style={{ justifyContent: 'center' }}>
            <div className="divider-line" style={{ maxWidth: '80px' }} />
            <div className="divider-diamond" />
            <div className="divider-line" style={{ maxWidth: '80px' }} />
          </div>
          <h2 className="section-title">Our <span className="gold-gradient">Gallery</span></h2>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2 }}
          style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '50px' }}
        >
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 24px',
              border: filter === f ? 'none' : '1px solid rgba(201,168,76,0.25)',
              background: filter === f ? 'var(--gold)' : 'transparent',
              color: filter === f ? 'var(--black)' : 'var(--gray)',
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.3s',
            }}>{f}</button>
          ))}
        </motion.div>

        {/* Masonry grid */}
        <motion.div layout style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridAutoRows: '200px',
          gap: '8px',
        }}>
          <AnimatePresence>
            {filtered.map((item, i) => (
              <motion.div
                key={item.label}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                onClick={() => setSelected(item)}
                style={{
                  gridColumn: item.size === 'large' ? 'span 2' : 'span 1',
                  gridRow: item.size === 'large' ? 'span 2' : 'span 1',
                  background: BG_COLORS[i % BG_COLORS.length],
                  border: '1px solid rgba(201,168,76,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.3s',
                }}
                whileHover={{ scale: 1.02 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.1)'}
              >
                <span style={{ fontSize: item.size === 'large' ? '72px' : '48px', marginBottom: '12px' }}>{item.emoji}</span>
                <span style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>{item.label}</span>

                {/* Hover overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(201,168,76,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '24px', color: 'var(--gold)' }}>⊕</div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9000,
              background: 'rgba(0,0,0,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              style={{
                background: 'var(--dark)',
                border: '1px solid rgba(201,168,76,0.3)',
                padding: '60px',
                textAlign: 'center',
                maxWidth: '400px',
              }}
            >
              <div style={{ fontSize: '100px', marginBottom: '24px' }}>{selected.emoji}</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: 'var(--gold-light)' }}>{selected.label}</h3>
              <p style={{ color: 'var(--gray)', marginTop: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px' }}>{selected.category}</p>
              <button onClick={() => setSelected(null)} style={{
                marginTop: '32px', padding: '12px 32px',
                border: '1px solid var(--gold)', background: 'transparent',
                color: 'var(--gold)', cursor: 'pointer', fontSize: '12px',
                letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
              }}>Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          #gallery .container > div:last-of-type { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  )
}
