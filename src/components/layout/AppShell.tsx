import { AnimatePresence, motion } from 'framer-motion'
import { LuBadgePercent, LuCalendarHeart, LuChartColumn, LuBoxes, LuExternalLink, LuHistory, LuKeyRound as KeyRound, LuLogOut as LogOut, LuMenu as Menu, LuMoon as Moon, LuReceiptText, LuShapes, LuSun as Sun, LuTruck, LuUsers, LuZap } from 'react-icons/lu'
import { SiDragonframe } from 'react-icons/si'
import type { IconType } from 'react-icons'
import { Fragment, useState } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import clsx from 'clsx'
import { Button, Kbd } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Field } from '@/components/ui/Field'
import { toast, Toaster } from '@/components/ui/Toaster'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { can, ROLE_LABEL, type Permission } from '@/lib/permissions'
import { changeOwnPassword, validatePassword } from '@/services/auth'
import { useAuth } from '@/stores/auth'
import { useHotkeys } from '@/hooks/useHotkeys'
import { FlipNumber } from '@/features/quick-add/components/LoteTrack'
import { useLoteSpaces } from '@/features/quick-add/useLoteSpaces'
import { BOARD } from '@/lib/colors'
import { STORE } from '@/lib/config'
import { useTheme } from '@/stores/theme'
import type { BoardColor } from '@/types'
import { AlertsBell } from '@/features/alerts/AlertsCenter'
import { AssistantWidget } from '@/features/assistant/AssistantWidget'
import { AnimatedBackdrop } from './AnimatedBackdrop'

type NavItem = { to: string; label: string; icon: IconType; perm: Permission; color: BoardColor; group: string; admin?: boolean }

/** El menú es un tablero: cada sección es una casilla de su color, unidas por un camino. */
const NAV: NavItem[] = [
  { to: '/', label: 'Inventario', icon: LuBoxes, perm: 'inventario.ver', color: 'turquesa', group: 'Tienda' },
  { to: '/carga', label: 'Carga Rápida', icon: LuZap, perm: 'productos.crear', color: 'sol', group: 'Tienda' },
  { to: '/temporadas', label: 'Temporadas', icon: LuCalendarHeart, perm: 'temporadas.ver', color: 'coral', group: 'Tienda' },
  { to: '/reportes', label: 'Reportes', icon: LuChartColumn, perm: 'reportes.ver', color: 'cielo', group: 'Negocio' },
  { to: '/facturacion', label: 'Facturación', icon: LuReceiptText, perm: 'facturacion.ver', color: 'hoja', group: 'Negocio' },
  { to: '/descuentos', label: 'Descuentos', icon: LuBadgePercent, perm: 'descuentos.gestionar', color: 'coral', group: 'Negocio' },
  { to: '/categorias', label: 'Categorías', icon: LuShapes, perm: 'categorias.ver', color: 'lila', group: 'Catálogo' },
  { to: '/proveedores', label: 'Proveedores', icon: LuTruck, perm: 'proveedores.ver', color: 'cielo', group: 'Catálogo' },
  { to: '/usuarios', label: 'Usuarios', icon: LuUsers, perm: 'usuarios.gestionar', color: 'lila', group: 'Administración', admin: true },
  { to: '/actividad', label: 'Actividad', icon: LuHistory, perm: 'actividad.ver', color: 'turquesa', group: 'Administración', admin: true },
]

function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-xl font-black tracking-tight">
      <span className="grid size-9 place-items-center rounded-xl bg-sol text-on-fill shadow-[0_3px_0_rgb(0_0_0/0.18)]" aria-hidden>
        <SiDragonframe className="size-6" />
      </span>
      {STORE.name}
    </span>
  )
}

