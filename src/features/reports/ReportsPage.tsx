import { LuTriangleAlert as AlertTriangle, LuArrowDownRight as ArrowDownRight, LuArrowUpRight as ArrowUpRight, LuCalendarRange as CalendarRange, LuWallet as Wallet, LuLoaderCircle as Loader2, LuPlus as Plus, LuReceiptText as Receipt, LuTable2 as Table2, LuTarget as Target, LuTrash2 as Trash2, LuTrendingDown as TrendingDown, LuTrendingUp as TrendingUp } from 'react-icons/lu'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { CategoryTag, StockPips } from '@/components/ui/Board'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { BOARD } from '@/lib/colors'
import { formatPrice, stockLevel, uid } from '@/lib/format'
import { balance, breakEven, bucketCount, buckets, bucketsInRange, completed, monthsIn, previousRange, productRanking, type Granularity } from '@/lib/salesStats'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'
import { useChartColors } from './useChartColors'

const G: { id: Granularity; label: string; hint: string }[] = [
  { id: 'dia', label: 'Día', hint: 'últimos 14 días' },
  { id: 'semana', label: 'Semana', hint: 'últimas 12 semanas' },
  { id: 'mes', label: 'Mes', hint: 'últimos 12 meses' },
  { id: 'anio', label: 'Año', hint: 'últimos 5 años' },
]

type Preset = 'recientes' | 'este-mes' | 'mes-pasado' | 'este-anio' | 'anio-pasado' | 'personalizado'
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'recientes', label: 'Recientes' },
  { id: 'este-mes', label: 'Este mes' },
  { id: 'mes-pasado', label: 'Mes pasado' },
  { id: 'este-anio', label: 'Este año' },
  { id: 'anio-pasado', label: 'Año pasado' },
  { id: 'personalizado', label: 'Elegir fechas' },
]
/** Más barras que esto no se leen: esa agrupación se desactiva para el rango. */
const MAX_BARS = 120

const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromInput = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}
const dayFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
/** Texto del rango [from, to) mostrando el último día incluido. */
const rangeText = (from: Date, to: Date) => {
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1)
  return from.getTime() === last.getTime() ? dayFmt.format(from) : `${dayFmt.format(from)} al ${dayFmt.format(last)}`
}

