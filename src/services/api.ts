/**
 * Capa de datos. Toda la app habla con estas funciones y nunca con fetch directamente.
 * Con VITE_API_URL definido usan la API real (rutas REST sugeridas abajo);
 * sin él, guardan en la base local del navegador (IndexedDB, ver localDb.ts).
 *
 * En modo local, cada operación valida permisos, guarda de inmediato, deja un movimiento
 * de stock cuando el stock cambia y registra en la actividad las acciones sensibles.
 */
import { seedCategories, seedProducts, seedSuppliers } from '@/mocks/seed'
import { STORE } from '@/lib/config'
import { formatPrice, uid } from '@/lib/format'
import type { Category, Product, ProductInput, StockMovement, Supplier } from '@/types'
import { audit } from './audit'
import { requirePermission } from './auth'
import { ApiError, http, useRealApi } from './http'
import { loadDb, markInitialized, save } from './localDb'
import { currentUser } from './session'

function build(input: ProductInput): Product {
  const at = new Date().toISOString()
  return { photos: [], ...input, id: uid('prd'), createdAt: at, updatedAt: at }
}

function assertUniqueSku(products: Product[], sku: string, ignoreId?: string) {
  if (products.some((p) => p.sku === sku && p.id !== ignoreId)) throw new ApiError(409, `Ya existe un producto con el código ${sku}`)
}

function movement(productId: string, delta: number, reason: StockMovement['reason'], note?: string): StockMovement {
  return { id: uid('mov'), productId, date: new Date().toISOString(), delta, reason, userId: currentUser()?.id, note }
}

/** Foto como data URL: en modo local tiene que sobrevivir a recargas. Se reduce para no llenar el disco. */
async function fileToDataUrl(file: File, max = 1200): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) })
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

