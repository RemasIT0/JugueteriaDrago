import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, Loader2, PackagePlus, RefreshCw, Undo2 } from 'lucide-react'
import clsx from 'clsx'
import { StockPips } from '@/components/ui/Board'
import { BOARD } from '@/lib/colors'
import { formatTime } from '@/lib/format'
import { categoryById, useInventory } from '@/stores/inventory'
import { useLote } from '@/stores/lote'

/** Pila de lo último guardado. Cada carta cae sobre la pila y su "tapa" se cierra con rebote. */
export function RecentStack({ lastMs, onUndo }: { lastMs: number | null; onUndo: () => void }) {
  const entries = useLote((s) => s.lote.entries)
  const categories = useInventory((s) => s.categories)
  const products = useInventory((s) => s.products)
  const retry = useInventory((s) => s.retry)
  const recent = entries.slice(-7).reverse()

  return (
    <section aria-label="Recién guardados" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-black text-ink-soft">Recién guardados</h2>
        {lastMs !== null && (
          <span className="num text-xs font-bold text-turquesa-ink">listo en {Math.max(1, Math.round(lastMs))} ms</span>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-3xl border-2 border-dashed border-line px-6 py-10 text-center">
          <PackagePlus className="size-8 text-ink-soft" strokeWidth={2} aria-hidden />
          <p className="text-sm font-bold text-ink-soft">Lo que guardes aparecerá aquí, el último arriba.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {recent.map((e, i) => {
              const cat = categoryById(categories, e.categoryId)
              const row = products.find((p) => p.sku === e.sku)
              const state = e.kind === 'nuevo' ? row?.syncState : undefined
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: -28, scale: 0.92, rotate: -2 }}
                  animate={{ opacity: i > 4 ? 0.5 : 1, y: 0, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                  className="overflow-hidden rounded-2xl bg-surface shadow-card"
                >
                  <motion.div
                    className={clsx('h-2 origin-top', cat ? BOARD[cat.color].fill : 'bg-line')}
                    initial={{ scaleY: 3 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 700, damping: 14, delay: 0.05 }}
                  />
                  <div className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[0.9375rem] font-extrabold">
                        <span className="min-w-0 flex-1 truncate">{e.name}</span>
                        {e.stock !== undefined && e.minStock !== undefined && <StockPips product={{ stock: e.stock, minStock: e.minStock }} />}
                      </p>
                      <p className="num truncate text-xs font-bold text-ink-soft">
                        {e.sku} · {e.kind === 'nuevo' ? `${e.qty} u` : `+${e.qty} u repuestas`} · {formatTime(e.at)}
                      </p>
                    </div>
                    {state === 'saving' && (
                      <Loader2 className="size-4 shrink-0 animate-spin text-ink-soft" aria-label="Guardando" />
                    )}
                    {state === 'error' && row && (
                      <button
                        onClick={() => retry(row.id)}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-peligro-wash px-2 py-1 text-xs font-extrabold text-peligro"
                      >
                        <CloudOff className="size-3.5" aria-hidden /> Reintentar <RefreshCw className="size-3" aria-hidden />
                      </button>
                    )}
                    {i === 0 && state !== 'error' && (
                      <button
                        onClick={onUndo}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                        aria-label={`Deshacer ${e.name}`}
                        title="Deshacer"
                      >
                        <Undo2 className="size-4" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}