/** Rango [from, to) de un atajo; null en "recientes" (cada agrupación usa sus últimos N períodos). */
function presetRange(p: Preset, now = new Date()): [Date, Date] | null {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (p === 'este-mes') return [new Date(y, m, 1), new Date(y, m + 1, 1)]
  if (p === 'mes-pasado') return [new Date(y, m - 1, 1), new Date(y, m, 1)]
  if (p === 'este-anio') return [new Date(y, 0, 1), new Date(y + 1, 0, 1)]
  if (p === 'anio-pasado') return [new Date(y - 1, 0, 1), new Date(y, 0, 1)]
  return null
}

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`

export default function ReportsPage() {
  const { status, categories, products, settings } = useInventory()
  const { sales, load, status: salesStatus } = useSales()
  const [g, setG] = useState<Granularity>('dia')
  const [preset, setPreset] = useState<Preset>('recientes')
  const [customFrom, setCustomFrom] = useState(() => toInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [customTo, setCustomTo] = useState(() => toInput(new Date()))
  const [tests, setTests] = useState(true)
  const [table, setTable] = useState(false)
  const c = useChartColors()

  useEffect(() => {
    void load(true)
  }, [load])

  // Rango elegido: un atajo o fechas a mano ("hasta" incluye ese día completo).
  const range = useMemo<[Date, Date] | null>(() => {
    if (preset !== 'personalizado') return presetRange(preset)
    const from = fromInput(customFrom)
    const toDay = fromInput(customTo)
    if (!from || !toDay || from > toDay) return null
    return [from, new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1)]
  }, [preset, customFrom, customTo])
  const customError =
    preset === 'personalizado' && !range ? (!fromInput(customFrom) || !fromInput(customTo) ? 'Completa las dos fechas' : '«Desde» es posterior a «Hasta»') : null
  const allowed = (x: Granularity) => !range || bucketCount(x, range[0], range[1]) <= MAX_BARS
  // Si la agrupación elegida daría demasiadas barras para el rango, se usa la siguiente que entre.
  const gEff = allowed(g) ? g : (G.map((x) => x.id).find(allowed) ?? 'anio')

  const done = useMemo(() => completed(sales, tests), [sales, tests])
  const series = useMemo(() => (range ? bucketsInRange(done, gEff, range[0], range[1]) : buckets(done, gEff)), [done, gEff, range])
  const current = series.at(-1)
  const rangeTotal = series.reduce((a, b) => a + b.total, 0)
  const rangeFrom = range ? range[0].getTime() : new Date(series[0]?.key ?? Date.now()).getTime()
  // El final no pasa de hoy: un mes en curso no carga gastos fijos de días que no pasaron.
  const rangeTo = Math.min(range ? range[1].getTime() : Infinity, Date.now() + 1)
  const ranking = useMemo(() => productRanking(done, products, rangeFrom, rangeTo), [done, products, rangeFrom, rangeTo])
  const profit = useMemo(() => {
    const from = new Date(rangeFrom)
    const shownTo = range ? range[1] : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1)
    const [pFrom, pTo] = previousRange(from, shownTo)
    const cur = balance(done, settings, rangeFrom, rangeTo, monthsIn(rangeFrom, rangeTo))
    // El anterior se compara con el mismo tramo transcurrido (ej.: 1 al 15 de este mes vs. 1 al 15 del mes pasado).
    // Si el período ya terminó, se compara completo contra el anterior completo.
    const finished = shownTo.getTime() <= rangeTo
    const prevTo = finished ? pTo.getTime() : Math.min(pTo.getTime(), pFrom.getTime() + (rangeTo - rangeFrom))
    const prev = balance(done, settings, pFrom.getTime(), prevTo, monthsIn(pFrom.getTime(), prevTo))
    return { cur, prev, label: rangeText(from, shownTo), prevLabel: rangeText(pFrom, pTo) }
  }, [done, settings, rangeFrom, rangeTo, range])
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const month = useMemo(() => balance(done, settings, monthStart, Date.now() + 1, 1), [done, settings, monthStart])
  const be = useMemo(() => breakEven(done, products, settings), [done, products, settings])
  const testCount = sales.filter((s) => s.test && s.status === 'completada').length

  if (status !== 'ready' || salesStatus === 'loading')
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
                aria-selected={gEff === x.id}
                disabled={!allowed(x.id)}
                title={allowed(x.id) ? undefined : 'Demasiados períodos para este rango'}
                onClick={() => setG(x.id)}
                className={clsx(
                  'h-9 rounded-xl px-4 text-sm font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  gEff === x.id ? 'bg-surface text-ink shadow-card' : 'text-ink-soft enabled:hover:text-ink',
                )}
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

      <section aria-label="Período" className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
        <span className="flex items-center gap-2 text-sm font-black">
          <CalendarRange className="size-5 text-cielo-ink" aria-hidden /> Período
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={clsx('h-9 rounded-full px-3.5 text-sm font-extrabold transition-colors', preset === p.id ? 'bg-ink text-ground' : 'bg-sunken text-ink-soft hover:text-ink')}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-extrabold text-ink-soft">
              Desde
              <Input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className="h-10 w-auto" aria-invalid={!!customError} />
            </label>
            <label className="flex items-center gap-2 text-xs font-extrabold text-ink-soft">
              Hasta
              <Input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className="h-10 w-auto" aria-invalid={!!customError} />
            </label>
            {customError && (
              <span role="alert" className="text-xs font-extrabold text-peligro">
                {customError}
              </span>
            )}
          </div>
        )}
        <span className="num text-sm font-bold text-ink-soft sm:ml-auto">{range ? profit.label : G.find((x) => x.id === gEff)!.hint}</span>
      </section>

      {/* Indicadores del período */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {range ? (
          <>
            <Stat
              label="Ventas del período"
              value={formatPrice(profit.cur.gross)}
              change={profit.prev.gross > 0 ? ((profit.cur.gross - profit.prev.gross) / profit.prev.gross) * 100 : null}
              sub="Sin ventas en el período anterior"
            />
            <Stat label="Ganancia (margen bruto)" value={formatPrice(profit.cur.margin)} sub="Ventas netas − costo de lo vendido" />
          </>
        ) : (
          <>
            <Stat label={`Ventas · ${G.find((x) => x.id === gEff)!.label.toLowerCase()} actual`} value={formatPrice(current?.total ?? 0)} change={current?.change ?? null} />
            <Stat label="Participación en el rango" value={`${(current?.share ?? 0).toFixed(1)}%`} sub={G.find((x) => x.id === gEff)!.hint} />
          </>
        )}
        <Stat label="Unidades vendidas (rango)" value={String(series.reduce((a, b) => a + b.units, 0))} sub={`${series.reduce((a, b) => a + b.count, 0)} ventas`} />
        <Stat
          label="Ticket promedio (rango)"
          value={formatPrice(series.reduce((a, b) => a + b.count, 0) ? rangeTotal / series.reduce((a, b) => a + b.count, 0) : 0)}
          sub={`Total ${formatPrice(rangeTotal)}`}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">Ventas por {G.find((x) => x.id === gEff)!.label.toLowerCase()}</h2>
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

      <ProfitCard {...profit} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Ranking title="Más vendidos" icon={TrendingUp} rows={ranking.top} empty="Sin ventas en el rango." />
        <Ranking title="Menos vendidos" icon={TrendingDown} rows={ranking.bottom} empty="Sin productos." muted />
      </div>

      <BreakEvenCard be={be} month={month} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
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

/** Ideas de gastos fijos para cargar con un toque. */
const FIXED_COST_IDEAS = ['Alquiler', 'Sueldos', 'Luz', 'Internet', 'Agua', 'Impuestos', 'Contador']

function BreakEvenCard({ be, month }: { be: ReturnType<typeof breakEven>; month: ReturnType<typeof balance> }) {
  const { settings, updateSettings } = useInventory()
  const c = useChartColors()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const costs = settings?.fixedCosts ?? []
  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long' })
  const parsed = Number(amount.replace(/\./g, '').replace(',', '.'))
  const nameErr = tried && !name.trim() ? 'Escribe qué gasto es.' : undefined
  const amountErr = tried && !(parsed > 0) ? 'Escribe cuánto pagas por mes (solo números).' : undefined
  // Atajos para los gastos más comunes que todavía no se cargaron.
  const suggestions = FIXED_COST_IDEAS.filter((idea) => !costs.some((c) => c.name.toLocaleLowerCase('es') === idea.toLocaleLowerCase('es')))
  const pick = (idea: string) => {
    setName(idea)
    setTried(false)
    document.getElementById('fc-amount')?.focus()
  }

  const addCost = async () => {
    const n = parsed
    setTried(true)
    if (!name.trim() || !(n > 0)) return
    setBusy(true)
    try {
      await updateSettings({ fixedCosts: [...costs, { id: uid('gf'), name: name.trim(), amount: n }] })
      setName('')
      setAmount('')
      setTried(false)
      toast({ tone: 'ok', text: `Gasto «${name.trim()}» agregado` })
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid grid-cols-1 gap-5 rounded-3xl bg-surface p-5 shadow-card sm:p-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
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
                : 'Falta el precio de compra de los productos para calcular el margen. Cárgalo en Cargar productos o en el cajón del producto.'
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

      <div className="flex flex-col gap-4 rounded-2xl border-2 border-line p-4 sm:p-5">
        <div>
          <h3 className="flex items-center gap-2 font-black">
            <Receipt className="size-5 text-coral-ink" aria-hidden /> Gastos fijos del mes
          </h3>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            Lo que pagas todos los meses aunque no vendas nada. Con esto se calcula cuánto necesitas vender para no perder plata.
          </p>
        </div>

        {costs.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-line px-4 py-4 text-center text-sm font-semibold text-ink-soft">
            Todavía no cargaste gastos. Empieza tocando uno de abajo o escribe el tuyo.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="divide-y divide-line rounded-xl bg-sunken" aria-label="Gastos cargados">
              {costs.map((fc) => (
                <li key={fc.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-bold">{fc.name}</span>
                  <span className="num shrink-0 font-black">{formatPrice(fc.amount)}</span>
                  <button
                    onClick={() => confirm(`¿Quitar «${fc.name}» de los gastos fijos?`) && void updateSettings({ fixedCosts: costs.filter((x) => x.id !== fc.id) })}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-peligro-wash hover:text-peligro"
                    aria-label={`Quitar ${fc.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-end justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-ground">
              <div>
                <p className="text-xs font-extrabold opacity-80">Total por mes</p>
                <p className="num text-2xl font-black leading-tight">{formatPrice(be.fixed)}</p>
              </div>
              <p className="num pb-1 text-right text-xs font-bold opacity-80">≈ {formatPrice(be.fixed / 30)} por día</p>
            </div>
          </div>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void addCost()
          }}
          className="flex flex-col gap-3 border-t-2 border-line pt-4"
        >
          <p className="text-sm font-black">Agregar un gasto</p>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Gastos comunes">
              {suggestions.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => pick(idea)}
                  aria-pressed={name === idea}
                  className={clsx(
                    'h-8 rounded-full px-3 text-xs font-extrabold transition-colors',
                    name === idea ? 'bg-ink text-ground' : 'bg-sunken text-ink-soft hover:text-ink',
                  )}
                >
                  + {idea}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_10rem]">
            <Field label="¿Qué gasto es?" htmlFor="fc-name" error={nameErr}>
              <Input id="fc-name" placeholder="Ej.: Alquiler del local" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameErr} className="h-11" />
            </Field>
            <Field label="¿Cuánto por mes?" htmlFor="fc-amount" error={amountErr}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-ink-soft" aria-hidden>
                  $
                </span>
                <Input id="fc-amount" placeholder="150.000" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!amountErr} className="num h-11 pl-8" />
              </div>
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} Agregar gasto
          </Button>
        </form>
      </div>
    </section>
  )
}

