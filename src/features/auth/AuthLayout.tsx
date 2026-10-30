import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import { STORE } from '@/lib/config'
import type { BoardColor } from '@/types'

const PATH: (BoardColor | null)[] = ['sol', 'coral', 'turquesa', 'lila', 'hoja', 'cielo', 'sol', 'coral', null, null, null, null]

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx('flex items-center gap-2.5 font-black tracking-tight', className)}>
      <svg viewBox="0 0 32 32" className="size-9" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="rgb(var(--sol))" />
        <path d="M16 2a14 14 0 0 1 14 14H16z" fill="rgb(var(--coral))" />
        <circle cx="16" cy="16" r="4.5" fill="rgb(var(--rail))" />
      </svg>
      {STORE.name}
    </span>
  )
}

/** Marco de las pantallas de ingreso: panel de marca con el tablero a la izquierda, formulario a la derecha. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-rail p-10 text-white lg:flex">
        <Logo className="text-2xl" />
        <div className="flex flex-col gap-8">
          <p className="max-w-sm text-3xl font-black leading-tight tracking-tight">
            Cada lote, una partida.
            <span className="block text-rail-ink">Cargar, vender y controlar la juguetería en un solo lugar.</span>
          </p>
          <ol className="grid max-w-md grid-cols-6 gap-2" aria-hidden>
            {PATH.map((c, i) => (
              <motion.li
                key={i}
                className={clsx('relative h-10 rounded-xl', c ? BOARD[c].fill : 'bg-rail-hover')}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 420, damping: 18 }}
              >
                {i === 7 && (
                  <motion.span
                    className="absolute inset-0 m-auto size-5 rounded-full bg-ink ring-[3px] ring-white shadow-[0_3px_0_rgb(0_0_0/0.3)]"
                    initial={{ y: -18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.9, type: 'spring', stiffness: 460, damping: 16 }}
                  />
                )}
              </motion.li>
            ))}
          </ol>
        </div>
        <p className="text-sm font-semibold text-rail-ink">Los datos se guardan en este equipo.</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 text-2xl lg:hidden" />
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-[0.9375rem] font-semibold text-ink-soft">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
