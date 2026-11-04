import { AnimatePresence, motion } from 'framer-motion'
import {
  LuCheck as Check,
  LuClock as Clock,
  LuLoaderCircle as Loader2,
  LuPackageCheck as PackageCheck,
  LuPrinter as Printer,
  LuSearch as Search,
  LuShoppingBag as ShoppingBag,
  LuTimerOff as TimerOff,
  LuX as X,
} from 'react-icons/lu'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { formatDate, formatPrice, formatTime } from '@/lib/format'
import { invoiceLabel, isExpired, reservationLabel } from '@/services/commerce'
import { paymentLabel, printInvoice } from '@/features/billing/invoiceHtml'
import { useInventory } from '@/stores/inventory'
import { useOrders } from '@/stores/orders'
import type { PaymentMethod, Sale } from '@/types'

type Tab = 'pendientes' | 'retirados' | 'cancelados'

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'mercadopago', label: 'Mercado Pago' },
]

const CANCEL_REASONS = ['No vino a retirar', 'El cliente canceló', 'Sin stock real en el local', 'Otro'] as const

/** «Vence en 2 días», «Vence hoy», «Venció hace 1 día». */
export function expiryText(s: Sale, now = Date.now()) {
  if (!s.expiresAt) return ''
  const ms = Date.parse(s.expiresAt) - now
  const days = Math.round(Math.abs(ms) / 86_400_000)
  if (ms < 0) return days < 1 ? 'Venció hoy' : `Venció hace ${days} día${days > 1 ? 's' : ''}`
  if (ms < 86_400_000) return `Vence hoy a las ${formatTime(s.expiresAt)}`
  return `Vence en ${days} día${days > 1 ? 's' : ''}`
}

const summary = (s: Sale) => s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')

