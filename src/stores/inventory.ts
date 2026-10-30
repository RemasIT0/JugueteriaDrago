import { create } from 'zustand'
import { catalogApi, productsApi } from '@/services/api'
import { categoriesApi, discountsApi, seasonsApi, settingsApi, suppliersApi, type CategoryInput, type DiscountInput, type SupplierInput } from '@/services/commerce'
import { uid } from '@/lib/format'
import type { Category, Discount, ProductInput, ProductRow, Season, Settings, Supplier } from '@/types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface InventoryState {
  status: Status
  error: string | null
  products: ProductRow[]
  categories: Category[]
  suppliers: Supplier[]
  seasons: Season[]
  discounts: Discount[]
  settings: Settings | undefined
  load: () => Promise<void>
  addCategory: (input: CategoryInput) => Promise<Category>
  updateCategory: (id: string, patch: Partial<CategoryInput>) => Promise<void>
  addSupplier: (input: SupplierInput) => Promise<Supplier>
  updateSupplier: (id: string, patch: Partial<SupplierInput>) => Promise<void>
  saveSeason: (season: Season) => Promise<void>
  addDiscount: (input: DiscountInput) => Promise<void>
  updateDiscount: (id: string, patch: Partial<DiscountInput>) => Promise<void>
  removeDiscount: (id: string) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  /** Vuelve a leer productos tras una venta (el stock cambió en la capa de datos). */
  refreshProducts: () => Promise<void>
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
    seasons: [],
    discounts: [],
    settings: undefined,

    async load() {
      if (get().status === 'loading' || get().status === 'ready') return
      set({ status: 'loading', error: null })
      try {
        const [products, categories, suppliers, seasons, discounts, settings] = await Promise.all([
          productsApi.list(),
          catalogApi.categories(),
          catalogApi.suppliers(),
          seasonsApi.list(),
          discountsApi.list(),
          settingsApi.get(),
        ])
        set({ products, categories, suppliers, seasons, discounts, settings, status: 'ready' })
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

    reset: () => set({ status: 'idle', error: null, products: [], categories: [], suppliers: [], seasons: [], discounts: [], settings: undefined }),

    async addCategory(input) {
      const cat = await categoriesApi.create(input)
      set((s) => ({ categories: [...s.categories, cat] }))
      return cat
    },
    async updateCategory(id, patch) {
      const cat = await categoriesApi.update(id, patch)
      set((s) => ({ categories: s.categories.map((c) => (c.id === id ? cat : c)) }))
    },
    async addSupplier(input) {
      const sup = await suppliersApi.create(input)
      set((s) => ({ suppliers: [...s.suppliers, sup] }))
      return sup
    },
    async updateSupplier(id, patch) {
      const sup = await suppliersApi.update(id, patch)
      set((s) => ({ suppliers: s.suppliers.map((x) => (x.id === id ? sup : x)) }))
    },
    async saveSeason(season) {
      await seasonsApi.save(season)
      set({ seasons: await seasonsApi.list() })
    },
    async addDiscount(input) {
      await discountsApi.create(input)
      set({ discounts: await discountsApi.list() })
    },
    async updateDiscount(id, patch) {
      await discountsApi.update(id, patch)
      set({ discounts: await discountsApi.list() })
    },
    async removeDiscount(id) {
      await discountsApi.remove(id)
      set({ discounts: await discountsApi.list() })
    },
    async updateSettings(patch) {
      set({ settings: await settingsApi.update(patch) })
    },
    async refreshProducts() {
      const fresh = await productsApi.list()
      // Se conservan las filas que todavía se están guardando en segundo plano.
      set((s) => ({ products: [...s.products.filter((p) => p.syncState), ...fresh.filter((f) => !s.products.some((p) => p.syncState && p.sku === f.sku))] }))
    },

    async addPhoto(id, file) {
      const saved = await productsApi.addPhoto(id, file)
      set((s) => ({ products: s.products.map((p) => (p.id === id ? saved : p)) }))
    },

    skuExists: (sku) => get().products.some((p) => p.sku === sku),
  }
})

export const categoryById = (categories: Category[], id: string) => categories.find((c) => c.id === id)
