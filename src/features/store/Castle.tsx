import { useId, useMemo } from 'react'
import clsx from 'clsx'

/**
 * Las ruinas del castillo del dragón: la misma noche del valle, más abajo.
 * Piedra vieja y oscura, almenas rotas, musgo, alguna ventana todavía encendida por brasas,
 * y las fauces del dragón alrededor de cada ventana de juguete. Todo SVG.
 */

const INK = '#0A100E'
const STONE_DARK = '#232C29'
const STONE = '#2F3A36'
const STONE_LIGHT = '#43504A'
const RIM = '#D99A5B'
const MOSS = '#2A4A35'
const MOSS_LIGHT = '#3B6448'
const EMBER = '#FFB45A'
const BONE = '#E6DAC0'
const BONE_SHADE = '#B9A985'
const GUM = '#4A1F1C'

/** Generador determinista: el mismo dibujo en cada visita, distinto por semilla. */
function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Borde gastado: desplaza apenas el contorno para que la piedra no sea de regla. */
function WornDefs({ id, scale = 2.2 }: { id: string; scale?: number }) {
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" />
      <feDisplacementMap in="SourceGraphic" scale={scale} />
    </filter>
  )
}

// ── Fauces del dragón: los dientes alrededor de cada ventana ─────────────────────
/** Fila de colmillos (arriba cuelgan, abajo suben). Dos colmillos largos marcan las esquinas. */
function fangRow(seed: number, count: number, depth: number, up: boolean) {
  const r = rng(seed)
  const w = 400 / count
  const teeth: { d: string; shade: string }[] = []
  for (let i = 0; i < count; i++) {
    const x = i * w + (r() - 0.5) * w * 0.12
    const canine = i === 1 || i === count - 2
    const h = depth * (canine ? 1 : 0.42 + r() * 0.3)
    const tipX = x + w * (0.5 + (r() - 0.5) * 0.2)
    const y0 = up ? 60 : 0
    const tipY = up ? 60 - h : h
    const d = `M${x} ${y0} C${x + w * 0.12} ${up ? y0 - h * 0.6 : h * 0.6} ${tipX - w * 0.1} ${tipY} ${tipX} ${tipY} C${tipX + w * 0.12} ${up ? y0 - h * 0.7 : h * 0.7} ${x + w * 0.88} ${up ? y0 - h * 0.35 : h * 0.35} ${x + w} ${y0} Z`
    const shade = `M${tipX} ${tipY} C${tipX + w * 0.12} ${up ? y0 - h * 0.7 : h * 0.7} ${x + w * 0.88} ${up ? y0 - h * 0.35 : h * 0.35} ${x + w} ${y0} L${tipX + w * 0.1} ${y0} Z`
    teeth.push({ d, shade })
  }
  return teeth
}

/**
 * Las fauces del dragón sobre una ventana: colmillos de hueso que cuelgan de una encía oscura
 * arriba y suben desde abajo. Se apoyan en el borde de la ventana y dejan ver la foto en el medio.
 */
export function DragonJaw({ seed = 1, className }: { seed?: number; className?: string }) {
  const top = useMemo(() => fangRow(seed * 31 + 3, 9, 46, false), [seed])
  const bottom = useMemo(() => fangRow(seed * 17 + 9, 11, 28, true), [seed])
  const svg = (teeth: typeof top, up: boolean) => (
    <svg
      viewBox="0 0 400 60"
      preserveAspectRatio="none"
      className={clsx('pointer-events-none absolute inset-x-0 w-full', up ? 'bottom-0 h-[16%]' : 'top-0 h-[22%]')}
      aria-hidden
      focusable="false"
    >
      <path d={up ? 'M0 60 H400 V54 C300 57 100 57 0 54 Z' : 'M0 0 H400 V7 C300 4 100 4 0 7 Z'} fill={GUM} />
      {teeth.map((t, i) => (
        <g key={i}>
          <path d={t.d} fill={BONE} stroke={INK} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <path d={t.shade} fill={BONE_SHADE} opacity={0.6} />
        </g>
      ))}
    </svg>
  )
  return (
    <div className={clsx('jaw pointer-events-none absolute inset-0', className)} aria-hidden>
      {svg(top, false)}
      {svg(bottom, true)}
    </div>
  )
}

