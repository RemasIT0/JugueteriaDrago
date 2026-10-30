import { Blocks, Car, Dices, Package, Sun, Heart, Baby } from 'lucide-react'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import type { Category } from '@/types'

const ICONS: Record<string, typeof Package> = {
  cat_munecas: Baby,
  cat_bloques: Blocks,
  cat_peluches: Heart,
  cat_mesa: Dices,
  cat_vehiculos: Car,
  cat_aire: Sun,
}

/** Miniatura cuando no hay foto: caja con la banda de color de su categoría. */
export function ProductThumb({ category, imageUrl, size = 'md' }: { category?: Category; imageUrl?: string | null; size?: 'md' | 'xl' }) {
  const Icon = (category && ICONS[category.id]) || Package
  const color = category?.color
  if (imageUrl)
    return <img src={imageUrl} alt="" className={clsx('shrink-0 rounded-xl object-cover', size === 'md' ? 'size-11' : 'h-40 w-full rounded-3xl')} />
  return (
    <div
      className={clsx(
        'relative shrink-0 overflow-hidden',
        color ? BOARD[color].wash : 'bg-sunken',
        size === 'md' ? 'size-11 rounded-xl' : 'h-40 w-full rounded-3xl',
      )}
      aria-hidden
    >
      <div className={clsx('absolute inset-x-0 top-0', color ? BOARD[color].fill : 'bg-line', size === 'md' ? 'h-1.5' : 'h-4')} />
      <Icon
        className={clsx('absolute inset-0 m-auto', color ? BOARD[color].ink : 'text-ink-soft', size === 'md' ? 'mt-3.5 size-5' : 'size-12')}
        strokeWidth={size === 'md' ? 2.4 : 1.8}
      />
    </div>
  )
}
