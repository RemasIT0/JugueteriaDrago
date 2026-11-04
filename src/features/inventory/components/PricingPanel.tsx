import { LuCheck, LuLoaderCircle, LuPencil, LuTag } from 'react-icons/lu'
import { useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { BOARD } from '@/lib/colors'
import { formatPrice } from '@/lib/format'
import { marginFor, priceFor, realMargin, recommendedPrice } from '@/lib/pricing'
import { parseAmount } from '@/features/quick-add/importFile'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import type { ProductRow } from '@/types'

/** Precio de compra, margen, recomendado, promoción vigente y temporadas del producto. */
export function PricingPanel({ product }: { product: ProductRow }) {
  const { categories, settings, seasons, discounts, update } = useInventory()
  const canCost = useCan('costos.ver')
  const canEdit = useCan('categorias.editar') // el dueño edita precios
  const canTag = useCan('productos.crear')
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(String(product.price))
  const [cost, setCost] = useState(product.cost === null ? '' : String(product.cost))
  const [busy, setBusy] = useState(false)

  const cat = categories.find((c) => c.id === product.categoryId)
  const margin = marginFor(cat, settings)
  const rec = recommendedPrice(product.cost, margin)
  const real = realMargin(product.price, product.cost)
  const promo = priceFor(product, discounts)

  const save = async () => {
    const p = parseAmount(price)
    const c = cost.trim() === '' ? null : parseAmount(cost)
    if (!Number.isFinite(p) || p < 0 || (c !== null && (!Number.isFinite(c) || c < 0))) return toast({ tone: 'error', text: 'Revisa los montos.' })
    setBusy(true)
    try {
      await update(product.id, { price: p, cost: c })
      toast({ tone: 'ok', text: 'Precios actualizados' })
      setEditing(false)
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar.' })
    } finally {
      setBusy(false)
    }
  }

  const toggleSeason = (id: string) => {
    const next = product.seasons.includes(id) ? product.seasons.filter((s) => s !== id) : [...product.seasons, id]
    void update(product.id, { seasons: next }).catch((e) => toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar.' }))
  }

  return (
    <section className="flex flex-col gap-3">
      {promo.percent > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-coral-wash px-4 py-2.5 text-sm font-bold text-coral-ink">
          <LuTag className="size-4" aria-hidden /> Promoción «{promo.discount?.name}»: −{promo.percent}% · en la tienda sale {formatPrice(promo.final)}
        </p>
      )}
      {canCost && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-line p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black">Precios</h3>
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-extrabold text-ink-soft hover:bg-sunken hover:text-ink">
                <LuPencil className="size-3.5" aria-hidden /> Editar
              </button>
            )}
          </div>
          {editing ? (
            <form onSubmit={(e) => (e.preventDefault(), void save())} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-extrabold text-ink-soft">
                  Precio de compra
                  <Input inputMode="decimal" className="num h-11" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Sin cargar" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-extrabold text-ink-soft">
                  Precio de venta
                  <Input inputMode="decimal" className="num h-11" value={price} onChange={(e) => setPrice(e.target.value)} />
                </label>
              </div>
              {Number.isFinite(parseAmount(cost)) && (
                <button
                  type="button"
                  onClick={() => setPrice(String(recommendedPrice(parseAmount(cost), margin)))}
                  className="num self-start text-sm font-extrabold text-turquesa-ink underline decoration-dotted underline-offset-2"
                >
                  Usar recomendado {formatPrice(recommendedPrice(parseAmount(cost), margin) ?? 0)} (+{margin}%)
                </button>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="primary" disabled={busy}>
                  {busy && <LuLoaderCircle className="size-4 animate-spin" />} Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs font-extrabold text-ink-soft">Compra</dt>
                <dd className="num font-black">{product.cost === null ? <span className="text-sol-ink">Sin cargar</span> : formatPrice(product.cost)}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold text-ink-soft">Margen real</dt>
                <dd className={clsx('num font-black', real !== null && real < 20 && 'text-peligro')}>{real === null ? '—' : `${real.toFixed(0)}%`}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold text-ink-soft">Recomendado</dt>
                <dd className="num font-black">{rec === null ? '—' : formatPrice(rec)}</dd>
              </div>
            </dl>
          )}
        </div>
      )}
      {seasons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-ink-soft">Temporadas</span>
          {seasons.map((s) => {
            const on = product.seasons.includes(s.id)
            return (
              <button
                key={s.id}
                disabled={!canTag || !!product.syncState}
                aria-pressed={on}
                onClick={() => toggleSeason(s.id)}
                className={clsx('flex h-8 items-center gap-1 rounded-full px-3 text-xs font-extrabold transition-colors disabled:cursor-default', on ? clsx(BOARD[s.color].fill, 'text-on-fill') : 'bg-sunken text-ink-soft hover:text-ink')}
              >
                {on && <LuCheck className="size-3.5" strokeWidth={3} aria-hidden />}
                {s.name}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
