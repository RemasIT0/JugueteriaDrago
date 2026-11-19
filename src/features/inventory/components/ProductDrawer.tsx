import { AnimatePresence, motion } from 'framer-motion'
import { LuArrowDownRight as ArrowDownRight, LuArrowUpRight as ArrowUpRight, LuExternalLink as ExternalLink, LuImagePlus as ImagePlus, LuLink as LinkIcon, LuLoaderCircle as Loader2, LuPencil as Pencil, LuStar as Star, LuPlus as Plus, LuSlidersHorizontal as SlidersHorizontal, LuStore as StoreIcon, LuTrash2 as Trash2, LuX as X } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CategoryTag, StockPips } from '@/components/ui/Board'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { formatAge, formatDate, formatPrice, formatTime } from '@/lib/format'
import { DETAILS_LIMITS, productsApi } from '@/services/api'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import type { ProductRow, StockMovement } from '@/types'
import { ProductThumb } from './ProductThumb'
import { PricingPanel } from './PricingPanel'
import { EditProductForm } from './EditProductForm'
import { hasStore, storeHref } from '@/lib/print'

export function ProductDrawer({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const product = useInventory((s) => s.products.find((p) => p.id === productId))
  const categories = useInventory((s) => s.categories)
  const suppliers = useInventory((s) => s.suppliers)
  const update = useInventory((s) => s.update)
  const remove = useInventory((s) => s.remove)
  const [moves, setMoves] = useState<StockMovement[] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [editing, setEditing] = useState(false)
  const canAdjust = useCan('stock.ajustar')
  const canDelete = useCan('productos.eliminar')
  const canEdit = useCan('productos.crear')

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

  useEffect(() => setEditing(false), [productId])

  const cat = product && categories.find((c) => c.id === product.categoryId)
  const supplier = product && suppliers.find((s) => s.id === product.supplierId)


  return (
    <Drawer open={!!product} onClose={onClose} title={product?.name ?? 'Producto'}>
      {product && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="p-5 pt-16 sm:p-6 sm:pt-16">
            <PhotoGallery productId={product.id} photos={product.photos} disabled={!!product.syncState || !canEdit} fallback={<ProductThumb category={cat} size="xl" />} />
          </div>
          <div className="flex flex-col gap-6 px-5 pb-6 sm:px-6">
            <AnimatePresence initial={false} mode="wait">
              {editing ? (
                <EditProductForm key="edit" product={product} onDone={() => setEditing(false)} />
              ) : (
                <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <CategoryTag category={cat} />
                    <h2 className="text-2xl font-black leading-tight tracking-tight">{product.name}</h2>
                    <p className="num text-sm font-semibold text-ink-soft">
                      {product.sku} · {product.brand || 'Sin marca'}
                    </p>
                  </div>
                  {canEdit && !product.syncState && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                      <Pencil className="size-4" aria-hidden /> Editar datos
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

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

            <PricingPanel product={product} />

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

            <StoreDetails key={product.id} product={product} disabled={!canEdit || !!product.syncState} />

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
  const update = useInventory((s) => s.update)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const index = Math.min(active, photos.length - 1)
  const main = photos[index]

  /** La primera foto es la que se ve en la tienda y en el inventario. */
  const savePhotos = async (next: string[], ok: string, focus: number) => {
    setBusy(true)
    try {
      await update(productId, { photos: next })
      setActive(focus)
      setConfirmRemove(false)
      toast({ tone: 'ok', text: ok })
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudieron guardar las fotos.' })
    } finally {
      setBusy(false)
    }
  }

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

  const urlForm = !disabled && <PhotoUrlForm productId={productId} onAdded={() => setActive(photos.length)} />

  if (!photos.length)
    return (
      <div className="flex flex-col gap-3">
        <div className="relative">
          {fallback}
          <span className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-extrabold text-ink-soft">Sin foto</span>
        </div>
        {addButton}
        {urlForm}
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
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          {index === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-ink-soft">
              <Star className="size-3.5" aria-hidden /> Foto principal (la que se ve en la tienda)
            </span>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void savePhotos([main, ...photos.filter((_, i) => i !== index)], 'Ahora es la foto principal', 0)}>
              <Star className="size-4" aria-hidden /> Hacer principal
            </Button>
          )}
          <span className="ml-auto" />
          {confirmRemove ? (
            <>
              <span className="text-sm font-bold">¿Quitar esta foto?</span>
              <Button size="sm" variant="danger" autoFocus disabled={busy} onClick={() => void savePhotos(photos.filter((_, i) => i !== index), 'Foto quitada', 0)}>
                Sí, quitar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                No
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}>
              <Trash2 className="size-4" aria-hidden /> Quitar foto
            </Button>
          )}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((src, i) => (
          <button
            key={src}
            onClick={() => (setActive(i), setConfirmRemove(false))}
            aria-label={`Ver foto ${i + 1}`}
            aria-pressed={i === active}
            className={clsx('size-16 shrink-0 overflow-hidden rounded-xl ring-offset-2 ring-offset-surface', i === active ? 'ring-[3px] ring-turquesa' : 'opacity-80 hover:opacity-100')}
          >
            <img src={src} alt="" className="size-full object-cover" />
          </button>
        ))}
        {addButton}
      </div>
      {urlForm}
    </div>
  )
}

/** Comprueba que la dirección cargue una imagen antes de guardarla (máximo 8 s). */
function loadsAsImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const img = new Image()
    const t = setTimeout(() => resolve(false), 8000)
    img.onload = () => (clearTimeout(t), resolve(img.naturalWidth > 0))
    img.onerror = () => (clearTimeout(t), resolve(false))
    img.referrerPolicy = 'no-referrer'
    img.src = url
  })
}

