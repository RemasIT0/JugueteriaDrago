/** Ajustes de la tienda en un solo lugar. */
export const STORE = {
  name: 'DragoToY',
  currency: import.meta.env.VITE_CURRENCY ?? '$',
  country: 'Argentina',
  locale: 'es-AR',
  defaultLoteGoal: 50,
} as const
