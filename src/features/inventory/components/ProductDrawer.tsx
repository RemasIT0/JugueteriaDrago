import { AnimatePresence, motion } from 'framer-motion'
import { LuArrowDownRight as ArrowDownRight, LuArrowUpRight as ArrowUpRight, LuImagePlus as ImagePlus, LuLoaderCircle as Loader2, LuSlidersHorizontal as SlidersHorizontal, LuTrash2 as Trash2 } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CategoryTag, StockPips } from '@/components/ui/Board'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { formatAge, formatDate, formatPrice, formatTime } from '@/lib/format'
import { productsApi } from '@/services/api'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import type { StockMovement } from '@/types'
import { ProductThumb } from './ProductThumb'

export function ProductDrawer({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const product = useInventory((s) => s.products.find((p) => p.id === productId))
  const categories = useInventory((s) => s.categories)
  const suppliers = useInventory((s) => s.suppliers)
  const update = useInventory((s) => s.update)
  const remove = useInventory((s) => s.remove)
  const [moves, setMoves] = useState<StockMovement[] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const canAdjust = useCan('stock.ajustar')
  const canDelete = useCan('productos.eliminar')

  useEffect(() => {
    setMoves(null)
    setConfirming(false)
    setAdjusting(false)
    if (!product || product.syncState) return
    let alive = true
    productsApi.movements(product).then((m) => alive && setMoves(m))
    return () => {
      alive = false
    }
    // Se recarga al cambiar de producto o cuando el producto se guarda de nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.updatedAt])

  const cat = product && categories.find((c) => c.id === product.categoryId)
  const supplier = product && suppliers.find((s) => s.id === product.supplierId)


  return (
    <Drawer open={!!product} onClose={onClose} title={product?.name ?? 'Producto'}>
      {product && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="p-5 pt-16 sm:p-6 sm:pt-16">
            <PhotoGallery productId={product.id} photos={product.photos} disabled={!!product.syncState} fallback={<ProductThumb category={cat} size="xl" />} />
          </div>
          <div className="flex flex-col gap-6 px-5 pb-6 sm:px-6">
            <div className="flex flex-col gap-2">
              <CategoryTag category={cat} />
              <h2 className="text-2xl font-black leading-tight tracking-tight">{product.name}</h2>
              <p className="num text-sm font-semibold text-ink-soft">
                {product.sku} · {product.brand || 'Sin marca'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2 rounded-2xl bg-sunken p-4">
                <p className="text-xs font-extrabold text-ink-soft">Stock</p>
                <div className="flex items-center justify-between gap-2">
                  <motion.p key={product.stock} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="num text-3xl font-black">
                    {product.stock}
                  </motion.p>
                  {canAdjust && !product.syncState && (
                    <Button size="sm" className="bg-surface" onClick={() => setAdjusting((a) => !a)} aria-expanded={adjusting}>
                      <SlidersHorizontal className="size-4" aria-hidden /> Ajustar
                    </Button>
                  )}
                </div>
                <StockPips product={product} withLabel />
              </div>
              <div className="flex flex-col gap-2 rounded-2xl bg-sunken p-4">
                <p className="text-xs font-extrabold text-ink-soft">Precio</p>
                <p className="num text-3xl font-black">{formatPrice(product.price)}</p>
                <p className="text-xs font-bold text-ink-soft">Aviso con ≤ {product.minStock} u</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {adjusting && (
                <AdjustStockForm
                  stock={product.stock}
                  onCancel={() => setAdjusting(false)}
                  onSubmit={async (stock, reason) => {
                    try {
                      await update(product.id, { stock }, reason)
                      toast({ tone: 'ok', text: `Stock ajustado a ${stock} u` })
                      setAdjusting(false)
                    } catch (e) {
                      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo ajustar el stock.' })
                    }
                  }}
                />
              )}
            </AnimatePresence>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ['Edad', formatAge(product.ageMin)],
                ['Baterías', product.batteries ? 'Sí' : 'No'],
                ['Proveedor', supplier?.name ?? '—'],
                ['Alta', formatDate(product.createdAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-extrabold text-ink-soft">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>

            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-black">Historial de stock</h3>
              </div>
              {!moves ? (
                <div className="flex flex-col gap-2">
                  <Shimmer className="h-20 rounded-2xl" />
                  <Shimmer className="h-10 rounded-xl" />
                </div>
              ) : moves.length === 0 ? (
                <p className="rounded-2xl bg-sunken px-4 py-6 text-center text-sm font-bold text-ink-soft">Todavía no hay movimientos.</p>
              ) : (
                <MovementList moves={moves} />
              )}
            </section>

            {canDelete && (
            <div className="mt-4 border-t-2 border-line pt-5">
              {confirming ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="flex-1 text-sm font-bold">¿Eliminar este producto? Su historial queda guardado en Actividad.</p>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    autoFocus
                    onClick={() => {
                      void remove(product.id)
                        .then(() => toast({ tone: 'ok', text: `${product.name} eliminado` }))
                        .catch((e) => toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo eliminar.' }))
                      onClose()
                    }}
                  >
                    Sí, eliminar
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                  <Trash2 className="size-4" aria-hidden /> Eliminar producto
                </Button>
              )}
            </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

/** Foto principal, tira de miniaturas y botón para sumar fotos desde la cámara o el disco. */
function PhotoGallery({ productId, photos, disabled, fallback }: { productId: string; photos: string[]; disabled: boolean; fallback: React.ReactNode }) {
  const addPhoto = useInventory((s) => s.addPhoto)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const main = photos[Math.min(active, photos.length - 1)]

  const upload = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast({ tone: 'error', text: 'Ese archivo no es una imagen.' })
    setBusy(true)
    try {
      await addPhoto(productId, file)
      setActive(photos.length)
    } catch {
      toast({ tone: 'error', text: 'No se pudo subir la foto. Intenta de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  const addButton = (
    <label
      className={clsx(
        'shrink-0 cursor-pointer rounded-xl border-2 border-dashed border-line text-ink-soft transition-colors hover:border-ink-soft/50 hover:text-ink',
        photos.length ? 'grid size-16 place-items-center' : 'flex h-11 w-full items-center justify-center gap-2 text-sm font-extrabold',
        (disabled || busy) && 'pointer-events-none opacity-50',
      )}
    >
      {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" strokeWidth={2.4} aria-hidden />}
      {photos.length ? <span className="sr-only">Añadir foto</span> : 'Añadir foto'}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => (void upload(e.target.files?.[0]), (e.target.value = ''))} />
    </label>
  )

  if (!photos.length)
    return (
      <div className="flex flex-col gap-3">
        <div className="relative">
          {fallback}
          <span className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-extrabold text-ink-soft">Sin foto</span>
        </div>
        {addButton}
      </div>
    )

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={main}
          src={main}
          alt=""
          className="h-64 w-full rounded-3xl bg-sunken object-cover"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />
      </AnimatePresence>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((src, i) => (
          <button
            key={src}
            onClick={() => setActive(i)}
            aria-label={`Ver foto ${i + 1}`}
            aria-pressed={i === active}
            className={clsx('size-16 shrink-0 overflow-hidden rounded-xl ring-offset-2 ring-offset-surface', i === active ? 'ring-[3px] ring-turquesa' : 'opacity-80 hover:opacity-100')}
          >
            <img src={src} alt="" className="size-full object-cover" />
          </button>
        ))}
        {addButton}
      </div>
    </div>
  )
}

const REASONS = ['Conteo físico', 'Merma o rotura', 'Producto dañado', 'Pasa a exhibición', 'Error de carga', 'Otro'] as const

/** Ajuste manual: se escribe el stock real y se elige por qué. Queda en el historial y en Actividad. */
function AdjustStockForm({ stock, onSubmit, onCancel }: { stock: number; onSubmit: (stock: number, reason: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(String(stock))
  const [reason, setReason] = useState<string>(REASONS[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const n = Number(value)
  const valid = value.trim() !== '' && Number.isInteger(n) && n >= 0
  const delta = valid ? n - stock : 0
  const needsNote = reason === 'Otro'

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid || delta === 0 || (needsNote && !note.trim())) return
        setBusy(true)
        await onSubmit(n, note.trim() ? `${reason}: ${note.trim()}` : reason)
        setBusy(false)
      }}
    >
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-line p-4">
        <p className="font-black">Ajustar stock</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold text-ink-soft">Stock real contado</span>
            <input
              autoFocus
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="num h-11 rounded-xl border-2 border-line bg-surface px-3 font-bold focus:border-turquesa focus:shadow-focus focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold text-ink-soft">Motivo</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 rounded-xl border-2 border-line bg-surface px-3 font-bold focus:border-turquesa focus:shadow-focus focus:outline-none"
            >
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-extrabold text-ink-soft">Nota {needsNote ? '(obligatoria)' : '(opcional)'}</span>
          <input
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej.: caja aplastada en el depósito"
            className="h-11 rounded-xl border-2 border-line bg-surface px-3 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
          />
        </label>
        <p className={clsx('num text-sm font-extrabold', !valid ? 'text-peligro' : delta < 0 ? 'text-peligro' : delta > 0 ? 'text-turquesa-ink' : 'text-ink-soft')}>
          {!valid ? 'Escribe un número entero (0 o más)' : delta === 0 ? 'Sin cambios' : `${stock} → ${n} (${delta > 0 ? '+' : ''}${delta} u)`}
        </p>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={busy || !valid || delta === 0 || (needsNote && !note.trim())}>
            {busy && <Loader2 className="size-4 animate-spin" />} Guardar ajuste
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </motion.form>
  )
}

const REASON_LABEL: Record<StockMovement['reason'], string> = { alta: 'Alta', ingreso: 'Ingreso', venta: 'Venta', ajuste: 'Ajuste' }

/** Historial real de movimientos, el más reciente arriba. */
function MovementList({ moves }: { moves: StockMovement[] }) {
  return (
    <ol className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-2xl bg-sunken">
      {moves.slice(0, 100).map((m) => {
        const up = m.delta >= 0
        const Icon = up ? ArrowUpRight : ArrowDownRight
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
            <Icon className={clsx('size-4 shrink-0', up ? 'text-turquesa-ink' : 'text-peligro')} strokeWidth={2.6} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">
                {REASON_LABEL[m.reason]}
                {m.note && <span className="font-semibold text-ink-soft"> · {m.note}</span>}
              </p>
              <p className="num text-xs font-semibold text-ink-soft">
                {formatDate(m.date)} {formatTime(m.date)}
              </p>
            </div>
            <span className={clsx('num text-sm font-black', up ? 'text-turquesa-ink' : 'text-peligro')}>
              {up ? '+' : ''}
              {m.delta}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
