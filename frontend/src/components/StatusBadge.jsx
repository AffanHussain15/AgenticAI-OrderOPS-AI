import { Icon } from './Icons'

// Single source of truth for how each workflow status is presented.
const STATUS_META = {
  processing: { label: 'Processing', tone: 'info' },
  flagged_for_audit: { label: 'Flagged for Manual Audit', tone: 'warn' },
  awaiting_customer_response: { label: 'Awaiting Customer Response', tone: 'info' },
  fulfilled: { label: 'Fulfilled', tone: 'ok' },
  fulfilled_with_alternative: { label: 'Fulfilled — Alternative Accepted', tone: 'ok' },
  refunded: { label: 'Refunded', tone: 'danger' },
}

export default function StatusBadge({ status, size }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'neutral' }
  return (
    <span className={`badge ${meta.tone}${size === 'lg' ? ' badge-lg' : ''}`}>
      <span className="badge-dot" />
      {meta.label}
    </span>
  )
}

export function RiskBadge({ risk }) {
  if (!risk) return <span className="badge neutral">—</span>
  const high = risk === 'high'
  return (
    <span className={`badge ${high ? 'danger' : 'ok'}`}>
      {high ? <Icon.alert width={11} height={11} /> : <Icon.shield width={11} height={11} />}
      {high ? 'High risk' : 'Low risk'}
    </span>
  )
}
