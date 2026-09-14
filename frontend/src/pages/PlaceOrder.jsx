import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INVENTORY } from '../data/mockInventory'
import { useOrders } from '../context/OrderContext'

export default function PlaceOrder() {
  const { createOrder } = useOrders()
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState('')
  const [itemId, setItemId] = useState(INVENTORY[0].id)
  const [quantity, setQuantity] = useState(1)

  function handleSubmit(e) {
    e.preventDefault()
    const order = createOrder({ customerName, itemId, quantity: Number(quantity) })
    navigate(`/order/${order.id}`)
  }

  return (
    <div className="card">
      <h1>Place an Order</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Customer Name
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Ali Raza"
          />
        </label>

        <label>
          Item
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {INVENTORY.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — ${item.price} ({item.stock > 0 ? `${item.stock} in stock` : 'out of stock'})
              </option>
            ))}
          </select>
        </label>

        <label>
          Quantity
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <button type="submit">Submit Order</button>
      </form>
    </div>
  )
}
