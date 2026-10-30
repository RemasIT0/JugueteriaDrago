import type { Product, Sale, Settings } from '@/types'

export type Granularity = 'dia' | 'semana' | 'mes' | 'anio'

const DAY = 86_400_000
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
/** Las semanas empiezan el lunes. */
const weekStart = (d: Date) => {
  const s = dayStart(d)
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  return s
}

export function bucketStart(d: Date, g: Granularity) {
  if (g === 'dia') return dayStart(d)
  if (g === 'semana') return weekStart(d)
  if (g === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1)
  return new Date(d.getFullYear(), 0, 1)
}

function step(d: Date, g: Granularity, n: number) {
  const x = new Date(d)
  if (g === 'dia') x.setDate(x.getDate() + n)
  else if (g === 'semana') x.setDate(x.getDate() + 7 * n)
  else if (g === 'mes') x.setMonth(x.getMonth() + n)
  else x.setFullYear(x.getFullYear() + n)
  return x
}

const COUNT: Record<Granularity, number> = { dia: 14, semana: 12, mes: 12, anio: 5 }
const short = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })
const monthFmt = new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' })

export function bucketLabel(d: Date, g: Granularity) {
  if (g === 'dia') return short.format(d)
  if (g === 'semana') return `Sem ${short.format(d)}`
  if (g === 'mes') return monthFmt.format(d)
  return String(d.getFullYear())
}

export const completed = (sales: Sale[], includeTests: boolean) => sales.filter((s) => s.status === 'completada' && (includeTests || !s.test))

export interface Bucket {
  key: string
  label: string
  total: number
  units: number
  count: number
  /** % del total del rango mostrado. */
  share: number
  /** Variación contra el período anterior (null si el anterior fue 0). */
  change: number | null
}

/** Ventas agrupadas en los últimos N períodos (14 días, 12 semanas, 12 meses o 5 años). */
export function buckets(sales: Sale[], g: Granularity, now = new Date()): Bucket[] {
  const first = step(bucketStart(now, g), g, -(COUNT[g] - 1))
  const list = Array.from({ length: COUNT[g] }, (_, i) => {
    const start = step(first, g, i)
    return { start, end: step(start, g, 1), total: 0, units: 0, count: 0 }
  })
  for (const s of sales) {
    const t = new Date(s.at)
    const b = list.find((x) => t >= x.start && t < x.end)
    if (!b) continue
    b.total += s.total
    b.count++
    b.units += s.items.reduce((a, i) => a + i.qty, 0)
  }
  const sum = list.reduce((a, b) => a + b.total, 0)
  return list.map((b, i) => ({
    key: b.start.toISOString(),
    label: bucketLabel(b.start, g),
    total: Math.round(b.total * 100) / 100,
    units: b.units,
    count: b.count,
    share: sum ? (b.total / sum) * 100 : 0,
    change: i > 0 && list[i - 1].total > 0 ? ((b.total - list[i - 1].total) / list[i - 1].total) * 100 : null,
  }))
}

/** Unidades e ingresos por producto en un rango; incluye los que no vendieron nada (para "menos vendidos"). */
export function productRanking(sales: Sale[], products: Product[], from: number) {
  const map = new Map<string, { id: string; name: string; units: number; revenue: number }>()
  for (const p of products) map.set(p.id, { id: p.id, name: p.name, units: 0, revenue: 0 })
  for (const s of sales) {
    if (new Date(s.at).getTime() < from) continue
    for (const i of s.items) {
      const row = map.get(i.productId) ?? { id: i.productId, name: i.name, units: 0, revenue: 0 }
      row.units += i.qty
      row.revenue += i.unitFinal * i.qty * (1 - s.couponPercent / 100)
      map.set(i.productId, row)
    }
  }
  const rows = [...map.values()]
  return {
    top: [...rows].filter((r) => r.units > 0).sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 5),
    bottom: [...rows].filter((r) => products.some((p) => p.id === r.id)).sort((a, b) => a.units - b.units || a.name.localeCompare(b.name, 'es')).slice(0, 5),
  }
}

