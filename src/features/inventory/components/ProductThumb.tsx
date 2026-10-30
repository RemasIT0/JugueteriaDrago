import { GiBabyFace, GiBearFace, GiCardboardBox, GiCubes, GiKite, GiPerspectiveDiceSixFacesRandom, GiRaceCar } from 'react-icons/gi'
import type { IconType } from 'react-icons'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import type { Category } from '@/types'

/** Ícono de juguete por categoría base; las categorías nuevas usan la caja. */
const ICONS: Record<string, IconType> = {
  cat_munecas: GiBabyFace,
  cat_bloques: GiCubes,
  cat_peluches: GiBearFace,
  cat_mesa: GiPerspectiveDiceSixFacesRandom,
  cat_vehiculos: GiRaceCar,
  cat_aire: GiKite,
}

export const categoryIcon = (category?: Category): IconType => (category && ICONS[category.id]) || GiCardboardBox

/** Miniatura cuando no hay foto: caja con la banda de color de su categoría. */
export function ProductThumb({ category, imageUrl, size = 'md' }: { category?: Category; imageUrl?: string | null; size?: 'md' | 'xl' }) {
  const Icon = categoryIcon(category)
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
      <Icon className={clsx('absolute inset-0 m-auto', color ? BOARD[color].ink : 'text-ink-soft', size === 'md' ? 'mt-3 size-6' : 'size-16')} />
    </div>
  )
}
