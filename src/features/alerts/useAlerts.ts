import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { planSeasons } from '@/lib/forecast'
import { stockLevel } from '@/lib/format'
import { useAuth } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'

export interface Alert {
  /** Identidad estable del aviso. */
  id: string
  /** Si cambia (p. ej. el stock baja más), el aviso vuelve a aparecer aunque ya se haya visto. */
  signature: string
  tone: 'peligro' | 'sol'
  title: string
  detail: string
  productId?: string
  seasonId?: string
}

// Lo visto se guarda por usuario en este navegador.
const listeners = new Set<() => void>()
const key = (userId: string) => `dragotoy-alertas-vistas-${userId}`
function readSeen(userId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? '{}')
  } catch {
    return {}
  }
}
let cache: { userId: string; raw: string | null; value: Record<string, string> } | null = null
function snapshot(userId: string) {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key(userId))
  } catch {
    /* sin almacenamiento */
  }
  if (!cache || cache.userId !== userId || cache.raw !== raw) cache = { userId, raw, value: readSeen(userId) }
  return cache.value
}

/** Avisos vivos: productos en o bajo su mínimo, y reposición sugerida antes de cada temporada. */
export function useAlerts() {
  const userId = useAuth((s) => s.user?.id ?? 'anon')
  const products = useInventory((s) => s.products)
  const seasons = useInventory((s) => s.seasons)
  const sales = useSales((s) => s.sales)

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = []
    for (const p of products) {
      if (p.syncState || stockLevel(p) !== 'bajo') continue
      out.push({
        id: `stock:${p.id}`,
        signature: String(p.stock),
        tone: 'peligro',
        title: p.stock <= 0 ? `Agotado: ${p.name}` : `Reponer: ${p.name}`,
        detail: p.stock <= 0 ? `Sin unidades (mínimo ${p.minStock})` : `Quedan ${p.stock} u (mínimo ${p.minStock})`,
        productId: p.id,
      })
    }
    for (const plan of planSeasons(seasons, products, sales)) {
      if (plan.days > plan.season.leadDays || !plan.items.length) continue
      const units = plan.items.reduce((a, i) => a + i.suggested, 0)
      out.push({
        id: `temp:${plan.season.id}:${plan.date.getFullYear()}`,
        signature: String(units),
        tone: 'sol',
        title: `${plan.season.name} en ${plan.days} días`,
        detail: `Conviene pedir ${units} u de ${plan.items.length} producto${plan.items.length > 1 ? 's' : ''}`,
        seasonId: plan.season.id,
      })
    }
    return out
  }, [products, seasons, sales])

  const seen = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => snapshot(userId),
  )

  const unseen = alerts.filter((a) => seen[a.id] !== a.signature)

  const markSeen = useCallback(
    (list: Alert[]) => {
      const next = { ...readSeen(userId) }
      for (const a of list) next[a.id] = a.signature
      try {
        localStorage.setItem(key(userId), JSON.stringify(next))
      } catch {
        /* sin almacenamiento: se verán de nuevo al recargar */
      }
      listeners.forEach((l) => l())
    },
    [userId],
  )

  return { alerts, unseen, markSeen }
}
