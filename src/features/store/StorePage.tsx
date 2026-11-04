import { AnimatePresence, MotionConfig, motion, useAnimationControls, useScroll, useTransform } from 'framer-motion'
import { LuArrowDown, LuArrowRight, LuCalendarHeart, LuCheck, LuLoaderCircle, LuMinus, LuPlus, LuPrinter, LuSearch, LuShoppingBag, LuStore, LuTicket, LuTrash2, LuX } from 'react-icons/lu'
import { SiDragonframe } from 'react-icons/si'
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import { STORE } from '@/lib/config'
import { nextOccurrence } from '@/lib/defaults'
import { formatAge, formatPrice } from '@/lib/format'
import { priceFor, round2 } from '@/lib/pricing'
import { discountsApi, publicCatalog, salesApi, settingsApi } from '@/services/commerce'
import { categoryIcon } from '@/features/inventory/components/ProductThumb'
import { printInvoice } from '@/features/billing/invoiceHtml'
import type { BoardColor, Category, Discount, InvoiceType, PaymentMethod, Sale, Season } from '@/types'
import { useCart } from './cart'
import { HowToBuy } from './HowToBuy'
import { ToyDetail, toyFromLocation, toyPath } from './ToyDetail'
import { CardScene, Embers, ValleyScene } from './ValleyScene'
import './store.css'

type Catalog = Awaited<ReturnType<typeof publicCatalog>>
type Item = Catalog['products'][number]

const AGES = [
  { id: '0', label: 'Bebés', test: (a: number) => a <= 2 },
  { id: '3', label: '3 a 5 años', test: (a: number) => a >= 3 && a <= 5 },
  { id: '6', label: '6 a 8 años', test: (a: number) => a >= 6 && a <= 8 },
  { id: '9', label: '9 y más', test: (a: number) => a >= 9 },
]

