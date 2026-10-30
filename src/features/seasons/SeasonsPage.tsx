import { AnimatePresence, motion } from 'framer-motion'
import { LuCalendarClock as CalendarClock, LuCheck as Check, LuLoaderCircle as Loader2, LuPackageCheck as PackageCheck, LuPencil as Pencil, LuPlus as Plus } from 'react-icons/lu'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { BOARD, BOARD_COLORS } from '@/lib/colors'
import { describeRule, MONTHS, ORDINAL, WEEKDAYS } from '@/lib/defaults'
import { planSeasons } from '@/lib/forecast'
import { uid } from '@/lib/format'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'
import type { Season } from '@/types'

const dateFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function SeasonsPage() {
  const { status, seasons, products, saveSeason } = useInventory()
  const sales = useSales((s) => s.sales)
  const canManage = useCan('temporadas.gestionar')
  const canSales = useCan('ventas.ver')
  const loadSales = useSales((s) => s.load)
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  useEffect(() => {
    if (canSales) void loadSales()
  }, [canSales, loadSales])

  const plans = useMemo(() => planSeasons(seasons, products, sales), [seasons, products, sales])

  const save = async (s: Season) => {
    try {
      await saveSeason(s)
      toast({ tone: 'ok', text: `Temporada «${s.name}» guardada` })
      setEditing(null)
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar.' })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Temporadas</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
            Las fechas fuertes del año y qué conviene pedir antes. Marca los productos de cada temporada al cargarlos o desde el inventario.
          </p>
        </div>
        {canManage && editing !== 'new' && (
          <Button variant="accent" size="lg" onClick={() => setEditing('new')}>
            <Plus className="size-5" strokeWidth={2.5} aria-hidden /> Nueva temporada
          </Button>
        )}
      </header>

      <AnimatePresence>
        {editing === 'new' && (
          <SeasonForm
            initial={{ id: uid('temp'), name: '', color: 'lila', rule: { type: 'fija', month: 9, day: 21 }, leadDays: 30 }}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      {status !== 'ready' ? (
        <Shimmer className="h-64 rounded-3xl" />
      ) : (
        plans.map((plan) => {
          const s = plan.season
          if (editing === s.id) return <SeasonForm key={s.id} initial={s} onSave={save} onCancel={() => setEditing(null)} />
          const tagged = products.filter((p) => p.seasons.includes(s.id)).length
          const inWindow = plan.days <= s.leadDays
          const units = plan.items.reduce((a, i) => a + i.suggested, 0)
          return (
            <motion.section layout key={s.id} className="overflow-hidden rounded-3xl bg-surface shadow-card">
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
                <div className={clsx('grid size-20 place-items-center rounded-3xl text-center text-on-fill', BOARD[s.color].fill)}>
                  <span className="num text-3xl font-black leading-none">{plan.days}</span>
                  <span className="-mt-3 text-2xs font-black">{plan.days === 1 ? 'día' : 'días'}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black">{s.name}</h2>
                  <p className="text-sm font-semibold capitalize text-ink-soft">{dateFmt.format(plan.date)}</p>
                  <p className="text-xs font-semibold text-ink-soft">
                    Cada año: {describeRule(s.rule)} · avisa {s.leadDays} días antes · {tagged} productos marcados
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-extrabold',
                      !plan.items.length ? 'bg-turquesa-wash text-turquesa-ink' : inWindow ? 'bg-peligro-wash text-peligro' : 'bg-sunken text-ink-soft',
                    )}
                  >
                    {!plan.items.length ? 'Stock suficiente' : inWindow ? `Pedir ahora · ${units} u` : `Faltarían ${units} u`}
                  </span>
                  {canManage && (
                    <button onClick={() => setEditing(s.id)} className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-sunken hover:text-ink" aria-label={`Editar ${s.name}`}>
                      <Pencil className="size-4" />
                    </button>
                  )}
                </div>
              </div>
              {tagged === 0 ? (
                <p className="border-t-2 border-line px-6 py-4 text-sm font-semibold text-ink-soft">
                  Ningún producto está marcado para esta temporada. Márcalos en Carga Rápida (sección Plantilla) o en el cajón del producto.
                </p>
              ) : plan.items.length === 0 ? (
                <p className="flex items-center gap-2 border-t-2 border-line px-6 py-4 text-sm font-bold text-turquesa-ink">
                  <PackageCheck className="size-4" aria-hidden /> Con el stock actual alcanza para la demanda esperada.
                </p>
              ) : (
                <div className="overflow-x-auto border-t-2 border-line">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs font-extrabold text-ink-soft">
                        <th className="px-6 py-2.5">Producto</th>
                        <th className="px-3 py-2.5 text-right">Stock</th>
                        <th className="px-3 py-2.5 text-right">Esperado</th>
                        <th className="px-3 py-2.5 text-right">Pedir</th>
                        <th className="px-6 py-2.5">Según</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {plan.items.slice(0, 15).map((i) => (
                        <tr key={i.product.id}>
                          <td className="px-6 py-2.5 font-bold">
                            <Link to={`/?producto=${i.product.id}`} className="hover:underline">
                              {i.product.name}
                            </Link>
                          </td>
                          <td className="num px-3 py-2.5 text-right">{i.product.stock}</td>
                          <td className="num px-3 py-2.5 text-right">{i.expected}</td>
                          <td className="num px-3 py-2.5 text-right font-black text-peligro">+{i.suggested}</td>
                          <td className="px-6 py-2.5 text-xs font-semibold text-ink-soft">{i.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {plan.items.length > 15 && <p className="px-6 py-2 text-xs font-semibold text-ink-soft">y {plan.items.length - 15} productos más.</p>}
                </div>
              )}
            </motion.section>
          )
        })
      )}
      <p className="flex items-start gap-2 text-xs font-semibold text-ink-soft">
        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
        La cantidad sugerida usa lo vendido el mes previo a esa fecha el año pasado, el ritmo de ventas de los últimos 30 días, o el doble del stock mínimo: lo que sea mayor. Con más ventas registradas, la sugerencia mejora.
      </p>
    </div>
  )
}

function SeasonForm({ initial, onSave, onCancel }: { initial: Season; onSave: (s: Season) => Promise<void>; onCancel: () => void }) {
  const [s, setS] = useState<Season>(initial)
  const [busy, setBusy] = useState(false)
  const rule = s.rule
  const setRule = (patch: Partial<Season['rule']>) => setS((x) => ({ ...x, rule: { ...x.rule, ...patch } as Season['rule'] }))

  return (
    <motion.form
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        await onSave({ ...s, name: s.name.trim() })
        setBusy(false)
      }}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-lift ring-2 ring-sol sm:p-6"
    >
      <h2 className="font-black">{initial.name ? `Editar ${initial.name}` : 'Nueva temporada'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="sf-name">
          <Input id="sf-name" autoFocus value={s.name} onChange={(e) => setS((x) => ({ ...x, name: e.target.value }))} placeholder="Ej.: Vuelta al cole" />
        </Field>
        <Field label="Avisar con anticipación (días)" htmlFor="sf-lead">
          <Input id="sf-lead" inputMode="numeric" className="num" value={s.leadDays} onChange={(e) => setS((x) => ({ ...x, leadDays: Math.max(1, Math.min(180, Number(e.target.value) || 1)) }))} />
        </Field>
        <Field label="La fecha es" htmlFor="sf-type">
          <Select
            id="sf-type"
            value={rule.type}
            onChange={(e) => setS((x) => ({ ...x, rule: e.target.value === 'fija' ? { type: 'fija', month: x.rule.month, day: 1 } : { type: 'nesimo', month: x.rule.month, weekday: 0, n: 1 } }))}
          >
            <option value="fija">Un día fijo (ej.: 25 de diciembre)</option>
            <option value="nesimo">Un día de la semana (ej.: tercer domingo)</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          {rule.type === 'fija' ? (
            <Field label="Día" htmlFor="sf-day">
              <Input id="sf-day" inputMode="numeric" className="num" value={rule.day} onChange={(e) => setRule({ day: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })} />
            </Field>
          ) : (
            <>
              <Field label="Cuál" htmlFor="sf-n">
                <Select id="sf-n" value={rule.n} onChange={(e) => setRule({ n: Number(e.target.value) })}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {ORDINAL[n]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Día" htmlFor="sf-wd">
                <Select id="sf-wd" value={rule.weekday} onChange={(e) => setRule({ weekday: Number(e.target.value) })}>
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field label="Mes" htmlFor="sf-month" className={rule.type === 'fija' ? 'col-span-2' : undefined}>
            <Select id="sf-month" value={rule.month} onChange={(e) => setRule({ month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
      <div role="radiogroup" aria-label="Color" className="flex gap-2">
        {BOARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={s.color === c}
            aria-label={c}
            onClick={() => setS((x) => ({ ...x, color: c }))}
            className={clsx('grid size-9 place-items-center rounded-xl', BOARD[c].fill, s.color === c && 'ring-[3px] ring-ink ring-offset-2 ring-offset-surface')}
          >
            {s.color === c && <Check className="size-4 text-on-fill" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <p className="text-sm font-bold text-ink-soft">Cada año: {describeRule(s.rule)}</p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy || s.name.trim().length < 2}>
          {busy && <Loader2 className="size-4 animate-spin" />} Guardar
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  )
}
