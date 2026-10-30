import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Boxes, History, KeyRound, LogOut, Menu, Moon, Shapes, Sun, Truck, Users, Zap } from 'lucide-react'
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

type NavItem = { to: string; label: string; icon: typeof Boxes; perm: Permission; admin?: boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Inventario', icon: Boxes, perm: 'inventario.ver' },
  { to: '/carga', label: 'Carga Rápida', icon: Zap, perm: 'productos.crear' },
  { to: '/proveedores', label: 'Proveedores', icon: Truck, perm: 'proveedores.ver' },
  { to: '/categorias', label: 'Categorías', icon: Shapes, perm: 'categorias.ver' },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, perm: 'reportes.ver' },
  { to: '/usuarios', label: 'Usuarios', icon: Users, perm: 'usuarios.gestionar', admin: true },
  { to: '/actividad', label: 'Actividad', icon: History, perm: 'actividad.ver', admin: true },
]

function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-xl font-black tracking-tight">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="rgb(var(--sol))" />
        <path d="M16 2a14 14 0 0 1 14 14H16z" fill="rgb(var(--coral))" />
        <circle cx="16" cy="16" r="4.5" fill="rgb(var(--rail))" />
      </svg>
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto bg-rail px-3 py-6 text-rail-ink lg:flex">
        <div className="mb-7 px-3 text-white">
          <Logo />
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon, admin }, i) => (
            <Fragment key={to}>
            {admin && !items[i - 1]?.admin && <p className="mx-3 mb-1 mt-4 text-2xs font-black text-rail-ink/70">Administración</p>}
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'relative flex h-11 items-center gap-3 rounded-xl px-3 font-extrabold transition-colors',
                  isActive ? 'text-on-fill' : 'hover:bg-rail-hover hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-sol" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                  )}
                  <Icon className="relative size-5" strokeWidth={2.4} aria-hidden />
                  <span className="relative">{label}</span>
                  {to === '/carga' && !isActive && <Kbd className="relative ml-auto text-rail-ink">Alt N</Kbd>}
                </>
              )}
            </NavLink>
            </Fragment>
          ))}
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
          <button
            onClick={() => setAccount(true)}
            className="grid size-10 place-items-center rounded-full bg-sol text-sm font-black text-on-fill"
            aria-label="Cuenta y más opciones"
          >
            {user?.name.slice(0, 1).toUpperCase()}
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
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
      <Toaster />
    </div>
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