/** Sobre el fondo oscuro, el color de categoría va como tinte del ícono y punto, nunca como bloque. */
const TINT: Record<BoardColor, string> = { sol: 'text-sol', coral: 'text-coral', turquesa: 'text-turquesa', lila: 'text-lila', hoja: 'text-hoja', cielo: 'text-cielo' }

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
  const cartBtn = useRef<HTMLButtonElement>(null)
  const [sparks, setSparks] = useState<{ id: number; from: DOMRect; to: DOMRect; color: BoardColor }[]>([])
  const [address, setAddress] = useState('')
  const [toyId, setToyId] = useState<string | null>(toyFromLocation)
  /** Dónde estaba el cliente en la portada, para volver al mismo lugar. */
  const homeScroll = useRef(0)
  const count = lines.reduce((a, l) => a + l.qty, 0)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const onPop = () => {
      const id = toyFromLocation()
      setToyId(id)
      // Con ancla (#como-comprar) se baja a esa sección; si no, a la ficha arriba o a donde estaba en la portada.
      const anchor = !id && window.location.hash.slice(1)
      requestAnimationFrame(() => {
        if (!anchor || !scrollToSection(anchor, false)) window.scrollTo({ top: id ? 0 : homeScroll.current })
      })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openToy = (id: string) => {
    if (!toyId) homeScroll.current = window.scrollY
    history.pushState({ fromStore: true }, '', toyPath(id))
    setToyId(id)
    window.scrollTo({ top: 0 })
  }
  /** Vuelve a la portada; con un ancla (juguetes, como-comprar) baja hasta esa sección. */
  const goHome = (anchor?: string) => {
    // Si se llegó a la ficha desde la portada, «atrás» deja el historial como el cliente espera.
    if (!anchor && history.state?.fromStore) return history.back()
    history.pushState(null, '', '/tienda' + (anchor ? '#' + anchor : ''))
    setToyId(null)
    requestAnimationFrame(() => {
      if (!anchor || !scrollToSection(anchor, false)) window.scrollTo({ top: anchor ? 0 : homeScroll.current })
    })
  }
  /**
   * Enlaces a secciones de la portada (encabezado y pie). Se manejan acá y no con el ancla del
   * navegador: así funcionan igual desde la portada, desde la ficha de un juguete o repetidos.
   */
  const homeLink = (anchor?: string) => ({
    href: '/tienda' + (anchor ? '#' + anchor : ''),
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      if (toyId) return goHome(anchor)
      const url = '/tienda' + (anchor ? '#' + anchor : '')
      if (window.location.pathname + window.location.hash !== url) history.pushState(null, '', url)
      if (!anchor || !scrollToSection(anchor, true)) window.scrollTo({ top: 0, behavior: smooth() })
    },
  })
  const search = (value: string) => {
    setQ(value)
    if (toyId) goHome('juguetes')
  }

  const load = () =>
    publicCatalog()
      .then(setData)
      .catch(() => setError('No pudimos cargar los juguetes. Recarga la página.'))

  useEffect(() => {
    void load()
    // La dirección del local (si el dueño la cargó) para el paso de retiro.
    settingsApi
      .get()
      .then((st) => setAddress(st.business.address?.trim() ?? ''))
      .catch(() => {})
  }, [])

  const products = useMemo(() => {
    if (!data) return []
    const t = q.trim().toLocaleLowerCase('es')
    return data.products.filter(
      (p) =>
        (!cat || p.categoryId === cat) &&
        (!season || p.seasons.includes(season)) &&
        (!age || AGES.find((a) => a.id === age)!.test(p.ageMin)) &&
        (!t || p.name.toLocaleLowerCase('es').includes(t) || p.brand.toLocaleLowerCase('es').includes(t)),
    )
  }, [data, cat, season, age, q])

  const next = useMemo(() => {
    if (!data?.seasons.length) return null
    return data.seasons.map((s) => ({ s, ...nextOccurrence(s.rule) })).sort((a, b) => a.days - b.days)[0]
  }, [data])

  const bounceBag = () => void bag.start({ scale: [1, 1.25, 0.92, 1.06, 1], rotate: [0, -10, 8, -3, 0], transition: { duration: 0.55 } })
  /** Al agregar, una brasa vuela en arco desde la tarjeta hasta el carrito, y el carrito rebota al recibirla. */
  const onAdd = (p: Item, from: DOMRect, color: BoardColor) => {
    if (!add(p.id, p.stock)) return
    const to = cartBtn.current?.getBoundingClientRect()
    if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) return bounceBag()
    setSparks((list) => [...list, { id: Date.now() + Math.random(), from, to, color }])
  }

  useEffect(() => {
    const anchor = window.location.hash.slice(1)
    if (data && !toyFromLocation() && anchor) requestAnimationFrame(() => scrollToSection(anchor, false))
  }, [data])

  const tabs = data ? data.categories.filter((c) => data.products.some((p) => p.categoryId === c.id)) : []
  const toy = toyId && data ? data.products.find((p) => p.id === toyId) : undefined

  useEffect(() => {
    document.title = toy ? `${toy.name} · ${STORE.name}` : `${STORE.name} · Tienda de juguetes`
  }, [toy])

  // Se llama como función (no como <Componente/>) para que la ficha no se vuelva a montar en cada render.
  const renderToy = () => {
    if (error) return <p role="alert" className="mx-auto my-16 max-w-xl rounded-3xl border-2 border-[rgb(var(--sw-alert)/0.5)] p-8 text-center font-bold text-[rgb(var(--sw-alert))]">{error}</p>
    if (!data)
      return (
        <div className="mx-auto grid max-w-[1312px] gap-10 px-4 pt-16 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:px-0" aria-busy="true" aria-label="Cargando juguete">
          <div className="organic aspect-[4/3] animate-pulse bg-[rgb(var(--sw-surface))]" />
          <div className="flex flex-col gap-4">
            <div className="h-12 w-3/4 animate-pulse rounded-full bg-[rgb(var(--sw-surface))]" />
            <div className="h-10 w-1/3 animate-pulse rounded-full bg-[rgb(var(--sw-surface))]" />
          </div>
        </div>
      )
    if (!toy)
      return (
        <main className="flex flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="logo-tile grid size-16 place-items-center rounded-2xl">
            <SiDragonframe className="size-9" aria-hidden />
          </span>
          <h1 className="mt-2 font-display text-3xl">Este juguete ya no está disponible</h1>
          <p className="max-w-md font-semibold text-[rgb(var(--sw-sage))]">Puede que se haya agotado. Mira los demás juguetes del valle.</p>
          <a {...homeLink('juguetes')} className="mt-3 flex items-center gap-2 font-display text-lg text-[rgb(var(--sw-moss))] hover:text-[rgb(var(--sw-ink))]">
            Ver todos los juguetes <LuArrowRight className="size-5" aria-hidden />
          </a>
        </main>
      )
    const category = data.categories.find((c) => c.id === toy.categoryId)
    // Primero los de la misma categoría; si no alcanzan, se completa con otros.
    const others = data.products.filter((p) => p.id !== toy.id)
    const related = [...others.filter((p) => p.categoryId === toy.categoryId), ...others.filter((p) => p.categoryId !== toy.categoryId)].slice(0, 3)
    return (
      <ToyDetail
        key={toy.id}
        p={toy}
        category={category}
        discounts={data.discounts}
        inCart={lines.find((l) => l.productId === toy.id)?.qty ?? 0}
        address={address}
        onAdd={(from, color) => onAdd(toy, from, color)}
        onBack={() => goHome()}
        onCart={() => setCartOpen(true)}
        related={
          related.length > 0 && (
            <section className="mt-20" aria-labelledby="relacionados">
              <Rule at={0.6} />
              <h2 id="relacionados" className="mt-10 font-display text-[2rem] leading-none text-[rgb(var(--sw-moss))]">
                {related.every((p) => p.categoryId === toy.categoryId) && category ? `Más de ${category.name}` : 'También te puede gustar'}
              </h2>
              <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-8 lg:grid-cols-3 lg:gap-x-12">
                {related.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    i={i}
                    category={data.categories.find((c) => c.id === p.categoryId)}
                    discounts={data.discounts}
                    inCart={lines.find((l) => l.productId === p.id)?.qty ?? 0}
                    onAdd={(from, color) => onAdd(p, from, color)}
                    onOpen={() => openToy(p.id)}
                  />
                ))}
              </ul>
            </section>
          )
        }
      />
    )
  }

  return (
    // Con «reducir movimiento» activado en el sistema, las animaciones de entrada y los resortes se apagan.
    <MotionConfig reducedMotion="user">
    <div className="store-world">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--sw-line))] bg-[rgb(var(--sw-ground)/0.94)] backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1312px] items-center gap-3 px-4 sm:px-8 lg:px-0">
          <a {...homeLink()} className="flex items-center gap-2.5">
            <span className="logo-tile grid size-10 place-items-center rounded-xl">
              <SiDragonframe className="size-6" aria-hidden />
            </span>
            <span className="font-display text-2xl leading-none">{STORE.name}</span>
          </a>
          <nav aria-label="Secciones" className="ml-8 hidden items-center gap-8 md:flex">
            <a {...homeLink('juguetes')} className="font-display text-[1.05rem] text-[rgb(var(--sw-sage))] transition-colors hover:text-[rgb(var(--sw-ink))]">
              Juguetes
            </a>
            <a {...homeLink('como-comprar')} className="font-display text-[1.05rem] text-[rgb(var(--sw-sage))] transition-colors hover:text-[rgb(var(--sw-ink))]">
              Cómo comprar
            </a>
          </nav>
          <label className="relative ml-auto hidden w-64 sm:block">
            <span className="sr-only">Buscar juguetes</span>
            <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--sw-sage))]" aria-hidden />
            <input
              value={q}
              onChange={(e) => search(e.target.value)}
              placeholder="Buscar juguetes"
              className="h-10 w-full rounded-full border-2 border-[rgb(var(--sw-line))] bg-[rgb(var(--sw-surface))] pl-10 pr-4 text-sm font-bold text-[rgb(var(--sw-ink))] placeholder:text-[rgb(var(--sw-sage))] focus:border-[rgb(var(--sw-moss))] focus:outline-none"
            />
          </label>
          <motion.button
            ref={cartBtn}
            animate={bag}
            onClick={() => setCartOpen(true)}
            className="ml-auto flex h-11 items-center gap-2 rounded-full border-2 border-[rgb(var(--sw-ink)/0.85)] px-4 font-display text-[1.05rem] transition-colors hover:bg-[rgb(var(--sw-ink))] hover:text-[rgb(var(--sw-ground))] sm:ml-0"
            aria-label={`Carrito: ${count} productos`}
          >
            <LuShoppingBag className="size-5" aria-hidden />
            <span className="hidden sm:inline">Carrito</span>
            <span className="num grid min-w-6 place-items-center rounded-full bg-[rgb(var(--sw-fire))] px-1.5 text-sm leading-6 text-[rgb(var(--sw-fire-ink))]">{count}</span>
          </motion.button>
        </div>
      </header>

      {toyId ? (
        renderToy()
      ) : (
      <>
      <Hero next={next} />

      <main id="juguetes" className="mx-auto max-w-[1312px] scroll-mt-20 px-4 pb-20 pt-14 sm:px-8 lg:px-0">
        <Rule at={0.3} />
        <nav aria-label="Categorías" className="-mx-4 flex gap-8 overflow-x-auto px-4 py-6 sm:mx-0 sm:justify-around sm:px-0">
          <Tab on={!cat} onClick={() => setCat(null)}>
            Todos
          </Tab>
          {tabs.map((c) => (
            <Tab key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>
              {c.name}
            </Tab>
          ))}
        </nav>
        <Rule at={1.4} />

        {data && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative sm:hidden">
              <span className="sr-only">Buscar juguetes</span>
              <LuSearch className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[rgb(var(--sw-sage))]" aria-hidden />
              <input
                value={q}
                onChange={(e) => search(e.target.value)}
                placeholder="Buscar juguetes"
                className="h-12 w-full rounded-full border-2 border-[rgb(var(--sw-line))] bg-[rgb(var(--sw-surface))] pl-12 pr-4 font-bold placeholder:text-[rgb(var(--sw-sage))] focus:border-[rgb(var(--sw-moss))] focus:outline-none"
              />
            </label>
            <div role="group" aria-label="Edad y temporada" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {AGES.map((a) => (
                <Pill key={a.id} on={age === a.id} onClick={() => setAge(age === a.id ? null : a.id)}>
                  {a.label}
                </Pill>
              ))}
              {data.seasons.map((s) => (
                <Pill key={s.id} on={season === s.id} onClick={() => setSeason(season === s.id ? null : s.id)} dot={s.color}>
                  {s.name}
                </Pill>
              ))}
            </div>
            <p className="text-sm font-semibold text-[rgb(var(--sw-sage))] sm:ml-auto">Precios en pesos con IVA incluido.</p>
          </div>
        )}

        <div className="mt-10">
          {error ? (
            <p role="alert" className="rounded-3xl border-2 border-[rgb(var(--sw-alert)/0.5)] p-8 text-center font-bold text-[rgb(var(--sw-alert))]">
              {error}
            </p>
          ) : !data ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 lg:grid-cols-3 lg:gap-x-12">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="organic aspect-[16/10] animate-pulse bg-[rgb(var(--sw-surface))]" />
                  <div className="h-6 w-2/3 animate-pulse rounded-full bg-[rgb(var(--sw-surface))]" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <span className="logo-tile grid size-16 place-items-center rounded-2xl">
                <SiDragonframe className="size-9" aria-hidden />
              </span>
              <p className="mt-2 font-display text-3xl">{data.products.length ? 'Ningún juguete con esos filtros' : 'Estamos reponiendo la juguetería'}</p>
              <p className="max-w-md font-semibold text-[rgb(var(--sw-sage))]">
                {data.products.length ? 'Prueba con otra categoría, edad o temporada.' : 'Vuelve pronto: están llegando juguetes nuevos al valle.'}
              </p>
              {data.products.length > 0 && (
                <button
                  onClick={() => (setCat(null), setAge(null), setSeason(null), setQ(''))}
                  className="mt-3 flex items-center gap-2 font-display text-lg text-[rgb(var(--sw-moss))] hover:text-[rgb(var(--sw-ink))]"
                >
                  Ver todos los juguetes <LuArrowRight className="size-5" aria-hidden />
                </button>
              )}
            </div>
          ) : (
            <motion.ul layout className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-8 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-16">
              <AnimatePresence>
                {products.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    i={i}
                    category={data.categories.find((c) => c.id === p.categoryId)}
                    discounts={data.discounts}
                    inCart={lines.find((l) => l.productId === p.id)?.qty ?? 0}
                    onAdd={(from, color) => onAdd(p, from, color)}
                    onOpen={() => openToy(p.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      </main>

      <div className="mx-auto max-w-[1312px] px-4 sm:px-8 lg:px-0">
        <Rule at={0.9} />
      </div>
      <HowToBuy categories={tabs} cartCount={count} address={address} onOpenCart={() => setCartOpen(true)} />
      </>
      )}
      <Footer onCart={() => setCartOpen(true)} homeLink={homeLink} />

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
      <AnimatePresence>{done && <SuccessModal sale={done} address={address} onClose={() => setDone(null)} />}</AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
        {sparks.map((k) => (
          <Spark
            key={k.id}
            {...k}
            onDone={() => {
              setSparks((list) => list.filter((x) => x.id !== k.id))
              bounceBag()
            }}
          />
        ))}
      </div>
    </div>
    </MotionConfig>
  )
}

/** Con «reducir movimiento» el salto es directo, sin desplazamiento animado. */
const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

/** Baja hasta una sección de la portada; devuelve false si no existe. Respeta su scroll-margin (el encabezado fijo). */
function scrollToSection(id: string, animated: boolean) {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: animated ? smooth() : 'auto', block: 'start' })
  return true
}