export default function OrdersPage() {
  const { orders, status, error, load, releaseExpired } = useOrders()
  const [tab, setTab] = useState<Tab>('pendientes')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [releasing, setReleasing] = useState<'ask' | 'busy' | null>(null)

  useEffect(() => {
    void load(true)
  }, [load])

  const pending = orders.filter((o) => o.status === 'reservada')
  const expired = pending.filter((o) => isExpired(o))

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^r-?/, '')
    const want = tab === 'pendientes' ? 'reservada' : tab === 'retirados' ? 'completada' : null
    return orders
      .filter((o) => (want ? o.status === want || (tab === 'retirados' && o.status === 'anulada') : o.status === 'cancelada'))
      .filter(
        (o) =>
          !t ||
          String(o.reservationCode).padStart(4, '0').includes(t) ||
          o.customer.name.toLowerCase().includes(t) ||
          o.customer.email.toLowerCase().includes(t) ||
          (o.customer.doc && o.customer.doc.includes(t)),
      )
      // Por retirar: primero lo que vence antes.
      .sort((a, b) => (tab === 'pendientes' ? Date.parse(a.expiresAt ?? a.at) - Date.parse(b.expiresAt ?? b.at) : 0))
  }, [orders, tab, q])

  const release = async () => {
    setReleasing('busy')
    try {
      const n = await releaseExpired()
      toast({ tone: 'ok', text: n ? `${n} reserva${n > 1 ? 's' : ''} liberada${n > 1 ? 's' : ''}. El stock volvió a la tienda.` : 'No había reservas vencidas.' })
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudieron liberar.' })
    } finally {
      setReleasing(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Pedidos online</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
          Reservas hechas en la tienda online. El stock queda separado; recién cuando el cliente retira y paga se emite el comprobante y cuenta como venta.
        </p>
      </header>

      <AnimatePresence initial={false}>
        {expired.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-peligro-wash px-4 py-3">
              <TimerOff className="size-5 shrink-0 text-peligro" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-bold text-peligro">
                {expired.length === 1 ? '1 reserva venció' : `${expired.length} reservas vencieron`} y sigue{expired.length > 1 ? 'n' : ''} separando{' '}
                {expired.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty, 0), 0)} u de stock.
              </p>
              {releasing === 'ask' ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">¿Cancelarlas y devolver el stock?</span>
                  <Button size="sm" variant="danger" autoFocus onClick={() => void release()}>
                    Sí, liberar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReleasing(null)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="danger" disabled={releasing === 'busy'} onClick={() => setReleasing('ask')}>
                  {releasing === 'busy' && <Loader2 className="size-4 animate-spin" />} Liberar vencidas
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-3 shadow-card sm:p-4 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Estado del pedido" className="flex flex-wrap gap-1 rounded-xl bg-sunken p-1">
          {(
            [
              ['pendientes', `Por retirar (${pending.length})`],
              ['retirados', 'Retirados'],
              ['cancelados', 'Cancelados'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx('h-10 rounded-lg px-3 text-sm font-extrabold transition-colors', tab === id ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink')}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <span className="sr-only">Buscar pedido</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Código R-0001, nombre, email o DNI"
            className="h-12 w-full rounded-xl border-2 border-line bg-ground pl-11 pr-4 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
          />
        </label>
      </div>

      <section className="overflow-hidden rounded-3xl bg-surface shadow-card" role="tabpanel">
        {status === 'error' ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <TimerOff className="size-10 text-peligro" strokeWidth={1.8} aria-hidden />
            <p className="font-black">No se pudieron cargar los pedidos</p>
            <p className="max-w-md text-sm font-semibold text-ink-soft">{error}</p>
            <Button size="sm" variant="secondary" onClick={() => void load(true)}>
              Reintentar
            </Button>
          </div>
        ) : status !== 'ready' ? (
          <div className="flex flex-col gap-3 p-5">
            <Shimmer className="h-16 rounded-xl" />
            <Shimmer className="h-16 rounded-xl" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ShoppingBag className="size-10 text-ink-soft" strokeWidth={1.8} aria-hidden />
            <p className="font-black">
              {q ? 'Ningún pedido coincide con la búsqueda' : tab === 'pendientes' ? 'No hay pedidos por retirar' : tab === 'retirados' ? 'Todavía no se retiró ningún pedido' : 'No hay pedidos cancelados'}
            </p>
            {tab === 'pendientes' && !q && <p className="max-w-sm text-sm font-semibold text-ink-soft">Cuando alguien reserve en la tienda online, el pedido aparece acá al instante.</p>}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((o) => {
              const late = isExpired(o)
              return (
                <li key={o.id}>
                  <button
                    onClick={() => setOpen(o.id)}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left transition-colors hover:bg-sunken/70"
                  >
                    <span className="num row-span-2 grid h-12 min-w-16 place-items-center rounded-xl bg-sunken px-2 text-sm font-black">R-{String(o.reservationCode).padStart(4, '0')}</span>
                    <span className="truncate font-extrabold">
                      {o.customer.name}
                      {o.test && <span className="ml-2 rounded-full bg-sol-wash px-2 py-0.5 text-2xs font-black text-sol-ink">Prueba</span>}
                    </span>
                    <span className="num text-right font-black">{formatPrice(o.total)}</span>
                    <span className="truncate text-xs font-semibold text-ink-soft sm:text-sm">{summary(o)}</span>
                    <span className="text-right text-xs font-extrabold">
                      {o.status === 'reservada' ? (
                        <span className={clsx('inline-flex items-center gap-1', late ? 'text-peligro' : 'text-ink-soft')}>
                          <Clock className="size-3.5" aria-hidden /> {expiryText(o)}
                        </span>
                      ) : o.status === 'cancelada' ? (
                        <span className="text-ink-soft">{o.voidReason}</span>
                      ) : (
                        <span className="text-turquesa-ink">{o.status === 'anulada' ? 'Anulada' : `Retirado ${formatDate(o.at)}`}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <OrderDrawer order={orders.find((o) => o.id === open) ?? null} onClose={() => setOpen(null)} />
    </div>
  )
}

function OrderDrawer({ order, onClose }: { order: Sale | null; onClose: () => void }) {
  const settings = useInventory((s) => s.settings)
  const { complete, cancel } = useOrders()
  const [mode, setMode] = useState<'cobrar' | 'cancelar' | null>(null)
  const [pay, setPay] = useState<PaymentMethod>('efectivo')
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMode(null)
    setPay(order?.paymentMethod ?? 'efectivo')
    setReason(CANCEL_REASONS[0])
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  const print = (s: Sale) => settings && !printInvoice(s, settings) && toast({ tone: 'error', text: 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.' })

  const doComplete = async () => {
    if (!order) return
    setBusy(true)
    try {
      const sale = await complete(order.id, pay)
      toast({ tone: 'ok', text: `Entregado. Se emitió ${invoiceLabel(sale)}.` })
      setMode(null)
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo cobrar.' })
    } finally {
      setBusy(false)
    }
  }

  const doCancel = async () => {
    if (!order) return
    const why = reason === 'Otro' ? note.trim() : note.trim() ? `${reason}: ${note.trim()}` : reason
    if (!why) return
    setBusy(true)
    try {
      await cancel(order.id, why)
      toast({ tone: 'ok', text: `${reservationLabel(order.reservationCode!)} cancelada. El stock volvió a la tienda.` })
      setMode(null)
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo cancelar.' })
    } finally {
      setBusy(false)
    }
  }

  const title = order?.reservationCode ? reservationLabel(order.reservationCode) : 'Pedido'

  return (
    <Drawer open={!!order} onClose={onClose} title={title}>
      {order && (
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 pt-16 sm:p-6 sm:pt-16">
          <div>
            <p className="num text-3xl font-black">{title}</p>
            <p className="text-sm font-semibold text-ink-soft">
              Reservado el {new Date(order.reservedAt ?? order.at).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </div>

          {order.status === 'reservada' ? (
            <p className={clsx('flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold', isExpired(order) ? 'bg-peligro-wash text-peligro' : 'bg-sol-wash text-sol-ink')}>
              <Clock className="size-4 shrink-0" aria-hidden /> {expiryText(order)} · guardado hasta el {formatDate(order.expiresAt!)} {formatTime(order.expiresAt!)}
            </p>
          ) : order.status === 'cancelada' ? (
            <p className="rounded-2xl bg-peligro-wash px-4 py-3 text-sm font-bold text-peligro">
              Cancelado el {formatDate(order.voidedAt!)}: {order.voidReason}. El stock volvió al inventario.
            </p>
          ) : (
            <p className="rounded-2xl bg-turquesa-wash px-4 py-3 text-sm font-bold text-turquesa-ink">
              {order.status === 'anulada' ? `Retirado y luego anulado (${invoiceLabel(order)}).` : `Retirado y cobrado el ${formatDate(order.at)}: ${invoiceLabel(order)}.`}
            </p>
          )}
          {order.test && <p className="rounded-2xl bg-sol-wash px-4 py-3 text-sm font-bold text-sol-ink">Pedido de prueba.</p>}

          <div className="rounded-2xl bg-sunken p-4 text-sm">
            <p className="text-base font-extrabold">{order.customer.name}</p>
            <p className="font-semibold text-ink-soft">
              {order.customer.docType ? `${order.customer.docType} ${order.customer.doc}` : 'Sin documento'}
              {order.customer.email && (
                <>
                  {' · '}
                  <a href={`mailto:${order.customer.email}`} className="underline-offset-2 hover:underline">
                    {order.customer.email}
                  </a>
                </>
              )}
            </p>
            <p className="mt-1 font-semibold text-ink-soft">
              Pidió {order.invoiceType === 'A' ? 'factura A' : order.invoiceType === 'B' ? 'factura B' : 'comprobante X'} · {order.status === 'reservada' ? 'pagará con' : 'pagó con'}{' '}
              {paymentLabel(order.paymentMethod).toLowerCase()}
            </p>
          </div>

          <ul className="divide-y divide-line rounded-2xl border-2 border-line">
            {order.items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="num w-8 font-black">{i.qty}×</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{i.name}</span>
                  <span className="num text-xs font-semibold text-ink-soft">
                    {i.sku}
                    {i.discountPercent > 0 && <span className="font-bold text-coral-ink"> · promo −{i.discountPercent}%</span>}
                  </span>
                </span>
                <span className="num font-black">{formatPrice(i.unitFinal * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t-2 border-line pt-3">
            <span className="font-extrabold text-ink-soft">
              Total{order.couponCode && <span className="text-xs"> (cupón {order.couponCode} −{order.couponPercent}%)</span>}
            </span>
            <span className="num text-3xl font-black">{formatPrice(order.total)}</span>
          </div>

          <Button variant="secondary" onClick={() => print(order)}>
            <Printer className="size-4" aria-hidden /> {order.status === 'completada' || order.status === 'anulada' ? 'Imprimir comprobante' : 'Imprimir reserva'}
          </Button>

          {order.status === 'reservada' && (
            <div className="mt-auto flex flex-col gap-3 border-t-2 border-line pt-5">
              <AnimatePresence initial={false} mode="wait">
                {mode === 'cobrar' ? (
                  <motion.form
                    key="cobrar"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onSubmit={(e) => (e.preventDefault(), void doComplete())}
                    className="flex flex-col gap-3"
                  >
                    <p className="font-black">¿Con qué pagó?</p>
                    <div role="radiogroup" aria-label="Medio de pago" className="flex flex-wrap gap-2">
                      {PAYMENTS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={pay === m.id}
                          onClick={() => setPay(m.id)}
                          className={clsx('h-10 rounded-xl border-2 px-3 text-sm font-extrabold transition-colors', pay === m.id ? 'border-ink bg-ink text-ground' : 'border-line text-ink-soft hover:text-ink')}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" variant="primary" disabled={busy}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" aria-hidden />} Cobrar {formatPrice(order.total)} y entregar
                      </Button>
                      <Button variant="ghost" onClick={() => setMode(null)}>
                        Volver
                      </Button>
                    </div>
                  </motion.form>
                ) : mode === 'cancelar' ? (
                  <motion.form
                    key="cancelar"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onSubmit={(e) => (e.preventDefault(), void doCancel())}
                    className="flex flex-col gap-3"
                  >
                    <p className="font-black">¿Por qué se cancela?</p>
                    <div role="radiogroup" aria-label="Motivo" className="flex flex-wrap gap-2">
                      {CANCEL_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          role="radio"
                          aria-checked={reason === r}
                          onClick={() => setReason(r)}
                          className={clsx('h-10 rounded-xl border-2 px-3 text-sm font-extrabold transition-colors', reason === r ? 'border-ink bg-ink text-ground' : 'border-line text-ink-soft hover:text-ink')}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <Input
                      value={note}
                      maxLength={120}
                      onChange={(e) => setNote(e.target.value)}
                      aria-label="Nota"
                      placeholder={reason === 'Otro' ? 'Escribe el motivo (obligatorio)' : 'Nota (opcional)'}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" variant="danger" disabled={busy || (reason === 'Otro' && !note.trim())}>
                        {busy && <Loader2 className="size-4 animate-spin" />} Cancelar y devolver stock
                      </Button>
                      <Button variant="ghost" onClick={() => setMode(null)}>
                        Volver
                      </Button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div key="acciones" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => setMode('cobrar')}>
                      <PackageCheck className="size-4" aria-hidden /> Retiró y pagó
                    </Button>
                    <Button variant="danger" onClick={() => setMode('cancelar')}>
                      <X className="size-4" aria-hidden /> No vino / cancelar
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