export const productsApi = {
  // GET /products
  async list(): Promise<Product[]> {
    if (useRealApi()) return http('/products')
    requirePermission('inventario.ver')
    return structuredClone((await loadDb()).products)
  },

  // POST /products
  async create(input: ProductInput): Promise<Product> {
    if (useRealApi()) return http('/products', { method: 'POST', body: JSON.stringify(input) })
    requirePermission('productos.crear')
    const db = await loadDb()
    assertUniqueSku(db.products, input.sku)
    const p = build(input)
    db.products.unshift(p)
    db.movements.unshift(movement(p.id, p.stock, 'alta', input.loteId ? 'Carga rápida' : undefined))
    await Promise.all([save('products'), save('movements')])
    return structuredClone(p)
  },

  // POST /products/bulk — todo o nada: si una fila falla, no se guarda ninguna.
  async bulkCreate(inputs: ProductInput[]): Promise<Product[]> {
    if (useRealApi()) return http('/products/bulk', { method: 'POST', body: JSON.stringify(inputs) })
    requirePermission('productos.importar')
    const db = await loadDb()
    const seen = new Set<string>()
    for (const i of inputs) {
      assertUniqueSku(db.products, i.sku)
      if (seen.has(i.sku)) throw new ApiError(409, `El código ${i.sku} está repetido en el archivo`)
      seen.add(i.sku)
    }
    const created = inputs.map(build)
    db.products.unshift(...created)
    db.movements.unshift(...created.map((p) => movement(p.id, p.stock, 'alta', 'Importación de archivo')))
    await Promise.all([save('products'), save('movements')])
    await audit('Importación', `${created.length} productos desde archivo`)
    return structuredClone(created)
  },

  // POST /products/:id/restock — suma unidades que llegaron (cualquier usuario).
  async restock(id: string, qty: number): Promise<Product> {
    if (useRealApi()) return http(`/products/${id}/restock`, { method: 'POST', body: JSON.stringify({ qty }) })
    requirePermission('productos.reponer')
    if (!Number.isInteger(qty) || qty <= 0) throw new ApiError(400, 'La cantidad debe ser un número entero mayor a 0')
    const db = await loadDb()
    const p = db.products.find((x) => x.id === id)
    if (!p) throw new ApiError(404, 'El producto ya no existe')
    p.stock += qty
    p.updatedAt = new Date().toISOString()
    db.movements.unshift(movement(p.id, qty, 'ingreso', 'Reposición'))
    await Promise.all([save('products'), save('movements')])
    return structuredClone(p)
  },

  // PATCH /products/:id — un cambio de stock por esta vía es un ajuste y exige motivo.
  async update(id: string, patch: Partial<ProductInput>, reason?: string): Promise<Product> {
    if (useRealApi()) return http(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ ...patch, reason }) })
    const db = await loadDb()
    const i = db.products.findIndex((p) => p.id === id)
    if (i < 0) throw new ApiError(404, 'El producto ya no existe')
    const before = db.products[i]
    const stockChanges = patch.stock !== undefined && patch.stock !== before.stock
    if (stockChanges) {
      requirePermission('stock.ajustar')
      if (!reason?.trim()) throw new ApiError(400, 'Indica el motivo del ajuste de stock')
      if (!Number.isInteger(patch.stock) || patch.stock! < 0) throw new ApiError(400, 'El stock debe ser un número entero no negativo')
    } else {
      requirePermission('productos.crear')
    }
    if (patch.sku) assertUniqueSku(db.products, patch.sku, id)
    db.products[i] = { ...before, ...patch, updatedAt: new Date().toISOString() }
    const writes = [save('products')]
    if (stockChanges) {
      const delta = patch.stock! - before.stock
      db.movements.unshift(movement(id, delta, 'ajuste', reason))
      writes.push(save('movements'))
      await audit('Ajuste de stock', `${before.name}: ${before.stock} → ${patch.stock} (${delta > 0 ? '+' : ''}${delta}). Motivo: ${reason}`)
    }
    if (patch.price !== undefined && patch.price !== before.price)
      await audit('Cambio de precio', `${before.name}: ${formatPrice(before.price)} → ${formatPrice(patch.price)}`)
    await Promise.all(writes)
    return structuredClone(db.products[i])
  },

  // DELETE /products/:id — se conserva su historial de movimientos.
  async remove(id: string): Promise<void> {
    if (useRealApi()) return http(`/products/${id}`, { method: 'DELETE' })
    requirePermission('productos.eliminar')
    const db = await loadDb()
    const p = db.products.find((x) => x.id === id)
    if (!p) return
    db.products = db.products.filter((x) => x.id !== id)
    await save('products')
    await audit('Producto eliminado', `${p.name} (${p.sku}) con ${p.stock} u en stock`)
  },

  // DELETE /products/:id (deshacer una carga recién hecha) — permitido a quien la cargó.
  async undoCreate(id: string): Promise<void> {
    if (useRealApi()) return http(`/products/${id}?undo=1`, { method: 'DELETE' })
    requirePermission('productos.crear')
    const db = await loadDb()
    const p = db.products.find((x) => x.id === id)
    if (!p) return
    const mine = db.movements.find((m) => m.productId === id && m.reason === 'alta')
    const fresh = Date.now() - new Date(p.createdAt).getTime() < 30 * 60_000
    if (!(mine && mine.userId === currentUser()?.id && fresh)) requirePermission('productos.eliminar')
    db.products = db.products.filter((x) => x.id !== id)
    db.movements = db.movements.filter((m) => m.productId !== id)
    await Promise.all([save('products'), save('movements')])
    await audit('Carga deshecha', `${p.name} (${p.sku})`)
  },

  // POST /products/:id/restock/undo — revierte una reposición recién hecha.
  async undoRestock(id: string, qty: number): Promise<Product> {
    if (useRealApi()) return http(`/products/${id}/restock/undo`, { method: 'POST', body: JSON.stringify({ qty }) })
    requirePermission('productos.reponer')
    const db = await loadDb()
    const p = db.products.find((x) => x.id === id)
    if (!p) throw new ApiError(404, 'El producto ya no existe')
    p.stock = Math.max(0, p.stock - qty)
    p.updatedAt = new Date().toISOString()
    db.movements.unshift(movement(id, -qty, 'ingreso', 'Reposición deshecha'))
    await Promise.all([save('products'), save('movements')])
    await audit('Reposición deshecha', `${p.name}: −${qty} u`)
    return structuredClone(p)
  },

  // POST /products/:id/photos (multipart, campo "photo") → producto actualizado
  async addPhoto(id: string, file: File): Promise<Product> {
    if (useRealApi()) {
      const body = new FormData()
      body.append('photo', file)
      const res = await fetch(`${STORE.apiUrl}/products/${id}/photos`, { method: 'POST', body })
      if (!res.ok) throw new ApiError(res.status, 'No se pudo subir la foto')
      return res.json()
    }
    requirePermission('productos.fotos')
    const db = await loadDb()
    const p = db.products.find((x) => x.id === id)
    if (!p) throw new ApiError(404, 'El producto ya no existe')
    p.photos = [...p.photos, await fileToDataUrl(file)]
    await save('products')
    return structuredClone(p)
  },

  // GET /movements?days=N — movimientos recientes de todo el inventario (para el asistente).
  async recentMovements(days: number): Promise<StockMovement[]> {
    if (useRealApi()) return http(`/movements?days=${days}`)
    requirePermission('inventario.ver')
    const from = Date.now() - days * 86_400_000
    return structuredClone((await loadDb()).movements.filter((m) => new Date(m.date).getTime() >= from))
  },

  // GET /products/:id/movements — historial real, el más reciente primero.
  async movements(product: Product): Promise<StockMovement[]> {
    if (useRealApi()) return http(`/products/${product.id}/movements`)
    requirePermission('inventario.ver')
    return structuredClone((await loadDb()).movements.filter((m) => m.productId === product.id))
  },
}

export const catalogApi = {
  // GET /categories
  async categories(): Promise<Category[]> {
    if (useRealApi()) return http('/categories')
    return structuredClone((await loadDb()).categories)
  },
  // GET /suppliers
  async suppliers(): Promise<Supplier[]> {
    if (useRealApi()) return http('/suppliers')
    return structuredClone((await loadDb()).suppliers)
  },
}

/**
 * Primer uso del modo local: deja las categorías base (con sus plantillas) y, solo si se pide,
 * el catálogo de ejemplo. Los productos de ejemplo quedan marcados en su proveedor "(ejemplo)".
 */
export async function initializeLocalData({ demo }: { demo: boolean }) {
  const db = await loadDb()
  if (!db.categories.length) {
    db.categories = structuredClone(seedCategories)
    await save('categories')
  }
  if (demo && !db.products.length) {
    db.suppliers = structuredClone(seedSuppliers)
    db.products = structuredClone(seedProducts)
    db.movements = db.products.map((p) => ({ id: uid('mov'), productId: p.id, date: p.createdAt, delta: p.stock, reason: 'alta' as const, note: 'Dato de ejemplo' }))
    await Promise.all([save('suppliers'), save('products'), save('movements')])
    await audit('Datos de ejemplo cargados', `${db.products.length} productos de ejemplo`)
  }
  await markInitialized()
}
