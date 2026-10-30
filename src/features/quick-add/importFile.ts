import type Papa from 'papaparse'
import { marginFor, recommendedPrice } from '@/lib/pricing'
import type { Category, ProductInput, Season, Settings } from '@/types'

/** Encabezados aceptados por columna (sin tildes, en minúscula, sin asteriscos). */
const ALIASES: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'cod', 'codigo de barras', 'barcode', 'ean', 'upc'],
  name: ['nombre', 'producto', 'nombre del producto', 'descripcion', 'name', 'articulo'],
  category: ['categoria', 'category', 'tipo', 'familia', 'rubro'],
  cost: ['precio de compra', 'precio compra', 'costo', 'cost', 'compra'],
  price: ['precio', 'precio de venta', 'precio venta', 'pvp', 'price', 'venta'],
  stock: ['stock', 'cantidad', 'unidades', 'qty', 'cant'],
  ageMin: ['edad', 'edad minima', 'age'],
  batteries: ['baterias', 'pilas', 'batteries', 'requiere baterias'],
  brand: ['marca', 'brand'],
  seasons: ['temporada', 'temporadas', 'season'],
}

export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*()]/g, '')
    .toLowerCase()
    .trim()

/**
 * Montos escritos a mano: "12.500,50" (formato argentino), "12500.5", "39,90" o "$ 1.200".
 * Un punto seguido de exactamente 3 dígitos se toma como separador de miles.
 */
export function parseAmount(v: unknown): number {
  if (typeof v === 'number') return v
  let s = String(v ?? '').replace(/[$\s]/g, '')
  if (!s) return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  return Number(s)
}

export interface ImportRow {
  line: number
  input: ProductInput | null
  name: string
  problems: string[]
  /** Nota informativa (no impide importar), p. ej. "precio sugerido". */
  note?: string
}

export interface UnknownCategory {
  key: string
  label: string
  count: number
}

export async function readRows(file: File): Promise<unknown[][]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    return (await readSheet(file)) as unknown[][]
  }
  const text = await file.text()
  const { default: parser } = (await import('papaparse')) as { default: typeof Papa }
  return parser.parse<unknown[]>(text, { skipEmptyLines: true }).data
}

/** La plantilla tiene título e instrucciones arriba: el encabezado es la primera fila con código y nombre. */
function findHeader(rows: unknown[][]) {
  const isAlias = (cell: unknown, key: string) => ALIASES[key].includes(norm(cell))
  const i = rows.findIndex((r) => r.some((c) => isAlias(c, 'sku')) && r.some((c) => isAlias(c, 'name')))
  return i < 0 ? 0 : i
}

/** Categorías del archivo que no coinciden con ninguna existente, para que el usuario decida. */
export function findUnknownCategories(rows: unknown[][], categories: Category[]): UnknownCategory[] {
  const h = findHeader(rows)
  const col = rows[h]?.findIndex((c) => ALIASES.category.includes(norm(c))) ?? -1
  if (col < 0) return []
  const known = new Set(categories.map((c) => norm(c.name)))
  const found = new Map<string, UnknownCategory>()
  for (const r of rows.slice(h + 1)) {
    const label = String(r[col] ?? '').trim()
    const key = norm(label)
    if (!key || known.has(key)) continue
    const u = found.get(key) ?? { key, label, count: 0 }
    u.count++
    found.set(key, u)
  }
  return [...found.values()]
}

export function mapRows(
  rows: unknown[][],
  ctx: {
    categories: Category[]
    seasons: Season[]
    settings: Settings | undefined
    supplierId: string | null
    loteId: string
    existingSkus: Set<string>
    /** Decisión del usuario para categorías desconocidas: nombre normalizado → id de categoría. */
    resolutions: Record<string, string>
  },
): ImportRow[] {
  const h = findHeader(rows)
  const header = rows[h] ?? []
  const body = rows.slice(h + 1)
  const col: Record<string, number> = {}
  header.forEach((cell, i) => {
    const key = Object.entries(ALIASES).find(([, names]) => names.includes(norm(cell)))?.[0]
    if (key && col[key] === undefined) col[key] = i
  })
  const get = (r: unknown[], k: string) => (col[k] === undefined ? '' : r[col[k]])
  const num = parseAmount
  const seen = new Set<string>()

  return body
    .map((r, i) => ({ r, line: h + i + 2 }))
    .filter(({ r }) => r.some((c) => String(c ?? '').trim() !== ''))
    .map(({ r, line }) => {
      const problems: string[] = []
      let note: string | undefined
      const sku = String(get(r, 'sku')).trim()
      const name = String(get(r, 'name')).trim()
      const catKey = norm(get(r, 'category'))
      const cat = ctx.categories.find((c) => norm(c.name) === catKey) ?? ctx.categories.find((c) => c.id === ctx.resolutions[catKey])
      const rawCost = get(r, 'cost')
      const cost = rawCost === '' || rawCost === null ? null : num(rawCost)
      const rawPrice = get(r, 'price')
      let price = rawPrice === '' || rawPrice === null ? NaN : num(rawPrice)
      const stock = num(get(r, 'stock'))
      const age = get(r, 'ageMin')
      const bat = norm(get(r, 'batteries'))
      const seasonNames = String(get(r, 'seasons') ?? '')
        .split(/[,;/]/)
        .map(norm)
        .filter(Boolean)
      const seasonIds = seasonNames.map((n) => ctx.seasons.find((s) => norm(s.name) === n)?.id)

      if (sku.length < 4) problems.push('falta código')
      else if (ctx.existingSkus.has(sku)) problems.push('código ya existe')
      else if (seen.has(sku)) problems.push('código repetido en el archivo')
      if (name.length < 2) problems.push('falta nombre')
      if (!cat) problems.push(catKey ? `categoría «${String(get(r, 'category')).trim()}» sin asignar` : 'falta categoría')
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) problems.push('precio de compra inválido')
      if (!Number.isFinite(price) && cost !== null && Number.isFinite(cost) && cat) {
        // Sin precio de venta pero con costo: se usa el recomendado y se avisa.
        price = recommendedPrice(cost, marginFor(cat, ctx.settings)) ?? NaN
        note = 'precio de venta recomendado'
      }
      if (!Number.isFinite(price) || price < 0) problems.push('precio de venta inválido')
      if (!Number.isInteger(stock) || stock < 0) problems.push('cantidad inválida')
      if (seasonIds.some((id) => !id)) problems.push('temporada desconocida')
      seen.add(sku)

      return {
        line,
        name: name || '(sin nombre)',
        problems,
        note,
        input:
          problems.length || !cat
            ? null
            : {
                sku,
                name,
                categoryId: cat.id,
                supplierId: ctx.supplierId,
                price,
                cost: cost !== null && Number.isFinite(cost) ? cost : null,
                seasons: seasonIds as string[],
                stock,
                minStock: cat.defaults.minStock ?? 5,
                ageMin: age === '' || age === null ? (cat.defaults.ageMin ?? 3) : Number(age) || 0,
                batteries: bat === '' ? (cat.defaults.batteries ?? false) : ['si', 'yes', 'true', '1', 'x'].includes(bat),
                brand: String(get(r, 'brand') ?? '').trim(),
                loteId: ctx.loteId,
              },
      }
    })
}
