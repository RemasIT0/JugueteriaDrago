import { AnimatePresence, motion } from 'framer-motion'
import { LuX as X } from 'react-icons/lu'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Panel lateral desde la derecha. La lista sigue visible detrás.
 * Se monta al final del <body>: dentro de la página quedaría atrapado en el contexto de apilado
 * de la animación de cambio de sección (usa transform) y la barra inferior del celular lo taparía.
 */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/20 lg:bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-surface pb-[env(safe-area-inset-bottom)] text-ink shadow-drawer outline-none sm:rounded-l-3xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-5" strokeWidth={2.5} />
            </button>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
