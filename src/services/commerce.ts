/**
 * Catálogo (categorías, proveedores, temporadas), descuentos, configuración y ventas.
 * Mismo criterio que api.ts: permisos en la capa de datos, guardado inmediato y registro
 * en Actividad de lo sensible. Las ventas recalculan precios aquí: nunca se confía en el
 * precio que manda la pantalla.
 */
import { findCoupon, ivaContained, priceFor, round2 } from '@/lib/pricing'
import { formatPrice, uid } from '@/lib/format'
import type { BoardColor, Category, Discount, InvoiceType, PaymentMethod, Sale, SaleItem, Season, Settings, Supplier } from '@/types'
import { audit } from './audit'
import { requirePermission } from './auth'
import { ApiError } from './http'
import { loadDb, save } from './localDb'
import { currentUser } from './session'

const norm = (s: string) => s.normalize('NFC').trim().toLocaleLowerCase('es')

// ── Categorías ─────────────────────────────────────────────────────────────────
export type CategoryInput = Omit<Category, 'id'>

export const categoriesApi = {
  async create(input: CategoryInput): Promise<Category> {
    requirePermission('categorias.crear')
    const db = await loadDb()
    const name = input.name.trim()
    if (name.length < 2) throw new ApiError(400, 'El nombre de la categoría es muy corto')
    if (db.categories.some((c) => norm(c.name) === norm(name))) throw new ApiError(409, `Ya existe la categoría «${name}»`)
    const cat: Category = { ...input, name, id: uid('cat') }
    db.categories.push(cat)
    await save('categories')
    await audit('Categoría creada', name)
    return structuredClone(cat)
  },
  async update(id: string, patch: Partial<CategoryInput>): Promise<Category> {
    requirePermission('categorias.editar')
    const db = await loadDb()
    const cat = db.categories.find((c) => c.id === id)
    if (!cat) throw new ApiError(404, 'La categoría ya no existe')
    if (patch.name && db.categories.some((c) => c.id !== id && norm(c.name) === norm(patch.name!))) throw new ApiError(409, `Ya existe la categoría «${patch.name}»`)
    Object.assign(cat, patch, patch.name ? { name: patch.name.trim() } : {})
    await save('categories')
    await audit('Categoría editada', cat.name)
    return structuredClone(cat)
  },
}

/** Color libre para una categoría nueva: el menos usado del tablero. */
export function nextBoardColor(categories: Category[]): BoardColor {
  const colors: BoardColor[] = ['sol', 'coral', 'turquesa', 'lila', 'hoja', 'cielo']
  return colors.map((c) => [c, categories.filter((x) => x.color === c).length] as const).sort((a, b) => a[1] - b[1])[0][0]
}

// ── Proveedores ────────────────────────────────────────────────────────────────
export type SupplierInput = Omit<Supplier, 'id'>

export const suppliersApi = {
  async create(input: SupplierInput): Promise<Supplier> {
    requirePermission('proveedores.gestionar')
    const db = await loadDb()
    if (input.name.trim().length < 2) throw new ApiError(400, 'Escribe el nombre del proveedor')
    if (db.suppliers.some((s) => norm(s.name) === norm(input.name))) throw new ApiError(409, `Ya existe el proveedor «${input.name.trim()}»`)
    const sup: Supplier = { ...input, name: input.name.trim(), id: uid('sup') }
    db.suppliers.push(sup)
    await save('suppliers')
    await audit('Proveedor creado', sup.name)
    return structuredClone(sup)
  },
  async update(id: string, patch: Partial<SupplierInput>): Promise<Supplier> {
    requirePermission('proveedores.gestionar')
    const db = await loadDb()
    const sup = db.suppliers.find((s) => s.id === id)
    if (!sup) throw new ApiError(404, 'El proveedor ya no existe')
    Object.assign(sup, patch)
    await save('suppliers')
    await audit('Proveedor editado', sup.name)
    return structuredClone(sup)
  },
}

// ── Temporadas ─────────────────────────────────────────────────────────────────
export const seasonsApi = {
  async list(): Promise<Season[]> {
    return structuredClone((await loadDb()).seasons)
  },
  async save(season: Season): Promise<Season> {
    requirePermission('temporadas.gestionar')
    const db = await loadDb()
    if (season.name.trim().length < 2) throw new ApiError(400, 'Escribe el nombre de la temporada')
    const i = db.seasons.findIndex((s) => s.id === season.id)
    if (i >= 0) db.seasons[i] = season
    else db.seasons.push({ ...season, id: season.id || uid('temp') })
    await save('seasons')
    await audit(i >= 0 ? 'Temporada editada' : 'Temporada creada', season.name)
    return structuredClone(season)
  },
}

