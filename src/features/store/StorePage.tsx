import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { LuArrowDown, LuCalendarHeart, LuCheck, LuLoaderCircle, LuMinus, LuPlus, LuPrinter, LuSearch, LuShoppingBag, LuStore, LuTicket, LuTrash2, LuX } from 'react-icons/lu'
import { SiDragonframe } from 'react-icons/si'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import { STORE } from '@/lib/config'
import { nextOccurrence } from '@/lib/defaults'
import { formatAge, formatPrice } from '@/lib/format'
import { priceFor, round2 } from '@/lib/pricing'
import { publicCatalog, salesApi, settingsApi } from '@/services/commerce'
import { discountsApi } from '@/services/commerce'
import { categoryIcon } from '@/features/inventory/components/ProductThumb'
import { printInvoice } from '@/features/billing/invoiceHtml'
import type { Category, Discount, InvoiceType, PaymentMethod, Sale, Season } from '@/types'
import { useCart } from './cart'
import { Dragon } from './Dragon'

type Catalog = Awaited<ReturnType<typeof publicCatalog>>
type Item = Catalog['products'][number]

const AGES = [
  { id: '0', label: 'Bebés', test: (a: number) => a <= 2 },
  { id: '3', label: '3 a 5', test: (a: number) => a >= 3 && a <= 5 },
  { id: '6', label: '6 a 8', test: (a: number) => a >= 6 && a <= 8 },
  { id: '9', label: '9 y más', test: (a: number) => a >= 9 },
]

