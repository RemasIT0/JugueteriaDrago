import { AnimatePresence, motion } from 'framer-motion'
import { LuBadgePercent as BadgePercent, LuLoaderCircle as Loader2, LuPause as Pause, LuPlay as Play, LuPlus as Plus, LuTag as Tag, LuTicket as Ticket, LuTrash2 as Trash2 } from 'react-icons/lu'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { formatDate, formatPrice } from '@/lib/format'
import { ProductThumb } from '@/features/inventory/components/ProductThumb'
import type { DiscountInput } from '@/services/commerce'
import { useInventory } from '@/stores/inventory'
import type { Discount } from '@/types'

const KIND_LABEL: Record<Discount['kind'], string> = { producto: 'Juguetes elegidos', categoria: 'Categoría entera', temporada: 'Temporada', cupon: 'Cupón' }
const KIND_HINT: Record<Discount['kind'], string> = {
  producto: 'Elige uno o varios juguetes, de cualquier categoría.',
  categoria: 'Todos los juguetes de una categoría.',
  temporada: 'Todos los juguetes marcados para una temporada.',
  cupon: 'Un código que el cliente escribe al reservar en la tienda.',
}

/** Rangos de edad para filtrar (mismos que la tienda). */
const AGES = [
  { id: '0', label: 'Bebés', test: (a: number) => a <= 2 },
  { id: '3', label: '3 a 5', test: (a: number) => a >= 3 && a <= 5 },
  { id: '6', label: '6 a 8', test: (a: number) => a >= 6 && a <= 8 },
  { id: '9', label: '9 y más', test: (a: number) => a >= 9 },
]

function statusOf(d: Discount, now = Date.now()) {
  if (!d.active) return { label: 'Pausado', cls: 'bg-sunken text-ink-soft' }
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return { label: 'Programado', cls: 'bg-cielo-wash text-cielo-ink' }
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return { label: 'Vencido', cls: 'bg-sunken text-ink-soft' }
  return { label: 'Vigente', cls: 'bg-turquesa-wash text-turquesa-ink' }
}

