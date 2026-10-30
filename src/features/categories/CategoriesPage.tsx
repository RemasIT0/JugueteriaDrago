import { AnimatePresence, motion } from 'framer-motion'
import { LuBatteryCharging as BatteryCharging, LuBatteryWarning as BatteryWarning, LuCheck as Check, LuLoaderCircle as Loader2, LuPencil as Pencil, LuPlus as Plus, LuSparkles as Sparkles } from 'react-icons/lu'
import { useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { BOARD, BOARD_COLORS } from '@/lib/colors'
import { formatAge, stockLevel } from '@/lib/format'
import { nextBoardColor, type CategoryInput } from '@/services/commerce'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import type { BoardColor, Category } from '@/types'
import { ProductThumb } from '../inventory/components/ProductThumb'

export default function CategoriesPage() {
  const { status, categories, products, settings, addCategory, updateCategory } = useInventory()
  const canCreate = useCan('categorias.crear')
  const canEdit = useCan('categorias.editar')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const save = async (input: CategoryInput, id?: string) => {
    try {
      if (id) await updateCategory(id, input)
      else await addCategory(input)
      toast({ tone: 'ok', text: id ? 'Categoría actualizada' : `Categoría «${input.name}» creada` })
      setCreating(false)
      setEditing(null)
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar.' })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Categorías</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
            Cada categoría tiene su color de casilla y una plantilla: al elegirla en Carga Rápida, estos datos se completan solos.
          </p>
        </div>
        {canCreate && !creating && (
          <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
            <Plus className="size-5" strokeWidth={2.5} aria-hidden /> Nueva categoría
          </Button>
        )}
      </header>

      <AnimatePresence>
        {creating && (
          <CategoryForm
            initial={{ name: '', color: nextBoardColor(categories), defaults: { ageMin: 3, batteries: false, minStock: 5 }, marginTarget: undefined }}
            defaultMargin={settings?.defaultMargin ?? 60}
            onSave={(v) => save(v)}
            onCancel={() => setCreating(false)}
            title="Nueva categoría"
          />
        )}
      </AnimatePresence>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {status !== 'ready'
          ? Array.from({ length: 6 }, (_, i) => <Shimmer key={i} className="h-52 rounded-3xl" />)
          : categories.map((c) =>
              editing === c.id ? (
                <CategoryForm
                  key={c.id}
                  initial={c}
                  defaultMargin={settings?.defaultMargin ?? 60}
                  onSave={(v) => save(v, c.id)}
                  onCancel={() => setEditing(null)}
                  title={`Editar ${c.name}`}
                />
              ) : (
                <CategoryCard key={c.id} category={c} products={products} defaultMargin={settings?.defaultMargin ?? 60} onEdit={canEdit ? () => setEditing(c.id) : undefined} />
              ),
            )}
      </div>
    </div>
  )
}

function CategoryCard({
  category: c,
  products,
  defaultMargin,
  onEdit,
}: {
  category: Category
  products: { categoryId: string; stock: number; minStock: number }[]
  defaultMargin: number
  onEdit?: () => void
}) {
  const own = products.filter((p) => p.categoryId === c.id)
  const low = own.filter((p) => stockLevel(p) === 'bajo').length
  return (
    <motion.article layout className="overflow-hidden rounded-3xl bg-surface shadow-card">
      <div className={clsx('h-3', BOARD[c.color].fill)} />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <ProductThumb category={c} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black">{c.name}</h2>
            <p className="num text-sm font-semibold text-ink-soft">
              {own.length} productos{low > 0 && <span className="text-peligro"> · {low} con stock bajo</span>}
            </p>
          </div>
          {onEdit && (
            <button onClick={onEdit} className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-sunken hover:text-ink" aria-label={`Editar ${c.name}`}>
              <Pencil className="size-4" />
            </button>
          )}
        </div>
        <div className={clsx('flex flex-col gap-2 rounded-2xl p-3.5', BOARD[c.color].wash)}>
          <p className={clsx('flex items-center gap-1.5 text-xs font-extrabold', BOARD[c.color].ink)}>
            <Sparkles className="size-3.5" aria-hidden /> Plantilla
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
            <li>{formatAge(c.defaults.ageMin ?? 0)}</li>
            <li className="flex items-center gap-1">
              {c.defaults.batteries ? <BatteryCharging className="size-4" aria-hidden /> : <BatteryWarning className="size-4 opacity-50" aria-hidden />}
              {c.defaults.batteries ? 'Con baterías' : 'Sin baterías'}
            </li>
            <li className="num">Aviso con ≤ {c.defaults.minStock ?? 5} u</li>
            <li className="num">Margen {c.marginTarget ?? defaultMargin}%{c.marginTarget === undefined && ' (general)'}</li>
          </ul>
        </div>
      </div>
    </motion.article>
  )
}

function CategoryForm({
  initial,
  defaultMargin,
  onSave,
  onCancel,
  title,
}: {
  initial: CategoryInput
  defaultMargin: number
  onSave: (v: CategoryInput) => Promise<void>
  onCancel: () => void
  title: string
}) {
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState<BoardColor>(initial.color)
  const [age, setAge] = useState(String(initial.defaults.ageMin ?? 3))
  const [bat, setBat] = useState(initial.defaults.batteries ?? false)
  const [min, setMin] = useState(String(initial.defaults.minStock ?? 5))
  const [margin, setMargin] = useState(initial.marginTarget === undefined ? '' : String(initial.marginTarget))
  const [busy, setBusy] = useState(false)
  const nameOk = name.trim().length >= 2
  const marginNum = margin.trim() === '' ? undefined : Number(margin)
  const marginOk = marginNum === undefined || (Number.isFinite(marginNum) && marginNum >= 0 && marginNum <= 500)

  return (
    <motion.form
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!nameOk || !marginOk) return
        setBusy(true)
        await onSave({
          name: name.trim(),
          color,
          defaults: { ageMin: Number(age) || 0, batteries: bat, minStock: Math.max(0, Number(min) || 0) },
          marginTarget: marginNum,
        })
        setBusy(false)
      }}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-lift ring-2 ring-sol"
    >
      <h2 className="font-black">{title}</h2>
      <Field label="Nombre" htmlFor="cf-name" error={name && !nameOk ? 'Mínimo 2 caracteres' : undefined}>
        <Input id="cf-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Disfraces" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold text-ink-soft">Color de casilla</span>
        <div role="radiogroup" aria-label="Color" className="flex gap-2">
          {BOARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={clsx('grid size-9 place-items-center rounded-xl transition-transform', BOARD[c].fill, color === c ? 'scale-110 ring-[3px] ring-ink ring-offset-2 ring-offset-surface' : 'hover:scale-105')}
            >
              {color === c && <Check className="size-4 text-on-fill" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Edad mínima" htmlFor="cf-age">
          <Input id="cf-age" inputMode="numeric" className="num h-11" value={age} onChange={(e) => setAge(e.target.value)} />
        </Field>
        <Field label="Avisar con stock ≤" htmlFor="cf-min">
          <Input id="cf-min" inputMode="numeric" className="num h-11" value={min} onChange={(e) => setMin(e.target.value)} />
        </Field>
        <Field label="Margen sobre costo %" htmlFor="cf-margin" hint={`Vacío = general (${defaultMargin}%)`} error={marginOk ? undefined : 'Entre 0 y 500'}>
          <Input id="cf-margin" inputMode="numeric" className="num h-11" value={margin} placeholder={String(defaultMargin)} onChange={(e) => setMargin(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border-2 border-line px-3 py-2.5 text-sm font-bold">
          <input type="checkbox" checked={bat} onChange={(e) => setBat(e.target.checked)} className="size-5 accent-[rgb(var(--turquesa))]" />
          Requiere baterías
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy || !nameOk || !marginOk}>
          {busy && <Loader2 className="size-4 animate-spin" />} Guardar
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  )
}
