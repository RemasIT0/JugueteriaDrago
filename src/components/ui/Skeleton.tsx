import clsx from 'clsx'

/** Bloque base con brillo que cruza, como luz sobre una caja de cartón. */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div className={clsx('relative overflow-hidden bg-sunken', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface/70 to-transparent" />
    </div>
  )
}

/** Fila de carga con forma de caja de juguete: tapa con banda de color y ventana. */
export function ToyBoxSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="relative size-11 shrink-0">
        <Shimmer className="absolute inset-0 rounded-xl" />
        <div className="absolute inset-x-1.5 top-1.5 h-1.5 rounded-full bg-line" />
        <div className="absolute inset-x-2.5 bottom-2 top-4 rounded-md bg-surface/60" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Shimmer className="h-3.5 w-2/5 rounded-full" />
        <Shimmer className="h-3 w-1/4 rounded-full" />
      </div>
      <Shimmer className="hidden h-6 w-24 rounded-full sm:block" />
      <Shimmer className="h-3.5 w-14 rounded-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Cargando inventario">
      {Array.from({ length: rows }, (_, i) => (
        <ToyBoxSkeleton key={i} />
      ))}
    </div>
  )
}
