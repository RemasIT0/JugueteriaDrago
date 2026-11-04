import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import type { BoardColor } from '@/types'

/**
 * El valle al atardecer: la ventana enmarcada de la tienda, dibujada a mano en SVG.
 *
 * Va en piezas para que funcione en cualquier ancho: el fondo (cielo, luz, cordilleras, bosque)
 * se recorta al centro, mientras que las colinas con los juguetes, las enredaderas y el pasto del
 * frente se anclan a los bordes del marco, así en el celular siguen a la vista.
 * Las capas se corren un poco con el puntero para dar profundidad. Todo es decorado.
 */

const W = 1440
const H = 640
const GROUND = '#0E1513'

/** Generador determinista para que la escena no cambie entre renders. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Pino en capas: tres pisos de triángulos con borde dentado. */
function pine(x: number, base: number, h: number) {
  const w = h * 0.42
  const tiers = [
    [0, 0.42, 1],
    [0.28, 0.72, 0.8],
    [0.55, 1, 0.58],
  ]
  return (
    tiers
      .map(([top, bottom, spread]) => {
        const yT = base - h * (1 - top)
        const yB = base - h * (1 - bottom) + h * 0.06
        const hw = (w / 2) * spread
        return `M${x} ${yT} L${x - hw * 0.55} ${yB - h * 0.08} L${x - hw} ${yB} L${x - hw * 0.35} ${yB - h * 0.03} L${x} ${yB + h * 0.01} L${x + hw * 0.35} ${yB - h * 0.03} L${x + hw} ${yB} L${x + hw * 0.55} ${yB - h * 0.08} Z`
      })
      .join(' ') + ` M${x - h * 0.025} ${base - h * 0.02} h${h * 0.05} v${h * 0.08} h${-h * 0.05} Z`
  )
}

function forest(seed: number, y: number, minH: number, maxH: number, step: number) {
  const r = rng(seed)
  let d = ''
  for (let x = -20; x < W + 40; x += step * (0.7 + r() * 0.6)) d += pine(x, y + r() * 14, minH + r() * (maxH - minH)) + ' '
  return d
}

/** Briznas de pasto a lo largo de una curva. */
function grass(seed: number, pts: [number, number][], density: number, len: number) {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const n = Math.round(Math.hypot(x2 - x1, y2 - y1) / density)
    for (let k = 0; k < n; k++) {
      const t = k / n
      const x = x1 + (x2 - x1) * t + r() * 6
      const y = y1 + (y2 - y1) * t + 2
      const l = len * (0.5 + r())
      const lean = (r() - 0.5) * l * 0.9
      d += `M${x - 1.6} ${y} Q${x + lean * 0.4} ${y - l * 0.6} ${x + lean} ${y - l} Q${x + lean * 0.3 + 1} ${y - l * 0.5} ${x + 1.6} ${y} Z `
    }
  }
  return d
}

type Peak = [px: number, py: number, lx: number, ly: number, rx: number, ry: number]

/** Casquete de nieve: baja un tramo por cada ladera y termina en un borde dentado. */
function snowcap([px, py, lx, ly, rx, ry]: Peak, depth = 0.24) {
  const L = [px + (lx - px) * depth, py + (ly - py) * depth]
  const R = [px + (rx - px) * depth, py + (ry - py) * depth]
  const mid = (a: number[], b: number[], t: number, drop: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + drop]
  const j1 = mid(L, R, 0.25, 7)
  const j2 = mid(L, R, 0.5, -2)
  const j3 = mid(L, R, 0.75, 9)
  return `M${px} ${py} L${L[0]} ${L[1]} L${j1[0]} ${j1[1]} L${j2[0]} ${j2[1]} L${j3[0]} ${j3[1]} L${R[0]} ${R[1]} Z`
}

