import { create } from 'zustand'
import { salesApi, type CheckoutInput } from '@/services/commerce'
import type { Sale } from '@/types'
import { useInventory } from './inventory'

interface SalesState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  sales: Sale[]
  load: (force?: boolean) => Promise<void>
  checkout: (input: CheckoutInput) => Promise<Sale>
  voidSale: (id: string, reason: string) => Promise<void>
}

export const useSales = create<SalesState>((set, get) => ({
  status: 'idle',
  sales: [],
  async load(force) {
    if (!force && (get().status === 'loading' || get().status === 'ready')) return
    set({ status: 'loading' })
    try {
      set({ sales: await salesApi.list(), status: 'ready' })
    } catch {
      set({ status: 'error' })
    }
  },
  async checkout(input) {
    const sale = await salesApi.checkout(input)
    set((s) => ({ sales: [sale, ...s.sales] }))
    void useInventory.getState().refreshProducts()
    return sale
  },
  async voidSale(id, reason) {
    const sale = await salesApi.void(id, reason)
    set((s) => ({ sales: s.sales.map((x) => (x.id === id ? sale : x)) }))
    void useInventory.getState().refreshProducts()
  },
}))