/** Mini pista del lote en la barra lateral: siempre a la vista, desde cualquier sección. */
function LoteMini() {
  const { done, goal, spaces, filled, colors, reached } = useLoteSpaces()
  // 10 casillas; cada una representa una décima parte del tablero completo.
  const per = spaces / 10
  const token = Math.min(9, Math.floor(filled / per))
  return (
    <NavLink to="/carga" className="group mx-1 flex flex-col gap-2.5 rounded-2xl bg-rail-hover/70 p-3.5 transition-colors hover:bg-rail-hover">
      <span className="flex items-baseline justify-between text-xs font-extrabold text-rail-ink">
        Lote en curso
        <span className="text-sm font-black text-white">
          <FlipNumber value={done} />
          <span className="num">/{goal}</span>
        </span>
      </span>
      <span className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => {
          const end = Math.round((i + 1) * per)
          const color = filled >= end ? colors[end - 1] : undefined
          return (
            <span key={i} className={clsx('relative grid h-3.5 flex-1 place-items-center rounded-[4px]', color ? BOARD[color].fill : i === 9 ? 'bg-sol/40' : 'bg-rail')}>
              {i === token && !reached && (
                <motion.span
                  layoutId="rail-token"
                  className="size-2.5 rounded-full bg-white shadow-[0_2px_0_rgb(0_0_0/0.3)]"
                  transition={{ type: 'spring', stiffness: 460, damping: 20 }}
                />
              )}
            </span>
          )
        })}
      </span>
    </NavLink>
  )
}

export function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const user = useAuth((s) => s.user)
  const [account, setAccount] = useState(false)
  const items = NAV.filter((n) => can(user?.role, n.perm))
  // En el celular caben 4 secciones; el resto va en «Más».
  const mobileMain = items.filter((n) => !n.admin).slice(0, 4)

  // Atajo global para ir a cargar. En Carga Rápida, el formulario usa los mismos atajos para limpiar.
  const goCarga = () => location.pathname !== '/carga' && navigate('/carga')
  useHotkeys({ 'alt+n': goCarga, 'mod+n': goCarga }, location.pathname !== '/carga')

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 z-20 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-y-auto bg-rail px-3 py-6 text-rail-ink lg:flex">
        <div className="mb-6 flex items-center justify-between pl-3 text-white">
          <Logo />
          <AlertsBell variant="rail" />
        </div>
        <nav aria-label="Principal" className="relative flex flex-col">
          {items.map((item, i) => (
            <Fragment key={item.to}>
              {item.group !== items[i - 1]?.group && <p className="mb-1.5 ml-3 mt-4 text-xs font-black text-rail-ink/70 first:mt-0">{item.group}</p>}
              <BoardLink item={item} pathConnect={item.group === items[i + 1]?.group} />
            </Fragment>
          ))}
          <a
            href="/tienda"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-rail-ink transition-colors hover:bg-rail-hover hover:text-white"
          >
            <LuExternalLink className="size-4" aria-hidden /> Ver tienda online
          </a>
        </nav>
        <div className="mt-auto flex flex-col gap-3 pt-6">
          {can(user?.role, 'productos.crear') && <LoteMini />}
          <button
            onClick={() => setAccount(true)}
            className="mx-1 flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-rail-hover"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sol text-sm font-black text-on-fill" aria-hidden>
              {user?.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-white">{user?.name}</span>
              <span className="block text-xs font-bold">{user && ROLE_LABEL[user.role]}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-rail px-4 text-white lg:hidden">
          <Logo />
          <span className="flex items-center gap-1">
          <AlertsBell variant="header" />
          <button
            onClick={() => setAccount(true)}
            className="grid size-10 place-items-center rounded-full bg-sol text-sm font-black text-on-fill"
            aria-label="Cuenta y más opciones"
          >
            {user?.name.slice(0, 1).toUpperCase()}
          </button>
          </span>
        </header>

        <AnimatedBackdrop />
        <main className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>

        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {mobileMain.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx('flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-extrabold', isActive ? 'text-ink' : 'text-ink-soft')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={clsx('grid h-8 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-sol text-on-fill')}>
                    <Icon className="size-5" strokeWidth={2.4} aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-1">{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setAccount(true)}
            className="flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-extrabold text-ink-soft"
          >
            <span className="grid h-8 w-12 place-items-center rounded-full">
              <Menu className="size-5" strokeWidth={2.4} aria-hidden />
            </span>
            Más
          </button>
        </nav>
      </div>
      <AccountDrawer
        open={account}
        onClose={() => setAccount(false)}
        extra={items.filter((n) => !mobileMain.includes(n))}
        theme={theme}
        toggleTheme={toggle}
      />
      <AssistantWidget />
      <Toaster />
    </div>
  )
}