/** Cara en sombra: del pico hacia la base, del lado opuesto a la luz del logo. */
function shade([px, py, lx, ly, rx, ry]: Peak, base: number) {
  // La luz viene del centro: las laderas que miran hacia afuera quedan en sombra.
  return px < W / 2 ? `M${px} ${py} L${lx} ${ly} L${lx} ${base} L${px - (px - lx) * 0.35} ${base} Z` : `M${px} ${py} L${rx} ${ry} L${rx} ${base} L${px + (rx - px) * 0.35} ${base} Z`
}

/** Cara iluminada: la ladera que mira hacia el logo, con un lavado cálido. */
function lit([px, py, lx, ly, rx, ry]: Peak, base: number) {
  return px < W / 2 ? `M${px} ${py} L${rx} ${ry} L${rx} ${base} L${px + (rx - px) * 0.3} ${base} Z` : `M${px} ${py} L${lx} ${ly} L${lx} ${base} L${px - (px - lx) * 0.3} ${base} Z`
}

/** Borde iluminado: la arista que mira hacia el logo recibe la luz cálida. */
function rim([px, py, lx, ly, rx, ry]: Peak) {
  return px < W / 2 ? `M${px} ${py} L${px + (rx - px) * 0.55} ${py + (ry - py) * 0.55}` : `M${px} ${py} L${px + (lx - px) * 0.55} ${py + (ly - py) * 0.55}`
}

const FAR_RIDGE = 'M-20 470 L90 380 L170 420 L290 300 L380 380 L470 340 L560 410 L660 350 L760 420 L860 330 L960 390 L1060 290 L1160 370 L1250 320 L1360 400 L1460 360 L1460 520 L-20 520 Z'
const MID_RIDGE = 'M-20 520 L120 430 L210 470 L330 400 L430 470 L520 440 L610 500 L760 470 L880 420 L990 470 L1110 400 L1230 460 L1330 430 L1460 480 L1460 560 L-20 560 Z'
const FAR_PEAKS: Peak[] = [
  [290, 300, 170, 420, 380, 380],
  [470, 340, 380, 380, 560, 410],
  [660, 350, 560, 410, 760, 420],
  [860, 330, 760, 420, 960, 390],
  [1060, 290, 960, 390, 1160, 370],
  [1250, 320, 1160, 370, 1360, 400],
]
const MID_PEAKS: Peak[] = [
  [330, 400, 210, 470, 430, 470],
  [520, 440, 430, 470, 610, 500],
  [880, 420, 760, 470, 990, 470],
  [1110, 400, 990, 470, 1230, 460],
]

function useParallax(ref: React.RefObject<HTMLDivElement | null>) {
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 60, damping: 20 })
  useEffect(() => {
    const el = ref.current
    if (!el || reduce || !matchMedia('(pointer: fine)').matches) return
    const move = (e: PointerEvent) => {
      const b = el.getBoundingClientRect()
      px.set((e.clientX - b.left) / b.width - 0.5)
    }
    const leave = () => px.set(0)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [ref, px, reduce])
  return sx
}

function Layer({ shift, depth, children }: { shift: MotionValue<number>; depth: number; children: React.ReactNode }) {
  const x = useTransform(shift, (v) => v * -depth)
  return <motion.g style={{ x }}>{children}</motion.g>
}

/** Una pieza anclada a un borde del marco que también se mueve con el puntero. */
function Anchored({ shift, depth, className, viewBox, fit, children }: { shift: MotionValue<number>; depth: number; className: string; viewBox: string; fit?: string; children: React.ReactNode }) {
  const x = useTransform(shift, (v) => v * -depth)
  return (
    <motion.svg style={{ x }} viewBox={viewBox} preserveAspectRatio={fit} className={className} aria-hidden focusable="false">
      {children}
    </motion.svg>
  )
}

function Flowers({ items }: { items: [number, number, string][] }) {
  return (
    <g>
      {items.map(([x, y, c], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="3.4" ry="5.4" fill={c} transform={`rotate(${a})`} />
          ))}
          <circle r="2.6" fill="#FFF3C4" />
        </g>
      ))}
    </g>
  )
}