// ── Separador: almenas rotas ─────────────────────────────────────────────────────
/** Coronamiento de muralla vieja: almenas gastadas, algunas caídas, con musgo. `seed` cambia qué faltan. */
export function Battlement({ seed = 1, className }: { seed?: number; className?: string }) {
  const filter = useId().replace(/:/g, '')
  const art = useMemo(() => {
    const r = rng(seed * 89 + 5)
    let d = 'M0 40 V24'
    const moss: { x: number; w: number }[] = []
    for (let x = 0; x < 1400; ) {
      const gap = 18 + r() * 8
      const merlon = 26 + r() * 10
      const roll = r()
      // almena entera, gastada o caída
      const h = roll < 0.18 ? 0 : roll < 0.4 ? 5 + r() * 5 : 12 + r() * 3
      d += ` H${x + gap}`
      if (h > 0) d += ` V${24 - h} L${x + gap + merlon * 0.3} ${24 - h - (r() < 0.4 ? 2 : 0)} H${x + gap + merlon} V24`
      else d += ` H${x + gap + merlon}`
      if (r() < 0.22) moss.push({ x: x + gap + r() * merlon, w: 10 + r() * 18 })
      x += gap + merlon
    }
    d += ' H1400 V40 Z'
    return { d, moss }
  }, [seed])
  return (
    <svg viewBox="0 0 1400 40" preserveAspectRatio="xMidYMax slice" className={clsx('block h-7 w-full sm:h-9', className)} aria-hidden focusable="false">
      <defs>
        <WornDefs id={filter} scale={1.8} />
      </defs>
      <g filter={`url(#${filter})`}>
        <path d={art.d} fill={STONE_DARK} stroke={MOSS} strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M0 31 H1400" stroke={MOSS} strokeWidth={1} opacity={0.6} />
        {art.moss.map((m, i) => (
          <ellipse key={i} cx={m.x} cy={24} rx={m.w / 2} ry={3.2} fill={MOSS_LIGHT} opacity={0.85} />
        ))}
      </g>
    </svg>
  )
}

