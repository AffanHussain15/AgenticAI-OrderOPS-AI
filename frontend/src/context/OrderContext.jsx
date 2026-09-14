import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api'

const OrderContext = createContext(null)

// The workflow itself now lives in the backend's LangGraph pipeline. This
// context is only a cache of server state plus the actions that advance it.
export function OrderProvider({ children }) {
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextOrders, nextMetrics] = await Promise.all([
        api.listItems(),
        api.listOrders(),
        api.metrics(),
      ])
      setItems(nextItems)
      setOrders(nextOrders)
      setMetrics(nextMetrics)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Each action returns the order the API produced, then re-syncs everything
  // else it touched — stock levels and the metric tiles both move on a write.
  async function createOrder(payload) {
    const order = await api.createOrder(payload)
    await refresh()
    return order
  }

  async function respondToOffer(orderId, accepted) {
    const order = await api.respondToOffer(orderId, accepted)
    await refresh()
    return order
  }

  async function approveFlaggedOrder(orderId) {
    const order = await api.approveOrder(orderId)
    await refresh()
    return order
  }

  // Route params are strings; order ids are integers.
  function getOrder(orderId) {
    return orders.find((o) => String(o.id) === String(orderId))
  }

  return (
    <OrderContext.Provider
      value={{
        items,
        orders,
        metrics,
        loading,
        error,
        refresh,
        createOrder,
        respondToOffer,
        approveFlaggedOrder,
        getOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  )
}

export function useOrders() {
  const ctx = useContext(OrderContext)
  if (!ctx) throw new Error('useOrders must be used within OrderProvider')
  return ctx
}
