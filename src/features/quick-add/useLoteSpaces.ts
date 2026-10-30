import { useMemo } from 'react'
import { categoryById, useInventory } from '@/stores/inventory'
import { useLote } from '@/stores/lote'
import type { BoardColor } from '@/types'

const MAX_SPACES = 50

/** Cálculo compartido del tablero del lote (pista completa y mini pista de la barra lateral). */
export function useLoteSpaces() {
  const lote = useLote((s) => s.lote)
  const categories = useInventory((s) => s.categories)
  const done = lote.entries.length
  const perSpace = Math.ceil(lote.goal / MAX_SPACES)
  const spaces = Math.ceil(lote.goal / perSpace)
  const filled = Math.min(spaces, Math.floor(done / perSpace))

  const colors = useMemo<(BoardColor | undefined)[]>(
    () =>
      Array.from({ length: filled }, (_, i) => {
        const entry = lote.entries[Math.min(lote.entries.length - 1, (i + 1) * perSpace - 1)]
        return categoryById(categories, entry?.categoryId ?? '')?.color
      }),
    [filled, lote.entries, perSpace, categories],
  )

  return {
    done,
    goal: lote.goal,
    remaining: Math.max(0, lote.goal - done),
    reached: done >= lote.goal,
    perSpace,
    spaces,
    filled,
    colors,
    entriesAt: lote.entries.map((e) => e.at),
  }
}
