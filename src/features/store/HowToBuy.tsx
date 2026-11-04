import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowLeftRight,
  LuArrowRight,
  LuBadgeCheck,
  LuBanknote,
  LuCreditCard,
  LuMapPin,
  LuShoppingBag,
  LuSmartphone,
  LuStore,
  LuTicket,
} from 'react-icons/lu'
import { SiDragonframe } from 'react-icons/si'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { categoryIcon } from '@/features/inventory/components/ProductThumb'
import type { BoardColor, Category } from '@/types'
import { CardScene } from './ValleyScene'

const TINT: Record<BoardColor, string> = { sol: 'text-sol', coral: 'text-coral', turquesa: 'text-turquesa', lila: 'text-lila', hoja: 'text-hoja', cielo: 'text-cielo' }

const STEPS = [
  { title: 'Elige tus juguetes', text: 'Agrégalos al carrito desde el catálogo. Los precios ya incluyen IVA.', scene: 'sol' as BoardColor },
  { title: 'Reserva sin pagar online', text: 'Deja tu nombre y cómo vas a pagar. Te los guardamos 3 días con un código de retiro.', scene: 'lila' as BoardColor },
  { title: 'Retira y paga en el local', text: 'Pagas al retirar, con el medio que elegiste.', scene: 'hoja' as BoardColor },
]

const PAYS = [
  { icon: LuBanknote, label: 'Efectivo' },
  { icon: LuCreditCard, label: 'Débito y crédito' },
  { icon: LuArrowLeftRight, label: 'Transferencia' },
  { icon: LuSmartphone, label: 'Mercado Pago' },
]

/**
 * Los tres pasos para comprar como un camino del valle: un azulejo viaja entre las estaciones
 * y cada paso tiene su escena animada. Avanza solo hasta que la persona toca algo.
 */
