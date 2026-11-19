import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { SiDragonframe } from 'react-icons/si'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import { STORE } from '@/lib/config'
import type { BoardColor } from '@/types'
import { cloud } from '@/services/supabase'

const PATH: BoardColor[] = ['sol', 'coral', 'turquesa', 'lila', 'hoja', 'cielo', 'cielo', 'hoja', 'lila', 'turquesa', 'coral', 'sol']
// Recorrido en zigzag: la fila de abajo se lee de derecha a izquierda.
const ORDER = [0, 1, 2, 3, 4, 5, 11, 10, 9, 8, 7, 6]

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx('flex items-center gap-2.5 font-black tracking-tight', className)}>
      <span className="grid size-10 place-items-center logo-tile rounded-xl" aria-hidden>
        <SiDragonframe className="size-6" />
      </span>
      {STORE.name}
    </span>
  )
}

/** La ficha recorre el tablero en loop, casilla por casilla, con un salto. */
function HoppingBoard() {
  const still = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (still) return
    const t = setInterval(() => setStep((s) => (s + 1) % PATH.length), 650)
    return () => clearInterval(t)
  }, [still])
  const at = ORDER[step]

  return (
    <ol className="grid max-w-md grid-cols-6 gap-2" aria-hidden>
      {PATH.map((c, i) => (
        <motion.li
          key={i}
          className={clsx('relative h-12 rounded-xl', BOARD[c].fill)}
          initial={{ scale: 0.4, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 420, damping: 16 }}
        >
          {i === at && (
            <motion.span
              layoutId="login-pawn"
              className="absolute inset-0 m-auto size-6 rounded-full bg-ink ring-[3px] ring-white shadow-[0_4px_0_rgb(0_0_0/0.3)]"
              transition={{ type: 'spring', stiffness: 520, damping: 17 }}
            />
          )}
        </motion.li>
      ))}
    </ol>
  )
}

/** Marco de las pantallas de ingreso: panel animado con el dragón y el tablero, formulario a la derecha. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const still = useReducedMotion()
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-rail p-10 text-white lg:flex">
        {/* Brasas subiendo */}
        {Array.from({ length: 14 }, (_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute size-1.5 rounded-full bg-sol"
            style={{ left: `${(i * 41) % 100}%`, bottom: -8 }}
            animate={still ? undefined : { y: [0, -700], opacity: [0, 0.7, 0] }}
            transition={{ duration: 7 + (i % 4), repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
          />
        ))}
        <Logo className="relative text-2xl" />

        <div className="relative flex flex-col gap-8">
          <motion.div
            className="relative grid size-36 place-items-center logo-tile rounded-[2.2rem] !shadow-[0_10px_0_rgb(110_25_15/0.35)]"
            initial={{ scale: 0, rotate: -25 }}
            animate={still ? { scale: 1, rotate: 0 } : { scale: 1, rotate: [0, -4, 4, 0], y: [0, -10, 0] }}
            transition={{ scale: { type: 'spring', stiffness: 260, damping: 14 }, rotate: { duration: 6, repeat: Infinity }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
            aria-hidden
          >
            <motion.span
              className="absolute -inset-4 rounded-[2.8rem] bg-coral/40 blur-xl"
              animate={still ? undefined : { opacity: [0.3, 0.8, 0.3], scale: [0.95, 1.08, 0.95] }}
              transition={{ duration: 2.6, repeat: Infinity }}
            />
            <SiDragonframe className="relative size-24" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 120 }}
            className="max-w-sm text-3xl font-black leading-tight tracking-tight"
          >
            Cada lote, una partida.
            <span className="block text-rail-ink">Cargar, vender y controlar la juguetería en un solo lugar.</span>
          </motion.p>
          <HoppingBoard />
        </div>
        <p className="relative text-sm font-semibold text-rail-ink">{cloud ? 'Los datos se guardan en la nube y se comparten entre tus equipos.' : 'Los datos se guardan en este equipo.'}</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20, delay: 0.1 }}
        >
          <Logo className="mb-10 text-2xl lg:hidden" />
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-[0.9375rem] font-semibold text-ink-soft">{subtitle}</p>
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}>
            {children}
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
