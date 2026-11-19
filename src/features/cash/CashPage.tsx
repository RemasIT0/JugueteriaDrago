import { AnimatePresence, motion } from 'framer-motion'
import { LuCheck as Check, LuLoaderCircle as Loader2, LuPrinter as Printer, LuRefreshCw as Refresh, LuWallet as Wallet } from 'react-icons/lu'
import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { formatDate, formatPrice, formatTime } from '@/lib/format'
import { round2 } from '@/lib/pricing'
import { cashApi } from '@/services/commerce'
import { paymentLabel } from '@/features/billing/invoiceHtml'
import { onExternalChange } from '@/services/localDb'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import type { CashClosing, CashStatus } from '@/types'
import { openPrintable } from '@/lib/print'

/** "12.500,50" o "12500.5" → número; vacío o inválido → NaN. */
const money = (v: string) => {
  const t = v.trim().replace(/\$/g, '').replace(/\s/g, '')
  if (!t) return NaN
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : NaN
}
const diffText = (d: number) => (Math.abs(d) < 0.005 ? 'Sin diferencia' : d > 0 ? `Sobran ${formatPrice(d)}` : `Faltan ${formatPrice(-d)}`)
const diffTone = (d: number) => (Math.abs(d) < 0.005 ? 'text-turquesa-ink' : d > 0 ? 'text-sol-ink' : 'text-peligro')

