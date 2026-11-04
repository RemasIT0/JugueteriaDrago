import type { ProductRow } from '@/types'

/**
 * Carga desde una lista escrita o pegada (por ejemplo, el pedido que manda un proveedor por WhatsApp):
 * «Peluche Dragón 30 cm x12, Osito Miel 6, Muñeca Bailarina 4».
 *
 * Cada elemento se separa por coma, punto y coma o renglón. La cantidad va al final («x12», «12»,
 * «12 u») o al principio («12 Osito Miel»). El nombre se compara con el inventario tolerando errores
 * de escritura («Stich» → «Stitch»), y si hay dudas se pregunta en vez de adivinar.
 */

export interface Suggestion {
  product: ProductRow
  /** 0 a 1: qué tan parecido es al texto escrito. */
  score: number
}

export type ListStatus =
  | 'ok' // producto encontrado y cantidad clara
  | 'sugerencia' // hay parecidos: «¿quisiste decir…?»
  | 'sin-cantidad' // el producto está claro pero falta la cantidad
  | 'numero-dudoso' // el número final puede ser la cantidad o parte del nombre («Pista de carreras en 8»)
  | 'no-encontrado'

export interface ListRow {
  id: string
  /** Texto tal como lo escribió la persona. */
  raw: string
  /** Parte del texto que se interpretó como nombre. */
  query: string
  qty: number | null
  status: ListStatus
  product: ProductRow | null
  suggestions: Suggestion[]
  /** Solo en «numero-dudoso»: la otra lectura posible (todo el texto como nombre, sin cantidad). */
  alt?: { product: ProductRow }
}

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'y', 'para', 'a', 'un', 'una'])
const UNIT = /^(u|un|uds?|unid|unidad(es)?|pzas?|piezas?|cajas?)$/
/** Medidas y números del nombre («30 cm», «500 piezas»): casi nadie los escribe, así que no faltan si se omiten. */
const MEASURE = /^(d+|cm|mm|m|kg|g|lt?|ml|pzs?|pzas?|piezas?|años?|meses)$/
const MAX_QTY = 9999

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()

/** «30cm» → «30 cm»: números y letras pegados se separan para compararlos por separado. */
export const tokens = (s: string) => normalize(s).replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').split(' ').filter(Boolean)

function levenshtein(a: string, b: string) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Parecido entre dos palabras (0 a 1). Los números tienen que ser iguales; un prefijo («peluch» → «peluche») cuenta casi completo. */
function wordSim(a: string, b: string) {
  if (a === b) return 1
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return 0
  if (a.length >= 3 && b.startsWith(a)) return 0.9
  return Math.max(0, 1 - levenshtein(a, b) / Math.max(a.length, b.length))
}

/**
 * Qué tan bien describe el texto al producto (0 a 1). Pesa sobre todo que cada palabra escrita
 * exista en el nombre; en menor medida, que se hayan escrito las palabras importantes del nombre.
 */
export function score(query: string, product: Pick<ProductRow, 'name' | 'sku'>) {
  return detail(query, product).score
}

function detail(query: string, product: Pick<ProductRow, 'name' | 'sku'>) {
  const q = tokens(query)
  if (!q.length) return { score: 0, written: 0 }
  if (q.length === 1 && q[0] === normalize(product.sku)) return { score: 1, written: 1 }
  const p = tokens(product.name)
  const weight = (t: string) => (STOP.has(t) ? 0.3 : 1)
  let got = 0, total = 0
  for (const t of q) {
    const best = Math.max(0, ...p.map((w) => wordSim(t, w)))
    got += (best >= 0.6 ? best : 0) * weight(t)
    total += weight(t)
  }
  const key = p.filter((w) => !STOP.has(w) && !MEASURE.test(w))
  const covered = key.filter((w) => q.some((t) => wordSim(t, w) >= 0.8)).length
  const written = got / total
  return { score: written * 0.75 + (key.length ? covered / key.length : 1) * 0.25, written }
}

export function suggest(query: string, products: ProductRow[], limit = 3): Suggestion[] {
  return products
    .map((product) => ({ product, ...detail(query, product) }))
    .filter((s) => s.score >= 0.45 && s.written >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Un acierto claro: muy parecido y bien separado del segundo. */
const SURE = 0.85
const GAP = 0.08
const isSure = (s: Suggestion[]) => !!s[0] && s[0].score >= SURE && (!s[1] || s[0].score - s[1].score >= GAP)

/** Separa «nombre» y «cantidad» de un elemento. Devuelve también la lectura sin cantidad si el número final es ambiguo. */
export function splitQty(raw: string): { query: string; qty: number | null; trailingBare: boolean } {
  let s = raw.trim().replace(/\s+/g, ' ')
  // «x12», «x 12», «×12», «12x» o «12 u / unidades» al final
  let m = s.match(/^(.*?)[\s,:-]*(?:[x×]\s*(\d{1,4})|(\d{1,4})\s*[x×]|(\d{1,4})\s+(?:u|un|uds?|unid|unidad(?:es)?))\.?$/i)
  if (m && m[1].trim()) return { query: m[1].trim(), qty: Number(m[2] ?? m[3] ?? m[4]), trailingBare: false }
  // «12 Osito Miel», «12 x Osito Miel», «12 unidades de Osito Miel» al principio
  m = s.match(/^(\d{1,4})\s*(?:[x×]|(?:u|uds?|unidad(?:es)?)(?:\s+de)?)?\s+(.+)$/i)
  if (m && /[a-z]/i.test(m[2])) return { query: m[2].trim(), qty: Number(m[1]), trailingBare: false }
  // «Osito Miel 6»: número suelto al final (puede ser parte del nombre)
  m = s.match(/^(.*\D)\s(\d{1,4})$/)
  if (m && !UNIT.test(normalize(m[1]).split(' ').at(-1) ?? '')) return { query: m[1].trim(), qty: Number(m[2]), trailingBare: true }
  return { query: s, qty: null, trailingBare: false }
}

let seq = 0
export function parseList(text: string, products: ProductRow[]): ListRow[] {
  return text
    .split(/[,;\n]+/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const id = `l${++seq}`
      const { query, qty, trailingBare } = splitQty(raw)
      const validQty = qty !== null && qty > 0 && qty <= MAX_QTY ? qty : null
      const found = suggest(query, products)

      // «Pista de carreras en 8»: ¿el 8 es la cantidad o parte del nombre?
      // Se pregunta si el producto más parecido lleva ese número en el nombre.
      if (trailingBare && qty !== null) {
        const whole = suggest(raw, products)
        if (isSure(whole) && tokens(whole[0].product.name).includes(String(qty))) {
          return { id, raw, query, qty: validQty, status: 'numero-dudoso', product: found[0] && isSure(found) ? found[0].product : null, suggestions: found, alt: { product: whole[0].product } } satisfies ListRow
        }
      }
      if (isSure(found)) return { id, raw, query, qty: validQty, status: validQty ? 'ok' : 'sin-cantidad', product: found[0].product, suggestions: found } satisfies ListRow
      if (found.length) return { id, raw, query, qty: validQty, status: 'sugerencia', product: null, suggestions: found } satisfies ListRow
      return { id, raw, query, qty: validQty, status: 'no-encontrado', product: null, suggestions: [] } satisfies ListRow
    })
}
