import { AnimatePresence, motion } from 'framer-motion'
import {
  LuCamera as Camera,
  LuCheck as Check,
  LuLoaderCircle as Loader2,
  LuMinus as Minus,
  LuPlus as Plus,
  LuPrinter as Printer,
  LuReceiptText as ReceiptText,
  LuRepeat as Repeat,
  LuScanBarcode as ScanBarcode,
  LuSearch as Search,
  LuTicket as Ticket,
  LuTrash2 as Trash2,
  LuX as X,
} from 'react-icons/lu'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { formatDate, formatPrice } from '@/lib/format'
import { priceFor, round2 } from '@/lib/pricing'
import { discountsApi, invoiceLabel, returnsApi } from '@/services/commerce'
import { paymentLabel, printInvoice } from '@/features/billing/invoiceHtml'
import { ProductThumb } from '@/features/inventory/components/ProductThumb'
import { CameraScanner, cameraScanSupported } from '@/features/quick-add/components/CameraScanner'
import { useScannerDetection } from '@/features/quick-add/hooks/useScannerDetection'
import { normalize } from '@/features/quick-add/parseList'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'
import type { InvoiceType, PaymentMethod, Sale } from '@/types'

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'mercadopago', label: 'Mercado Pago' },
]

type Line = { productId: string; qty: number }
/** Lo que el cliente trae de vuelta, por producto de la venta original. */
type ReturnLine = { qty: number; restock: boolean }
type Done = { docs: Sale[]; change: number | null; net: number }

/**
 * Venta en el mostrador: se escanea o busca, se arma el ticket y se cobra con comprobante.
 * Modo «Cambio o devolución»: se elige la venta original y lo que devuelve; si se lleva otra cosa,
 * se paga (o se devuelve) solo la diferencia.
 */