export interface Balance {
  gross: number
  iva: number
  net: number
  cogs: number
  /** Ventas netas de ítems sin costo cargado (no entran en el margen). */
  netWithoutCost: number
  margin: number
  fixed: number
  result: number
  /** Margen de contribución sobre ventas netas (0–1), o null si no hay base para calcularlo. */
  contribution: number | null
}

/** Estado de resultados simple de un rango: ventas, IVA, costo de lo vendido, gastos fijos. */
export function balance(sales: Sale[], settings: Settings | undefined, from: number, to: number, monthsOfFixed: number): Balance {
  const rate = (settings?.ivaRate ?? 21) / 100
  let gross = 0
  let cogs = 0
  let netWithCost = 0
  let netWithoutCost = 0
  for (const s of sales) {
    const t = new Date(s.at).getTime()
    if (t < from || t >= to) continue
    gross += s.total
    const factor = 1 - s.couponPercent / 100
    for (const i of s.items) {
      const lineNet = (i.unitFinal * i.qty * factor) / (1 + rate)
      if (i.unitCost === null) netWithoutCost += lineNet
      else {
        netWithCost += lineNet
        cogs += i.unitCost * i.qty
      }
    }
  }
  const net = gross / (1 + rate)
  const fixed = (settings?.fixedCosts.reduce((a, c) => a + c.amount, 0) ?? 0) * monthsOfFixed
  const margin = netWithCost - cogs
  return {
    gross,
    iva: gross - net,
    net,
    cogs,
    netWithoutCost,
    margin,
    fixed,
    result: margin - fixed,
    contribution: netWithCost > 0 ? margin / netWithCost : null,
  }
}

/**
 * Punto de equilibrio mensual: cuánto hay que vender (con IVA) para cubrir los gastos fijos.
 * Usa el margen de contribución real de los últimos 90 días; si todavía no hay ventas con costo,
 * usa el margen promedio del catálogo (precio vs costo).
 */
export function breakEven(sales: Sale[], products: Product[], settings: Settings | undefined, now = new Date()) {
  const rate = (settings?.ivaRate ?? 21) / 100
  const fixed = settings?.fixedCosts.reduce((a, c) => a + c.amount, 0) ?? 0
  const recent = balance(sales, settings, now.getTime() - 90 * DAY, now.getTime() + 1, 0)
  let ratio = recent.contribution
  let source: 'ventas' | 'catalogo' | null = ratio !== null ? 'ventas' : null
  if (ratio === null) {
    const withCost = products.filter((p) => p.cost !== null && p.price > 0)
    if (withCost.length) {
      const net = withCost.reduce((a, p) => a + p.price / (1 + rate), 0)
      const cost = withCost.reduce((a, p) => a + (p.cost ?? 0), 0)
      ratio = net > 0 ? (net - cost) / net : null
      source = 'catalogo'
    }
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthSales = sales.filter((s) => new Date(s.at) >= monthStart)
  const soldThisMonth = monthSales.reduce((a, s) => a + s.total, 0)
  const target = ratio && ratio > 0 ? (fixed / ratio) * (1 + rate) : null
  // Acumulado por día del mes, para la línea contra el objetivo.
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  let acc = 0
  const daily = Array.from({ length: days }, (_, i) => {
    const d0 = new Date(now.getFullYear(), now.getMonth(), i + 1).getTime()
    const d1 = d0 + DAY
    acc += monthSales.filter((s) => {
      const t = new Date(s.at).getTime()
      return t >= d0 && t < d1
    }).reduce((a, s) => a + s.total, 0)
    return { day: i + 1, acumulado: d0 <= now.getTime() ? Math.round(acc) : null }
  })
  return { fixed, ratio, source, target, soldThisMonth, progress: target ? soldThisMonth / target : null, daily }
}
