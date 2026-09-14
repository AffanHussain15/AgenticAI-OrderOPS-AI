import { useParams, Link } from 'react-router-dom'
import { useOrders } from '../context/OrderContext'

const STATUS_LABELS = {
  processing: 'Processing',
  flagged_for_audit: 'Flagged for Manual Audit (High Risk)',
  fulfilled: 'Fulfilled',
  fulfilled_with_alternative: 'Fulfilled (Alternative Item Accepted)',
  awaiting_customer_response: 'Waiting for Your Response',
  refunded: 'Refunded',
}

export default function OrderStatus() {
  const { orderId } = useParams()
  const { getOrder, respondToOffer } = useOrders()
  const order = getOrder(orderId)

  if (!order) {
    return (
      <div className="card">
        <p>Order not found.</p>
        <Link to="/">Place a new order</Link>
      </div>
    )
  }

  return (
    <div className="card">
      <h1>Order {order.id}</h1>
      <p className={`status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</p>

      <div className="order-details">
        <p><strong>Customer:</strong> {order.customerName}</p>
        <p><strong>Item:</strong> {order.itemName} × {order.quantity}</p>
        <p><strong>Risk Score:</strong> {order.riskScore}</p>
        <p><strong>Placed At:</strong> {new Date(order.createdAt).toLocaleString()}</p>
        {order.resolvedAt && (
          <p><strong>Resolved At:</strong> {new Date(order.resolvedAt).toLocaleString()}</p>
        )}
      </div>

      {order.status === 'flagged_for_audit' && (
        <p className="note">
          This order was flagged for manual review due to a high fraud risk score.
          An admin needs to approve it before it can proceed.
        </p>
      )}

      {order.status === 'awaiting_customer_response' && order.negotiationOffer && (
        <div className="offer-box">
          <h3>Your item is out of stock</h3>
          <p>
            We'd like to offer you <strong>{order.negotiationOffer.itemName}</strong> instead, at{' '}
            <strong>{order.negotiationOffer.discountPercent}% off</strong>:{' '}
            <span className="strike">${order.negotiationOffer.originalPrice}</span>{' '}
            <strong>${order.negotiationOffer.discountedPrice}</strong>
          </p>
          <div className="offer-actions">
            <button onClick={() => respondToOffer(order.id, true)}>Accept Alternative</button>
            <button className="secondary" onClick={() => respondToOffer(order.id, false)}>
              Decline & Refund Me
            </button>
          </div>
        </div>
      )}

      <h3>Workflow History</h3>
      <ul className="history-list">
        {order.history.map((h, i) => (
          <li key={i}>
            <code>{h.step}</code> → {h.result}
          </li>
        ))}
      </ul>

      <Link to="/">Place another order</Link>
    </div>
  )
}
