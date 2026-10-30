import { motion } from 'framer-motion'
import { LuPlus as Plus } from 'react-icons/lu'
import { forwardRef, useRef } from 'react'
import clsx from 'clsx'
import { BOARD } from '@/lib/colors'
import type { Category } from '@/types'

interface Props {
  categories: Category[]
  value: string
  onChange: (id: string) => void
  invalid?: boolean
  describedBy?: string
  /** Si existe, muestra «+ Nueva» para crear una categoría sin salir de la carga. */
  onCreate?: () => void
}

/**
 * Grupo de radio con fichas de color. Un solo paso de Tab; flechas para moverse.
 * Alt+1…9 elige desde cualquier campo (ver QuickAddForm).
 */
export const CategoryPicker = forwardRef<HTMLDivElement, Props>(function CategoryPicker(
  { categories, value, onChange, invalid, describedBy, onCreate },
  ref,
) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(0, categories.findIndex((c) => c.id === value))

  const move = (dir: number) => {
    const next = (current + dir + categories.length) % categories.length
    onChange(categories[next].id)
    buttons.current[next]?.focus()
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Categoría"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="flex flex-wrap gap-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), move(1))
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), move(-1))
      }}
    >
      {categories.map((c, i) => {
        const on = c.id === value
        return (
          <button
            key={c.id}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(c.id)}
            className={clsx(
              'relative flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-extrabold transition-colors duration-150',
              on ? 'text-on-fill' : 'bg-sunken text-ink-soft hover:text-ink',
              invalid && !value && 'ring-2 ring-peligro/50',
            )}
          >
            {on && (
              <motion.span
                layoutId="category-chip"
                className={clsx('absolute inset-0 rounded-full', BOARD[c.color].fill)}
                transition={{ type: 'spring', stiffness: 600, damping: 34 }}
              />
            )}
            <span className={clsx('relative size-2.5 rounded-full', on ? 'bg-on-fill/70' : BOARD[c.color].fill)} aria-hidden />
            <span className="relative">{c.name}</span>
            <span className={clsx('num relative hidden text-2xs font-black xl:inline', on ? 'text-on-fill/70' : 'text-ink-soft')}>
              Alt {i + 1}
            </span>
          </button>
        )
      })}
      {onCreate && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onCreate}
          className="flex h-10 items-center gap-1.5 rounded-full border-2 border-dashed border-line px-3.5 text-sm font-extrabold text-ink-soft transition-colors hover:border-ink-soft/50 hover:text-ink"
        >
          <Plus className="size-4" strokeWidth={2.6} aria-hidden /> Nueva
        </button>
      )}
    </div>
  )
})
