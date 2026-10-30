import { useMemo } from 'react'
import { useTheme } from '@/stores/theme'

/**
 * Colores de los gráficos leídos de los tokens del tema (Recharts necesita colores
 * resueltos, no var()). Se recalculan al cambiar entre claro y oscuro.
 * Un solo tono para las series: los gráficos de ventas tienen una sola medida.
 */
export function useChartColors() {
  const theme = useTheme((s) => s.theme)
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    const v = (name: string) => `rgb(${css.getPropertyValue(`--${name}`).trim().split(/\s+/).join(',')})`
    return {
      series: v('turquesa-ink'),
      seriesSoft: v('turquesa'),
      target: v('coral-ink'),
      grid: v('line'),
      axis: v('ink-soft'),
      ink: v('ink'),
      surface: v('surface'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])
}
