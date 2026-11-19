import { round2 } from '@/lib/pricing'
import type { Sale } from '@/types'

/**
 * Números de un comprobante, armados para que la cuenta cierre en el papel:
 *   renglones a precio de lista → Subtotal − Promociones − Cupón (= Neto gravado + IVA en la A) = Total.
 * Factura A: todo sin IVA (precios netos) y el IVA aparte. B y X: precios finales con IVA incluido.
 * Recibe la venta ya en positivo (las notas de crédito se dan vuelta antes).
 */
export function invoiceNumbers(sale: Sale, ivaRate: number) {
  const isA = sale.invoiceType === 'A'
  const k = isA ? 1 / (1 + ivaRate / 100) : 1
  const lines = sale.items.map((i) => ({
    qty: i.qty,
    name: i.name,
    sku: i.sku,
    promo: i.discountPercent,
    unit: round2(i.unitPrice * k),
    amount: round2(i.unitPrice * i.qty * k),
  }))
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0))
  const promoGross = round2(sale.items.reduce((a, i) => a + (i.unitPrice - i.unitFinal) * i.qty, 0))
  const couponGross = round2(sale.subtotal - sale.total - promoGross)
  const net = round2(sale.total - sale.iva)
  // En la A el cupón se calcula por diferencia, así Subtotal − descuentos da exacto el neto gravado.
  const promos = round2(promoGross * k)
  const coupon = isA ? round2(subtotal - promos - net) : couponGross
  return { isA, lines, subtotal, promos, coupon: Math.abs(coupon) < 0.01 ? 0 : coupon, net, iva: sale.iva, total: sale.total }
}
