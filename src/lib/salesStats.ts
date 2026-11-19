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
  return bucketsInRange(sales, g, first, step(bucketStart(now, g), g, 1))
}

/** Cuántas barras saldrían al agrupar el rango [from, to) por g. */
export function bucketCount(g: Granularity, from: Date, to: Date) {
  let n = 0
  for (let d = bucketStart(from, g); d < to && n <= 1000; d = step(d, g, 1)) n++
  return n
}

/** Ventas agrupadas entre dos fechas elegidas ([from, to), "to" excluido). Los extremos pueden ser períodos parciales. */
export function bucketsInRange(sales: Sale[], g: Granularity, from: Date, to: Date): Bucket[] {
  const list: { start: Date; end: Date; total: number; units: number; count: number }[] = []
  for (let start = bucketStart(from, g); start < to && list.length < 1000; start = step(start, g, 1)) list.push({ start, end: step(start, g, 1), total: 0, units: 0, count: 0 })
  for (const s of sales) {
    const t = new Date(s.at)
    if (t < from || t >= to) continue
    const b = list.find((x) => t >= x.start && t < x.end)
    if (!b) continue
    b.total += s.total
    if (!s.creditFor) b.count++
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
export function productRanking(sales: Sale[], products: Product[], from: number, to = Infinity) {
  const map = new Map<string, { id: string; name: string; units: number; revenue: number }>()
  for (const p of products) map.set(p.id, { id: p.id, name: p.name, units: 0, revenue: 0 })
  for (const s of sales) {
    const t = new Date(s.at).getTime()
    if (t < from || t >= to) continue
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

/** Meses que abarca un rango, para prorratear los gastos fijos mensuales (un mes = 30,44 días). */
export const monthsIn = (from: number, to: number) => Math.max(0, to - from) / (DAY * 30.4375)

/**
 * El período anterior para comparar: si el rango son meses enteros (del 1 al 1), los meses anteriores;
 * si no, la misma cantidad de días justo antes.
 */
export function previousRange(from: Date, to: Date): [Date, Date] {
  const wholeMonths = from.getDate() === 1 && to.getDate() === 1 && from.getHours() === 0 && to.getHours() === 0
  if (wholeMonths) {
    const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth()
    return [new Date(from.getFullYear(), from.getMonth() - months, 1), new Date(from)]
  }
  return [new Date(from.getTime() - (to.getTime() - from.getTime())), new Date(from)]
}

/**
 * Punto de equilibrio mensual: cuánto hay que vender (con IVA) para cubrir los gastos fijos.
 * Usa el margen de contribución real de los últimos 90 días; si todavía no hay ventas con costo,
 * usa el margen promedio del catálogo (precio vs costo).
 */
/**
 * Punto de equilibrio del mes: cuánto falta vender para que la ganancia cubra los gastos fijos.
 *
 * 1. Ganancia del mes = ventas sin IVA − lo que costó la mercadería vendida (incluye cualquier
 *    venta a pérdida: ese pozo se descuenta una sola vez).
 * 2. Falta ganar = gastos fijos − ganancia del mes.
 * 3. Margen habitual = cuánto deja normalmente cada venta (últimos 90 días), SIN contar las ventas
 *    hechas por debajo del costo: una liquidación puntual no dice cuánto van a dejar las próximas.
 *    Si no hay ventas con costo, se estima con los precios y costos del catálogo.
 * 4. Falta vender (con IVA) = falta ganar ÷ margen habitual × (1 + IVA).
 * Objetivo del mes = lo vendido + lo que falta vender.
 */
export function breakEven(sales: Sale[], products: Product[], settings: Settings | undefined, now = new Date()) {
  const rate = (settings?.ivaRate ?? 21) / 100
  const fixed = settings?.fixedCosts.reduce((a, c) => a + c.amount, 0) ?? 0
  const since = now.getTime() - 90 * DAY
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Recorre las ventas de 90 días: separa lo habitual de lo vendido por debajo del costo.
  let okNet = 0
  let okCost = 0
  const losses = new Map<string, { name: string; qty: number; loss: number }>()
  let monthLoss = 0
  for (const s of sales) {
    const t = new Date(s.at).getTime()
    if (t < since) continue
    const factor = 1 - s.couponPercent / 100
    for (const i of s.items) {
      if (i.unitCost === null || i.qty <= 0) continue
      const netUnit = (i.unitFinal * factor) / (1 + rate)
      if (netUnit >= i.unitCost) {
        okNet += netUnit * i.qty
        okCost += i.unitCost * i.qty
        continue
      }
      const loss = (i.unitCost - netUnit) * i.qty
      const row = losses.get(i.productId) ?? { name: i.name, qty: 0, loss: 0 }
      row.qty += i.qty
      row.loss += loss
      losses.set(i.productId, row)
      if (t >= monthStart.getTime()) monthLoss += loss
    }
  }
  const belowCost = [...losses.values()].sort((a, b) => b.loss - a.loss)

  let ratio: number | null = okNet > 0 ? (okNet - okCost) / okNet : null
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

  const monthSales = sales.filter((s) => new Date(s.at) >= monthStart)
  const soldThisMonth = monthSales.reduce((a, s) => a + s.total, 0)
  // Ganancia del mes (ya con las ventas a pérdida restadas).
  const monthProfit = balance(sales, settings, monthStart.getTime(), now.getTime() + 1, 0).margin
  const remainingProfit = Math.max(0, fixed - monthProfit)
  const remainingSales = ratio && ratio > 0 ? (remainingProfit / ratio) * (1 + rate) : null
  // Sin gastos fijos cargados no hay objetivo que alcanzar.
  const target = fixed > 0 && remainingSales !== null ? soldThisMonth + remainingSales : null
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
  return {
    fixed,
    ratio,
    source,
    target,
    soldThisMonth,
    monthProfit,
    monthLoss,
    remainingProfit,
    remainingSales,
    progress: target ? (remainingProfit === 0 ? 1 : soldThisMonth / target) : null,
    /** Días que quedan del mes, contando hoy. */
    daysLeft: days - now.getDate() + 1,
    daily,
    belowCost,
  }
}
