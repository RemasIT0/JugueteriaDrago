/** Ajustes de la tienda en un solo lugar. */
export const STORE = {
  name: 'DragoToY',
  currency: import.meta.env.VITE_CURRENCY ?? '$',
  country: 'Argentina',
  locale: 'es-AR',
  /** Si existe, los servicios llaman a esta API; si no, guardan en la base local del navegador. */
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '',
  defaultLoteGoal: 50,
} as const
