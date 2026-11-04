import { motion } from 'framer-motion'
import { LuLoaderCircle as Loader2 } from 'react-icons/lu'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { useInventory } from '@/stores/inventory'
import type { ProductInput, ProductRow } from '@/types'

type Draft = { name: string; sku: string; brand: string; categoryId: string; supplierId: string; ageMin: string; minStock: string; batteries: boolean }

const toDraft = (p: ProductRow): Draft => ({
  name: p.name,
  sku: p.sku,
  brand: p.brand,
  categoryId: p.categoryId,
  supplierId: p.supplierId ?? '',
  ageMin: String(p.ageMin),
  minStock: String(p.minStock),
  batteries: p.batteries,
})

const int = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN)

/**
 * Corregir los datos de un producto ya cargado. El stock no se toca acá (eso es un ajuste con motivo)
 * y el precio tiene su propio panel. Solo se envía lo que cambió.
 */
export function EditProductForm({ product, onDone }: { product: ProductRow; onDone: () => void }) {
  const { categories, suppliers, products, update } = useInventory()
  const [d, setD] = useState<Draft>(() => toDraft(product))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  // Marcas que ya existen, para no terminar con «Lego», «LEGO» y «lego» como marcas distintas.
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [products])

  const errors = {
    name: d.name.trim().length < 2 ? 'Escribe el nombre (al menos 2 letras)' : undefined,
    sku: !d.sku.trim()
      ? 'El código no puede quedar vacío'
      : products.some((p) => p.id !== product.id && p.sku === d.sku.trim())
        ? 'Ya hay otro producto con este código'
        : undefined,
    ageMin: Number.isNaN(int(d.ageMin)) || int(d.ageMin) > 18 ? 'Edad entre 0 y 18' : undefined,
    minStock: Number.isNaN(int(d.minStock)) ? 'Número entero, 0 o más' : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const patch: Partial<ProductInput> = {}
  if (d.name.trim() !== product.name) patch.name = d.name.trim()
  if (d.sku.trim() !== product.sku) patch.sku = d.sku.trim()
  if (d.brand.trim() !== product.brand) patch.brand = d.brand.trim()
  if (d.categoryId !== product.categoryId) patch.categoryId = d.categoryId
  if ((d.supplierId || null) !== product.supplierId) patch.supplierId = d.supplierId || null
  if (int(d.ageMin) !== product.ageMin) patch.ageMin = int(d.ageMin)
  if (int(d.minStock) !== product.minStock) patch.minStock = int(d.minStock)
  if (d.batteries !== product.batteries) patch.batteries = d.batteries
  const changed = Object.keys(patch).length

  const submit = async () => {
    if (invalid || !changed) return
    setBusy(true)
    try {
      await update(product.id, patch)
      toast({ tone: 'ok', text: `Datos de «${patch.name ?? product.name}» corregidos` })
      onDone()
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudieron guardar los cambios.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onSubmit={(e) => (e.preventDefault(), void submit())}
      className="flex flex-col gap-4 rounded-2xl border-2 border-turquesa/60 p-4"
      aria-label="Editar datos del producto"
    >
      <p className="font-black">Corregir datos</p>
      <Field label="Nombre" htmlFor="ed-name" error={errors.name}>
        <Input id="ed-name" autoFocus value={d.name} maxLength={120} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código" htmlFor="ed-sku" error={errors.sku}>
          <Input id="ed-sku" className="num" value={d.sku} maxLength={40} onChange={(e) => set('sku', e.target.value)} aria-invalid={!!errors.sku} />
        </Field>
        <Field label="Marca" htmlFor="ed-brand">
          <Input id="ed-brand" list="ed-brands" value={d.brand} maxLength={60} onChange={(e) => set('brand', e.target.value)} placeholder="Sin marca" />
          <datalist id="ed-brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría" htmlFor="ed-cat">
          <Select id="ed-cat" value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Proveedor" htmlFor="ed-sup">
          <Select id="ed-sup" value={d.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Edad desde" htmlFor="ed-age" error={errors.ageMin}>
          <Input id="ed-age" className="num" inputMode="numeric" value={d.ageMin} onChange={(e) => set('ageMin', e.target.value)} aria-invalid={!!errors.ageMin} />
        </Field>
        <Field label="Aviso con ≤" htmlFor="ed-min" error={errors.minStock}>
          <Input id="ed-min" className="num" inputMode="numeric" value={d.minStock} onChange={(e) => set('minStock', e.target.value)} aria-invalid={!!errors.minStock} />
        </Field>
        <Field label="Pilas" htmlFor="ed-bat">
          <label className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-line px-3 font-bold">
            <input id="ed-bat" type="checkbox" checked={d.batteries} onChange={(e) => set('batteries', e.target.checked)} className="size-5 accent-turquesa" />
            {d.batteries ? 'Usa' : 'No usa'}
          </label>
        </Field>
      </div>
      <p className="text-xs font-semibold text-ink-soft">El stock se cambia con «Ajustar» y el precio en su panel: así queda el motivo en el historial.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy || invalid || !changed}>
          {busy && <Loader2 className="size-4 animate-spin" />} {changed ? `Guardar ${changed} cambio${changed > 1 ? 's' : ''}` : 'Sin cambios'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  )
}
