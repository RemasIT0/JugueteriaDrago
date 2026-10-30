import { AnimatePresence, motion } from 'framer-motion'
import { LuLoaderCircle as Loader2, LuMail as Mail, LuPencil as Pencil, LuPhone as Phone, LuPlus as Plus, LuTruck as Truck, LuUserRound as UserRound } from 'react-icons/lu'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { formatPrice } from '@/lib/format'
import type { SupplierInput } from '@/services/commerce'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'

const EMPTY: SupplierInput = { name: '', contact: '', phone: '', email: '' }

export default function SuppliersPage() {
  const { status, suppliers, products, addSupplier, updateSupplier } = useInventory()
  const canManage = useCan('proveedores.gestionar')
  const canSeeCosts = useCan('costos.ver')
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  const save = async (v: SupplierInput, id?: string) => {
    try {
      if (id) await updateSupplier(id, v)
      else await addSupplier(v)
      toast({ tone: 'ok', text: id ? 'Proveedor actualizado' : `Proveedor «${v.name}» agregado` })
      setEditing(null)
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar.' })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Proveedores</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Quién nos trae cada lote y cuánto de su mercadería está en tienda.</p>
        </div>
        {canManage && editing !== 'new' && (
          <Button variant="accent" size="lg" onClick={() => setEditing('new')}>
            <Plus className="size-5" strokeWidth={2.5} aria-hidden /> Nuevo proveedor
          </Button>
        )}
      </header>

      <AnimatePresence>{editing === 'new' && <SupplierForm initial={EMPTY} onSave={(v) => save(v)} onCancel={() => setEditing(null)} />}</AnimatePresence>

      {status === 'ready' && suppliers.length === 0 && editing !== 'new' && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line px-6 py-14 text-center">
          <Truck className="size-10 text-ink-soft" strokeWidth={1.8} aria-hidden />
          <p className="font-black">Todavía no cargaste proveedores</p>
          <p className="max-w-sm text-sm font-semibold text-ink-soft">Agrégalos para asignarlos a cada lote en Carga Rápida y saber qué mercadería trae cada uno.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {status !== 'ready'
          ? Array.from({ length: 3 }, (_, i) => <Shimmer key={i} className="h-44 rounded-3xl" />)
          : suppliers.map((s) => {
              if (editing === s.id) return <SupplierForm key={s.id} initial={s} onSave={(v) => save(v, s.id)} onCancel={() => setEditing(null)} />
              const own = products.filter((p) => p.supplierId === s.id)
              const units = own.reduce((a, p) => a + p.stock, 0)
              const value = own.reduce((a, p) => a + p.stock * (canSeeCosts ? (p.cost ?? 0) : p.price), 0)
              return (
                <motion.article layout key={s.id} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cielo-wash text-cielo-ink">
                      <Truck className="size-5" strokeWidth={2.4} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-black">{s.name}</h2>
                      <p className="flex items-center gap-1 text-sm font-semibold text-ink-soft">
                        <UserRound className="size-3.5" aria-hidden /> {s.contact || 'Sin contacto'}
                      </p>
                    </div>
                    {canManage && (
                      <button onClick={() => setEditing(s.id)} className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-sunken hover:text-ink" aria-label={`Editar ${s.name}`}>
                        <Pencil className="size-4" />
                      </button>
                    )}
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-sunken p-3 text-center">
                    {[
                      ['Productos', String(own.length)],
                      ['Unidades', String(units)],
                      [canSeeCosts ? 'A costo' : 'A precio venta', formatPrice(value)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-2xs font-extrabold text-ink-soft">{k}</dt>
                        <dd className="num truncate font-black">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-ink">
                        <Phone className="size-4" aria-hidden /> {s.phone}
                      </a>
                    )}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="flex min-w-0 items-center gap-1.5 hover:text-ink">
                        <Mail className="size-4 shrink-0" aria-hidden /> <span className="truncate">{s.email}</span>
                      </a>
                    )}
                  </div>
                </motion.article>
              )
            })}
      </div>
    </div>
  )
}

function SupplierForm({ initial, onSave, onCancel }: { initial: SupplierInput; onSave: (v: SupplierInput) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState<SupplierInput>({ name: initial.name, contact: initial.contact, phone: initial.phone, email: initial.email })
  const [busy, setBusy] = useState(false)
  const nameOk = v.name.trim().length >= 2
  const emailOk = !v.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())
  const set = (k: keyof SupplierInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }))

  return (
    <motion.form
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!nameOk || !emailOk) return
        setBusy(true)
        await onSave({ name: v.name.trim(), contact: v.contact.trim(), phone: v.phone.trim(), email: v.email.trim() })
        setBusy(false)
      }}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-lift ring-2 ring-sol md:col-span-2 xl:col-span-1"
    >
      <h2 className="font-black">{initial.name ? `Editar ${initial.name}` : 'Nuevo proveedor'}</h2>
      <Field label="Nombre o razón social" htmlFor="sf-name" error={v.name && !nameOk ? 'Mínimo 2 caracteres' : undefined}>
        <Input id="sf-name" autoFocus value={v.name} onChange={set('name')} placeholder="Ej.: Distribuidora Sur" />
      </Field>
      <Field label="Persona de contacto" htmlFor="sf-contact">
        <Input id="sf-contact" value={v.contact} onChange={set('contact')} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Teléfono" htmlFor="sf-phone">
          <Input id="sf-phone" inputMode="tel" value={v.phone} onChange={set('phone')} placeholder="+54 11 …" />
        </Field>
        <Field label="Email" htmlFor="sf-email" error={emailOk ? undefined : 'Email inválido'}>
          <Input id="sf-email" type="email" value={v.email} onChange={set('email')} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy || !nameOk || !emailOk}>
          {busy && <Loader2 className="size-4 animate-spin" />} Guardar
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  )
}