// ── Descuentos ─────────────────────────────────────────────────────────────────
export type DiscountInput = Omit<Discount, 'id' | 'createdAt'>

export const discountsApi = {
  /** Lectura pública: la tienda necesita las promociones vigentes. */
  async list(): Promise<Discount[]> {
    return structuredClone((await loadDb()).discounts)
  },
  async create(input: DiscountInput): Promise<Discount> {
    requirePermission('descuentos.gestionar')
    validateDiscount(input)
    const db = await loadDb()
    if (input.kind === 'cupon' && db.discounts.some((d) => d.kind === 'cupon' && d.code?.toUpperCase() === input.code!.toUpperCase()))
      throw new ApiError(409, `Ya existe el cupón ${input.code}`)
    const d: Discount = { ...input, code: input.code?.toUpperCase() ?? null, id: uid('dto'), createdAt: new Date().toISOString() }
    db.discounts.unshift(d)
    await save('discounts')
    await audit('Descuento creado', `${d.name} (${d.percent}%)`)
    return structuredClone(d)
  },
  async update(id: string, patch: Partial<DiscountInput>): Promise<Discount> {
    requirePermission('descuentos.gestionar')
    const db = await loadDb()
    const d = db.discounts.find((x) => x.id === id)
    if (!d) throw new ApiError(404, 'El descuento ya no existe')
    validateDiscount({ ...d, ...patch })
    Object.assign(d, patch)
    await save('discounts')
    await audit(patch.active === false ? 'Descuento pausado' : patch.active === true ? 'Descuento activado' : 'Descuento editado', `${d.name} (${d.percent}%)`)
    return structuredClone(d)
  },
  async remove(id: string) {
    requirePermission('descuentos.gestionar')
    const db = await loadDb()
    const d = db.discounts.find((x) => x.id === id)
    db.discounts = db.discounts.filter((x) => x.id !== id)
    await save('discounts')
    if (d) await audit('Descuento eliminado', d.name)
  },
}

function validateDiscount(d: DiscountInput) {
  if (!d.name.trim()) throw new ApiError(400, 'Ponle un nombre al descuento')
  if (!(d.percent > 0 && d.percent <= 90)) throw new ApiError(400, 'El porcentaje debe estar entre 1 y 90')
  if (d.kind === 'cupon' && !/^[A-Z0-9-]{3,20}$/i.test(d.code ?? '')) throw new ApiError(400, 'El código del cupón: 3 a 20 letras o números, sin espacios')
  if (d.kind !== 'cupon' && !d.targetId) throw new ApiError(400, 'Elige a qué aplica el descuento')
  if (d.startsAt && d.endsAt && d.startsAt > d.endsAt) throw new ApiError(400, 'La fecha de fin es anterior a la de inicio')
}

// ── Configuración ──────────────────────────────────────────────────────────────
export const settingsApi = {
  async get(): Promise<Settings> {
    return structuredClone((await loadDb()).settings[0])
  },
  async update(patch: Partial<Settings>): Promise<Settings> {
    requirePermission('ajustes.gestionar')
    const db = await loadDb()
    db.settings[0] = { ...db.settings[0], ...patch }
    await save('settings')
    await audit('Configuración actualizada', Object.keys(patch).join(', '))
    return structuredClone(db.settings[0])
  },
}

// ── Ventas ─────────────────────────────────────────────────────────────────────
export interface CheckoutInput {
  channel: Sale['channel']
  items: { productId: string; qty: number }[]
  couponCode?: string
  customer: Sale['customer']
  paymentMethod: PaymentMethod
  /** Factura A si el cliente da CUIT; B a consumidor final. */
  invoiceType: InvoiceType
  test: boolean
}