/** Hojas de enredadera: elipses en pares a lo largo de un tallo colgante. */
function Vine({ d, leaves }: { d: string; leaves: [number, number, number][] }) {
  return (
    <g>
      <path d={d} fill="none" stroke={GROUND} strokeWidth="3.2" strokeLinecap="round" />
      {leaves.map(([x, y, a], i) => (
        <ellipse key={i} cx={x} cy={y} rx="6.5" ry="13" fill={GROUND} transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </g>
  )
}

export function ValleyScene({ hostRef }: { hostRef: React.RefObject<HTMLDivElement | null> }) {
  const shift = useParallax(hostRef)
  const reduce = useReducedMotion()
  const scene = useMemo(() => {
    const r = rng(7)
    const stars = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * 250, s: 0.6 + r() * 1.6, o: 0.25 + r() * 0.7, tw: r() < 0.25 }))
    // Canopia: borde ondulado con muchas hojas que cuelgan sobre el cielo.
    const leaf = rng(31)
    const canopyLeaves = Array.from({ length: 70 }, (_, i) => {
      const x = (i / 70) * W + leaf() * 18
      return [x, 26 + leaf() * 22, (leaf() - 0.5) * 120] as [number, number, number]
    })
    return {
      stars,
      canopyLeaves,
      farForest: forest(11, 520, 46, 70, 26),
      nearForest: forest(23, 560, 70, 118, 38),
      leftGrass: grass(5, [[0, 120], [140, 70], [280, 52], [420, 70], [540, 112], [640, 200]], 5, 18),
      rightGrass: grass(9, [[0, 200], [110, 128], [250, 98], [390, 105], [600, 70]], 5, 18),
      front: grass(13, [[-20, 70], [W + 20, 70]], 3.4, 40),
    }
  }, [])

  return (
    <div className="absolute inset-0" aria-hidden>
      {/* Fondo: se recorta al centro */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full" focusable="false">
        <defs>
          <linearGradient id="vs-sky" x1="0" y1="0" x2="0" y2="1">
            {/* Azul profundo hasta donde llega el texto; el tramo claro del atardecer empieza en las cumbres */}
            <stop offset="0" stopColor="#0F2F4A" />
            <stop offset="0.35" stopColor="#174F78" />
            <stop offset="0.62" stopColor="#3A79A3" />
            <stop offset="0.72" stopColor="#B9A6B6" />
            <stop offset="0.8" stopColor="#F0A867" />
            <stop offset="0.9" stopColor="#F7CF8C" />
          </linearGradient>
          {/* La luz del logo: un halo cálido que cae sobre el valle desde el centro */}
          <radialGradient id="vs-sun" gradientUnits="userSpaceOnUse" cx="720" cy="118" r="150">
            <stop offset="0" stopColor="#FFC27A" stopOpacity="0.78" />
            <stop offset="0.45" stopColor="#FF9A4A" stopOpacity="0.3" />
            <stop offset="1" stopColor="#FF8A2B" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vs-horizon" gradientUnits="userSpaceOnUse" cx="720" cy="540" r="300">
            <stop offset="0" stopColor="#FFD08A" stopOpacity="0.75" />
            <stop offset="0.5" stopColor="#F7A25E" stopOpacity="0.28" />
            <stop offset="1" stopColor="#F08A4E" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="vs-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F2C79A" stopOpacity="0" />
            <stop offset="1" stopColor="#F2C79A" stopOpacity="0.38" />
          </linearGradient>
          <linearGradient id="vs-haze-cool" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9EC2D6" stopOpacity="0" />
            <stop offset="1" stopColor="#9EC2D6" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="vs-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8FA8C8" />
            <stop offset="1" stopColor="#5B7FA3" />
          </linearGradient>
          <linearGradient id="vs-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5A8A92" />
            <stop offset="1" stopColor="#2F5D5B" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill="url(#vs-sky)" />
        <g>
          {scene.stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#FFFFFF" opacity={s.o} className={s.tw && !reduce ? 'vs-twinkle' : undefined} style={s.tw ? { animationDelay: `${(i % 7) * 0.6}s` } : undefined} />
          ))}
        </g>
        <rect width={W} height={H} fill="url(#vs-horizon)" />
        <rect width={W} height={H} fill="url(#vs-sun)" />

        <Layer shift={shift} depth={6}>
          <g fill="#F6E3CF" opacity="0.4">
            {/* Fuera de la columna del texto: las nubes quedan a los costados, entre las cumbres */}
            <path d="M1220 352c18-22 58-26 76-6 14-18 52-16 62 6 30-6 54 10 52 30h-200c-14-10-8-28 10-30z" />
            <path d="M70 368c14-18 46-20 60-4 12-14 40-12 48 4 24-4 42 8 40 24H60c-10-8-6-22 10-24z" />
            <path d="M1290 300c10-12 32-14 42-3 8-10 28-9 34 3 16-3 30 6 28 17h-112c-8-6-4-15 8-17z" opacity="0.7" />
          </g>
        </Layer>

        <Layer shift={shift} depth={10}>
          <path fill="url(#vs-far)" d={FAR_RIDGE} />
          <path fill="#45678A" opacity="0.5" d={FAR_PEAKS.map((p) => shade(p, 520)).join(' ')} />
          <path fill="#F4B27C" opacity="0.32" d={FAR_PEAKS.map((p) => lit(p, 520)).join(' ')} />
          <path fill="#EEF4FA" opacity="0.9" d={FAR_PEAKS.map((p) => snowcap(p)).join(' ')} />
          <path fill="none" stroke="#FFD9A8" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" d={FAR_PEAKS.map(rim).join(' ')} />
        </Layer>
        {/* Bruma cálida entre la cordillera lejana y la media */}
        <rect y="380" width={W} height="140" fill="url(#vs-haze)" />

        <Layer shift={shift} depth={18}>
          <path fill="url(#vs-mid)" d={MID_RIDGE} />
          <path fill="#244A4C" opacity="0.55" d={MID_PEAKS.map((p) => shade(p, 560)).join(' ')} />
          <path fill="#E9A874" opacity="0.24" d={MID_PEAKS.map((p) => lit(p, 560)).join(' ')} />
          <path fill="#A9CCC6" opacity="0.55" d={MID_PEAKS.map((p) => snowcap(p, 0.16)).join(' ')} />
          <path fill="none" stroke="#FFC98A" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" d={MID_PEAKS.map(rim).join(' ')} />
        </Layer>
        <rect y="440" width={W} height="110" fill="url(#vs-haze-cool)" />

        <Layer shift={shift} depth={22}>
          <path fill="#24553A" d="M-20 508 C200 498 420 512 640 504 C860 496 1080 510 1300 500 C1380 497 1420 502 1460 500 L1460 640 L-20 640 Z" />
        </Layer>
        <Layer shift={shift} depth={26}>
          <path d={scene.farForest} fill="#1F4B3B" />
        </Layer>
        <Layer shift={shift} depth={36}>
          <path d={scene.nearForest} fill="#163A2D" />
        </Layer>
      </svg>

      {/* Colina izquierda con el osito: anclada al borde izquierdo */}
      <Anchored shift={shift} depth={30} viewBox="0 -60 640 260" className="absolute bottom-0 left-0 w-[clamp(300px,46%,640px)]">
        <defs>
          <linearGradient id="vs-hill-l" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#56AA4C" />
            <stop offset="0.55" stopColor="#2D7432" />
            <stop offset="1" stopColor="#1B4A22" />
          </linearGradient>
        </defs>
        <path fill="url(#vs-hill-l)" d="M0 120 C140 66 280 44 420 70 C500 86 560 120 640 200 L0 200 Z" />
        <path d={scene.leftGrass} fill="#68BD5A" />
        <g fill="#121B19" transform="translate(300 42)">
          <circle cx="0" cy="-30" r="22" />
          <circle cx="-17" cy="-48" r="9" />
          <circle cx="17" cy="-48" r="9" />
          <ellipse cx="0" cy="8" rx="30" ry="32" />
          <ellipse cx="-24" cy="30" rx="13" ry="9" />
          <ellipse cx="24" cy="30" rx="13" ry="9" />
        </g>
        <Flowers items={[[70, 112, '#E85C9C'], [150, 82, '#F6C945'], [215, 66, '#9C6BE0'], [380, 66, '#E85C9C'], [470, 92, '#F6C945']]} />
      </Anchored>

      {/* Colina derecha con la torre de bloques y el cohete: anclada al borde derecho */}
      <Anchored shift={shift} depth={30} viewBox="0 -60 600 260" className="absolute bottom-0 right-0 w-[clamp(280px,42%,600px)]">
        <defs>
          <linearGradient id="vs-hill-r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4A9E45" />
            <stop offset="1" stopColor="#1A4520" />
          </linearGradient>
        </defs>
        <path fill="url(#vs-hill-r)" d="M0 200 C100 128 220 96 360 102 C450 106 530 82 600 66 L600 200 Z" />
        <path d={scene.rightGrass} fill="#57AE4F" />
        <g transform="translate(300 100)">
          <rect x="-34" y="-30" width="30" height="30" rx="4" fill="#C2483B" />
          <rect x="0" y="-30" width="30" height="30" rx="4" fill="#E2A43B" />
          <rect x="-18" y="-60" width="30" height="30" rx="4" fill="#3E8FC4" />
          <rect x="-12" y="-80" width="18" height="20" rx="3" fill="#7A63C9" />
        </g>
        <g transform="translate(440 94) rotate(14)" fill="#121B19">
          <path d="M0 -70 C14 -54 16 -26 12 0 H-12 C-16 -26 -14 -54 0 -70 Z" />
          <path d="M-12 -14 L-24 4 L-12 0 Z M12 -14 L24 4 L12 0 Z" />
          <circle cx="0" cy="-36" r="5" fill="#F7CF8C" opacity="0.85" />
        </g>
        <Flowers items={[[90, 166, '#9C6BE0'], [170, 128, '#E85C9C'], [240, 110, '#F6C945'], [380, 108, '#E85C9C'], [530, 82, '#9C6BE0']]} />
      </Anchored>

      {/* Pasto del frente: se funde con el fondo de la página, sin corte recto */}
      {/* Llena siempre el borde inferior: recorta a los costados en vez de achicarse y dejar aire abajo */}
      <Anchored shift={shift} depth={44} viewBox={`0 0 ${W} 90`} fit="xMidYMax slice" className="absolute -bottom-px -left-[4%] h-[90px] w-[108%]">
        <path d={scene.front} fill={GROUND} />
        <path fill={GROUND} d={`M-20 90 L-20 66 C120 58 240 74 380 62 C520 52 660 72 800 64 C940 56 1080 74 1220 62 C1320 54 1400 66 ${W + 20} 60 L${W + 20} 90 Z`} />
      </Anchored>

      {/* Canopia de enredaderas: borde superior con hojas densas, más dos racimos colgando en las esquinas */}
      <svg viewBox={`0 0 ${W} 60`} preserveAspectRatio="xMidYMin slice" className="absolute -top-px left-0 h-[60px] w-full" focusable="false">
        <path
          fill={GROUND}
          d="M0 0 H1440 V22 C1380 30 1350 18 1300 34 C1250 50 1210 26 1150 30 C1090 34 1060 52 1000 40 C940 28 900 36 860 30 C800 22 760 44 700 38 C640 32 620 18 560 26 C500 34 470 52 420 40 C370 28 330 34 280 30 C220 26 190 46 130 40 C80 34 40 22 0 30 Z"
        />
        {scene.canopyLeaves.map(([x, y, a], i) => (
          <ellipse key={i} cx={x} cy={y} rx="6" ry="12" fill={GROUND} transform={`rotate(${a} ${x} ${y})`} />
        ))}
      </svg>
      <svg viewBox="0 0 240 240" className="absolute -top-px left-0 w-[clamp(140px,18%,240px)]" focusable="false">
        <Vine d="M40 20 C52 60 30 96 48 132 C58 152 50 176 60 204" leaves={[[46, 64, 30], [40, 104, -30], [50, 136, 25], [58, 178, -35], [62, 206, 20]]} />
        <Vine d="M86 18 C110 50 140 58 156 92" leaves={[[112, 48, 50], [140, 66, -40], [156, 94, 30]]} />
        <Vine d="M178 14 C186 40 176 58 186 82" leaves={[[182, 40, -20], [186, 82, 25]]} />
      </svg>
      <svg viewBox="0 0 240 240" className="absolute -top-px right-0 w-[clamp(140px,18%,240px)]" focusable="false">
        <Vine d="M200 18 C190 56 212 90 196 130 C188 152 198 172 190 200" leaves={[[196, 58, -30], [204, 96, 30], [194, 132, -25], [192, 172, 35], [190, 202, -20]]} />
        <Vine d="M150 16 C126 44 100 52 86 84" leaves={[[128, 44, -50], [102, 60, 40], [86, 86, -30]]} />
        <Vine d="M60 14 C54 38 64 56 56 78" leaves={[[58, 38, 20], [56, 78, -25]]} />
      </svg>
    </div>
  )
}

