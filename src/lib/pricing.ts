import type { Category, Discount, Product, Settings } from '@/types'

/** Precio de venta recomendado: costo + margen objetivo, redondeado hacia arriba a $10. */
export function recommendedPrice(cost: number | null, margin: number) {
  if (cost === null || cost <= 0) return null
  return Math.ceil((cost * (1 + margin / 100)) / 10) * 10
}

export const marginFor = (category: Category | undefined, settings: Settings | undefined) => category?.marginTarget ?? settings?.defaultMargin ?? 60

/** Margen real sobre el precio de venta (%), o null si falta el costo. */
export function realMargin(price: number, cost: number | null) {
  if (cost === null || price <= 0) return null
  return ((price - cost) / price) * 100
}

const isLive = (d: Discount, now: number) =>
  d.active && (!d.startsAt || new Date(d.startsAt).getTime() <= now) && (!d.endsAt || new Date(d.endsAt).getTime() >= now)

/** La promoción vigente más conveniente para el producto (producto, categoría o temporada). */
export function bestDiscount(product: Pick<Product, 'id' | 'categoryId' | 'seasons'>, discounts: Discount[], now = Date.now()) {
  let best: Discount | null = null
  for (const d of discounts) {
    if (d.kind === 'cupon' || !isLive(d, now)) continue
    const applies =
      (d.kind === 'producto' && d.targetId === product.id) ||
      (d.kind === 'categoria' && d.targetId === product.categoryId) ||
      (d.kind === 'temporada' && !!d.targetId && product.seasons.includes(d.targetId))
    if (applies && (!best || d.percent > best.percent)) best = d
  }
  return best
}

export function priceFor(product: Pick<Product, 'id' | 'categoryId' | 'seasons' | 'price'>, discounts: Discount[], now = Date.now()) {
  const d = bestDiscount(product, discounts, now)
  const percent = d?.percent ?? 0
  return { list: product.price, final: round2(product.price * (1 - percent / 100)), percent, discount: d }
}

export function findCoupon(code: string, discounts: Discount[], now = Date.now()) {
  const c = code.trim().toUpperCase()
  return discounts.find((d) => d.kind === 'cupon' && d.code?.toUpperCase() === c && isLive(d, now)) ?? null
}

/** IVA contenido en un precio final (los precios al público en Argentina incluyen IVA). */
export const ivaContained = (total: number, rate: number) => round2(total - total / (1 + rate / 100))

export const round2 = (n: number) => Math.round(n * 100) / 100
