import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { LuShieldOff as ShieldOff } from 'react-icons/lu'
import { AppShell } from '@/components/layout/AppShell'
import { TableSkeleton } from '@/components/ui/Skeleton'
import LoginPage from '@/features/auth/LoginPage'
import SetupPage from '@/features/auth/SetupPage'
import InventoryPage from '@/features/inventory/InventoryPage'
import QuickAddPage from '@/features/quick-add/QuickAddPage'
import type { Permission } from '@/lib/permissions'
import { useAuth, useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'

// Las secciones de consulta se cargan bajo demanda; Inventario y Carga Rápida van en el paquete inicial.
const SuppliersPage = lazy(() => import('@/features/suppliers/SuppliersPage'))
const CategoriesPage = lazy(() => import('@/features/categories/CategoriesPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const UsersPage = lazy(() => import('@/features/admin/UsersPage'))
const ActivityPage = lazy(() => import('@/features/admin/ActivityPage'))
const SeasonsPage = lazy(() => import('@/features/seasons/SeasonsPage'))
const DiscountsPage = lazy(() => import('@/features/discounts/DiscountsPage'))
const BillingPage = lazy(() => import('@/features/billing/BillingPage'))
// La tienda para clientes es un paquete aparte: no carga nada del panel interno.
const StorePage = lazy(() => import('@/features/store/StorePage'))

/** Muestra la sección solo si el rol tiene el permiso; si no, explica por qué. */
function Guard({ p, children }: { p: Permission; children: React.ReactNode }) {
  const allowed = useCan(p)
  if (!allowed)
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <ShieldOff className="size-10 text-ink-soft" strokeWidth={1.8} aria-hidden />
        <p className="text-lg font-black">Esta sección es solo para el dueño</p>
        <p className="max-w-sm text-sm font-semibold text-ink-soft">Si necesitas acceso, pídele al dueño que cambie tu rol en Usuarios.</p>
      </div>
    )
  return <Suspense fallback={<TableSkeleton rows={4} />}>{children}</Suspense>
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <InventoryPage /> },
      { path: '/carga', element: <QuickAddPage /> },
      { path: '/proveedores', element: <Guard p="proveedores.ver"><SuppliersPage /></Guard> },
      { path: '/categorias', element: <Guard p="categorias.ver"><CategoriesPage /></Guard> },
      { path: '/reportes', element: <Guard p="reportes.ver"><ReportsPage /></Guard> },
      { path: '/usuarios', element: <Guard p="usuarios.gestionar"><UsersPage /></Guard> },
      { path: '/actividad', element: <Guard p="actividad.ver"><ActivityPage /></Guard> },
      { path: '/temporadas', element: <Guard p="temporadas.ver"><SeasonsPage /></Guard> },
      { path: '/descuentos', element: <Guard p="descuentos.gestionar"><DiscountsPage /></Guard> },
      { path: '/facturacion', element: <Guard p="facturacion.ver"><BillingPage /></Guard> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-rail" aria-busy="true" aria-label="Cargando">
      <span className="size-8 animate-pulse rounded-full bg-sol" />
    </div>
  )
}

const isStore = () => window.location.pathname.startsWith('/tienda')

export default function App() {
  if (isStore())
    return (
      <Suspense fallback={<Splash />}>
        <StorePage />
      </Suspense>
    )
  return <Panel />
}

/** Panel interno: pide ingreso y carga los datos según el rol. */
function Panel() {
  const { phase, boot } = useAuth()
  const load = useInventory((s) => s.load)
  const loadSales = useSales((s) => s.load)
  const canSales = useCan('ventas.ver')

  useEffect(() => {
    void boot()
  }, [boot])

  useEffect(() => {
    if (phase === 'in') void load()
  }, [phase, load])

  // Las ventas alimentan avisos de temporada, reportes y el asistente (solo si el rol las puede ver).
  useEffect(() => {
    if (phase === 'in' && canSales) void loadSales()
  }, [phase, canSales, loadSales])

  if (phase === 'checking') return <Splash />
  if (phase === 'setup') return <SetupPage />
  if (phase === 'login') return <LoginPage />
  return <RouterProvider router={router} />
}
