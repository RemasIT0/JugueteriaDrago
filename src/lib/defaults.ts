import type { Season, SeasonRule, Settings } from '@/types'

/** Fechas clave de una juguetería en Argentina. Editables desde Temporadas. */
export const defaultSeasons = (): Season[] => [
  { id: 'temp_navidad', name: 'Navidad', color: 'coral', rule: { type: 'fija', month: 12, day: 25 }, leadDays: 45 },
  { id: 'temp_reyes', name: 'Reyes', color: 'sol', rule: { type: 'fija', month: 1, day: 6 }, leadDays: 30 },
  // Día de las Infancias: tercer domingo de agosto.
  { id: 'temp_infancias', name: 'Día de las Infancias', color: 'turquesa', rule: { type: 'nesimo', month: 8, weekday: 0, n: 3 }, leadDays: 45 },
]

export const defaultSettings = (): Settings => ({
  fixedCosts: [],
  defaultMargin: 60,
  ivaRate: 21,
  business: { name: 'DragoToY', cuit: '', address: '', ivaCondition: 'Responsable Inscripto' },
})

/** Fecha de la temporada en un año dado. */
export function seasonDate(rule: SeasonRule, year: number): Date {
  if (rule.type === 'fija') return new Date(year, rule.month - 1, rule.day)
  const first = new Date(year, rule.month - 1, 1)
  const offset = (rule.weekday - first.getDay() + 7) % 7
  return new Date(year, rule.month - 1, 1 + offset + (rule.n - 1) * 7)
}

/** Próxima ocurrencia (hoy incluido) y cuántos días faltan. */
export function nextOccurrence(rule: SeasonRule, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let date = seasonDate(rule, today.getFullYear())
  if (date < today) date = seasonDate(rule, today.getFullYear() + 1)
  return { date, days: Math.round((date.getTime() - today.getTime()) / 86_400_000) }
}

export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const ORDINAL = ['', 'primer', 'segundo', 'tercer', 'cuarto', 'último']

export function describeRule(rule: SeasonRule) {
  if (rule.type === 'fija') return `${rule.day} de ${MONTHS[rule.month - 1]}`
  return `${ORDINAL[rule.n]} ${WEEKDAYS[rule.weekday]} de ${MONTHS[rule.month - 1]}`
}
