import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/**
 * Cabeza de dragón (SVG dibujado a mano) con ojos que brillan y siguen el cursor,
 * parpadeo, humo por la nariz y fuego de partículas (canvas) que sale de la boca.
 * Escupe fuego solo cada pocos segundos y cada vez que alguien le hace clic.
 */
export function Dragon({ onRoar }: { onRoar?: () => void }) {
  const still = useReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const fireRef = useRef<FireHandle>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 80, damping: 14 })
  const sy = useSpring(my, { stiffness: 80, damping: 14 })
  const tilt = useTransform(sx, [-1, 1], [-7, 7])
  const lookX = useTransform(sx, [-1, 1], [-7, 7])
  const lookY = useTransform(sy, [-1, 1], [-5, 5])
  const [blink, setBlink] = useState(false)
  const [breathing, setBreathing] = useState(false)

  useEffect(() => {
    if (still) return
    const onMove = (e: PointerEvent) => {
      const r = wrap.current?.getBoundingClientRect()
      if (!r) return
      mx.set(Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.2))))
      my.set(Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 1.2))))
    }
    window.addEventListener('pointermove', onMove)
    const blinkT = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 140)
    }, 4200)
    const breathT = setInterval(() => roar(false), 5200)
    const first = setTimeout(() => roar(false), 900)
    return () => {
      window.removeEventListener('pointermove', onMove)
      clearInterval(blinkT)
      clearInterval(breathT)
      clearTimeout(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still])

  function roar(user = true) {
    setBreathing(true)
    fireRef.current?.burst(user ? 1.6 : 1.1)
    setTimeout(() => setBreathing(false), user ? 1500 : 1100)
    if (user) onRoar?.()
  }

  return (
    <div ref={wrap} className="relative mx-auto aspect-square w-[min(78vw,420px)]">
      <FireCanvas ref={fireRef} still={!!still} />
      <motion.button
        type="button"
        onClick={() => roar(true)}
        aria-label="Hacer que el dragón escupa fuego"
        className="relative z-10 block size-full cursor-pointer rounded-full outline-none focus-visible:ring-4 focus-visible:ring-sol"
        style={{ rotate: still ? 0 : tilt }}
        animate={still ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        whileTap={{ scale: 0.97 }}
      >
        <svg viewBox="0 0 400 400" className="size-full overflow-visible drop-shadow-[0_24px_30px_rgba(0,0,0,0.35)]" aria-hidden>
          <defs>
            <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#B7FFF6" stopOpacity="1" />
              <stop offset="45%" stopColor="#3DB4A8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#3DB4A8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59A88" />
              <stop offset="100%" stopColor="#E0614E" />
            </linearGradient>
            <linearGradient id="snout" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFD7A8" />
              <stop offset="100%" stopColor="#F6B272" />
            </linearGradient>
            <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Cuernos */}
          <path d="M120 120 C 90 70, 70 40, 40 20 C 95 35, 140 70, 160 110 Z" fill="#F6C945" stroke="#C99A12" strokeWidth="4" strokeLinejoin="round" />
          <path d="M280 120 C 310 70, 330 40, 360 20 C 305 35, 260 70, 240 110 Z" fill="#F6C945" stroke="#C99A12" strokeWidth="4" strokeLinejoin="round" />
          {/* Crestas laterales */}
          <path d="M78 190 L 30 170 L 70 215 L 25 230 L 82 250 Z" fill="#9C8CE8" stroke="#6B59C9" strokeWidth="4" strokeLinejoin="round" />
          <path d="M322 190 L 370 170 L 330 215 L 375 230 L 318 250 Z" fill="#9C8CE8" stroke="#6B59C9" strokeWidth="4" strokeLinejoin="round" />
          {/* Púas de la frente */}
          <path d="M170 92 L 185 58 L 200 90 L 215 58 L 230 92 Z" fill="#3DB4A8" stroke="#1E7F76" strokeWidth="4" strokeLinejoin="round" />

          {/* Cabeza */}
          <path
            d="M200 92 C 290 92, 335 150, 330 220 C 326 270, 300 300, 268 316 L 132 316 C 100 300, 74 270, 70 220 C 65 150, 110 92, 200 92 Z"
            fill="url(#skin)"
            stroke="#B8432F"
            strokeWidth="5"
          />
          {/* Escamas */}
          {[
            [150, 135],
            [200, 125],
            [250, 135],
            [175, 160],
            [225, 160],
          ].map(([x, y], i) => (
            <path key={i} d={`M${x - 12} ${y} q 12 -14 24 0`} fill="none" stroke="#C9513D" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          ))}

          {/* Cejas */}
          <path d="M112 180 Q 145 158 180 178" fill="none" stroke="#8E2F21" strokeWidth="9" strokeLinecap="round" />
          <path d="M288 180 Q 255 158 220 178" fill="none" stroke="#8E2F21" strokeWidth="9" strokeLinecap="round" />

          {/* Ojos con brillo */}
          {[
            [148, 205],
            [252, 205],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <motion.circle cx={cx} cy={cy} r="44" fill="url(#eyeGlow)" filter="url(#soft)" animate={still ? undefined : { opacity: [0.55, 1, 0.55], r: [40, 48, 40] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
              <motion.g style={{ originX: `${cx}px`, originY: `${cy}px` }} animate={{ scaleY: blink ? 0.08 : 1 }} transition={{ duration: 0.08 }}>
                <ellipse cx={cx} cy={cy} rx="27" ry="23" fill="#F4FFFD" stroke="#8E2F21" strokeWidth="5" />
                <motion.g style={{ x: lookX, y: lookY }}>
                  <circle cx={cx} cy={cy} r="15" fill="#3DB4A8" />
                  <motion.ellipse cx={cx} cy={cy} rx="4.5" ry="13" fill="#123238" animate={{ rx: breathing ? 2.5 : 4.5 }} />
                  <circle cx={cx - 6} cy={cy - 7} r="4" fill="#fff" />
                </motion.g>
              </motion.g>
            </g>
          ))}

          {/* Hocico */}
          <path d="M138 250 C 140 225, 260 225, 262 250 L 268 300 C 250 322, 150 322, 132 300 Z" fill="url(#snout)" stroke="#B8432F" strokeWidth="5" />
          <ellipse cx="178" cy="255" rx="9" ry="6" fill="#8E2F21" />
          <ellipse cx="222" cy="255" rx="9" ry="6" fill="#8E2F21" />

          {/* Boca: se abre más al escupir fuego */}
          <motion.path
            fill="#3A1410"
            stroke="#8E2F21"
            strokeWidth="5"
            strokeLinejoin="round"
            animate={{
              d: breathing
                ? 'M150 288 Q 200 280 250 288 Q 246 350 200 358 Q 154 350 150 288 Z'
                : 'M156 292 Q 200 286 244 292 Q 240 322 200 328 Q 160 322 156 292 Z',
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          />
          {/* Colmillos */}
          <path d="M168 290 L 176 306 L 184 290 Z M216 290 L 224 306 L 232 290 Z" fill="#FFFDF5" stroke="#B8432F" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </motion.button>
    </div>
  )
}

interface FireHandle {
  burst: (power: number) => void
}

interface P {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
}

/** Fuego de partículas desde la boca (73 % de alto, centro), con mezcla aditiva. */
import { forwardRef, useImperativeHandle } from 'react'

const FireCanvas = forwardRef<FireHandle, { still: boolean }>(function FireCanvas({ still }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const emitUntil = useRef(0)
  const power = useRef(1)

  useImperativeHandle(ref, () => ({
    burst(p) {
      power.current = p
      emitUntil.current = performance.now() + (p > 1.3 ? 1200 : 850)
    },
  }))

  useEffect(() => {
    if (still) return
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    const parts: P[] = []
    let raf = 0
    const resize = () => {
      const r = c.getBoundingClientRect()
      c.width = r.width * devicePixelRatio
      c.height = r.height * devicePixelRatio
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = (now: number) => {
      const w = c.width
      const h = c.height
      const ox = w * 0.5
      const oy = h * 0.6
      if (now < emitUntil.current) {
        for (let i = 0; i < 9 * power.current; i++) {
          const spread = (Math.random() - 0.5) * 0.9
          const speed = (3 + Math.random() * 4.5) * devicePixelRatio * power.current
          parts.push({ x: ox + (Math.random() - 0.5) * w * 0.05, y: oy, vx: spread * speed, vy: speed * (0.75 + Math.random() * 0.4), life: 0, max: 38 + Math.random() * 26, size: (10 + Math.random() * 18) * devicePixelRatio })
        }
      }
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.vx *= 1.015
        p.vy *= 0.985
        const t = p.life / p.max
        if (t >= 1) {
          parts.splice(i, 1)
          continue
        }
        const r = p.size * (0.6 + t * 1.6)
        // Blanco-amarillo al salir → naranja → rojo oscuro al apagarse.
        const hue = 52 - t * 48
        const light = 92 - t * 52
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        g.addColorStop(0, `hsla(${hue},100%,${light}%,${0.55 * (1 - t)})`)
        g.addColorStop(1, `hsla(${hue},100%,${light - 20}%,0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [still])

  return <canvas ref={canvas} className="pointer-events-none absolute -inset-x-[40%] -bottom-[70%] top-[20%] z-20 h-[150%] w-[180%]" aria-hidden />
})
