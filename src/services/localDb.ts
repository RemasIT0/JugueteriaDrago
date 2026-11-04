/**
 * Base de datos local (IndexedDB) para el modo sin servidor.
 * Cada tabla es un arreglo guardado bajo su propia clave. Se cargan una vez a memoria
 * y cada escritura se guarda de inmediato, así una recarga o un corte no pierde nada.
 *
 * Limitación conocida: vive en este navegador y en este equipo. No se comparte entre
 * equipos y alguien con acceso técnico al navegador puede leerla o modificarla.
 */
import { createStore, get, set } from 'idb-keyval'
import { defaultSeasons, defaultSettings } from '@/lib/defaults'
import { cloud, rpc, sb } from './supabase'
import type { AuditEntry, Category, Discount, Product, Sale, Season, Settings, StockMovement, Supplier, User, CashClosing } from '@/types'

export interface Tables {
  products: Product[]
  categories: Category[]
  suppliers: Supplier[]
  movements: StockMovement[]
  users: User[]
  audit: AuditEntry[]
  sales: Sale[]
  discounts: Discount[]
  seasons: Season[]
  /** Una sola fila: la configuración de la tienda. */
  settings: Settings[]
  /** Cierres de caja. */
  closings: CashClosing[]
}

/** Versión del esquema: si cambia la forma de los datos, aquí va la migración no destructiva. */
const SCHEMA_VERSION = 2

const store = createStore('dragotoy', 'tablas')
let cache: Tables | null = null
let loading: Promise<Tables> | null = null

const EMPTY: Tables = { products: [], categories: [], suppliers: [], movements: [], users: [], audit: [], sales: [], discounts: [], seasons: [], settings: [], closings: [] }

export function loadDb(): Promise<Tables> {
  if (cache) return Promise.resolve(cache)
  loading ??= (async () => {
    const entries = await Promise.all((Object.keys(EMPTY) as (keyof Tables)[]).map(async (k) => [k, (await get(k, store)) ?? []] as const))
    cache = Object.fromEntries(entries) as unknown as Tables
    await migrate(cache)
    return cache
  })()
  return loading
}

async function migrate(db: Tables) {
  const v = ((await get('schemaVersion', store)) as number | undefined) ?? 0
  if (v < 1) {
    // v0 → v1: productos antiguos tenían imageUrl en vez de photos.
    db.products = db.products.map((p) => {
      const legacy = p as Product & { imageUrl?: string | null }
      const { imageUrl, ...rest } = legacy
      return { ...rest, photos: rest.photos ?? (imageUrl ? [imageUrl] : []) }
    })
    await save('products')
  }
  if (v < 2) {
    // v1 → v2: precio de compra (desconocido = null, no se inventa) y temporadas.
    db.products = db.products.map((p) => ({ ...p, cost: p.cost ?? null, seasons: p.seasons ?? [] }))
    await save('products')
  }
  // Siempre: que existan las temporadas y la configuración base (no pisa lo que ya hay).
  if (!db.seasons.length) {
    db.seasons = defaultSeasons()
    await save('seasons')
  }
  if (!db.settings.length) {
    db.settings = [defaultSettings()]
    await save('settings')
  }
  if (v !== SCHEMA_VERSION) await set('schemaVersion', SCHEMA_VERSION, store)
}

// ── Sincronización entre pestañas ────────────────────────────────────────────────
// Cada pestaña (panel, tienda) tiene su copia en memoria. Al guardar se avisa a las demás,
// que releen esa tabla: así una venta en la tienda no se pisa con un guardado del panel.
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dragotoy-db') : null
const listeners = new Set<(table: keyof Tables) => void>()

channel?.addEventListener('message', async (e: MessageEvent<{ table: keyof Tables }>) => {
  const table = e.data?.table
  if (!cache || !table || !(table in EMPTY)) return
  ;(cache[table] as unknown) = (await get(table, store)) ?? []
  listeners.forEach((l) => l(table))
})

/**
 * Avisa cuando otra pestaña cambió una tabla (para refrescar la pantalla).
 * En la nube el aviso llega por Realtime desde cualquier equipo: la base inserta una fila
 * en sync_events con el nombre de la tabla que cambió.
 */
export function onExternalChange(fn: (table: keyof Tables) => void) {
  listeners.add(fn)
  if (cloud && listeners.size === 1) subscribeCloud()
  return () => {
    listeners.delete(fn)
    if (cloud && listeners.size === 0) unsubscribeCloud()
  }
}

let cloudChannel: ReturnType<ReturnType<typeof sb>['channel']> | null = null
function subscribeCloud() {
  cloudChannel = sb()
    .channel('dragotoy-sync')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sync_events' }, (payload) => {
      const table = (payload.new as { table_name?: string }).table_name as keyof Tables | undefined
      if (table && table in EMPTY) listeners.forEach((l) => l(table))
    })
    .subscribe()
}
function unsubscribeCloud() {
  if (cloudChannel) void sb().removeChannel(cloudChannel)
  cloudChannel = null
}

/** Guarda una tabla completa. Las tablas son chicas (cientos/miles de filas), así es simple y seguro. */
export async function save<K extends keyof Tables>(table: K) {
  if (!cache) throw new Error('La base local no está cargada')
  await set(table, cache[table], store)
  channel?.postMessage({ table })
}

export async function isInitialized() {
  // En la nube la tienda se inicializa al crear al dueño (initialize_store no repite nada).
  if (cloud) return true
  return (await get('initialized', store)) === true
}

export async function markInitialized() {
  await set('initialized', true, store)
}

/** Copia de seguridad: todo el contenido en un JSON descargable. */
export async function exportBackup(): Promise<Blob> {
  if (cloud) {
    // Todo lo que el dueño puede leer; los usuarios no se exportan (sus contraseñas las guarda Supabase).
    const [products, categories, suppliers, seasons, discounts, settings, sales, movements, audit] = await Promise.all([
      rpc('list_products'), rpc('list_categories'), rpc('list_suppliers'), rpc('list_seasons'), rpc('list_discounts'),
      rpc('get_settings'), rpc('list_sales'), rpc('list_movements', { p_product_id: null, p_days: null }), rpc('list_audit', { p_limit: 5000 }),
    ])
    const data = { app: 'dragotoy', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), source: 'supabase', products, categories, suppliers, seasons, discounts, settings: [settings], sales, movements, audit, users: [] }
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  }
  const db = await loadDb()
  // Las contraseñas viajan solo como hash; aun así el archivo es sensible.
  return new Blob([JSON.stringify({ app: 'dragotoy', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...db }, null, 2)], {
    type: 'application/json',
  })
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text()) as Partial<Tables> & { app?: string }
  if (data.app !== 'dragotoy') throw new Error('El archivo no es una copia de seguridad de DragoToY')
  // En la nube: pasa los datos del navegador a Supabase (una sola vez, con la base vacía).
  if (cloud) return void (await rpc('import_backup', { p: data }))
  const db = await loadDb()
  for (const k of Object.keys(EMPTY) as (keyof Tables)[]) {
    if (!Array.isArray(data[k])) throw new Error(`La copia está incompleta: falta «${k}»`)
  }
  for (const k of Object.keys(EMPTY) as (keyof Tables)[]) {
    ;(db[k] as unknown[]) = data[k] as unknown[]
    await save(k)
  }
}
