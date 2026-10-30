import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORE } from '@/lib/config'
import { uid } from '@/lib/format'
import type { Lote, LoteEntry } from '@/types'

interface LoteState {
  lote: Lote
  /** Última categoría usada: se mantiene entre productos para no volver a elegirla. */
  lastCategoryId: string | null
  record: (entry: LoteEntry) => void
  undoLast: () => LoteEntry | undefined
  setGoal: (goal: number) => void
  setSupplier: (supplierId: string | null) => void
  setLastCategory: (id: string) => void
  startNew: () => void
}

const fresh = (supplierId: string | null = null, goal: number = STORE.defaultLoteGoal): Lote => ({
  id: uid('lote'),
  supplierId,
  goal,
  startedAt: new Date().toISOString(),
  entries: [],
})

/** El lote en curso sobrevive a recargas: si se corta la luz no se pierde la cuenta. */
export const useLote = create<LoteState>()(
  persist(
    (set, get) => ({
      lote: fresh(),
      lastCategoryId: null,
      record: (entry) => set((s) => ({ lote: { ...s.lote, entries: [...s.lote.entries, entry] } })),
      undoLast: () => {
        const last = get().lote.entries.at(-1)
        set((s) => ({ lote: { ...s.lote, entries: s.lote.entries.slice(0, -1) } }))
        return last
      },
      setGoal: (goal) => set((s) => ({ lote: { ...s.lote, goal: Math.max(1, Math.min(500, goal)) } })),
      setSupplier: (supplierId) => set((s) => ({ lote: { ...s.lote, supplierId } })),
      setLastCategory: (id) => set({ lastCategoryId: id }),
      startNew: () => set((s) => ({ lote: fresh(s.lote.supplierId, s.lote.goal) })),
    }),
    { name: 'dragotoy-lote' },
  ),
)