/** Agregar una foto pegando su dirección web, sin descargarla. */
function PhotoUrlForm({ productId, onAdded }: { productId: string; onAdded: () => void }) {
  const addPhotoUrl = useInventory((s) => s.addPhotoUrl)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const clean = url.trim()
    setError(null)
    if (!/^https:\/\/\S+$/i.test(clean)) return setError('Pega una dirección que empiece con https://')
    setBusy(true)
    try {
      if (!(await loadsAsImage(clean))) return setError('Esa dirección no muestra una imagen. Copia la dirección de la imagen, no la de la página.')
      await addPhotoUrl(productId, clean)
      toast({ tone: 'ok', text: 'Foto agregada. Ya se ve en la tienda.' })
      setUrl('')
      setOpen(false)
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la foto.')
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 self-start text-sm font-extrabold text-turquesa-ink underline-offset-2 hover:underline">
        <LinkIcon className="size-4" aria-hidden /> Agregar foto desde una dirección web
      </button>
    )
  return (
    <form onSubmit={(e) => (e.preventDefault(), void submit())} className="flex flex-col gap-2 rounded-2xl border-2 border-line p-3">
      <label htmlFor={`url-${productId}`} className="text-xs font-extrabold text-ink-soft">
        Dirección de la imagen (clic derecho en la foto → «Copiar dirección de imagen»)
      </label>
      <div className="flex gap-2">
        <input
          id={`url-${productId}`}
          autoFocus
          inputMode="url"
          value={url}
          onChange={(e) => (setUrl(e.target.value), setError(null))}
          placeholder="https://…"
          aria-invalid={!!error}
          className="h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
        />
        <Button type="submit" size="sm" variant="primary" className="h-11" disabled={busy || !url.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : 'Agregar'}
        </Button>
        <Button size="sm" variant="ghost" className="h-11" onClick={() => (setOpen(false), setUrl(''), setError(null))}>
          Cancelar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-peligro">
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * Ficha para la tienda: lo que el cliente lee al abrir el juguete.
 * Se escribe como se habla; las características se suman con Enter
 * (o pegando una lista: cada renglón es una).
 */
function StoreDetails({ product, disabled }: { product: ProductRow; disabled: boolean }) {
  const saveDetails = useInventory((s) => s.saveDetails)
  const [desc, setDesc] = useState(product.description ?? '')
  const [feats, setFeats] = useState<string[]>(product.features ?? [])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const savedDesc = product.description ?? ''
  const savedFeats = product.features ?? []
  const dirty = desc.trim() !== savedDesc || feats.join('\n') !== savedFeats.join('\n') || draft.trim() !== ''
  const full = feats.length >= DETAILS_LIMITS.features

  const addLines = (text: string) => {
    const lines = text
      .split(/\r?\n|•/)
      .map((l) => l.replace(/^[\s\-*·]+/, '').trim().slice(0, DETAILS_LIMITS.feature))
      .filter(Boolean)
    if (!lines.length) return
    setFeats((f) => [...f, ...lines.filter((l) => !f.includes(l))].slice(0, DETAILS_LIMITS.features))
    setDraft('')
  }

  const submit = async () => {
    const all = (draft.trim() ? [...feats, draft.trim()] : feats).slice(0, DETAILS_LIMITS.features)
    setBusy(true)
    try {
      await saveDetails(product.id, desc, all)
      setFeats(all.map((f) => f.trim()).filter(Boolean))
      setDesc(desc.trim())
      setDraft('')
      toast({ tone: 'ok', text: 'Ficha guardada. Ya se ve en la tienda.' })
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar la ficha.' })
    } finally {
      setBusy(false)
    }
  }

  const field =
    'rounded-xl border-2 border-line bg-surface px-3 font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none disabled:opacity-60'

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-line p-4" aria-labelledby="ficha-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <StoreIcon className="size-5 text-ink-soft" aria-hidden />
          <h3 id="ficha-title" className="font-black">
            Ficha para la tienda
          </h3>
        </div>
        {product.stock > 0 && hasStore && (
          <a
            href={storeHref(`/tienda/juguete/${product.id}`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-extrabold text-turquesa-ink underline-offset-2 hover:underline"
          >
            Ver en la tienda <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
      {product.stock <= 0 && <p className="-mt-2 text-xs font-bold text-ink-soft">Sin stock no aparece en la tienda; la ficha queda guardada para cuando vuelva.</p>}

      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs font-extrabold text-ink-soft">
          <span>Descripción</span>
          <span className="num">
            {desc.length}/{DETAILS_LIMITS.description}
          </span>
        </span>
        <textarea
          value={desc}
          disabled={disabled}
          maxLength={DETAILS_LIMITS.description}
          rows={4}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Ej.: Dinosaurio que camina y ruge. Ideal para jugar en el piso; las pilas vienen incluidas."
          className={clsx(field, 'resize-y py-2.5 leading-snug')}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="flex justify-between text-xs font-extrabold text-ink-soft">
          <span>Características</span>
          <span className="num">
            {feats.length}/{DETAILS_LIMITS.features}
          </span>
        </span>
        {feats.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {feats.map((f, i) => (
              <li key={f + i} className="inline-flex max-w-full items-center gap-1 rounded-full bg-sunken py-1 pl-3 pr-1 text-sm font-bold">
                <span className="truncate">{f}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setFeats((all) => all.filter((_, j) => j !== i))}
                    aria-label={`Quitar «${f}»`}
                    className="grid size-6 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-line hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!disabled && (
          <>
            <div className="flex gap-2">
              <input
                value={draft}
                disabled={full}
                maxLength={DETAILS_LIMITS.feature}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addLines(draft)
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text')
                  if (/\n/.test(text)) {
                    e.preventDefault()
                    addLines(text)
                  }
                }}
                aria-label="Nueva característica"
                placeholder={full ? 'Llegaste al máximo' : 'Ej.: Mide 30 cm (Enter para sumar)'}
                className={clsx(field, 'h-11 min-w-0 flex-1')}
              />
              <Button size="sm" className="h-11" disabled={full || !draft.trim()} onClick={() => addLines(draft)}>
                <Plus className="size-4" aria-hidden /> Sumar
              </Button>
            </div>
            <p className="text-xs font-semibold text-ink-soft">Si pegas una lista, cada renglón se vuelve una característica.</p>
          </>
        )}
        {disabled && !feats.length && <p className="text-sm font-semibold text-ink-soft">Sin características.</p>}
      </div>

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" disabled={busy || !dirty} onClick={() => void submit()}>
            {busy && <Loader2 className="size-4 animate-spin" />} Guardar ficha
          </Button>
          {dirty && !busy && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDesc(savedDesc)
                setFeats(savedFeats)
                setDraft('')
              }}
            >
              Descartar cambios
            </Button>
          )}
        </div>
      )}
    </section>
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
