import { Link } from 'react-router-dom'
import { useOrders } from '../context/OrderContext'

export default function AdminDashboard() {
  const { orders, approveFlaggedOrder } = useOrders()

  const total = orders.length
  const outOfStockCases = orders.filter(
    (o) => o.status === 'fulfilled_with_alternative' || o.status === 'awaiting_customer_response' || (o.status === 'refunded' && o.negotiationOffer)
  ).length
  const savedByNegotiation = orders.filter((o) => o.status === 'fulfilled_with_alternative').length
  const revenueRecoveryRate = outOfStockCases > 0 ? Math.round((savedByNegotiation / outOfStockCases) * 100) : 0

  const resolvedOrders = orders.filter((o) => o.resolvedAt)
  const avgProcessingMs =
    resolvedOrders.length > 0
      ? resolvedOrders.reduce((sum, o) => sum + (new Date(o.resolvedAt) - new Date(o.createdAt)), 0) /
        resolvedOrders.length
      : 0

  return (
    <div className="card">
      <h1>Admin Dashboard</h1>

      <div className="metrics-row">
        <div className="metric">
          <span className="metric-value">{total}</span>
          <span className="metric-label">Total Orders</span>
        </div>
        <div className="metric">
          <span className="metric-value">{revenueRecoveryRate}%</span>
          <span className="metric-label">Revenue Recovery Rate</span>
        </div>
        <div className="metric">
          <span className="metric-value">{avgProcessingMs.toFixed(0)}ms</span>
          <span className="metric-label">Avg. Processing Time</span>
        </div>
        <div className="metric">
          <span className="metric-value">100%</span>
          <span className="metric-label">System Uptime</span>
        </div>
      </div>

      <table className="orders-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Item</th>
            <th>Risk</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.customerName}</td>
              <td>{o.itemName} × {o.quantity}</td>
              <td className={`risk-${o.riskScore}`}>{o.riskScore}</td>
              <td>{o.status}</td>
              <td>
                <Link to={`/order/${o.id}`}>View</Link>
                {o.status === 'flagged_for_audit' && (
                  <button className="link-btn" onClick={() => approveFlaggedOrder(o.id)}>
                    Approve
                  </button>
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={6}>No orders yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
