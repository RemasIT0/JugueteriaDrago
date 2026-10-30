import type Papa from 'papaparse'
import type { Category, ProductInput } from '@/types'

/** Encabezados aceptados por columna (sin tildes, en minúscula). */
const ALIASES: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'cod', 'codigo de barras', 'barcode', 'ean', 'upc'],
  name: ['nombre', 'producto', 'descripcion', 'name', 'articulo'],
  category: ['categoria', 'category', 'tipo', 'familia'],
  price: ['precio', 'precio venta', 'pvp', 'price'],
  stock: ['stock', 'cantidad', 'unidades', 'qty', 'cant'],
  ageMin: ['edad', 'edad minima', 'age'],
  batteries: ['baterias', 'pilas', 'batteries'],
  brand: ['marca', 'brand'],
}

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export interface ImportRow {
  line: number
  input: ProductInput | null
  name: string
  problems: string[]
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

export function mapRows(
  rows: unknown[][],
  categories: Category[],
  ctx: { supplierId: string | null; loteId: string; existingSkus: Set<string> },
): ImportRow[] {
  const [header = [], ...body] = rows
  const col: Record<string, number> = {}
  header.forEach((h, i) => {
    const key = Object.entries(ALIASES).find(([, names]) => names.includes(norm(h)))?.[0]
    if (key && col[key] === undefined) col[key] = i
  })
  const get = (r: unknown[], k: string) => (col[k] === undefined ? '' : r[col[k]])
  const seen = new Set<string>()

  return body.map((r, i) => {
    const problems: string[] = []
    const sku = String(get(r, 'sku')).trim()
    const name = String(get(r, 'name')).trim()
    const catName = norm(get(r, 'category'))
    const cat = categories.find((c) => norm(c.name) === catName)
    const price = Number(String(get(r, 'price')).replace(',', '.'))
    const stock = Number(get(r, 'stock'))
    const age = get(r, 'ageMin')
    const bat = norm(get(r, 'batteries'))

    if (sku.length < 4) problems.push('falta código')
    else if (ctx.existingSkus.has(sku)) problems.push('código ya existe')
    else if (seen.has(sku)) problems.push('código repetido en el archivo')
    if (name.length < 2) problems.push('falta nombre')
    if (!cat) problems.push(catName ? `categoría «${get(r, 'category')}» desconocida` : 'falta categoría')
    if (!Number.isFinite(price) || price < 0) problems.push('precio inválido')
    if (!Number.isInteger(stock) || stock < 0) problems.push('cantidad inválida')
    seen.add(sku)

    return {
      line: i + 2,
      name: name || '(sin nombre)',
      problems,
      input:
        problems.length || !cat
          ? null
          : {
              sku,
              name,
              categoryId: cat.id,
              supplierId: ctx.supplierId,
              price,
              stock,
              minStock: cat.defaults.minStock ?? 5,
              ageMin: age === '' ? (cat.defaults.ageMin ?? 3) : Number(age) || 0,
              batteries: bat === '' ? (cat.defaults.batteries ?? false) : ['si', 'sí', 'yes', 'true', '1', 'x'].includes(bat),
              brand: String(get(r, 'brand')).trim(),
              loteId: ctx.loteId,
            },
    }
  })
}

export const TEMPLATE_CSV =
  'codigo,nombre,categoria,precio,cantidad,edad,baterias,marca\n7750123009001,Peluche Tortuga 25 cm,Peluches,32.50,12,,,El Osito\n'
