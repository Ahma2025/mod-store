import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { CartProvider } from './context/CartContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1C1C1C',
              color: '#FAFAFA',
              border: '1px solid rgba(230,57,70,0.4)',
              fontFamily: 'Cairo, sans-serif',
              direction: 'rtl',
            },
            success: { iconTheme: { primary: '#2ECC71', secondary: '#fff' } },
            error: { iconTheme: { primary: '#E63946', secondary: '#fff' } },
          }}
        />
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
