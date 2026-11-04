import { useMemo } from 'react'
import { create } from 'zustand'
import { ordersApi } from '@/services/commerce'
import type { PaymentMethod, Sale } from '@/types'
import { useInventory } from './inventory'
import { useSales } from './sales'

interface OrdersState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Por qué no se pudieron cargar (se muestra tal cual en Pedidos). */
  error: string | null
  orders: Sale[]
  load: (force?: boolean) => Promise<void>
  /** Retiró y pagó: pasa a venta con comprobante. */
  complete: (id: string, payment: PaymentMethod) => Promise<Sale>
  /** No vino / se arrepintió: el stock vuelve. */
  cancel: (id: string, reason: string) => Promise<void>
  releaseExpired: () => Promise<number>
  reset: () => void
}

/** Pedidos de la tienda online (reservas que se retiran y pagan en el local). */
export const useOrders = create<OrdersState>((set, get) => {
  const replace = (sale: Sale) => set((s) => ({ orders: s.orders.map((o) => (o.id === sale.id ? sale : o)) }))
  // Reportes y Facturación (si el rol los ve) se actualizan con lo que pasó acá.
  const refreshSales = () => {
    if (useSales.getState().status === 'ready') void useSales.getState().load(true)
  }
  return {
    status: 'idle',
    error: null,
    orders: [],
    async load(force) {
      if (!force && (get().status === 'loading' || get().status === 'ready')) return
      if (get().status !== 'ready') set({ status: 'loading' })
      try {
        set({ orders: await ordersApi.list(), status: 'ready', error: null })
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.' })
      }
    },
    async complete(id, payment) {
      const sale = await ordersApi.complete(id, payment)
      replace(sale)
      refreshSales()
      return sale
    },
    async cancel(id, reason) {
      replace(await ordersApi.cancel(id, reason))
      void useInventory.getState().refreshProducts()
      refreshSales()
    },
    async releaseExpired() {
      const n = await ordersApi.releaseExpired()
      await get().load(true)
      void useInventory.getState().refreshProducts()
      refreshSales()
      return n
    },
    reset: () => set({ status: 'idle', error: null, orders: [] }),
  }
})

/** Pedidos que esperan ser retirados (para el número del menú y los avisos). */
export function usePendingOrders() {
  // Se filtra fuera del selector: devolver un arreglo nuevo en cada lectura haría re-renderizar sin fin.
  const orders = useOrders((s) => s.orders)
  return useMemo(() => orders.filter((o) => o.status === 'reservada'), [orders])
}
