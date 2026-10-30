import { z } from 'zod'
import { parseAmount } from './importFile'

/** Acepta "39,90" y "39.90"; vacío cuenta como sin valor. */
const decimal = (msg: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : parseAmount(v)) : v),
    z.number({ error: msg }).finite({ error: msg }),
  )

const integer = (msg: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : Number(v)) : v),
    z.number({ error: msg }).int({ error: 'Debe ser un número entero' }),
  )

export const quickAddSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(4, { error: 'Escanea o escribe el código (mín. 4 caracteres)' })
    .max(32, { error: 'Máximo 32 caracteres' })
    .regex(/^[\p{L}\p{N}-]+$/u, { error: 'Solo letras, números y guiones' }),
  name: z.string().trim().min(2, { error: 'Escribe el nombre del producto' }).max(120, { error: 'Máximo 120 caracteres' }),
  categoryId: z.string().min(1, { error: 'Elige una categoría' }),
  cost: z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? null : parseAmount(v)) : v),
    z.number({ error: 'Precio de compra inválido' }).min(0, { error: 'No puede ser negativo' }).nullable(),
  ),
  price: decimal('Escribe el precio de venta').pipe(z.number().min(0, { error: 'El precio no puede ser negativo' })),
  stock: integer('¿Cuántas unidades llegaron?').pipe(z.number().min(1, { error: 'Al menos 1 unidad' }).max(9999)),
  ageMin: integer('Edad inválida').pipe(z.number().min(0).max(18, { error: 'Máximo 18 años' })),
  batteries: z.boolean(),
  minStock: integer('Stock mínimo inválido').pipe(z.number().min(0).max(999)),
  brand: z.string().trim().max(60),
  seasons: z.array(z.string()),
})

export type QuickAddInput = z.input<typeof quickAddSchema>
export type QuickAddValues = z.output<typeof quickAddSchema>

/** Valores que se mantienen de un producto al siguiente dentro del mismo lote. */
export const STICKY_FIELDS = ['categoryId', 'ageMin', 'batteries', 'minStock', 'brand', 'seasons'] as const
