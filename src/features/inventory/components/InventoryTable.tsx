import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ChevronsUpDown, CloudOff, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { CategoryTag, StockPips } from '@/components/ui/Board'
import { formatDate, formatPrice } from '@/lib/format'
import type { Category, ProductRow } from '@/types'
import { ProductThumb } from './ProductThumb'

export type SortKey = 'name' | 'stock' | 'price' | 'updatedAt'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }

interface Props {
  rows: ProductRow[]
  categories: Category[]
  sort: Sort
  onSort: (key: SortKey) => void
  onOpen: (id: string) => void
  selectedId: string | null
}

const COLS = 'md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]'

export function InventoryTable({ rows, categories, sort, onSort, onOpen, selectedId }: Props) {
  const header = (key: SortKey | null, label: string, align: 'left' | 'right' = 'left') => {
    const active = key && sort.key === key
    const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
    return (
      <div role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={align === 'right' ? 'text-right' : ''}>
        {key ? (
          <button
            onClick={() => onSort(key)}
            className={clsx('inline-flex items-center gap-1 rounded-md transition-colors hover:text-ink', active && 'text-ink')}
          >
            {label}
            <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        ) : (
          label
        )}
      </div>
    )
  }

  return (
    <div role="table" aria-label="Inventario" aria-rowcount={rows.length} className="flex flex-col">
      <div role="row" className={clsx('hidden items-center gap-4 border-b-2 border-line px-4 pb-3 text-xs font-extrabold text-ink-soft md:grid', COLS)}>
        {header('name', 'Producto')}
        {header(null, 'Categoría')}
        {header(null, 'Código')}
        {header('stock', 'Stock')}
        {header('price', 'Precio', 'right')}
        {header('updatedAt', 'Actualizado', 'right')}
      </div>
      <div role="rowgroup" className="divide-y divide-line">
        {rows.map((p) => {
          const cat = categories.find((c) => c.id === p.categoryId)
          return (
            <motion.div
              key={p.id}
              role="row"
              layout="position"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              tabIndex={0}
              onClick={() => onOpen(p.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(p.id))}
              aria-selected={selectedId === p.id}
              className={clsx(
                'grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors md:gap-4',
                COLS,
                selectedId === p.id ? 'bg-sol-wash' : 'hover:bg-sunken/70',
              )}
            >
              <div role="cell" className="contents md:flex md:min-w-0 md:items-center md:gap-3">
                <ProductThumb category={cat} imageUrl={p.photos[0]} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-extrabold">
                    <span className="truncate">{p.name}</span>
                    {p.syncState === 'saving' && <Loader2 className="size-3.5 shrink-0 animate-spin text-ink-soft" aria-label="Guardando" />}
                    {p.syncState === 'error' && <CloudOff className="size-3.5 shrink-0 text-peligro" aria-label="No se guardó" />}
                  </p>
                  <p className="truncate text-xs font-semibold text-ink-soft">
                    {p.brand || 'Sin marca'}
                    <span className="md:hidden"> · {cat?.name}</span>
                  </p>
                </div>
              </div>
              <div role="cell" className="hidden md:block">
                <CategoryTag category={cat} />
              </div>
              <div role="cell" className="num hidden truncate text-sm font-semibold text-ink-soft md:block">
                {p.sku}
              </div>
              <div role="cell" className="flex items-center justify-end gap-2.5 md:justify-start">
                <span className="num w-8 text-right font-extrabold md:text-left">{p.stock}</span>
                <StockPips product={p} />
              </div>
              <div role="cell" className="num col-start-2 text-sm font-bold text-ink-soft md:col-start-auto md:text-right md:text-[0.9375rem] md:text-ink">
                {formatPrice(p.price)}
              </div>
              <div role="cell" className="num hidden text-right text-sm font-semibold text-ink-soft md:block">
                {formatDate(p.updatedAt)}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
