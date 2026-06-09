import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminMenu from './pages/admin/AdminMenu';
import AdminOrders from './pages/admin/AdminOrders';

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/orders" />} />
            <Route path="menu" element={<AdminMenu />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>
        </Routes>
        <Toaster position="top-center" toastOptions={{ style: { background: '#111', color: '#fff', border: '1px solid #2a2a2a' } }} />
      </BrowserRouter>
    </CartProvider>
  );
}
