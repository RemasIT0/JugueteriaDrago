import { LuTriangleAlert as AlertTriangle, LuArrowDownRight as ArrowDownRight, LuArrowUpRight as ArrowUpRight, LuLoaderCircle as Loader2, LuPlus as Plus, LuTable2 as Table2, LuTarget as Target, LuTrash2 as Trash2, LuTrendingDown as TrendingDown, LuTrendingUp as TrendingUp } from 'react-icons/lu'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { CategoryTag, StockPips } from '@/components/ui/Board'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { BOARD } from '@/lib/colors'
import { formatPrice, stockLevel, uid } from '@/lib/format'
import { balance, breakEven, buckets, completed, productRanking, type Granularity } from '@/lib/salesStats'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'
import { useChartColors } from './useChartColors'

const G: { id: Granularity; label: string; hint: string }[] = [
  { id: 'dia', label: 'Día', hint: 'últimos 14 días' },
  { id: 'semana', label: 'Semana', hint: 'últimas 12 semanas' },
  { id: 'mes', label: 'Mes', hint: 'últimos 12 meses' },
  { id: 'anio', label: 'Año', hint: 'últimos 5 años' },
]

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`

export default function ReportsPage() {
  const { status, categories, products, settings } = useInventory()
  const { sales, load, status: salesStatus } = useSales()
  const [g, setG] = useState<Granularity>('dia')
  const [tests, setTests] = useState(true)
  const [table, setTable] = useState(false)
  const c = useChartColors()

  useEffect(() => {
    void load(true)
  }, [load])

  const done = useMemo(() => completed(sales, tests), [sales, tests])
  const series = useMemo(() => buckets(done, g), [done, g])
  const current = series.at(-1)
  const rangeTotal = series.reduce((a, b) => a + b.total, 0)
  const rangeFrom = new Date(series[0]?.key ?? Date.now()).getTime()
  const ranking = useMemo(() => productRanking(done, products, rangeFrom), [done, products, rangeFrom])
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const month = useMemo(() => balance(done, settings, monthStart, Date.now() + 1, 1), [done, settings, monthStart])
  const be = useMemo(() => breakEven(done, products, settings), [done, products, settings])
  const testCount = sales.filter((s) => s.test && s.status === 'completada').length

  if (status !== 'ready' || salesStatus === 'loading')
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Shimmer className="h-80 rounded-3xl" />
        <Shimmer className="h-80 rounded-3xl" />
      </div>
    )

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Reportes</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Ventas, productos que más y menos salen, balance del mes y punto de equilibrio.</p>
        </div>
        {/* Filtros en una sola fila, arriba de los gráficos. */}
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Agrupar por" className="flex rounded-2xl bg-sunken p-1">
            {G.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={g === x.id}
                onClick={() => setG(x.id)}
                className={clsx('h-9 rounded-xl px-4 text-sm font-extrabold transition-colors', g === x.id ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink')}
              >
                {x.label}
              </button>
            ))}
          </div>
          {testCount > 0 && (
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-sunken px-3 text-sm font-extrabold text-ink-soft">
              <input type="checkbox" checked={tests} onChange={(e) => setTests(e.target.checked)} className="size-4 accent-[rgb(var(--turquesa))]" />
              Incluir {testCount} compras de prueba
            </label>
          )}
        </div>
      </header>

      {/* Indicadores del período actual */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Ventas · ${G.find((x) => x.id === g)!.label.toLowerCase()} actual`} value={formatPrice(current?.total ?? 0)} change={current?.change ?? null} />
        <Stat label="Participación en el rango" value={`${(current?.share ?? 0).toFixed(1)}%`} sub={G.find((x) => x.id === g)!.hint} />
        <Stat label="Unidades vendidas (rango)" value={String(series.reduce((a, b) => a + b.units, 0))} sub={`${series.reduce((a, b) => a + b.count, 0)} ventas`} />
        <Stat
          label="Ticket promedio (rango)"
          value={formatPrice(series.reduce((a, b) => a + b.count, 0) ? rangeTotal / series.reduce((a, b) => a + b.count, 0) : 0)}
          sub={`Total ${formatPrice(rangeTotal)}`}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">Ventas por {G.find((x) => x.id === g)!.label.toLowerCase()}</h2>
          <button onClick={() => setTable((t) => !t)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-extrabold text-ink-soft hover:bg-sunken hover:text-ink" aria-pressed={table}>
            <Table2 className="size-4" aria-hidden /> {table ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        </div>
        {rangeTotal === 0 ? (
          <Empty text="Todavía no hay ventas en este rango. Las ventas de la tienda y las compras de prueba aparecen acá." />
        ) : table ? (
          <PeriodTable rows={series} />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 12, fontWeight: 700 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: c.axis, fontSize: 12, fontWeight: 700 }} tickFormatter={(v: number) => `$${compact.format(v)}`} />
                <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} content={<PeriodTooltip />} />
                <Bar dataKey="total" name="Ventas" fill={c.series} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Ranking title="Más vendidos" icon={TrendingUp} rows={ranking.top} empty="Sin ventas en el rango." />
        <Ranking title="Menos vendidos" icon={TrendingDown} rows={ranking.bottom} empty="Sin productos." muted />
      </div>

      <BreakEvenCard be={be} month={month} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <StockValue />
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 font-black">
            <AlertTriangle className="size-5 text-peligro" strokeWidth={2.5} aria-hidden /> Para reponer
          </h2>
          <LowStock categories={categories} />
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, change, sub }: { label: string; value: string; change?: number | null; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl bg-surface p-5 shadow-card">
      <p className="text-xs font-extrabold text-ink-soft">{label}</p>
      <p className="num text-2xl font-black tracking-tight">{value}</p>
      {change !== undefined && change !== null ? (
        <p className={clsx('num flex items-center gap-1 text-xs font-extrabold', change >= 0 ? 'text-turquesa-ink' : 'text-peligro')}>
          {change >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
          {pct(change)} vs. período anterior
        </p>
      ) : (
        sub && <p className="num text-xs font-semibold text-ink-soft">{sub}</p>
      )}
    </div>
  )
}

