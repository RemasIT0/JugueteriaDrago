import { AnimatePresence, motion } from 'framer-motion'
import { LuLoaderCircle as Loader2, LuTrendingUp as TrendingUp } from 'react-icons/lu'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Field, Input, Select } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { BOARD } from '@/lib/colors'
import { formatPrice } from '@/lib/format'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'

const ROUNDINGS = [
  { id: 0, label: 'Sin redondear' },
  { id: 10, label: 'A $10' },
  { id: 100, label: 'A $100' },
  { id: 500, label: 'A $500' },
  { id: 1000, label: 'A $1.000' },
] as const

/** Precio con el % aplicado y redondeado hacia arriba al múltiplo elegido (precios «redondos» de góndola). */
export function raise(price: number, percent: number, step: number) {
  const raw = Math.round(price * (1 + percent / 100) * 100) / 100
  if (!step) return Math.max(0, raw)
  // El −1e-9 evita que un 1100,0000001 por coma flotante salte a 1200.
  return Math.max(0, Math.ceil(raw / step - 1e-9) * step)
}

/**
 * Aumento de precios por porcentaje a muchos productos de una vez (todos, una categoría,
 * una marca o un proveedor), con vista previa, confirmación y «Deshacer».
 */
export function PriceIncreaseDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products, categories, suppliers, setPrices } = useInventory()
  const canCost = useCan('costos.ver')
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [brand, setBrand] = useState('')
  const [supplier, setSupplier] = useState('')
  const [pctText, setPctText] = useState('10')
  const [step, setStep] = useState<number>(100)
  const [withCost, setWithCost] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    // Cada vez arranca limpio: un filtro olvidado de la vez anterior podría aplicarse sin querer.
    setConfirming(false)
    setExcluded(new Set())
    setCats(new Set())
    setBrand('')
    setSupplier('')
    setWithCost(false)
    setPctText('10')
    setStep(100)
  }, [open])

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [products])
  const pct = Number(pctText.replace(',', '.'))
  const pctValid = pctText.trim() !== '' && Number.isFinite(pct) && pct > -90 && pct <= 300 && pct !== 0

  const matching = useMemo(
    () =>
      products
        .filter((p) => !p.syncState)
        .filter((p) => (!cats.size || cats.has(p.categoryId)) && (!brand || p.brand.trim() === brand) && (!supplier || p.supplierId === supplier))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [products, cats, brand, supplier],
  )
  const chosen = matching.filter((p) => !excluded.has(p.id))
  const preview = chosen.map((p) => ({ p, next: pctValid ? raise(p.price, pct, step) : p.price, nextCost: pctValid && withCost && p.cost !== null ? raise(p.cost, pct, 0) : p.cost }))
  const changed = preview.filter((r) => r.next !== r.p.price || (withCost && r.nextCost !== r.p.cost))

  const scopeLabel = [
    cats.size ? [...cats].map((id) => categories.find((c) => c.id === id)?.name).join(', ') : '',
    brand && `marca ${brand}`,
    supplier && `proveedor ${suppliers.find((s) => s.id === supplier)?.name ?? ''}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const note = `${pct > 0 ? '+' : ''}${pct} % a ${scopeLabel || 'todos los productos'}${step ? ` (redondeo a $${step.toLocaleString('es-AR')})` : ''}${withCost ? ', también el costo' : ''}`

  const apply = async () => {
    if (!changed.length) return
    // Lo de antes, para poder deshacer exactamente.
    const before = changed.map(({ p }) => ({ id: p.id, price: p.price, ...(withCost ? { cost: p.cost } : {}) }))
    setBusy(true)
    try {
      await setPrices(
        changed.map(({ p, next, nextCost }) => ({ id: p.id, price: next, ...(withCost ? { cost: nextCost } : {}) })),
        note,
      )
      toast({
        tone: 'ok',
        text: `Precios actualizados: ${note} · ${changed.length} producto${changed.length === 1 ? '' : 's'}`,
        action: {
          label: 'Deshacer',
          run: () =>
            void setPrices(before, `Deshacer: ${note}`)
              .then(() => toast({ tone: 'ok', text: 'Se volvieron a los precios anteriores.' }))
              .catch((e) => toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo deshacer.' })),
        },
      })
      onClose()
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudieron cambiar los precios.' })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const toggleCat = (id: string) =>
    setCats((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <Drawer open={open} onClose={onClose} title="Aumentar precios">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-16 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <TrendingUp className="size-6" aria-hidden /> Aumentar precios
          </h2>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Sube (o baja) por porcentaje los precios de muchos productos de una vez. Revisa la lista antes de aplicar.</p>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="Porcentaje" htmlFor="px-pct" error={pctText.trim() && !pctValid ? 'Entre −89 y 300, distinto de 0' : undefined}>
            <div className="relative">
              <Input id="px-pct" autoFocus inputMode="decimal" className="num pr-9 text-lg" value={pctText} onChange={(e) => (setPctText(e.target.value), setConfirming(false))} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-ink-soft">%</span>
            </div>
          </Field>
          <div className="flex gap-1.5 pb-0.5">
            {[5, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => (setPctText(String(n)), setConfirming(false))}
                aria-pressed={pct === n}
                className={clsx('h-11 rounded-xl border-2 px-2.5 text-sm font-extrabold', pct === n ? 'border-ink bg-ink text-ground' : 'border-line text-ink-soft hover:text-ink')}
              >
                {n}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold text-ink-soft">Redondear el precio nuevo (hacia arriba)</span>
          <div role="radiogroup" aria-label="Redondeo" className="flex flex-wrap gap-1.5">
            {ROUNDINGS.map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={step === r.id}
                onClick={() => (setStep(r.id), setConfirming(false))}
                className={clsx('h-9 rounded-xl border-2 px-2.5 text-sm font-extrabold', step === r.id ? 'border-ink bg-ink text-ground' : 'border-line text-ink-soft hover:text-ink')}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border-2 border-line p-4">
          <p className="font-black">¿A qué productos?</p>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold text-ink-soft">Categorías {cats.size ? `(${cats.size})` : '(todas)'}</span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => (toggleCat(c.id), setConfirming(false))}
                  aria-pressed={cats.has(c.id)}
                  className={clsx(
                    'flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-extrabold',
                    cats.has(c.id) ? 'border-ink bg-ink text-ground' : 'border-line text-ink-soft hover:text-ink',
                  )}
                >
                  <span className={clsx('size-2 rounded-full', BOARD[c.color].fill)} aria-hidden /> {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca" htmlFor="px-brand">
              <Select id="px-brand" value={brand} onChange={(e) => (setBrand(e.target.value), setConfirming(false))}>
                <option value="">Todas</option>
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Proveedor" htmlFor="px-sup">
              <Select id="px-sup" value={supplier} onChange={(e) => (setSupplier(e.target.value), setConfirming(false))}>
                <option value="">Todos</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {canCost && (
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={withCost} onChange={(e) => (setWithCost(e.target.checked), setConfirming(false))} className="mt-0.5 size-5 accent-turquesa" />
              <span className="text-sm">
                <span className="block font-extrabold">Aumentar también el costo</span>
                <span className="font-semibold text-ink-soft">Si el aumento viene del proveedor, así el margen de Reportes sigue siendo real (el costo no se redondea).</span>
              </span>
            </label>
          )}
        </div>

        <section className="flex flex-col gap-2" aria-labelledby="px-prev">
          <div className="flex items-baseline justify-between">
            <h3 id="px-prev" className="font-black">
              Vista previa
            </h3>
            <span className="text-xs font-extrabold text-ink-soft">
              {chosen.length} de {matching.length} producto{matching.length === 1 ? '' : 's'}
            </span>
          </div>
          {matching.length === 0 ? (
            <p className="rounded-2xl bg-sunken px-4 py-6 text-center text-sm font-semibold text-ink-soft">Ningún producto coincide con esa selección.</p>
          ) : (
            <ul className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto rounded-2xl border-2 border-line">
              {matching.map((p) => {
                    const off = excluded.has(p.id)
                    const next = pctValid ? raise(p.price, pct, step) : p.price
                    return (
                      <li key={p.id}>
                        <label className={clsx('flex cursor-pointer items-center gap-3 px-3 py-2', off && 'opacity-50')}>
                          <input
                            type="checkbox"
                            checked={!off}
                            onChange={() =>
                              (setExcluded((s) => {
                                const n = new Set(s)
                                if (n.has(p.id)) n.delete(p.id)
                                else n.add(p.id)
                                return n
                              }),
                              setConfirming(false))
                            }
                            className="size-4 shrink-0 accent-turquesa"
                            aria-label={`Incluir ${p.name}`}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                          <span className="num shrink-0 text-xs font-semibold text-ink-soft line-through">{formatPrice(p.price)}</span>
                          <span className={clsx('num w-28 shrink-0 text-right text-sm font-black', !off && next > p.price ? 'text-turquesa-ink' : !off && next < p.price && 'text-peligro')}>
                            {off ? 'sin cambio' : formatPrice(next)}
                          </span>
                        </label>
                      </li>
                    )
                  })}
            </ul>
          )}
        </section>

        {/* Siempre a la vista al pie del panel, con margen para el borde inferior del celular. */}
        <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-3 border-t-2 border-line bg-surface px-5 pb-6 pt-4 sm:-mx-6 sm:px-6">
          <AnimatePresence initial={false} mode="wait">
            {confirming ? (
              <motion.div key="c" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 rounded-2xl bg-sol-wash p-4">
                <p className="text-sm font-bold text-sol-ink">
                  ¿Aplicar {pct > 0 ? '+' : ''}
                  {pct} % a {changed.length} producto{changed.length === 1 ? '' : 's'}? Se ve al instante en la tienda. Vas a poder deshacerlo desde el aviso.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" autoFocus disabled={busy} onClick={() => void apply()}>
                    {busy && <Loader2 className="size-4 animate-spin" />} Sí, aplicar
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    Volver
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button variant="primary" className="w-full" disabled={!pctValid || !changed.length} onClick={() => setConfirming(true)}>
                  <TrendingUp className="size-4" aria-hidden /> {pctValid ? `Aplicar ${pct > 0 ? '+' : ''}${pct} % a ${changed.length} producto${changed.length === 1 ? '' : 's'}` : 'Escribe el porcentaje'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Drawer>
  )
}
