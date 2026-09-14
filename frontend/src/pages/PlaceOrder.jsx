import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrders } from '../context/OrderContext'
import { Icon } from '../components/Icons'

const PIPELINE = [
  {
    n: '01',
    title: 'Order Intake & Fraud Check',
    body: 'Every new order is risk-scored on entry. High-risk orders are held for manual audit.',
  },
  {
    n: '02',
    title: 'Inventory Validation',
    body: 'Stock is checked against the live database. Available orders go straight to fulfilment.',
  },
  {
    n: '03',
    title: 'Agentic Negotiation',
    body: 'If an item is out of stock, the agent offers a discounted alternative instead of cancelling.',
  },
  {
    n: '04',
    title: 'Human-in-the-Loop',
    body: 'The graph pauses for the customer. Accept swaps the item; decline routes to refund.',
  },
]

export default function PlaceOrder() {
  const { createOrder, items, loading, error } = useOrders()
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [quantity, setQuantity] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // The catalog arrives asynchronously. Falling back to the first item during
  // render avoids an effect that would setState and cascade an extra render.
  const itemId = selectedId ?? items[0]?.id ?? null

  const parsedQuantity = Number.parseInt(quantity, 10)
  const quantityIsValid = Number.isInteger(parsedQuantity) && parsedQuantity > 0
  const selected = items.find((i) => i.id === itemId)
  const canSubmit = quantityIsValid && selected && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const order = await createOrder({
        customer_name: customerName,
        item_id: itemId,
        quantity: parsedQuantity,
        customer_email: email.trim() || null,
      })
      navigate(`/order/${order.id}`)
    } catch (err) {
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">
          <Icon.bolt width={12} height={12} />
          Autonomous Order Triage &amp; Resolution
        </span>
        <h1>Place an order</h1>
        <p className="page-sub">
          Orders are triaged end-to-end by the agent — risk scored, stock checked, and
          renegotiated with a discounted alternative rather than cancelled when an item
          runs out.
        </p>
      </header>

      <div className="pipeline">
        {PIPELINE.map((s) => (
          <div className="pipeline-step" key={s.n}>
            <div className="pipeline-num">{s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="note">
          <Icon.alert width={15} height={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="card-head">
          <div className="card-title">
            <Icon.cart />
            New order
          </div>
        </div>

        <div className="form">
          <label className="field narrow">
            <span>Customer name</span>
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ali Raza"
            />
          </label>

          <label className="field narrow">
            <span>Email — where a negotiation offer would be sent (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. ali@example.com"
            />
          </label>

          <div className="field">
            <span>Select an item</span>
            {loading ? (
              <p className="tl-meta">Loading catalog…</p>
            ) : (
              <div className="product-grid">
                {items.map((item) => {
                  const out = item.stock === 0
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`product${item.id === itemId ? ' selected' : ''}`}
                      aria-pressed={item.id === itemId}
                    >
                      <div className="product-name">{item.name}</div>
                      <div className="product-cat">{item.category}</div>
                      <div className="product-foot">
                        <span className="product-price">${item.price}</span>
                        <span className={`badge ${out ? 'danger' : 'ok'}`}>
                          <span className="badge-dot" />
                          {out ? 'Out of stock' : `${item.stock} left`}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="field-row">
            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <div className="field">
              <span>Order total</span>
              <input
                readOnly
                tabIndex={-1}
                value={
                  selected && quantityIsValid
                    ? `$${(selected.price * parsedQuantity).toFixed(2)}`
                    : '—'
                }
              />
            </div>
          </div>

          {!quantityIsValid && quantity !== '' && (
            <p className="field-error">Quantity must be a whole number of 1 or more.</p>
          )}

          {selected?.stock === 0 && (
            <div className="note">
              <Icon.alert width={15} height={15} />
              <span>
                <strong>{selected.name}</strong> is out of stock. Submitting will trigger
                the negotiation flow — the agent will offer a discounted alternative
                instead of cancelling the order.
              </span>
            </div>
          )}

          {submitError && (
            <div className="note">
              <Icon.alert width={15} height={15} />
              <span>{submitError}</span>
            </div>
          )}

          <div>
            <button type="submit" className="btn" disabled={!canSubmit}>
              <Icon.bolt width={15} height={15} />
              {submitting ? 'Running agent…' : 'Run agent triage'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
