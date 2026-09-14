// Mock product catalog used to simulate the "live database" stock check.
// Items with stock 0 will trigger the negotiation flow.
export const INVENTORY = [
  { id: 'item-1', name: 'Red T-Shirt', category: 'apparel', price: 20, stock: 0 },
  { id: 'item-2', name: 'Blue T-Shirt', category: 'apparel', price: 20, stock: 25 },
  { id: 'item-3', name: 'Black Hoodie', category: 'apparel', price: 45, stock: 0 },
  { id: 'item-4', name: 'Grey Hoodie', category: 'apparel', price: 45, stock: 12 },
  { id: 'item-5', name: 'Wireless Mouse', category: 'electronics', price: 30, stock: 8 },
  { id: 'item-6', name: 'Wireless Keyboard', category: 'electronics', price: 55, stock: 0 },
  { id: 'item-7', name: 'USB Keyboard', category: 'electronics', price: 35, stock: 14 },
]

export function getItemById(id) {
  return INVENTORY.find((i) => i.id === id)
}

// Picks another in-stock item from the same category as a substitute.
export function findAlternative(item) {
  return INVENTORY.find(
    (i) => i.category === item.category && i.id !== item.id && i.stock > 0
  )
}
