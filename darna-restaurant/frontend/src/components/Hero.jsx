import { useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

const DISHES = [
  { emoji: '🥘', label: 'Mansaf', pos: { top: '20%', left: '8%' } },
  { emoji: '🍖', label: 'Kofta', pos: { top: '65%', left: '5%' } },
  { emoji: '🫙', label: 'Hummus', pos: { top: '15%', right: '8%' } },
  { emoji: '🥗', label: 'Fattoush', pos: { bottom: '25%', right: '6%' } },
]

export default function Hero() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '40%'])
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <section id="hero" ref={ref} style={{
      position: 'relative',
      height: '100vh',
      minHeight: '700px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* BG image via CSS gradient (no image needed) */}
      <motion.div style={{ y, position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse at 30% 50%, rgba(201,168,76,0.12) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 30%, rgba(139,105,20,0.08) 0%, transparent 50%),
            linear-gradient(180deg, #0A0A0A 0%, #111108 50%, #0A0A0A 100%)
          `,
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />
      </motion.div>

      {/* Floating dish badges */}
      {DISHES.map((dish, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 1.2 + i * 0.2, type: 'spring', stiffness: 100 }}
          style={{
            position: 'absolute',
            ...dish.pos,
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.25)',
            backdropFilter: 'blur(10px)',
            padding: '14px 20px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '22px' }}>{dish.emoji}</span>
          <span style={{ fontSize: '12px', letterSpacing: '1.5px', color: 'var(--gold-light)' }}>{dish.label}</span>
        </motion.div>
      ))}

      {/* Main content */}
      <motion.div style={{ opacity, position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 20px' }}>
        {/* Tag */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}
        >
          <div style={{ width: '40px', height: '1px', background: 'var(--gold)' }} />
          <span style={{ fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Est. 1998 · Ramallah, Palestine
          </span>
          <div style={{ width: '40px', height: '1px', background: 'var(--gold)' }} />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(56px, 10vw, 130px)',
            fontWeight: 900,
            lineHeight: 0.9,
            marginBottom: '8px',
          }}
        >
          <span className="gold-gradient">DARNA</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', margin: '20px auto', maxWidth: '400px' }}
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          style={{
            fontFamily: 'Amiri, serif',
            fontSize: 'clamp(18px, 3vw, 26px)',
            color: 'var(--gold-light)',
            letterSpacing: '3px',
            marginBottom: '12px',
          }}
        >
          دارنا
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          style={{ color: 'var(--gray)', fontSize: '16px', maxWidth: '500px', margin: '0 auto 48px', lineHeight: 1.7 }}
        >
          Authentic Palestinian heritage cuisine, reimagined for the modern palate.
          A culinary journey through the heart of our homeland.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <a href="#reservation" className="btn-gold"><span>Reserve a Table</span></a>
          <a href="#menu" className="btn-outline">Explore Menu</a>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        style={{
          position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        }}
      >
        <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--gray)', textTransform: 'uppercase' }}>Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          style={{ width: '1px', height: '40px', background: 'linear-gradient(180deg, var(--gold), transparent)' }}
        />
      </motion.div>
    </section>
  )
}
