import { useEffect, useRef } from 'react'

type Handler = (e: KeyboardEvent) => void

/**
 * Atajos globales. Formato: "mod+enter", "alt+n", "escape".
 * "mod" es Ctrl en Windows/Linux y Cmd en Mac.
 */
export function useHotkeys(map: Record<string, Handler>, enabled = true) {
  const ref = useRef(map)
  ref.current = map

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const parts = [
        e.ctrlKey || e.metaKey ? 'mod' : '',
        e.altKey ? 'alt' : '',
        e.shiftKey ? 'shift' : '',
        e.key.toLowerCase(),
      ].filter(Boolean)
      const combo = parts.join('+')
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      // Las teclas sueltas (sin modificador) no se roban mientras se escribe.
      if (typing && parts.length === 1) return
      const handler = ref.current[combo]
      if (handler) {
        e.preventDefault()
        handler(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'
