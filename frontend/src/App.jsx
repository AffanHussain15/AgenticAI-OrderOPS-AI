import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import PlaceOrder from './pages/PlaceOrder'
import OrderStatus from './pages/OrderStatus'
import AdminDashboard from './pages/AdminDashboard'
import { OrderProvider } from './context/OrderContext'
import './App.css'

export default function App() {
  return (
    <OrderProvider>
      <BrowserRouter>
        <Navbar />
        <main className="container">
          <Routes>
            <Route path="/" element={<PlaceOrder />} />
            <Route path="/order/:orderId" element={<OrderStatus />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
      </BrowserRouter>
    </OrderProvider>
  )
}
