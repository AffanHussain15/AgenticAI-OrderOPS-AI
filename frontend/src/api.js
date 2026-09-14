// Thin client over the OrderOps AI FastAPI backend.
// Override the host with VITE_API_URL when the API is not on localhost.
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // fetch only rejects on network-level failure, so this is "API unreachable".
    throw new ApiError(
      `Cannot reach the API at ${BASE}. Is the backend running?`,
      0
    )
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const payload = await res.json()
      if (typeof payload?.detail === 'string') {
        detail = payload.detail
      } else if (Array.isArray(payload?.detail)) {
        // FastAPI validation errors arrive as a list of field problems.
        detail = payload.detail.map((d) => d.msg).join('; ')
      }
    } catch {
      /* response had no JSON body; keep the generic message */
    }
    throw new ApiError(detail, res.status)
  }

  return res.status === 204 ? null : res.json()
}

export const api = {
  health: () => request('/health'),
  listItems: () => request('/items'),
  listOrders: () => request('/orders'),
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (payload) => request('/orders', { method: 'POST', body: payload }),
  approveOrder: (id) => request(`/orders/${id}/approve`, { method: 'POST' }),
  respondToOffer: (id, accepted) =>
    request(`/orders/${id}/respond`, { method: 'POST', body: { accepted } }),
  metrics: () => request('/metrics'),
}
