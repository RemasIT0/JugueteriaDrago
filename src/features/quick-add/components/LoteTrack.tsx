import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Flag, Gauge, RotateCw, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import { useLoteSpaces } from '../useLoteSpaces'

/** Cifra que cambia en su sitio con un giro corto, como una paleta de tablero de estación. */
export function FlipNumber({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <span className={clsx('num inline-flex overflow-hidden', className)} aria-label={String(value)}>
      {String(value)
        .split('')
        .map((d, i, all) => (
          <span key={all.length - i} className="relative inline-block" aria-hidden>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={d}
                className="inline-block"
                initial={reduce ? false : { y: '-70%', opacity: 0, rotateX: 80 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                exit={reduce ? undefined : { y: '70%', opacity: 0, rotateX: -80 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {d}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
    </span>
  )
}

/** La ficha: un disco con sombra propia que se para sobre la casilla y salta a la siguiente. */
function Token({ layoutId, small = false }: { layoutId: string; small?: boolean }) {
  return (
    <motion.span
      layoutId={layoutId}
      className={clsx(
        // Centrado con inset+margin: Framer Motion reescribe transform y anularía un translate.
        'pointer-events-none absolute inset-0 z-10 m-auto rounded-full bg-ink ring-[3px] ring-surface',
        'shadow-[0_3px_0_rgb(var(--shadow)/0.35),0_8px_14px_-4px_rgb(var(--shadow)/0.5)]',
        small ? 'size-3' : 'size-4 sm:size-[1.15rem]',
      )}
      transition={{ type: 'spring', stiffness: 460, damping: 20 }}
      aria-hidden
    >
      <span className="absolute inset-[3px] rounded-full bg-surface/25" />
    </motion.span>
  )
}

/**
 * La pista del lote: cada producto guardado ocupa una casilla con el color de su
 * categoría y la ficha avanza. Con metas grandes, cada casilla agrupa varios productos.
 */
export function LoteTrack({ onNewLote }: { onNewLote: () => void }) {
  const { done, goal, remaining, reached, perSpace, spaces, filled, colors, entriesAt } = useLoteSpaces()
  const pace = usePace(entriesAt)
  const tokenAt = Math.min(filled, spaces - 1)

  // Segmentos del celular: ~10 tramos, cada uno con el color de su último producto.
  const segs = Math.min(10, spaces)
  const perSeg = spaces / segs

  return (
    <section aria-label="Avance del lote" className="relative rounded-3xl bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-black leading-none tracking-tight">
            <FlipNumber value={done} />
            <span className="num text-ink-soft"> / {goal}</span>
          </p>
          <p className="text-sm font-extrabold text-ink-soft">
            {reached ? (
              '¡Meta del lote cumplida!'
            ) : (
              <>
                faltan <FlipNumber value={remaining} />
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <dl className="flex gap-1.5 text-sm font-extrabold">
            <div className="flex items-center gap-1.5 rounded-xl bg-sunken px-3 py-1.5">
              <Gauge className="size-4 text-turquesa-ink" strokeWidth={2.5} aria-hidden />
              <dt className="sr-only">Ritmo</dt>
              <dd className="num">{pace.perMin ? `${pace.perMin.toFixed(1)}/min` : '—/min'}</dd>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-sunken px-3 py-1.5">
              <Timer className="size-4 text-coral-ink" strokeWidth={2.5} aria-hidden />
              <dt className="sr-only">Tiempo</dt>
              <dd className="num">{pace.elapsed}</dd>
            </div>
          </dl>
          {/* Cerrar el lote vive aparte de los campos, con confirmación. */}
          <button
            onClick={onNewLote}
            className="ml-2 flex h-9 items-center gap-1.5 rounded-xl border-2 border-line px-3 text-xs font-extrabold text-ink-soft transition-colors hover:border-ink-soft/50 hover:text-ink"
          >
            <RotateCw className="size-3.5" aria-hidden /> Cerrar lote
          </button>
        </div>
      </div>

      {/* Celular: barra segmentada. */}
      <ol className="flex items-center gap-1 sm:hidden" aria-label={`${done} de ${goal} productos cargados`}>
        {Array.from({ length: segs }, (_, i) => {
          const end = Math.round((i + 1) * perSeg) - 1
          const full = filled > end
          const partial = !full && filled > Math.round(i * perSeg)
          const color = colors[Math.min(filled, end + 1) - 1]
          const hasToken = !reached && tokenAt >= Math.round(i * perSeg) && tokenAt <= end
          return (
            <li key={i} className="relative h-4 flex-1 rounded-full bg-sunken">
              {(full || partial) && color && (
                <motion.span
                  className={clsx('absolute inset-y-0 left-0 rounded-full', BOARD[color].fill)}
                  initial={false}
                  animate={{ width: full ? '100%' : `${((filled - Math.round(i * perSeg)) / perSeg) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                />
              )}
              {hasToken && <Token layoutId="lote-token-sm" small />}
            </li>
          )
        })}
        <li className="grid size-6 shrink-0 place-items-center rounded-md bg-sol" aria-hidden>
          <Flag className="size-3.5 text-on-fill" strokeWidth={3} />
        </li>
      </ol>

      {/* Escritorio y tablet: el tablero completo. */}
      <ol
        className="hidden gap-1.5 sm:grid sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
        style={{ '--cols': Math.min(spaces, 25) } as React.CSSProperties}
        aria-label={`${done} de ${goal} productos cargados`}
      >
        {Array.from({ length: spaces }, (_, i) => {
          const color = colors[i]
          const isGoal = i === spaces - 1
          const milestone = (i + 1) % 10 === 0 && !isGoal
          return (
            <li key={i} className="relative h-8">
              <motion.div
                className={clsx(
                  'absolute inset-0 grid place-items-center rounded-[10px]',
                  color ? BOARD[color].fill : isGoal ? 'bg-sol' : milestone ? 'bg-line' : 'bg-sunken',
                )}
                initial={false}
                animate={
                  reached ? { y: [0, -6, 0], transition: { delay: i * 0.015, duration: 0.45 } } : color ? { scale: [0.6, 1.12, 1] } : { scale: 1 }
                }
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                {isGoal ? (
                  <Flag className="size-4 text-on-fill" strokeWidth={3} aria-hidden />
                ) : (
                  milestone &&
                  !color && <span className="num text-2xs font-black text-ink-soft">{(i + 1) * perSpace}</span>
                )}
              </motion.div>
              {i === tokenAt && !reached && <Token layoutId="lote-token" />}
            </li>
          )
        })}
      </ol>
      {perSpace > 1 && <p className="mt-2 hidden text-xs font-semibold text-ink-soft sm:block">Cada casilla equivale a {perSpace} productos.</p>}
    </section>
  )
}

function usePace(times: string[]) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!times.length) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [times.length])

  if (!times.length) return { perMin: 0, elapsed: '0:00' }
  const start = new Date(times[0]).getTime()
  const secs = Math.max(1, Math.round((now - start) / 1000))
  const mins = secs / 60
  return {
    perMin: times.length > 1 ? times.length / Math.max(mins, 0.25) : 0,
    elapsed: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
  }
}
