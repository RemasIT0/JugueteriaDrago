import { motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'

/**
 * Fondo animado: piezas del tablero (casillas, fichas, dados) que flotan muy despacio
 * detrás del contenido. Opacidad baja para no competir con la tarea; quieto si el
 * sistema pide menos movimiento.
 */
const PIECES = [
  { shape: 'square', color: 'bg-sol', size: 'size-24', x: '6%', y: '12%', dur: 26, rot: 18 },
  { shape: 'circle', color: 'bg-coral', size: 'size-16', x: '82%', y: '8%', dur: 22, rot: 0 },
  { shape: 'square', color: 'bg-turquesa', size: 'size-20', x: '70%', y: '62%', dur: 30, rot: -14 },
  { shape: 'circle', color: 'bg-lila', size: 'size-28', x: '18%', y: '74%', dur: 34, rot: 0 },
  { shape: 'dice', color: 'bg-cielo', size: 'size-14', x: '46%', y: '30%', dur: 24, rot: 30 },
  { shape: 'square', color: 'bg-hoja', size: 'size-12', x: '90%', y: '40%', dur: 20, rot: 40 },
  { shape: 'circle', color: 'bg-sol', size: 'size-10', x: '38%', y: '88%', dur: 18, rot: 0 },
] as const

export function AnimatedBackdrop() {
  const still = useReducedMotion()
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden lg:left-64" aria-hidden>
      {PIECES.map((p, i) => (
        <motion.div
          key={i}
          className={clsx('absolute opacity-[0.07] dark:opacity-[0.06]', p.size, p.color, p.shape === 'circle' ? 'rounded-full' : 'rounded-[28%]')}
          style={{ left: p.x, top: p.y }}
          initial={false}
          animate={still ? undefined : { y: [0, -36, 0, 24, 0], x: [0, 18, -12, 0], rotate: [p.rot, p.rot + 25, p.rot - 10, p.rot] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut' }}
        >
          {p.shape === 'dice' && (
            <span className="grid size-full grid-cols-2 place-items-center p-[22%]">
              {[0, 1, 2, 3].map((d) => (
                <span key={d} className="size-[38%] rounded-full bg-ink" />
              ))}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  )
}
