import { AnimatePresence, motion } from 'framer-motion'
import { LuArrowLeft, LuArrowRight, LuBatteryCharging, LuCake, LuPlus, LuShoppingBag, LuStore, LuTag } from 'react-icons/lu'
import { useState } from 'react'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import { formatAge, formatPrice } from '@/lib/format'
import { priceFor } from '@/lib/pricing'
import type { publicCatalog } from '@/services/commerce'
import { categoryIcon } from '@/features/inventory/components/ProductThumb'
import type { BoardColor, Category, Discount } from '@/types'
import { CardScene } from './ValleyScene'
import { DragonJaw } from './Castle'

type Item = Awaited<ReturnType<typeof publicCatalog>>['products'][number]

const TINT: Record<BoardColor, string> = { sol: 'text-sol', coral: 'text-coral', turquesa: 'text-turquesa', lila: 'text-lila', hoja: 'text-hoja', cielo: 'text-cielo' }

/** Dirección de la ficha de un juguete (se puede compartir o abrir en otra pestaña). */
export const toyPath = (id: string) => `/tienda/juguete/${encodeURIComponent(id)}`

/** Lee el id del juguete de la dirección actual; null = portada de la tienda. */
export function toyFromLocation(): string | null {
  const m = window.location.pathname.match(/^\/tienda\/juguete\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

/** Ficha del juguete: fotos, precio, descripción y características que el dueño carga en el panel. */
export function ToyDetail({
  p,
  category,
  discounts,
  inCart,
  address,
  onAdd,
  onBack,
  onCart,
  related,
}: {
  p: Item
  category?: Category
  discounts: Discount[]
  inCart: number
  address: string
  onAdd: (from: DOMRect, color: BoardColor) => void
  onBack: () => void
  onCart: () => void
  related: React.ReactNode
}) {
  const price = priceFor(p, discounts)
  const color = category?.color ?? 'sol'
  const left = p.stock - inCart
  const description = p.description?.trim() ?? ''
  const features = p.features ?? []
  const [pop, setPop] = useState(0)

  const facts = [
    { icon: LuCake, label: 'Edad', value: formatAge(p.ageMin) },
    { icon: LuBatteryCharging, label: 'Pilas', value: p.batteries ? 'Usa pilas' : 'No usa pilas' },
    { icon: LuTag, label: 'Marca', value: p.brand || 'Sin marca' },
  ]

  return (
    <main className="mx-auto max-w-[1312px] px-4 pb-16 pt-8 sm:px-8 lg:px-0">
      <button onClick={onBack} className="group inline-flex items-center gap-2 font-display text-lg text-[rgb(var(--sw-moss))] transition-colors hover:text-[rgb(var(--sw-ink))]">
        <LuArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" aria-hidden /> Volver a los juguetes
      </button>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}>
          <Gallery p={p} color={color} percent={price.percent} Icon={categoryIcon(category)} />
        </motion.div>

        <motion.div
          className="flex flex-col"
          initial="hide"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        >
          <Reveal>
            <p className="flex items-center gap-2 font-display text-lg text-[rgb(var(--sw-moss))]">
              <span className={clsx('size-2.5 rounded-full', BOARD[color].fill)} aria-hidden />
              {category?.name ?? 'Juguete'}
            </p>
          </Reveal>
          <Reveal>
            <h1 className="font-medieval mt-3 text-[2.4rem] leading-[1.02] sm:text-[3.2rem]" style={{ textWrap: 'balance' }}>
              {p.name}
            </h1>
          </Reveal>
          <Reveal>
            <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="num font-display text-[2.4rem] leading-none">{formatPrice(price.final)}</span>
              {price.percent > 0 && (
                <>
                  <span className="num text-lg font-bold text-[rgb(var(--sw-sage))] line-through">{formatPrice(price.list)}</span>
                  <span className="rounded-full bg-coral px-2.5 py-0.5 text-sm font-black text-on-fill">−{price.percent}%</span>
                </>
              )}
            </p>
            <p className="mt-2 text-sm font-semibold text-[rgb(var(--sw-sage))]">Precio en pesos con IVA incluido.</p>
          </Reveal>

          <Reveal>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <motion.button
                key={pop}
                onClick={(e) => {
                  onAdd(e.currentTarget.getBoundingClientRect(), color)
                  setPop((n) => n + 1)
                }}
                disabled={left <= 0}
                initial={pop ? { scale: 0.94 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                className="inline-flex h-14 items-center gap-3 rounded-full bg-[rgb(var(--sw-fire))] px-7 font-display text-xl text-[rgb(var(--sw-fire-ink))] shadow-[0_14px_30px_-14px_rgb(0_0_0/0.7)] transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[rgb(var(--sw-raised))] disabled:text-[rgb(var(--sw-sage))] disabled:shadow-none"
              >
                {left <= 0 ? (inCart ? 'Ya tienes todos en el carrito' : 'Sin stock') : inCart ? 'Sumar otro' : 'Agregar al carrito'}
                {left > 0 && (inCart ? <LuPlus className="size-5" strokeWidth={3} aria-hidden /> : <LuArrowRight className="size-5" strokeWidth={3} aria-hidden />)}
              </motion.button>
              {inCart > 0 && (
                <button onClick={onCart} className="inline-flex h-14 items-center gap-2 rounded-full border-2 border-[rgb(var(--sw-ink)/0.85)] px-5 font-display text-lg transition-colors hover:bg-[rgb(var(--sw-ink))] hover:text-[rgb(var(--sw-ground))]">
                  <LuShoppingBag className="size-5" aria-hidden /> Ver carrito ({inCart})
                </button>
              )}
            </div>
            <p className={clsx('mt-3 text-sm font-extrabold', p.stock <= 3 ? 'text-[rgb(var(--sw-ember))]' : 'text-[rgb(var(--sw-sage))]')} role="status">
              {p.stock <= 3 ? `¡Quedan ${p.stock}!` : 'Disponible para retirar en el local'}
            </p>
          </Reveal>

          <Reveal>
            <dl className="mt-9 grid grid-cols-3 gap-3 border-y border-[rgb(var(--sw-line))] py-5">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <dt className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--sw-sage))]">
                    <Icon className="size-4" aria-hidden /> {label}
                  </dt>
                  <dd className="font-bold leading-snug">{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          {description && (
            <Reveal>
              <div className="mt-8">
                <h2 className="font-medieval text-2xl text-[rgb(var(--sw-moss))]">Sobre este juguete</h2>
                <p className="mt-3 whitespace-pre-line text-lg font-semibold leading-relaxed text-[rgb(var(--sw-ink)/0.92)]">{description}</p>
              </div>
            </Reveal>
          )}

          {features.length > 0 && (
            <Reveal>
              <div className="mt-8">
                <h2 className="font-medieval text-2xl text-[rgb(var(--sw-moss))]">Características</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {features.map((f, i) => (
                    <motion.li
                      key={f + i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                      className="flex items-start gap-3 font-semibold leading-snug"
                    >
                      <span className={clsx('mt-1.5 size-2.5 shrink-0 rounded-full', BOARD[color].fill)} aria-hidden />
                      {f}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}

          <Reveal>
            <p className="mt-9 flex items-start gap-3 rounded-2xl bg-[rgb(var(--sw-surface))] p-4 text-sm font-semibold leading-relaxed text-[rgb(var(--sw-sage))]">
              <LuStore className="mt-0.5 size-5 shrink-0 text-[rgb(var(--sw-moss))]" aria-hidden />
              <span>
                Lo reservas sin pagar online y lo pagas al retirarlo{address ? ` en ${address}` : ' en el local'}. Código del producto: <span className="num">{p.sku}</span>
              </span>
            </p>
          </Reveal>
        </motion.div>
      </div>

      {related}
    </main>
  )
}

function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={{ hide: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 24 } } }}>
      {children}
    </motion.div>
  )
}

/** Foto grande con miniaturas; sin fotos, el paisaje del valle con el ícono de la categoría. */
function Gallery({ p, color, percent, Icon }: { p: Item; color: BoardColor; percent: number; Icon: ReturnType<typeof categoryIcon> }) {
  const [active, setActive] = useState(0)
  const photos = p.photos
  const main = photos[Math.min(active, photos.length - 1)]

  return (
    <div className="flex flex-col gap-4">
      <div className="jaw-window relative aspect-[4/3] overflow-hidden bg-[rgb(var(--sw-raised))]">
        {main ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={main}
              src={main}
              alt={p.name}
              className="size-full object-cover"
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
          </AnimatePresence>
        ) : (
          <div className="relative size-full">
            <CardScene seed={p.name.length + 3} color={color} className="absolute inset-0 size-full" />
            <motion.span
              style={{ x: '-50%' }}
              className="absolute bottom-[20%] left-1/2 block size-[42%]"
              animate={{ y: [0, -10, 0], rotate: [0, -3, 0, 3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon className={clsx('size-full drop-shadow-[0_10px_10px_rgb(0_0_0/0.45)]', TINT[color])} aria-hidden />
            </motion.span>
          </div>
        )}
        {percent > 0 && (
          <span className="num absolute right-4 top-[24%] z-10 grid size-16 -rotate-12 place-items-center rounded-full bg-coral font-black text-on-fill shadow-[0_6px_14px_-6px_rgb(0_0_0/0.6)]">
            −{percent}%
          </span>
        )}
        <DragonJaw seed={p.name.length} />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1" role="group" aria-label="Fotos del juguete">
          {photos.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Ver foto ${i + 1} de ${photos.length}`}
              aria-pressed={i === active}
              className={clsx(
                'size-20 shrink-0 overflow-hidden rounded-2xl border-2 transition-[border-color,opacity]',
                i === active ? 'border-[rgb(var(--sw-fire))]' : 'border-[rgb(var(--sw-line))] opacity-70 hover:opacity-100',
              )}
            >
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

