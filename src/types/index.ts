/** Colores de casilla disponibles para categorías (ver tailwind.config.js). */
export type BoardColor = 'sol' | 'coral' | 'turquesa' | 'lila' | 'hoja' | 'cielo'

export type StockLevel = 'bajo' | 'medio' | 'alto'

export interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  supplierId: string | null
  price: number
  /** Precio de compra (costo). null = todavía no se cargó: no entra en márgenes. */
  cost: number | null
  /** Temporadas a las que pertenece (ids de Season). */
  seasons: string[]
  stock: number
  minStock: number
  ageMin: number
  batteries: boolean
  brand: string
  /** URLs de fotos; la primera es la principal. */
  photos: string[]
  loteId: string | null
  /** Ficha para la tienda: texto libre que lee el cliente. Vacío = sin ficha. */
  description?: string
  /** Ficha para la tienda: puntos cortos (material, medidas, qué incluye…). */
  features?: string[]
  createdAt: string
  updatedAt: string
}

/** Lo que el formulario envía; el resto lo completa el servicio. */
export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'photos'> & {
  photos?: string[]
}

/** Producto en pantalla: puede estar guardándose todavía o haber fallado. */
export interface ProductRow extends Product {
  syncState?: 'saving' | 'error'
}

export interface Category {
  id: string
  name: string
  color: BoardColor
  /** Plantilla inteligente: valores que se pre-llenan al elegir la categoría. */
  defaults: Partial<Pick<Product, 'ageMin' | 'batteries' | 'minStock'>>
  /** Margen sugerido sobre el costo (%), para el precio recomendado. Si falta, usa el general. */
  marginTarget?: number
}

export interface Supplier {
  id: string
  name: string
  contact: string
  phone: string
  email: string
}

export interface StockMovement {
  id: string
  productId: string
  date: string
  delta: number
  reason: 'alta' | 'ingreso' | 'venta' | 'ajuste'
  /** Quién lo hizo (id de usuario) y nota opcional. */
  userId?: string
  note?: string
}

// ── Usuarios, permisos y auditoría ──────────────────────────────────────────────

export type Role = 'dueno' | 'vendedor'

export interface User {
  id: string
  username: string
  name: string
  role: Role
  active: boolean
  /** PBKDF2-SHA256 en base64; nunca se guarda la contraseña. */
  passwordHash: string
  salt: string
  createdAt: string
  lastLoginAt?: string
}

export type PublicUser = Omit<User, 'passwordHash' | 'salt'>

export interface AuditEntry {
  id: string
  at: string
  userId: string | null
  userName: string
  action: string
  detail: string
}

export interface LoteEntry {
  id: string
  kind: 'nuevo' | 'reposicion'
  productId: string
  sku: string
  name: string
  categoryId: string
  qty: number
  /** Stock y mínimo al guardar, para pintar los pips sin depender del inventario cargado. */
  stock?: number
  minStock?: number
  at: string
}

export interface Lote {
  id: string
  supplierId: string | null
  goal: number
  startedAt: string
  entries: LoteEntry[]
}

// ── Temporadas, descuentos, ventas y ajustes ──────────────────────────────────────

/** Fecha que se repite cada año: día fijo o «n-ésimo día de la semana del mes». */
export type SeasonRule = { type: 'fija'; month: number; day: number } | { type: 'nesimo'; month: number; weekday: number; n: number }

export interface Season {
  id: string
  name: string
  color: BoardColor
  rule: SeasonRule
  /** Con cuántos días de anticipación avisar para reponer. */
  leadDays: number
}

export interface Discount {
  id: string
  name: string
  kind: 'producto' | 'categoria' | 'temporada' | 'cupon'
  /** Producto, categoría o temporada a la que aplica (no en cupones). */
  targetId: string | null
  /** Solo "producto": todos los productos elegidos (los descuentos viejos solo tienen targetId). */
  targetIds?: string[]
  /** Solo cupones: código que escribe el cliente. */
  code: string | null
  percent: number
  startsAt: string | null
  endsAt: string | null
  active: boolean
  createdAt: string
}

