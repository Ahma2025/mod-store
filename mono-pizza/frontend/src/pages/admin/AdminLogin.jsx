import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const [form, setForm]     = useState({ username:'', password:'' });
  const [showP, setShowP]   = useState(false);
  const [err, setErr]       = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res = await axios.post('/api/auth/login', form);
      localStorage.setItem('admin_token', res.data.token);
      navigate('/admin/orders');
    } catch {
      setErr('اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight:'100vh', background:'#111',
      display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      backgroundImage:'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(230,57,70,0.08) 0%, transparent 60%)',
    }}>
      <div style={{width:'100%', maxWidth:380}}>

        {/* Logo */}
        <div style={{textAlign:'center', marginBottom:36}}>
          <div style={{
            width:88, height:88, borderRadius:20, margin:'0 auto 16px',
            overflow:'hidden', boxShadow:'0 8px 30px rgba(230,57,70,0.35)',
          }}>
            <img src="/loggo.jpeg" alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <div style={{fontWeight:900, fontSize:22, color:'#fff', letterSpacing:1}}>Italiano Pizza</div>
          <div style={{fontSize:12, color:'#444', marginTop:4, letterSpacing:3, textTransform:'uppercase'}}>لوحة التحكم</div>
        </div>

        {/* Card */}
        <div style={{background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:22, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}}>
          <form onSubmit={submit} style={{display:'flex', flexDirection:'column', gap:16}}>

            <div>
              <label style={{fontSize:12, color:'#666', fontWeight:700, marginBottom:6, display:'block', letterSpacing:1, textTransform:'uppercase'}}>اسم المستخدم</label>
              <input type="text" value={form.username} placeholder="admin"
                onChange={e=>setForm(p=>({...p,username:e.target.value}))} required className="inp"/>
            </div>

            <div>
              <label style={{fontSize:12, color:'#666', fontWeight:700, marginBottom:6, display:'block', letterSpacing:1, textTransform:'uppercase'}}>كلمة المرور</label>
              <div style={{position:'relative'}}>
                <input type={showP?'text':'password'} value={form.password} placeholder="••••••••"
                  onChange={e=>setForm(p=>({...p,password:e.target.value}))} required className="inp" style={{paddingLeft:44}}/>
                <button type="button" onClick={()=>setShowP(!showP)} style={{
                  position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', color:'#555', cursor:'pointer', display:'flex',
                }}>
                  {showP ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {err && (
              <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,padding:'10px 14px',color:'#ef4444',fontSize:13,fontWeight:700,textAlign:'center'}}>
                {err}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-red"
              style={{padding:'14px',borderRadius:14,fontSize:15,marginTop:4,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {loading
                ? <><div style={{width:18,height:18,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> جاري الدخول...</>
                : 'دخول للوحة التحكم'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