// ── Estandarte rasgado (pestañas de categoría) ───────────────────────────────────
/** Estandarte de tela vieja con el borde de abajo rasgado, colgado de una vara. */
export function TatteredBanner({ active, seed = 1, className }: { active: boolean; seed?: number; className?: string }) {
  const torn = useMemo(() => {
    const r = rng(seed * 13 + 1)
    let d = 'M4 8 H96 V78'
    const steps = 7
    for (let i = steps; i >= 0; i--) {
      const x = 4 + (92 / steps) * i
      d += ` L${x} ${80 + r() * 16}`
    }
    return d + ' Z'
  }, [seed])
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={clsx('pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden focusable="false">
      <path d={torn} fill={active ? '#7E2A20' : '#1E2C29'} stroke={active ? INK : MOSS} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d="M4 15 H96" stroke={active ? '#5C1E17' : MOSS} strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.8} />
      {/* vara */}
      <rect x="0" y="2" width="100" height="6" rx="3" fill="#3A2E22" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ── Las ruinas del castillo: debajo del valle, la misma noche ────────────────────
type Tower = { x: number; w: number; h: number; broken: number; lit?: number[] }

function towerShape(t: Tower, key: string, gradId: string, r: () => number) {
  const top = 330 - t.h
  const left = t.x - t.w / 2
  const right = t.x + t.w / 2
  // corona rota: dientes irregulares de piedra caída
  let crown = `M${left} ${top + 6}`
  const n = 5
  for (let i = 0; i <= n; i++) {
    const x = left + (t.w / n) * i
    const drop = i % 2 ? t.broken * (0.3 + r() * 0.7) : r() * 6
    crown += ` L${x} ${top + drop}`
  }
  crown += ` L${right} ${top + 6} V330 H${left} Z`
  const rows = Math.floor(t.h / 46)
  return (
    <g key={key}>
      <path d={crown} fill={`url(#${gradId})`} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {/* grietas */}
      <path
        d={`M${left + t.w * 0.3} ${top + 20} l6 18 l-5 14 l7 22 M${right - t.w * 0.25} ${top + t.h * 0.45} l-6 14 l4 12`}
        fill="none"
        stroke={INK}
        strokeWidth={1.4}
        opacity={0.7}
      />
      {/* ventanas: casi todas oscuras, alguna encendida por brasas */}
      {Array.from({ length: rows }, (_, i) => {
        const wy = top + 26 + i * 46
        const lit = t.lit?.includes(i)
        return <path key={i} d={`M${t.x - 6} ${wy + 20} v-12 a6 6 0 0 1 12 0 v12 z`} fill={lit ? EMBER : INK} stroke={INK} strokeWidth={1.4} />
      })}
      {/* musgo que cuelga */}
      <path d={`M${left} ${top + 30} q8 10 2 26 q-4 8 3 18`} fill="none" stroke={MOSS_LIGHT} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
    </g>
  )
}

const LEFT: Tower[] = [
  { x: 120, w: 70, h: 170, broken: 26, lit: [1] },
  { x: 210, w: 92, h: 120, broken: 14 },
  { x: 318, w: 74, h: 236, broken: 40, lit: [0, 3] },
  { x: 420, w: 96, h: 140, broken: 22 },
  { x: 506, w: 56, h: 182, broken: 34, lit: [2] },
]
const RIGHT: Tower[] = [
  { x: 936, w: 58, h: 160, broken: 30 },
  { x: 1024, w: 96, h: 206, broken: 18, lit: [1] },
  { x: 1128, w: 70, h: 264, broken: 46, lit: [0, 4] },
  { x: 1222, w: 100, h: 128, broken: 20 },
  { x: 1318, w: 66, h: 186, broken: 36 },
]

/**
 * Debajo del valle sigue la noche: el viejo castillo en ruinas recortado contra el cielo azul,
 * con la luz del atardecer en las caras de piedra que miran al centro, un puente roto
 * y ventanas donde todavía arden brasas. El borde de abajo se funde con el suelo de pino.
 */
export function RuinedCastle() {
  const uid = useId().replace(/:/g, '')
  const sky = `rc-sky-${uid}`
  const glow = `rc-glow-${uid}`
  const worn = `rc-worn-${uid}`
  const litL = `rc-l-${uid}`
  const litR = `rc-r-${uid}`
  const winGlow = `rc-win-${uid}`
  const art = useMemo(() => {
    const r = rng(41)
    const stars = Array.from({ length: 46 }, () => ({ x: r() * 1440, y: r() * 170, s: 0.6 + r() * 1.2, tw: r() < 0.3 }))
    return { stars, left: LEFT.map((t, i) => towerShape(t, 'l' + i, litL, rng(7 + i))), right: RIGHT.map((t, i) => towerShape(t, 'r' + i, litR, rng(19 + i))) }
  }, [litL, litR])
  return (
    <div className="relative -mt-px" aria-hidden>
      <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice" className="block h-[clamp(240px,29vw,420px)] w-full" focusable="false">
        <defs>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0E1513" />
            <stop offset="0.28" stopColor="#10202F" />
            <stop offset="0.62" stopColor="#173048" />
            <stop offset="0.8" stopColor="#2C3550" />
            <stop offset="1" stopColor="#0E1513" />
          </linearGradient>
          <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#E38A4F" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#B05A4A" stopOpacity="0.22" />
            <stop offset="1" stopColor="#B05A4A" stopOpacity="0" />
          </radialGradient>
          {/* luz rasante: las caras que miran al centro se iluminan, las de afuera quedan en sombra */}
          <linearGradient id={litL} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={STONE_DARK} />
            <stop offset="0.65" stopColor={STONE} />
            <stop offset="1" stopColor={STONE_LIGHT} />
          </linearGradient>
          <linearGradient id={litR} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor={STONE_DARK} />
            <stop offset="0.65" stopColor={STONE} />
            <stop offset="1" stopColor={STONE_LIGHT} />
          </linearGradient>
          <filter id={winGlow} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <WornDefs id={worn} scale={2.6} />
        </defs>

        <rect width="1440" height="420" fill={`url(#${sky})`} />
        {art.stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#FFFFFF" opacity={0.55} className={s.tw ? 'vs-twinkle' : undefined} />
        ))}
        {/* luna menguante */}
        <path d="M1206 74 a30 30 0 1 0 22 50 a24 24 0 1 1 -22 -50 z" fill="#F3E6C4" opacity="0.85" />
        {/* el resplandor del atardecer que queda detrás del puente roto */}
        <ellipse cx="720" cy="300" rx="420" ry="150" fill={`url(#${glow})`} />
        {/* sierras lejanas, como las del valle */}
        <path d="M0 300 L120 236 L210 268 L330 206 L450 262 L560 228 L700 280 L820 232 L940 268 L1060 214 L1190 260 L1300 226 L1440 276 V330 H0 Z" fill="#162636" opacity="0.9" />

        <g filter={`url(#${worn})`}>
          {/* peñasco */}
          <path d="M30 420 L40 330 C140 318 260 326 360 320 C440 316 520 326 572 330 L590 420 Z" fill={STONE_DARK} stroke={INK} strokeWidth="2" />
          <path d="M860 420 L872 330 C960 322 1080 328 1180 320 C1280 314 1360 326 1420 332 L1420 420 Z" fill={STONE_DARK} stroke={INK} strokeWidth="2" />
          {/* puente roto: le falta el tramo del medio */}
          <path d="M556 330 H678 L668 342 L688 352 L660 366 H612 C600 350 580 342 556 344 Z" fill={`url(#${litL})`} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M884 330 H770 L782 344 L760 356 L788 368 H830 C842 352 862 344 884 346 Z" fill={`url(#${litR})`} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          {art.left}
          {art.right}
          {/* bordes de piedra iluminados por el atardecer */}
          {[...LEFT.map((t) => [t.x + t.w / 2 - 2, 330 - t.h + 10, t.h - 14] as const), ...RIGHT.map((t) => [t.x - t.w / 2 + 2, 330 - t.h + 10, t.h - 14] as const)].map(([x, y, h], i) => (
            <path key={i} d={`M${x} ${y} V${y + h}`} stroke={RIM} strokeWidth="2" opacity="0.45" />
          ))}
        </g>
        {/* las ventanas encendidas brillan */}
        <g filter={`url(#${winGlow})`} opacity="0.9">
          {[...LEFT, ...RIGHT].flatMap((t, ti) => (t.lit ?? []).map((row) => <circle key={`${ti}-${row}`} cx={t.x} cy={330 - t.h + 26 + row * 46 + 12} r="5" fill={EMBER} />))}
        </g>
        {/* escombros y pasto oscuro: se funden con el suelo de pino de la página */}
        <path
          d="M0 420 V364 C60 352 110 358 160 366 C200 350 250 352 290 364 C340 352 400 356 450 368 C520 356 600 360 660 372 C720 362 790 362 850 372 C910 358 980 356 1040 366 C1100 354 1170 354 1230 364 C1300 350 1370 354 1440 362 V420 Z"
          fill="#0E1513"
        />
      </svg>
    </div>
  )
}

