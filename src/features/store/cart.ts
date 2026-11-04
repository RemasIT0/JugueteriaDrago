import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartState {
  lines: { productId: string; qty: number }[]
  add: (productId: string, max: number) => boolean
  setQty: (productId: string, qty: number, max: number) => void
  remove: (productId: string) => void
  clear: () => void
}

/** Carrito del cliente: sobrevive a recargas en este navegador. El precio final lo calcula siempre la caja. */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add(productId, max) {
        const line = get().lines.find((l) => l.productId === productId)
        if ((line?.qty ?? 0) >= max) return false
        set((s) => ({
          lines: line ? s.lines.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l)) : [...s.lines, { productId, qty: 1 }],
        }))
        return true
      },
      setQty: (productId, qty, max) =>
        set((s) => ({
          lines: qty <= 0 ? s.lines.filter((l) => l.productId !== productId) : s.lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, max) } : l)),
        })),
      remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'dragotoy-carrito' },
  ),
)
