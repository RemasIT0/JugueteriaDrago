import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import { STOCK_LABEL, stockLevel } from '@/lib/format'
import type { Category, Product, StockLevel } from '@/types'

const PIPS: Record<StockLevel, number> = { bajo: 1, medio: 2, alto: 3 }
const PIP_COLOR: Record<StockLevel, string> = { bajo: 'bg-peligro', medio: 'bg-sol', alto: 'bg-turquesa' }

/** Rampa fija de stock: 1, 2 o 3 pips. La misma en tabla, cartas y cajón. */
export function StockPips({ product, withLabel = false }: { product: Pick<Product, 'stock' | 'minStock'>; withLabel?: boolean }) {
  const level = stockLevel(product)
  return (
    <span className="inline-flex items-center gap-2" title={`Stock ${STOCK_LABEL[level]}`}>
      <span className="flex gap-[3px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={clsx('size-2 rounded-full', i < PIPS[level] ? PIP_COLOR[level] : 'bg-line')} />
        ))}
      </span>
      <span className={clsx(withLabel ? 'text-xs font-extrabold text-ink-soft' : 'sr-only')}>{STOCK_LABEL[level]}</span>
    </span>
  )
}

/** Etiqueta de categoría: casilla de color plano con texto de tinta. */
export function CategoryTag({ category, size = 'sm' }: { category?: Category; size?: 'sm' | 'xs' }) {
  if (!category) return <span className="text-xs font-bold text-ink-soft">Sin categoría</span>
  return (
    <span
      className={clsx(
        'inline-flex w-fit max-w-full items-center gap-1.5 truncate rounded-full font-extrabold',
        BOARD[category.color].wash,
        BOARD[category.color].ink,
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-6 px-2 text-2xs',
      )}
    >
      <span className={clsx('size-2 shrink-0 rounded-full', BOARD[category.color].fill)} aria-hidden />
      {category.name}
    </span>
  )
}
