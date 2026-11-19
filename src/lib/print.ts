/** ¿Corre dentro de la aplicación de escritorio (carpeta desktop/)? */
export const isDesktop = import.meta.env.VITE_DESKTOP === '1'

/** ¿Hay tienda online a la que enlazar? La versión de escritorio sin conexión no la tiene. */
export const hasStore = !isDesktop || !!import.meta.env.VITE_STORE_URL

/**
 * Enlace a la tienda online. En la web es la misma página (/tienda…); en el escritorio la tienda
 * no viene incluida, así que se abre la tienda publicada en el navegador.
 */
export const storeHref = (path = '/tienda') => (import.meta.env.VITE_STORE_URL ? import.meta.env.VITE_STORE_URL.replace(/\/$/, '') + path : path)

/**
 * Abre una hoja imprimible (comprobante, cierre de caja). Las hojas traen su propio script que abre
 * el diálogo de impresión al cargar.
 * - Web: en una ventana aparte (puede bloquearla el navegador: devuelve false).
 * - Escritorio: no hay ventanas emergentes, así que se carga en un marco oculto de la misma ventana.
 */
export function openPrintable(html: string, features = 'width=820,height=900') {
  if (isDesktop) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    frame.srcdoc = html
    document.body.appendChild(frame)
    const remove = () => frame.remove()
    frame.addEventListener('load', () => frame.contentWindow?.addEventListener('afterprint', () => setTimeout(remove, 500)))
    setTimeout(remove, 60_000) // por si se cerró el diálogo sin evento
    return true
  }
  const w = window.open('', '_blank', features)
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
