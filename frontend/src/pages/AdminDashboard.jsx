import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrders } from '../context/OrderContext'
import StatusBadge, { RiskBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icons'

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

export default function AdminDashboard() {
  const { orders, metrics, approveFlaggedOrder, loading, error } = useOrders()
  const [approving, setApproving] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function approve(orderId) {
    setApproving(orderId)
    setActionError(null)
    try {
      await approveFlaggedOrder(orderId)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setApproving(null)
    }
  }

  // Every figure below is computed by the backend's /metrics endpoint.
  const flagged = metrics?.orders_by_status?.flagged_for_audit ?? 0

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">
          <Icon.trend width={12} height={12} />
          Success Metrics
        </span>
        <h1>Admin dashboard</h1>
        <p className="page-sub">
          Live view of every order the agent has triaged, plus the metrics the system is
          measured on.
        </p>
      </header>

      {(error || actionError) && (
        <div className="note">
          <Icon.alert width={15} height={15} />
          <span>{error ?? actionError}</span>
        </div>
      )}

      <div className="metrics-row">
        <div className="metric">
          <div className="metric-top">
            <Icon.cart width={14} height={14} />
            <span className="metric-label">Total Orders</span>
          </div>
          <span className="metric-value">{metrics?.total_orders ?? '—'}</span>
          <div className="metric-foot">
            {flagged > 0 ? `${flagged} awaiting audit` : 'No orders held'}
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <Icon.trend width={14} height={14} />
            <span className="metric-label">Revenue Recovery Rate</span>
          </div>
          <span className="metric-value">
            {metrics ? `${metrics.revenue_recovery_rate}%` : '—'}
          </span>
          <div className="metric-foot">
            {metrics
              ? `${metrics.saved_by_negotiation}/${metrics.settled_out_of_stock_cases} settled cases saved` +
                (metrics.pending_negotiations > 0
                  ? ` · ${metrics.pending_negotiations} pending`
                  : '')
              : 'Loading…'}
          </div>
          <div className="metric-bar">
            <span style={{ width: `${metrics?.revenue_recovery_rate ?? 0}%` }} />
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <Icon.clock width={14} height={14} />
            <span className="metric-label">Avg. Processing Time</span>
          </div>
          <span className="metric-value">
            {metrics ? `${metrics.avg_processing_ms}ms` : '—'}
          </span>
          <div className="metric-foot">Intake → fulfilment or offer sent</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <Icon.activity width={14} height={14} />
            <span className="metric-label">System Uptime</span>
          </div>
          <span className="metric-value">{formatUptime(metrics?.uptime_seconds)}</span>
          <div className="metric-foot">
            {metrics?.db_healthy ? 'API up · database reachable' : 'Database unreachable'}
          </div>
        </div>
      </div>

      <div className="table-wrap">
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
                <td className="cell-id">#{o.id}</td>
                <td>{o.customer_name}</td>
                <td>
                  {o.item_name}{' '}
                  <span style={{ color: 'var(--text-dim)' }}>× {o.quantity}</span>
                </td>
                <td>
                  <RiskBadge risk={o.risk_score} />
                </td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td className="cell-actions">
                  <Link to={`/order/${o.id}`}>View</Link>
                  {o.status === 'flagged_for_audit' && (
                    <button
                      className="link-btn"
                      disabled={approving === o.id}
                      onClick={() => approve(o.id)}
                    >
                      {approving === o.id ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty">
                    <h3>{loading ? 'Loading orders…' : 'No orders yet'}</h3>
                    {!loading && <p>Place an order to watch the agent triage it end-to-end.</p>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
