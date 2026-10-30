import { STORE } from './config'
import type { Product, StockLevel } from '@/types'

const money = new Intl.NumberFormat(STORE.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat(STORE.locale, { day: '2-digit', month: 'short' })
const time = new Intl.DateTimeFormat(STORE.locale, { hour: '2-digit', minute: '2-digit' })

export const formatPrice = (n: number) => `${STORE.currency} ${money.format(n)}`
export const formatDate = (iso: string) => date.format(new Date(iso))
export const formatTime = (iso: string) => time.format(new Date(iso))
export const formatAge = (age: number) => (age <= 0 ? 'Todas las edades' : `+${age} años`)

export function stockLevel(p: Pick<Product, 'stock' | 'minStock'>): StockLevel {
  if (p.stock <= p.minStock) return 'bajo'
  if (p.stock >= p.minStock * 3) return 'alto'
  return 'medio'
}

export const STOCK_LABEL: Record<StockLevel, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
