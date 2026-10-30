import { useEffect, useRef } from 'react'

/**
 * Detecta lectores de código de barras USB (que "teclean" muy rápido y terminan en Enter).
 *
 * Una persona teclea con ~80–250 ms entre teclas; un lector, con <50 ms. Si llega una
 * ráfaga de al menos `minLength` caracteres con ese ritmo y termina en Enter, se trata
 * como escaneo: se cancela el Enter (para no enviar el formulario), se devuelve el texto
 * que la ráfaga haya escrito en otro campo a su valor anterior y se entrega el código.
 */
interface Options {
  onScan: (code: string) => void
  enabled?: boolean
  minLength?: number
  maxGapMs?: number
}

const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function useScannerDetection({ onScan, enabled = true, minLength = 6, maxGapMs = 50 }: Options) {
  const cb = useRef(onScan)
  cb.current = onScan

  useEffect(() => {
    if (!enabled) return
    let buffer = ''
    let last = 0
    let target: HTMLInputElement | HTMLTextAreaElement | null = null
    let snapshot = ''

    const reset = () => {
      buffer = ''
      target = null
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const now = performance.now()
      const gap = now - last
      last = now

      if (e.key === 'Enter') {
        // En el propio campo de código no hace falta adivinar: ese campo maneja su Enter
        // con el valor completo (así un lector con ritmo irregular no corta el código).
        const inScanField = target?.dataset.scanTarget === 'true'
        if (!inScanField && buffer.length >= minLength && gap < maxGapMs * 3) {
          e.preventDefault()
          e.stopPropagation()
          const code = buffer
          // El escaneo cayó en otro campo: se deshace lo que escribió ahí.
          if (target) setNativeValue(target, snapshot)
          reset()
          cb.current(code)
          return
        }
        reset()
        return
      }

      if (e.key.length !== 1) return
      if (gap > maxGapMs) {
        // Primera tecla de una posible ráfaga: se guarda el estado del campo antes de escribir.
        const el = document.activeElement
        target = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null
        snapshot = target?.value ?? ''
        buffer = ''
      }
      buffer += e.key
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled, minLength, maxGapMs])
}
