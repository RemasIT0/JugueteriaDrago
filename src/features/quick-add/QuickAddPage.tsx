import { motion } from 'framer-motion'
import { ChevronDown, FileSpreadsheet, Keyboard, Target, Zap } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'
import { Kbd } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { useInventory } from '@/stores/inventory'
import { useCan } from '@/stores/auth'
import { useLote } from '@/stores/lote'
import { BulkDropzone } from './components/BulkDropzone'
import { CameraScanner, cameraScanSupported } from './components/CameraScanner'
import { LoteTrack } from './components/LoteTrack'
import { QuickAddForm } from './components/QuickAddForm'
import { RecentStack } from './components/RecentStack'
import { MOD } from '@/hooks/useHotkeys'

type Mode = 'continua' | 'archivo'

export default function QuickAddPage() {
  const [mode, setMode] = useState<Mode>('continua')
  const canImport = useCan('productos.importar')
  const [lastMs, setLastMs] = useState<number | null>(null)
  const [camera, setCamera] = useState(false)
  const undoRef = useRef<() => void>(() => {})
  const suppliers = useInventory((s) => s.suppliers)
  const { lote, setGoal, setSupplier, startNew } = useLote()
  const supplier = suppliers.find((s) => s.id === lote.supplierId)

  // La cámara usa el mismo camino que el lector USB.
  const scanRef = useRef<(code: string) => void>(() => {})
  const onCameraScan = useCallback((code: string) => scanRef.current(code), [])

  const closeCamera = useCallback(() => setCamera(false), [])
  const [setupOpen, setSetupOpen] = useState(false)

  /** Cerrar el lote se puede deshacer: el lote anterior queda guardado hasta que cierre el aviso. */
  const closeLote = () => {
    const prev = lote
    if (prev.entries.length && !confirm(`¿Cerrar el lote de ${prev.entries.length} productos y empezar otro?`)) return
    startNew()
    toast({
      tone: 'ok',
      text: prev.entries.length ? `Lote de ${prev.entries.length} productos cerrado` : 'Lote nuevo listo',
      action: prev.entries.length ? { label: 'Deshacer', run: () => useLote.setState({ lote: prev }) } : undefined,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Carga Rápida</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            {supplier ? supplier.name : 'Sin proveedor asignado'} · lote iniciado{' '}
            {new Date(lote.startedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        {canImport && (
        <div role="tablist" aria-label="Modo de carga" className="flex rounded-2xl bg-sunken p-1">
          {(
            [
              ['continua', 'Carga continua', Zap],
              ['archivo', 'Desde archivo', FileSpreadsheet],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={clsx(
                'relative flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition-colors',
                mode === id ? 'text-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              {mode === id && (
                <motion.span layoutId="qa-mode" className="absolute inset-0 rounded-xl bg-surface shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
              )}
              <Icon className="relative size-4" strokeWidth={2.5} aria-hidden />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        )}
      </header>

      {/* En el celular los datos del lote se pliegan en una línea para que el formulario quede arriba. */}
      <button
        onClick={() => setSetupOpen((o) => !o)}
        aria-expanded={setupOpen}
        className="flex items-center justify-between gap-3 rounded-2xl bg-sunken px-4 py-3 text-left text-sm font-extrabold sm:hidden"
      >
        <span className="min-w-0 truncate">
          Lote: {supplier ? supplier.name : 'sin proveedor'} · meta <span className="num">{lote.goal}</span>
        </span>
        <ChevronDown className={clsx('size-4 shrink-0 transition-transform', setupOpen && 'rotate-180')} aria-hidden />
      </button>

      <div className={clsx('flex-wrap items-end gap-3 sm:flex', setupOpen ? 'flex' : 'hidden')}>
        <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-1 sm:max-w-xs">
          <span className="text-xs font-extrabold text-ink-soft">Proveedor del lote</span>
          <Select value={lote.supplierId ?? ''} onChange={(e) => setSupplier(e.target.value || null)} className="h-11">
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex w-28 flex-col gap-1.5">
          <span className="flex items-center gap-1 text-xs font-extrabold text-ink-soft">
            <Target className="size-3.5" aria-hidden /> Meta
          </span>
          <input
            type="number"
            min={1}
            max={500}
            value={lote.goal}
            onChange={(e) => setGoal(Number(e.target.value) || 1)}
            className="num h-11 rounded-xl border-2 border-line bg-surface px-3 font-bold focus:border-turquesa focus:shadow-focus focus:outline-none"
          />
        </label>
      </div>

      <LoteTrack onNewLote={closeLote} />

      {mode === 'continua' || !canImport ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <QuickAddForm
              onSaved={setLastMs}
              undoRef={undoRef}
              scanRef={scanRef}
              onOpenCamera={cameraScanSupported() ? () => setCamera(true) : undefined}
            />
            <ShortcutStrip />
          </div>
          <RecentStack lastMs={lastMs} onUndo={() => undoRef.current()} />
        </div>
      ) : (
        <BulkDropzone />
      )}

      <CameraScanner open={camera} onClose={closeCamera} onScan={onCameraScan} />
    </div>
  )
}

function ShortcutStrip() {
  const items: [string, string][] = [
    [`${MOD} ↵`, 'guardar y seguir'],
    ['↵', 'en el código: siguiente campo'],
    ['Alt 1–6', 'categoría'],
    ['Alt N', 'limpiar'],
    [`${MOD} Z`, 'deshacer el último'],
  ]
  return (
    <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 px-2 text-xs font-bold text-ink-soft md:flex">
      <Keyboard className="size-4" aria-hidden />
      {items.map(([k, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <Kbd>{k}</Kbd> {label}
        </span>
      ))}
    </div>
  )
}
