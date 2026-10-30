import { AnimatePresence, motion } from 'framer-motion'
import { LuTriangleAlert as AlertTriangle, LuCircleCheck as CheckCircle2 } from 'react-icons/lu'
import { create } from 'zustand'
import { uid } from '@/lib/format'

interface Toast {
  id: string
  tone: 'ok' | 'error'
  text: string
  action?: { label: string; run: () => void }
}

export const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: string) => void }>(
  (set) => ({
    toasts: [],
    push: (t) => {
      const id = uid('t')
      set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5000)
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  }),
)

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t)

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 lg:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-ground shadow-lift"
          >
            {t.tone === 'ok' ? (
              <CheckCircle2 className="size-5 shrink-0 text-turquesa" strokeWidth={2.5} />
            ) : (
              <AlertTriangle className="size-5 shrink-0 text-coral" strokeWidth={2.5} />
            )}
            <span>{t.text}</span>
            {t.action && (
              <button
                className="ml-1 rounded-lg px-2 py-1 font-extrabold text-sol hover:bg-ground/10"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