export const salesApi = {
  async list(): Promise<Sale[]> {
    requirePermission('ventas.ver')
    return structuredClone((await loadDb()).sales)
  },

  /**
   * Cobra una venta: valida stock, recalcula precios y descuentos, descuenta stock,
   * deja movimientos "venta" y numera el comprobante. Todo o nada.
   */
  async checkout(input: CheckoutInput): Promise<Sale> {
    if (input.channel === 'mostrador') requirePermission('productos.reponer')
    if (!input.items.length) throw new ApiError(400, 'El carrito está vacío')
    if (!input.customer.name.trim()) throw new ApiError(400, 'Escribe el nombre de quien compra')
    if (input.invoiceType === 'A' && !/^\d{11}$/.test(input.customer.doc.replace(/\D/g, ''))) throw new ApiError(400, 'Para factura A hace falta un CUIT de 11 dígitos')
    const db = await loadDb()
    const settings = db.settings[0]
    const now = Date.now()

    const items: SaleItem[] = []
    for (const line of input.items) {
      const p = db.products.find((x) => x.id === line.productId)
      if (!p) throw new ApiError(404, 'Un producto del carrito ya no existe')
      if (!Number.isInteger(line.qty) || line.qty <= 0) throw new ApiError(400, 'Cantidad inválida')
      if (line.qty > p.stock) throw new ApiError(409, `Solo quedan ${p.stock} de «${p.name}»`)
      const price = priceFor(p, db.discounts, now)
      items.push({ productId: p.id, sku: p.sku, name: p.name, qty: line.qty, unitPrice: p.price, discountPercent: price.percent, unitFinal: price.final, unitCost: p.cost })
    }
    const subtotal = round2(items.reduce((a, i) => a + i.unitPrice * i.qty, 0))
    const afterPromos = round2(items.reduce((a, i) => a + i.unitFinal * i.qty, 0))
    const coupon = input.couponCode?.trim() ? findCoupon(input.couponCode, db.discounts, now) : null
    if (input.couponCode?.trim() && !coupon) throw new ApiError(400, 'El cupón no existe o ya venció')
    const couponPercent = coupon?.percent ?? 0
    const total = round2(afterPromos * (1 - couponPercent / 100))

    const number = Math.max(0, ...db.sales.filter((s) => s.invoiceType === input.invoiceType).map((s) => s.number)) + 1
    const sale: Sale = {
      id: uid('vta'),
      number,
      invoiceType: input.invoiceType,
      at: new Date().toISOString(),
      channel: input.channel,
      customer: { ...input.customer, name: input.customer.name.trim(), email: input.customer.email.trim() },
      items,
      subtotal,
      couponCode: coupon?.code ?? null,
      couponPercent,
      discountTotal: round2(subtotal - total),
      total,
      iva: ivaContained(total, settings.ivaRate),
      paymentMethod: input.paymentMethod,
      status: 'completada',
      test: input.test,
      userId: currentUser()?.id ?? null,
    }

    for (const i of items) {
      const p = db.products.find((x) => x.id === i.productId)!
      p.stock -= i.qty
      p.updatedAt = sale.at
      db.movements.unshift({ id: uid('mov'), productId: p.id, date: sale.at, delta: -i.qty, reason: 'venta', userId: sale.userId ?? undefined, note: `${invoiceLabel(sale)}${sale.test ? ' (prueba)' : ''}` })
    }
    db.sales.unshift(sale)
    await Promise.all([save('products'), save('movements'), save('sales')])
    await audit(sale.test ? 'Venta de prueba' : 'Venta', `${invoiceLabel(sale)} · ${sale.channel} · ${formatPrice(sale.total)}`)
    return structuredClone(sale)
  },

  /** Anula una venta: devuelve el stock y la conserva marcada como anulada (nunca se borra). */
  async void(id: string, reason: string): Promise<Sale> {
    requirePermission('ventas.anular')
    if (!reason.trim()) throw new ApiError(400, 'Indica el motivo de la anulación')
    const db = await loadDb()
    const sale = db.sales.find((s) => s.id === id)
    if (!sale) throw new ApiError(404, 'La venta ya no existe')
    if (sale.status === 'anulada') throw new ApiError(409, 'La venta ya estaba anulada')
    sale.status = 'anulada'
    sale.voidedAt = new Date().toISOString()
    sale.voidReason = reason.trim()
    for (const i of sale.items) {
      const p = db.products.find((x) => x.id === i.productId)
      if (!p) continue
      p.stock += i.qty
      p.updatedAt = sale.voidedAt
      db.movements.unshift({ id: uid('mov'), productId: p.id, date: sale.voidedAt, delta: i.qty, reason: 'venta', userId: currentUser()?.id, note: `Anulación ${invoiceLabel(sale)}` })
    }
    await Promise.all([save('products'), save('movements'), save('sales')])
    await audit('Venta anulada', `${invoiceLabel(sale)} · ${formatPrice(sale.total)} · Motivo: ${sale.voidReason}`)
    return structuredClone(sale)
  },
}

export const invoiceLabel = (s: Pick<Sale, 'invoiceType' | 'number'>) => `${s.invoiceType === 'X' ? 'Comprobante X' : `Factura ${s.invoiceType}`} 0001-${String(s.number).padStart(8, '0')}`

/** Catálogo público para la tienda: solo lo necesario, sin costos ni proveedores. */
export async function publicCatalog() {
  const db = await loadDb()
  return {
    products: db.products
      .filter((p) => p.stock > 0)
      .map(({ id, sku, name, categoryId, price, stock, ageMin, batteries, brand, photos, seasons }) => ({ id, sku, name, categoryId, price, stock, ageMin, batteries, brand, photos, seasons })),
    categories: structuredClone(db.categories),
    seasons: structuredClone(db.seasons),
    discounts: db.discounts.filter((d) => d.kind !== 'cupon'),
  }
}