function PeriodTooltip({ active, payload }: { active?: boolean; payload?: { payload: ReturnType<typeof buckets>[number] }[] }) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs font-bold text-ground shadow-lift">
      <p className="font-black">{b.label}</p>
      <p className="num">{formatPrice(b.total)}</p>
      <p className="num opacity-80">
        {b.share.toFixed(1)}% del rango · {b.units} u · {b.count} ventas
      </p>
      {b.change !== null && <p className="num opacity-80">{pct(b.change)} vs. anterior</p>}
    </div>
  )
}

function PeriodTable({ rows }: { rows: ReturnType<typeof buckets> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="text-left text-xs font-extrabold text-ink-soft">
            <th className="py-2">Período</th>
            <th className="py-2 text-right">Ventas</th>
            <th className="py-2 text-right">% del rango</th>
            <th className="py-2 text-right">vs. anterior</th>
            <th className="py-2 text-right">Unidades</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2 font-bold">{r.label}</td>
              <td className="num py-2 text-right">{formatPrice(r.total)}</td>
              <td className="num py-2 text-right">{r.share.toFixed(1)}%</td>
              <td className={clsx('num py-2 text-right', r.change === null ? 'text-ink-soft' : r.change >= 0 ? 'text-turquesa-ink' : 'text-peligro')}>{r.change === null ? '—' : pct(r.change)}</td>
              <td className="num py-2 text-right">{r.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Ranking({ title, icon: Icon, rows, empty, muted }: { title: string; icon: typeof TrendingUp; rows: { id: string; name: string; units: number; revenue: number }[]; empty: string; muted?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.units))
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 font-black">
        <Icon className={clsx('size-5', muted ? 'text-peligro' : 'text-turquesa-ink')} aria-hidden /> {title}
      </h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm font-bold text-ink-soft">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <li key={r.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
              <span className="num text-sm font-black text-ink-soft">{i + 1}</span>
              <span className="truncate text-sm font-extrabold">{r.name}</span>
              <span className="num text-sm font-black">{r.units} u</span>
              <span />
              <span className="h-2.5 overflow-hidden rounded-full bg-sunken">
                <span className={clsx('block h-full rounded-full', muted ? 'bg-peligro/70' : 'bg-turquesa')} style={{ width: `${Math.max(r.units ? 4 : 0, (r.units / max) * 100)}%` }} />
              </span>
              <span className="num text-xs font-semibold text-ink-soft">{formatPrice(r.revenue)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function BreakEvenCard({ be, month }: { be: ReturnType<typeof breakEven>; month: ReturnType<typeof balance> }) {
  const { settings, updateSettings } = useInventory()
  const c = useChartColors()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const costs = settings?.fixedCosts ?? []
  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long' })

  const addCost = async () => {
    const n = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (!name.trim() || !(n > 0)) return
    setBusy(true)
    try {
      await updateSettings({ fixedCosts: [...costs, { id: uid('gf'), name: name.trim(), amount: n }] })
      setName('')
      setAmount('')
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid gap-5 rounded-3xl bg-surface p-5 shadow-card sm:p-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-black">
            <Target className="size-5 text-coral-ink" aria-hidden /> Punto de equilibrio · {monthName}
          </h2>
          {be.target !== null && <p className="num text-sm font-bold text-ink-soft">Objetivo {formatPrice(be.target)}</p>}
        </div>
        {be.target === null ? (
          <Empty
            text={
              be.fixed === 0
                ? 'Carga tus gastos fijos del mes (a la derecha) para calcular cuánto necesitas vender para no perder plata.'
                : 'Falta el precio de compra de los productos para calcular el margen. Cárgalo en Carga Rápida o en el cajón del producto.'
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="h-4 overflow-hidden rounded-full bg-sunken">
                <div className={clsx('h-full rounded-full', (be.progress ?? 0) >= 1 ? 'bg-turquesa' : 'bg-sol')} style={{ width: `${Math.min(100, (be.progress ?? 0) * 100)}%` }} />
              </div>
              <p className="num text-sm font-extrabold">
                {formatPrice(be.soldThisMonth)} vendidos · {((be.progress ?? 0) * 100).toFixed(0)}% del equilibrio
                {(be.progress ?? 0) >= 1 ? ' · ¡ya cubriste los gastos fijos!' : ` · faltan ${formatPrice(be.target - be.soldThisMonth)}`}
              </p>
              <p className="text-xs font-semibold text-ink-soft">
                Margen de contribución {((be.ratio ?? 0) * 100).toFixed(0)}% ({be.source === 'ventas' ? 'según ventas de los últimos 90 días' : 'estimado con precios y costos del catálogo'}).
              </p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={be.daily} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 12, fontWeight: 700 }} />
                  <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: c.axis, fontSize: 12, fontWeight: 700 }} tickFormatter={(v: number) => `$${compact.format(v)}`} />
                  <Tooltip
                    cursor={{ stroke: c.axis, strokeDasharray: '3 3' }}
                    formatter={(v: number) => [formatPrice(v), 'Vendido acumulado']}
                    labelFormatter={(d) => `Día ${d}`}
                    contentStyle={{ background: c.ink, border: 'none', borderRadius: 12, color: c.surface, fontWeight: 700 }}
                    itemStyle={{ color: c.surface }}
                    labelStyle={{ color: c.surface }}
                  />
                  <ReferenceLine y={be.target} stroke={c.target} strokeDasharray="6 4" strokeWidth={2} label={{ value: 'Equilibrio', position: 'insideTopRight', fill: c.target, fontSize: 12, fontWeight: 800 }} />
                  <Line type="monotone" dataKey="acumulado" stroke={c.series} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-sunken p-4 text-sm sm:grid-cols-3">
          {[
            ['Ventas con IVA', month.gross],
            ['IVA contenido', month.iva],
            ['Ventas netas', month.net],
            ['Costo de lo vendido', month.cogs],
            ['Margen bruto', month.margin],
            ['Resultado (− gastos fijos)', month.result],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs font-extrabold text-ink-soft">{k}</dt>
              <dd className={clsx('num font-black', k === 'Resultado (− gastos fijos)' && ((v as number) >= 0 ? 'text-turquesa-ink' : 'text-peligro'))}>{formatPrice(v as number)}</dd>
            </div>
          ))}
        </dl>
        {month.netWithoutCost > 0 && (
          <p className="text-xs font-bold text-sol-ink">{formatPrice(month.netWithoutCost)} de ventas netas son de productos sin precio de compra: no entran en el margen.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-black">Gastos fijos del mes</h3>
        <ul className="divide-y divide-line rounded-2xl border-2 border-line">
          {costs.length === 0 && <li className="px-4 py-4 text-sm font-semibold text-ink-soft">Alquiler, sueldos, luz, internet…</li>}
          {costs.map((fc) => (
            <li key={fc.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1 font-bold">{fc.name}</span>
              <span className="num font-black">{formatPrice(fc.amount)}</span>
              <button
                onClick={() => void updateSettings({ fixedCosts: costs.filter((x) => x.id !== fc.id) })}
                className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-peligro-wash hover:text-peligro"
                aria-label={`Quitar ${fc.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {costs.length > 0 && (
            <li className="flex items-center justify-between px-4 py-2.5 text-sm font-black">
              Total <span className="num">{formatPrice(be.fixed)}</span>
            </li>
          )}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void addCost()
          }}
          className="flex gap-2"
        >
          <Input aria-label="Concepto" placeholder="Concepto" value={name} onChange={(e) => setName(e.target.value)} className="h-10 flex-1" />
          <Input aria-label="Monto mensual" placeholder="Monto" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="num h-10 w-28" />
          <Button type="submit" size="sm" variant="primary" className="h-10" disabled={busy} aria-label="Agregar gasto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </form>
      </div>
    </section>
  )
}

function StockValue() {
  const { categories, products } = useInventory()
  const rows = categories
    .map((cat) => {
      const own = products.filter((p) => p.categoryId === cat.id)
      return { cat, units: own.reduce((a, p) => a + p.stock, 0), value: own.reduce((a, p) => a + p.stock * p.price, 0), cost: own.reduce((a, p) => a + p.stock * (p.cost ?? 0), 0) }
    })
    .sort((a, b) => b.value - a.value)
  const total = rows.reduce((a, r) => a + r.value, 0)
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-black">Stock valorizado por categoría</h2>
        <p className="num text-sm font-bold text-ink-soft">{formatPrice(total)} a precio de venta</p>
      </div>
      <ul className="flex flex-col gap-3.5">
        {rows.map(({ cat, units, value, cost }) => (
          <li key={cat.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_7.5rem]">
            <span className="truncate text-sm font-extrabold">{cat.name}</span>
            <div className="h-6 overflow-hidden rounded-lg bg-sunken">
              <div className={clsx('h-full rounded-lg', BOARD[cat.color].fill)} style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <span className="num col-start-2 text-xs font-bold text-ink-soft sm:col-start-auto sm:text-right sm:text-sm sm:text-ink">
              {formatPrice(value)} · {total ? ((value / total) * 100).toFixed(0) : 0}%
              <span className="block text-2xs text-ink-soft">
                {units} u{cost > 0 && ` · costo ${formatPrice(cost)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function LowStock({ categories }: { categories: ReturnType<typeof useInventory.getState>['categories'] }) {
  const products = useInventory((s) => s.products)
  const low = products.filter((p) => stockLevel(p) === 'bajo').sort((a, b) => a.stock - b.stock)
  if (!low.length) return <p className="py-8 text-center text-sm font-bold text-ink-soft">Ningún producto está por debajo de su mínimo.</p>
  return (
    <ul className="divide-y divide-line">
      {low.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{p.name}</p>
            <CategoryTag category={categories.find((c) => c.id === p.categoryId)} size="xs" />
          </div>
          <span className="num text-sm font-bold text-ink-soft">
            <span className="font-black text-peligro">{p.stock}</span> / mín {p.minStock}
          </span>
          <StockPips product={p} />
        </li>
      ))}
    </ul>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-sunken px-5 py-10 text-center text-sm font-bold text-ink-soft">{text}</p>
}