export default function SellPage() {
  const products = useInventory((s) => s.products)
  const categories = useInventory((s) => s.categories)
  const discounts = useInventory((s) => s.discounts)
  const settings = useInventory((s) => s.settings)
  const checkout = useSales((s) => s.checkout)
  const canReturn = useCan('ventas.devolver')
  const [params, setParams] = useSearchParams()

  const [q, setQ] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [pay, setPay] = useState<PaymentMethod>('efectivo')
  const [cash, setCash] = useState('')
  const [invoice, setInvoice] = useState<InvoiceType>('B')
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')
  const [couponText, setCouponText] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [camera, setCamera] = useState(false)
  const search = useRef<HTMLInputElement>(null)

  // Cambio o devolución
  const [finding, setFinding] = useState(false)
  const [original, setOriginal] = useState<Sale | null>(null)
  const [returns, setReturns] = useState<Record<string, ReturnLine>>({})
  const [reason, setReason] = useState('')

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // Desde Facturación: /vender?devolver=<id de la venta>
  useEffect(() => {
    const id = params.get('devolver')
    if (!id) return
    const sale = useSales.getState().sales.find((s) => s.id === id)
    setParams({}, { replace: true })
    if (!sale) return setFinding(true)
    void returnsApi.search(invoiceLabel(sale)).then((list) => {
      const found = list.find((s) => s.id === id)
      if (found) pickOriginal(found)
      else setFinding(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickOriginal = (sale: Sale) => {
    setOriginal(sale)
    setReturns({})
    setFinding(false)
    setCoupon(null)
    setDone(null)
    setError(null)
  }
  const exitExchange = () => {
    setOriginal(null)
    setReturns({})
    setReason('')
    setFinding(false)
  }

  const results = useMemo(() => {
    const t = normalize(q)
    if (!t) return []
    const words = t.split(' ').filter(Boolean)
    return products
      .filter((p) => !p.syncState)
      .filter((p) => p.sku.includes(q.trim()) || words.every((w) => normalize(`${p.name} ${p.brand}`).includes(w)))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name, 'es'))
      .slice(0, 30)
  }, [products, q])

  const rows = lines
    .map((l) => {
      const p = byId.get(l.productId)
      if (!p) return null
      const price = priceFor(p, discounts)
      return { ...l, p, price, total: round2(price.final * l.qty) }
    })
    .filter((r) => r !== null)

  const exchange = !!original
  const subtotal = round2(rows.reduce((a, r) => a + r.price.list * r.qty, 0))
  const afterPromos = round2(rows.reduce((a, r) => a + r.total, 0))
  const newTotal = round2(afterPromos * (1 - (exchange ? 0 : (coupon?.percent ?? 0)) / 100))
  // Lo que pagó por lo que devuelve (con su promo y su cupón de entonces).
  const retRows = original
    ? original.items
        .map((i) => ({ i, ret: returns[i.productId], left: i.qty - (original.returned?.[i.productId] ?? 0) }))
        .filter((r) => r.left > 0)
    : []
  const credit = original
    ? round2(round2(retRows.reduce((a, r) => a + (r.ret?.qty ?? 0) * r.i.unitFinal, 0)) * (1 - original.couponPercent / 100))
    : 0
  const returningUnits = retRows.reduce((a, r) => a + (r.ret?.qty ?? 0), 0)
  // Neto: positivo paga el cliente, negativo se le devuelve.
  const net = round2(newTotal - credit)
  const units = rows.reduce((a, r) => a + r.qty, 0)
  const cashN = Number(cash.replace(/\./g, '').replace(',', '.'))
  const change = pay === 'efectivo' && net > 0 && cash.trim() && Number.isFinite(cashN) ? round2(cashN - net) : null

  const add = (id: string) => {
    const p = byId.get(id)
    if (!p) return
    const inTicket = lines.find((l) => l.productId === id)?.qty ?? 0
    if (inTicket >= p.stock) {
      toast({ tone: 'error', text: p.stock ? `Solo hay ${p.stock} de «${p.name}» en stock.` : `«${p.name}» no tiene stock.` })
      return
    }
    setLines((ls) => (inTicket ? ls.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { productId: id, qty: 1 }]))
    setError(null)
    setDone(null)
  }
  const setQty = (id: string, qty: number) => {
    const max = byId.get(id)?.stock ?? 0
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.productId !== id) : ls.map((l) => (l.productId === id ? { ...l, qty: Math.min(qty, max) } : l))))
  }
  const setReturn = (productId: string, patch: Partial<ReturnLine>) =>
    setReturns((r) => ({ ...r, [productId]: { qty: r[productId]?.qty ?? 0, restock: r[productId]?.restock ?? true, ...patch } }))

  /** Código exacto (lector, cámara o tecleado) → al ticket. */
  const addByCode = (code: string) => {
    const p = products.find((x) => x.sku === code.trim())
    if (!p) {
      toast({ tone: 'error', text: `No hay ningún producto con el código ${code}.` })
      return false
    }
    add(p.id)
    setQ('')
    return true
  }
  useScannerDetection({ onScan: (code) => void addByCode(code), enabled: !camera && !finding })

  const applyCoupon = async () => {
    if (!couponText.trim()) return
    setCouponBusy(true)
    try {
      const c = await discountsApi.checkCoupon(couponText.trim())
      if (!c) toast({ tone: 'error', text: 'Ese cupón no existe o ya venció.' })
      setCoupon(c)
    } finally {
      setCouponBusy(false)
    }
  }

  const reset = () => {
    setLines([])
    setCash('')
    setName('')
    setDoc('')
    setCoupon(null)
    setCouponText('')
    setInvoice('B')
    setPay('efectivo')
    setError(null)
    exitExchange()
    search.current?.focus()
  }

  const charge = async () => {
    setError(null)
    if (change !== null && change < 0) {
      setError(`Faltan ${formatPrice(-change)}: el cliente pagó menos que el total.`)
      return
    }
    if (original) {
      if (!returningUnits) return setError('Elige qué devuelve el cliente.')
      setBusy(true)
      try {
        const res = await returnsApi.exchange({
          saleId: original.id,
          returns: Object.entries(returns)
            .filter(([, r]) => r.qty > 0)
            .map(([productId, r]) => ({ productId, qty: r.qty, restock: r.restock })),
          items: rows.map((r) => ({ productId: r.productId, qty: r.qty })),
          paymentMethod: pay,
          reason,
        })
        void useInventory.getState().refreshProducts()
        if (useSales.getState().status === 'ready') void useSales.getState().load(true)
        setDone({ docs: [res.credit, ...(res.sale ? [res.sale] : [])], change, net })
        reset()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo registrar. Intenta de nuevo.')
      } finally {
        setBusy(false)
      }
      return
    }
    if (!rows.length) return
    if (invoice === 'A' && (!/^\d{11}$/.test(doc.replace(/\D/g, '')) || !name.trim())) {
      setError('Para factura A hacen falta la razón social y un CUIT de 11 dígitos.')
      return
    }
    setBusy(true)
    try {
      const digits = doc.replace(/\D/g, '')
      const sale = await checkout({
        channel: 'mostrador',
        items: rows.map((r) => ({ productId: r.productId, qty: r.qty })),
        couponCode: coupon?.code,
        customer: { name: name.trim() || 'Consumidor final', email: '', docType: invoice === 'A' ? 'CUIT' : digits ? 'DNI' : '', doc: digits },
        paymentMethod: pay,
        invoiceType: invoice,
        test: false,
      })
      setDone({ docs: [sale], change, net: sale.total })
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cobrar. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const print = (s: Sale) => settings && !printInvoice(s, settings) && toast({ tone: 'error', text: 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.' })
  const showTotals = rows.length > 0 || exchange
  const actionLabel = exchange ? (net > 0 ? `Cobrar diferencia ${formatPrice(net)}` : net < 0 ? `Devolver ${formatPrice(-net)}` : 'Confirmar cambio') : `Cobrar ${formatPrice(newTotal)}`

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Vender</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Venta en el local: escanea o busca, arma el ticket y cobra. Descuenta stock y emite el comprobante.</p>
        </div>
        {canReturn && !exchange && (
          <Button variant="secondary" onClick={() => setFinding((f) => !f)} aria-expanded={finding}>
            <Repeat className="size-4" aria-hidden /> Cambio o devolución
          </Button>
        )}
      </header>

      <AnimatePresence initial={false}>{finding && <FindOriginal onPick={pickOriginal} onClose={() => setFinding(false)} />}</AnimatePresence>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex flex-col gap-5">
          {original && (
            <ReturnPicker
              sale={original}
              rows={retRows}
              returns={returns}
              setReturn={setReturn}
              onCancel={exitExchange}
            />
          )}

          {/* Buscar y agregar */}
          <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card sm:p-5" aria-label={exchange ? 'Lo que se lleva a cambio' : 'Agregar productos'}>
            {exchange && <h2 className="font-black">¿Se lleva algo a cambio? (opcional)</h2>}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!q.trim()) return
                if (products.some((p) => p.sku === q.trim())) addByCode(q)
                else if (results.length === 1) (add(results[0].id), setQ(''))
              }}
            >
              <label className="relative flex-1">
                <span className="sr-only">Buscar producto</span>
                <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
                <input
                  ref={search}
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Escanea o escribe nombre, marca o código"
                  className="h-12 w-full rounded-xl border-2 border-line bg-ground pl-11 pr-4 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
                />
              </label>
              {cameraScanSupported() && (
                <Button type="button" variant="secondary" className="h-12" onClick={() => setCamera(true)} aria-label="Escanear con la cámara">
                  <Camera className="size-5" aria-hidden /> <span className="hidden sm:inline">Cámara</span>
                </Button>
              )}
            </form>

            {!q.trim() ? (
              <p className="rounded-2xl bg-sunken px-4 py-8 text-center text-sm font-semibold text-ink-soft">
                {exchange
                  ? 'Si solo devuelve, déjalo vacío: se le devuelve el dinero. Si cambia, escanea lo que se lleva.'
                  : 'Con lector de códigos, solo escanea: el producto se suma al ticket. Si no, escribe parte del nombre.'}
              </p>
            ) : results.length === 0 ? (
              <p className="rounded-2xl bg-sunken px-4 py-8 text-center text-sm font-semibold text-ink-soft">Ningún producto coincide con «{q}».</p>
            ) : (
              <ul className="flex max-h-[60vh] flex-col divide-y divide-line overflow-y-auto rounded-2xl border-2 border-line">
                {results.map((p) => {
                  const price = priceFor(p, discounts)
                  const inTicket = lines.find((l) => l.productId === p.id)?.qty ?? 0
                  const out = p.stock - inTicket <= 0
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => add(p.id)}
                        disabled={out}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-sunken/70 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="w-11 shrink-0">
                          <ProductThumb category={categories.find((c) => c.id === p.categoryId)} imageUrl={p.photos[0]} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">{p.name}</span>
                          <span className="num block truncate text-xs font-semibold text-ink-soft">
                            {p.sku} · {p.stock ? `${p.stock - inTicket} disponibles` : 'Sin stock'}
                            {inTicket > 0 && ` · ${inTicket} en el ticket`}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="num block font-black">{formatPrice(price.final)}</span>
                          {price.percent > 0 && <span className="num block text-xs font-bold text-coral-ink">−{price.percent}%</span>}
                        </span>
                        {!out && <Plus className="size-5 shrink-0 text-ink-soft" aria-hidden />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Ticket */}
        <section aria-label="Ticket" className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card sm:p-5 lg:sticky lg:top-6">
          <AnimatePresence initial={false}>
            {done && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-3 rounded-2xl bg-turquesa-wash p-4"
                role="status"
              >
                <p className="flex items-start gap-2 font-black text-turquesa-ink">
                  <Check className="mt-0.5 size-5 shrink-0" strokeWidth={3} aria-hidden />
                  <span>
                    {done.docs[0].creditFor ? (done.docs.length > 1 ? 'Cambio registrado' : 'Devolución registrada') : 'Venta cobrada'} ·{' '}
                    {done.docs.map((d) => invoiceLabel(d)).join(' + ')}
                  </span>
                </p>
                <p className="text-sm font-bold text-turquesa-ink">
                  {done.net > 0
                    ? `Cobrado ${formatPrice(done.net)} en ${paymentLabel(done.docs[done.docs.length - 1].paymentMethod).toLowerCase()}`
                    : done.net < 0
                      ? `Se devolvieron ${formatPrice(-done.net)} en ${paymentLabel(done.docs[0].paymentMethod).toLowerCase()}`
                      : 'Sin diferencia de dinero'}
                  {done.change !== null && done.change > 0 && (
                    <>
                      {' '}
                      · Vuelto: <span className="num text-base font-black">{formatPrice(done.change)}</span>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {done.docs.map((d) => (
                    <Button key={d.id} size="sm" variant="secondary" onClick={() => print(d)}>
                      <Printer className="size-4" aria-hidden /> {d.creditFor ? 'Imprimir nota de crédito' : 'Imprimir comprobante'}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setDone(null)}>
                    Cerrar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-baseline justify-between">
            <h2 className="font-black">{exchange ? 'Cambio o devolución' : 'Ticket'}</h2>
            {(rows.length > 0 || exchange) && (
              <button onClick={reset} className="text-sm font-extrabold text-ink-soft hover:text-peligro">
                {exchange ? 'Cancelar' : 'Vaciar'}
              </button>
            )}
          </div>

          {exchange && (
            <div className="flex flex-col gap-1 rounded-2xl bg-coral-wash px-4 py-3 text-sm">
              <span className="flex justify-between font-bold text-coral-ink">
                <span>Devuelve ({returningUnits} u)</span>
                <span className="num">−{formatPrice(credit)}</span>
              </span>
              {!returningUnits && <span className="text-xs font-semibold text-coral-ink">Marca a la izquierda qué trae el cliente.</span>}
            </div>
          )}

          {rows.length === 0 ? (
            !exchange && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center">
                <ReceiptText className="size-8 text-ink-soft" strokeWidth={1.8} aria-hidden />
                <p className="text-sm font-bold text-ink-soft">El ticket está vacío</p>
              </div>
            )
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {exchange && <li className="pb-1 text-xs font-extrabold text-ink-soft">Se lleva</li>}
              <AnimatePresence initial={false}>
                {rows.map((r) => (
                  <motion.li key={r.productId} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-1.5 py-2.5">
                    <span className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 text-sm font-extrabold leading-snug">{r.p.name}</span>
                      <span className="num shrink-0 whitespace-nowrap font-black">{formatPrice(r.total)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="num min-w-0 flex-1 text-xs font-semibold text-ink-soft">
                        {formatPrice(r.price.final)} c/u{r.price.percent > 0 && <span className="font-bold text-coral-ink"> · −{r.price.percent}%</span>}
                      </span>
                      <Stepper
                        value={r.qty}
                        onChange={(n) => setQty(r.productId, n)}
                        max={r.p.stock}
                        name={r.p.name}
                      />
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {showTotals && (
            <>
              {!exchange &&
                (coupon ? (
                  <p className="flex items-center gap-2 rounded-xl bg-coral-wash px-3 py-2 text-sm font-bold text-coral-ink">
                    <Ticket className="size-4" aria-hidden /> Cupón {coupon.code} −{coupon.percent}%
                    <button onClick={() => setCoupon(null)} aria-label="Quitar cupón" className="ml-auto grid size-6 place-items-center rounded-full hover:bg-coral/20">
                      <X className="size-4" aria-hidden />
                    </button>
                  </p>
                ) : (
                  <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), void applyCoupon())}>
                    <Input value={couponText} onChange={(e) => setCouponText(e.target.value.toUpperCase())} placeholder="Cupón (opcional)" aria-label="Cupón" className="h-10" />
                    <Button type="submit" size="sm" variant="secondary" className="h-10" disabled={couponBusy || !couponText.trim()}>
                      {couponBusy ? <Loader2 className="size-4 animate-spin" /> : 'Aplicar'}
                    </Button>
                  </form>
                ))}

              <dl className="flex flex-col gap-1 text-sm">
                {exchange ? (
                  <>
                    <div className="flex justify-between font-semibold text-ink-soft">
                      <dt>Se lleva ({units} u)</dt>
                      <dd className="num">{formatPrice(newTotal)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold text-coral-ink">
                      <dt>Devuelve</dt>
                      <dd className="num">−{formatPrice(credit)}</dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between font-semibold text-ink-soft">
                      <dt>Subtotal ({units} u)</dt>
                      <dd className="num">{formatPrice(subtotal)}</dd>
                    </div>
                    {subtotal - newTotal > 0.004 && (
                      <div className="flex justify-between font-semibold text-coral-ink">
                        <dt>Descuentos</dt>
                        <dd className="num">−{formatPrice(round2(subtotal - newTotal))}</dd>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-1 flex items-baseline justify-between border-t-2 border-line pt-2">
                  <dt className="font-black">{exchange ? (net > 0 ? 'Paga la diferencia' : net < 0 ? 'Se le devuelve' : 'Sin diferencia') : 'Total'}</dt>
                  <dd className="num text-3xl font-black">{formatPrice(Math.abs(exchange ? net : newTotal))}</dd>
                </div>
              </dl>

              {(!exchange || net !== 0) && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-extrabold text-ink-soft">{exchange && net < 0 ? 'Se devuelve con' : 'Medio de pago'}</span>
                  <div role="radiogroup" aria-label="Medio de pago" className="flex flex-wrap gap-1.5">
                    {PAYMENTS.map((m) => (
                      <button
                        key={m.id}
                        role="radio"
                        aria-checked={pay === m.id}
                        onClick={() => setPay(m.id)}
                        className={clsx('h-9 rounded-xl border-2 px-2.5 text-sm font-extrabold transition-colors', pay === m.id ? 'border-ink bg-ink text-ground' : 'border-line text-ink-soft hover:text-ink')}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {pay === 'efectivo' && net > 0 && (
                    <label className="flex items-center gap-3">
                      <span className="shrink-0 text-sm font-bold">Paga con</span>
                      <Input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="$ (opcional)" className="num h-10" />
                      {change !== null && (
                        <span className={clsx('num shrink-0 text-sm font-black', change < 0 ? 'text-peligro' : 'text-turquesa-ink')}>
                          {change < 0 ? `Faltan ${formatPrice(-change)}` : `Vuelto ${formatPrice(change)}`}
                        </span>
                      )}
                    </label>
                  )}
                </div>
              )}

              {exchange ? (
                <Input value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional): talle, falla, no le gustó…" aria-label="Motivo" className="h-10" />
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-extrabold text-ink-soft">Comprobante</span>
                  <div role="radiogroup" aria-label="Comprobante" className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['B', 'Factura B'],
                        ['A', 'Factura A'],
                        ['X', 'Comprob. X'],
                      ] as [InvoiceType, string][]
                    ).map(([t, label]) => (
                      <button
                        key={t}
                        role="radio"
                        aria-checked={invoice === t}
                        onClick={() => setInvoice(t)}
                        className={clsx('h-9 rounded-xl border-2 text-sm font-extrabold transition-colors', invoice === t ? 'border-ink bg-ink text-ground' : 'border-line text-ink-soft hover:text-ink')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={invoice === 'A' ? 'Razón social' : 'Cliente (opcional)'} aria-label="Cliente" className="h-10" />
                    <Input
                      inputMode="numeric"
                      value={doc}
                      onChange={(e) => setDoc(e.target.value)}
                      placeholder={invoice === 'A' ? 'CUIT (11 dígitos)' : 'DNI (opcional)'}
                      aria-label={invoice === 'A' ? 'CUIT' : 'DNI'}
                      className="num h-10"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-xl bg-peligro-wash px-3 py-2 text-sm font-bold text-peligro">
                  {error}
                </p>
              )}

              <Button variant={exchange && net < 0 ? 'danger' : 'primary'} className="h-14 text-lg" disabled={busy || (exchange && !returningUnits)} onClick={() => void charge()}>
                {busy ? <Loader2 className="size-5 animate-spin" /> : exchange ? <Repeat className="size-5" aria-hidden /> : <Check className="size-5" strokeWidth={3} aria-hidden />} {actionLabel}
              </Button>
            </>
          )}
        </section>
      </div>

      <CameraScanner
        open={camera}
        onClose={() => setCamera(false)}
        onScan={(code) => {
          if (addByCode(code)) setCamera(false)
        }}
      />
    </div>
  )
}

function Stepper({ value, onChange, max, min = 0, name }: { value: number; onChange: (n: number) => void; max: number; min?: number; name: string }) {
  return (
    <span className="flex shrink-0 items-center rounded-xl bg-sunken">
      <button onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Quitar uno de ${name}`} className="grid size-9 place-items-center rounded-xl hover:bg-line disabled:opacity-40">
        {value === 1 && min === 0 ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
      </button>
      <span className="num w-7 text-center font-black">{value}</span>
      <button onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Sumar uno de ${name}`} className="grid size-9 place-items-center rounded-xl hover:bg-line disabled:opacity-40">
        <Plus className="size-4" aria-hidden />
      </button>
    </span>
  )
}

/** Buscar la venta original por número de comprobante, nombre o DNI. */
function FindOriginal({ onPick, onClose }: { onPick: (s: Sale) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Sale[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!/\d/.test(q) && q.trim().length < 2) return setList(null)
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      returnsApi
        .search(q)
        .then((r) => alive && setList(r))
        .catch((e) => alive && toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo buscar.' }))
        .finally(() => alive && setBusy(false))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  return (
    <motion.section
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
      aria-label="Buscar la venta original"
    >
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-coral/50 bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-black">¿De qué venta es lo que trae?</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sunken hover:text-ink">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <label className="relative">
          <span className="sr-only">Número de comprobante, nombre o DNI</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Número del ticket (ej. 12), nombre o DNI"
            className="h-12 w-full rounded-xl border-2 border-line bg-ground pl-11 pr-10 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
          />
          {busy && <Loader2 className="absolute right-3.5 top-1/2 size-5 -translate-y-1/2 animate-spin text-ink-soft" />}
        </label>
        {list &&
          (list.length === 0 ? (
            <p className="rounded-2xl bg-sunken px-4 py-6 text-center text-sm font-semibold text-ink-soft">No hay ventas cobradas de los últimos 6 meses con «{q}».</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-2xl border-2 border-line">
              {list.map((s) => (
                <li key={s.id}>
                  <button onClick={() => onPick(s)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3 text-left hover:bg-sunken/70">
                    <span className="num truncate text-sm font-extrabold">{invoiceLabel(s)}</span>
                    <span className="num text-right font-black">{formatPrice(s.total)}</span>
                    <span className="truncate text-xs font-semibold text-ink-soft">
                      {s.customer.name} · {formatDate(s.at)} · {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </motion.section>
  )
}

/** Productos de la venta original: cuántos devuelve y si vuelven al stock. */
function ReturnPicker({
  sale,
  rows,
  returns,
  setReturn,
  onCancel,
}: {
  sale: Sale
  rows: { i: Sale['items'][number]; ret?: ReturnLine; left: number }[]
  returns: Record<string, ReturnLine>
  setReturn: (productId: string, patch: Partial<ReturnLine>) => void
  onCancel: () => void
}) {
  return (
    <motion.section initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 rounded-3xl border-2 border-coral/50 bg-surface p-4 shadow-card sm:p-5" aria-label="Lo que devuelve">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-black">¿Qué devuelve?</h2>
          <p className="num text-sm font-semibold text-ink-soft">
            {invoiceLabel(sale)} · {sale.customer.name} · {formatDate(sale.at)}
            {sale.couponPercent > 0 && ` · cupón −${sale.couponPercent}%`}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Otra venta
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-sunken px-4 py-6 text-center text-sm font-semibold text-ink-soft">De esta venta ya se devolvió todo.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border-2 border-line">
          {rows.map(({ i, left }) => {
            const r = returns[i.productId]
            const qty = r?.qty ?? 0
            return (
              <li key={i.productId} className="flex flex-col gap-2 px-4 py-3">
                <span className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 text-sm font-extrabold">{i.name}</span>
                  <span className="num text-xs font-semibold text-ink-soft">
                    pagó {formatPrice(i.unitFinal)} c/u · {left < i.qty ? `quedan ${left} de ${i.qty}` : `${i.qty} comprado${i.qty > 1 ? 's' : ''}`}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Stepper value={qty} onChange={(n) => setReturn(i.productId, { qty: Math.max(0, Math.min(left, n)) })} max={left} name={i.name} />
                  {qty > 0 && (
                    <span role="radiogroup" aria-label={`Estado de ${i.name}`} className="flex gap-1 rounded-xl bg-sunken p-1">
                      {(
                        [
                          [true, 'Vuelve al stock'],
                          [false, 'Dañado'],
                        ] as const
                      ).map(([v, label]) => (
                        <button
                          key={label}
                          role="radio"
                          aria-checked={(r?.restock ?? true) === v}
                          onClick={() => setReturn(i.productId, { restock: v })}
                          className={clsx('h-8 rounded-lg px-2.5 text-xs font-extrabold', (r?.restock ?? true) === v ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink')}
                        >
                          {label}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs font-semibold text-ink-soft">Se devuelve lo que pagó (con su promoción y cupón de entonces). Lo dañado no vuelve al stock y su costo queda como pérdida.</p>
    </motion.section>
  )
}
