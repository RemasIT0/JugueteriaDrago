import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toaster'
import { useInventory } from '@/stores/inventory'
import { useLote } from '@/stores/lote'
import { uid } from '@/lib/format'
import { mapRows, readRows, TEMPLATE_CSV, type ImportRow } from '../importFile'

/** Respaldo para listas de proveedor: arrastrar un CSV/Excel, revisar y confirmar. */
export function BulkDropzone() {
  const categories = useInventory((s) => s.categories)
  const products = useInventory((s) => s.products)
  const bulkAdd = useInventory((s) => s.bulkAdd)
  const { lote, record } = useLote()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)

  const valid = rows?.filter((r) => r.input) ?? []
  const invalid = rows?.filter((r) => !r.input) ?? []

  async function handle(f: File | undefined) {
    if (!f) return
    if (!/\.(csv|xlsx|xls|txt)$/i.test(f.name)) {
      toast({ tone: 'error', text: 'Ese archivo no es CSV ni Excel. Exporta la lista del proveedor como .csv o .xlsx.' })
      return
    }
    setBusy(true)
    setFile(f.name)
    try {
      const raw = await readRows(f)
      setRows(
        mapRows(raw, categories, {
          supplierId: lote.supplierId,
          loteId: lote.id,
          existingSkus: new Set(products.map((p) => p.sku)),
        }),
      )
    } catch {
      toast({ tone: 'error', text: 'No se pudo leer el archivo. ¿Está abierto en otro programa o dañado?' })
      setRows(null)
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setBusy(true)
    try {
      const inputs = valid.map((r) => r.input!)
      const n = await bulkAdd(inputs)
      const at = new Date().toISOString()
      inputs.forEach((p) => record({ id: uid('e'), kind: 'nuevo', productId: p.sku, sku: p.sku, name: p.name, categoryId: p.categoryId, qty: p.stock, stock: p.stock, minStock: p.minStock, at }))
      toast({ tone: 'ok', text: `${n} productos importados al lote` })
      setRows(null)
      setFile(null)
    } catch {
      toast({ tone: 'error', text: 'La importación falló. No se guardó ningún producto; intenta de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'plantilla-dragotoy.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex flex-col gap-4">
      <motion.label
        htmlFor="bulk-file"
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void handle(e.dataTransfer.files[0])
        }}
        animate={{ scale: over ? 1.015 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        className={clsx(
          'relative flex min-h-[18rem] cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-[3px] border-dashed px-6 py-10 text-center transition-colors',
          over ? 'border-turquesa bg-turquesa-wash' : 'border-line bg-surface hover:border-ink-soft/40',
        )}
      >
        <motion.div
          animate={over ? { y: -10, rotate: -4 } : { y: [0, -6, 0] }}
          transition={over ? { type: 'spring', stiffness: 400, damping: 15 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          className={clsx('grid size-20 place-items-center rounded-3xl', over ? 'bg-turquesa text-on-fill' : 'bg-sol text-on-fill')}
        >
          {busy ? <Loader2 className="size-9 animate-spin" /> : <UploadCloud className="size-9" strokeWidth={2.2} />}
        </motion.div>
        <div className="flex flex-col gap-1">
          <p className="text-xl font-black">{over ? 'Suelta el archivo aquí' : 'Arrastra la lista del proveedor'}</p>
          <p className="text-sm font-semibold text-ink-soft">CSV o Excel (.xlsx). También puedes hacer clic para elegirlo.</p>
        </div>
        <input
          ref={input}
          id="bulk-file"
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          className="sr-only"
          onChange={(e) => {
            void handle(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </motion.label>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs font-semibold text-ink-soft">
          Columnas: código, nombre, categoría, precio, cantidad. Edad, baterías y marca son opcionales (si faltan, usa la plantilla de la categoría).
        </p>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          <Download className="size-4" aria-hidden /> Descargar plantilla
        </Button>
      </div>

      <AnimatePresence>
        {rows && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-3">
              <FileSpreadsheet className="size-5 text-turquesa-ink" aria-hidden />
              <p className="font-extrabold">{file}</p>
              <span className="num rounded-full bg-turquesa-wash px-2.5 py-0.5 text-xs font-extrabold text-turquesa-ink">{valid.length} listos</span>
              {invalid.length > 0 && (
                <span className="num rounded-full bg-peligro-wash px-2.5 py-0.5 text-xs font-extrabold text-peligro">{invalid.length} con problemas</span>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="text-sm font-semibold text-ink-soft">El archivo no tiene filas debajo del encabezado.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-line overflow-auto rounded-2xl border-2 border-line">
                {rows.slice(0, 200).map((r) => (
                  <li key={r.line} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    {r.input ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-turquesa-ink" aria-label="Lista" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-peligro" aria-label="Con problemas" />
                    )}
                    <span className="num w-10 shrink-0 text-xs font-bold text-ink-soft">#{r.line}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                    {r.problems.length > 0 && <span className="text-xs font-bold text-peligro">{r.problems.join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="lg" disabled={!valid.length || busy} onClick={() => void confirm()}>
                {busy ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
                Importar {valid.length} productos
              </Button>
              <Button variant="ghost" onClick={() => (setRows(null), setFile(null))}>
                Cancelar
              </Button>
            </div>
            {invalid.length > 0 && valid.length > 0 && (
              <p className="text-xs font-semibold text-ink-soft">Las filas con problemas no se importan. Corrígelas en el archivo y vuelve a soltarlo.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
