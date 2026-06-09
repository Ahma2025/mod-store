import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const token = () => localStorage.getItem('owner_token')

const STATUS_MAP = {
  new:       { label: 'جديد 🔴',    color: '#E63946', bg: 'rgba(230,57,70,0.12)' },
  preparing: { label: 'يُحضَّر 🟡', color: '#F39C12', bg: 'rgba(243,156,18,0.12)' },
  ready:     { label: 'جاهز ✅',     color: '#2ECC71', bg: 'rgba(46,204,113,0.12)' },
  delivered: { label: 'تم التسليم', color: '#888',    bg: 'rgba(136,136,136,0.1)' },
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 28, color: color || 'var(--white)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ color: 'var(--gray)', fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

export default function OwnerOrders() {
  const [orders, setOrders] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [newCount, setNewCount] = useState(0)
  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'analytics'
  const navigate = useNavigate()
  const audioRef = useRef(null)

  const fetchOrders = async () => {
    try {
      const [ordRes, anaRes] = await Promise.all([
        fetch('/api/owner/orders', { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/owner/analytics', { headers: { Authorization: `Bearer ${token()}` } }),
      ])
      const [ordData, anaData] = await Promise.all([ordRes.json(), anaRes.json()])
      setOrders(ordData.data || [])
      setAnalytics(anaData.data)
      setNewCount(ordData.data?.filter(o => o.status === 'new').length || 0)
      setLoading(false)
    } catch { setLoading(false) }
  }

  useEffect(() => {
    fetchOrders()

    // SSE for real-time
    const es = new EventSource('/api/events?token=' + token(), {})
    // Actually SSE needs auth differently - use polling as fallback
    const interval = setInterval(fetchOrders, 15000) // poll every 15s

    // Try SSE
    const sse = new EventSource('/api/events')
    sse.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'new_order') {
        toast('🍔 طلب جديد وصل!', { icon: '🔔', duration: 6000 })
        fetchOrders()
      }
    }
    sse.onerror = () => sse.close()

    return () => { clearInterval(interval); sse.close() }
  }, [])

  const updateStatus = async (id, status) => {
    await fetch(`/api/owner/orders/${id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchOrders()
    toast.success('تم تحديث حالة الطلب')
  }

  const logout = () => { localStorage.removeItem('owner_token'); navigate('/owner/login') }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const chartData = analytics?.weekly_chart
    ? Object.entries(analytics.weekly_chart).map(([day, revenue]) => ({ day, revenue }))
    : []

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--dark)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>🍔 لوحة التحكم</div>
          <Link to="/owner/orders" style={{ color: 'var(--red)', textDecoration: 'none', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            الطلبات
            {newCount > 0 && (
              <motion.span
                key={newCount}
                initial={{ scale: 1.5 }} animate={{ scale: 1 }}
                className="badge"
              >{newCount}</motion.span>
            )}
          </Link>
          <Link to="/owner/menu" style={{ color: 'var(--gray)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>القائمة</Link>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {newCount > 0 && (
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700 }}
            >
              🔔 {newCount} طلب جديد!
            </motion.div>
          )}
          <Link to="/" target="_blank" style={{ color: 'var(--gray)', fontSize: 13, textDecoration: 'none', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>👁️ الموقع</Link>
          <button onClick={logout} style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.2)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>خروج</button>
        </div>
      </nav>

      <div className="container" style={{ padding: '28px 20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--dark2)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
          {[{ id: 'orders', label: '📦 الطلبات' }, { id: 'analytics', label: '📊 التحليلات' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: activeTab === tab.id ? 'linear-gradient(135deg, var(--red-dark), var(--red))' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--gray)',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ORDERS TAB ─────────────────────────────── */}
        {activeTab === 'orders' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'new', label: 'جديد 🔴' },
                { id: 'preparing', label: 'يُحضَّر 🟡' },
                { id: 'ready', label: 'جاهز ✅' },
                { id: 'delivered', label: 'تم التسليم' },
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{
                    padding: '8px 18px', borderRadius: 20, border: filter === f.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    background: filter === f.id ? 'linear-gradient(135deg, var(--red-dark), var(--red))' : 'var(--dark2)',
                    color: filter === f.id ? 'white' : 'var(--gray-light)',
                    fontFamily: 'Cairo, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}>
                  {f.label} {f.id !== 'all' ? `(${orders.filter(o => o.status === f.id).length})` : `(${orders.length})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 18 }}>لا يوجد طلبات</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <AnimatePresence>
                  {filtered.map(order => {
                    const st = STATUS_MAP[order.status] || STATUS_MAP.new
                    return (
                      <motion.div
                        key={order._id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="card"
                        style={{ padding: '20px 24px', borderRight: order.status === 'new' ? '4px solid var(--red)' : '4px solid transparent' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                          {/* Order info */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 900, fontSize: 16 }}>{order.order_number}</span>
                              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                              <span style={{ fontSize: 12, color: 'var(--gray)' }}>{new Date(order.created_at).toLocaleString('ar')}</span>
                            </div>

                            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
                              <div><span style={{ color: 'var(--gray)', fontSize: 12 }}>الزبون: </span><span style={{ fontWeight: 700 }}>{order.customer_name}</span></div>
                              <div><span style={{ color: 'var(--gray)', fontSize: 12 }}>الهاتف: </span><span style={{ fontWeight: 700 }}>{order.customer_phone}</span></div>
                              <div><span style={{ color: 'var(--gray)', fontSize: 12 }}>الاستلام: </span><span style={{ fontWeight: 700 }}>{order.delivery_type === 'delivery' ? '🚗 توصيل' : '🏪 من المحل'}</span></div>
                            </div>

                            {order.customer_address && (
                              <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 10 }}>📍 {order.customer_address}</div>
                            )}

                            {/* Items */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {order.items?.map((item, i) => (
                                <div key={i} style={{ background: 'var(--dark3)', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                                  {item.emoji} {item.name_ar} × {item.quantity}
                                  {item.selectedAddons?.length > 0 && (
                                    <span style={{ color: 'var(--gray)', fontSize: 11 }}> (+{item.selectedAddons.map(a => a.name_ar).join(', ')})</span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {order.notes && (
                              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--orange)' }}>💬 {order.notes}</div>
                            )}
                          </div>

                          {/* Total + Status controls */}
                          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                            <div style={{ fontWeight: 900, fontSize: 24, color: 'var(--red)' }}>₪{order.total?.toFixed(2)}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray)' }}>
                              فرعي ₪{order.subtotal?.toFixed(2)} + توصيل ₪{order.delivery_fee || 0}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {Object.entries(STATUS_MAP).map(([key, val]) => (
                                <button key={key} onClick={() => updateStatus(order._id, key)}
                                  style={{
                                    padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'Cairo, sans-serif',
                                    border: order.status === key ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                    background: order.status === key ? val.bg : 'var(--dark3)',
                                    color: order.status === key ? val.color : 'var(--gray)',
                                    fontWeight: order.status === key ? 700 : 400,
                                  }}>
                                  {val.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* ── ANALYTICS TAB ──────────────────────────── */}
        {activeTab === 'analytics' && analytics && (
          <div>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              <StatCard icon="📦" label="إجمالي الطلبات" value={analytics.total_orders} />
              <StatCard icon="📅" label="طلبات هذا الأسبوع" value={analytics.week_orders} />
              <StatCard icon="💰" label="إيرادات الأسبوع" value={`₪${analytics.week_revenue?.toFixed(0)}`} color="var(--green)" />
              <StatCard icon="💵" label="إيرادات الشهر" value={`₪${analytics.month_revenue?.toFixed(0)}`} color="var(--red)" />
              <StatCard icon="🚗" label="طلبات توصيل" value={analytics.delivery_count} sub={`${analytics.pickup_count} استلام`} />
              <StatCard icon="🔴" label="طلبات جديدة" value={analytics.new_orders} color={analytics.new_orders > 0 ? 'var(--red)' : 'var(--white)'} />
            </div>

            {/* Weekly chart */}
            {chartData.length > 0 && (
              <div className="card" style={{ padding: 28, marginBottom: 28 }}>
                <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 24 }}>📈 الإيرادات اليومية (آخر 7 أيام)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" stroke="var(--gray)" tick={{ fontFamily: 'Cairo', fontSize: 12 }} />
                    <YAxis stroke="var(--gray)" tick={{ fontFamily: 'Cairo', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--dark2)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: 10, fontFamily: 'Cairo' }}
                      formatter={(v) => [`₪${v}`, 'الإيرادات']}
                    />
                    <Bar dataKey="revenue" fill="url(#redGrad)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E63946" />
                        <stop offset="100%" stopColor="#B02030" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top items */}
            {analytics.top_items?.length > 0 && (
              <div className="card" style={{ padding: 28 }}>
                <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>🏆 الأكثر مبيعاً</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {analytics.top_items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg, #F39C12, #E67E22)' : i === 1 ? 'linear-gradient(135deg, #BDC3C7, #95A5A6)' : 'linear-gradient(135deg, #CD7F32, #A0522D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name_ar}</div>
                        <div style={{ height: 6, background: 'var(--dark3)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(item.count / analytics.top_items[0].count) * 100}%`, background: 'linear-gradient(90deg, var(--red-dark), var(--red))', borderRadius: 3, transition: 'width 1s ease' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 900, color: 'var(--red)' }}>{item.count} مبيعة</div>
                        <div style={{ fontSize: 12, color: 'var(--green)' }}>₪{item.revenue?.toFixed(0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
