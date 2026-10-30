import { create } from 'zustand'
import { catalogApi, productsApi } from '@/services/api'
import { uid } from '@/lib/format'
import type { Category, ProductInput, ProductRow, Supplier } from '@/types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface InventoryState {
  status: Status
  error: string | null
  products: ProductRow[]
  categories: Category[]
  suppliers: Supplier[]
  load: () => Promise<void>
  /**
   * Alta optimista: el producto aparece al instante y se guarda en segundo plano.
   * Devuelve el id temporal para que la UI pueda seguirlo.
   */
  addOptimistic: (input: ProductInput) => string
  retry: (id: string) => void
  bulkAdd: (inputs: ProductInput[]) => Promise<number>
  /** Reposición: suma unidades recibidas y deja el movimiento de ingreso. */
  restock: (id: string, qty: number) => Promise<void>
  /** Edición; si cambia el stock es un ajuste y exige motivo (solo dueño). */
  update: (id: string, patch: Partial<ProductInput>, reason?: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Deshace la última carga o reposición de Carga Rápida. */
  undoEntry: (entry: { kind: 'nuevo' | 'reposicion'; sku: string; qty: number }) => Promise<void>
  /** Al cerrar sesión: el siguiente usuario vuelve a cargar con sus permisos. */
  reset: () => void
  addPhoto: (id: string, file: File) => Promise<void>
  skuExists: (sku: string) => boolean
}

const pending = new Map<string, ProductInput>()
/** Altas que se pidieron deshacer mientras todavía se estaban guardando. */
const cancelAfterSave = new Set<string>()

export const useInventory = create<InventoryState>((set, get) => {
  const persist = (tempId: string, input: ProductInput) => {
    pending.set(tempId, input)
    productsApi
      .create(input)
      .then((saved) => {
        pending.delete(tempId)
        if (cancelAfterSave.delete(tempId)) return void productsApi.undoCreate(saved.id)
        set((s) => ({ products: s.products.map((p) => (p.id === tempId ? saved : p)) }))
      })
      .catch(() => {
        set((s) => ({
          products: s.products.map((p) => (p.id === tempId ? { ...p, syncState: 'error' } : p)),
        }))
      })
  }

  return {
    status: 'idle',
    error: null,
    products: [],
    categories: [],
    suppliers: [],

    async load() {
      if (get().status === 'loading' || get().status === 'ready') return
      set({ status: 'loading', error: null })
      try {
        const [products, categories, suppliers] = await Promise.all([
          productsApi.list(),
          catalogApi.categories(),
          catalogApi.suppliers(),
        ])
        set({ products, categories, suppliers, status: 'ready' })
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : 'No se pudo cargar el inventario' })
      }
    },

    addOptimistic(input) {
      const id = uid('tmp')
      const at = new Date().toISOString()
      const row: ProductRow = { photos: [], ...input, id, createdAt: at, updatedAt: at, syncState: 'saving' }
      set((s) => ({ products: [row, ...s.products] }))
      persist(id, input)
      return id
    },

    retry(id) {
      const input = pending.get(id)
      if (!input) return
      set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, syncState: 'saving' } : p)) }))
      persist(id, input)
    },

    async bulkAdd(inputs) {
      const created = await productsApi.bulkCreate(inputs)
      set((s) => ({ products: [...created, ...s.products] }))
      return created.length
    },

    async restock(id, qty) {
      const before = get().products
      set({ products: before.map((p) => (p.id === id ? { ...p, stock: p.stock + qty } : p)) })
      try {
        const saved = await productsApi.restock(id, qty)
        set((s) => ({ products: s.products.map((p) => (p.id === id ? saved : p)) }))
      } catch (e) {
        set({ products: before })
        throw e
      }
    },

    async update(id, patch, reason) {
      const before = get().products
      set({ products: before.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
      try {
        const saved = await productsApi.update(id, patch, reason)
        set((s) => ({ products: s.products.map((p) => (p.id === id ? saved : p)) }))
      } catch (e) {
        set({ products: before })
        throw e
      }
    },

    async remove(id) {
      const before = get().products
      set({ products: before.filter((p) => p.id !== id) })
      try {
        await productsApi.remove(id)
      } catch (e) {
        set({ products: before })
        throw e
      }
    },

    async undoEntry({ kind, sku, qty }) {
      const row = get().products.find((p) => p.sku === sku)
      if (!row) return
      if (kind === 'reposicion') {
        const saved = await productsApi.undoRestock(row.id, qty)
        set((s) => ({ products: s.products.map((p) => (p.id === row.id ? saved : p)) }))
        return
      }
      set((s) => ({ products: s.products.filter((p) => p.id !== row.id) }))
      if (row.syncState === 'saving') cancelAfterSave.add(row.id)
      else if (row.syncState !== 'error') await productsApi.undoCreate(row.id)
      pending.delete(row.id)
    },

    reset: () => set({ status: 'idle', error: null, products: [], categories: [], suppliers: [] }),

    async addPhoto(id, file) {
      const saved = await productsApi.addPhoto(id, file)
      set((s) => ({ products: s.products.map((p) => (p.id === id ? saved : p)) }))
    },

    skuExists: (sku) => get().products.some((p) => p.sku === sku),
  }
})

export const categoryById = (categories: Category[], id: string) => categories.find((c) => c.id === id)