export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'mercadopago'
export type InvoiceType = 'A' | 'B' | 'X'

export interface SaleItem {
  productId: string
  sku: string
  name: string
  qty: number
  /** Precio de lista unitario al momento de vender. */
  unitPrice: number
  /** % de descuento aplicado al producto (promoción). */
  discountPercent: number
  /** Precio final unitario cobrado (con descuento, IVA incluido). */
  unitFinal: number
  /** Costo unitario al momento de vender (null si el producto no tenía costo). */
  unitCost: number | null
  /** En una nota de crédito: si el producto volvió al stock (false = vino dañado, su costo es pérdida). */
  restock?: boolean
}

export interface Sale {
  id: string
  /** Número correlativo del comprobante, por tipo. */
  number: number
  invoiceType: InvoiceType
  at: string
  channel: 'tienda' | 'mostrador'
  customer: { name: string; email: string; docType: 'DNI' | 'CUIT' | ''; doc: string }
  items: SaleItem[]
  subtotal: number
  couponCode: string | null
  couponPercent: number
  /** Total de descuentos (promociones + cupón). */
  discountTotal: number
  total: number
  /** IVA contenido en el total. */
  iva: number
  paymentMethod: PaymentMethod
  /**
   * reservada: pedido de la tienda que separa stock, sin cobrar ni numerar (no cuenta en reportes).
   * completada: venta cobrada con comprobante. anulada: venta cobrada que se anuló.
   * cancelada: reserva que no se retiró (el stock volvió).
   */
  status: 'reservada' | 'completada' | 'anulada' | 'cancelada'
  /** Fecha de anulación o cancelación. */
  voidedAt?: string
  voidReason?: string
  /** Solo pedidos de la tienda: código R-0001 que el cliente muestra al retirar. */
  reservationCode?: number | null
  reservedAt?: string | null
  /** Hasta cuándo se guarda la reserva. */
  expiresAt?: string | null
  /**
   * Nota de crédito (devolución): id de la venta original. Sus importes y cantidades son negativos,
   * así Reportes y ganancias restan solos.
   */
  creditFor?: string | null
  creditForLabel?: string | null
  /** Solo al buscar una venta para devolver: unidades ya devueltas por producto. */
  returned?: Record<string, number>
  /** Compra de prueba: se ve en reportes marcada y se puede excluir. */
  test: boolean
  userId: string | null
}

/** Totales de un medio de pago en un turno de caja. */
export interface CashMethodTotal {
  method: PaymentMethod
  /** Neto: ventas − devoluciones − anulaciones de turnos anteriores. */
  amount: number
  sales: number
  refunds: number
  voids: number
}

/** Turno de caja abierto: lo que entró y salió desde el último cierre. */
export interface CashStatus {
  from: string
  to: string
  /** Lo que se dejó en caja en el último cierre (fondo para este turno). */
  openingCash: number
  byMethod: CashMethodTotal[]
  cashNet: number
  lastClosedBy?: string | null
}

export interface CashClosing {
  id: string
  openedAt: string
  closedAt: string
  userId: string | null
  userName: string
  openingCash: number
  byMethod: CashMethodTotal[]
  salesCount: number
  refundsCount: number
  expectedCash: number
  countedCash: number
  /** Contado − esperado: positivo sobra, negativo falta. */
  difference: number
  keptCash: number
  note: string
}

export interface Settings {
  /** Gastos fijos mensuales (alquiler, sueldos, servicios…) para el punto de equilibrio. */
  fixedCosts: { id: string; name: string; amount: number }[]
  /** Margen general sobre el costo (%) para el precio recomendado. */
  defaultMargin: number
  ivaRate: number
  /** Datos del emisor para los comprobantes. */
  business: { name: string; cuit: string; address: string; ivaCondition: string }
}
