import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const { cartCount } = useCart();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(17,17,17,0.97)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid #2a2a2a' : '1px solid transparent',
      transition: 'all 0.4s',
      padding: scrolled ? '10px 0' : '18px 0',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            overflow: 'hidden', flexShrink: 0,
            boxShadow: '0 4px 20px rgba(230,57,70,0.35)',
          }}>
            <img src="/loggo.jpeg" alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', lineHeight: 1, letterSpacing: 1 }}>Italiano Pizza</div>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>طولكرم • فلسطين</div>
          </div>
        </Link>

        {/* Cart */}
        <Link to="/cart" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: cartCount > 0 ? 'rgba(230,57,70,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${cartCount > 0 ? 'rgba(230,57,70,0.4)' : '#2a2a2a'}`,
            borderRadius: 12, padding: '9px 14px', cursor: 'pointer',
            transition: 'all 0.25s',
          }}>
            <ShoppingCart size={17} color={cartCount > 0 ? '#e63946' : '#888'} />
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>الكارت</span>
            {cartCount > 0 && (
              <div className="pr" style={{
                minWidth: 20, height: 20, borderRadius: 10,
                background: '#e63946', color: '#fff',
                fontSize: 11, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
              }}>{cartCount}</div>
            )}
          </div>
        </Link>
      </div>
    </nav>
  );
}