/** Separador: línea fina cortada por un punto (at = dónde cae el punto, de 0 a 2). */
function Rule({ at = 1 }: { at?: number }) {
  const line = { initial: { scaleX: 0 }, whileInView: { scaleX: 1 }, viewport: { once: true, amount: 1 }, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } } as const
  return (
    <div className="flex items-center gap-3.5" aria-hidden>
      <motion.span {...line} className="h-px origin-right bg-[rgb(var(--sw-line))]" style={{ flex: at }} />
      <motion.span initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} className="size-2 shrink-0 rounded-full bg-[rgb(var(--sw-rim))]" />
      <motion.span {...line} className="h-px origin-left bg-[rgb(var(--sw-line))]" style={{ flex: 2 - at }} />
    </div>
  )
}

/** Brasa que viaja en arco de la tarjeta al carrito. */
function Spark({ from, to, color, onDone }: { from: DOMRect; to: DOMRect; color: BoardColor; onDone: () => void }) {
  const x0 = from.left + from.width - 28
  const y0 = from.top + from.height / 2
  const x1 = to.left + to.width / 2
  const y1 = to.top + to.height / 2
  const lift = Math.min(160, Math.abs(y0 - y1) * 0.35 + 60)
  return (
    <motion.span
      className="absolute left-0 top-0 grid size-7 place-items-center rounded-full bg-[rgb(var(--sw-fire))] shadow-[0_0_18px_6px_rgb(255_138_43/0.55)]"
      initial={{ x: x0 - 14, y: y0 - 14, scale: 0.6, opacity: 1 }}
      animate={{ x: [x0 - 14, (x0 + x1) / 2 - 14, x1 - 14], y: [y0 - 14, Math.min(y0, y1) - lift - 14, y1 - 14], scale: [0.6, 1.1, 0.45], opacity: [1, 1, 0.9] }}
      transition={{ duration: 0.75, ease: [0.45, 0, 0.2, 1], times: [0, 0.45, 1] }}
      onAnimationComplete={onDone}
    >
      <span className={clsx('size-2.5 rounded-full', BOARD[color].fill)} />
    </motion.span>
  )
}