// ── Muralla en ruinas del pie de página ──────────────────────────────────────────
export function RuinWall() {
  const uid = useId().replace(/:/g, '')
  const blocks = useMemo(() => {
    const r = rng(77)
    const rows: { x: number; y: number; w: number; fall: boolean }[] = []
    for (let y = 46; y < 140; y += 22) {
      let x = (y / 22) % 2 ? -20 : 0
      while (x < 1440) {
        const w = 60 + r() * 50
        rows.push({ x, y, w, fall: r() < 0.06 })
        x += w
      }
    }
    return rows
  }, [])
  const crown = useMemo(() => {
    const r = rng(23)
    let d = 'M0 150 V46'
    for (let x = 0; x < 1440; x += 40) {
      const h = r() < 0.25 ? 0 : 6 + r() * 10
      d += ` H${x + 18} V${46 - h} H${x + 40} V46`
    }
    return d + ' H1440 V150 Z'
  }, [])
  return (
    <svg viewBox="0 0 1440 150" preserveAspectRatio="xMidYMax slice" className="block h-[clamp(100px,11vw,150px)] w-full" aria-hidden focusable="false">
      <defs>
        <WornDefs id={`rw-${uid}`} scale={2} />
      </defs>
      <g filter={`url(#rw-${uid})`}>
        <path d={crown} fill={STONE_DARK} stroke={MOSS} strokeWidth="1.6" strokeLinejoin="round" />
        {blocks.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height="22" fill={b.fall ? '#0E1513' : 'none'} stroke={INK} strokeWidth="1" strokeOpacity="0.8" />
        ))}
        {[160, 520, 880, 1240].map((x, i) => (
          <path key={i} d={`M${x} 46 q10 18 2 40 q-6 14 4 30`} fill="none" stroke={MOSS_LIGHT} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
        ))}
      </g>
      <path d="M0 150 V136 C240 128 480 134 720 138 C960 134 1200 128 1440 136 V150 Z" fill="#0E1513" />
    </svg>
  )
}
