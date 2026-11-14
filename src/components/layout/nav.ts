import { LuWallet, LuBadgePercent, LuShoppingBag, LuCalendarHeart, LuScanBarcode, LuChartColumn, LuBoxes, LuHistory, LuReceiptText, LuShapes, LuTruck, LuUsers, LuZap } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import type { Permission } from '@/lib/permissions'
import type { BoardColor } from '@/types'

export type NavItem = { to: string; label: string; /** Nombre corto para la barra inferior del celular. */ short?: string; icon: IconType; perm: Permission; color: BoardColor; group: string; admin?: boolean }

/** El menú es un tablero: cada sección es una casilla de su color, unidas por un camino. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Inventario', icon: LuBoxes, perm: 'inventario.ver', color: 'turquesa', group: 'Tienda' },
  { to: '/vender', label: 'Vender', icon: LuScanBarcode, perm: 'ventas.crear', color: 'hoja', group: 'Tienda' },
  { to: '/pedidos', label: 'Pedidos online', short: 'Pedidos', icon: LuShoppingBag, perm: 'pedidos.gestionar', color: 'cielo', group: 'Tienda' },
  { to: '/carga', label: 'Cargar productos', short: 'Cargar', icon: LuZap, perm: 'productos.crear', color: 'sol', group: 'Tienda' },
  { to: '/temporadas', label: 'Temporadas', icon: LuCalendarHeart, perm: 'temporadas.ver', color: 'coral', group: 'Tienda' },
  { to: '/caja', label: 'Cierre de caja', short: 'Caja', icon: LuWallet, perm: 'caja.cerrar', color: 'sol', group: 'Negocio' },
  { to: '/reportes', label: 'Reportes', icon: LuChartColumn, perm: 'reportes.ver', color: 'cielo', group: 'Negocio' },
  { to: '/facturacion', label: 'Facturación', icon: LuReceiptText, perm: 'facturacion.ver', color: 'hoja', group: 'Negocio' },
  { to: '/descuentos', label: 'Descuentos', icon: LuBadgePercent, perm: 'descuentos.gestionar', color: 'coral', group: 'Negocio' },
  { to: '/categorias', label: 'Categorías', icon: LuShapes, perm: 'categorias.ver', color: 'lila', group: 'Catálogo' },
  { to: '/proveedores', label: 'Proveedores', icon: LuTruck, perm: 'proveedores.ver', color: 'cielo', group: 'Catálogo' },
  { to: '/usuarios', label: 'Usuarios', icon: LuUsers, perm: 'usuarios.gestionar', color: 'lila', group: 'Administración', admin: true },
  { to: '/actividad', label: 'Actividad', icon: LuHistory, perm: 'actividad.ver', color: 'turquesa', group: 'Administración', admin: true },
]