/** Luciérnagas que flotan sobre las colinas del inicio. */
const FIREFLIES = Array.from({ length: 14 }, (_, i) => ({ left: (i * 37 + 11) % 96, bottom: 6 + ((i * 53) % 30), d: 5 + (i % 5), dx: ((i % 3) - 1) * 18, dy: 14 + (i % 4) * 8 }))
function Fireflies() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {FIREFLIES.map((f, i) => (
        <motion.span
          key={i}
          className="absolute size-1.5 rounded-full bg-[#E9F7A6] shadow-[0_0_10px_3px_rgb(233_247_166/0.6)]"
          style={{ left: `${f.left}%`, bottom: `${f.bottom}%` }}
          animate={{ x: [0, f.dx, -f.dx / 2, 0], y: [0, -f.dy, -f.dy / 2, 0], opacity: [0.15, 1, 0.4, 0.15] }}
          transition={{ duration: f.d, repeat: Infinity, ease: 'easeInOut', delay: i * 0.35 }}
        />
      ))}
    </div>
  )
}

const HEADLINE = 'Juguetes con fuego de dragón'

function Hero({ next }: { next: { s: Season; days: number } | null }) {
  const host = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: host, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -90])
  const contentFade = useTransform(scrollYProgress, [0, 0.8], [1, 0.15])
  return (
    <section className="px-4 pt-6 sm:px-8 lg:px-16">
      <div ref={host} className="relative mx-auto max-w-[1312px] overflow-hidden" style={{ height: 'clamp(560px, 76vh, 680px)' }}>
        <ValleyScene hostRef={host} />
        <Fireflies />
        <motion.div style={{ y: contentY, opacity: contentFade }} className="relative flex h-full flex-col items-center px-5 pt-16 text-center sm:pt-20">
          <div className="relative">
            <Embers className="pointer-events-none absolute -top-64 left-1/2 h-[22rem] w-[26rem] -translate-x-1/2" origin={0.78} spread={110} />
            <motion.span
              initial={{ y: 40, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              className="relative block"
            >
              <motion.span
                animate={{ y: [0, -7, 0], rotate: [0, -1.5, 0, 1.5, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="logo-tile relative grid size-20 place-items-center rounded-[1.4rem] sm:size-24 sm:rounded-[1.7rem]"
              >
                <SiDragonframe className="size-12 sm:size-14" aria-hidden />
              </motion.span>
            </motion.span>
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-[2.6rem] leading-[0.98] [text-shadow:0_2px_18px_rgb(9_30_48/0.55)] sm:text-[3.6rem]" style={{ textWrap: 'balance' }}>
            <span className="sr-only">{HEADLINE}</span>
            <span aria-hidden>
              {HEADLINE.split(' ').map((w, i) => (
                <motion.span
                  key={i}
                  className="mr-[0.22em] inline-block last:mr-0"
                  initial={{ y: 28, opacity: 0, rotate: i % 2 ? 4 : -4 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.25 + i * 0.08 }}
                >
                  {w}
                </motion.span>
              ))}
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base font-bold leading-relaxed text-[rgb(var(--sw-ink))] [text-shadow:0_1px_2px_rgb(9_30_48/0.7),0_2px_16px_rgb(9_30_48/0.75)] sm:text-lg">
            Elige en la tienda, reserva sin pagar online y retira en el local.
          </p>
          <a
            href="#juguetes"
            className="group mt-7 inline-flex h-14 items-center gap-3 rounded-full bg-[rgb(var(--sw-fire))] px-7 font-display text-xl text-[rgb(var(--sw-fire-ink))] shadow-[0_14px_30px_-14px_rgb(0_0_0/0.7)] transition-[filter] hover:brightness-105"
          >
            Ver juguetes
            <LuArrowDown className="size-5 transition-transform duration-300 group-hover:translate-y-1" aria-hidden />
          </a>
          {next && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--sw-ground)/0.82)] px-4 py-1.5 text-sm font-extrabold text-[rgb(var(--sw-ink))]">
              <LuCalendarHeart className="size-4 text-[rgb(var(--sw-ember))]" aria-hidden />
              {next.days === 0 ? `¡Hoy es ${next.s.name}!` : `Faltan ${next.days} días para ${next.s.name}`}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  )
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx('flex shrink-0 items-center gap-3 font-display text-[1.65rem] leading-none transition-colors', on ? 'text-[rgb(var(--sw-ink))]' : 'text-[rgb(var(--sw-moss))] hover:text-[rgb(var(--sw-ink))]')}
    >
      <span className="relative size-2" aria-hidden>
        {on && <motion.span layoutId="tab-dot-l" transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-full bg-current" />}
      </span>
      {children}
      <span className="relative size-2" aria-hidden>
        {on && <motion.span layoutId="tab-dot-r" transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-full bg-current" />}
      </span>
    </button>
  )
}

function Pill({ on, onClick, dot, children }: { on: boolean; onClick: () => void; dot?: BoardColor; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        'flex h-10 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold transition-colors',
        on
          ? 'border-[rgb(var(--sw-ink))] bg-[rgb(var(--sw-ink))] text-[rgb(var(--sw-ground))]'
          : 'border-[rgb(var(--sw-line))] text-[rgb(var(--sw-sage))] hover:border-[rgb(var(--sw-sage))] hover:text-[rgb(var(--sw-ink))]',
      )}
    >
      {dot && <span className={clsx('size-2.5 rounded-full', BOARD[dot].fill)} aria-hidden />}
      {children}
    </button>
  )
}

