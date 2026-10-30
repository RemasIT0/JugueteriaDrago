import { AnimatePresence, motion } from 'framer-motion'
import { LuCircleAlert as AlertCircle, LuCircleCheck as CheckCircle2, LuDownload as Download, LuFileSpreadsheet as FileSpreadsheet, LuCircleHelp as HelpCircle, LuInfo as Info, LuLoaderCircle as Loader2, LuCloudUpload as UploadCloud } from 'react-icons/lu'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { BOARD } from '@/lib/colors'
import { uid } from '@/lib/format'
import { nextBoardColor } from '@/services/commerce'
import { useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import { useLote } from '@/stores/lote'
import { findUnknownCategories, mapRows, readRows, type UnknownCategory } from '../importFile'
import { downloadTemplate } from '../templateXlsx'

const NEW = '__nueva__'

/** Respaldo para listas de proveedor: arrastrar un CSV/Excel, revisar y confirmar. */
export function BulkDropzone() {
  const { categories, seasons, settings, products, bulkAdd, addCategory } = useInventory()
  const canCreateCategory = useCan('categorias.crear')
  const { lote, record } = useLote()
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<string | null>(null)
  const [raw, setRaw] = useState<unknown[][] | null>(null)
  const [unknown, setUnknown] = useState<UnknownCategory[]>([])
  /** Qué hacer con cada categoría desconocida: id existente o NEW (crearla). */
  const [choice, setChoice] = useState<Record<string, string>>({})

  // Las que el usuario ya asignó a una existente cuentan como resueltas para la vista previa.
  const resolutions = useMemo(() => Object.fromEntries(Object.entries(choice).filter(([, v]) => v && v !== NEW)), [choice])
  const rows = useMemo(
    () =>
      raw &&
      mapRows(raw, {
        categories,
        seasons,
        settings,
        supplierId: lote.supplierId,
        loteId: lote.id,
        existingSkus: new Set(products.map((p) => p.sku)),
        resolutions,
      }),
    [raw, categories, seasons, settings, lote.supplierId, lote.id, products, resolutions],
  )
  const valid = rows?.filter((r) => r.input) ?? []
  const invalid = rows?.filter((r) => !r.input) ?? []
  const pendingNew = unknown.filter((u) => choice[u.key] === NEW)
  const unresolved = unknown.filter((u) => !choice[u.key])

  async function handle(f: File | undefined) {
    if (!f) return
    if (!/\.(csv|xlsx|xls|txt)$/i.test(f.name)) {
      toast({ tone: 'error', text: 'Ese archivo no es CSV ni Excel. Exporta la lista del proveedor como .csv o .xlsx.' })
      return
    }
    setBusy(true)
    setFile(f.name)
    try {
      const data = await readRows(f)
      const u = findUnknownCategories(data, categories)
      setRaw(data)
      setUnknown(u)
      setChoice(Object.fromEntries(u.map((x) => [x.key, canCreateCategory ? NEW : ''])))
    } catch {
      toast({ tone: 'error', text: 'No se pudo leer el archivo. ¿Está abierto en otro programa o dañado?' })
      reset()
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setRaw(null)
    setFile(null)
    setUnknown([])
    setChoice({})
  }

  /** Crea las categorías nuevas elegidas; la vista previa se recalcula sola con ellas. */
  async function createPending() {
    setBusy(true)
    try {
      let current = [...categories]
      for (const u of pendingNew) {
        const cat = await addCategory({ name: u.label, color: nextBoardColor(current), defaults: { ageMin: 3, batteries: false, minStock: 5 } })
        current = [...current, cat]
        setChoice((c) => ({ ...c, [u.key]: cat.id }))
      }
      toast({ tone: 'ok', text: `${pendingNew.length} categoría${pendingNew.length > 1 ? 's' : ''} creada${pendingNew.length > 1 ? 's' : ''}` })
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo crear la categoría.' })
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
      reset()
    } catch (e) {
      toast({ tone: 'error', text: e instanceof Error ? e.message : 'La importación falló. No se guardó ningún producto.' })
    } finally {
      setBusy(false)
    }
  }

  const getTemplate = async () => {
    try {
      await downloadTemplate(categories, seasons)
    } catch {
      toast({ tone: 'error', text: 'No se pudo generar la plantilla.' })
    }
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
          'relative flex min-h-[16rem] cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-[3px] border-dashed px-6 py-10 text-center transition-colors',
          over ? 'border-turquesa bg-turquesa-wash' : 'border-line bg-surface hover:border-ink-soft/40',
        )}
      >
        <motion.div
          animate={over ? { y: -10, rotate: -4 } : { y: [0, -6, 0] }}
          transition={over ? { type: 'spring', stiffness: 400, damping: 15 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          className={clsx('grid size-20 place-items-center rounded-3xl text-on-fill', over ? 'bg-turquesa' : 'bg-sol')}
        >
          {busy ? <Loader2 className="size-9 animate-spin" /> : <UploadCloud className="size-9" strokeWidth={2.2} />}
        </motion.div>
        <div className="flex flex-col gap-1">
          <p className="text-xl font-black">{over ? 'Suelta el archivo aquí' : 'Arrastra la lista del proveedor'}</p>
          <p className="text-sm font-semibold text-ink-soft">Excel (.xlsx) o CSV. También puedes hacer clic para elegirlo.</p>
        </div>
        <input
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sunken px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <FileSpreadsheet className="size-5 shrink-0 text-hoja-ink" aria-hidden />
          La plantilla trae las columnas ordenadas, colores, listas con tus categorías y una hoja de instrucciones.
        </p>
        <Button variant="secondary" size="sm" className="bg-surface" onClick={() => void getTemplate()}>
          <Download className="size-4" aria-hidden /> Descargar plantilla Excel
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

            {unknown.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border-2 border-sol bg-sol-wash/60 p-4">
                <p className="flex items-center gap-2 font-black">
                  <HelpCircle className="size-5 text-sol-ink" aria-hidden />
                  {unknown.length === 1 ? 'Hay una categoría que no existe' : `Hay ${unknown.length} categorías que no existen`}
                </p>
                <p className="text-sm font-semibold text-ink-soft">Elige para cada una si la creamos como nueva o si va en una que ya tienes.</p>
                <ul className="flex flex-col gap-2">
                  {unknown.map((u) => (
                    <li key={u.key} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2">
                      <span className="min-w-0 flex-1 font-extrabold">
                        «{u.label}» <span className="num text-xs font-bold text-ink-soft">· {u.count} fila{u.count > 1 ? 's' : ''}</span>
                      </span>
                      <Select
                        aria-label={`Qué hacer con ${u.label}`}
                        value={choice[u.key] ?? ''}
                        onChange={(e) => setChoice((c) => ({ ...c, [u.key]: e.target.value }))}
                        className="h-10 w-64 text-sm"
                      >
                        <option value="">Elegir…</option>
                        {canCreateCategory && <option value={NEW}>Crear «{u.label}» como nueva</option>}
                        <optgroup label="Usar una existente">
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      </Select>
                      {choice[u.key] && choice[u.key] !== NEW && (
                        <span className={clsx('size-3 rounded-full', BOARD[categories.find((c) => c.id === choice[u.key])?.color ?? 'sol'].fill)} aria-hidden />
                      )}
                    </li>
                  ))}
                </ul>
                {pendingNew.length > 0 && (
                  <Button variant="accent" className="self-start" disabled={busy} onClick={() => void createPending()}>
                    {busy && <Loader2 className="size-4 animate-spin" />} Crear {pendingNew.length} categoría{pendingNew.length > 1 ? 's' : ''} y continuar
                  </Button>
                )}
                {unresolved.length > 0 && <p className="text-xs font-bold text-sol-ink">Mientras no elijas, esas filas no se importan.</p>}
              </div>
            )}

            {rows.length === 0 ? (
              <p className="text-sm font-semibold text-ink-soft">El archivo no tiene filas debajo del encabezado.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-line overflow-auto rounded-2xl border-2 border-line">
                {rows.slice(0, 300).map((r) => (
                  <li key={r.line} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    {r.input ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-turquesa-ink" aria-label="Lista" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-peligro" aria-label="Con problemas" />
                    )}
                    <span className="num w-10 shrink-0 text-xs font-bold text-ink-soft">#{r.line}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                    {r.problems.length > 0 && <span className="text-xs font-bold text-peligro">{r.problems.join(' · ')}</span>}
                    {r.note && !r.problems.length && (
                      <span className="flex items-center gap-1 text-xs font-bold text-cielo-ink">
                        <Info className="size-3.5" aria-hidden /> {r.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="lg" disabled={!valid.length || busy || pendingNew.length > 0} onClick={() => void confirm()}>
                {busy ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
                Importar {valid.length} productos
              </Button>
              <Button variant="ghost" onClick={reset}>
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