export default function StorePage() {
  const [data, setData] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState<string | null>(null)
  const [age, setAge] = useState<string | null>(null)
  const [season, setSeason] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [done, setDone] = useState<Sale | null>(null)
  const lines = useCart((s) => s.lines)
  const add = useCart((s) => s.add)
  const bag = useAnimationControls()
  const count = lines.reduce((a, l) => a + l.qty, 0)

  const load = () =>
    publicCatalog()
      .then(setData)
      .catch(() => setError('No pudimos cargar los juguetes. Recarga la página.'))

  useEffect(() => {
    document.title = `${STORE.name} · Tienda de juguetes`
    void load()
  }, [])

  const products = useMemo(() => {
    if (!data) return []
    const t = q.trim().toLowerCase()
    return data.products.filter(
      (p) =>
        (!cat || p.categoryId === cat) &&
        (!season || p.seasons.includes(season)) &&
        (!age || AGES.find((a) => a.id === age)!.test(p.ageMin)) &&
        (!t || p.name.toLowerCase().includes(t) || p.brand.toLowerCase().includes(t)),
    )
  }, [data, cat, season, age, q])

  const next = useMemo(() => {
    if (!data?.seasons.length) return null
    return data.seasons.map((s) => ({ s, ...nextOccurrence(s.rule) })).sort((a, b) => a.days - b.days)[0]
  }, [data])

  const onAdd = (p: Item) => {
    if (add(p.id, p.stock)) void bag.start({ scale: [1, 1.35, 0.9, 1.1, 1], rotate: [0, -12, 10, -4, 0], transition: { duration: 0.6 } })
  }

  return (
    <div className="min-h-dvh bg-ground text-ink">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-rail/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <a href="/tienda" className="flex items-center gap-2.5 text-xl font-black tracking-tight text-white">
            <span className="grid size-10 place-items-center logo-tile rounded-xl">
              <SiDragonframe className="size-6" aria-hidden />
            </span>
            {STORE.name}
          </a>
          <label className="relative ml-auto hidden max-w-xs flex-1 sm:block">
            <span className="sr-only">Buscar juguetes</span>
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-rail-ink" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar juguetes"
              className="h-10 w-full rounded-full border-2 border-white/15 bg-white/10 pl-9 pr-4 text-sm font-bold text-white placeholder:text-rail-ink focus:border-sol focus:outline-none"
            />
          </label>
          <motion.button
            animate={bag}
            onClick={() => setCartOpen(true)}
            className="relative ml-auto flex h-11 items-center gap-2 rounded-full bg-sol px-4 font-black text-on-fill shadow-[0_3px_0_rgb(0_0_0/0.25)] sm:ml-0"
            aria-label={`Carrito: ${count} productos`}
          >
            <LuShoppingBag className="size-5" aria-hidden />
            <span className="num">{count}</span>
          </motion.button>
        </div>
      </header>

      <Hero next={next} />

      <main id="juguetes" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Elige tu juguete</h2>
          <p className="font-semibold text-ink-soft">Precios en pesos con IVA incluido. Retiras en el local y pagas ahí.</p>
        </div>

        {data && (
          <div className="flex flex-col gap-3">
            <label className="relative sm:hidden">
              <span className="sr-only">Buscar juguetes</span>
              <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar juguetes" className="h-12 w-full rounded-2xl border-2 border-line bg-surface pl-11 pr-4 font-bold focus:border-turquesa focus:outline-none" />
            </label>
            <ChipRow label="Categoría">
              <Chip on={!cat} onClick={() => setCat(null)}>
                Todo
              </Chip>
              {data.categories
                .filter((c) => data.products.some((p) => p.categoryId === c.id))
                .map((c) => (
                  <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} color={c.color}>
                    {c.name}
                  </Chip>
                ))}
            </ChipRow>
            <ChipRow label="Edad">
              {AGES.map((a) => (
                <Chip key={a.id} on={age === a.id} onClick={() => setAge(age === a.id ? null : a.id)}>
                  {a.label}
                </Chip>
              ))}
              {data.seasons.map((s) => (
                <Chip key={s.id} on={season === s.id} onClick={() => setSeason(season === s.id ? null : s.id)} color={s.color}>
                  <LuCalendarHeart className="size-4" aria-hidden /> {s.name}
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}

        {error ? (
          <p className="rounded-3xl bg-peligro-wash p-8 text-center font-bold text-peligro">{error}</p>
        ) : !data ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-sunken" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line px-6 py-16 text-center">
            <SiDragonframe className="size-12 text-ink-soft" aria-hidden />
            <p className="text-lg font-black">{data.products.length ? 'Ningún juguete con esos filtros' : 'Estamos reponiendo la juguetería'}</p>
            <p className="text-sm font-semibold text-ink-soft">{data.products.length ? 'Prueba con otra categoría o edad.' : 'Vuelve pronto: el dragón está trayendo juguetes nuevos.'}</p>
          </div>
        ) : (
          <motion.ul layout className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence>
              {products.map((p, i) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  i={i}
                  category={data.categories.find((c) => c.id === p.categoryId)}
                  discounts={data.discounts}
                  inCart={lines.find((l) => l.productId === p.id)?.qty ?? 0}
                  onAdd={() => onAdd(p)}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </main>

      <footer className="bg-rail px-4 py-10 text-center text-sm font-semibold text-rail-ink">
        <SiDragonframe className="mx-auto mb-3 size-8 text-sol" aria-hidden />
        {STORE.name} · Juguetería · {STORE.country}
      </footer>

      <CartPanel
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        catalog={data}
        onDone={(sale) => {
          setCartOpen(false)
          setDone(sale)
          void load()
        }}
      />
      <AnimatePresence>{done && <SuccessModal sale={done} onClose={() => setDone(null)} />}</AnimatePresence>
    </div>
  )
}

function Hero({ next }: { next: { s: Season; days: number } | null }) {
  const [roars, setRoars] = useState(0)
  return (
    <section className="relative overflow-hidden bg-rail pb-16 pt-8 text-white">
      {/* Brasas que suben lento detrás del dragón */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute size-1.5 rounded-full bg-sol"
            style={{ left: `${(i * 37) % 100}%`, bottom: '-10px' }}
            animate={{ y: [0, -520], opacity: [0, 0.8, 0] }}
            transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: i * 0.45, ease: 'easeOut' }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 text-center">
        {next && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx('mb-2 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black text-on-fill', BOARD[next.s.color].fill)}
          >
            <LuCalendarHeart className="size-4" aria-hidden />
            {next.days === 0 ? `¡Hoy es ${next.s.name}!` : `Faltan ${next.days} días para ${next.s.name}`}
          </motion.p>
        )}
        <Dragon onRoar={() => setRoars((r) => r + 1)} />
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 120 }}
          className="relative z-30 mt-10 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl"
        >
          Juguetes con fuego de dragón
        </motion.h1>
        <p className="relative z-30 mt-4 max-w-xl text-lg font-semibold text-rail-ink">
          {roars === 0 ? 'Tócale la cabeza al dragón y mira lo que pasa.' : roars < 3 ? '¡Otra vez! Le encanta.' : 'Ya lo despertaste del todo. Ahora, a elegir juguetes.'}
        </p>
        <motion.a
          href="#juguetes"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.96 }}
          className="relative z-30 mt-7 inline-flex h-14 items-center gap-2 rounded-full bg-sol px-7 text-lg font-black text-on-fill shadow-[0_5px_0_rgb(0_0_0/0.25)]"
        >
          Ver juguetes <LuArrowDown className="size-5" aria-hidden />
        </motion.a>
      </div>
    </section>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {children}
    </div>
  )
}