function ProductCard({
  p,
  i,
  category,
  discounts,
  inCart,
  onAdd,
  onOpen,
}: {
  p: Item
  i: number
  category?: Category
  discounts: Discount[]
  inCart: number
  onAdd: (from: DOMRect, color: BoardColor) => void
  onOpen: () => void
}) {
  // Clic normal: abre la ficha sin recargar. Ctrl/Cmd o rueda: el navegador la abre en otra pestaña.
  const open = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    onOpen()
  }
  const price = priceFor(p, discounts)
  const Icon = categoryIcon(category)
  const color = category?.color ?? 'sol'
  const left = p.stock - inCart
  const [pop, setPop] = useState(0)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24, delay: Math.min(i, 9) * 0.04 }}
      className="group flex flex-col"
    >
      <a
        href={toyPath(p.id)}
        onClick={open}
        tabIndex={-1}
        aria-hidden
        className={clsx('relative block aspect-[16/10] overflow-hidden border-2 border-[rgb(var(--sw-rim))] bg-[rgb(var(--sw-raised))] transition-colors group-hover:border-[rgb(var(--sw-moss))]', i % 2 ? 'organic-alt' : 'organic')}
      >
        {p.photos[0] ? (
          <img src={p.photos[0]} alt={p.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="relative size-full">
            <CardScene seed={i + 1} color={color} className="absolute inset-0 size-full" />
            <motion.span
              key={pop}
              // El centrado va por framer (x: -50%): una clase translate se pisaría con la animación del salto.
              style={{ x: '-50%' }}
              className="absolute bottom-[22%] left-1/2 block size-[40%]"
              initial={pop ? { y: -26, rotate: -12 } : false}
              animate={{ y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 9 }}
            >
              <Icon className={clsx('size-full drop-shadow-[0_8px_8px_rgb(0_0_0/0.45)] transition-transform duration-500 group-hover:-translate-y-1.5 group-hover:-rotate-6', TINT[color])} aria-hidden />
            </motion.span>
          </div>
        )}
        {price.percent > 0 && (
          <span className="num absolute right-3 top-3 grid size-14 -rotate-12 place-items-center rounded-full bg-coral text-sm font-black text-on-fill shadow-[0_6px_14px_-6px_rgb(0_0_0/0.6)]">
            −{price.percent}%
          </span>
        )}
        {p.stock <= 3 && <span className="absolute bottom-3 left-3 rounded-full bg-[rgb(var(--sw-ground)/0.88)] px-3 py-1 text-xs font-black text-[rgb(var(--sw-ember))]">¡Últimas {p.stock}!</span>}
      </a>
      <h3 className="mt-5 line-clamp-2 font-display text-[1.2rem] leading-tight sm:text-[1.55rem]">
        <a href={toyPath(p.id)} onClick={open} className="decoration-[rgb(var(--sw-moss))] decoration-2 underline-offset-4 hover:underline">
          {p.name}
        </a>
      </h3>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-[rgb(var(--sw-sage))] sm:text-base">
        {category?.name ?? 'Juguete'} · {formatAge(p.ageMin)}
        {p.batteries && ' · usa pilas'}
      </p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="num font-display text-[1.45rem] leading-none sm:text-[1.7rem]">{formatPrice(price.final)}</span>
        {price.percent > 0 && <span className="num text-sm font-bold text-[rgb(var(--sw-sage))] line-through">{formatPrice(price.list)}</span>}
      </p>
      <motion.button
        key={pop}
        onClick={(e) => {
          onAdd(e.currentTarget.getBoundingClientRect(), color)
          setPop((n) => n + 1)
        }}
        disabled={left <= 0}
        initial={pop ? { x: 6 } : false}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 14 }}
        className="mt-5 flex items-center justify-between gap-3 border-t border-[rgb(var(--sw-line))] pt-4 text-left font-display text-[1.05rem] transition-colors hover:text-[rgb(var(--sw-fire))] disabled:cursor-not-allowed disabled:text-[rgb(var(--sw-sage))] sm:text-[1.2rem]"
        aria-label={left <= 0 ? `Sin más stock de ${p.name}` : `Agregar ${p.name} al carrito`}
      >
        <span>{left <= 0 ? (inCart ? `Tienes ${inCart} en el carrito` : 'Sin stock') : inCart ? `En el carrito: ${inCart} · sumar otro` : 'Agregar al carrito'}</span>
        {left > 0 && (inCart ? <LuPlus className="size-5 shrink-0" strokeWidth={3} aria-hidden /> : <LuArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={3} aria-hidden />)}
      </motion.button>
    </motion.li>
  )
}

