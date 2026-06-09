import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function OrderSuccess() {
  const { state } = useLocation()
  const order = state?.order

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120 }}
        style={{ textAlign: 'center', maxWidth: 480 }}
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ fontSize: 90, marginBottom: 24 }}
        >
          🎉
        </motion.div>

        <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 12, color: 'var(--green)' }}>تم استلام طلبك!</h1>

        {order && (
          <div style={{ background: 'var(--dark2)', borderRadius: 16, padding: 24, marginBottom: 28, border: '1px solid rgba(46,204,113,0.2)', textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--green)', letterSpacing: 1, marginBottom: 16 }}>تفاصيل الطلب</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 15 }}>
              <span style={{ color: 'var(--gray)' }}>رقم الطلب</span>
              <span style={{ fontWeight: 700 }}>{order.order_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 15 }}>
              <span style={{ color: 'var(--gray)' }}>الاسم</span>
              <span style={{ fontWeight: 700 }}>{order.customer_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 15 }}>
              <span style={{ color: 'var(--gray)' }}>الاستلام</span>
              <span style={{ fontWeight: 700 }}>{order.delivery_type === 'delivery' ? '🚗 توصيل' : '🏪 من المحل'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 0, fontSize: 17 }}>
              <span style={{ color: 'var(--gray)' }}>الإجمالي</span>
              <span style={{ fontWeight: 900, color: 'var(--red)', fontSize: 20 }}>₪{order.total?.toFixed(2)}</span>
            </div>
          </div>
        )}

        <p style={{ color: 'var(--gray)', lineHeight: 1.7, marginBottom: 32 }}>
          شكراً لطلبك! سيتم التواصل معك خلال دقائق للتأكيد.<br />
          وقت التحضير المتوقع: <strong style={{ color: 'var(--white)' }}>20-35 دقيقة</strong>
        </p>

        <Link to="/" className="btn-red" style={{ display: 'inline-flex' }}>🍔 طلب جديد</Link>
      </motion.div>
    </div>
  )
}
