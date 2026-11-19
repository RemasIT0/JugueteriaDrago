import { formatPrice } from '@/lib/format'
import { invoiceLabel } from '@/services/commerce'
import type { Sale, Settings } from '@/types'
import { openPrintable } from '@/lib/print'
import { invoiceNumbers } from './invoiceMath'
import { logoSvg } from './logo'

const PAY: Record<Sale['paymentMethod'], string> = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
}
export const paymentLabel = (p: Sale['paymentMethod']) => PAY[p]

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Comprobante imprimible (se abre en una ventana aparte y usa el diálogo de impresión del navegador). */
export function invoiceHtml(original: Sale, settings: Settings) {
  // Nota de crédito: se guarda en negativo (para que reste en reportes) pero se imprime en positivo.
  const credit = !!original.creditFor
  const sale: Sale = credit
    ? { ...original, items: original.items.map((i) => ({ ...i, qty: -i.qty })), subtotal: -original.subtotal, discountTotal: -original.discountTotal, total: -original.total, iva: -original.iva }
    : original
  const b = settings.business
  const rate = settings.ivaRate
  const date = new Date(sale.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  // Reserva todavía sin cobrar: no es comprobante de venta, es el resguardo para retirar.
  const pending = !sale.number && !!sale.reservationCode
  const until = sale.expiresAt ? new Date(sale.expiresAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' }) : ''
  // Renglones a precio de lista; los descuentos van abajo, así la cuenta cierra en el papel.
  const n = invoiceNumbers(sale, rate)
  const rows = n.lines
    .map(
      (l) => `<tr><td>${l.qty}</td><td>${esc(l.name)}<small>${esc(l.sku)}${l.promo ? ` · <span class="promo">promoción −${l.promo}%</span>` : ''}</small></td>
      <td class="r">${formatPrice(l.unit)}</td>
      <td class="r">${formatPrice(l.amount)}</td></tr>`,
    )
    .join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(invoiceLabel(sale))}</title>
<style>
  *{box-sizing:border-box} body{font-family:system-ui,sans-serif;color:#24303A;margin:32px;font-size:13px}
  .head{display:grid;grid-template-columns:1fr 80px 1fr;border:2px solid #24303A;border-radius:12px;overflow:hidden}
  .head>div{padding:14px 16px} .type{display:grid;place-items:center;border-inline:2px solid #24303A;font-size:40px;font-weight:900}
  .brand{display:flex;gap:12px;align-items:center} .brand svg{flex:none}
  h1{margin:0;font-size:20px} small{display:block;color:#5A666F;font-size:11px}
  .party{margin:16px 0;padding:12px 16px;border:1px solid #E9E3D6;border-radius:12px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{padding:8px;border-bottom:1px solid #E9E3D6;text-align:left;vertical-align:top}
  th{font-size:11px;color:#5A666F;text-transform:none} .r{text-align:right;white-space:nowrap}
  .tot{margin-left:auto;width:320px;margin-top:12px} .tot div{display:flex;justify-content:space-between;padding:4px 0} .tot .big{font-size:18px;font-weight:900;border-top:2px solid #24303A;margin-top:6px;padding-top:8px}
  .warn{margin-top:24px;padding:10px 14px;border-radius:10px;background:#FFF4CF;color:#7A5700;font-weight:700;font-size:11px}
  .test{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:90px;font-weight:900;color:rgba(205,64,52,.12);transform:rotate(-18deg)}
  .void{color:#CD4034;font-weight:900}
  .promo{color:#A63B2C;font-weight:700} .tot .disc{color:#A63B2C} .tot .sep{border-top:1px solid #E9E3D6;margin-top:4px;padding-top:6px}
  @media print{body{margin:12mm}}
</style></head><body>
${sale.test ? '<div class="test">PRUEBA</div>' : ''}
<div class="head">
  <div class="brand">${logoSvg('#000000', 52)}<div><h1>${esc(b.name || 'DragoToY')}</h1><small>${esc(b.address || 'Domicilio sin cargar')}</small><small>CUIT ${esc(b.cuit || 'sin cargar')} · ${esc(b.ivaCondition)}</small></div></div>
  <div class="type">${pending ? 'R' : sale.invoiceType}</div>
  <div><strong>${esc(invoiceLabel(sale))}</strong><small>Fecha ${date}</small>${credit ? `<small><strong>Devolución sobre ${esc(sale.creditForLabel ?? 'la venta original')}</strong></small><small>Se devolvió con: ${PAY[sale.paymentMethod]}</small>${sale.voidReason ? `<small>Motivo: ${esc(sale.voidReason)}</small>` : ''}` : ''}<small>Canal: ${sale.channel === 'tienda' ? 'tienda online' : 'mostrador'} · ${pending ? 'Pagará con' : 'Pago'}: ${PAY[sale.paymentMethod]}</small>${pending && until ? `<small><strong>Guardada hasta el ${until}</strong></small>` : ''}${sale.status === 'cancelada' ? `<small class="void">CANCELADA: ${esc(sale.voidReason ?? '')}</small>` : ''}
  ${sale.status === 'anulada' ? `<small class="void">ANULADA ${new Date(sale.voidedAt!).toLocaleDateString('es-AR')}: ${esc(sale.voidReason ?? '')}</small>` : ''}</div>
</div>
<div class="party"><strong>${esc(sale.customer.name)}</strong>
  <small>${sale.customer.docType ? `${sale.customer.docType} ${esc(sale.customer.doc)}` : 'Consumidor final'}${sale.customer.email ? ` · ${esc(sale.customer.email)}` : ''}</small></div>
<table><thead><tr><th>Cant.</th><th>Producto</th><th class="r">${sale.invoiceType === 'A' ? 'P. unit. neto' : 'P. unitario'}</th><th class="r">Importe</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot">
  ${n.promos > 0 || n.coupon > 0 ? `<div><span>Subtotal${n.isA ? ' neto' : ''}</span><span>${formatPrice(n.subtotal)}</span></div>` : ''}
  ${n.promos > 0 ? `<div class="disc"><span>Promociones</span><span>−${formatPrice(n.promos)}</span></div>` : ''}
  ${n.coupon > 0 ? `<div class="disc"><span>Cupón ${esc(sale.couponCode ?? '')}${sale.couponPercent ? ` (−${sale.couponPercent}%)` : ''}</span><span>−${formatPrice(n.coupon)}</span></div>` : ''}
  ${n.isA ? `<div class="sep"><span>Neto gravado</span><span>${formatPrice(n.net)}</span></div><div><span>IVA ${rate}%</span><span>${formatPrice(n.iva)}</span></div>` : ''}
  <div class="big"><span>Total</span><span>${formatPrice(sale.total)}</span></div>
  ${sale.invoiceType !== 'A' ? `<div><small>IVA contenido (Ley 27.743): ${formatPrice(sale.iva)}</small></div>` : ''}
</div>
${pending ? `<p class="warn">Reserva: se paga al retirar en el local mostrando este código. No es un comprobante de venta.</p>` : `<p class="warn">Comprobante interno, no válido como factura electrónica. Para emitir facturas ante ARCA (ex AFIP) el sistema necesita un servidor con certificado digital y CAE.</p>`}
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
</body></html>`
}

export function printInvoice(sale: Sale, settings: Settings) {
  return openPrintable(invoiceHtml(sale, settings))
}
