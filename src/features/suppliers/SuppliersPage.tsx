import { Mail, Phone, Truck } from 'lucide-react'
import { Shimmer } from '@/components/ui/Skeleton'
import { formatPrice } from '@/lib/format'
import { useInventory } from '@/stores/inventory'

export default function SuppliersPage() {
  const { status, suppliers, products } = useInventory()

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Proveedores</h1>
        <p className="mt-1 text-sm font-semibold text-ink-soft">Quién nos trae cada lote y cuánto de su mercadería está en tienda.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {status !== 'ready'
          ? Array.from({ length: 3 }, (_, i) => <Shimmer key={i} className="h-44 rounded-3xl" />)
          : suppliers.map((s) => {
              const own = products.filter((p) => p.supplierId === s.id)
              const units = own.reduce((a, p) => a + p.stock, 0)
              const value = own.reduce((a, p) => a + p.stock * p.price, 0)
              return (
                <article key={s.id} className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cielo-wash text-cielo-ink">
                      <Truck className="size-5" strokeWidth={2.4} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-black">{s.name}</h2>
                      <p className="text-sm font-semibold text-ink-soft">{s.contact}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-sunken p-3 text-center">
                    {[
                      ['Productos', String(own.length)],
                      ['Unidades', String(units)],
                      ['En tienda', formatPrice(value)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-2xs font-extrabold text-ink-soft">{k}</dt>
                        <dd className="num truncate font-black">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
                    <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-ink">
                      <Phone className="size-4" aria-hidden /> {s.phone}
                    </a>
                    <a href={`mailto:${s.email}`} className="flex min-w-0 items-center gap-1.5 hover:text-ink">
                      <Mail className="size-4 shrink-0" aria-hidden /> <span className="truncate">{s.email}</span>
                    </a>
                  </div>
                </article>
              )
            })}
      </div>
    </div>
  )
}
