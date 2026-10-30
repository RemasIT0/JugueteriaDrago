import { BatteryCharging, BatteryWarning, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { Shimmer } from '@/components/ui/Skeleton'
import { BOARD } from '@/lib/colors'
import { formatAge, stockLevel } from '@/lib/format'
import { useInventory } from '@/stores/inventory'
import { ProductThumb } from '../inventory/components/ProductThumb'

export default function CategoriesPage() {
  const { status, categories, products } = useInventory()

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Categorías</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
          Cada categoría tiene su color de casilla y una plantilla: al elegirla en Carga Rápida, estos datos se completan solos.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {status !== 'ready'
          ? Array.from({ length: 6 }, (_, i) => <Shimmer key={i} className="h-52 rounded-3xl" />)
          : categories.map((c) => {
              const own = products.filter((p) => p.categoryId === c.id)
              const low = own.filter((p) => stockLevel(p) === 'bajo').length
              return (
                <article key={c.id} className="overflow-hidden rounded-3xl bg-surface shadow-card">
                  <div className={clsx('h-3', BOARD[c.color].fill)} />
                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex items-center gap-3">
                      <ProductThumb category={c} />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-black">{c.name}</h2>
                        <p className="num text-sm font-semibold text-ink-soft">
                          {own.length} productos{low > 0 && <span className="text-peligro"> · {low} con stock bajo</span>}
                        </p>
                      </div>
                    </div>
                    <div className={clsx('flex flex-col gap-2 rounded-2xl p-3.5', BOARD[c.color].wash)}>
                      <p className={clsx('flex items-center gap-1.5 text-xs font-extrabold', BOARD[c.color].ink)}>
                        <Sparkles className="size-3.5" aria-hidden /> Plantilla
                      </p>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
                        <li>{formatAge(c.defaults.ageMin ?? 0)}</li>
                        <li className="flex items-center gap-1">
                          {c.defaults.batteries ? <BatteryCharging className="size-4" aria-hidden /> : <BatteryWarning className="size-4 opacity-50" aria-hidden />}
                          {c.defaults.batteries ? 'Con baterías' : 'Sin baterías'}
                        </li>
                        <li className="num">Aviso con ≤ {c.defaults.minStock ?? 5} u</li>
                      </ul>
                    </div>
                  </div>
                </article>
              )
            })}
      </div>
    </div>
  )
}
