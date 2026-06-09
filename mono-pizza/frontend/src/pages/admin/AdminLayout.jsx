import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';

export default function AdminLayout() {
  const navigate = useNavigate();
  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login'); }, []);
  const logout = () => { localStorage.removeItem('admin_token'); navigate('/admin/login'); };

  return (
    <div style={{minHeight:'100vh',background:'#111',direction:'rtl'}}>
      {/* TOP NAVBAR */}
      <nav style={{background:'#161616',borderBottom:'1px solid #222',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:60,position:'sticky',top:0,zIndex:100}}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,overflow:'hidden',boxShadow:'0 2px 10px rgba(230,57,70,0.3)'}}>
            <img src="/loggo.jpeg" alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:15,color:'#fff',lineHeight:1}}>Italiano Pizza</div>
            <div style={{fontSize:10,color:'#555',marginTop:2}}>لوحة التحكم</div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{display:'flex',gap:4}}>
          {[
            {to:'/admin/orders',label:'📋 الطلبات'},
            {to:'/admin/menu',  label:'🍕 القائمة'},
          ].map(l=>(
            <NavLink key={l.to} to={l.to} style={({isActive})=>({
              padding:'7px 18px',borderRadius:10,fontWeight:700,fontSize:14,
              textDecoration:'none',transition:'all 0.2s',fontFamily:'Cairo,sans-serif',
              background: isActive ? 'rgba(230,57,70,0.15)' : 'transparent',
              color: isActive ? '#e63946' : '#888',
              border: `1.5px solid ${isActive ? 'rgba(230,57,70,0.3)' : 'transparent'}`,
            })}>
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link to="/" target="_blank" style={{
            textDecoration:'none',padding:'7px 14px',borderRadius:10,
            background:'rgba(255,255,255,0.05)',border:'1px solid #2a2a2a',
            color:'#888',fontSize:13,fontWeight:700,fontFamily:'Cairo,sans-serif',
          }}>👁 الموقع</Link>
          <button onClick={logout} style={{
            padding:'7px 14px',borderRadius:10,background:'rgba(239,68,68,0.1)',
            border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444',fontSize:13,
            fontWeight:700,cursor:'pointer',fontFamily:'Cairo,sans-serif',
          }}>خروج</button>
        </div>
      </nav>

      {/* Content */}
      <main style={{padding:'28px 24px',maxWidth:1200,margin:'0 auto'}}>
        <Outlet />
      </main>
    </div>
  );
}