/** Casilla del menú: cuadro de color con el ícono, unida a la siguiente por un camino punteado. La ficha salta a la activa. */
function BoardLink({ item, pathConnect }: { item: NavItem; pathConnect: boolean }) {
  const { to, label, icon: Icon, color } = item
  return (
    <NavLink to={to} end={to === '/'} className="group relative flex items-center gap-3 rounded-2xl py-1.5 pl-2 pr-2 font-extrabold">
      {({ isActive }) => (
        <>
          {pathConnect && <span className="absolute left-[1.55rem] top-[2.6rem] h-[1.2rem] border-l-[3px] border-dotted border-rail-ink/30" aria-hidden />}
          {isActive && <motion.span layoutId="nav-row" className="absolute inset-0 rounded-2xl bg-rail-hover" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span
            className={clsx(
              'relative grid size-9 shrink-0 place-items-center rounded-xl text-on-fill transition-[transform,filter,opacity] duration-200',
              BOARD[color].fill,
              isActive ? 'scale-105' : 'opacity-75 saturate-[.7] group-hover:-translate-y-0.5 group-hover:opacity-100 group-hover:saturate-100',
            )}
          >
            <Icon className="size-[1.15rem]" aria-hidden />
            {isActive && (
              <motion.span
                layoutId="nav-pawn"
                className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-white shadow-[0_2px_0_rgb(0_0_0/0.35)] ring-2 ring-rail"
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                aria-hidden
              />
            )}
          </span>
          <span className={clsx('relative transition-colors', isActive ? 'text-white' : 'group-hover:text-white')}>{label}</span>
          {to === '/carga' && !isActive && <Kbd className="relative ml-auto text-rail-ink">Alt N</Kbd>}
        </>
      )}
    </NavLink>
  )
}

/** Cuenta: datos del usuario, cambiar contraseña, tema y salir. En el celular, también las secciones que no entran abajo. */
function AccountDrawer({
  open,
  onClose,
  extra,
  theme,
  toggleTheme,
}: {
  open: boolean
  onClose: () => void
  extra: NavItem[]
  theme: 'light' | 'dark'
  toggleTheme: () => void
}) {
  const { user, logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = next ? validatePassword(next) : null

  const change = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current || !next || problem) return
    setBusy(true)
    try {
      await changeOwnPassword(current, next)
      toast({ tone: 'ok', text: 'Contraseña cambiada' })
      setCurrent('')
      setNext('')
    } catch (err) {
      toast({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Cuenta">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5 pt-16 sm:p-6 sm:pt-16">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-sol text-lg font-black text-on-fill" aria-hidden>
            {user?.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-black">{user?.name}</p>
            <p className="text-sm font-semibold text-ink-soft">
              @{user?.username} · {user && ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>

        {extra.length > 0 && (
          <nav aria-label="Más secciones" className="flex flex-col gap-1 lg:hidden">
            {extra.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={onClose} className="flex h-12 items-center gap-3 rounded-xl px-3 font-extrabold hover:bg-sunken">
                <Icon className="size-5 text-ink-soft" strokeWidth={2.4} aria-hidden /> {label}
              </NavLink>
            ))}
          </nav>
        )}

        <button onClick={toggleTheme} className="flex h-12 items-center gap-3 rounded-xl bg-sunken px-4 font-extrabold">
          {theme === 'dark' ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
          {theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}
        </button>

        <form onSubmit={change} className="flex flex-col gap-3 rounded-2xl border-2 border-line p-4">
          <p className="flex items-center gap-2 font-black">
            <KeyRound className="size-4" aria-hidden /> Cambiar mi contraseña
          </p>
          <Field label="Contraseña actual" htmlFor="acc-current">
            <PasswordInput id="acc-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="Nueva contraseña" htmlFor="acc-next" error={problem ?? undefined}>
            <PasswordInput id="acc-next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!problem} />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy || !current || !next || !!problem} className="self-start">
            Guardar contraseña
          </Button>
        </form>

        <Button variant="primary" size="lg" className="mt-auto w-full" onClick={() => (onClose(), void logout())}>
          <LogOut className="size-5" aria-hidden /> Salir
        </Button>
      </div>
    </Drawer>
  )
}
