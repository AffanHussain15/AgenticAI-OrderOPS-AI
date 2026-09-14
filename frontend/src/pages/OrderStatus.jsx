import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrders } from '../context/OrderContext'
import StatusBadge, { RiskBadge } from '../components/StatusBadge'
import WorkflowTimeline, { buildSteps } from '../components/WorkflowTimeline'
import { Icon } from '../components/Icons'

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function OrderStatus() {
  const { orderId } = useParams()
  const { getOrder, respondToOffer, loading, error } = useOrders()
  const [responding, setResponding] = useState(false)
  const [actionError, setActionError] = useState(null)
  const order = getOrder(orderId)

  async function respond(accepted) {
    setResponding(true)
    setActionError(null)
    try {
      await respondToOffer(order.id, accepted)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setResponding(false)
    }
  }

  if (loading) {
    return (
      <div className="card empty">
        <h3>Loading order…</h3>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="card empty">
        <h3>Order not found</h3>
        <p>{error ?? "That order doesn't exist."}</p>
        <p style={{ marginTop: 18 }}>
          <Link to="/" className="btn btn-ghost btn-sm">
            Place a new order
          </Link>
        </p>
      </div>
    )
  }

  const offer = order.negotiation_offer
  const showOffer = order.status === 'awaiting_customer_response' && offer
  const savings = offer ? (offer.original_price - offer.discounted_price) * order.quantity : 0

  return (
    <div className="stack">
      <header className="status-hero">
        <div>
          <div className="order-id">Order #{order.id}</div>
          <h1>{order.item_name}</h1>
          <StatusBadge status={order.status} size="lg" />
        </div>
        <RiskBadge risk={order.risk_score} />

        <div className="detail-grid" style={{ width: '100%' }}>
          <div>
            <div className="detail-label">Customer</div>
            <div className="detail-value">{order.customer_name}</div>
          </div>
          <div>
            <div className="detail-label">Quantity</div>
            <div className="detail-value">{order.quantity}</div>
          </div>
          <div>
            <div className="detail-label">Unit price</div>
            <div className="detail-value">${order.unit_price}</div>
          </div>
          <div>
            <div className="detail-label">Placed</div>
            <div className="detail-value">{formatDate(order.created_at)}</div>
          </div>
          {typeof order.processing_ms === 'number' && (
            <div>
              <div className="detail-label">Agent time</div>
              <div className="detail-value">{order.processing_ms.toFixed(1)} ms</div>
            </div>
          )}
          {order.resolved_at && (
            <div>
              <div className="detail-label">Resolved</div>
              <div className="detail-value">{formatDate(order.resolved_at)}</div>
            </div>
          )}
          {order.original_item_name && (
            <div>
              <div className="detail-label">Originally ordered</div>
              <div className="detail-value">{order.original_item_name}</div>
            </div>
          )}
        </div>
      </header>

      {order.status === 'flagged_for_audit' && (
        <div className="note">
          <Icon.alert width={15} height={15} />
          <span>
            This order scored <strong>high risk</strong> during the fraud check and is
            held for manual audit. An admin must approve it from the dashboard before the
            pipeline resumes.
          </span>
        </div>
      )}

      {showOffer && (
        <section className="offer">
          <div className="offer-head">
            <Icon.chat width={18} height={18} />
            <h3>Your item is out of stock</h3>
          </div>
          <p className="offer-lede">
            Rather than cancel your order, the agent found the closest available
            substitute and applied a {offer.discount_percent}% discount
            {offer.channel && ` — sent by ${offer.channel}`}.
          </p>

          <div className="offer-item">
            <div>
              <div className="offer-item-name">{offer.alternative_item_name}</div>
              <div className="offer-item-sub">
                Replaces {order.item_name} · {order.quantity} unit
                {order.quantity > 1 ? 's' : ''}
                {savings > 0 && ` · you save $${savings.toFixed(2)}`}
              </div>
            </div>
            <div className="price-block">
              <span className="strike">${offer.original_price}</span>
              <span className="price-now">${offer.discounted_price}</span>
              <span className="badge ok">−{offer.discount_percent}%</span>
            </div>
          </div>

          {actionError && (
            <div className="note" style={{ marginBottom: 16 }}>
              <Icon.alert width={15} height={15} />
              <span>{actionError}</span>
            </div>
          )}

          <div className="offer-actions">
            <button className="btn" disabled={responding} onClick={() => respond(true)}>
              <Icon.check width={15} height={15} />
              {responding ? 'Submitting…' : 'Accept alternative'}
            </button>
            <button
              className="btn btn-ghost"
              disabled={responding}
              onClick={() => respond(false)}
            >
              <Icon.x width={15} height={15} />
              Decline &amp; refund me
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div className="card-title">
            <Icon.activity />
            Agent workflow
          </div>
          <span className="badge neutral">{buildSteps(order).length} steps</span>
        </div>
        <WorkflowTimeline order={order} />
      </section>

      <div>
        <Link to="/" className="btn btn-ghost btn-sm">
          Place another order
        </Link>
      </div>
    </div>
  )
}
