import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'

export default function Menu() {
  const [categories, setCategories] = useState([])
  const [menuData, setMenuData] = useState([])
  const [activecat, setActiveCat] = useState(null)
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    fetch('/api/menu/full')
      .then(r => r.json())
      .then(data => {
        setMenuData(data.data)
        setCategories(data.data.map(c => ({ id: c.id, name: c.name, icon: c.icon })))
        setActiveCat(data.data[0]?.id || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const activeItems = menuData.find(c => c.id === activecat)?.items || []

  return (
    <section id="menu" ref={ref} style={{ background: 'var(--black)', position: 'relative', overflow: 'hidden' }}>
      {/* Decor */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '800px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(201,168,76,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '70px' }}
        >
          <p className="section-tag">Culinary Journey</p>
          <div className="divider" style={{ justifyContent: 'center' }}>
            <div className="divider-line" style={{ maxWidth: '80px' }} />
            <div className="divider-diamond" />
            <div className="divider-line" style={{ maxWidth: '80px' }} />
          </div>
          <h2 className="section-title">
            Our <span className="gold-gradient">Menu</span>
          </h2>
          <p className="section-subtitle" style={{ margin: '16px auto 0' }}>
            Each dish is a story — of our land, our people, and our passion for authentic Palestinian flavors.
          </p>
        </motion.div>

        {/* Category tabs */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '60px' }}
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                style={{
                  padding: '12px 28px',
                  border: activecat === cat.id ? 'none' : '1px solid rgba(201,168,76,0.3)',
                  background: activecat === cat.id
                    ? 'linear-gradient(135deg, var(--gold-dark), var(--gold))'
                    : 'transparent',
                  color: activecat === cat.id ? 'var(--black)' : 'var(--gray-light)',
                  fontSize: '12px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </motion.div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '200px', borderRadius: '2px' }} />
            ))}
          </div>
        )}

        {/* Menu items */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activecat}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}
          >
            {activeItems.map((item, i) => (
              <MenuCard key={item.id} item={item} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        @media (max-width: 900px) {
          #menu .container > div:last-child { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          #menu .container > div:last-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}

function MenuCard({ item, index }) {
  const [hovered, setHovered] = useState(false)

  const emojis = { 1: '🥗', 2: '🍽️', 3: '🔥', 4: '🍮', 5: '☕' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '32px',
        border: `1px solid ${hovered ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.1)'}`,
        background: hovered ? 'rgba(201,168,76,0.05)' : 'transparent',
        transition: 'all 0.35s ease',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* Featured badge */}
      {item.is_featured === 1 && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'var(--gold)',
          color: 'var(--black)',
          fontSize: '9px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          padding: '4px 10px',
          fontWeight: 700,
        }}>Chef's Pick</div>
      )}

      {/* Hover glow */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0 }}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
        }}
      />

      <div style={{ fontSize: '36px', marginBottom: '16px' }}>
        {emojis[item.category_id] || '🍽️'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
            {item.name}
          </h3>
          <p style={{ fontFamily: 'Amiri, serif', fontSize: '14px', color: 'var(--gold)', opacity: 0.8 }}>
            {item.name_ar}
          </p>
        </div>
        <div style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--gold)',
          whiteSpace: 'nowrap',
          marginLeft: '16px',
        }}>
          ₪{item.price}
        </div>
      </div>

      <p style={{ color: 'var(--gray)', fontSize: '13px', lineHeight: 1.7 }}>
        {item.description}
      </p>

      <motion.div
        animate={{ scaleX: hovered ? 1 : 0 }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
          transformOrigin: 'left',
        }}
      />
    </motion.div>
  )
}
