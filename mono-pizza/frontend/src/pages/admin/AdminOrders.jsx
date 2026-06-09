import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Bell, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

const H = t => ({ headers: { Authorization: `Bearer ${t}` } });
const STATUS = {
  pending:   { label:'جديد',     ar:'جديد 🔴',   color:'#ef4444', bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.25)'  },
  preparing: { label:'يتحضر',   ar:'يتحضر 🟡',  color:'#f59e0b', bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.25)' },
  delivered: { label:'جاهز',    ar:'جاهز ✅',    color:'#22c55e', bg:'rgba(34,197,94,0.1)',  border:'rgba(34,197,94,0.25)'  },
  cancelled: { label:'ملغي',    ar:'ملغي ❌',    color:'#6b7280', bg:'rgba(107,114,128,0.1)',border:'rgba(107,114,128,0.2)' },
};

/* ─── mini bar chart ─── */
function BarChart({ data, valueKey='revenue', labelKey='date', color='#e63946', height=100 }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, width:'100%' }}>
      {data.map((d, i) => {
        const h = Math.max((d[valueKey] / max) * 100, d[valueKey] > 0 ? 6 : 2);
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            {d[valueKey] > 0 && (
              <span style={{ fontSize:9, color:'#ffd166', fontWeight:700, whiteSpace:'nowrap' }}>
                {d[valueKey] >= 1000 ? `${(d[valueKey]/1000).toFixed(1)}k` : d[valueKey]}
              </span>
            )}
            <div style={{
              width:'100%', height:`${h}%`, minHeight: d[valueKey]>0?6:2,
              borderRadius:'4px 4px 0 0',
              background: d[valueKey] > 0
                ? `linear-gradient(180deg, ${color}, ${color}99)`
                : '#222',
              transition:'all 0.4s',
              position:'relative',
            }}/>
            <span style={{ fontSize:9, color:'#444', textAlign:'center', whiteSpace:'nowrap' }}>{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── stat card ─── */
function StatCard({ icon, label, value, sub, color='#fff', growth }) {
  return (
    <div style={{
      background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:18,
      padding:'18px 20px', transition:'all 0.25s',
    }}
    onMouseEnter={e=>{ e.currentTarget.style.borderColor='#3a3a3a'; e.currentTarget.style.transform='translateY(-2px)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.borderColor='#2a2a2a'; e.currentTarget.style.transform='none'; }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ fontSize:28 }}>{icon}</div>
        {growth !== undefined && growth !== null && (
          <div style={{
            display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700,
            color: growth >= 0 ? '#22c55e' : '#ef4444',
            background: growth >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            padding:'3px 8px', borderRadius:20,
          }}>
            {growth >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
            {Math.abs(growth)}%
          </div>
        )}
      </div>
      <div style={{ fontWeight:900, fontSize:26, color, marginBottom:4, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:13, color:'#555', fontWeight:700 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#444', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

/* ─── donut ring ─── */
function DonutRing({ delivery, pickup }) {
  const total = delivery + pickup || 1;
  const dPct = Math.round((delivery / total) * 100);
  const pPct = 100 - dPct;
  const r = 36, circ = 2 * Math.PI * r;
  const dArc = (dPct / 100) * circ;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
      <svg width={90} height={90} viewBox="0 0 90 90" style={{ flexShrink:0 }}>
        <circle cx={45} cy={45} r={r} fill="none" stroke="#2a2a2a" strokeWidth={12}/>
        <circle cx={45} cy={45} r={r} fill="none" stroke="#4ade80" strokeWidth={12}
          strokeDasharray={`${(pPct/100)*circ} ${circ}`}
          strokeDashoffset={0} strokeLinecap="round"
          transform="rotate(-90 45 45)"/>
        <circle cx={45} cy={45} r={r} fill="none" stroke="#e63946" strokeWidth={12}
          strokeDasharray={`${dArc} ${circ}`}
          strokeDashoffset={-((pPct/100)*circ)} strokeLinecap="round"
          transform="rotate(-90 45 45)"/>
        <text x={45} y={49} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={900} fontFamily="Cairo">{dPct}%</text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#e63946', flexShrink:0 }}/>
          <span style={{ color:'#aaa', fontSize:13 }}>🚗 توصيل</span>
          <span style={{ fontWeight:900, color:'#fff', marginRight:'auto', marginLeft:12 }}>{delivery}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#4ade80', flexShrink:0 }}/>
          <span style={{ color:'#aaa', fontSize:13 }}>🏪 استلام</span>
          <span style={{ fontWeight:900, color:'#fff', marginRight:'auto', marginLeft:12 }}>{pickup}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders]   = useState([]);
  const [ana, setAna]         = useState(null);
  const [tab, setTab]         = useState('orders');
  const [filter, setFilter]   = useState('الكل');
  const [notif, setNotif]     = useState(null);
  const [newBadge, setNewBadge] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState('week'); // week | month | today
  const tok = localStorage.getItem('admin_token');
  const sockRef = useRef();

  const load = async () => {
    setLoading(true);
    const [o, a] = await Promise.all([
      axios.get('/api/orders', H(tok)),
      axios.get('/api/orders/analytics', H(tok)),
    ]);
    setOrders(o.data); setAna(a.data); setLoading(false);
  };

  useEffect(() => {
    load();
    sockRef.current = io('http://localhost:5000');
    sockRef.current.on('new_order', ord => {
      setOrders(p => [ord, ...p]);
      setNewBadge(c => c + 1);
      setNotif(ord);
      setTimeout(() => setNotif(null), 6000);
    });
    return () => sockRef.current?.disconnect();
  }, []);

  const updateStatus = async (id, status) => {
    await axios.put(`/api/orders/${id}/status`, { status }, H(tok));
    setOrders(p => p.map(o => o._id === id ? { ...o, status } : o));
  };

  const statusKeys = ['الكل', ...Object.keys(STATUS)];
  const counts = { الكل: orders.length, ...Object.fromEntries(Object.keys(STATUS).map(k => [k, orders.filter(o => o.status === k).length])) };
  const shown = filter === 'الكل' ? orders : orders.filter(o => o.status === filter);

  const chartData = chartPeriod === 'today'
    ? (ana?.hourlyRevenue || []).filter(d => d.hour >= 8).map(d => ({ ...d, date: `${d.hour}:00` }))
    : chartPeriod === 'week' ? (ana?.dailyRevenue || [])
    : (ana?.monthlyDaily || []);

  return (
    <div>

      {/* Toast */}
      {notif && (
        <div style={{
          position:'fixed', top:70, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background:'#1c1c1c', border:'1px solid #e63946', borderRadius:16,
          padding:'14px 20px', display:'flex', alignItems:'center', gap:14,
          boxShadow:'0 8px 40px rgba(230,57,70,0.3)', animation:'fadeUp 0.3s ease',
          minWidth:280, maxWidth:'90vw',
        }}>
          <div className="pr" style={{ width:42, height:42, borderRadius:12, background:'linear-gradient(135deg,#e63946,#ff6b35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🔔</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900, color:'#fff', fontSize:14 }}>طلب جديد! 🎉</div>
            <div style={{ color:'#888', fontSize:12, marginTop:2 }}>{notif.customerName} • ₪{notif.total}</div>
          </div>
          <button onClick={() => setNotif(null)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontWeight:900, fontSize:22, color:'#fff' }}>
            {tab === 'orders' ? '📋 الطلبات' : '📊 التحليلات'}
          </h1>
          <p style={{ color:'#555', fontSize:13, marginTop:4 }}>
            {tab === 'orders' ? `${orders.length} طلب إجمالي` : 'إحصائيات شاملة للمطعم'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} style={{ width:38, height:38, borderRadius:10, background:'#1c1c1c', border:'1px solid #2a2a2a', color:'#888', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <RefreshCw size={16}/>
          </button>
          <button onClick={() => { setTab('orders'); setNewBadge(0); }} style={{
            position:'relative', width:38, height:38, borderRadius:10,
            background: newBadge > 0 ? 'rgba(230,57,70,0.1)' : '#1c1c1c',
            border:`1px solid ${newBadge > 0 ? 'rgba(230,57,70,0.3)' : '#2a2a2a'}`,
            color: newBadge > 0 ? '#e63946' : '#888', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Bell size={16}/>
            {newBadge > 0 && <div className="pr" style={{ position:'absolute', top:-4, right:-4, width:18, height:18, borderRadius:'50%', background:'#e63946', color:'#fff', fontSize:10, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>{newBadge}</div>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {[{id:'orders',label:'📋 الطلبات'},{id:'analytics',label:'📊 التحليلات'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'9px 22px', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer',
            fontFamily:'Cairo,sans-serif', transition:'all 0.2s',
            background: tab === t.id ? '#e63946' : '#1c1c1c',
            border:`1.5px solid ${tab === t.id ? '#e63946' : '#2a2a2a'}`,
            color: tab === t.id ? '#fff' : '#888',
            boxShadow: tab === t.id ? '0 4px 16px rgba(230,57,70,0.3)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════ ORDERS TAB ══════════ */}
      {tab === 'orders' && (
        <>
          {/* Filters */}
          <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
            {statusKeys.map(k => {
              const s = STATUS[k];
              const active = filter === k;
              return (
                <button key={k} onClick={() => setFilter(k)} style={{
                  padding:'7px 16px', borderRadius:100, fontWeight:700, fontSize:13, cursor:'pointer',
                  fontFamily:'Cairo,sans-serif', transition:'all 0.2s',
                  background: active ? (s ? s.bg : 'rgba(255,255,255,0.1)') : '#1c1c1c',
                  border:`1.5px solid ${active ? (s ? s.border : 'rgba(255,255,255,0.2)') : '#2a2a2a'}`,
                  color: active ? (s ? s.color : '#fff') : '#666',
                }}>
                  {k === 'الكل' ? 'الكل' : STATUS[k].ar} ({counts[k]})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#444' }}>
              <div style={{ width:40, height:40, border:'3px solid #2a2a2a', borderTopColor:'#e63946', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
              <p>جاري التحميل...</p>
            </div>
          ) : shown.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#444' }}>
              <div style={{ fontSize:56, marginBottom:12 }}>📭</div>
              <p style={{ fontSize:16, fontWeight:700 }}>لا يوجد طلبات</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {shown.map(order => {
                const s = STATUS[order.status] || STATUS.pending;
                return (
                  <div key={order._id} style={{ background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:18, overflow:'hidden', transition:'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#3a3a3a'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#2a2a2a'}>

                    <div style={{ padding:'14px 16px', display:'flex', flexWrap:'wrap', alignItems:'flex-start', justifyContent:'space-between', gap:10, borderBottom:'1px solid #1e1e1e' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                          <span style={{ fontWeight:900, fontSize:17, color:'#ffd166' }}>#{order.orderNumber}</span>
                          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.ar}</span>
                          <span style={{ padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.05)', color:'#888', border:'1px solid #333' }}>
                            {order.deliveryType === 'delivery' ? '🚗 توصيل' : '🏪 استلام'}
                          </span>
                        </div>
                        <div style={{ fontWeight:900, fontSize:15, color:'#fff' }}>{order.customerName}</div>
                        <div style={{ fontSize:12, color:'#555', marginTop:2 }} dir="ltr">{order.customerPhone}</div>
                        {order.customerAddress && <div style={{ fontSize:12, color:'#444', marginTop:2 }}>📍 {order.customerAddress}</div>}
                      </div>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontWeight:900, fontSize:22, color:'#ffd166' }}>₪{order.total}</div>
                        {order.deliveryFee > 0 && <div style={{ fontSize:11, color:'#555' }}>شامل ₪{order.deliveryFee} توصيل</div>}
                        <div style={{ fontSize:11, color:'#333', marginTop:4 }}>
                          {new Date(order.createdAt).toLocaleString('ar-EG', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding:'10px 16px', borderBottom:'1px solid #1a1a1a', display:'flex', flexWrap:'wrap', gap:6 }}>
                      {order.items.map((it, i) => (
                        <span key={i} style={{ fontSize:12, color:'#888', background:'#252525', borderRadius:8, padding:'4px 10px' }}>
                          {it.name} ×{it.quantity}
                          {it.selectedAddons?.length > 0 && <span style={{ color:'#e63946' }}> +{it.selectedAddons.map(a => a.name).join('،')}</span>}
                        </span>
                      ))}
                      {order.notes && <span style={{ fontSize:12, color:'#666', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:8, padding:'4px 10px' }}>📝 {order.notes}</span>}
                    </div>

                    <div style={{ padding:'10px 16px', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'#444', fontWeight:700 }}>تحديث:</span>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <button key={k} onClick={() => updateStatus(order._id, k)} style={{
                          padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                          fontFamily:'Cairo,sans-serif', transition:'all 0.2s',
                          background: order.status === k ? v.bg : 'transparent',
                          border:`1.5px solid ${order.status === k ? v.border : '#2a2a2a'}`,
                          color: order.status === k ? v.color : '#555',
                        }}>
                          {v.ar}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════ ANALYTICS TAB ══════════ */}
      {tab === 'analytics' && (
        ana ? (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* ─ Row 1: Today stats ─ */}
            <div>
              <div style={{ fontSize:12, color:'#555', fontWeight:700, letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>اليوم</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
                <StatCard icon="💰" label="إيرادات اليوم"   value={`₪${ana.todayRevenue}`}  color="#ffd166" />
                <StatCard icon="📦" label="طلبات اليوم"     value={ana.todayOrders}           color="#fff"    />
                <StatCard icon="🔴" label="طلبات معلقة"     value={ana.pendingOrders}         color="#ef4444" />
                <StatCard icon="❌" label="ملغية"            value={ana.cancelledOrders}       color="#6b7280" />
              </div>
            </div>

            {/* ─ Row 2: Period stats ─ */}
            <div>
              <div style={{ fontSize:12, color:'#555', fontWeight:700, letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>الفترات</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
                <StatCard icon="📅" label="إيرادات الأسبوع"   value={`₪${ana.weekRevenue}`}    color="#e63946" sub={`${ana.weekOrdersCount} طلب`} />
                <StatCard icon="🗓️" label="إيرادات الشهر"    value={`₪${ana.monthRevenue}`}   color="#22c55e" sub={`${ana.monthOrders} طلب`} growth={ana.growth} />
                <StatCard icon="📊" label="إجمالي الإيرادات" value={`₪${ana.totalRevenue}`}   color="#ffd166" sub={`${ana.totalOrders} طلب كلي`} />
                <StatCard icon="🧮" label="متوسط الطلب"       value={`₪${ana.avgOrderValue}`}  color="#a78bfa" />
              </div>
            </div>

            {/* ─ Chart ─ */}
            <div style={{ background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:20, padding:22 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:16, color:'#fff' }}>📈 الإيرادات</div>
                  <div style={{ fontSize:12, color:'#555', marginTop:2 }}>
                    {chartPeriod === 'today' ? 'توزيع ساعات اليوم' : chartPeriod === 'week' ? 'آخر 7 أيام' : 'آخر 30 يوم'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {[{id:'today',label:'اليوم'},{id:'week',label:'أسبوع'},{id:'month',label:'شهر'}].map(p => (
                    <button key={p.id} onClick={() => setChartPeriod(p.id)} style={{
                      padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                      fontFamily:'Cairo,sans-serif', transition:'all 0.2s',
                      background: chartPeriod === p.id ? 'rgba(230,57,70,0.15)' : '#252525',
                      border:`1.5px solid ${chartPeriod === p.id ? '#e63946' : '#333'}`,
                      color: chartPeriod === p.id ? '#e63946' : '#666',
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>
              <BarChart data={chartData} valueKey="revenue" labelKey="date" color="#e63946" height={130} />
            </div>

            {/* ─ Row 3: Top items + Delivery split ─ */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              {/* Top Items */}
              <div style={{ background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:20, padding:20 }}>
                <div style={{ fontWeight:900, fontSize:16, color:'#fff', marginBottom:16 }}>🏆 الأكثر مبيعاً</div>
                {ana.topItems.length === 0 ? (
                  <div style={{ color:'#444', fontSize:13, textAlign:'center', padding:'30px 0' }}>لا يوجد بيانات بعد</div>
                ) : ana.topItems.map((it, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{
                      width:26, height:26, borderRadius:8, flexShrink:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:900, fontSize:12,
                      background: i === 0 ? 'linear-gradient(135deg,#ffd166,#ff6b35)' : i === 1 ? '#333' : i === 2 ? '#2a2a2a' : '#222',
                      color: i < 2 ? '#111' : '#555',
                    }}>{i + 1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontWeight:700, color:'#fff', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.name}</span>
                        <span style={{ fontSize:12, color:'#555', whiteSpace:'nowrap', marginRight:8 }}>
                          {it.count}× &nbsp;<span style={{ color:'#ffd166' }}>₪{it.revenue}</span>
                        </span>
                      </div>
                      <div style={{ height:5, background:'#252525', borderRadius:3, overflow:'hidden' }}>
                        <div style={{
                          height:'100%', borderRadius:3,
                          background: i === 0 ? 'linear-gradient(90deg,#ffd166,#ff6b35)' : 'linear-gradient(90deg,#e63946,#ff6b35)',
                          width:`${(it.count / ana.topItems[0].count) * 100}%`,
                          transition:'width 0.7s',
                        }}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right column: delivery split + status */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* Delivery vs pickup */}
                <div style={{ background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:20, padding:20, flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:16, color:'#fff', marginBottom:16 }}>🚗 طريقة الاستلام</div>
                  <DonutRing delivery={ana.deliveryCount} pickup={ana.pickupCount} />
                </div>

                {/* Status breakdown */}
                <div style={{ background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:20, padding:20, flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:16, color:'#fff', marginBottom:14 }}>📊 حالات الطلبات</div>
                  {Object.entries(STATUS).map(([k, v]) => {
                    const sb = ana.statusBreakdown || {};
                    const count = sb[k] || 0;
                    const total = Math.max(Object.values(sb).reduce((s,c)=>s+c,0), 1);
                    return (
                      <div key={k} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:v.color, flexShrink:0 }}/>
                        <span style={{ color:'#aaa', fontSize:13, flex:1 }}>{v.label}</span>
                        <div style={{ flex:2, height:5, background:'#252525', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:3, background:v.color, width:`${(count/total)*100}%`, transition:'width 0.7s' }}/>
                        </div>
                        <span style={{ fontWeight:900, color:'#fff', fontSize:13, minWidth:20, textAlign:'center' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ─ Month comparison ─ */}
            {ana.growth !== null && (
              <div style={{ background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:20, padding:22 }}>
                <div style={{ fontWeight:900, fontSize:16, color:'#fff', marginBottom:16 }}>📆 مقارنة الأشهر</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  {[
                    { label:'الشهر الحالي', value:`₪${ana.monthRevenue}`, orders:ana.monthOrders, color:'#e63946' },
                    { label:'الشهر الماضي', value:`₪${ana.lastMonthRevenue}`, orders:null, color:'#555' },
                  ].map((m, i) => (
                    <div key={i} style={{ background:'#252525', borderRadius:14, padding:'16px 18px' }}>
                      <div style={{ fontSize:12, color:'#555', fontWeight:700, marginBottom:8 }}>{m.label}</div>
                      <div style={{ fontWeight:900, fontSize:24, color:m.color }}>{m.value}</div>
                      {m.orders !== null && <div style={{ fontSize:12, color:'#555', marginTop:4 }}>{m.orders} طلب</div>}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:14, padding:'12px 16px', borderRadius:12, background: ana.growth >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${ana.growth >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, display:'flex', alignItems:'center', gap:8 }}>
                  {ana.growth >= 0 ? <TrendingUp size={18} color="#22c55e"/> : <TrendingDown size={18} color="#ef4444"/>}
                  <span style={{ fontWeight:700, fontSize:14, color: ana.growth >= 0 ? '#22c55e' : '#ef4444' }}>
                    {ana.growth >= 0 ? `نمو ${ana.growth}%` : `انخفاض ${Math.abs(ana.growth)}%`} مقارنة بالشهر الماضي
                  </span>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div style={{ textAlign:'center', padding:60, color:'#444' }}>
            <div style={{ width:40, height:40, border:'3px solid #2a2a2a', borderTopColor:'#e63946', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
            <p>جاري تحميل التحليلات...</p>
          </div>
        )
      )}
    </div>
  );
}
