import { AnimatePresence, motion } from 'framer-motion'
import { LuBadgePercent as BadgePercent, LuLoaderCircle as Loader2, LuPause as Pause, LuPlay as Play, LuPlus as Plus, LuTag as Tag, LuTicket as Ticket, LuTrash2 as Trash2 } from 'react-icons/lu'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { formatDate } from '@/lib/format'
import type { DiscountInput } from '@/services/commerce'
import { useInventory } from '@/stores/inventory'
import type { Discount } from '@/types'

const KIND_LABEL: Record<Discount['kind'], string> = { producto: 'Producto', categoria: 'Categoría', temporada: 'Temporada', cupon: 'Cupón' }

function statusOf(d: Discount, now = Date.now()) {
  if (!d.active) return { label: 'Pausado', cls: 'bg-sunken text-ink-soft' }
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return { label: 'Programado', cls: 'bg-cielo-wash text-cielo-ink' }
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return { label: 'Vencido', cls: 'bg-sunken text-ink-soft' }
  return { label: 'Vigente', cls: 'bg-turquesa-wash text-turquesa-ink' }
}

export default function DiscountsPage() {
  const { discounts, products, categories, seasons, addDiscount, updateDiscount, removeDiscount } = useInventory()
  const [creating, setCreating] = useState(false)

  const targetName = (d: Discount) =>
    d.kind === 'producto'
      ? products.find((p) => p.id === d.targetId)?.name
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
            Promociones automáticas por producto, categoría o temporada, y cupones que el cliente escribe al pagar. Si a un producto le aplican varias promociones, se usa la mayor.
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
                      <Icon className="size-4" aria-hidden /> {KIND_LABEL[d.kind]}: {targetName(d) ?? '(ya no existe)'}
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
  const [kind, setKind] = useState<Discount['kind']>('categoria')
  const [name, setName] = useState('')
  const [targetId, setTargetId] = useState('')
  const [code, setCode] = useState('')
  const [percent, setPercent] = useState('15')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')

  const targets = useMemo(() => {
    if (kind === 'categoria') return categories.map((c) => ({ id: c.id, name: c.name }))
    if (kind === 'temporada') return seasons.map((s) => ({ id: s.id, name: s.name }))
    if (kind === 'producto')
      return products
        .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.includes(q))
        .slice(0, 60)
        .map((p) => ({ id: p.id, name: `${p.name} · ${p.sku}` }))
    return []
  }, [kind, categories, seasons, products, q])

  const pct = Number(percent)
  const valid = name.trim() && pct > 0 && pct <= 90 && (kind === 'cupon' ? /^[A-Za-z0-9-]{3,20}$/.test(code) : !!targetId)

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
          targetId: kind === 'cupon' ? null : targetId,
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
        ) : (
          <Field label={`Aplica a (${KIND_LABEL[kind].toLowerCase()})`} htmlFor="df-target">
            <div className="flex flex-col gap-2">
              {kind === 'producto' && <Input placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10" />}
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