function Footer({ onCart, homeLink }: { onCart: () => void; homeLink: (anchor?: string) => { href: string; onClick: (e: React.MouseEvent) => void } }) {
  const link = 'font-display text-[1.05rem] text-[rgb(var(--sw-moss))] transition-colors hover:text-[rgb(var(--sw-ink))]'
  return (
    <footer className="mx-auto max-w-[1312px] px-4 pb-10 sm:px-8 lg:px-0">
      <Rule at={1} />
      <div className="grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex items-center gap-3">
          <span className="logo-tile grid size-12 place-items-center rounded-2xl">
            <SiDragonframe className="size-7" aria-hidden />
          </span>
          <span className="font-display text-[2.2rem] leading-none text-[rgb(var(--sw-moss))]">{STORE.name}</span>
        </div>
        <nav aria-label="Pie de página" className="flex flex-col items-start gap-3">
          <a {...homeLink('juguetes')} className={link}>
            Juguetes
          </a>
          <a {...homeLink('como-comprar')} className={link}>
            Cómo comprar
          </a>
          <button onClick={onCart} className={link}>
            Ver carrito
          </button>
        </nav>
        <p className="max-w-xs font-semibold leading-relaxed text-[rgb(var(--sw-sage))]">
          Juguetería en {STORE.country}. Reservas online y pagas al retirar en el local.
        </p>
      </div>
      <Rule at={1} />
      <div className="flex flex-col gap-2 pt-6 text-sm font-semibold text-[rgb(var(--sw-sage))] sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} {STORE.name}</p>
        <p></p>
      </div>
    </footer>
  )
}

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'mercadopago', label: 'Mercado Pago' },
]

