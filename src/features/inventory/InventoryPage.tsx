import { motion } from 'framer-motion'
import { LuPackageSearch as PackageSearch, LuSearch as Search, LuZap as Zap } from 'react-icons/lu'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { Button, Kbd } from '@/components/ui/Button'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { BOARD } from '@/lib/colors'
import { STOCK_LABEL, stockLevel } from '@/lib/format'
import { useInventory } from '@/stores/inventory'
import type { StockLevel } from '@/types'
import { useHotkeys } from '@/hooks/useHotkeys'
import { InventoryTable, type Sort, type SortKey } from './components/InventoryTable'
import { ProductDrawer } from './components/ProductDrawer'

/** Cuánto le queda respecto de su mínimo: 0 = agotado; menor = más urgente. */
const urgency = (p: { stock: number; minStock: number }) => (p.stock <= 0 ? -1 : p.stock / Math.max(1, p.minStock))

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function InventoryPage() {
  const { status, error, products, categories, seasons } = useInventory()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [level, setLevel] = useState<StockLevel | null>(null)
  // Por defecto, lo más urgente arriba: primero el stock bajo, luego el que está más cerca de su mínimo.
  const [sort, setSort] = useState<Sort>({ key: 'urgencia', dir: 'asc' })
  const [season, setSeason] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const [params, setParams] = useSearchParams()

  // Desde un aviso: /?producto=<id> abre su cajón.
  useEffect(() => {
    const id = params.get('producto')
    if (id && products.some((p) => p.id === id)) {
      setOpen(id)
      setParams({}, { replace: true })
    }
  }, [params, products, setParams])

  useHotkeys({ '/': () => search.current?.focus() })

  const counts = useMemo(() => {
    const byLevel: Record<StockLevel, number> = { bajo: 0, medio: 0, alto: 0 }
    products.forEach((p) => byLevel[stockLevel(p)]++)
    return byLevel
  }, [products])

  const rows = useMemo(() => {
    const q = norm(query.trim())
    const out = products.filter(
      (p) =>
        (!cat || p.categoryId === cat) &&
        (!season || p.seasons.includes(season)) &&
        (!level || stockLevel(p) === level) &&
        (!q || norm(p.name).includes(q) || p.sku.includes(q) || norm(p.brand).includes(q)),
    )
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.key === 'urgencia') return out.sort((a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name, 'es'))
    return out.sort((a, b) => {
      const key = sort.key as Exclude<SortKey, 'urgencia'>
      const x = a[key]
      const y = b[key]
      return (typeof x === 'string' ? x.localeCompare(y as string, 'es') : (x as number) - (y as number)) * dir
    })
  }, [products, query, cat, level, season, sort])

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))

  const filtered = !!(query || cat || level || season)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Inventario</h1>
          <p className="num mt-1 text-sm font-semibold text-ink-soft">
            {status === 'ready' ? `${products.length} productos · ${counts.bajo} con stock bajo` : 'Cargando…'}
          </p>
        </div>
        <Link
          to="/carga"
          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-sol px-5 font-extrabold text-on-fill shadow-card transition-[filter,transform] hover:-translate-y-px hover:brightness-[1.04] active:scale-[0.97]"
        >
          <Zap className="size-5" strokeWidth={2.5} aria-hidden /> Carga Rápida
        </Link>
      </header>

      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-3 shadow-card sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, código o marca"
              className="h-12 w-full rounded-xl border-2 border-line bg-ground pl-11 pr-12 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
            />
            <Kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft">/</Kbd>
          </label>
          <div role="group" aria-label="Filtrar por stock" className="flex gap-1 rounded-xl bg-sunken p-1">
            {(['bajo', 'medio', 'alto'] as const).map((l) => (
              <button
                key={l}
                aria-pressed={level === l}
                onClick={() => setLevel(level === l ? null : l)}
                className={clsx(
                  'num flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition-colors lg:flex-none',
                  level === l ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink',
                )}
              >
                <span className={clsx('size-2 rounded-full', l === 'bajo' ? 'bg-peligro' : l === 'medio' ? 'bg-sol' : 'bg-turquesa')} aria-hidden />
                {STOCK_LABEL[l]} <span className="text-ink-soft">{counts[l]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por categoría">
          <FilterChip on={!cat} onClick={() => setCat(null)}>
            Todas
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} dot={BOARD[c.color].fill}>
              {c.name}
            </FilterChip>
          ))}
        </div>
        {seasons.length > 0 && (
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por temporada">
            <span className="shrink-0 text-xs font-extrabold text-ink-soft">Temporada</span>
            {seasons.map((t) => (
              <FilterChip key={t.id} on={season === t.id} onClick={() => setSeason(season === t.id ? null : t.id)} dot={BOARD[t.color].fill}>
                {t.name}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <section className="overflow-hidden rounded-3xl bg-surface pt-3 shadow-card">
        {status === 'loading' || status === 'idle' ? (
          <TableSkeleton />
        ) : status === 'error' ? (
          <p className="px-6 py-14 text-center font-bold text-peligro">{error}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <PackageSearch className="size-10 text-ink-soft" strokeWidth={1.8} aria-hidden />
            <p className="text-lg font-black">{filtered ? 'Nada coincide con estos filtros' : 'El inventario está vacío'}</p>
            <p className="max-w-sm text-sm font-semibold text-ink-soft">
              {filtered ? 'Prueba con otra categoría o borra la búsqueda.' : 'Carga el primer lote desde Carga Rápida.'}
            </p>
            {filtered && (
              <Button variant="secondary" onClick={() => (setQuery(''), setCat(null), setLevel(null), setSeason(null))}>
                Quitar filtros
              </Button>
            )}
          </div>
        ) : (
          <InventoryTable rows={rows} categories={categories} sort={sort} onSort={onSort} onOpen={setOpen} selectedId={open} />
        )}
      </section>

      <ProductDrawer productId={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function FilterChip({ on, onClick, dot, children }: { on: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        'relative flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-extrabold transition-colors',
        on ? 'text-ground' : 'bg-sunken text-ink-soft hover:text-ink',
      )}
    >
      {on && <motion.span layoutId="inv-cat" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 600, damping: 38 }} />}
      {dot && <span className={clsx('relative size-2.5 rounded-full', dot)} aria-hidden />}
      <span className="relative">{children}</span>
    </button>
  )
}
