import { AnimatePresence, motion } from 'framer-motion'
import { LuArrowLeft as ArrowLeft, LuArrowRight as ArrowRight, LuBell as Bell, LuExternalLink as ExternalLink, LuSparkles as Sparkles, LuX as X } from 'react-icons/lu'
import { SiDragonframe } from 'react-icons/si'
import type { IconType } from 'react-icons'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { NAV } from '@/components/layout/nav'
import { BOARD } from '@/lib/colors'
import { can, ROLE_LABEL } from '@/lib/permissions'
import { useAuth } from '@/stores/auth'
import { markGuideSeen, useGuide } from '@/stores/guide'
import type { BoardColor } from '@/types'

type Step = {
  /** Elemento a iluminar: [data-tour="…"]. Sin target, la tarjeta va centrada. */
  target?: string
  /** Sección a la que se entra en este paso, para verla detrás. */
  to?: string
  title: string
  body: string
  /** Pasos concretos para usarla, en orden. */
  how?: string[]
  icon?: IconType
  color?: BoardColor
}

/** Qué hace cada sección y cómo se usa, en las palabras del local. */
const SECTION_HELP: Record<string, { body: string; how?: string[] }> = {
  '/': {
    body: 'Todos los juguetes del local con su stock, precio y costo. Los que tienen poco stock se marcan para que sepas qué reponer.',
    how: ['Busca por nombre o código.', 'Filtra por categoría o por stock bajo.', 'Toca un juguete para editarlo, cambiar su foto o ver sus movimientos.'],
  },
  '/vender': {
    body: 'La venta en el mostrador, cuando el cliente está en el local. Desde acá también se hacen los cambios y devoluciones, con «Cambio o devolución».',
    how: ['Escanea el código de barras o busca el juguete.', 'Elige cómo paga y el comprobante: A (con CUIT), B (consumidor final) o X.', 'Toca «Cobrar» e imprime el comprobante si el cliente lo pide.'],
  },
  '/pedidos': {
    body: 'Las reservas que los clientes hacen en la tienda online llegan acá al instante. El número rojo del menú te dice cuántas faltan retirar.',
    how: ['Cuando el cliente viene, busca su código (R-0001), su nombre o su DNI.', 'Toca «Retiró y pagó»: se cobra, se emite el comprobante y la reserva pasa a venta.', 'Si no vino o cambió de idea, toca «No vino / cancelar»: el stock vuelve solo.'],
  },
  '/carga': {
    body: 'La forma más rápida de cargar mercadería. Cada producto guardado avanza una casilla del lote.',
    how: ['Escanea con el lector o con la cámara del celular.', 'Si el código ya existe, se suma stock; si es nuevo, completas nombre y precio.', 'También puedes importar desde Excel o pegar una lista. Atajo: Alt + N.'],
  },
  '/temporadas': {
    body: 'Las fechas fuertes del año (Navidad, Reyes, Día de las Infancias). El sistema te avisa con tiempo para que repongas lo que más se vende.',
  },
  '/caja': {
    body: 'El cierre de tu turno: cuentas el efectivo y el sistema te muestra cuánto debería haber, separado por medio de pago.',
    how: ['Cuenta los billetes de la caja.', 'Escribe lo que contaste.', 'Si hay diferencia, se ve antes de cerrar.'],
  },
  '/reportes': {
    body: 'Ventas, ganancias, descuentos y productos más vendidos por período, para decidir qué comprar y qué promocionar.',
  },
  '/facturacion': {
    body: 'Todos los comprobantes emitidos: puedes buscarlos y reimprimirlos. Acá también cargas el nombre, CUIT y domicilio que salen en la factura.',
  },
  '/descuentos': {
    body: 'Promociones por producto o categoría, y cupones que el cliente escribe en la tienda online.',
  },
  '/categorias': {
    body: 'Los tipos de juguete (peluches, juegos de mesa…). Se usan en los filtros, en los reportes y en la tienda.',
  },
  '/proveedores': {
    body: 'Quiénes te venden la mercadería y cómo contactarlos. Al cargar un producto puedes indicar de qué proveedor es.',
  },
  '/usuarios': {
    body: 'Crea las cuentas de los vendedores. Un vendedor puede vender, cargar y entregar pedidos, pero no ve costos ni ganancias.',
  },
  '/actividad': {
    body: 'El registro de quién hizo qué y cuándo: ventas, anulaciones, cambios de precio e ingresos al sistema.',
  },
}

