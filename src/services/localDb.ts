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
import type { AuditEntry, Category, Discount, Product, Sale, Season, Settings, StockMovement, Supplier, User } from '@/types'

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
}

/** Versión del esquema: si cambia la forma de los datos, aquí va la migración no destructiva. */
const SCHEMA_VERSION = 2

const store = createStore('dragotoy', 'tablas')
let cache: Tables | null = null
let loading: Promise<Tables> | null = null

const EMPTY: Tables = { products: [], categories: [], suppliers: [], movements: [], users: [], audit: [], sales: [], discounts: [], seasons: [], settings: [] }

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

/** Guarda una tabla completa. Las tablas son chicas (cientos/miles de filas), así es simple y seguro. */
export async function save<K extends keyof Tables>(table: K) {
  if (!cache) throw new Error('La base local no está cargada')
  await set(table, cache[table], store)
}

export async function isInitialized() {
  return (await get('initialized', store)) === true
}

export async function markInitialized() {
  await set('initialized', true, store)
}

/** Copia de seguridad: todo el contenido en un JSON descargable. */
export async function exportBackup(): Promise<Blob> {
  const db = await loadDb()
  // Las contraseñas viajan solo como hash; aun así el archivo es sensible.
  return new Blob([JSON.stringify({ app: 'dragotoy', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...db }, null, 2)], {
    type: 'application/json',
  })
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text()) as Partial<Tables> & { app?: string }
  if (data.app !== 'dragotoy') throw new Error('El archivo no es una copia de seguridad de DragoToY')
  const db = await loadDb()
  for (const k of Object.keys(EMPTY) as (keyof Tables)[]) {
    if (!Array.isArray(data[k])) throw new Error(`La copia está incompleta: falta «${k}»`)
  }
  for (const k of Object.keys(EMPTY) as (keyof Tables)[]) {
    ;(db[k] as unknown[]) = data[k] as unknown[]
    await save(k)
  }
}
