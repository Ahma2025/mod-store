import { motion } from 'framer-motion'

const footerLinks = {
  'Navigate': ['Home', 'About', 'Menu', 'Gallery', 'Reservation', 'Contact'],
  'Dining': ['Lunch Menu', 'Dinner Menu', 'Private Dining', 'Events', 'Gift Cards'],
  'Info': ['Opening Hours', 'Directions', 'Parking', 'Accessibility', 'Press'],
}

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--dark)',
      borderTop: '1px solid rgba(201,168,76,0.15)',
      paddingTop: '80px',
    }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '60px', paddingBottom: '60px' }}>
          {/* Brand */}
          <div>
            <div style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '36px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #8B6914, #C9A84C, #E8C97A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '3px',
              marginBottom: '4px',
            }}>DARNA</div>
            <div style={{ fontFamily: 'Amiri, serif', fontSize: '16px', color: 'var(--gold)', marginBottom: '20px', opacity: 0.8 }}>دارنا</div>
            <p style={{ color: 'var(--gray)', fontSize: '14px', lineHeight: 1.8, maxWidth: '280px', marginBottom: '32px' }}>
              Authentic Palestinian fine dining in the heart of Ramallah. A culinary journey through generations of heritage and flavor.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['📸', '📘', '🐦', '▶️'].map((icon, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.1, y: -2 }}
                  style={{
                    width: '40px', height: '40px',
                    background: 'rgba(201,168,76,0.08)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: '16px',
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'}
                >
                  {icon}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '24px' }}>{title}</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {links.map(link => (
                  <li key={link}>
                    <a href="#" style={{
                      color: 'var(--gray)',
                      textDecoration: 'none',
                      fontSize: '14px',
                      transition: 'color 0.3s',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                      onMouseEnter={e => e.target.style.color = 'var(--gold-light)'}
                      onMouseLeave={e => e.target.style.color = 'var(--gray)'}
                    >
                      <span style={{ width: '4px', height: '4px', background: 'var(--gold)', display: 'inline-block', opacity: 0.5 }} />
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div style={{
          borderTop: '1px solid rgba(201,168,76,0.1)',
          borderBottom: '1px solid rgba(201,168,76,0.1)',
          padding: '40px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px',
        }}>
          <div>
            <h4 style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', marginBottom: '8px' }}>Stay in the loop</h4>
            <p style={{ color: 'var(--gray)', fontSize: '14px' }}>Subscribe for exclusive events, seasonal menus & special offers.</p>
          </div>
          <div style={{ display: 'flex', gap: '0', flex: '1', maxWidth: '460px' }}>
            <input placeholder="your@email.com" style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(201,168,76,0.25)',
              borderRight: 'none',
              color: 'var(--white)',
              padding: '16px 20px',
              fontSize: '14px',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
            }} />
            <button className="btn-gold" style={{ clipPath: 'none', padding: '16px 28px' }}>
              <span>Subscribe</span>
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          padding: '28px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <p style={{ color: 'var(--gray)', fontSize: '13px' }}>
            © 2024 Darna Restaurant. All rights reserved. · Al-Masyoun, Ramallah, Palestine
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Privacy Policy', 'Terms of Service', 'Cookies'].map(link => (
              <a key={link} href="#" style={{ color: 'var(--gray)', fontSize: '12px', textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.color = 'var(--gold)'}
                onMouseLeave={e => e.target.style.color = 'var(--gray)'}
              >{link}</a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          footer .container > div:first-child { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          footer .container > div:first-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  )
}
