import { History, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Shimmer } from '@/components/ui/Skeleton'
import { formatDate, formatTime } from '@/lib/format'
import { listAudit } from '@/services/audit'
import type { AuditEntry } from '@/types'

/** Acciones que conviene mirar primero: pueden esconder faltantes o accesos indebidos. */
const SENSITIVE = /fallido|rechazado|eliminado|ajuste|restaurada|desactivado|rol|precio|deshech/i

export default function ActivityPage() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [q, setQ] = useState('')
  const [onlySensitive, setOnlySensitive] = useState(false)

  useEffect(() => {
    void listAudit().then(setRows)
  }, [])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows ?? []).filter(
      (r) => (!onlySensitive || SENSITIVE.test(r.action)) && (!t || `${r.action} ${r.detail} ${r.userName}`.toLowerCase().includes(t)),
    )
  }, [rows, q, onlySensitive])

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Actividad</h1>
        <p className="mt-1 text-sm font-semibold text-ink-soft">Quién hizo qué y cuándo: ingresos, ajustes de stock, cambios de precio, borrados y usuarios.</p>
      </header>

      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-3 shadow-card sm:flex-row sm:items-center sm:p-4">
        <label className="relative flex-1">
          <span className="sr-only">Buscar en la actividad</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar acción, producto o persona"
            className="h-12 w-full rounded-xl border-2 border-line bg-ground pl-11 pr-4 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
          />
        </label>
        <button
          aria-pressed={onlySensitive}
          onClick={() => setOnlySensitive((v) => !v)}
          className={clsx(
            'h-12 rounded-xl px-4 text-sm font-extrabold transition-colors',
            onlySensitive ? 'bg-ink text-ground' : 'bg-sunken text-ink-soft hover:text-ink',
          )}
        >
          Solo acciones sensibles
        </button>
      </div>

      <section className="overflow-hidden rounded-3xl bg-surface shadow-card">
        {!rows ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Shimmer key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <History className="size-10 text-ink-soft" strokeWidth={1.8} aria-hidden />
            <p className="font-black">{rows.length ? 'Nada coincide con la búsqueda' : 'Todavía no hay actividad registrada'}</p>
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {filtered.slice(0, 500).map((r) => (
              <li key={r.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-0.5 px-5 py-3 sm:grid-cols-[6.5rem_10rem_minmax(0,1fr)]">
                <span className="num row-span-2 text-xs font-bold text-ink-soft sm:row-span-1">
                  {formatDate(r.at)}
                  <span className="block">{formatTime(r.at)}</span>
                </span>
                <span className="truncate text-sm font-extrabold">{r.userName}</span>
                <span className="min-w-0 text-sm">
                  <span className={clsx('font-extrabold', SENSITIVE.test(r.action) && 'text-peligro')}>{r.action}</span>
                  {r.detail && <span className="font-semibold text-ink-soft"> · {r.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {filtered.length > 500 && <p className="text-center text-xs font-semibold text-ink-soft">Se muestran las 500 más recientes. Usa la búsqueda para encontrar las anteriores.</p>}
    </div>
  )
}
