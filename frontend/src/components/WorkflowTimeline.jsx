import { Icon } from './Icons'

// Presentation metadata for each event the backend graph records.
const STEP_META = {
  fraud_check: {
    title: 'Fraud & Risk Check',
    icon: Icon.shield,
    detail: (r) =>
      r === 'high'
        ? 'High risk score — routed to manual audit'
        : 'Low risk score — cleared automatically',
  },
  inventory_check: {
    title: 'Inventory Validation',
    icon: Icon.box,
    detail: (r) =>
      r === 'in_stock'
        ? 'Stock confirmed — released to fulfilment'
        : 'Out of stock — escalated to negotiation',
  },
  negotiation_offer_sent: {
    title: 'Agentic Negotiation',
    icon: Icon.chat,
    detail: (r) => `Alternative offered at 15% off: ${r}`,
  },
  manual_audit_approved: {
    title: 'Manual Audit Approved',
    icon: Icon.check,
    detail: () => 'Reviewer cleared the order — pipeline resumed',
  },
  customer_response: {
    title: 'Customer Response',
    icon: Icon.user,
    detail: (r) =>
      r === 'accepted' ? 'Customer accepted the alternative' : 'Customer declined the offer',
  },
  fulfilled: {
    title: 'Order Fulfilled',
    icon: Icon.check,
    detail: () => 'Stock reserved and released to the warehouse',
  },
  fulfilled_with_alternative: {
    title: 'Fulfilled with Alternative',
    icon: Icon.check,
    detail: () => 'Revenue recovered — order saved from cancellation',
  },
  refund: {
    title: 'Refund Issued',
    icon: Icon.refund,
    detail: (r) =>
      ({
        no_alternative_available: 'No substitute in stock — order refunded',
        alternative_sold_out_before_acceptance:
          'Substitute sold out while awaiting reply — order refunded',
        stock_taken_by_concurrent_order:
          'Stock taken by a concurrent order — refunded',
      })[r] ?? 'Order refunded',
  },
}

// Steps that close out a run. When one is present the graph has finished, so no
// trailing pseudo-step is added.
const CLOSING_STEPS = new Set(['fulfilled', 'fulfilled_with_alternative', 'refund'])

// Where the graph is paused, or how it ended when it recorded no closing event.
const TERMINAL = {
  flagged_for_audit: {
    state: 'active',
    title: 'Awaiting Manual Audit',
    icon: Icon.clock,
    detail: 'Paused for a human reviewer to approve or reject',
  },
  awaiting_customer_response: {
    state: 'active',
    title: 'Awaiting Customer Reply',
    icon: Icon.clock,
    detail: 'Human-in-the-loop — the graph is paused on the customer',
  },
  refunded: {
    state: 'failed',
    title: 'Order Refunded',
    icon: Icon.x,
    detail: 'Order closed and the customer refunded',
  },
  processing: {
    state: 'active',
    title: 'Processing',
    icon: Icon.clock,
    detail: 'Running through the triage pipeline',
  },
}

function formatTime(at) {
  try {
    return new Date(at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ''
  }
}

// Exported so callers can label the section without re-deriving (and
// mis-counting) the steps.
export function buildSteps(order) {
  const history = order.history ?? []
  const steps = [
    {
      state: 'done',
      title: 'Order Received',
      icon: Icon.cart,
      detail: `${order.item_name} × ${order.quantity} for ${order.customer_name}`,
      at: order.created_at,
    },
    ...history.map((h) => {
      const meta = STEP_META[h.step]
      return {
        state: h.step === 'refund' ? 'failed' : 'done',
        title: meta?.title ?? h.step,
        icon: meta?.icon ?? Icon.dot,
        detail: meta?.detail?.(h.result) ?? h.result,
        at: h.at,
      }
    }),
  ]

  const closed = history.some((h) => CLOSING_STEPS.has(h.step))
  const terminal = TERMINAL[order.status]
  if (terminal && !closed) {
    steps.push({ ...terminal, at: order.resolved_at })
  }

  return steps
}

export default function WorkflowTimeline({ order }) {
  const steps = buildSteps(order)

  return (
    <ol className="timeline">
      {steps.map((s, i) => {
        const StepIcon = s.icon
        return (
          <li key={i} className={`tl-item ${s.state}`}>
            <span className="tl-dot">
              <StepIcon width={14} height={14} />
            </span>
            <div className="tl-body">
              <div className="tl-title">
                {s.title}
                {s.state === 'active' && (
                  <span className="badge info">
                    <span className="badge-dot" />
                    In progress
                  </span>
                )}
              </div>
              <p className="tl-meta">{s.detail}</p>
              {s.at && <div className="tl-time">{formatTime(s.at)}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
