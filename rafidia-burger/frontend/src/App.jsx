import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderSuccess from './pages/OrderSuccess'
import OwnerLogin from './pages/owner/Login'
import OwnerMenu from './pages/owner/MenuManager'
import OwnerOrders from './pages/owner/Orders'

function OwnerRoute({ children }) {
  const token = localStorage.getItem('owner_token')
  return token ? children : <Navigate to="/owner/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Customer */}
      <Route path="/" element={<Home />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order-success" element={<OrderSuccess />} />

      {/* Owner */}
      <Route path="/owner/login" element={<OwnerLogin />} />
      <Route path="/owner/menu" element={<OwnerRoute><OwnerMenu /></OwnerRoute>} />
      <Route path="/owner/orders" element={<OwnerRoute><OwnerOrders /></OwnerRoute>} />
      <Route path="/owner" element={<Navigate to="/owner/orders" replace />} />
    </Routes>
  )
}