/** Cierre de caja: cuánto entró por cada medio desde el último cierre, y el arqueo del efectivo. */
export default function CashPage() {
  const canHistory = useCan('caja.historial')
  const settings = useInventory((s) => s.settings)
  const [status, setStatus] = useState<CashStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<CashClosing[] | null>(null)
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [kept, setKept] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState<CashClosing | null>(null)

  const load = useCallback(async () => {
    try {
      const st = await cashApi.status()
      setStatus(st)
      setError(null)
      setOpening((o) => (o === '' ? String(st.openingCash) : o))
      setKept((k) => (k === '' ? String(st.openingCash) : k))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la caja.')
    }
    if (canHistory) cashApi.list().then(setHistory).catch(() => setHistory([]))
  }, [canHistory])

  useEffect(() => {
    void load()
    // Una venta en otra caja o pestaña actualiza los números.
    return onExternalChange((t) => t === 'sales' && void load())
  }, [load])

  const op = money(opening)
  const co = money(counted)
  const ke = money(kept)
  const expected = status && !Number.isNaN(op) ? round2(op + status.cashNet) : null
  const diff = expected !== null && !Number.isNaN(co) ? round2(co - expected) : null
  const withdraw = !Number.isNaN(co) && !Number.isNaN(ke) ? round2(co - ke) : null
  const total = status ? round2(status.byMethod.reduce((a, m) => a + m.amount, 0)) : 0
  const valid = !Number.isNaN(op) && op >= 0 && !Number.isNaN(co) && co >= 0 && !Number.isNaN(ke) && ke >= 0 && ke <= co

  const close = async () => {
    if (!valid) return
    setBusy(true)
    try {
      const c = await cashApi.close(op, co, ke, note)
      setClosed(c)
      setCounted('')
      setNote('')
      setOpening(String(c.keptCash))
      setKept(String(c.keptCash))
      toast({ tone: 'ok', text: `Caja cerrada · ${diffText(c.difference)}` })
      await load()
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo cerrar la caja.' })
    } finally {
      setBusy(false)
    }
  }

  const print = (c: CashClosing) => {
    if (!openPrintable(closingHtml(c, settings?.business.name || 'DragoToY'), 'width=560,height=760'))
      toast({ tone: 'error', text: 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.' })
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Cierre de caja</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
            Lo que entró y salió por cada medio de pago desde el último cierre. Cuenta el efectivo del cajón y el sistema te dice si sobra o falta.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <Refresh className="size-4" aria-hidden /> Actualizar
        </Button>
      </header>

      <AnimatePresence initial={false}>
        {closed && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-turquesa-wash px-4 py-3">
            <Check className="size-5 text-turquesa-ink" strokeWidth={3} aria-hidden />
            <p className="flex-1 text-sm font-bold text-turquesa-ink">
              Caja cerrada a las {formatTime(closed.closedAt)} · {diffText(closed.difference)} · retiras {formatPrice(round2(closed.countedCash - closed.keptCash))} y quedan {formatPrice(closed.keptCash)} de fondo.
            </p>
            <Button size="sm" variant="secondary" onClick={() => print(closed)}>
              <Printer className="size-4" aria-hidden /> Imprimir cierre
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-14 text-center shadow-card">
          <Wallet className="size-10 text-peligro" strokeWidth={1.8} aria-hidden />
          <p className="font-black">No se pudo cargar la caja</p>
          <p className="max-w-md text-sm font-semibold text-ink-soft">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : !status ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Shimmer className="h-72 rounded-3xl" />
          <Shimmer className="h-72 rounded-3xl" />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card" aria-labelledby="turno">
            <div>
              <h2 id="turno" className="font-black">
                Turno abierto
              </h2>
              <p className="text-sm font-semibold text-ink-soft">
                Desde el {formatDate(status.from)} a las {formatTime(status.from)}
                {status.lastClosedBy ? ` (último cierre: ${status.lastClosedBy})` : ' (comienzo del día)'}
              </p>
            </div>
            {status.byMethod.length === 0 ? (
              <p className="rounded-2xl bg-sunken px-4 py-8 text-center text-sm font-semibold text-ink-soft">Todavía no hubo movimientos en este turno.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-extrabold text-ink-soft">
                    <th className="pb-2 font-extrabold">Medio</th>
                    <th className="pb-2 text-right font-extrabold">Ventas</th>
                    <th className="pb-2 text-right font-extrabold">Devol.</th>
                    <th className="pb-2 text-right font-extrabold">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {status.byMethod.map((m) => (
                    <tr key={m.method}>
                      <td className="py-2.5 font-extrabold">{paymentLabel(m.method)}</td>
                      <td className="num py-2.5 text-right">{m.sales}</td>
                      <td className="num py-2.5 text-right">{m.refunds + m.voids || '—'}</td>
                      <td className={clsx('num py-2.5 text-right font-black', m.amount < 0 && 'text-peligro')}>{formatPrice(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line">
                    <td className="pt-2.5 font-black" colSpan={3}>
                      Total del turno
                    </td>
                    <td className="num pt-2.5 text-right text-lg font-black">{formatPrice(total)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            <p className="text-xs font-semibold text-ink-soft">
              Débito, crédito, transferencia y Mercado Pago se controlan contra el resumen de cada uno. Las compras de prueba no cuentan.
            </p>
          </section>

          <form
            onSubmit={(e) => (e.preventDefault(), void close())}
            className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card"
            aria-labelledby="arqueo"
          >
            <h2 id="arqueo" className="font-black">
              Arqueo del efectivo
            </h2>
            <Field label="Fondo con el que abrió la caja" htmlFor="cj-open" hint="Lo que se dejó en el último cierre">
              <Input id="cj-open" inputMode="decimal" className="num" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </Field>
            <div className="flex items-baseline justify-between rounded-2xl bg-sunken px-4 py-3">
              <span className="text-sm font-extrabold text-ink-soft">Debería haber en el cajón</span>
              <span className="num text-2xl font-black">{expected !== null ? formatPrice(expected) : '—'}</span>
            </div>
            <Field label="Efectivo contado" htmlFor="cj-count">
              <Input id="cj-count" inputMode="decimal" className="num" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Cuenta billetes y monedas" />
            </Field>
            {diff !== null && (
              <p className={clsx('num rounded-2xl px-4 py-3 text-lg font-black', Math.abs(diff) < 0.005 ? 'bg-turquesa-wash' : diff > 0 ? 'bg-sol-wash' : 'bg-peligro-wash', diffTone(diff))} role="status">
                {diffText(diff)}
              </p>
            )}
            <Field label="Queda en caja para el próximo turno" htmlFor="cj-kept" error={!Number.isNaN(ke) && !Number.isNaN(co) && ke > co ? 'No puede ser más que lo contado' : undefined}>
              <Input id="cj-kept" inputMode="decimal" className="num" value={kept} onChange={(e) => setKept(e.target.value)} />
            </Field>
            {withdraw !== null && withdraw >= 0 && <p className="text-sm font-bold text-ink-soft">Se retira: <span className="num text-ink">{formatPrice(withdraw)}</span></p>}
            <Field label="Nota (opcional)" htmlFor="cj-note">
              <Input id="cj-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: faltante por vuelto mal dado" />
            </Field>
            <Button type="submit" variant="primary" className="h-12" disabled={busy || !valid}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Wallet className="size-5" aria-hidden />} Cerrar caja
            </Button>
          </form>
        </div>
      )}

      {canHistory && !error && (
        <section className="flex flex-col gap-3" aria-labelledby="historial">
          <h2 id="historial" className="text-lg font-black">
            Cierres anteriores
          </h2>
          <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
            {!history ? (
              <div className="p-5">
                <Shimmer className="h-12 rounded-xl" />
              </div>
            ) : history.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm font-semibold text-ink-soft">Todavía no se cerró la caja.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((c) => (
                  <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_9rem_auto]">
                    <span className="num text-sm font-extrabold">
                      {formatDate(c.closedAt)} {formatTime(c.closedAt)}
                    </span>
                    <span className={clsx('num text-right text-sm font-black sm:order-3', diffTone(c.difference))}>{diffText(c.difference)}</span>
                    <span className="num text-xs font-semibold text-ink-soft sm:order-2 sm:text-sm">
                      {c.userName} · {c.salesCount} venta{c.salesCount === 1 ? '' : 's'} · efectivo contado {formatPrice(c.countedCash)}
                      {c.note && ` · ${c.note}`}
                    </span>
                    <button onClick={() => print(c)} aria-label={`Imprimir cierre del ${formatDate(c.closedAt)}`} className="grid size-9 place-items-center justify-self-end rounded-xl text-ink-soft hover:bg-sunken hover:text-ink sm:order-4">
                      <Printer className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Hoja imprimible del cierre (para guardar con el efectivo retirado). */
function closingHtml(c: CashClosing, business: string) {
  const dt = (s: string) => new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  const rows = c.byMethod.map((m) => `<tr><td>${paymentLabel(m.method)}</td><td class="r">${m.sales}</td><td class="r">${m.refunds + m.voids}</td><td class="r">${formatPrice(m.amount)}</td></tr>`).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cierre de caja ${dt(c.closedAt)}</title>
<style>body{font-family:system-ui,sans-serif;color:#24303A;margin:28px;font-size:13px}h1{font-size:18px;margin:0}small{color:#5A666F}
table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:6px;border-bottom:1px solid #E9E3D6;text-align:left}.r{text-align:right}
.box{border:2px solid #24303A;border-radius:10px;padding:10px 14px;margin-top:10px}.box div{display:flex;justify-content:space-between;padding:3px 0}
.big{font-weight:900;font-size:16px}.sign{margin-top:48px;border-top:1px solid #24303A;width:220px;padding-top:4px}</style></head><body>
<h1>${esc(business)} · Cierre de caja</h1><small>Turno del ${dt(c.openedAt)} al ${dt(c.closedAt)} · cerró ${esc(c.userName)}</small>
<table><thead><tr><th>Medio de pago</th><th class="r">Ventas</th><th class="r">Devol.</th><th class="r">Neto</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Sin movimientos</td></tr>'}</tbody></table>
<div class="box"><div><span>Fondo inicial</span><span>${formatPrice(c.openingCash)}</span></div>
<div><span>Efectivo esperado</span><span>${formatPrice(c.expectedCash)}</span></div>
<div><span>Efectivo contado</span><span>${formatPrice(c.countedCash)}</span></div>
<div class="big"><span>Diferencia</span><span>${diffText(c.difference)}</span></div>
<div><span>Queda de fondo</span><span>${formatPrice(c.keptCash)}</span></div>
<div><span>Se retira</span><span>${formatPrice(round2(c.countedCash - c.keptCash))}</span></div></div>
${c.note ? `<p>Nota: ${esc(c.note)}</p>` : ''}<p class="sign">Firma</p>
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`
}
