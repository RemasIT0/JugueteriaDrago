import { AnimatePresence, motion } from 'framer-motion'
import { LuBan as Ban, LuBuilding2 as Building2, LuFileText as FileText, LuLoaderCircle as Loader2, LuPrinter as Printer, LuReceiptText as ReceiptText, LuSearch as Search } from 'react-icons/lu'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Field, Input } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { formatDate, formatPrice, formatTime } from '@/lib/format'
import { invoiceLabel } from '@/services/commerce'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'
import type { Sale } from '@/types'
import { paymentLabel, printInvoice } from './invoiceHtml'

type Filter = 'todas' | 'A' | 'B' | 'X' | 'anuladas' | 'prueba'

export default function BillingPage() {
  const { sales, load, status } = useSales()
  const settings = useInventory((s) => s.settings)
  const [filter, setFilter] = useState<Filter>('todas')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [business, setBusiness] = useState(false)

  useEffect(() => {
    void load(true)
  }, [load])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return sales.filter(
      (s) =>
        (filter === 'todas' ||
          (filter === 'anuladas' && s.status === 'anulada') ||
          (filter === 'prueba' && s.test) ||
          (['A', 'B', 'X'].includes(filter) && s.invoiceType === filter)) &&
        (!t || invoiceLabel(s).toLowerCase().includes(t) || s.customer.name.toLowerCase().includes(t) || s.customer.doc.includes(t)),
    )
  }, [sales, filter, q])

  const active = sales.filter((s) => s.status === 'completada' && !s.test)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const monthSales = active.filter((s) => new Date(s.at) >= monthStart)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Facturación</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Comprobantes de cada venta: ver, imprimir o anular. La anulación devuelve el stock y queda registrada.</p>
        </div>
        <Button variant="secondary" onClick={() => setBusiness(true)}>
          <Building2 className="size-4" aria-hidden /> Datos del emisor
        </Button>
      </header>

      {settings && !settings.business.cuit && (
        <p className="rounded-2xl bg-sol-wash px-4 py-3 text-sm font-bold text-sol-ink">Falta el CUIT y el domicilio de la tienda: aparecen en cada comprobante. Cárgalos en «Datos del emisor».</p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['Facturado este mes', formatPrice(monthSales.reduce((a, s) => a + s.total, 0))],
          ['IVA contenido del mes', formatPrice(monthSales.reduce((a, s) => a + s.iva, 0))],
          ['Comprobantes del mes', String(monthSales.length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-3xl bg-surface p-5 shadow-card">
            <p className="text-xs font-extrabold text-ink-soft">{k}</p>
            <p className="num text-2xl font-black">{v}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-3 shadow-card sm:p-4 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar comprobante</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Número, cliente o documento"
            className="h-12 w-full rounded-xl border-2 border-line bg-ground pl-11 pr-4 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Filtrar" className="flex flex-wrap gap-1 rounded-xl bg-sunken p-1">
          {(
            [
              ['todas', 'Todas'],
              ['B', 'Factura B'],
              ['A', 'Factura A'],
              ['X', 'Comprob. X'],
              ['prueba', 'Prueba'],
              ['anuladas', 'Anuladas'],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={clsx('h-10 rounded-lg px-3 text-sm font-extrabold transition-colors', filter === id ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl bg-surface shadow-card">
        {status !== 'ready' ? (
          <div className="flex flex-col gap-3 p-5">
            <Shimmer className="h-12 rounded-xl" />
            <Shimmer className="h-12 rounded-xl" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ReceiptText className="size-10 text-ink-soft" strokeWidth={1.8} aria-hidden />
            <p className="font-black">{sales.length ? 'Nada coincide con el filtro' : 'Todavía no hay ventas'}</p>
            <p className="max-w-sm text-sm font-semibold text-ink-soft">Cada compra en la tienda genera su comprobante automáticamente.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.id}>
                <button onClick={() => setOpen(s.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-5 py-3 text-left transition-colors hover:bg-sunken/70 sm:grid-cols-[13rem_minmax(0,1fr)_8rem_7rem]">
                  <span className="num flex items-center gap-2 text-sm font-extrabold">
                    <FileText className="size-4 shrink-0 text-ink-soft" aria-hidden />
                    {invoiceLabel(s)}
                  </span>
                  <span className="num order-last col-span-2 text-xs font-semibold text-ink-soft sm:order-none sm:col-span-1 sm:text-sm">
                    {s.customer.name} · {formatDate(s.at)} {formatTime(s.at)}
                  </span>
                  <span className="flex gap-1 sm:justify-end">
                    {s.test && <span className="rounded-full bg-sol-wash px-2 py-0.5 text-2xs font-black text-sol-ink">Prueba</span>}
                    {s.status === 'anulada' && <span className="rounded-full bg-peligro-wash px-2 py-0.5 text-2xs font-black text-peligro">Anulada</span>}
                  </span>
                  <span className={clsx('num text-right font-black', s.status === 'anulada' && 'text-ink-soft line-through')}>{formatPrice(s.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SaleDrawer sale={sales.find((s) => s.id === open) ?? null} onClose={() => setOpen(null)} />
      <BusinessDrawer open={business} onClose={() => setBusiness(false)} />
    </div>
  )
}

function SaleDrawer({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const settings = useInventory((s) => s.settings)
  const voidSale = useSales((s) => s.voidSale)
  const canVoid = useCan('ventas.anular')
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setVoiding(false)
    setReason('')
  }, [sale?.id])

  const doVoid = async () => {
    if (!sale || !reason.trim()) return
    setBusy(true)
    try {
      await voidSale(sale.id, reason)
      toast({ tone: 'ok', text: `${invoiceLabel(sale)} anulada. El stock volvió al inventario.` })
      setVoiding(false)
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo anular.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={!!sale} onClose={onClose} title={sale ? invoiceLabel(sale) : 'Comprobante'}>
      {sale && (
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 pt-16 sm:p-6 sm:pt-16">
          <div className="flex items-start gap-3">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-2xl font-black text-ground">{sale.invoiceType}</div>
            <div>
              <h2 className="num text-xl font-black">{invoiceLabel(sale)}</h2>
              <p className="text-sm font-semibold text-ink-soft">
                {new Date(sale.at).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })} · {sale.channel === 'tienda' ? 'Tienda online' : 'Mostrador'}
              </p>
            </div>
          </div>
          {sale.status === 'anulada' && (
            <p className="rounded-2xl bg-peligro-wash px-4 py-3 text-sm font-bold text-peligro">
              Anulada el {formatDate(sale.voidedAt!)}: {sale.voidReason}
            </p>
          )}
          {sale.test && <p className="rounded-2xl bg-sol-wash px-4 py-3 text-sm font-bold text-sol-ink">Compra de prueba: el stock sí se descontó.</p>}
          <div className="rounded-2xl bg-sunken p-4 text-sm">
            <p className="font-extrabold">{sale.customer.name}</p>
            <p className="font-semibold text-ink-soft">
              {sale.customer.docType ? `${sale.customer.docType} ${sale.customer.doc}` : 'Consumidor final'}
              {sale.customer.email && ` · ${sale.customer.email}`}
            </p>
            <p className="mt-1 font-semibold text-ink-soft">Pago: {paymentLabel(sale.paymentMethod)}</p>
          </div>
          <ul className="divide-y divide-line rounded-2xl border-2 border-line">
            {sale.items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="num w-8 font-black">{i.qty}×</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{i.name}</span>
                  {i.discountPercent > 0 && <span className="text-xs font-bold text-coral-ink">promo −{i.discountPercent}%</span>}
                </span>
                <span className="num font-black">{formatPrice(i.unitFinal * i.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 text-sm">
            <Row k="Subtotal" v={formatPrice(sale.subtotal)} />
            {sale.discountTotal > 0 && <Row k={`Descuentos${sale.couponCode ? ` (cupón ${sale.couponCode})` : ''}`} v={`−${formatPrice(sale.discountTotal)}`} />}
            <Row k={`IVA contenido (${settings?.ivaRate ?? 21}%)`} v={formatPrice(sale.iva)} />
            <div className="mt-1 flex justify-between border-t-2 border-line pt-2 text-lg font-black">
              <dt>Total</dt>
              <dd className="num">{formatPrice(sale.total)}</dd>
            </div>
          </dl>
          <Button variant="primary" onClick={() => settings && !printInvoice(sale, settings) && toast({ tone: 'error', text: 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.' })}>
            <Printer className="size-4" aria-hidden /> Imprimir comprobante
          </Button>

          {canVoid && sale.status === 'completada' && (
            <div className="mt-auto border-t-2 border-line pt-5">
              <AnimatePresence initial={false} mode="wait">
                {voiding ? (
                  <motion.form
                    key="f"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onSubmit={(e) => (e.preventDefault(), void doVoid())}
                    className="flex flex-col gap-3"
                  >
                    <Field label="Motivo de la anulación" htmlFor="void-reason">
                      <Input id="void-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: el cliente devolvió el producto" />
                    </Field>
                    <div className="flex gap-2">
                      <Button type="submit" variant="danger" size="sm" disabled={busy || !reason.trim()}>
                        {busy && <Loader2 className="size-4 animate-spin" />} Anular y devolver stock
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setVoiding(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Button variant="danger" size="sm" onClick={() => setVoiding(true)}>
                      <Ban className="size-4" aria-hidden /> Anular venta
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between font-semibold text-ink-soft">
      <dt>{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  )
}

function BusinessDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useInventory()
  const [b, setB] = useState(settings?.business ?? { name: '', cuit: '', address: '', ivaCondition: 'Responsable Inscripto' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open && settings) setB(settings.business)
  }, [open, settings])
  const cuitOk = !b.cuit || /^\d{2}-?\d{8}-?\d$/.test(b.cuit)

  return (
    <Drawer open={open} onClose={onClose} title="Datos del emisor">
      <form
        className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 pt-16 sm:p-6 sm:pt-16"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!cuitOk) return
          setBusy(true)
          try {
            await updateSettings({ business: b })
            toast({ tone: 'ok', text: 'Datos del emisor guardados' })
            onClose()
          } catch (err) {
            toast({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo guardar.' })
          } finally {
            setBusy(false)
          }
        }}
      >
        <h2 className="text-2xl font-black">Datos del emisor</h2>
        <p className="text-sm font-semibold text-ink-soft">Aparecen en el encabezado de cada comprobante.</p>
        <Field label="Razón social o nombre" htmlFor="bz-name">
          <Input id="bz-name" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
        </Field>
        <Field label="CUIT" htmlFor="bz-cuit" error={cuitOk ? undefined : 'Formato: 20-12345678-9'}>
          <Input id="bz-cuit" className="num" value={b.cuit} onChange={(e) => setB({ ...b, cuit: e.target.value })} placeholder="20-12345678-9" />
        </Field>
        <Field label="Domicilio comercial" htmlFor="bz-addr">
          <Input id="bz-addr" value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} />
        </Field>
        <Field label="Condición frente al IVA" htmlFor="bz-iva">
          <Input id="bz-iva" value={b.ivaCondition} onChange={(e) => setB({ ...b, ivaCondition: e.target.value })} />
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !cuitOk} className="self-start">
          {busy && <Loader2 className="size-4 animate-spin" />} Guardar
        </Button>
      </form>
    </Drawer>
  )
}
