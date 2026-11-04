import { AnimatePresence, motion } from 'framer-motion'
import {
  LuCircleCheck as CheckCircle,
  LuCircleHelp as Help,
  LuListChecks as ListChecks,
  LuLoaderCircle as Loader2,
  LuSearch as Search,
  LuSearchX as SearchX,
  LuX as X,
} from 'react-icons/lu'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button, Kbd } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { uid } from '@/lib/format'
import { MOD } from '@/hooks/useHotkeys'
import { useInventory } from '@/stores/inventory'
import { useLote } from '@/stores/lote'
import type { ProductRow } from '@/types'
import { parseList, suggest, type ListRow } from '../parseList'

const EXAMPLE = 'Peluche Dragón x12, Osito Miel 6\n10 Unicornio Pastel'

/**
 * Reposición desde una lista escrita o pegada. Nada se guarda sin pasar por la revisión:
 * cada renglón muestra qué producto se entendió, y las dudas se resuelven con un clic.
 */
export function ListEntry() {
  const products = useInventory((s) => s.products)
  const restock = useInventory((s) => s.restock)
  const record = useLote((s) => s.record)
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ListRow[] | null>(null)
  const [busy, setBusy] = useState(false)

  const review = () => {
    if (!text.trim()) return
    setRows(parseList(text, products.filter((p) => p.syncState !== 'error')))
  }
  const patch = (id: string, change: Partial<ListRow>) => setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...change } : r)) ?? null)
  const choose = (r: ListRow, product: ProductRow) => patch(r.id, { product, status: r.qty ? 'ok' : 'sin-cantidad' })
  const setQty = (r: ListRow, value: string) => {
    const n = Number(value)
    const qty = Number.isInteger(n) && n > 0 && n <= 9999 ? n : null
    patch(r.id, { qty, status: r.product ? (qty ? 'ok' : 'sin-cantidad') : r.status })
  }
  const remove = (id: string) => setRows((rs) => rs?.filter((r) => r.id !== id) ?? null)

  const pending = rows?.filter((r) => r.status !== 'ok').length ?? 0
  const ready = rows?.filter((r) => r.status === 'ok') ?? []
  const units = ready.reduce((a, r) => a + (r.qty ?? 0), 0)

  const confirm = async () => {
    if (!rows || pending || !ready.length) return
    setBusy(true)
    let done = 0
    try {
      for (const r of ready) {
        const p = useInventory.getState().products.find((x) => x.id === r.product!.id)
        if (!p) throw new Error(`«${r.product!.name}» ya no existe`)
        await restock(p.id, r.qty!)
        record({ id: uid('e'), kind: 'reposicion', productId: p.id, sku: p.sku, name: p.name, categoryId: p.categoryId, qty: r.qty!, stock: p.stock + r.qty!, minStock: p.minStock, at: new Date().toISOString() })
        done++
        setRows((rs) => rs?.filter((x) => x.id !== r.id) ?? null)
      }
      toast({ tone: 'ok', text: `Listo: ${done} ${done === 1 ? 'producto repuesto' : 'productos repuestos'} (${units} unidades)` })
      setRows(null)
      setText('')
    } catch (e) {
      toast({ tone: 'error', text: `Se guardaron ${done} de ${ready.length}. ${e instanceof Error ? e.message : 'No se pudo completar.'} Los que faltan siguen en la lista.` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-black">Escribe o pega la lista</h2>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              Separa cada producto con una coma o en otro renglón. La cantidad va al final (<span className="num">x12</span> o <span className="num">12</span>) o al principio. No hace falta escribir el nombre completo ni sin errores.
            </p>
          </div>
        </div>
        <textarea
          aria-label="Lista de productos"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.preventDefault(), review())
          }}
          rows={5}
          placeholder={EXAMPLE}
          spellCheck={false}
          className="min-h-[8rem] w-full resize-y rounded-2xl border-2 border-line bg-surface px-4 py-3 text-base font-semibold leading-relaxed placeholder:text-ink-soft/60 focus:border-turquesa focus:shadow-focus focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={review} disabled={!text.trim()}>
            <ListChecks className="size-4" aria-hidden /> Revisar lista <Kbd className="ml-1 bg-white/15 text-inherit">{MOD} ↵</Kbd>
          </Button>
          <p className="text-xs font-semibold text-ink-soft">Solo repone productos que ya están en el inventario. Los nuevos se cargan en «Carga continua» o «Desde archivo».</p>
        </div>
      </div>

      <AnimatePresence>
        {rows && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-black">Revisión</h2>
              <p className="num text-sm font-bold text-ink-soft">
                {ready.length} listos{pending ? ` · ${pending} por resolver` : ''}
              </p>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-2xl bg-sunken px-4 py-6 text-center text-sm font-bold text-ink-soft">No quedan renglones. Escribe otra lista arriba.</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Productos entendidos">
                {rows.map((r) => (
                  <Row key={r.id} row={r} products={products} onChoose={(p) => choose(r, p)} onQty={(v) => setQty(r, v)} onRemove={() => remove(r.id)}
                    onNumberIsQty={() => (r.product ? patch(r.id, { status: 'ok', alt: undefined }) : patch(r.id, { status: 'sugerencia', alt: undefined }))}
                    onNumberIsName={() => r.alt && patch(r.id, { product: r.alt.product, qty: null, status: 'sin-cantidad', alt: undefined })}
                    onChange={() => patch(r.id, { status: 'sugerencia', product: null, suggestions: r.suggestions.length ? r.suggestions : suggest(r.query, products) })}
                  />
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t-2 border-line pt-4">
              <Button variant="accent" onClick={() => void confirm()} disabled={busy || !!pending || !ready.length}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle className="size-4" aria-hidden />}
                Reponer {ready.length} {ready.length === 1 ? 'producto' : 'productos'} · <span className="num">{units} u</span>
              </Button>
              {pending > 0 && <p className="text-sm font-bold text-sol-ink">Resuelve o quita los renglones marcados para poder confirmar.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function Row({
  row: r,
  products,
  onChoose,
  onQty,
  onRemove,
  onNumberIsQty,
  onNumberIsName,
  onChange,
}: {
  row: ListRow
  products: ProductRow[]
  onChoose: (p: ProductRow) => void
  onQty: (v: string) => void
  onRemove: () => void
  onNumberIsQty: () => void
  onNumberIsName: () => void
  onChange: () => void
}) {
  const [search, setSearch] = useState('')
  const found = useMemo(() => (search.trim().length >= 2 ? suggest(search, products, 5) : []), [search, products])
  const tone = r.status === 'ok' ? 'ok' : r.status === 'no-encontrado' ? 'bad' : 'ask'
  const asking = r.status === 'sugerencia' || r.status === 'no-encontrado'

  return (
    <motion.li layout className={clsx('flex flex-col gap-3 rounded-2xl border-2 p-3 sm:p-4', tone === 'ok' ? 'border-line' : tone === 'ask' ? 'border-sol bg-sol-wash/40' : 'border-peligro/40 bg-peligro-wash/40')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={clsx('grid size-7 shrink-0 place-items-center rounded-full', tone === 'ok' ? 'bg-turquesa-wash text-turquesa-ink' : tone === 'ask' ? 'bg-sol text-on-fill' : 'bg-peligro-wash text-peligro')}>
          {tone === 'ok' ? <CheckCircle className="size-4" aria-hidden /> : tone === 'ask' ? <Help className="size-4" aria-hidden /> : <SearchX className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-ink-soft">
            Escribiste: <span className="text-ink">«{r.raw}»</span>
          </p>
          {r.product && r.status !== 'numero-dudoso' ? (
            <p className="truncate font-extrabold">
              {r.product.name}{' '}
              <span className="num text-sm font-bold text-ink-soft">
                · stock {r.product.stock}
                {r.qty ? ` → ${r.product.stock + r.qty}` : ''}
              </span>
            </p>
          ) : (
            <p className="font-extrabold">
              {r.status === 'numero-dudoso' ? `¿El ${r.qty} es la cantidad o parte del nombre?` : r.status === 'sugerencia' ? '¿Quisiste decir…?' : 'No está en el inventario'}
            </p>
          )}
        </div>
        {(r.product || r.status === 'sin-cantidad') && r.status !== 'numero-dudoso' && (
          <label className="flex items-center gap-2 text-xs font-extrabold text-ink-soft">
            Cantidad
            <Input
              inputMode="numeric"
              aria-label={`Cantidad de ${r.product?.name ?? r.raw}`}
              value={r.qty ?? ''}
              onChange={(e) => onQty(e.target.value.replace(/\D/g, ''))}
              className={clsx('num h-10 w-20 text-center', !r.qty && 'border-sol')}
              autoFocus={r.status === 'sin-cantidad'}
            />
          </label>
        )}
        {r.status === 'ok' && (
          <button type="button" onClick={onChange} className="rounded-lg px-2 py-1 text-xs font-extrabold text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink">
            No es este
          </button>
        )}
        <button type="button" onClick={onRemove} aria-label={`Quitar «${r.raw}»`} className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-peligro-wash hover:text-peligro">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {r.status === 'numero-dudoso' && r.alt && (
        <div className="flex flex-wrap gap-2 sm:pl-10">
          <Button size="sm" variant="secondary" onClick={onNumberIsQty}>
            Son <span className="num">{r.qty}</span> unidades{r.product ? ` de ${r.product.name}` : ''}
          </Button>
          <Button size="sm" variant="secondary" onClick={onNumberIsName}>
            Es el producto «{r.alt.product.name}»
          </Button>
        </div>
      )}

      {asking && (
        <div className="flex flex-col gap-2 sm:pl-10">
          {r.status === 'sugerencia' && (
            <div className="flex flex-wrap gap-2">
              {r.suggestions.map((s) => (
                <Button key={s.product.id} size="sm" variant="secondary" onClick={() => onChoose(s.product)}>
                  {s.product.name} <span className="num text-xs text-ink-soft">· stock {s.product.stock}</span>
                </Button>
              ))}
            </div>
          )}
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={r.status === 'sugerencia' ? 'Ninguno: buscar otro producto…' : 'Buscar con otro nombre…'} aria-label={`Buscar otro producto para «${r.raw}»`} className="h-10 pl-9" />
          </div>
          {found.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {found.map((s) => (
                <Button key={s.product.id} size="sm" variant="ghost" className="bg-sunken" onClick={() => onChoose(s.product)}>
                  {s.product.name}
                </Button>
              ))}
            </div>
          )}
          {r.status === 'no-encontrado' && !found.length && <p className="text-xs font-semibold text-ink-soft">Si es un producto nuevo, quítalo de la lista y cárgalo en «Carga continua».</p>}
        </div>
      )}
    </motion.li>
  )
}
