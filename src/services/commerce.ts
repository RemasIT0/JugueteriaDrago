/**
 * Catálogo (categorías, proveedores, temporadas), descuentos, configuración y ventas.
 * Mismo criterio que api.ts: permisos en la capa de datos, guardado inmediato y registro
 * en Actividad de lo sensible. Las ventas recalculan precios aquí: nunca se confía en el
 * precio que manda la pantalla.
 */
import { findCoupon, ivaContained, priceFor, round2 } from '@/lib/pricing'
import { formatPrice, uid } from '@/lib/format'
import type { BoardColor, CashClosing, CashMethodTotal, CashStatus, Category, Discount, InvoiceType, PaymentMethod, Product, Sale, SaleItem, Season, Settings, Supplier } from '@/types'
import { audit } from './audit'
import { can } from '@/lib/permissions'
import { requirePermission } from './auth'
import { ApiError } from './http'
import { loadDb, save } from './localDb'
import { currentUser } from './session'
import { cloud, rpc } from './supabase'

const norm = (s: string) => s.normalize('NFC').trim().toLocaleLowerCase('es')

// ── Categorías ─────────────────────────────────────────────────────────────────
export type CategoryInput = Omit<Category, 'id'>

export const categoriesApi = {
  async create(input: CategoryInput): Promise<Category> {
    if (cloud) return rpc('category_create', { p: input })
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
    if (cloud) return rpc('category_update', { p_id: id, p: patch })
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
    if (cloud) return rpc('supplier_create', { p: input })
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
    if (cloud) return rpc('supplier_update', { p_id: id, p: patch })
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
    if (cloud) return rpc('list_seasons')
    return structuredClone((await loadDb()).seasons)
  },
  async save(season: Season): Promise<Season> {
    if (cloud) return rpc('season_save', { p: season })
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
  async list(): Promise<Discount[]> {
    if (cloud) return rpc('list_discounts')
    return structuredClone((await loadDb()).discounts)
  },
  async create(input: DiscountInput): Promise<Discount> {
    if (cloud) return rpc('discount_create', { p: input })
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
    if (cloud) return rpc('discount_update', { p_id: id, p: patch })
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
    if (cloud) return rpc<void>('discount_delete', { p_id: id })
    requirePermission('descuentos.gestionar')
    const db = await loadDb()
    const d = db.discounts.find((x) => x.id === id)
    db.discounts = db.discounts.filter((x) => x.id !== id)
    await save('discounts')
    if (d) await audit('Descuento eliminado', d.name)
  },
  /** La tienda valida el cupón que escribe el cliente sin recibir la lista de códigos. */
  async checkCoupon(code: string): Promise<{ code: string; percent: number } | null> {
    if (cloud) return rpc('check_coupon', { p_code: code })
    const c = findCoupon(code, (await loadDb()).discounts)
    return c ? { code: c.code!, percent: c.percent } : null
  },
}

function validateDiscount(d: DiscountInput) {
  if (!d.name.trim()) throw new ApiError(400, 'Ponle un nombre al descuento')
  if (!(d.percent > 0 && d.percent <= 90)) throw new ApiError(400, 'El porcentaje debe estar entre 1 y 90')
  if (d.kind === 'cupon' && !/^[A-Z0-9-]{3,20}$/i.test(d.code ?? '')) throw new ApiError(400, 'El código del cupón: 3 a 20 letras o números, sin espacios')
  if (d.kind === 'producto' && d.targetIds && d.targetIds.length === 0) throw new ApiError(400, 'Elige al menos un producto')
  if (d.kind !== 'cupon' && !d.targetId) throw new ApiError(400, 'Elige a qué aplica el descuento')
  if (d.startsAt && d.endsAt && d.startsAt > d.endsAt) throw new ApiError(400, 'La fecha de fin es anterior a la de inicio')
}

// ── Configuración ──────────────────────────────────────────────────────────────
export const settingsApi = {
  async get(): Promise<Settings> {
    // Sin sesión (tienda) solo se reciben los datos del emisor para el comprobante.
    if (cloud) return rpc(currentUser() ? 'get_settings' : 'public_settings')
    return structuredClone((await loadDb()).settings[0])
  },
  async update(patch: Partial<Settings>): Promise<Settings> {
    if (cloud) return rpc('settings_update', { p: patch })
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

/** Días que se guarda una reserva de la tienda (igual que en la base en la nube). */
export const RESERVATION_DAYS = 3
const PAYMENT_IDS: PaymentMethod[] = ['efectivo', 'debito', 'credito', 'transferencia', 'mercadopago']

/** Sin costos para quien no puede verlos (cliente de la tienda, vendedor). */
function safeSale(s: Sale): Sale {
  const copy = structuredClone(s)
  if (!can(currentUser()?.role, 'costos.ver')) copy.items = copy.items.map((i) => ({ ...i, unitCost: null }))
  return copy
}

export const salesApi = {
  async list(): Promise<Sale[]> {
    if (cloud) return rpc('list_sales')
    requirePermission('ventas.ver')
    return structuredClone((await loadDb()).sales)
  },

  /**
   * Cobra una venta: valida stock, recalcula precios y descuentos, descuenta stock,
   * deja movimientos "venta" y numera el comprobante. Todo o nada.
   */
  async checkout(input: CheckoutInput): Promise<Sale> {
    if (cloud) return rpc('checkout', { p: input })
    if (input.channel === 'mostrador') requirePermission('ventas.crear')
    if (!PAYMENT_IDS.includes(input.paymentMethod)) throw new ApiError(400, 'Medio de pago inválido')
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

    // La tienda reserva (sin número de comprobante); el mostrador cobra y numera.
    const reserve = input.channel === 'tienda'
    const number = reserve ? 0 : nextInvoiceNumber(db.sales, input.invoiceType)
    const reservedAt = new Date().toISOString()
    const sale: Sale = {
      id: uid('vta'),
      number,
      ...(reserve && {
        reservationCode: Math.max(0, ...db.sales.map((s) => s.reservationCode ?? 0)) + 1,
        reservedAt,
        expiresAt: new Date(Date.parse(reservedAt) + RESERVATION_DAYS * 86_400_000).toISOString(),
      }),
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
      status: reserve ? 'reservada' : 'completada',
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
    await audit(
      reserve ? (sale.test ? 'Reserva de prueba' : 'Reserva online') : sale.test ? 'Venta de prueba' : 'Venta',
      `${invoiceLabel(sale)} · ${sale.channel} · ${formatPrice(sale.total)}${reserve ? ` · ${sale.customer.name}` : ''}`,
    )
    return safeSale(sale)
  },

  /** Anula una venta: devuelve el stock y la conserva marcada como anulada (nunca se borra). */
  async void(id: string, reason: string): Promise<Sale> {
    if (cloud) return rpc('sale_void', { p_id: id, p_reason: reason })
    requirePermission('ventas.anular')
    if (!reason.trim()) throw new ApiError(400, 'Indica el motivo de la anulación')
    const db = await loadDb()
    const sale = db.sales.find((s) => s.id === id)
    if (!sale) throw new ApiError(404, 'La venta ya no existe')
    if (sale.status === 'anulada') throw new ApiError(409, 'La venta ya estaba anulada')
    if (sale.status !== 'completada') throw new ApiError(409, 'Las reservas se cancelan desde Pedidos')
    if (sale.creditFor) throw new ApiError(409, 'Una nota de crédito no se anula')
    if (db.sales.some((x) => x.creditFor === sale.id)) throw new ApiError(409, 'Esta venta ya tuvo devoluciones: devuelve el resto desde Vender → Cambio o devolución')
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

const nextInvoiceNumber = (sales: Sale[], type: InvoiceType, credit = false) =>
  Math.max(0, ...sales.filter((s) => s.invoiceType === type && !!s.creditFor === credit).map((s) => s.number)) + 1

export const reservationLabel = (code: number) => `Reserva R-${String(code).padStart(4, '0')}`

/** «Factura B 0001-00000012»; una reserva todavía sin cobrar se nombra por su código. */
export const invoiceLabel = (s: Pick<Sale, 'invoiceType' | 'number'> & { reservationCode?: number | null; creditFor?: string | null }) =>
  !s.number && s.reservationCode
    ? reservationLabel(s.reservationCode)
    : `${s.creditFor ? `Nota de crédito ${s.invoiceType}` : s.invoiceType === 'X' ? 'Comprobante X' : `Factura ${s.invoiceType}`} 0001-${String(s.number).padStart(8, '0')}`

/** Una reserva vencida (pasó su fecha y sigue sin retirar). */
export const isExpired = (s: Sale, now = Date.now()) => s.status === 'reservada' && !!s.expiresAt && Date.parse(s.expiresAt) < now

// ── Pedidos de la tienda (reservas) ────────────────────────────────────────────
export const ordersApi = {
  /** Reservas pendientes y las resueltas en los últimos 60 días. */
  async list(): Promise<Sale[]> {
    if (cloud) return rpc('list_reservations')
    requirePermission('pedidos.gestionar')
    const from = Date.now() - 60 * 86_400_000
    return (await loadDb()).sales
      .filter((s) => s.reservationCode && (s.status === 'reservada' || Date.parse(s.reservedAt ?? s.at) > from))
      .sort((a, b) => Date.parse(b.reservedAt ?? b.at) - Date.parse(a.reservedAt ?? a.at))
      .map(safeSale)
  },

  /** Retiró y pagó: recién ahora es venta, recibe número de comprobante y cuenta en reportes con fecha de hoy. */
  async complete(id: string, paymentMethod: PaymentMethod): Promise<Sale> {
    if (cloud) return rpc('reservation_complete', { p_id: id, p_payment: paymentMethod })
    requirePermission('pedidos.gestionar')
    if (!PAYMENT_IDS.includes(paymentMethod)) throw new ApiError(400, 'Medio de pago inválido')
    const db = await loadDb()
    const sale = db.sales.find((s) => s.id === id)
    if (!sale) throw new ApiError(404, 'La reserva ya no existe')
    if (sale.status !== 'reservada') throw new ApiError(409, 'Esta reserva ya se resolvió')
    sale.number = nextInvoiceNumber(db.sales, sale.invoiceType)
    sale.status = 'completada'
    sale.at = new Date().toISOString()
    sale.paymentMethod = paymentMethod
    sale.userId = currentUser()?.id ?? null
    await save('sales')
    await audit(sale.test ? 'Reserva de prueba retirada' : 'Reserva retirada', `${reservationLabel(sale.reservationCode!)} → ${invoiceLabel(sale)} · ${formatPrice(sale.total)}`)
    return safeSale(sale)
  },

  /** Cancela la reserva (no vino, se arrepintió, venció): el stock vuelve y queda guardada como cancelada. */
  async cancel(id: string, reason: string): Promise<Sale> {
    if (cloud) return rpc('reservation_cancel', { p_id: id, p_reason: reason })
    requirePermission('pedidos.gestionar')
    if (!reason.trim()) throw new ApiError(400, 'Indica por qué se cancela')
    const db = await loadDb()
    const sale = db.sales.find((s) => s.id === id)
    if (!sale) throw new ApiError(404, 'La reserva ya no existe')
    if (sale.status !== 'reservada') throw new ApiError(409, 'Esta reserva ya se resolvió')
    sale.status = 'cancelada'
    sale.voidedAt = new Date().toISOString()
    sale.voidReason = reason.trim()
    for (const i of sale.items) {
      const p = db.products.find((x) => x.id === i.productId)
      if (!p) continue
      p.stock += i.qty
      p.updatedAt = sale.voidedAt
      db.movements.unshift({ id: uid('mov'), productId: p.id, date: sale.voidedAt, delta: i.qty, reason: 'venta', userId: currentUser()?.id, note: `${reservationLabel(sale.reservationCode!)} cancelada` })
    }
    await Promise.all([save('products'), save('movements'), save('sales')])
    await audit('Reserva cancelada', `${reservationLabel(sale.reservationCode!)} · ${sale.customer.name} · Motivo: ${sale.voidReason}`)
    return safeSale(sale)
  },

  /** Cancela de una vez todas las reservas vencidas. Devuelve cuántas liberó. */
  async releaseExpired(): Promise<number> {
    if (cloud) return rpc('reservation_release_expired')
    requirePermission('pedidos.gestionar')
    const expired = (await loadDb()).sales.filter((s) => isExpired(s))
    for (const s of expired) await ordersApi.cancel(s.id, 'Venció sin retirar')
    return expired.length
  },
}

/** Catálogo público para la tienda: solo lo necesario, sin costos ni proveedores. */
export async function publicCatalog(): Promise<{
  products: Pick<Product, 'id' | 'sku' | 'name' | 'categoryId' | 'price' | 'stock' | 'ageMin' | 'batteries' | 'brand' | 'photos' | 'seasons' | 'description' | 'features'>[]
  categories: Category[]
  seasons: Season[]
  discounts: Discount[]
}> {
  if (cloud) return rpc('public_catalog')
  const db = await loadDb()
  return {
    products: db.products
      .filter((p) => p.stock > 0)
      .map(({ id, sku, name, categoryId, price, stock, ageMin, batteries, brand, photos, seasons, description, features }) => ({ id, sku, name, categoryId, price, stock, ageMin, batteries, brand, photos, seasons, description: description ?? '', features: features ?? [] })),
    categories: structuredClone(db.categories),
    seasons: structuredClone(db.seasons),
    discounts: db.discounts.filter((d) => d.kind !== 'cupon'),
  }
}

// ── Cambios y devoluciones ─────────────────────────────────────────────────────
export interface ExchangeInput {
  saleId: string
  /** Lo que trae el cliente. restock=false si vino dañado (no vuelve al stock; su costo es pérdida). */
  returns: { productId: string; qty: number; restock: boolean }[]
  /** Lo que se lleva a cambio (vacío = devolución de dinero). */
  items: { productId: string; qty: number }[]
  paymentMethod: PaymentMethod
  reason?: string
}

/** Unidades ya devueltas de cada producto de una venta. */
function returnedOf(sales: Sale[], saleId: string) {
  const out: Record<string, number> = {}
  for (const n of sales) if (n.creditFor === saleId) for (const i of n.items) out[i.productId] = (out[i.productId] ?? 0) - i.qty
  return out
}

export const returnsApi = {
  /** Ventas cobradas de los últimos 180 días por número, nombre o documento (máx. 10). */
  async search(q: string): Promise<Sale[]> {
    if (cloud) return rpc('sales_for_return', { p_q: q })
    requirePermission('ventas.devolver')
    const t = q.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    // Un número de ticket puede ser de un solo dígito; un nombre necesita al menos 2 letras.
    if (!digits && t.length < 2) return []
    const num = digits ? Number(digits.slice(-8)) : NaN
    const from = Date.now() - 180 * 86_400_000
    const db = await loadDb()
    return db.sales
      .filter((x) => x.status === 'completada' && !x.creditFor && Date.parse(x.at) > from)
      .filter((x) => (digits && (x.number === num || x.customer.doc === digits || x.reservationCode === Number(digits))) || x.customer.name.toLowerCase().includes(t))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 10)
      .map((x) => ({ ...safeSale(x), returned: returnedOf(db.sales, x.id) }))
  },

  /**
   * Devolución (nota de crédito con importes negativos) y, si se lleva algo, la venta nueva:
   * mismo medio de pago, así el neto es lo que paga o recibe. Todo o nada.
   */
  async exchange(input: ExchangeInput): Promise<{ credit: Sale; sale: Sale | null }> {
    if (cloud) return rpc('exchange', { p: input })
    requirePermission('ventas.devolver')
    if (!PAYMENT_IDS.includes(input.paymentMethod)) throw new ApiError(400, 'Medio de pago inválido')
    if (!input.returns.length) throw new ApiError(400, 'Elige qué devuelve el cliente')
    const db = await loadDb()
    const o = db.sales.find((x) => x.id === input.saleId)
    if (!o) throw new ApiError(404, 'La venta original ya no existe')
    if (o.status !== 'completada' || o.creditFor) throw new ApiError(409, 'Solo se puede devolver de una venta cobrada')
    const returned = returnedOf(db.sales, o.id)
    const items: SaleItem[] = []
    for (const line of input.returns) {
      if (!Number.isInteger(line.qty) || line.qty <= 0) throw new ApiError(400, 'Cantidad inválida')
      const it = o.items.find((i) => i.productId === line.productId)
      if (!it) throw new ApiError(400, 'Ese producto no está en la venta original')
      const left = it.qty - (returned[it.productId] ?? 0)
      if (line.qty > left) throw new ApiError(409, `De «${it.name}» se pueden devolver ${left}`)
      items.push({ ...it, qty: -line.qty, restock: line.restock, unitCost: line.restock ? it.unitCost : 0 })
    }
    // Antes de tocar nada, que la venta nueva sea posible (stock): si no, no se hace la devolución.
    for (const l of input.items) {
      const p = db.products.find((x) => x.id === l.productId)
      if (!p) throw new ApiError(404, 'Un producto del cambio ya no existe')
      if (l.qty > p.stock) throw new ApiError(409, `Solo quedan ${p.stock} de «${p.name}»`)
    }
    const sub = round2(-items.reduce((a, i) => a + i.unitPrice * i.qty, 0))
    const tot = round2(round2(-items.reduce((a, i) => a + i.unitFinal * i.qty, 0)) * (1 - o.couponPercent / 100))
    const credit: Sale = {
      id: uid('nc'),
      number: nextInvoiceNumber(db.sales, o.invoiceType, true),
      invoiceType: o.invoiceType,
      at: new Date().toISOString(),
      channel: 'mostrador',
      customer: o.customer,
      items,
      subtotal: -sub,
      couponCode: o.couponCode,
      couponPercent: o.couponPercent,
      discountTotal: -round2(sub - tot),
      total: -tot,
      iva: -ivaContained(tot, db.settings[0].ivaRate),
      paymentMethod: input.paymentMethod,
      status: 'completada',
      test: o.test,
      userId: currentUser()?.id ?? null,
      creditFor: o.id,
      creditForLabel: invoiceLabel(o),
      voidReason: input.reason?.trim() || undefined,
    }
    for (const i of items) {
      if (!i.restock) continue
      const p = db.products.find((x) => x.id === i.productId)
      if (!p) continue
      p.stock -= i.qty
      p.updatedAt = credit.at
      db.movements.unshift({ id: uid('mov'), productId: p.id, date: credit.at, delta: -i.qty, reason: 'venta', userId: credit.userId ?? undefined, note: `Devolución ${invoiceLabel(credit)}` })
    }
    db.sales.unshift(credit)
    await Promise.all([save('products'), save('movements'), save('sales')])
    const sale = input.items.length
      ? await salesApi.checkout({ channel: 'mostrador', items: input.items, customer: o.customer, paymentMethod: input.paymentMethod, invoiceType: o.invoiceType, test: o.test })
      : null
    await audit(
      sale ? 'Cambio' : 'Devolución',
      `${invoiceLabel(credit)} sobre ${invoiceLabel(o)} · ${formatPrice(tot)}${sale ? ` · se lleva ${invoiceLabel(sale)} por ${formatPrice(sale.total)}` : ''}${credit.voidReason ? ` · Motivo: ${credit.voidReason}` : ''}`,
    )
    return { credit: safeSale(credit), sale }
  },
}

// ── Cierre de caja ─────────────────────────────────────────────────────────────
/** Comienzo del día de hoy (hora local), para el primer turno si nunca se cerró la caja. */
const todayStart = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}

function localCashStatus(db: Awaited<ReturnType<typeof loadDb>>): CashStatus {
  const last = [...db.closings].sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))[0]
  const from = last?.closedAt ?? todayStart()
  const to = new Date().toISOString()
  const inP = (t?: string) => !!t && t >= from && t < to
  const map = new Map<PaymentMethod, CashMethodTotal>()
  const row = (m: PaymentMethod) => map.get(m) ?? (map.set(m, { method: m, amount: 0, sales: 0, refunds: 0, voids: 0 }), map.get(m)!)
  for (const x of db.sales) {
    if (x.test) continue
    if (x.status === 'completada' && inP(x.at)) {
      const r = row(x.paymentMethod)
      r.amount = round2(r.amount + x.total)
      if (x.creditFor) r.refunds++
      else r.sales++
    } else if (x.status === 'anulada' && inP(x.voidedAt) && x.at < from) {
      const r = row(x.paymentMethod)
      r.amount = round2(r.amount - x.total)
      r.voids++
    }
  }
  const byMethod = [...map.values()].sort((a, b) => a.method.localeCompare(b.method))
  return { from, to, openingCash: last?.keptCash ?? 0, byMethod, cashNet: map.get('efectivo')?.amount ?? 0, lastClosedBy: last?.userName ?? null }
}

export const cashApi = {
  /** Turno abierto: lo que entró y salió por medio de pago desde el último cierre. */
  async status(): Promise<CashStatus> {
    if (cloud) return rpc('cash_status')
    requirePermission('caja.cerrar')
    return localCashStatus(await loadDb())
  },

  /** Cierra el turno: lo esperado, lo contado y la diferencia. Lo que queda en caja es el fondo del próximo. */
  async close(opening: number, counted: number, kept: number, note: string): Promise<CashClosing> {
    if (cloud) return rpc('cash_close', { p_opening: opening, p_counted: counted, p_kept: kept, p_note: note })
    requirePermission('caja.cerrar')
    if (!(opening >= 0)) throw new ApiError(400, 'El fondo inicial no puede ser negativo')
    if (!(counted >= 0)) throw new ApiError(400, 'Escribe cuánto efectivo contaste')
    if (!(kept >= 0) || kept > counted) throw new ApiError(400, 'Lo que queda en caja tiene que estar entre 0 y lo contado')
    const db = await loadDb()
    const st = localCashStatus(db)
    const expected = round2(opening + st.cashNet)
    const c: CashClosing = {
      id: uid('caja'),
      openedAt: st.from,
      closedAt: st.to,
      userId: currentUser()?.id ?? null,
      userName: currentUser()?.name ?? 'Usuario',
      openingCash: round2(opening),
      byMethod: st.byMethod,
      salesCount: st.byMethod.reduce((a, m) => a + m.sales, 0),
      refundsCount: st.byMethod.reduce((a, m) => a + m.refunds, 0),
      expectedCash: expected,
      countedCash: round2(counted),
      difference: round2(counted - expected),
      keptCash: round2(kept),
      note: note.trim(),
    }
    db.closings.unshift(c)
    await save('closings')
    const d = c.difference
    await audit('Cierre de caja', `Esperado ${formatPrice(c.expectedCash)} · contado ${formatPrice(c.countedCash)} · ${d === 0 ? 'sin diferencia' : d > 0 ? `sobran ${formatPrice(d)}` : `faltan ${formatPrice(-d)}`}`)
    return structuredClone(c)
  },

  async list(): Promise<CashClosing[]> {
    if (cloud) return rpc('list_cash_closings')
    requirePermission('caja.historial')
    return structuredClone((await loadDb()).closings.slice(0, 200))
  },
}
