import { useState, useEffect } from 'react';
import axios from 'axios';
import MenuItemCard from '../components/MenuItemCard';

export default function Home() {
  const [menu, setMenu]       = useState([]);
  const [cats, setCats]       = useState([]);
  const [active, setActive]   = useState('الكل');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/menu').then(r => {
      setMenu(r.data);
      setCats(['الكل', ...new Set(r.data.map(i => i.category))]);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = active === 'الكل' ? menu : menu.filter(i => i.category === active);

  return (
    <div style={{ minHeight: '100vh', background: '#111' }}>

      {/* ══════════ HERO ══════════ */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', textAlign: 'center', padding: '100px 20px 60px',
        position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(230,57,70,0.12) 0%, transparent 65%), #111',
      }}>
        {/* Deco circles — hidden on tiny screens via opacity trick */}
        <div style={{ position: 'absolute', top: 80, right: '8%', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(230,57,70,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 120, right: '12%', width: 160, height: 160, borderRadius: '50%', border: '1px solid rgba(230,57,70,0.1)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 60, left: '6%', width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(255,107,53,0.07)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div className="fl fu" style={{
          marginBottom: 20, animationDelay: '0s',
        }}>
          <img src="/loggo.jpeg" alt="Italiano Pizza"
            style={{
              width: 'clamp(140px,22vw,220px)',
              height: 'clamp(140px,22vw,220px)',
              objectFit: 'contain',
              borderRadius: '50%',
              filter: 'drop-shadow(0 0 30px rgba(255,107,53,0.4))',
            }}
          />
        </div>

        {/* Title */}
        <h1 className="fu" style={{
          fontWeight: 900, lineHeight: 1.05, marginBottom: 14,
          fontSize: 'clamp(40px,9vw,100px)',
          animationDelay: '0.08s',
        }}>
          <span className="text-fire">Italiano </span>
          <span style={{ color: '#fff' }}>Pizza</span>
        </h1>

        {/* Subtitle */}
        <p className="fu" style={{
          color: '#777', fontSize: 'clamp(13px,2.5vw,16px)',
          marginBottom: 28, animationDelay: '0.15s',
          padding: '0 16px',
        }}>
          طولكرم، فلسطين — عش تجربة لا تُنسى مع أشهى بيتزا!
        </p>

        {/* Info pills */}
        <div className="fu" style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          justifyContent: 'center', animationDelay: '0.22s',
          padding: '0 12px',
        }}>
          {[
            { icon: '⏱️', text: '20-35 دقيقة' },
            { icon: '🚗', text: 'توصيل +10₪' },
            { icon: '🏪', text: 'استلام مجاني' },
            { icon: '⭐', text: '4.5 تقييم' },
          ].map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a',
              borderRadius: 100, padding: '8px 14px',
              fontSize: 'clamp(11px,2vw,13px)', color: '#ccc', fontWeight: 600,
            }}>
              <span>{p.icon}</span>{p.text}
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          color: '#333', fontSize: 22, animation: 'float 2s ease-in-out infinite',
        }}>↓</div>
      </section>

      {/* ══════════ MENU ══════════ */}
      <section id="menu" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 14px 80px' }}>

        {/* Categories */}
        <div className="no-scroll" style={{
          display: 'flex', gap: 8, marginBottom: 28, overflowX: 'auto',
          justifyContent: 'flex-start', paddingBottom: 4, paddingTop: 4,
        }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setActive(cat)}
              style={{
                whiteSpace: 'nowrap', padding: '9px 18px', borderRadius: 100,
                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.25s',
                background: active === cat ? '#e63946' : 'rgba(255,255,255,0.05)',
                border: active === cat ? '1.5px solid #e63946' : '1.5px solid #2a2a2a',
                color: active === cat ? '#fff' : '#888',
                boxShadow: active === cat ? '0 4px 20px rgba(230,57,70,0.3)' : 'none',
                fontFamily: 'Cairo, sans-serif',
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="menu-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                background: '#1c1c1c', borderRadius: 20, height: 220,
                animation: 'shimmer 1.5s infinite',
                backgroundImage: 'linear-gradient(90deg,#1c1c1c 25%,#252525 50%,#1c1c1c 75%)',
                backgroundSize: '200% 100%',
              }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }} className="fl">🍕</div>
            <p style={{ fontSize: 18, fontWeight: 700 }}>لا يوجد أصناف متاحة حالياً</p>
            <p style={{ fontSize: 13, marginTop: 8, color: '#333' }}>تواصل معنا لمعرفة العروض</p>
          </div>
        ) : (
          <div className="menu-grid">
            {filtered.map((item, i) => (
              <div key={item._id} className="fu" style={{ animationDelay: `${i * 0.05}s` }}>
                <MenuItemCard item={item} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ borderTop: '1px solid #1a1a1a', padding: '36px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🍕</div>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }} className="text-fire">Italiano Pizza</div>
        <p style={{ color: '#444', fontSize: 13 }}>طولكرم، فلسطين &nbsp;•&nbsp; 0568 188 600</p>
        <p style={{ color: '#2a2a2a', fontSize: 11, marginTop: 20 }}>© 2024 جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}