export default function DiscountsPage() {
  const { discounts, products, categories, seasons, addDiscount, updateDiscount, removeDiscount } = useInventory()
  const [creating, setCreating] = useState(false)

  const productNames = (d: Discount) => {
    const names = (d.targetIds ?? [d.targetId]).map((id) => products.find((p) => p.id === id)?.name).filter(Boolean)
    if (names.length === 0) return undefined
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`
  }

  const targetName = (d: Discount) =>
    d.kind === 'producto'
      ? productNames(d)
      : d.kind === 'categoria'
        ? categories.find((c) => c.id === d.targetId)?.name
        : d.kind === 'temporada'
          ? seasons.find((s) => s.id === d.targetId)?.name
          : `Código ${d.code}`

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn()
      toast({ tone: 'ok', text: ok })
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo completar.' })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Descuentos</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
            Promociones automáticas para juguetes elegidos, una categoría entera o una temporada, y cupones que el cliente escribe al reservar. Si a un juguete le aplican varias promociones, se usa la mayor.
          </p>
        </div>
        {!creating && (
          <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
            <Plus className="size-5" strokeWidth={2.5} aria-hidden /> Nuevo descuento
          </Button>
        )}
      </header>

      <AnimatePresence>
        {creating && <DiscountForm onCancel={() => setCreating(false)} onSave={(v) => run(() => addDiscount(v), `Descuento «${v.name}» creado`).then(() => setCreating(false))} />}
      </AnimatePresence>

      {discounts.length === 0 && !creating ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line px-6 py-14 text-center">
          <BadgePercent className="size-10 text-ink-soft" strokeWidth={1.8} aria-hidden />
          <p className="font-black">No hay descuentos</p>
          <p className="max-w-sm text-sm font-semibold text-ink-soft">Crea uno para que la tienda muestre el precio tachado y el nuevo precio.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {discounts.map((d) => {
            const st = statusOf(d)
            const Icon = d.kind === 'cupon' ? Ticket : Tag
            return (
              <motion.li layout key={d.id} className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-coral text-on-fill">
                    <span className="num text-lg font-black">−{d.percent}%</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black">{d.name}</p>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {d.kind === 'producto' ? `${d.targetIds?.length ?? 1} ${(d.targetIds?.length ?? 1) === 1 ? 'juguete' : 'juguetes'}` : KIND_LABEL[d.kind]}: {targetName(d) ?? '(ya no existe)'}
                      </span>
                    </p>
                  </div>
                  <span className={clsx('shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold', st.cls)}>{st.label}</span>
                </div>
                <p className="num text-xs font-semibold text-ink-soft">
                  {d.startsAt ? `Desde ${formatDate(d.startsAt)}` : 'Desde ya'} · {d.endsAt ? `hasta ${formatDate(d.endsAt)}` : 'sin fecha de fin'}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void run(() => updateDiscount(d.id, { active: !d.active }), d.active ? 'Descuento pausado' : 'Descuento activado')}>
                    {d.active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                    {d.active ? 'Pausar' : 'Activar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="ml-auto"
                    onClick={() => confirm(`¿Eliminar el descuento «${d.name}»?`) && void run(() => removeDiscount(d.id), 'Descuento eliminado')}
                  >
                    <Trash2 className="size-4" aria-hidden /> Eliminar
                  </Button>
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function DiscountForm({ onSave, onCancel }: { onSave: (v: DiscountInput) => Promise<void>; onCancel: () => void }) {
  const { products, categories, seasons } = useInventory()
  const [kind, setKind] = useState<Discount['kind']>('producto')
  const [name, setName] = useState('')
  const [targetId, setTargetId] = useState('')
  const [productIds, setProductIds] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [percent, setPercent] = useState('15')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  // Filtros del buscador de juguetes
  const [fCat, setFCat] = useState('')
  const [fSeason, setFSeason] = useState('')
  const [fAge, setFAge] = useState('')
  const [fStock, setFStock] = useState(false)
  const [onlyChosen, setOnlyChosen] = useState(false)

  const targets = useMemo(() => {
    if (kind === 'categoria') return categories.map((c) => ({ id: c.id, name: c.name }))
    if (kind === 'temporada') return seasons.map((s) => ({ id: s.id, name: s.name }))
    return []
  }, [kind, categories, seasons])

  const matches = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('es')
    const age = AGES.find((a) => a.id === fAge)
    return products
      .filter(
        (p) =>
          (!term || p.name.toLocaleLowerCase('es').includes(term) || p.sku.includes(term) || p.brand.toLocaleLowerCase('es').includes(term)) &&
          (!fCat || p.categoryId === fCat) &&
          (!fSeason || p.seasons.includes(fSeason)) &&
          (!age || age.test(p.ageMin)) &&
          (!fStock || p.stock > 0) &&
          (!onlyChosen || productIds.includes(p.id)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [products, q, fCat, fSeason, fAge, fStock, onlyChosen, productIds])
  const anyFilter = !!(q || fCat || fSeason || fAge || fStock || onlyChosen)
  const clearFilters = () => (setQ(''), setFCat(''), setFSeason(''), setFAge(''), setFStock(false), setOnlyChosen(false))
  const toggle = (id: string) => setProductIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const allShown = matches.length > 0 && matches.every((p) => productIds.includes(p.id))
  const toggleShown = () =>
    setProductIds((ids) => (allShown ? ids.filter((id) => !matches.some((p) => p.id === id)) : [...new Set([...ids, ...matches.map((p) => p.id)])]))

  const pct = Number(percent)
  const hasTarget = kind === 'cupon' ? /^[A-Za-z0-9-]{3,20}$/.test(code) : kind === 'producto' ? productIds.length > 0 : !!targetId
  const valid = name.trim() && pct > 0 && pct <= 90 && hasTarget

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid) return
        setBusy(true)
        await onSave({
          name: name.trim(),
          kind,
          targetId: kind === 'cupon' ? null : kind === 'producto' ? productIds[0] : targetId,
          ...(kind === 'producto' && { targetIds: productIds }),
          code: kind === 'cupon' ? code.toUpperCase() : null,
          percent: pct,
          startsAt: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : null,
          endsAt: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
          active: true,
        })
        setBusy(false)
      }}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-lift ring-2 ring-sol sm:p-6"
    >
      <h2 className="font-black">Nuevo descuento</h2>
      <div role="radiogroup" aria-label="Tipo" className="flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as Discount['kind'][]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => (setKind(k), setTargetId(''))}
            className={clsx('h-10 rounded-full px-4 text-sm font-extrabold transition-colors', kind === k ? 'bg-ink text-ground' : 'bg-sunken text-ink-soft hover:text-ink')}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-sm font-semibold text-ink-soft">{KIND_HINT[kind]}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre interno" htmlFor="df-name">
          <Input id="df-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Peluches de invierno" />
        </Field>
        <Field label="Porcentaje de descuento" htmlFor="df-pct" error={percent && !(pct > 0 && pct <= 90) ? 'Entre 1 y 90' : undefined}>
          <Input id="df-pct" inputMode="numeric" className="num" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </Field>
        {kind === 'cupon' ? (
          <Field label="Código del cupón" htmlFor="df-code" hint="3 a 20 letras o números, sin espacios">
            <Input id="df-code" className="num uppercase" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))} placeholder="DRAGO10" />
          </Field>
        ) : kind === 'producto' ? (
          <div className="flex flex-col gap-3 sm:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="df-q" className="text-sm font-extrabold">
                Juguetes con descuento
              </label>
              <span className="num text-sm font-extrabold text-coral-ink" aria-live="polite">
                {productIds.length} {productIds.length === 1 ? 'elegido' : 'elegidos'}
              </span>
            </div>

            {/* Filtros: se combinan entre sí; «Elegir los mostrados» suma todo lo que se ve */}
            <div className="flex flex-col gap-2 rounded-2xl bg-sunken p-3">
              <Input id="df-q" placeholder="Buscar por nombre, marca o código…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select aria-label="Filtrar por categoría" value={fCat} onChange={(e) => setFCat(e.target.value)} className="h-10">
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Select aria-label="Filtrar por temporada" value={fSeason} onChange={(e) => setFSeason(e.target.value)} className="h-10">
                  <option value="">Todas las temporadas</option>
                  {seasons.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <Select aria-label="Filtrar por edad" value={fAge} onChange={(e) => setFAge(e.target.value)} className="h-10">
                  <option value="">Todas las edades</option>
                  {AGES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                  <input type="checkbox" className="size-4 accent-coral" checked={fStock} onChange={(e) => setFStock(e.target.checked)} /> Solo con stock
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                  <input type="checkbox" className="size-4 accent-coral" checked={onlyChosen} onChange={(e) => setOnlyChosen(e.target.checked)} disabled={productIds.length === 0} /> Ver solo los elegidos
                </label>
                {anyFilter && (
                  <button type="button" onClick={clearFilters} className="text-sm font-extrabold text-ink-soft underline hover:text-ink">
                    Quitar filtros
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="num text-xs font-bold text-ink-soft">
                Mostrando {matches.length} de {products.length}
              </p>
              <div className="flex gap-2">
                {productIds.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => (setProductIds([]), setOnlyChosen(false))}>
                    Quitar todos
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={toggleShown} disabled={matches.length === 0}>
                  {allShown ? `Quitar los ${matches.length} mostrados` : `Elegir los ${matches.length} mostrados`}
                </Button>
              </div>
            </div>

            <ul className="max-h-80 overflow-y-auto rounded-2xl border-2 border-line p-1" aria-label="Juguetes">
              {matches.length === 0 && <li className="px-3 py-6 text-center text-sm font-semibold text-ink-soft">Ningún juguete coincide con estos filtros.</li>}
              {matches.map((p) => {
                const on = productIds.includes(p.id)
                const cat = categories.find((c) => c.id === p.categoryId)
                const after = Math.round(p.price * (1 - (pct > 0 && pct <= 90 ? pct : 0) / 100) * 100) / 100
                return (
                  <li key={p.id}>
                    <label className={clsx('flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2', on ? 'bg-coral-wash' : 'hover:bg-sunken')}>
                      <input type="checkbox" className="size-4 shrink-0 accent-coral" checked={on} onChange={() => toggle(p.id)} />
                      <ProductThumb category={cat} imageUrl={p.photos[0]} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{p.name}</span>
                        <span className="block truncate text-xs font-semibold text-ink-soft">
                          {cat?.name ?? 'Sin categoría'} · <span className="num">{p.sku}</span> · {p.stock > 0 ? `${p.stock} en stock` : 'sin stock'}
                        </span>
                      </span>
                      <span className="num shrink-0 text-right text-xs font-bold leading-tight">
                        {on && pct > 0 && pct <= 90 ? (
                          <>
                            <span className="block text-peligro line-through">{formatPrice(p.price)}</span>
                            <span className="block text-sm font-black text-ink">{formatPrice(after)}</span>
                          </>
                        ) : (
                          <span className="text-sm text-ink-soft">{formatPrice(p.price)}</span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <Field label={`Aplica a (${KIND_LABEL[kind].toLowerCase()})`} htmlFor="df-target">
            <div className="flex flex-col gap-2">
              <Select id="df-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Elegir…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Desde (opcional)" htmlFor="df-from">
            <Input id="df-from" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Hasta (opcional)" htmlFor="df-to">
            <Input id="df-to" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy || !valid}>
          {busy && <Loader2 className="size-4 animate-spin" />} Crear descuento
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  )
}
