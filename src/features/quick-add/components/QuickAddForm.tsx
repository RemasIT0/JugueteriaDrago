import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion, useAnimate } from 'framer-motion'
import { Camera, Check, PackageCheck, RotateCcw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button, Kbd } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { StockPips } from '@/components/ui/Board'
import { toast } from '@/components/ui/Toaster'
import { formatAge, uid } from '@/lib/format'
import { useInventory } from '@/stores/inventory'
import { useLote } from '@/stores/lote'
import type { Category, Product } from '@/types'
import { quickAddSchema, type QuickAddInput, type QuickAddValues } from '../schema'
import { MOD, useHotkeys } from '@/hooks/useHotkeys'
import { useScannerDetection } from '../hooks/useScannerDetection'
import { CategoryPicker } from './CategoryPicker'

const EMPTY: QuickAddInput = {
  sku: '',
  name: '',
  categoryId: '',
  price: '',
  stock: '',
  ageMin: '3',
  batteries: false,
  minStock: '5',
  brand: '',
}

/** Campos de plantilla: se pre-llenan desde la categoría salvo que el usuario los toque. */
const TEMPLATE_FIELDS = ['ageMin', 'batteries', 'minStock'] as const

function templateValues(cat?: Category) {
  return {
    ageMin: String(cat?.defaults.ageMin ?? 3),
    batteries: cat?.defaults.batteries ?? false,
    minStock: String(cat?.defaults.minStock ?? 5),
  }
}

interface Props {
  onSaved: (ms: number) => void
  onOpenCamera?: () => void
  /** Registro de la función de deshacer, para que la pila de recientes pueda llamarla. */
  undoRef: React.MutableRefObject<() => void>
  /** Entrada de códigos desde otras fuentes (cámara). */
  scanRef: React.MutableRefObject<(code: string) => void>
}

