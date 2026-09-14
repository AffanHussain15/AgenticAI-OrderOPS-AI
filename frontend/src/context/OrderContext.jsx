import { createContext, useContext, useEffect, useState } from 'react'
import { getItemById, findAlternative } from '../data/mockInventory'

const OrderContext = createContext(null)
const STORAGE_KEY = 'orderops_orders'

// --- Workflow steps (mirrors the LangGraph nodes on the backend) ---

// Node 1: Order Intake & Fraud Check
function runFraudCheck(order) {
  const orderValue = order.price * order.quantity
  const riskScore = orderValue > 500 || order.quantity > 5 ? 'high' : 'low'
  return riskScore
}

// Node 2: Inventory Validation
function runInventoryCheck(item, quantity) {
  return item.stock >= quantity
}

// Node 3: Agentic Negotiation
function buildNegotiationOffer(item) {
  const alternative = findAlternative(item)
  if (!alternative) return null
  return {
    itemId: alternative.id,
    itemName: alternative.name,
    originalPrice: alternative.price,
    discountPercent: 15,
    discountedPrice: +(alternative.price * 0.85).toFixed(2),
  }
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function OrderProvider({ children }) {
  const [orders, setOrders] = useState(loadOrders)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  }, [orders])

  function createOrder({ customerName, itemId, quantity }) {
    const item = getItemById(itemId)
    const now = new Date().toISOString()
    const order = {
      id: `ord-${Date.now()}`,
      customerName,
      itemId: item.id,
      itemName: item.name,
      price: item.price,
      quantity,
      createdAt: now,
      resolvedAt: null,
      riskScore: null,
      status: 'processing',
      negotiationOffer: null,
      history: [],
    }

    // Step 1: fraud check
    order.riskScore = runFraudCheck(order)
    order.history.push({ step: 'fraud_check', result: order.riskScore, at: now })

    if (order.riskScore === 'high') {
      order.status = 'flagged_for_audit'
      setOrders((prev) => [order, ...prev])
      return order
    }

    // Step 2: inventory validation
    const inStock = runInventoryCheck(item, quantity)
    order.history.push({ step: 'inventory_check', result: inStock ? 'in_stock' : 'out_of_stock', at: now })

    if (inStock) {
      order.status = 'fulfilled'
      order.resolvedAt = now
    } else {
      // Step 3: agentic negotiation
      const offer = buildNegotiationOffer(item)
      if (offer) {
        order.negotiationOffer = offer
        order.status = 'awaiting_customer_response'
        order.history.push({ step: 'negotiation_offer_sent', result: offer.itemName, at: now })
      } else {
        order.status = 'refunded'
        order.resolvedAt = now
        order.history.push({ step: 'refund', result: 'no_alternative_available', at: now })
      }
    }

    setOrders((prev) => [order, ...prev])
    return order
  }

  // Fraud manual audit approval (admin action)
  function approveFlaggedOrder(orderId) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        const item = getItemById(o.itemId)
        const inStock = runInventoryCheck(item, o.quantity)
        const now = new Date().toISOString()
        if (inStock) {
          return {
            ...o,
            status: 'fulfilled',
            resolvedAt: now,
            history: [...o.history, { step: 'manual_audit_approved', result: 'in_stock', at: now }],
          }
        }
        const offer = buildNegotiationOffer(item)
        if (offer) {
          return {
            ...o,
            status: 'awaiting_customer_response',
            negotiationOffer: offer,
            history: [...o.history, { step: 'manual_audit_approved', result: 'negotiation_offer_sent', at: now }],
          }
        }
        return {
          ...o,
          status: 'refunded',
          resolvedAt: now,
          history: [...o.history, { step: 'manual_audit_approved', result: 'refund_no_alternative', at: now }],
        }
      })
    )
  }

  // Node 4: Human-in-the-loop response
  function respondToOffer(orderId, accepted) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        const now = new Date().toISOString()
        if (accepted) {
          return {
            ...o,
            status: 'fulfilled_with_alternative',
            itemId: o.negotiationOffer.itemId,
            itemName: o.negotiationOffer.itemName,
            price: o.negotiationOffer.discountedPrice,
            resolvedAt: now,
            history: [...o.history, { step: 'customer_response', result: 'accepted', at: now }],
          }
        }
        return {
          ...o,
          status: 'refunded',
          resolvedAt: now,
          history: [...o.history, { step: 'customer_response', result: 'declined', at: now }],
        }
      })
    )
  }

  function getOrder(orderId) {
    return orders.find((o) => o.id === orderId)
  }

  return (
    <OrderContext.Provider
      value={{ orders, createOrder, respondToOffer, approveFlaggedOrder, getOrder }}
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
