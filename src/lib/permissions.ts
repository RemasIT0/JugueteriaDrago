import type { Role } from '@/types'

/**
 * Qué puede hacer cada rol. Se consulta en la interfaz (para no mostrar lo que no se puede usar)
 * y otra vez en la capa de datos (para que no alcance con ocultar un botón).
 */
const MATRIX = {
  'inventario.ver': ['dueno', 'vendedor'],
  'productos.crear': ['dueno', 'vendedor'],
  'productos.reponer': ['dueno', 'vendedor'],
  'productos.fotos': ['dueno', 'vendedor'],
  // Cambiar stock a mano o borrar puede ocultar faltantes: solo el dueño.
  'stock.ajustar': ['dueno'],
  'productos.eliminar': ['dueno'],
  'productos.importar': ['dueno'],
  'proveedores.ver': ['dueno', 'vendedor'],
  'categorias.ver': ['dueno', 'vendedor'],
  'reportes.ver': ['dueno'],
  'usuarios.gestionar': ['dueno'],
  'actividad.ver': ['dueno'],
  'respaldo.gestionar': ['dueno'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof MATRIX

export const can = (role: Role | undefined, p: Permission) => !!role && (MATRIX[p] as readonly Role[]).includes(role)

export const ROLE_LABEL: Record<Role, string> = { dueno: 'Dueño', vendedor: 'Vendedor' }
