import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import clsx from 'clsx'
import { CategoryTag, StockPips } from '@/components/ui/Board'
import { Shimmer } from '@/components/ui/Skeleton'
import { BOARD } from '@/lib/colors'
import { formatPrice, stockLevel } from '@/lib/format'
import { useInventory } from '@/stores/inventory'

export default function ReportsPage() {
  const { status, categories, products } = useInventory()

  const byCategory = useMemo(
    () =>
      categories
        .map((c) => {
          const own = products.filter((p) => p.categoryId === c.id)
          return { c, units: own.reduce((a, p) => a + p.stock, 0), value: own.reduce((a, p) => a + p.stock * p.price, 0) }
        })
        .sort((a, b) => b.value - a.value),
    [categories, products],
  )
  const total = byCategory.reduce((a, r) => a + r.value, 0)
  const max = Math.max(1, ...byCategory.map((r) => r.value))
  const low = products.filter((p) => stockLevel(p) === 'bajo').sort((a, b) => a.stock - b.stock)

  if (status !== 'ready')
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Shimmer className="h-80 rounded-3xl" />
        <Shimmer className="h-80 rounded-3xl" />
      </div>
    )

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Reportes</h1>
        <p className="num mt-1 text-sm font-semibold text-ink-soft">
          Valor en tienda: <span className="font-black text-ink">{formatPrice(total)}</span> a precio de venta
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
          <h2 className="font-black">Valor por categoría</h2>
          <ul className="flex flex-col gap-3.5">
            {byCategory.map(({ c, units, value }) => (
              <li key={c.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_6.5rem]">
                <span className="truncate text-sm font-extrabold">{c.name}</span>
                <div className="h-7 overflow-hidden rounded-lg bg-sunken">
                  <div className={clsx('h-full rounded-lg', BOARD[c.color].fill)} style={{ width: `${(value / max) * 100}%` }} />
                </div>
                <span className="num col-start-2 text-xs font-bold text-ink-soft sm:col-start-auto sm:text-right sm:text-sm sm:text-ink">
                  {formatPrice(value)}
                  <span className="text-ink-soft sm:block sm:text-2xs"> · {units} u</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 font-black">
            <AlertTriangle className="size-5 text-peligro" strokeWidth={2.5} aria-hidden /> Para reponer
            <span className="num rounded-full bg-peligro-wash px-2 text-xs font-extrabold text-peligro">{low.length}</span>
          </h2>
          {low.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-ink-soft">Ningún producto está por debajo de su mínimo.</p>
          ) : (
            <ul className="divide-y divide-line">
              {low.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{p.name}</p>
                    <CategoryTag category={categories.find((c) => c.id === p.categoryId)} size="xs" />
                  </div>
                  <span className="num text-sm font-bold text-ink-soft">
                    <span className="font-black text-peligro">{p.stock}</span> / mín {p.minStock}
                  </span>
                  <StockPips product={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
