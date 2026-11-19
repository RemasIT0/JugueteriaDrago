import { formatPrice } from '@/lib/format'
import { invoiceLabel } from '@/services/commerce'
import type { Sale, Settings } from '@/types'
import { paymentLabel } from './invoiceHtml'
import { invoiceNumbers } from './invoiceMath'
import { logoPng } from './logo'

/** Las fuentes estándar del PDF solo tienen Latin-1: se reemplazan los signos que no traen. */
const t = (s: string) =>
  s
    .replace(/[−–—]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[^\x20-\xff\n]/g, '')

const INK: [number, number, number] = [36, 48, 58]
const SOFT: [number, number, number] = [90, 102, 111]
const LINE: [number, number, number] = [210, 204, 190]

export const invoiceFileName = (sale: Sale) =>
  `${invoiceLabel(sale).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-')}.pdf`

/**
 * Arma el comprobante como PDF (mismo contenido que la hoja imprimible) y lo devuelve como Blob.
 * jsPDF se carga recién acá, así no pesa en la carga inicial de la tienda.
 */
export async function invoicePdf(original: Sale, settings: Settings): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const credit = !!original.creditFor
  const sale: Sale = credit
    ? { ...original, items: original.items.map((i) => ({ ...i, qty: -i.qty })), subtotal: -original.subtotal, discountTotal: -original.discountTotal, total: -original.total, iva: -original.iva }
    : original
  const b = settings.business
  const rate = settings.ivaRate
  const pending = !sale.number && !!sale.reservationCode
  // Renglones a precio de lista y descuentos abajo (mismos números que la hoja imprimible).
  const num = invoiceNumbers(sale, rate)
  const isA = num.isA
  const money = (n: number) => t(formatPrice(n))

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210
  const M = 15
  doc.setProperties({ title: t(invoiceLabel(sale)), author: t(b.name || 'DragoToY') })
  doc.setTextColor(...INK)

  if (sale.test) {
    doc.setTextColor(240, 200, 196)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(80)
    doc.text('PRUEBA', W / 2, 160, { align: 'center', angle: 18 })
    doc.setTextColor(...INK)
  }

  // Encabezado: logo + comercio | letra | comprobante
  const top = M
  const headH = 38
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.roundedRect(M, top, W - 2 * M, headH, 3, 3)
  const midX = W / 2 - 10
  doc.line(midX, top, midX, top + headH)
  doc.line(midX + 20, top, midX + 20, top + headH)

  try {
    const logo = await logoPng('#000000')
    doc.addImage(logo, 'PNG', M + 4, top + 5, 16, 16)
  } catch {
    /* sin logo si el navegador no puede dibujarlo: el comprobante sigue siendo válido */
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(t(b.name || 'DragoToY'), M + 23, top + 10, { maxWidth: midX - M - 26 })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SOFT)
  doc.text(t(b.address || 'Domicilio sin cargar'), M + 23, top + 16, { maxWidth: midX - M - 26 })
  doc.text(t(`CUIT ${b.cuit || 'sin cargar'} · ${b.ivaCondition}`), M + 23, top + 21, { maxWidth: midX - M - 26 })
  doc.setTextColor(...INK)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.text(pending ? 'R' : sale.invoiceType, midX + 10, top + headH / 2 + 4, { align: 'center' })

  const rx = midX + 24
  const rw = W - M - rx - 3
  let ry = top + 8
  doc.setFontSize(10)
  doc.text(t(invoiceLabel(sale)), rx, ry, { maxWidth: rw })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SOFT)
  const date = new Date(sale.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  const lines: string[] = [`Fecha ${date}`]
  if (credit) lines.push(`Devolución sobre ${sale.creditForLabel ?? 'la venta original'}`, `Se devolvió con: ${paymentLabel(sale.paymentMethod)}`)
  lines.push(`Canal: ${sale.channel === 'tienda' ? 'tienda online' : 'mostrador'} · ${pending ? 'Pagará con' : 'Pago'}: ${paymentLabel(sale.paymentMethod)}`)
  if (pending && sale.expiresAt) lines.push(`Guardada hasta el ${new Date(sale.expiresAt).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}`)
  if (sale.status === 'cancelada') lines.push(`CANCELADA: ${sale.voidReason ?? ''}`)
  if (sale.status === 'anulada') lines.push(`ANULADA: ${sale.voidReason ?? ''}`)
  for (const l of lines) {
    const wrapped = doc.splitTextToSize(t(l), rw) as string[]
    ry += 5
    doc.text(wrapped, rx, ry)
    ry += (wrapped.length - 1) * 3.6
  }
  doc.setTextColor(...INK)

  // Cliente
  let y = top + headH + 6
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.roundedRect(M, y, W - 2 * M, 14, 2.5, 2.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(t(sale.customer.name || 'Consumidor final'), M + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SOFT)
  const who = `${sale.customer.docType ? `${sale.customer.docType} ${sale.customer.doc}` : 'Consumidor final'}${sale.customer.email ? ` · ${sale.customer.email}` : ''}`
  doc.text(t(who), M + 4, y + 11)
  doc.setTextColor(...INK)

  // Productos
  y += 22
  const cols = { qty: M + 2, name: M + 16, unit: W - M - 38, amount: W - M - 2 }
  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...SOFT)
    doc.text('Cant.', cols.qty, y)
    doc.text('Producto', cols.name, y)
    doc.text(isA ? 'P. unit. neto' : 'P. unitario', cols.unit, y, { align: 'right' })
    doc.text('Importe', cols.amount, y, { align: 'right' })
    doc.setTextColor(...INK)
    y += 2
    doc.setDrawColor(...INK)
    doc.line(M, y, W - M, y)
    y += 5
  }
  header()
  for (const i of num.lines) {
    const name = doc.splitTextToSize(t(i.name), cols.unit - cols.name - 26) as string[]
    const rowH = name.length * 4 + 5
    if (y + rowH > 270) {
      doc.addPage()
      y = M + 5
      header()
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(String(i.qty), cols.qty, y)
    doc.text(name, cols.name, y)
    doc.text(money(i.unit), cols.unit, y, { align: 'right' })
    doc.text(money(i.amount), cols.amount, y, { align: 'right' })
    doc.setFontSize(7)
    doc.setTextColor(...SOFT)
    doc.text(t(`${i.sku}${i.promo ? ` · promoción -${i.promo}%` : ''}`), cols.name, y + name.length * 4)
    doc.setTextColor(...INK)
    y += rowH
    doc.setDrawColor(...LINE)
    doc.line(M, y - 2.5, W - M, y - 2.5)
    y += 2
  }

  // Totales
  if (y > 240) {
    doc.addPage()
    y = M + 5
  }
  const tx = W - M - 80
  const totalRow = (label: string, value: string, big = false) => {
    doc.setFont('helvetica', big ? 'bold' : 'normal')
    doc.setFontSize(big ? 13 : 9)
    doc.text(t(label), tx, y)
    doc.text(value, W - M - 2, y, { align: 'right' })
    y += big ? 7 : 5.5
  }
  y += 3
  if (num.promos > 0 || num.coupon > 0) totalRow(`Subtotal${isA ? ' neto' : ''}`, money(num.subtotal))
  if (num.promos > 0) totalRow('Promociones', '-' + money(num.promos))
  if (num.coupon > 0) totalRow(`Cupón ${sale.couponCode ?? ''}${sale.couponPercent ? ` (-${sale.couponPercent}%)` : ''}`, '-' + money(num.coupon))
  if (isA) {
    totalRow('Neto gravado', money(num.net))
    totalRow(`IVA ${rate}%`, money(num.iva))
  }
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(tx, y - 3, W - M, y - 3)
  y += 3
  totalRow('Total', money(sale.total), true)
  if (!isA) {
    doc.setFontSize(7)
    doc.setTextColor(...SOFT)
    doc.text(t(`IVA contenido (Ley 27.743): ${formatPrice(sale.iva)}`), W - M - 2, y, { align: 'right' })
    doc.setTextColor(...INK)
    y += 5
  }

  // Aviso
  y += 6
  const note = pending
    ? 'Reserva: se paga al retirar en el local mostrando este código. No es un comprobante de venta.'
    : 'Comprobante interno, no válido como factura electrónica. Para emitir facturas ante ARCA (ex AFIP) el sistema necesita un servidor con certificado digital y CAE.'
  const noteLines = doc.splitTextToSize(t(note), W - 2 * M - 8) as string[]
  doc.setFillColor(255, 244, 207)
  doc.roundedRect(M, y, W - 2 * M, noteLines.length * 4 + 6, 2.5, 2.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(122, 87, 0)
  doc.text(noteLines, M + 4, y + 5)

  return doc.output('blob')
}

/** Genera el PDF y lo descarga con un nombre como «Reserva-R-0007.pdf». */
export async function downloadInvoicePdf(sale: Sale, settings: Settings) {
  const blob = await invoicePdf(sale, settings)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = invoiceFileName(sale)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