type BalanceT = ReturnType<typeof balance>

/** Ganancias del rango elegido, al lado del período anterior para comparar. */
function ProfitCard({ cur, prev, label, prevLabel }: { cur: BalanceT; prev: BalanceT; label: string; prevLabel: string }) {
  const rows: [string, keyof BalanceT, 'suma' | 'resta' | 'resultado'][] = [
    ['Ventas con IVA', 'gross', 'suma'],
    ['IVA contenido', 'iva', 'resta'],
    ['Ventas netas', 'net', 'suma'],
    ['Costo de lo vendido', 'cogs', 'resta'],
    ['Ganancia (margen bruto)', 'margin', 'resultado'],
    ['Gastos fijos prorrateados', 'fixed', 'resta'],
    ['Resultado final', 'result', 'resultado'],
  ]
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-black">
          <Wallet className="size-5 text-hoja-ink" aria-hidden /> Ganancias del período
        </h2>
        <p className="num text-sm font-bold text-ink-soft">{label}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs font-extrabold text-ink-soft">
              <th className="py-2">Concepto</th>
              <th className="py-2 text-right">Este período</th>
              <th className="py-2 text-right">
                Anterior <span className="num block font-semibold">{prevLabel}</span>
              </th>
              <th className="py-2 text-right">Variación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([name, key, kind]) => {
              const a = cur[key] as number
              const b = prev[key] as number
              const d = b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null
              // En los costos, subir es malo; en ventas y ganancias, subir es bueno.
              const good = d === null ? null : kind === 'resta' ? d <= 0 : d >= 0
              return (
                <tr key={key}>
                  <td className={clsx('py-2', kind === 'resultado' ? 'font-black' : 'font-bold')}>{kind === 'resta' ? `− ${name}` : name}</td>
                  <td className={clsx('num py-2 text-right', kind === 'resultado' && clsx('font-black', a >= 0 ? 'text-turquesa-ink' : 'text-peligro'))}>{formatPrice(a)}</td>
                  <td className="num py-2 text-right text-ink-soft">{formatPrice(b)}</td>
                  <td className={clsx('num py-2 text-right text-xs font-extrabold', good === null ? 'text-ink-soft' : good ? 'text-turquesa-ink' : 'text-peligro')}>{d === null ? '—' : pct(d)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs font-semibold text-ink-soft">
        Los gastos fijos mensuales se reparten por los días del período que ya pasaron. El período anterior se compara con el mismo tramo de días.
        {cur.netWithoutCost > 0 && <span className="font-bold text-sol-ink"> {formatPrice(cur.netWithoutCost)} de ventas netas son de productos sin precio de compra: no entran en la ganancia.</span>}
      </p>
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
