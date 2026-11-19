import { AnimatePresence, motion } from 'framer-motion'
import { LuRefreshCw as Refresh, LuSparkles as Sparkles, LuX as X } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import { cloud } from '@/services/supabase'

/**
 * Dónde mirar si hay una versión más nueva publicada.
 * - Web (Vercel) y escritorio conectado abierto desde Vercel: el mismo sitio (/version.json).
 * - Panel que viene dentro del .exe: la versión publicada en Vercel (VITE_UPDATE_URL).
 */
const REMOTE = (import.meta.env.VITE_UPDATE_URL ?? '').replace(/\/$/, '')
const VERSION_URL = `${REMOTE}/version.json`
const EVERY = 5 * 60_000

type Mode = 'reload' | 'switch' | 'notify'
/** Qué se puede hacer con la versión nueva desde acá. */
const MODE: Mode = !REMOTE ? 'reload' : cloud ? 'switch' : 'notify'

async function latestId(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return typeof data.id === 'string' ? data.id : null
  } catch {
    return null // sin internet o sitio caído: se vuelve a intentar más tarde
  }
}

/**
 * Aviso de «Hay una versión nueva». Revisa al abrir, cada 5 minutos y cuando se vuelve a la ventana.
 * Nunca recarga solo: así no se pierde una venta a medio cargar.
 */
export function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV) return // en desarrollo Vite ya recarga solo
    let alive = true
    const check = async () => {
      const id = await latestId()
      if (alive && id && id !== __BUILD_ID__) setLatest(id)
    }
    void check()
    const timer = setInterval(check, EVERY)
    const onVisible = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  const show = !!latest && latest !== dismissed
  const update = () => {
    if (MODE === 'reload') window.location.reload()
    // El .exe conectado estaba usando su copia interna: pasa a la versión publicada.
    else if (MODE === 'switch') window.location.href = `${REMOTE}/?desktop=1`
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-ground shadow-lift sm:inset-x-auto sm:right-4 sm:left-auto"
        >
          <Sparkles className="size-5 shrink-0 text-sol" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-bold leading-snug">
            {MODE === 'notify' ? 'Hay una versión nueva del programa. Pide el archivo actualizado para tenerla.' : 'Hay una versión nueva del programa.'}
          </p>
          {MODE !== 'notify' && (
            <button onClick={update} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-sol px-3 text-sm font-black text-on-fill hover:brightness-105">
              <Refresh className="size-4" aria-hidden /> Actualizar
            </button>
          )}
          <button onClick={() => setDismissed(latest)} className="grid size-8 shrink-0 place-items-center rounded-lg text-ground/70 hover:bg-white/10 hover:text-ground" aria-label="Ahora no">
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
