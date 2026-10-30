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
  stock: number
  minStock: number
  ageMin: number
  batteries: boolean
  brand: string
  /** URLs de fotos; la primera es la principal. */
  photos: string[]
  loteId: string | null
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