const field =
  'h-12 w-full rounded-2xl border-2 border-[rgb(var(--sw-line))] bg-[rgb(var(--sw-ground))] px-4 font-bold text-[rgb(var(--sw-ink))] placeholder:text-[rgb(var(--sw-sage)/0.8)] focus:border-[rgb(var(--sw-moss))] focus:outline-none'

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
  const [fieldErr, setFieldErr] = useState<{ name?: string; doc?: string }>({})

  useEffect(() => {
    if (!open) setStep('carrito')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose])

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
    const problems = {
      name: name.trim().length < 2 ? 'Escribe tu nombre para la reserva.' : undefined,
      doc: invoice === 'A' && !/^\d{11}$/.test(doc.replace(/\D/g, '')) ? 'Para factura A necesitamos un CUIT de 11 dígitos.' : undefined,
    }
    setFieldErr(problems)
    // El foco va al primer campo con problema, donde se ve su mensaje.
    if (problems.name) return document.getElementById('co-name')?.focus()
    if (problems.doc) return document.getElementById('co-doc')?.focus()
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
          <motion.div className="fixed inset-0 z-50 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Carrito"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="store-world fixed inset-y-0 right-0 z-50 flex !min-h-0 w-full max-w-md flex-col border-l border-[rgb(var(--sw-line))] bg-[rgb(var(--sw-surface))] shadow-[-24px_0_60px_-30px_rgb(0_0_0/0.8)]"
          >
            <header className="flex items-center gap-3 px-6 py-5">
              <LuShoppingBag className="size-6 text-[rgb(var(--sw-fire))]" aria-hidden />
              <h2 className="flex-1 font-display text-[1.7rem] leading-none">{step === 'carrito' ? 'Tu carrito' : 'Tus datos'}</h2>
              <button onClick={onClose} className="grid size-10 place-items-center rounded-xl text-[rgb(var(--sw-sage))] hover:bg-[rgb(var(--sw-raised))] hover:text-[rgb(var(--sw-ink))]" aria-label="Cerrar carrito">
                <LuX className="size-5" />
              </button>
            </header>
            <div className="px-6">
              <Rule at={step === 'carrito' ? 0.4 : 1.6} />
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <span className="logo-tile grid size-14 place-items-center rounded-2xl">
                    <SiDragonframe className="size-8" aria-hidden />
                  </span>
                  <p className="mt-2 font-display text-2xl">El carrito está vacío</p>
                  <p className="text-sm font-semibold text-[rgb(var(--sw-sage))]">Toca «Agregar al carrito» en un juguete.</p>
                </div>
              ) : step === 'carrito' ? (
                <ul className="flex flex-col gap-3">
                  {missing > 0 && <li className="rounded-2xl border-2 border-[rgb(var(--sw-ember)/0.4)] px-4 py-3 text-sm font-bold text-[rgb(var(--sw-ember))]">{missing} producto(s) del carrito ya no tienen stock y se quitaron.</li>}
                  <AnimatePresence initial={false}>
                    {rows.map(({ l, p }) => {
                      const pr = priceFor(p, catalog?.discounts ?? [])
                      return (
                        <motion.li key={p.id} layout exit={{ opacity: 0, x: 40 }} className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--sw-raised))] p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-extrabold">{p.name}</p>
                            <p className="num text-sm font-bold text-[rgb(var(--sw-sage))]">
                              {formatPrice(pr.final)}
                              {pr.percent > 0 && <span className="text-coral"> · −{pr.percent}%</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 rounded-xl bg-[rgb(var(--sw-ground))] p-1">
                            <button onClick={() => setQty(p.id, l.qty - 1, p.stock)} className="grid size-8 place-items-center rounded-lg hover:bg-[rgb(var(--sw-raised))]" aria-label="Quitar uno">
                              <LuMinus className="size-4" />
                            </button>
                            <span className="num w-6 text-center font-black">{l.qty}</span>
                            <button onClick={() => setQty(p.id, l.qty + 1, p.stock)} disabled={l.qty >= p.stock} className="grid size-8 place-items-center rounded-lg hover:bg-[rgb(var(--sw-raised))] disabled:opacity-30" aria-label="Sumar uno">
                              <LuPlus className="size-4" />
                            </button>
                          </div>
                          <button onClick={() => remove(p.id)} className="grid size-8 place-items-center rounded-lg text-[rgb(var(--sw-sage))] hover:text-[rgb(var(--sw-alert))]" aria-label={`Quitar ${p.name}`}>
                            <LuTrash2 className="size-4" />
                          </button>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                  <li className="mt-3 flex flex-col gap-2">
                    <form onSubmit={(e) => (e.preventDefault(), void applyCoupon())} className="flex gap-2">
                      <div className="relative flex-1">
                        <LuTicket className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--sw-sage))]" aria-hidden />
                        <input
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/\s/g, ''))}
                          placeholder="Cupón de descuento"
                          aria-label="Cupón de descuento"
                          className={clsx(field, 'num h-11 pl-10 uppercase')}
                        />
                      </div>
                      <button type="submit" disabled={!coupon} className="h-11 rounded-2xl border-2 border-[rgb(var(--sw-ink)/0.85)] px-4 font-display text-[1.05rem] hover:bg-[rgb(var(--sw-ink))] hover:text-[rgb(var(--sw-ground))] disabled:opacity-40">
                        Aplicar
                      </button>
                    </form>
                    {couponOk && <p className="text-sm font-bold text-[rgb(var(--sw-moss))]">Cupón {couponOk.code}: −{couponOk.percent}% aplicado</p>}
                    {couponErr && <p className="text-sm font-bold text-[rgb(var(--sw-alert))]">{couponErr}</p>}
                  </li>
                </ul>
              ) : (
                <form id="datos" noValidate onSubmit={(e) => (e.preventDefault(), void checkout())} className="flex flex-col gap-5">
                  {error && (
                    <p role="alert" className="rounded-2xl border-2 border-[rgb(var(--sw-alert)/0.5)] px-3.5 py-2.5 text-sm font-bold text-[rgb(var(--sw-alert))]">
                      {error}
                    </p>
                  )}
                  <StoreField
                    id="co-name"
                    label="Nombre y apellido"
                    value={name}
                    onChange={(v) => (setName(v), fieldErr.name && setFieldErr((x) => ({ ...x, name: undefined })))}
                    error={fieldErr.name}
                    autoFocus
                    autoComplete="name"
                  />
                  <StoreField id="co-email" label="Email (opcional, para avisarte)" value={email} onChange={setEmail} type="email" autoComplete="email" />
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-extrabold text-[rgb(var(--sw-sage))]">Comprobante</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['B', 'A'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setInvoice(t)}
                          aria-pressed={invoice === t}
                          className={clsx('h-11 rounded-2xl border-2 text-sm font-extrabold', invoice === t ? 'border-[rgb(var(--sw-ink))] bg-[rgb(var(--sw-ink))] text-[rgb(var(--sw-ground))]' : 'border-[rgb(var(--sw-line))] text-[rgb(var(--sw-sage))]')}
                        >
                          {t === 'B' ? 'Consumidor final (B)' : 'Factura A (con CUIT)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <StoreField
                    id="co-doc"
                    label={invoice === 'A' ? 'CUIT (11 dígitos)' : 'DNI (opcional)'}
                    value={doc}
                    onChange={(v) => (setDoc(v), fieldErr.doc && setFieldErr((x) => ({ ...x, doc: undefined })))}
                    error={fieldErr.doc}
                    inputMode="numeric"
                  />
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-extrabold text-[rgb(var(--sw-sage))]">¿Cómo vas a pagar al retirar?</span>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENTS.map((m) => (
                        <Pill key={m.id} on={pay === m.id} onClick={() => setPay(m.id)}>
                          {m.label}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-dashed border-[rgb(var(--sw-ember)/0.5)] p-3.5">
                    <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} className="mt-0.5 size-5 accent-[#FF8A2B]" />
                    <span className="text-sm">
                      <span className="block font-extrabold">Compra de prueba</span>
                      <span className="font-semibold text-[rgb(var(--sw-sage))]">Para probar el sistema: llega a Pedidos marcada como prueba y separa stock como una reserva real.</span>
                    </span>
                  </label>
                </form>
              )}
            </div>

            {rows.length > 0 && (
              <footer className="flex flex-col gap-4 border-t border-[rgb(var(--sw-line))] p-6">
                <div className="flex items-baseline justify-between">
                  <span className="font-extrabold text-[rgb(var(--sw-sage))]">Total</span>
                  <span className="num font-display text-[2rem] leading-none">{formatPrice(total)}</span>
                </div>
                {step === 'carrito' ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep('datos')}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--sw-fire))] font-display text-xl text-[rgb(var(--sw-fire-ink))] shadow-[0_10px_24px_-12px_rgb(255_138_43/0.7)] hover:brightness-105"
                  >
                    Continuar <LuArrowRight className="size-5" aria-hidden />
                  </motion.button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setStep('carrito')} className="h-14 rounded-2xl border-2 border-[rgb(var(--sw-line))] px-5 font-display text-lg text-[rgb(var(--sw-sage))] hover:text-[rgb(var(--sw-ink))]">
                      Volver
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      form="datos"
                      disabled={busy}
                      className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--sw-fire))] px-3 font-display text-lg leading-tight text-[rgb(var(--sw-fire-ink))] shadow-[0_10px_24px_-12px_rgb(255_138_43/0.7)] hover:brightness-105 disabled:opacity-60"
                    >
                      {busy ? <LuLoaderCircle className="size-5 animate-spin" /> : <LuStore className="size-5 shrink-0" />}
                      {test ? 'Reservar (prueba)' : 'Reservar y pagar al retirar'}
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
  id,
  label,
  value,
  onChange,
  error,
  ...props
}: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id'>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-extrabold text-[rgb(var(--sw-sage))]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? id + '-error' : undefined}
        className={clsx(field, error && '!border-[rgb(var(--sw-alert))] shadow-[0_0_0_4px_rgb(var(--sw-alert)/0.18)]')}
        {...props}
      />
      {error && (
        <p id={id + '-error'} className="text-sm font-bold text-[rgb(var(--sw-alert))]">
          {error}
        </p>
      )}
    </div>
  )
}