function Chip({ on, onClick, color, children }: { on: boolean; onClick: () => void; color?: Category['color']; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        'flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-extrabold transition-colors',
        on ? (color ? clsx(BOARD[color].fill, 'text-on-fill') : 'bg-ink text-ground') : 'bg-surface text-ink-soft shadow-card hover:text-ink',
      )}
    >
      {color && !on && <span className={clsx('size-2.5 rounded-full', BOARD[color].fill)} aria-hidden />}
      {children}
    </motion.button>
  )
}

function ProductCard({ p, i, category, discounts, inCart, onAdd }: { p: Item; i: number; category?: Category; discounts: Discount[]; inCart: number; onAdd: () => void }) {
  const price = priceFor(p, discounts)
  const Icon = categoryIcon(category)
  const color = category?.color ?? 'sol'
  const left = p.stock - inCart
  const [pop, setPop] = useState(0)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: Math.min(i, 12) * 0.03 }}
      whileHover={{ y: -6, rotate: i % 2 ? 0.8 : -0.8 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl bg-surface shadow-card"
    >
      <div className={clsx('relative grid aspect-square place-items-center overflow-hidden', BOARD[color].wash)}>
        <div className={clsx('absolute inset-x-0 top-0 h-3', BOARD[color].fill)} />
        {p.photos[0] ? (
          <img src={p.photos[0]} alt={p.name} className="size-full object-cover" loading="lazy" />
        ) : (
          <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut' }}>
            <Icon className={clsx('size-20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6', BOARD[color].ink)} aria-hidden />
          </motion.span>
        )}
        {price.percent > 0 && (
          <motion.span
            initial={{ rotate: -30, scale: 0 }}
            animate={{ rotate: -12, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.2 }}
            className="num absolute right-2 top-5 grid size-14 place-items-center rounded-full bg-coral text-sm font-black text-on-fill shadow-card"
          >
            −{price.percent}%
          </motion.span>
        )}
        {p.stock <= 3 && <span className="absolute bottom-2 left-2 rounded-full bg-ink/85 px-2.5 py-1 text-2xs font-black text-ground">¡Últimas {p.stock}!</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <p className="line-clamp-2 text-sm font-extrabold leading-snug sm:text-base">{p.name}</p>
        <p className="text-xs font-bold text-ink-soft">
          {formatAge(p.ageMin)}
          {p.batteries && ' · usa pilas'}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            {price.percent > 0 && <p className="num text-xs font-bold text-ink-soft line-through">{formatPrice(price.list)}</p>}
            <p className="num text-lg font-black leading-none sm:text-xl">{formatPrice(price.final)}</p>
          </div>
          <motion.button
            key={pop}
            onClick={() => {
              onAdd()
              setPop((n) => n + 1)
            }}
            disabled={left <= 0}
            initial={pop ? { scale: 0.6, rotate: -20 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 12 }}
            whileHover={{ scale: 1.1 }}
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-sol disabled:opacity-30"
            aria-label={left <= 0 ? `Sin más stock de ${p.name}` : `Agregar ${p.name} al carrito`}
          >
            {inCart > 0 ? <span className="num text-sm font-black">{inCart}</span> : <LuPlus className="size-5" strokeWidth={3} />}
          </motion.button>
        </div>
      </div>
    </motion.li>
  )
}

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'mercadopago', label: 'Mercado Pago' },
]