function useSteps(): Step[] {
  const user = useAuth((s) => s.user)
  return useMemo(() => {
    const items = NAV.filter((n) => can(user?.role, n.perm))
    const steps: Step[] = [
      {
        title: `¡Hola${user ? `, ${user.name.split(' ')[0]}` : ''}! Te mostramos DragoToY`,
        body: `Un recorrido corto por cada sección${user ? ` que puedes usar como ${ROLE_LABEL[user.role].toLowerCase()}` : ''}. Te llevamos a cada pantalla para que la veas mientras te contamos para qué sirve.`,
        how: ['Usa «Siguiente» o la flecha → del teclado.', 'Puedes salir cuando quieras con la X o la tecla Esc.', 'La guía queda en el menú, en «Guía de uso».'],
        icon: Sparkles,
        color: 'sol',
      },
      ...items.map<Step>((n) => ({
        target: `nav:${n.to}`,
        to: n.to,
        title: n.label,
        body: SECTION_HELP[n.to]?.body ?? '',
        how: SECTION_HELP[n.to]?.how,
        icon: n.icon,
        color: n.color,
      })),
      {
        target: 'alerts',
        title: 'Avisos',
        body: 'La campana junta lo que necesita tu atención: stock bajo, temporadas que se acercan y pedidos vencidos. Un número indica cuántos avisos nuevos hay.',
        icon: Bell,
        color: 'coral',
      },
      {
        target: 'store-link',
        title: 'La tienda online',
        body: 'Abre en otra pestaña la tienda que ven tus clientes. Ahí eligen juguetes, reservan sin pagar y retiran en el local con su código.',
        icon: ExternalLink,
        color: 'cielo',
      },
      {
        target: 'account',
        title: 'Tu cuenta',
        body: 'Desde acá cambias tu contraseña, pasas a modo oscuro y sales del sistema. En el celular también están las secciones que no entran en la barra de abajo.',
        color: 'lila',
      },
      {
        target: 'guide-button',
        title: '¡Listo para empezar!',
        body: 'Si alguna vez te olvidas de algo, vuelve a abrir esta guía desde «Guía de uso».',
        icon: Sparkles,
        color: 'hoja',
      },
    ]
    return steps
  }, [user])
}

