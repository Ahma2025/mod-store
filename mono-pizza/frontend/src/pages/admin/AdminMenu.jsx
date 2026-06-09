import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, X, Upload } from 'lucide-react';

const H = t => ({ headers: { Authorization: `Bearer ${t}` } });
const empty = { name:'', description:'', price:'', category:'بيتزا', available:true, addons:[] };
const EMOJIS = { 'بيتزا':'🍕','مشروبات':'🥤','مقبلات':'🍟','حلويات':'🍰','دجاج':'🍗','باستا':'🍝' };

export default function AdminMenu() {
  const [items, setItems]     = useState([]);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(empty);
  const [editId, setEditId]   = useState(null);
  const [img, setImg]         = useState(null);
  const [imgPrev, setImgPrev] = useState('');
  const [addon, setAddon]     = useState({ name:'', price:'' });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const fileRef = useRef();
  const tok = localStorage.getItem('admin_token');

  const load = () => axios.get('/api/menu/all', H(tok)).then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(empty); setEditId(null); setImg(null); setImgPrev(''); setErr(''); setModal(true); };
  const openEdit = (it) => { setForm({name:it.name,description:it.description,price:it.price,category:it.category,available:it.available,addons:it.addons||[]}); setEditId(it._id); setImg(null); setImgPrev(it.image||''); setErr(''); setModal(true); };

  const addAddon = () => {
    if (!addon.name.trim()) return;
    setForm(p=>({...p,addons:[...p.addons,{name:addon.name,price:Number(addon.price)||0}]}));
    setAddon({name:'',price:''});
  };

  const save = async () => {
    if (!form.name.trim()||!form.price) { setErr('الاسم والسعر مطلوبان'); return; }
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v])=>fd.append(k, k==='addons'?JSON.stringify(v):v));
      if (img) fd.append('image',img);
      if (editId) await axios.put(`/api/menu/${editId}`,fd,H(tok));
      else        await axios.post('/api/menu',fd,H(tok));
      setModal(false); load();
    } catch { setErr('حدث خطأ'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('حذف هذا الصنف؟')) return;
    await axios.delete(`/api/menu/${id}`,H(tok)); load();
  };

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontWeight:900,fontSize:22,color:'#fff'}}>🍕 إدارة القائمة</h1>
          <p style={{color:'#555',fontSize:13,marginTop:4}}>{items.length} صنف في القائمة</p>
        </div>
        <button onClick={openAdd} className="btn-red" style={{padding:'10px 22px',borderRadius:12,fontSize:14,display:'flex',alignItems:'center',gap:6}}>
          <Plus size={16}/> إضافة صنف
        </button>
      </div>

      {/* Grid */}
      {items.length===0 ? (
        <div style={{textAlign:'center',padding:'80px 0',color:'#444'}}>
          <div style={{fontSize:56,marginBottom:12}}>🍕</div>
          <p style={{fontSize:17,fontWeight:700}}>لا يوجد أصناف بعد</p>
          <button onClick={openAdd} className="btn-red" style={{padding:'11px 28px',borderRadius:12,marginTop:16,fontSize:14}}>أضف أول صنف</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
          {items.map(it=>(
            <div key={it._id} style={{
              background:'#1c1c1c',border:`1px solid ${it.available?'#2a2a2a':'rgba(239,68,68,0.2)'}`,
              borderRadius:18,overflow:'hidden',transition:'all 0.3s',opacity:it.available?1:0.7,
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=it.available?'#3a3a3a':'rgba(239,68,68,0.4)'; e.currentTarget.style.transform='translateY(-2px)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=it.available?'#2a2a2a':'rgba(239,68,68,0.2)'; e.currentTarget.style.transform='none';}}>

              {/* Top */}
              <div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:46,height:46,borderRadius:12,background:'#252525',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,overflow:'hidden',flexShrink:0}}>
                    {it.image ? <img src={it.image} alt={it.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (EMOJIS[it.category]||'🍕')}
                  </div>
                  <div>
                    <div style={{fontWeight:900,fontSize:15,color:'#fff'}}>{it.name}</div>
                    <span className="badge-red" style={{marginTop:3,display:'inline-block'}}>{it.category}</span>
                  </div>
                </div>
                <div style={{textAlign:'left'}}>
                  <div style={{fontWeight:900,fontSize:18,color:'#ffd166'}}>₪{it.price}</div>
                  {it.addons?.length>0 && <div style={{fontSize:11,color:'#666',marginTop:2}}>🔥 {it.addons.length} مرفقات</div>}
                </div>
              </div>

              {/* Status */}
              <div style={{padding:'0 16px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:12,color:it.available?'#4ade80':'#ef4444',fontWeight:700}}>
                  {it.available ? '● متاح' : '● غير متاح'}
                </span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>openEdit(it)} style={{
                    padding:'6px 14px',borderRadius:9,background:'#252525',border:'1px solid #333',
                    color:'#ccc',fontSize:12,cursor:'pointer',fontFamily:'Cairo,sans-serif',fontWeight:700,
                    display:'flex',alignItems:'center',gap:5,transition:'all 0.2s',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#e63946';e.currentTarget.style.color='#e63946';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#333';e.currentTarget.style.color='#ccc';}}>
                    <Edit2 size={12}/> تعديل
                  </button>
                  <button onClick={()=>del(it._id)} style={{
                    padding:'6px 10px',borderRadius:9,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',
                    color:'#ef4444',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',transition:'all 0.2s',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.2)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(239,68,68,0.08)';}}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:24,width:'100%',maxWidth:520,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 0 80px rgba(0,0,0,0.7)'}}>

            <div style={{padding:'18px 22px',borderBottom:'1px solid #222',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:900,fontSize:18,color:'#fff'}}>{editId?'تعديل الصنف':'إضافة صنف جديد'}</div>
              <button onClick={()=>setModal(false)} style={{background:'#2a2a2a',border:'none',color:'#888',width:34,height:34,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <X size={16}/>
              </button>
            </div>

            <div style={{overflowY:'auto',padding:'18px 22px',flex:1,display:'flex',flexDirection:'column',gap:14}}>

              {/* Image */}
              <div>
                <label style={{fontSize:13,color:'#888',fontWeight:700,marginBottom:8,display:'block'}}>صورة الصنف</label>
                <div onClick={()=>fileRef.current.click()} style={{
                  border:'2px dashed #2a2a2a',borderRadius:14,height:120,display:'flex',
                  flexDirection:'column',alignItems:'center',justifyContent:'center',
                  cursor:'pointer',transition:'border-color 0.2s',overflow:'hidden',
                }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#e63946'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#2a2a2a'}>
                  {imgPrev
                    ? <img src={imgPrev} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <><Upload size={24} color="#444"/><span style={{color:'#444',fontSize:12,marginTop:6}}>اضغط لرفع صورة</span></>
                  }
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files[0];if(f){setImg(f);setImgPrev(URL.createObjectURL(f));} }}/>
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={{fontSize:13,color:'#888',fontWeight:700,marginBottom:6,display:'block'}}>اسم الصنف *</label>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="مثال: بيتزا مارغريتا" className="inp"/>
              </div>

              {/* Desc */}
              <div>
                <label style={{fontSize:13,color:'#888',fontWeight:700,marginBottom:6,display:'block'}}>الوصف</label>
                <input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="وصف مختصر..." className="inp"/>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:13,color:'#888',fontWeight:700,marginBottom:6,display:'block'}}>السعر (₪) *</label>
                  <input type="number" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} placeholder="25" className="inp"/>
                </div>
                <div>
                  <label style={{fontSize:13,color:'#888',fontWeight:700,marginBottom:6,display:'block'}}>التصنيف</label>
                  <input value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} placeholder="بيتزا" className="inp"/>
                </div>
              </div>

              {/* Available */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#222',borderRadius:12,padding:'12px 16px'}}>
                <div>
                  <div style={{fontWeight:700,color:'#fff',fontSize:14}}>متاح للطلب</div>
                  <div style={{fontSize:12,color:'#555',marginTop:2}}>يظهر للزبائن</div>
                </div>
                <div onClick={()=>setForm(p=>({...p,available:!p.available}))} style={{
                  width:48,height:26,borderRadius:13,cursor:'pointer',transition:'all 0.3s',position:'relative',
                  background: form.available ? '#e63946' : '#333',
                }}>
                  <div style={{
                    position:'absolute',top:3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'all 0.3s',
                    right: form.available ? 4 : undefined,
                    left: form.available ? undefined : 4,
                  }}/>
                </div>
              </div>

              {/* Addons */}
              <div>
                <label style={{fontSize:13,color:'#888',fontWeight:700,marginBottom:8,display:'block'}}>الإضافات</label>
                <div style={{display:'flex',gap:8,marginBottom:8}}>
                  <input value={addon.name} onChange={e=>setAddon(p=>({...p,name:e.target.value}))}
                    onKeyDown={e=>e.key==='Enter'&&addAddon()} placeholder="اسم الإضافة" className="inp" style={{flex:1}}/>
                  <input type="number" value={addon.price} onChange={e=>setAddon(p=>({...p,price:e.target.value}))}
                    onKeyDown={e=>e.key==='Enter'&&addAddon()} placeholder="السعر" className="inp" style={{width:90}}/>
                  <button onClick={addAddon} className="btn-red" style={{padding:'0 14px',borderRadius:10,flexShrink:0}}>
                    <Plus size={17}/>
                  </button>
                </div>
                <p style={{fontSize:11,color:'#444',marginBottom:8}}>السعر 0 = مجاني — اضغط Enter للإضافة</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {form.addons.map((a,i)=>(
                    <span key={i} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(230,57,70,0.1)',border:'1px solid rgba(230,57,70,0.25)',color:'#e63946',fontSize:12,padding:'5px 12px',borderRadius:20,fontWeight:700}}>
                      {a.name} {a.price>0?`+${a.price}₪`:'مجاني'}
                      <button onClick={()=>setForm(p=>({...p,addons:p.addons.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',color:'#e63946',cursor:'pointer',display:'flex',padding:0,marginRight:2}}>
                        <X size={12}/>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {err && <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,padding:'10px 14px',color:'#ef4444',fontSize:13,fontWeight:700}}>{err}</div>}
            </div>

            <div style={{padding:'14px 22px',borderTop:'1px solid #222'}}>
              <button onClick={save} disabled={saving} className="btn-red" style={{width:'100%',padding:'14px',borderRadius:14,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {saving ? <><div style={{width:18,height:18,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> جاري الحفظ...</> : (editId?'💾 حفظ التعديلات':'➕ إضافة الصنف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