export function HowToBuy({ categories, cartCount, address, onOpenCart }: { categories: Category[]; cartCount: number; address: string; onOpenCart: () => void }) {
  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState(false)
  const [hover, setHover] = useState(false)
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (touched || hover || reduce || !inView) return
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 5200)
    return () => clearTimeout(t)
  }, [step, touched, hover, reduce, inView])

  const go = (i: number, focus = false) => {
    const n = (i + STEPS.length) % STEPS.length
    setTouched(true)
    setStep(n)
    if (focus) tabs.current[n]?.focus()
  }

  return (
    <section
      ref={ref}
      id="como-comprar"
      aria-labelledby="como-comprar-titulo"
      className="mx-auto max-w-[1312px] scroll-mt-20 px-4 pb-20 sm:px-8 lg:px-0"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <h2 id="como-comprar-titulo" className="mt-14 font-display text-[2.2rem] leading-none sm:text-[2.8rem]">
        Cómo comprar
      </h2>
      <p className="mt-3 font-semibold text-[rgb(var(--sw-sage))]">Toca cada paso para verlo.</p>

      {/* El camino: tres estaciones y el azulejo que viaja entre ellas */}
      <div className="relative mt-10">
        <svg className="absolute inset-x-[16.66%] top-[27px] h-2 w-[66.66%]" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden>
          <line x1="0" y1="1" x2="100" y2="1" stroke="rgb(var(--sw-line))" strokeWidth="2" strokeDasharray="1.2 1.6" vectorEffect="non-scaling-stroke" />
          <motion.line
            x1="0"
            y1="1"
            x2="100"
            y2="1"
            stroke="rgb(var(--sw-moss))"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            initial={false}
            animate={{ pathLength: step / (STEPS.length - 1) }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        </svg>
        <div role="tablist" aria-label="Pasos para comprar" className="relative grid grid-cols-3">
          {STEPS.map((s, i) => {
            const on = i === step
            return (
              <button
                key={s.title}
                ref={(el) => {
                  tabs.current[i] = el
                }}
                role="tab"
                id={`paso-${i}`}
                aria-selected={on}
                aria-controls="paso-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => go(i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') (e.preventDefault(), go(step + 1, true))
                  if (e.key === 'ArrowLeft') (e.preventDefault(), go(step - 1, true))
                }}
                className="group flex flex-col items-center gap-3 rounded-2xl px-1 pb-1 text-center"
              >
                <span className="relative grid size-14 place-items-center">
                  <span
                    className={clsx(
                      'absolute inset-0 rounded-full border-2 transition-colors duration-300',
                      on || i < step ? 'border-[rgb(var(--sw-moss))] bg-[rgb(var(--sw-surface))]' : 'border-[rgb(var(--sw-line))] bg-[rgb(var(--sw-ground))] group-hover:border-[rgb(var(--sw-sage))]',
                    )}
                  />
                  {on ? (
                    <motion.span
                      layoutId="viajero"
                      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                      className="logo-tile relative grid size-11 place-items-center rounded-xl"
                    >
                      <SiDragonframe className="size-6" aria-hidden />
                    </motion.span>
                  ) : (
                    <span className={clsx('num relative font-display text-xl', i < step ? 'text-[rgb(var(--sw-moss))]' : 'text-[rgb(var(--sw-sage))]')}>{i + 1}</span>
                  )}
                </span>
                <span className={clsx('font-display text-base leading-tight transition-colors sm:text-[1.2rem]', on ? 'text-[rgb(var(--sw-ink))]' : 'text-[rgb(var(--sw-moss))] group-hover:text-[rgb(var(--sw-ink))]')}>{s.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div id="paso-panel" role="tabpanel" aria-labelledby={`paso-${step}`} className="mt-10 grid items-center gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12">
        <div className="organic relative aspect-[16/10] overflow-hidden border-2 border-[rgb(var(--sw-rim))]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.35 }}>
              <CardScene seed={step * 5 + 3} color={STEPS[step].scene} bare={step === 2} className="absolute inset-0 size-full" />
              {step === 0 && <ChooseStage categories={categories} />}
              {step === 1 && <ReserveStage />}
              {step === 2 && <PickupStage />}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <p className="num font-display text-[1.1rem] text-[rgb(var(--sw-moss))]">Paso {step + 1} de 3</p>
            <h3 className="mt-2 font-display text-[1.9rem] leading-tight sm:text-[2.3rem]">{STEPS[step].title}</h3>
            <p className="mt-3 max-w-md font-semibold leading-relaxed text-[rgb(var(--sw-sage))]">{STEPS[step].text}</p>

            {step === 0 && (
              <a href="#juguetes" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border-2 border-[rgb(var(--sw-ink)/0.85)] px-5 font-display text-lg hover:bg-[rgb(var(--sw-ink))] hover:text-[rgb(var(--sw-ground))]">
                Ver juguetes <LuArrowDown className="size-5" aria-hidden />
              </a>
            )}
            {step === 1 && (
              <button onClick={onOpenCart} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border-2 border-[rgb(var(--sw-ink)/0.85)] px-5 font-display text-lg hover:bg-[rgb(var(--sw-ink))] hover:text-[rgb(var(--sw-ground))]">
                <LuShoppingBag className="size-5" aria-hidden />
                {cartCount ? `Abrir el carrito (${cartCount})` : 'Abrir el carrito'}
              </button>
            )}
            {step === 2 && (
              <div className="mt-6 flex flex-col gap-4">
                <ul className="flex flex-wrap gap-2">
                  {PAYS.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex h-10 items-center gap-2 rounded-full border-2 border-[rgb(var(--sw-line))] px-4 text-sm font-extrabold text-[rgb(var(--sw-sage))]">
                      <Icon className="size-4" aria-hidden /> {label}
                    </li>
                  ))}
                </ul>
                {address && (
                  <p className="flex items-center gap-2 font-bold">
                    <LuMapPin className="size-5 shrink-0 text-[rgb(var(--sw-ember))]" aria-hidden /> {address}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 flex gap-2">
              <button onClick={() => go(step - 1)} className="grid size-11 place-items-center rounded-full border-2 border-[rgb(var(--sw-line))] text-[rgb(var(--sw-sage))] hover:border-[rgb(var(--sw-sage))] hover:text-[rgb(var(--sw-ink))]" aria-label="Paso anterior">
                <LuArrowLeft className="size-5" />
              </button>
              <button onClick={() => go(step + 1)} className="grid size-11 place-items-center rounded-full border-2 border-[rgb(var(--sw-line))] text-[rgb(var(--sw-sage))] hover:border-[rgb(var(--sw-sage))] hover:text-[rgb(var(--sw-ink))]" aria-label="Paso siguiente">
                <LuArrowRight className="size-5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

/** Paso 1: tres juguetes saltan en la colina y, uno por uno, caen en la bolsa. */
function ChooseStage({ categories }: { categories: Category[] }) {
  const toys = categories.slice(0, 3)
  const [inBag, setInBag] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setInBag((n) => (n + 1) % 4), 1100)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="absolute inset-0">
      {toys.map((c, i) => {
        const Icon = categoryIcon(c)
        const gone = i < inBag
        return (
          <motion.span
            key={c.id}
            className={clsx('absolute bottom-[26%] size-[16%]', TINT[c.color])}
            style={{ left: `${10 + i * 17}%` }}
            animate={gone ? { left: '72%', bottom: '34%', scale: 0.4, opacity: 0, rotate: 30 } : { left: `${10 + i * 17}%`, bottom: ['26%', '34%', '26%'], scale: 1, opacity: 1, rotate: 0 }}
            transition={gone ? { type: 'spring', stiffness: 140, damping: 16 } : { bottom: { duration: 1.4, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }, default: { duration: 0.3 } }}
          >
            <Icon className="size-full drop-shadow-[0_6px_6px_rgb(0_0_0/0.45)]" aria-hidden />
          </motion.span>
        )
      })}
      <motion.div
        key={inBag}
        className="absolute bottom-[22%] right-[10%] grid size-[24%] place-items-center rounded-[28%] bg-[rgb(var(--sw-ground))] text-[rgb(var(--sw-ink))] shadow-[0_14px_24px_-12px_rgb(0_0_0/0.7)]"
        initial={{ scale: inBag ? 0.86 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 12 }}
      >
        <LuShoppingBag className="size-1/2" aria-hidden />
        <span className="num absolute -right-2 -top-2 grid size-8 place-items-center rounded-full bg-[rgb(var(--sw-fire))] font-display text-base text-[rgb(var(--sw-fire-ink))]">{inBag}</span>
      </motion.div>
    </div>
  )
}

/** Paso 2: sale un ticket de reserva, se completan sus renglones y cae el sello. */
function ReserveStage() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <motion.div
        className="relative w-[46%] rounded-2xl bg-[#F4F7F2] p-[4%] text-[#16201E] shadow-[0_18px_30px_-14px_rgb(0_0_0/0.8)]"
        initial={{ y: '60%', rotate: -6, opacity: 0 }}
        animate={{ y: '0%', rotate: -3, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <p className="flex items-center gap-2 font-display text-[clamp(0.8rem,1.6vw,1.2rem)]">
          <LuTicket className="size-[1.2em]" aria-hidden /> Reserva
        </p>
        {[0.9, 0.7, 0.8].map((w, i) => (
          <div key={i} className="mt-[6%] h-[0.5em] overflow-hidden rounded-full bg-[#DCE4DE] text-[clamp(0.8rem,1.6vw,1.2rem)]">
            <motion.div className="h-full rounded-full bg-[#6BC48A]" initial={{ width: 0 }} animate={{ width: `${w * 100}%` }} transition={{ delay: 0.5 + i * 0.35, duration: 0.5, ease: 'easeOut' }} />
          </div>
        ))}
        <motion.span
          className="absolute -right-[12%] -top-[14%] grid size-[38%] place-items-center rounded-full border-4 border-[#C2483B] text-[#C2483B]"
          initial={{ scale: 2.4, opacity: 0, rotate: -40 }}
          animate={{ scale: 1, opacity: 1, rotate: -14 }}
          transition={{ delay: 1.7, type: 'spring', stiffness: 420, damping: 14 }}
        >
          <LuBadgeCheck className="size-1/2" aria-hidden />
        </motion.span>
      </motion.div>
    </div>
  )
}

/** Paso 3: la bolsa cruza el mostrador del local y se van encendiendo los medios de pago. */
function PickupStage() {
  const [lit, setLit] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setLit((n) => (n + 1) % PAYS.length), 700)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="absolute inset-0">
      <div className="absolute bottom-[20%] left-[8%] right-[8%] h-[16%] rounded-xl bg-[#3B2A1E] shadow-[0_12px_20px_-10px_rgb(0_0_0/0.7)]" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-[28%] rounded-t-xl bg-[#5A4030]" />
      </div>
      <LuStore className="absolute bottom-[38%] right-[12%] size-[18%] text-[rgb(var(--sw-ink)/0.85)]" aria-hidden />
      <motion.span
        className="absolute bottom-[36%] grid size-[15%] place-items-center rounded-[26%] bg-[rgb(var(--sw-fire))] text-[rgb(var(--sw-fire-ink))] shadow-[0_10px_18px_-8px_rgb(0_0_0/0.7)]"
        initial={{ left: '62%' }}
        animate={{ left: ['62%', '14%'] }}
        transition={{ duration: 1.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <LuShoppingBag className="size-1/2" aria-hidden />
      </motion.span>
      <div className="absolute left-[8%] right-[8%] top-[10%] flex justify-center gap-[3%]">
        {PAYS.map(({ icon: Icon, label }, i) => (
          <motion.span
            key={label}
            className="grid size-[12%] min-w-9 place-items-center rounded-full"
            animate={i === lit ? { backgroundColor: 'rgb(255 138 43)', color: 'rgb(35 16 4)', scale: 1.12 } : { backgroundColor: 'rgb(14 21 19 / 0.7)', color: 'rgb(143 168 155)', scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <Icon className="size-1/2" aria-hidden />
          </motion.span>
        ))}
      </div>
    </div>
  )
}