function CartPanel({ open, onClose, catalog, onDone }: { open: boolean; onClose: () => void; catalog: Catalog | null; onDone: (s: Sale) => void }) {
  const { lines, setQty, remove, clear } = useCart()
  const [step, setStep] = useState<'carrito' | 'datos'>('carrito')
  const [coupon, setCoupon] = useState('')
  const [couponOk, setCouponOk] = useState<{ code: string; percent: number } | null>(null)
  const [couponErr, setCouponErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [invoice, setInvoice] = useState<InvoiceType>('B')
  const [doc, setDoc] = useState('')
  const [pay, setPay] = useState<PaymentMethod>('efectivo')
  const [test, setTest] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setStep('carrito')
  }, [open])

  const rows = lines
    .map((l) => ({ l, p: catalog?.products.find((p) => p.id === l.productId) }))
    .filter((r): r is { l: (typeof lines)[number]; p: Item } => !!r.p)
  const missing = lines.length - rows.length
  const subtotal = rows.reduce((a, r) => a + priceFor(r.p, catalog?.discounts ?? []).final * r.l.qty, 0)
  const total = round2(subtotal * (1 - (couponOk?.percent ?? 0) / 100))

  const applyCoupon = async () => {
    setCouponErr(null)
    const c = await discountsApi.checkCoupon(coupon).catch(() => null)
    if (c) setCouponOk(c)
    else {
      setCouponOk(null)
      setCouponErr('Ese cupón no existe o ya venció.')
    }
  }

  const checkout = async () => {
    setError(null)
    if (name.trim().length < 2) return setError('Escribe tu nombre para la reserva.')
    if (invoice === 'A' && !/^\d{11}$/.test(doc.replace(/\D/g, ''))) return setError('Para factura A necesitamos un CUIT de 11 dígitos.')
    setBusy(true)
    try {
      const sale = await salesApi.checkout({
        channel: 'tienda',
        items: rows.map((r) => ({ productId: r.p.id, qty: r.l.qty })),
        couponCode: couponOk?.code,
        customer: { name, email, docType: invoice === 'A' ? 'CUIT' : doc ? 'DNI' : '', doc: doc.replace(/\D/g, '') },
        paymentMethod: pay,
        invoiceType: invoice,
        test,
      })
      // El siguiente cliente arranca con el formulario limpio (y sin "prueba" marcada).
      clear()
      setCoupon('')
      setCouponOk(null)
      setName('')
      setEmail('')
      setDoc('')
      setInvoice('B')
      setPay('efectivo')
      setTest(false)
      onDone(sale)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la compra.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Carrito"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-drawer sm:rounded-l-3xl"
          >
            <header className="flex items-center gap-3 border-b-2 border-line px-5 py-4">
              <LuShoppingBag className="size-6 text-coral-ink" aria-hidden />
              <h2 className="flex-1 text-xl font-black">{step === 'carrito' ? 'Tu carrito' : 'Tus datos'}</h2>
              <button onClick={onClose} className="grid size-10 place-items-center rounded-xl hover:bg-sunken" aria-label="Cerrar carrito">
                <LuX className="size-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <SiDragonframe className="size-14 text-ink-soft" aria-hidden />
                  <p className="font-black">El carrito está vacío</p>
                  <p className="text-sm font-semibold text-ink-soft">Toca el + de un juguete para agregarlo.</p>
                </div>
              ) : step === 'carrito' ? (
                <ul className="flex flex-col gap-3">
                  {missing > 0 && <li className="rounded-2xl bg-sol-wash px-4 py-3 text-sm font-bold text-sol-ink">{missing} producto(s) del carrito ya no tienen stock y se quitaron.</li>}
                  <AnimatePresence initial={false}>
                    {rows.map(({ l, p }) => {
                      const pr = priceFor(p, catalog?.discounts ?? [])
                      return (
                        <motion.li key={p.id} layout exit={{ opacity: 0, x: 40 }} className="flex items-center gap-3 rounded-2xl bg-sunken p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-extrabold">{p.name}</p>
                            <p className="num text-sm font-bold text-ink-soft">
                              {formatPrice(pr.final)}
                              {pr.percent > 0 && <span className="text-coral-ink"> · −{pr.percent}%</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 rounded-xl bg-surface p-1">
                            <button onClick={() => setQty(p.id, l.qty - 1, p.stock)} className="grid size-8 place-items-center rounded-lg hover:bg-sunken" aria-label="Quitar uno">
                              <LuMinus className="size-4" />
                            </button>
                            <span className="num w-6 text-center font-black">{l.qty}</span>
                            <button onClick={() => setQty(p.id, l.qty + 1, p.stock)} disabled={l.qty >= p.stock} className="grid size-8 place-items-center rounded-lg hover:bg-sunken disabled:opacity-30" aria-label="Sumar uno">
                              <LuPlus className="size-4" />
                            </button>
                          </div>
                          <button onClick={() => remove(p.id)} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:text-peligro" aria-label={`Quitar ${p.name}`}>
                            <LuTrash2 className="size-4" />
                          </button>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                  <li className="mt-2 flex flex-col gap-2">
                    <form onSubmit={(e) => (e.preventDefault(), void applyCoupon())} className="flex gap-2">
                      <div className="relative flex-1">
                        <LuTicket className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
                        <input
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/\s/g, ''))}
                          placeholder="Cupón de descuento"
                          aria-label="Cupón de descuento"
                          className="num h-11 w-full rounded-xl border-2 border-line bg-surface pl-9 pr-3 font-bold uppercase focus:border-turquesa focus:outline-none"
                        />
                      </div>
                      <button type="submit" disabled={!coupon} className="h-11 rounded-xl bg-ink px-4 text-sm font-extrabold text-ground disabled:opacity-40">
                        Aplicar
                      </button>
                    </form>
                    {couponOk && <p className="text-sm font-bold text-turquesa-ink">Cupón {couponOk.code}: −{couponOk.percent}% aplicado</p>}
                    {couponErr && <p className="text-sm font-bold text-peligro">{couponErr}</p>}
                  </li>
                </ul>
              ) : (
                <form id="datos" onSubmit={(e) => (e.preventDefault(), void checkout())} className="flex flex-col gap-4">
                  <StoreField label="Nombre y apellido" value={name} onChange={setName} autoFocus autoComplete="name" />
                  <StoreField label="Email (opcional, para avisarte)" value={email} onChange={setEmail} type="email" autoComplete="email" />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-extrabold text-ink-soft">Comprobante</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['B', 'A'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setInvoice(t)} aria-pressed={invoice === t} className={clsx('h-11 rounded-xl text-sm font-extrabold', invoice === t ? 'bg-ink text-ground' : 'bg-sunken')}>
                          {t === 'B' ? 'Consumidor final (B)' : 'Factura A (con CUIT)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <StoreField label={invoice === 'A' ? 'CUIT (11 dígitos)' : 'DNI (opcional)'} value={doc} onChange={setDoc} inputMode="numeric" />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-extrabold text-ink-soft">¿Cómo vas a pagar al retirar?</span>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENTS.map((m) => (
                        <button key={m.id} type="button" onClick={() => setPay(m.id)} aria-pressed={pay === m.id} className={clsx('h-10 rounded-full px-4 text-sm font-extrabold', pay === m.id ? 'bg-turquesa text-on-fill' : 'bg-sunken')}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-dashed border-sol p-3">
                    <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} className="mt-0.5 size-5 accent-[rgb(var(--sol))]" />
                    <span className="text-sm">
                      <span className="block font-extrabold">Compra de prueba</span>
                      <span className="font-semibold text-ink-soft">Para probar el sistema: descuenta stock y aparece en reportes marcada como prueba.</span>
                    </span>
                  </label>
                  {error && <p role="alert" className="rounded-xl bg-peligro-wash px-3 py-2 text-sm font-bold text-peligro">{error}</p>}
                </form>
              )}
            </div>

            {rows.length > 0 && (
              <footer className="flex flex-col gap-3 border-t-2 border-line p-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-extrabold text-ink-soft">Total</span>
                  <span className="num text-2xl font-black">{formatPrice(total)}</span>
                </div>
                {step === 'carrito' ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep('datos')} className="h-14 rounded-2xl bg-sol text-lg font-black text-on-fill shadow-[0_4px_0_rgb(0_0_0/0.18)]">
                    Continuar
                  </motion.button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setStep('carrito')} className="h-14 rounded-2xl bg-sunken px-5 font-extrabold">
                      Volver
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      form="datos"
                      disabled={busy}
                      className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-black text-sol disabled:opacity-60"
                    >
                      {busy ? <LuLoaderCircle className="size-5 animate-spin" /> : <LuStore className="size-5" />}
                      {test ? 'Confirmar compra de prueba' : 'Reservar y pagar al retirar'}
                    </motion.button>
                  </div>
                )}
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function StoreField({
  label,
  value,
  onChange,
  ...props
}: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold text-ink-soft">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-xl border-2 border-line bg-surface px-3.5 font-bold focus:border-turquesa focus:outline-none" {...props} />
    </label>
  )
}

function SuccessModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const print = async () => printInvoice(sale, await settingsApi.get())
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Compra confirmada"
        initial={{ scale: 0.7, rotate: -6, y: 40 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface text-center shadow-lift"
      >
        <div className="relative grid h-40 place-items-center overflow-hidden bg-rail">
          {Array.from({ length: 16 }, (_, i) => (
            <motion.span
              key={i}
              className={clsx('absolute size-3 rounded-sm', ['bg-sol', 'bg-coral', 'bg-turquesa', 'bg-lila'][i % 4])}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: Math.cos((i / 16) * Math.PI * 2) * 170, y: Math.sin((i / 16) * Math.PI * 2) * 90, opacity: 0, rotate: 260 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          ))}
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 10, delay: 0.15 }} className="grid size-20 place-items-center rounded-full bg-sol text-on-fill">
            <LuCheck className="size-10" strokeWidth={3.5} />
          </motion.span>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <h2 className="text-2xl font-black">{sale.test ? '¡Compra de prueba registrada!' : '¡Reserva confirmada!'}</h2>
          <p className="font-semibold text-ink-soft">
            {sale.test ? 'Se descontó el stock y aparece en Reportes y Facturación como prueba.' : `Te esperamos en el local para retirar y pagar. Total ${formatPrice(sale.total)}.`}
          </p>
          <p className="num rounded-2xl bg-sunken px-4 py-3 font-black">Pedido {sale.invoiceType}-{String(sale.number).padStart(8, '0')}</p>
          <div className="flex gap-2">
            <button onClick={() => void print()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-sunken font-extrabold">
              <LuPrinter className="size-5" aria-hidden /> Comprobante
            </button>
            <button onClick={onClose} className="h-12 flex-1 rounded-2xl bg-ink font-extrabold text-sol">
              Seguir comprando
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
