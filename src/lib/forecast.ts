import { nextOccurrence, seasonDate } from './defaults'
import type { Product, Sale, Season } from '@/types'

const DAY = 86_400_000

/** Unidades vendidas por producto entre dos fechas (ventas completadas). */
export function unitsSold(sales: Sale[], from: number, to: number) {
  const out = new Map<string, number>()
  for (const s of sales) {
    if (s.status !== 'completada') continue
    const t = new Date(s.at).getTime()
    if (t < from || t > to) continue
    for (const i of s.items) out.set(i.productId, (out.get(i.productId) ?? 0) + i.qty)
  }
  return out
}

export interface SeasonPlan {
  season: Season
  date: Date
  days: number
  items: { product: Product; expected: number; suggested: number; basis: string }[]
}

/**
 * Qué reponer antes de cada fecha clave. La demanda esperada por producto es la mayor de:
 * lo vendido el mes previo a esa fecha el año pasado, el ritmo de los últimos 30 días
 * proyectado a los días que faltan, o el doble de su stock mínimo (piso de seguridad).
 */
export function planSeasons(seasons: Season[], products: Product[], sales: Sale[], now = new Date()): SeasonPlan[] {
  const last30 = unitsSold(sales, now.getTime() - 30 * DAY, now.getTime())
  return seasons
    .map((season) => {
      const { date, days } = nextOccurrence(season.rule, now)
      const lastYear = seasonDate(season.rule, date.getFullYear() - 1).getTime()
      const prevSeason = unitsSold(sales, lastYear - 30 * DAY, lastYear)
      const items = products
        .filter((p) => p.seasons.includes(season.id))
        .map((product) => {
          const fromLastYear = prevSeason.get(product.id) ?? 0
          const fromPace = Math.ceil(((last30.get(product.id) ?? 0) / 30) * Math.max(days, 30))
          const floor = product.minStock * 2
          const expected = Math.max(fromLastYear, fromPace, floor)
          const basis = expected === fromLastYear && fromLastYear > 0 ? 'ventas del año pasado' : expected === fromPace && fromPace > 0 ? 'ritmo de los últimos 30 días' : 'doble del stock mínimo'
          return { product, expected, suggested: Math.max(0, expected - product.stock), basis }
        })
        .filter((i) => i.suggested > 0)
        .sort((a, b) => b.suggested - a.suggested)
      return { season, date, days, items }
    })
    .sort((a, b) => a.days - b.days)
}
