/**
 * Asistente con respuestas calculadas sobre los datos de la tienda (sin IA externa).
 * Cada intención tiene palabras clave para reconocer preguntas escritas a mano y el
 * permiso que hace falta, así un vendedor no ve montos de dinero.
 */
import { planSeasons } from '@/lib/forecast'
import { formatDate, formatPrice, formatTime, stockLevel } from '@/lib/format'
import { can, type Permission } from '@/lib/permissions'
import { realMargin } from '@/lib/pricing'
import { breakEven, completed, productRanking } from '@/lib/salesStats'
import { productsApi } from '@/services/api'
import { userNames } from '@/services/auth'
import type { Product, Role, Sale, Season, Settings } from '@/types'

export interface Answer {
  text: string
  items?: { label: string; value: string; productId?: string }[]
  link?: { to: string; label: string }
}

export interface Ctx {
  products: Product[]
  sales: Sale[]
  seasons: Season[]
  settings: Settings | undefined
}

export interface Intent {
  id: string
  question: string
  keywords: string[]
  perm: Permission
  answer: (ctx: Ctx) => Promise<Answer> | Answer
}

const DAY = 86_400_000
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`

export const INTENTS: Intent[] = [
  {
    id: 'quien-bajo',
    question: '¿Quién bajó el stock esta semana?',
    keywords: ['quien', 'bajo', 'bajó', 'stock', 'desconto', 'saco', 'resto'],
    perm: 'inventario.ver',
    async answer({ products }) {
      const [moves, names] = await Promise.all([productsApi.recentMovements(7), userNames()])
      const down = moves.filter((m) => m.delta < 0)
      if (!down.length) return { text: 'En los últimos 7 días nadie bajó stock: no hubo ventas, ajustes ni mermas.' }
      const by = new Map<string, { units: number; reasons: Set<string> }>()
      for (const m of down) {
        const who = m.userId ? (names[m.userId] ?? 'Usuario eliminado') : m.reason === 'venta' ? 'Tienda online (cliente)' : 'Sistema'
        const row = by.get(who) ?? { units: 0, reasons: new Set() }
        row.units += -m.delta
        row.reasons.add(m.reason === 'venta' ? 'ventas' : m.reason === 'ajuste' ? 'ajustes' : m.reason)
        by.set(who, row)
      }
      const last = down[0]
      const lastProduct = products.find((p) => p.id === last.productId)?.name ?? 'un producto'
      return {
        text: `En los últimos 7 días bajaron ${plural(down.reduce((a, m) => a - m.delta, 0), 'unidad', 'unidades')}. El último fue ${lastProduct} (${formatDate(last.date)} ${formatTime(last.date)}).`,
        items: [...by.entries()].sort((a, b) => b[1].units - a[1].units).map(([who, r]) => ({ label: who, value: `−${r.units} u · ${[...r.reasons].join(', ')}` })),
        link: { to: '/actividad', label: 'Ver actividad completa' },
      }
    },
  },
  {
    id: 'ajustes',
    question: '¿Quién hizo ajustes o mermas este mes?',
    keywords: ['ajuste', 'ajustes', 'merma', 'mermas', 'roto', 'dañado', 'perdida'],
    perm: 'actividad.ver',
    async answer({ products }) {
      const [moves, names] = await Promise.all([productsApi.recentMovements(30), userNames()])
      const adj = moves.filter((m) => m.reason === 'ajuste')
      if (!adj.length) return { text: 'No hubo ajustes manuales de stock en los últimos 30 días.' }
      return {
        text: `Hubo ${plural(adj.length, 'ajuste')} en 30 días (${adj.reduce((a, m) => a + Math.min(0, m.delta), 0)} u netas hacia abajo).`,
        items: adj.slice(0, 8).map((m) => ({
          label: `${names[m.userId ?? ''] ?? 'Sistema'} · ${products.find((p) => p.id === m.productId)?.name ?? 'producto eliminado'}`,
          value: `${m.delta > 0 ? '+' : ''}${m.delta} u · ${m.note ?? 'sin motivo'}`,
          productId: m.productId,
        })),
      }
    },
  },
  {
    id: 'reponer',
    question: '¿Qué productos tengo que reponer?',
    keywords: ['reponer', 'reposicion', 'falta', 'faltan', 'bajo', 'minimo', 'comprar', 'pedir'],
    perm: 'inventario.ver',
    answer({ products }) {
      const low = products.filter((p) => stockLevel(p) === 'bajo').sort((a, b) => a.stock - b.stock)
      if (!low.length) return { text: 'Nada para reponer: todos los productos están sobre su stock mínimo. 🎉' }
      return {
        text: `Hay ${plural(low.length, 'producto')} en o bajo su mínimo.`,
        items: low.slice(0, 10).map((p) => ({ label: p.name, value: `${p.stock} / mín ${p.minStock}`, productId: p.id })),
        link: { to: '/', label: 'Ver inventario (ordenado por urgencia)' },
      }
    },
  },
  {
    id: 'agotados',
    question: '¿Qué productos están agotados?',
    keywords: ['agotado', 'agotados', 'sin stock', 'cero'],
    perm: 'inventario.ver',
    answer({ products }) {
      const out = products.filter((p) => p.stock <= 0)
      if (!out.length) return { text: 'No hay productos agotados.' }
      return { text: `${plural(out.length, 'producto agotado', 'productos agotados')}.`, items: out.map((p) => ({ label: p.name, value: p.sku, productId: p.id })) }
    },
  },
  {
    id: 'ventas-hoy',
    question: '¿Cuánto vendí hoy y este mes?',
    keywords: ['cuanto', 'vendi', 'vendí', 'ventas', 'hoy', 'mes', 'facture', 'recaude'],
    perm: 'ventas.ver',
    answer({ sales }) {
      const done = completed(sales, false)
      const today = new Date()
      const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
      const m0 = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
      const day = done.filter((s) => new Date(s.at).getTime() >= d0)
      const month = done.filter((s) => new Date(s.at).getTime() >= m0)
      const tests = sales.filter((s) => s.test && s.status === 'completada').length
      return {
        text: `Hoy: ${formatPrice(day.reduce((a, s) => a + s.total, 0))} en ${plural(day.length, 'venta')}. Este mes: ${formatPrice(month.reduce((a, s) => a + s.total, 0))} en ${plural(month.length, 'venta')}.${tests ? ` (Sin contar ${plural(tests, 'compra de prueba', 'compras de prueba')}.)` : ''}`,
        link: { to: '/reportes', label: 'Ver gráficos de ventas' },
      }
    },
  },
  {
    id: 'mas-vendidos',
    question: '¿Qué se vendió más esta semana?',
    keywords: ['mas vendido', 'mas vendidos', 'top', 'exito', 'sale mas', 'mejor', 'vendio mas'],
    perm: 'ventas.ver',
    answer({ sales, products }) {
      const { top } = productRanking(completed(sales, true), products, Date.now() - 7 * DAY)
      if (!top.length) return { text: 'Esta semana todavía no hubo ventas.' }
      return { text: `Lo más vendido de los últimos 7 días:`, items: top.map((r) => ({ label: r.name, value: `${r.units} u · ${formatPrice(r.revenue)}`, productId: r.id })) }
    },
  },
  {
    id: 'menos-vendidos',
    question: '¿Qué productos no se venden?',
    keywords: ['menos vendido', 'no se vende', 'no salen', 'quieto', 'rotacion', 'clavado'],
    perm: 'ventas.ver',
    answer({ sales, products }) {
      const { bottom } = productRanking(completed(sales, true), products, Date.now() - 30 * DAY)
      return {
        text: 'Los que menos salieron en los últimos 30 días (candidatos a promoción):',
        items: bottom.map((r) => ({ label: r.name, value: `${r.units} u`, productId: r.id })),
        link: { to: '/descuentos', label: 'Crear un descuento' },
      }
    },
  },
  {
    id: 'temporada',
    question: '¿Qué reponer para la próxima temporada?',
    keywords: ['temporada', 'navidad', 'reyes', 'infancias', 'dia del niño', 'dia del nino', 'fecha'],
    perm: 'temporadas.ver',
    answer({ seasons, products, sales }) {
      const next = planSeasons(seasons, products, sales)[0]
      if (!next) return { text: 'No hay temporadas configuradas.' }
      if (!next.items.length) return { text: `${next.season.name} es en ${plural(next.days, 'día')} y con el stock actual alcanza.`, link: { to: '/temporadas', label: 'Ver temporadas' } }
      return {
        text: `${next.season.name} es en ${plural(next.days, 'día')}. Conviene pedir ${next.items.reduce((a, i) => a + i.suggested, 0)} u:`,
        items: next.items.slice(0, 8).map((i) => ({ label: i.product.name, value: `+${i.suggested} u`, productId: i.product.id })),
        link: { to: '/temporadas', label: 'Ver plan completo' },
      }
    },
  },
  {
    id: 'equilibrio',
    question: '¿Llego al punto de equilibrio este mes?',
    keywords: ['equilibrio', 'gastos', 'ganancia', 'pierdo', 'perdida', 'cubro', 'rentable'],
    perm: 'ventas.ver',
    answer({ sales, products, settings }) {
      const be = breakEven(completed(sales, false), products, settings)
      if (be.fixed === 0) return { text: 'Todavía no cargaste gastos fijos. Agrégalos en Reportes para calcular el punto de equilibrio.', link: { to: '/reportes', label: 'Ir a Reportes' } }
      if (be.target === null) return { text: 'Falta el precio de compra de los productos para calcular el margen.' }
      const p = (be.progress ?? 0) * 100
      return {
        text:
          p >= 100
            ? `¡Sí! Ya vendiste ${formatPrice(be.soldThisMonth)} y el equilibrio es ${formatPrice(be.target)}. Todo lo que vendas de acá en más es ganancia.`
            : `Vas ${p.toFixed(0)}%: vendiste ${formatPrice(be.soldThisMonth)} de ${formatPrice(be.target)}. Faltan ${formatPrice(be.target - be.soldThisMonth)} para cubrir los gastos fijos.`,
        link: { to: '/reportes', label: 'Ver gráfico' },
      }
    },
  },
  {
    id: 'sin-costo',
    question: '¿Qué productos no tienen precio de compra?',
    keywords: ['precio de compra', 'costo', 'sin costo', 'compra'],
    perm: 'costos.ver',
    answer({ products }) {
      const miss = products.filter((p) => p.cost === null)
      if (!miss.length) return { text: 'Todos los productos tienen precio de compra cargado.' }
      return { text: `${plural(miss.length, 'producto')} sin precio de compra (no entran en márgenes):`, items: miss.slice(0, 10).map((p) => ({ label: p.name, value: p.sku, productId: p.id })) }
    },
  },
  {
    id: 'margen-bajo',
    question: '¿Qué productos dejan poco margen?',
    keywords: ['margen', 'poco margen', 'ganancia baja', 'barato'],
    perm: 'costos.ver',
    answer({ products }) {
      const rows = products
        .map((p) => ({ p, m: realMargin(p.price, p.cost) }))
        .filter((r): r is { p: Product; m: number } => r.m !== null && r.m < 25)
        .sort((a, b) => a.m - b.m)
      if (!rows.length) return { text: 'Ningún producto con costo cargado deja menos de 25% de margen.' }
      return { text: 'Productos con menos de 25% de margen sobre el precio de venta:', items: rows.slice(0, 10).map(({ p, m }) => ({ label: p.name, value: `${m.toFixed(0)}%`, productId: p.id })) }
    },
  },
]

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ¿?¡!]/g, '')
    .toLowerCase()

export const intentsFor = (role: Role | undefined) => INTENTS.filter((i) => can(role, i.perm))

/** La intención con más palabras clave presentes en la pregunta. */
export function matchIntent(text: string, role: Role | undefined): Intent | null {
  const t = norm(text)
  let best: { i: Intent; score: number } | null = null
  for (const i of intentsFor(role)) {
    const score = i.keywords.reduce((a, k) => a + (t.includes(norm(k)) ? k.split(' ').length : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { i, score }
  }
  return best?.i ?? null
}