export function QuickAddForm({ onSaved, onOpenCamera, undoRef, scanRef }: Props) {
  const categories = useInventory((s) => s.categories)
  const products = useInventory((s) => s.products)
  const addOptimistic = useInventory((s) => s.addOptimistic)
  const restock = useInventory((s) => s.restock)
  const undoEntry = useInventory((s) => s.undoEntry)
  const { lote, record, undoLast, lastCategoryId, setLastCategory } = useLote()

  const startCategory = lastCategoryId && categories.some((c) => c.id === lastCategoryId) ? lastCategoryId : ''
  const startCat = categories.find((c) => c.id === startCategory)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<QuickAddInput, unknown, QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    // Valida al guardar y luego en vivo mientras se corrige: sin avisos mientras se teclea rápido.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { ...EMPTY, categoryId: startCategory, ...templateValues(startCat) },
  })

  /** Campos de plantilla que el usuario cambió a mano en este producto. */
  const manual = useRef(new Set<string>())
  const [scope, animate] = useAnimate()
  const [savedTick, setSavedTick] = useState(0)

  // ── Producto existente: si el código ya está, guardar = reponer stock ──────────
  const sku = watch('sku')
  const categoryId = watch('categoryId')
  const existing = useMemo<Product | undefined>(
    () => (sku?.trim().length >= 4 ? products.find((p) => p.sku === sku.trim()) : undefined),
    [sku, products],
  )

  useEffect(() => {
    if (!existing) return
    setValue('name', existing.name, { shouldValidate: true })
    setValue('categoryId', existing.categoryId, { shouldValidate: true })
    setValue('price', String(existing.price), { shouldValidate: true })
    setValue('ageMin', String(existing.ageMin))
    setValue('batteries', existing.batteries)
    setValue('minStock', String(existing.minStock))
    setValue('brand', existing.brand)
  }, [existing, setValue])

  // ── Plantillas inteligentes ────────────────────────────────────────────────────
  const category = categories.find((c) => c.id === categoryId)
  const chooseCategory = useCallback(
    (id: string) => {
      setValue('categoryId', id, { shouldValidate: true, shouldDirty: true })
      const tpl = templateValues(categories.find((c) => c.id === id))
      for (const f of TEMPLATE_FIELDS) if (!manual.current.has(f)) setValue(f, tpl[f])
    },
    [categories, setValue],
  )

  // ── Guardar y siguiente ────────────────────────────────────────────────────────
  // El foco se mueve directo en el DOM: setFocus de RHF usa setTimeout y, con un lector
  // o alguien tecleando rápido, las primeras teclas caerían en el campo anterior.
  const skuInput = useRef<HTMLInputElement | null>(null)
  const focusSku = useCallback(() => {
    skuInput.current?.focus()
    skuInput.current?.select()
  }, [])
  const focusField = (name: 'sku' | 'name' | 'price' | 'stock') => {
    const el = document.getElementById(`qa-${name}`) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  const onValid = (v: QuickAddValues) => {
    const t0 = performance.now()
    const at = new Date().toISOString()

    if (existing) {
      void restock(existing.id, v.stock).catch(() =>
        toast({ tone: 'error', text: `No se pudo reponer ${existing.name}. Revisa la conexión.` }),
      )
      record({ id: uid('e'), kind: 'reposicion', productId: existing.id, sku: v.sku, name: existing.name, categoryId: existing.categoryId, qty: v.stock, stock: existing.stock + v.stock, minStock: existing.minStock, at })
    } else {
      const id = addOptimistic({
        sku: v.sku,
        name: v.name,
        categoryId: v.categoryId,
        supplierId: lote.supplierId,
        price: v.price,
        stock: v.stock,
        minStock: v.minStock,
        ageMin: v.ageMin,
        batteries: v.batteries,
        brand: v.brand,
        loteId: lote.id,
      })
      record({ id: uid('e'), kind: 'nuevo', productId: id, sku: v.sku, name: v.name, categoryId: v.categoryId, qty: v.stock, stock: v.stock, minStock: v.minStock, at })
    }

    // Se limpia todo menos lo que suele repetirse dentro del lote.
    focusSku()
    setLastCategory(v.categoryId)
    manual.current.clear()
    const cat = categories.find((c) => c.id === v.categoryId)
    // keepFieldsRef: sin él, reset() vacía el registro de campos y lo que se teclee después se pierde.
    reset({ ...EMPTY, categoryId: v.categoryId, brand: v.brand, ...templateValues(cat) }, { keepFieldsRef: true })
    onSaved(performance.now() - t0)

    setSavedTick((n) => n + 1)
    void animate(scope.current, { x: [0, 18, 0], opacity: [1, 0.35, 1] }, { duration: 0.28, ease: [0.16, 1, 0.3, 1] })
  }

  const showErrors = handleSubmit(
    () => {},
    (errs) => {
      const first = (['sku', 'name', 'categoryId', 'price', 'stock'] as const).find((k) => errs[k])
      if (first && first !== 'categoryId') focusField(first)
    },
  )

  /**
   * Validación síncrona: si todo está bien se guarda en el mismo tick (sin esperar al resolver).
   * Si no, handleSubmit muestra los errores y activa la revalidación en vivo hasta corregirlos.
   */
  const submit = () => {
    const parsed = quickAddSchema.safeParse(getValues())
    if (parsed.success) onValid(parsed.data)
    else void showErrors()
  }

  const clearCurrent = useCallback(() => {
    focusSku()
    manual.current.clear()
    const { categoryId: cid, brand } = getValues()
    reset({ ...EMPTY, categoryId: cid, brand, ...templateValues(categories.find((c) => c.id === cid)) }, { keepFieldsRef: true })
  }, [categories, focusSku, getValues, reset])

  // ── Deshacer el último ─────────────────────────────────────────────────────────
  undoRef.current = () => {
    const last = undoLast()
    if (!last) return
    focusSku()
    undoEntry(last)
      .then(() => toast({ tone: 'ok', text: `Deshecho: ${last.name}` }))
      .catch((e) => {
        // Si no se pudo, la entrada vuelve a la pista para que no quede descuadrada.
        record(last)
        toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo deshacer.' })
      })
  }

  // ── Teclado y escáner ──────────────────────────────────────────────────────────
  const hotkeys: Record<string, () => void> = {
    'mod+enter': submit,
    'alt+n': clearCurrent,
    'mod+n': clearCurrent, // Chrome reserva Ctrl+N fuera de una app instalada; Alt+N siempre funciona.
    'mod+z': () => {
      const el = document.activeElement
      if (!(el instanceof HTMLInputElement) || el.value === '') undoRef.current()
    },
  }
  categories.slice(0, 9).forEach((c, i) => (hotkeys[`alt+${i + 1}`] = () => chooseCategory(c.id)))
  useHotkeys(hotkeys)

  const onScan = (code: string) => {
    setValue('sku', code, { shouldValidate: true })
    // Si existe, solo falta la cantidad; si es nuevo, el nombre.
    const known = useInventory.getState().products.some((p) => p.sku === code)
    focusField(known ? 'stock' : 'name')
  }
  scanRef.current = onScan
  useScannerDetection({ onScan })

  // Si se entra directo a esta página, las categorías llegan después del primer render:
  // en cuanto llegan se restaura la última usada, sin pisar una elección hecha mientras tanto.
  useEffect(() => {
    if (startCategory && !getValues('categoryId')) chooseCategory(startCategory)
  }, [startCategory, chooseCategory, getValues])

  useEffect(() => {
    focusSku()
  }, [focusSku])

  const skuField = register('sku')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
      className="flex flex-col rounded-3xl bg-surface shadow-card"
      aria-label="Carga rápida de producto"
    >
      <div ref={scope} className="flex flex-col gap-5 p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <Field
            label="Código de barras / SKU"
            htmlFor="qa-sku"
            error={errors.sku?.message}
            hint={existing ? undefined : 'Escanea con el lector o escribe el código'}
          >
            <div className="flex gap-2">
              <Input
                id="qa-sku"
                data-scan-target="true"
                autoComplete="off"
                inputMode="text"
                spellCheck={false}
                className="num text-base tracking-wide"
                aria-invalid={!!errors.sku}
                aria-describedby={errors.sku ? 'qa-sku-error' : undefined}
                {...skuField}
                ref={(el) => {
                  skuField.ref(el)
                  skuInput.current = el
                }}
                onKeyDown={(e) => {
                  // Enter en el código avanza al siguiente campo útil en vez de guardar.
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault()
                    onScan(e.currentTarget.value.trim())
                  }
                }}
              />
              {onOpenCamera && (
                <Button variant="secondary" size="lg" className="w-12 px-0" onClick={onOpenCamera} aria-label="Escanear con la cámara">
                  <Camera size={20} className="shrink-0" strokeWidth={2.5} />
                </Button>
              )}
            </div>
          </Field>

          <Field label="Nombre del producto" htmlFor="qa-name" error={errors.name?.message}>
            <Input
              id="qa-name"
              autoComplete="off"
              placeholder="Ej.: Rompecabezas Selva 500 piezas"
              readOnly={!!existing}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'qa-name-error' : undefined}
              className={existing ? 'bg-sunken' : undefined}
              {...register('name')}
            />
          </Field>
        </div>

        <AnimatePresence initial={false}>
          {existing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-cielo-wash px-4 py-3 text-sm font-bold text-cielo-ink">
                <PackageCheck className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
                <span>
                  Ya está en el inventario con <span className="num">{existing.stock}</span> unidades. Al guardar se suma la cantidad.
                </span>
                <StockPips product={existing} withLabel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Categoría" htmlFor="qa-category" error={errors.categoryId?.message}>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <CategoryPicker
                ref={field.ref}
                categories={categories}
                value={field.value}
                onChange={chooseCategory}
                invalid={!!errors.categoryId}
                describedBy={errors.categoryId ? 'qa-category-error' : undefined}
              />
            )}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio de venta" htmlFor="qa-price" error={errors.price?.message}>
            <Input
              id="qa-price"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className="num"
              readOnly={!!existing}
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? 'qa-price-error' : undefined}
              {...register('price')}
            />
          </Field>
          <Field label={existing ? 'Unidades que llegaron' : 'Cantidad recibida'} htmlFor="qa-stock" error={errors.stock?.message}>
            <Input
              id="qa-stock"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className="num"
              aria-invalid={!!errors.stock}
              aria-describedby={errors.stock ? 'qa-stock-error' : undefined}
              {...register('stock')}
            />
          </Field>
        </div>
      </div>

      {/* Acciones antes de la plantilla: Tab desde Cantidad llega directo a Guardar. */}
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-line/70 px-4 py-4 sm:px-6">
        <Button type="submit" variant="primary" size="lg" className="relative min-w-[15rem] flex-1 overflow-hidden sm:flex-none">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={savedTick}
              className="flex items-center gap-2.5"
              initial={savedTick ? { y: 18, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 30 }}
            >
              {savedTick > 0 && <SavedCheck />}
              {existing ? 'Reponer y siguiente' : 'Guardar y siguiente'}
            </motion.span>
          </AnimatePresence>
          <Kbd className="ml-1 hidden sm:inline-flex">{MOD} ↵</Kbd>
        </Button>
        <Button variant="ghost" onClick={clearCurrent}>
          <RotateCcw className="size-4" strokeWidth={2.5} aria-hidden />
          Limpiar
          <Kbd className="hidden sm:inline-flex">Alt N</Kbd>
        </Button>
      </div>

      <fieldset className="rounded-b-3xl bg-sunken/60 px-4 pb-5 pt-4 sm:px-6">
        <legend className="sr-only">Plantilla de la categoría</legend>
        <p className="mb-3 flex items-center gap-2 text-xs font-extrabold text-ink-soft">
          <Sparkles className="size-4 text-sol-ink" strokeWidth={2.5} aria-hidden />
          {category
            ? `Plantilla «${category.name}»: ${formatAge(Number(watch('ageMin')))}, ${watch('batteries') ? 'con baterías' : 'sin baterías'}. Cambia solo si este producto es distinto.`
            : 'Elige una categoría y estos datos se completan solos.'}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Edad mínima" htmlFor="qa-age" error={errors.ageMin?.message}>
            <Input
              id="qa-age"
              inputMode="numeric"
              className="num h-11"
              {...register('ageMin', { onChange: () => manual.current.add('ageMin') })}
            />
          </Field>
          <Field label="Requiere baterías" htmlFor="qa-batteries">
            <Controller
              control={control}
              name="batteries"
              render={({ field }) => (
                <button
                  id="qa-batteries"
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => {
                    manual.current.add('batteries')
                    field.onChange(!field.value)
                  }}
                  className="flex h-11 items-center gap-3 rounded-xl border-2 border-line bg-surface px-3 text-[0.9375rem] font-bold"
                >
                  <span className={`relative h-6 w-10 rounded-full transition-colors ${field.value ? 'bg-turquesa' : 'bg-line'}`}>
                    <motion.span
                      className="absolute top-1 size-4 rounded-full bg-surface shadow"
                      animate={{ left: field.value ? 20 : 4 }}
                      transition={{ type: 'spring', stiffness: 700, damping: 32 }}
                    />
                  </span>
                  {field.value ? 'Sí' : 'No'}
                </button>
              )}
            />
          </Field>
          <Field label="Avisar con stock ≤" htmlFor="qa-min" error={errors.minStock?.message}>
            <Input
              id="qa-min"
              inputMode="numeric"
              className="num h-11"
              {...register('minStock', { onChange: () => manual.current.add('minStock') })}
            />
          </Field>
          <Field label="Marca (opcional)" htmlFor="qa-brand">
            <Input id="qa-brand" autoComplete="off" className="h-11" placeholder="Se mantiene" {...register('brand')} />
          </Field>
        </div>
      </fieldset>
    </form>
  )
}

/** Check que se dibuja dentro del botón al guardar. */
function SavedCheck() {
  return (
    <motion.span
      className="grid size-6 place-items-center rounded-full bg-turquesa text-on-fill"
      initial={{ scale: 0.3, rotate: -40 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 700, damping: 15 }}
      aria-hidden
    >
      <Check className="size-4" strokeWidth={3.5} />
    </motion.span>
  )
}
