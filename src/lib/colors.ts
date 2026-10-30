import type { BoardColor } from '@/types'

/**
 * Clases completas por color de casilla. Tailwind necesita ver los nombres
 * literales, por eso no se construyen con interpolación.
 */
export const BOARD: Record<BoardColor, { fill: string; wash: string; ink: string; ring: string }> = {
  sol: { fill: 'bg-sol', wash: 'bg-sol-wash', ink: 'text-sol-ink', ring: 'ring-sol' },
  coral: { fill: 'bg-coral', wash: 'bg-coral-wash', ink: 'text-coral-ink', ring: 'ring-coral' },
  turquesa: { fill: 'bg-turquesa', wash: 'bg-turquesa-wash', ink: 'text-turquesa-ink', ring: 'ring-turquesa' },
  lila: { fill: 'bg-lila', wash: 'bg-lila-wash', ink: 'text-lila-ink', ring: 'ring-lila' },
  hoja: { fill: 'bg-hoja', wash: 'bg-hoja-wash', ink: 'text-hoja-ink', ring: 'ring-hoja' },
  cielo: { fill: 'bg-cielo', wash: 'bg-cielo-wash', ink: 'text-cielo-ink', ring: 'ring-cielo' },
}

export const BOARD_COLORS = Object.keys(BOARD) as BoardColor[]