/** Primer elemento visible con ese data-tour (el menú lateral o la barra del celular, según la pantalla). */
function findVisible(id: string) {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/**
 * Lo que se ilumina en un paso. En pantallas chicas varias secciones (y la guía misma) no están en la
 * barra de abajo sino en «Más»: entonces se ilumina ese botón.
 */
function findTarget(id?: string) {
  if (!id) return null
  const el = findVisible(id)
  if (el) return el
  if (id.startsWith('nav:') || id === 'guide-button') return findVisible('more')
  return null
}

const CARD_W = 380
const GAP = 16

/**
 * Guía interactiva: ilumina cada parte del panel, entra a cada sección y explica cómo se usa.
 * Se ofrece sola la primera vez que alguien entra y después queda en «Guía de uso».
 */
export function Guide() {
  const { open, stop } = useGuide()
  const user = useAuth((s) => s.user)
  const steps = useSteps()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [inMore, setInMore] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const nextRef = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<string | null>(null)
  const step = steps[Math.min(i, steps.length - 1)]
  const last = i === steps.length - 1

  const close = useCallback(() => {
    if (user) markGuideSeen(user.id)
    stop()
    // Al terminar se vuelve a la pantalla donde estabas.
    if (returnTo.current) navigate(returnTo.current)
    returnTo.current = null
  }, [user, stop, navigate])

  // Al abrir: primer paso y se recuerda dónde estabas.
  useEffect(() => {
    if (open) {
      setI(0)
      returnTo.current = location.pathname
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Cada paso entra a su sección.
  useEffect(() => {
    if (open && step.to && location.pathname !== step.to) navigate(step.to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i])

  // Sigue al elemento iluminado aunque la pantalla cambie de tamaño o se desplace.
  useLayoutEffect(() => {
    if (!open) return
    let frame = 0
    const measure = () => {
      const el = findTarget(step.target)
      setInMore(el?.dataset.tour === 'more')
      setRect((prev) => {
        const r = el?.getBoundingClientRect() ?? null
        if (!r && !prev) return prev
        if (r && prev && r.top === prev.top && r.left === prev.left && r.width === prev.width && r.height === prev.height) return prev
        return r
      })
      frame = requestAnimationFrame(measure)
    }
    findTarget(step.target)?.scrollIntoView({ block: 'nearest' })
    measure()
    return () => cancelAnimationFrame(frame)
  }, [open, step.target])

  useEffect(() => {
    if (open) nextRef.current?.focus()
  }, [open, i])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, steps.length - 1))
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, close, steps.length])

  // Dónde va la tarjeta: al costado del menú en la compu, encima de la barra en el celular, o centrada.
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    if (!open) return
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [open])

  const pos = useMemo((): { left: number; width: number; top?: number; bottom?: number; maxHeight: number } => {
    const { w: vw, h: vh } = vp
    const edge = vw < 480 ? 12 : 16
    const w = Math.min(CARD_W, vw - edge * 2)
    const centered = () => ({ left: (vw - w) / 2, top: Math.max(edge, Math.min(vh * 0.12, vh - 480)), width: w, maxHeight: vh - Math.max(edge, Math.min(vh * 0.12, vh - 480)) - edge })
    if (!rect) return centered()
    // Al costado (menú lateral en la compu)
    if (rect.right + GAP + w <= vw - edge) {
      const top = Math.max(edge, Math.min(rect.top - 24, vh - 480))
      return { left: rect.right + GAP, top, width: w, maxHeight: vh - top - edge }
    }
    // Arriba o abajo del elemento, donde haya más lugar
    const left = Math.min(Math.max(edge, rect.left + rect.width / 2 - w / 2), vw - w - edge)
    const above = rect.top - GAP - edge
    const below = vh - rect.bottom - GAP - edge
    // Pantalla muy baja (celular acostado): la tarjeta va centrada aunque tape un poco.
    if (Math.max(above, below) < 260) return centered()
    if (above >= below) return { left, bottom: vh - rect.top + GAP, width: w, maxHeight: above }
    return { left, top: rect.bottom + GAP, width: w, maxHeight: below }
  }, [rect, vp])

  if (!open) return null
  const Icon = step.icon ?? SiDragonframe
  const color = BOARD[step.color ?? 'sol']

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-body">
      {/* Fondo oscuro con un hueco sobre lo que se explica */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: '0 0 0 4px rgb(var(--sol)), 0 0 0 9999px rgb(10 20 24 / 0.62)' }}
          aria-hidden
        />
      ) : (
        <div className="fixed inset-0 bg-[rgb(10_20_24/0.62)]" aria-hidden />
      )}
      {/* Bloquea los clics sobre el panel mientras dura la guía */}
      <div className="fixed inset-0" onClick={() => nextRef.current?.focus()} aria-hidden />

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="fixed flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-line bg-surface p-4 text-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/0.5)] sm:gap-4 sm:p-5"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
        >
          <div className="flex shrink-0 items-start gap-3">
            <span className={clsx('grid size-10 shrink-0 sm:size-11 place-items-center rounded-xl text-on-fill', color.fill)} aria-hidden>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-ink-soft">
                Paso {i + 1} de {steps.length}
              </p>
              <h2 id="guide-title" className="text-lg font-black leading-tight">
                {step.title}
              </h2>
            </div>
            <button onClick={close} className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-sunken hover:text-ink" aria-label="Salir de la guía">
              <X className="size-5" />
            </button>
          </div>

          <div id="guide-body" className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-1">
            <p className="text-[0.9375rem] font-semibold leading-relaxed text-ink-soft">{step.body}</p>
            {step.how && (
              <ol className="flex flex-col gap-2">
                {step.how.map((h, n) => (
                  <li key={h} className="flex gap-2.5 text-sm font-bold leading-snug">
                    <span className={clsx('num grid size-6 shrink-0 place-items-center rounded-full text-xs font-black', color.wash, color.ink)}>{n + 1}</span>
                    <span className="pt-0.5">{h}</span>
                  </li>
                ))}
              </ol>
            )}
            {inMore && <p className="rounded-xl bg-sunken px-3 py-2 text-xs font-bold text-ink-soft">En esta pantalla la encuentras tocando «Más», abajo a la derecha.</p>}
          </div>

          {/* Progreso: una casilla por paso, como el tablero del menú */}
          <div className="flex shrink-0 gap-1 [@media(max-height:480px)]:hidden" aria-hidden>
            {steps.map((s, n) => (
              <span key={n} className={clsx('h-1.5 flex-1 rounded-full', n <= i ? BOARD[s.color ?? 'sol'].fill : 'bg-line')} />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {i > 0 ? (
              <Button variant="ghost" onClick={() => setI(i - 1)}>
                <ArrowLeft className="size-4" aria-hidden /> Anterior
              </Button>
            ) : (
              <Button variant="ghost" onClick={close}>
                Ahora no
              </Button>
            )}
            <Button ref={nextRef} variant="accent" className="ml-auto" onClick={() => (last ? close() : setI(i + 1))}>
              {last ? 'Terminar' : 'Siguiente'} {!last && <ArrowRight className="size-4" aria-hidden />}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