/** Brasas que suben desde el logo, como si el azulejo de fuego calentara el valle. */
export function Embers({ className, origin = 0.62, spread = 90, count = 90 }: { className?: string; origin?: number; spread?: number; count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || reduce) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const dpr = Math.min(2, devicePixelRatio || 1)
    const size = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }
    const ps: P[] = []
    const tick = () => {
      const w = canvas.width
      const h = canvas.height
      for (let k = 0; k < 2 && ps.length < count; k++) {
        // Nacen alrededor del borde del azulejo y suben con un leve vaivén.
        const side = Math.random()
        const x = w / 2 + (Math.random() - 0.5) * spread * dpr
        const y = h * origin + (side < 0.7 ? -Math.random() * 30 : Math.random() * 20) * dpr
        ps.push({ x, y, vx: (Math.random() - 0.5) * 0.5 * dpr, vy: -(0.5 + Math.random() * 1.1) * dpr, life: 0, max: 110 + Math.random() * 140, r: (1.3 + Math.random() * 2.4) * dpr })
      }
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        p.life++
        p.x += p.vx + Math.sin((p.life + i) / 16) * 0.35 * dpr
        p.y += p.vy
        const t = p.life / p.max
        if (t >= 1) {
          ps.splice(i, 1)
          continue
        }
        const a = Math.sin(t * Math.PI)
        const g = Math.round(205 - t * 120)
        ctx.shadowColor = `rgba(255, ${g}, 60, ${a * 0.9})`
        ctx.shadowBlur = 8 * dpr
        ctx.fillStyle = `rgba(255, ${g}, ${Math.round(90 - t * 70)}, ${a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (1 - t * 0.45), 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reduce, origin, spread, count])
  return <canvas ref={ref} className={className} aria-hidden />
}

/** Cada categoría tiene su hora del día y un elemento propio: la grilla se lee como un mapa del valle. */
const CARD_WORLDS: Record<BoardColor, { sky: [string, string]; back: string; front: string; grass: string; prop: 'sol' | 'luna' | 'pinos' | 'arbol' | 'molino' | 'nube' }> = {
  sol: { sky: ['#3A2E5C', '#E79B5B'], back: '#3B5A3A', front: '#4E8A3F', grass: '#6FB04F', prop: 'sol' },
  coral: { sky: ['#2A2246', '#B8607A'], back: '#3A4B3C', front: '#4C7A3E', grass: '#66A14E', prop: 'luna' },
  turquesa: { sky: ['#0F2A36', '#2F6C78'], back: '#1C4A3C', front: '#24603F', grass: '#3E8C55', prop: 'pinos' },
  lila: { sky: ['#1E1B3E', '#5B4C93'], back: '#283F38', front: '#335E3E', grass: '#4F8E57', prop: 'arbol' },
  hoja: { sky: ['#174055', '#7FB4C9'], back: '#2E5E36', front: '#3F8A3C', grass: '#68B552', prop: 'molino' },
  cielo: { sky: ['#13283A', '#4C7FA8'], back: '#1D4232', front: '#275C36', grass: '#3F8A4A', prop: 'nube' },
}

/**
 * Ventana de cada tarjeta: un pedazo del valle con la luz y el paisaje de su categoría,
 * donde se apoya el juguete. La forma de las colinas cambia con el índice.
 */
export function CardScene({ seed, color, className, bare }: { seed: number; color: BoardColor; className?: string; /** Sin el elemento del paisaje, para escenas que ponen el suyo. */ bare?: boolean }) {
  const base = CARD_WORLDS[color]
  const world = bare ? { ...base, prop: null } : base
  const sc = useMemo(() => {
    const r = rng(seed * 97 + 13)
    const stars = Array.from({ length: 12 }, () => ({ x: r() * 320, y: r() * 70, s: 0.5 + r() * 1, o: 0.2 + r() * 0.5 }))
    const a = 128 + r() * 24
    const b = 136 + r() * 22
    const peak = 60 + r() * 200
    // Los adornos van a los costados: el centro es del juguete.
    const propX = r() < 0.5 ? 18 + r() * 18 : 282 + r() * 16
    return {
      stars,
      propX,
      backY: a - 20,
      back: `M0 ${a} C${peak - 90} ${a - 26} ${peak - 30} ${a - 34} ${peak} ${a - 30} C${peak + 60} ${a - 26} ${peak + 120} ${a - 8} 320 ${a - 14} L320 200 L0 200 Z`,
      front: `M0 ${b + 10} C80 ${b - 6} 160 ${b - 12} 240 ${b - 2} C280 ${b + 3} 300 ${b} 320 ${b - 4} L320 200 L0 200 Z`,
      grass: grass(seed + 3, [[0, b + 10], [80, b - 4], [160, b - 10], [240, b - 2], [320, b - 4]], 7, 9),
    }
  }, [seed])
  const id = `cs-${color}-${seed}`
  const { propX: x, backY: y } = sc
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={world.sky[0]} />
          <stop offset="1" stopColor={world.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id})`} />
      {sc.stars.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.s} fill="#FFFFFF" opacity={st.o} />
      ))}
      {world.prop === 'sol' && <circle cx={x} cy={y - 6} r="22" fill="#FFD27A" opacity="0.9" />}
      {world.prop === 'luna' && <path d={`M${x + 8} ${y - 46} a18 18 0 1 0 14 30 a14 14 0 1 1 -14 -30 z`} fill="#F6E7C8" opacity="0.9" />}
      <path d={sc.back} fill={world.back} />
      {world.prop === 'pinos' && <path d={pine(x - 10, y + 4, 46) + ' ' + pine(x + 14, y + 8, 36)} fill="#143A2E" />}
      {world.prop === 'arbol' && (
        <g fill="#1F3A30">
          <rect x={x - 3} y={y - 18} width="6" height="22" rx="2" />
          <circle cx={x} cy={y - 28} r="16" />
          <circle cx={x - 12} cy={y - 20} r="10" />
          <circle cx={x + 12} cy={y - 20} r="10" />
        </g>
      )}
      {world.prop === 'molino' && (
        <g fill="#2A4A3A" transform={`translate(${x} ${y})`}>
          <path d="M-8 6 L-4 -34 H4 L8 6 Z" />
          <g transform="translate(0 -34)">
            {[0, 90, 180, 270].map((a) => (
              <rect key={a} x="-2" y="-22" width="4" height="22" rx="1" transform={`rotate(${a + 20})`} />
            ))}
          </g>
        </g>
      )}
      {world.prop === 'nube' && <path d={`M${x - 26} ${y - 30}c4-10 18-12 24-4 6-8 20-6 22 4 12-2 20 5 18 12h-70c-6-4-2-11 6-12z`} fill="#DCE9F3" opacity="0.6" />}
      <path d={sc.front} fill={world.front} />
      <path d={sc.grass} fill={world.grass} />
    </svg>
  )
}
