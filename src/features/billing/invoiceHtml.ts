import { formatPrice } from '@/lib/format'
import { invoiceLabel } from '@/services/commerce'
import type { Sale, Settings } from '@/types'

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
export function invoiceHtml(sale: Sale, settings: Settings) {
  const b = settings.business
  const rate = settings.ivaRate
  const net = sale.total - sale.iva
  const date = new Date(sale.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  const rows = sale.items
    .map(
      (i) => `<tr><td>${i.qty}</td><td>${esc(i.name)}<small>${esc(i.sku)}${i.discountPercent ? ` · promo −${i.discountPercent}%` : ''}</small></td>
      <td class="r">${formatPrice(sale.invoiceType === 'A' ? i.unitFinal / (1 + rate / 100) : i.unitFinal)}</td>
      <td class="r">${formatPrice((sale.invoiceType === 'A' ? i.unitFinal / (1 + rate / 100) : i.unitFinal) * i.qty)}</td></tr>`,
    )
    .join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(invoiceLabel(sale))}</title>
<style>
  *{box-sizing:border-box} body{font-family:system-ui,sans-serif;color:#24303A;margin:32px;font-size:13px}
  .head{display:grid;grid-template-columns:1fr 80px 1fr;border:2px solid #24303A;border-radius:12px;overflow:hidden}
  .head>div{padding:14px 16px} .type{display:grid;place-items:center;border-inline:2px solid #24303A;font-size:40px;font-weight:900}
  h1{margin:0;font-size:20px} small{display:block;color:#5A666F;font-size:11px}
  .party{margin:16px 0;padding:12px 16px;border:1px solid #E9E3D6;border-radius:12px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{padding:8px;border-bottom:1px solid #E9E3D6;text-align:left;vertical-align:top}
  th{font-size:11px;color:#5A666F;text-transform:none} .r{text-align:right;white-space:nowrap}
  .tot{margin-left:auto;width:320px;margin-top:12px} .tot div{display:flex;justify-content:space-between;padding:4px 0} .tot .big{font-size:18px;font-weight:900;border-top:2px solid #24303A;margin-top:6px;padding-top:8px}
  .warn{margin-top:24px;padding:10px 14px;border-radius:10px;background:#FFF4CF;color:#7A5700;font-weight:700;font-size:11px}
  .test{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:90px;font-weight:900;color:rgba(205,64,52,.12);transform:rotate(-18deg)}
  .void{color:#CD4034;font-weight:900}
  @media print{body{margin:12mm}}
</style></head><body>
${sale.test ? '<div class="test">PRUEBA</div>' : ''}
<div class="head">
  <div><h1>${esc(b.name || 'DragoToY')}</h1><small>${esc(b.address || 'Domicilio sin cargar')}</small><small>CUIT ${esc(b.cuit || 'sin cargar')} · ${esc(b.ivaCondition)}</small></div>
  <div class="type">${sale.invoiceType}</div>
  <div><strong>${esc(invoiceLabel(sale))}</strong><small>Fecha ${date}</small><small>Canal: ${sale.channel === 'tienda' ? 'tienda online' : 'mostrador'} · Pago: ${PAY[sale.paymentMethod]}</small>
  ${sale.status === 'anulada' ? `<small class="void">ANULADA ${new Date(sale.voidedAt!).toLocaleDateString('es-AR')}: ${esc(sale.voidReason ?? '')}</small>` : ''}</div>
</div>
<div class="party"><strong>${esc(sale.customer.name)}</strong>
  <small>${sale.customer.docType ? `${sale.customer.docType} ${esc(sale.customer.doc)}` : 'Consumidor final'}${sale.customer.email ? ` · ${esc(sale.customer.email)}` : ''}</small></div>
<table><thead><tr><th>Cant.</th><th>Producto</th><th class="r">${sale.invoiceType === 'A' ? 'P. unit. neto' : 'P. unitario'}</th><th class="r">Importe</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot">
  ${sale.discountTotal > 0 ? `<div><span>Descuentos${sale.couponCode ? ` (cupón ${esc(sale.couponCode)} −${sale.couponPercent}%)` : ''}</span><span>−${formatPrice(sale.discountTotal)}</span></div>` : ''}
  ${sale.invoiceType === 'A' ? `<div><span>Neto gravado</span><span>${formatPrice(net)}</span></div><div><span>IVA ${rate}%</span><span>${formatPrice(sale.iva)}</span></div>` : ''}
  <div class="big"><span>Total</span><span>${formatPrice(sale.total)}</span></div>
  ${sale.invoiceType !== 'A' ? `<div><small>IVA contenido (Ley 27.743): ${formatPrice(sale.iva)}</small></div>` : ''}
</div>
<p class="warn">Comprobante interno, no válido como factura electrónica. Para emitir facturas ante ARCA (ex AFIP) el sistema necesita un servidor con certificado digital y CAE.</p>
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
</body></html>`
}

export function printInvoice(sale: Sale, settings: Settings) {
  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) return false
  w.document.write(invoiceHtml(sale, settings))
  w.document.close()
  return true
}
