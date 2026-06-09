import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const links = [
  { label: 'Home', href: '#hero' },
  { label: 'About', href: '#about' },
  { label: 'Menu', href: '#menu' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Reserve', href: '#reservation' },
  { label: 'Contact', href: '#contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 1000,
          padding: scrolled ? '16px 40px' : '28px 40px',
          background: scrolled ? 'rgba(10,10,10,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(201,168,76,0.15)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.4s ease',
        }}
      >
        {/* Logo */}
        <a href="#hero" style={{ textDecoration: 'none' }}>
          <div>
            <div style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '28px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #8B6914, #C9A84C, #E8C97A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '3px',
            }}>DARNA</div>
            <div style={{ fontSize: '9px', letterSpacing: '5px', color: 'var(--gray)', textTransform: 'uppercase', marginTop: '-4px' }}>دارنا · Fine Dining</div>
          </div>
        </a>

        {/* Desktop Links */}
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }} className="desktop-nav">
          {links.map((link, i) => (
            <motion.a
              key={link.href}
              href={link.href}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i + 0.3 }}
              style={{
                color: 'var(--gray-light)',
                textDecoration: 'none',
                fontSize: '12px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontWeight: 500,
                position: 'relative',
                transition: 'color 0.3s',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--gold)'}
              onMouseLeave={e => e.target.style.color = 'var(--gray-light)'}
            >
              {link.label}
            </motion.a>
          ))}
          <a href="#reservation" className="btn-gold" style={{ padding: '12px 28px', fontSize: '11px' }}>
            <span>Book a Table</span>
          </a>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'none',
            flexDirection: 'column',
            gap: '5px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
          }}
          className="hamburger"
        >
          {[0,1,2].map(i => (
            <motion.div key={i}
              animate={menuOpen ? {
                rotate: i === 1 ? 0 : i === 0 ? 45 : -45,
                y: i === 1 ? 0 : i === 0 ? 7 : -7,
                opacity: i === 1 ? 0 : 1,
              } : { rotate: 0, y: 0, opacity: 1 }}
              style={{ width: 24, height: 1.5, background: 'var(--gold)', transformOrigin: 'center' }}
            />
          ))}
        </button>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--black)',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '40px',
            }}
          >
            {links.map((link, i) => (
              <motion.a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                style={{
                  color: 'var(--white)',
                  textDecoration: 'none',
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '36px',
                  fontWeight: 700,
                }}
              >
                {link.label}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