function SuccessModal({ sale, onClose, address }: { sale: Sale; onClose: () => void; address: string }) {
  const print = async () => printInvoice(sale, await settingsApi.get())
  const until = sale.expiresAt ? new Date(sale.expiresAt).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Reserva confirmada"
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="store-world relative !min-h-0 w-full max-w-md overflow-hidden rounded-[28px] border border-[rgb(var(--sw-line))] bg-[rgb(var(--sw-surface))] text-center shadow-[0_30px_60px_-24px_rgb(0_0_0/0.8)]"
      >
        <div className="relative grid h-44 place-items-center overflow-hidden">
          <Embers className="pointer-events-none absolute inset-0 size-full" />
          <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 12, delay: 0.1 }} className="relative grid size-20 place-items-center rounded-[1.4rem] bg-[rgb(var(--sw-fire))] text-[rgb(var(--sw-fire-ink))] shadow-[0_12px_28px_-12px_rgb(255_138_43/0.75)]">
            <LuCheck className="size-10" strokeWidth={3.5} />
          </motion.span>
        </div>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <h2 className="font-display text-[1.9rem] leading-tight">{sale.test ? '¡Reserva de prueba hecha!' : '¡Reserva confirmada!'}</h2>
          <div className="rounded-2xl bg-[rgb(var(--sw-ground))] px-4 py-4">
            <p className="text-sm font-extrabold text-[rgb(var(--sw-sage))]">Tu código de retiro</p>
            <p className="num font-display text-[2.6rem] leading-none tracking-wide text-[rgb(var(--sw-ember))]">
              R-{String(sale.reservationCode ?? sale.number).padStart(4, '0')}
            </p>
          </div>
          <p className="font-semibold leading-relaxed text-[rgb(var(--sw-sage))]">
            {sale.test
              ? 'Llegó a Pedidos del panel marcada como prueba.'
              : `Muéstralo en el local${address ? ` (${address})` : ''} para retirar y pagar ${formatPrice(sale.total)}.${until ? ` Lo guardamos hasta el ${until}.` : ''}`}
          </p>
          <div className="mt-1 flex gap-2">
            <button onClick={() => void print()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[rgb(var(--sw-line))] font-display text-lg hover:border-[rgb(var(--sw-sage))]">
              <LuPrinter className="size-5" aria-hidden /> Guardar reserva
            </button>
            <button onClick={onClose} className="h-12 flex-1 rounded-2xl bg-[rgb(var(--sw-fire))] font-display text-lg text-[rgb(var(--sw-fire-ink))] hover:brightness-105">
              Seguir comprando
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
