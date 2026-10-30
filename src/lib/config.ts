/** Ajustes de la tienda en un solo lugar. */
export const STORE = {
  name: 'DragoToY',
  currency: import.meta.env.VITE_CURRENCY ?? '$',
  locale: 'es',
  /** Si existe, los servicios llaman a esta API; si no, usan datos de ejemplo en memoria. */
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '',
  defaultLoteGoal: 50,
} as const
