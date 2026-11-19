import { useId } from 'react'
import clsx from 'clsx'
import { formatPrice } from '@/lib/format'
import { priceFor, promoWindow } from '@/lib/pricing'
import type { Discount, Product } from '@/types'

/**
 * Precio del juguete. Si tiene una promoción vigente: el precio de lista tachado en rojo y el precio
 * con descuento. Al pasar el mouse o enfocarlo con el teclado aparece qué descuento es y hasta cuándo.
 */
export function PromoPrice({ product, discounts, className }: { product: Pick<Product, 'id' | 'categoryId' | 'seasons' | 'price'>; discounts: Discount[]; className?: string }) {
  const tipId = useId()
  const { list, final, percent, discount } = priceFor(product, discounts)
  if (!discount) return <span className={clsx('num', className)}>{formatPrice(list)}</span>

  return (
    <span
      tabIndex={0}
      aria-describedby={tipId}
      onClick={(e) => e.stopPropagation()}
      className={clsx('group/promo relative inline-flex flex-col items-start leading-tight outline-none md:items-end', className)}
    >
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="rounded-md bg-coral px-1.5 py-px text-2xs font-black text-on-fill">−{percent}%</span>
        <span className="num text-xs font-bold text-peligro line-through decoration-2" aria-label={`Antes ${formatPrice(list)}`}>
          {formatPrice(list)}
        </span>
      </span>
      <span className="num whitespace-nowrap font-black text-ink">{formatPrice(final)}</span>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 md:left-auto md:right-0 mb-2 w-max max-w-64 translate-y-1 rounded-xl bg-ink px-3 py-2 text-left text-xs font-bold leading-snug text-ground opacity-0 shadow-lift transition-[opacity,transform] duration-150 group-hover/promo:translate-y-0 group-hover/promo:opacity-100 group-focus-visible/promo:translate-y-0 group-focus-visible/promo:opacity-100 motion-reduce:transition-none"
      >
        <span className="block font-black">
          {discount.name} · −{percent}%
        </span>
        <span className="block font-semibold opacity-80">Vigente {promoWindow(discount)}</span>
      </span>
    </span>
  )
}
