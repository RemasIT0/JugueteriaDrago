import { AnimatePresence, motion } from 'framer-motion'
import { LuBell as Bell, LuBellRing as BellRing, LuCalendarClock as CalendarClock, LuCheckCheck as CheckCheck, LuPackageX as PackageX, LuX as X } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Drawer } from '@/components/ui/Drawer'
import { useInventory } from '@/stores/inventory'
import { useAlerts, type Alert } from './useAlerts'

/** Campana con contador + aviso emergente cuando hay algo nuevo para revisar. */
export function AlertsBell({ variant }: { variant: 'rail' | 'header' }) {
  const { alerts, unseen, markSeen } = useAlerts()
  const ready = useInventory((s) => s.status === 'ready')
  const [open, setOpen] = useState(false)
  const [popup, setPopup] = useState(false)
  const navigate = useNavigate()

  // Aviso emergente: aparece si hay avisos sin ver; al cerrarlo quedan vistos.
  useEffect(() => {
    if (ready && unseen.length > 0 && variant === 'rail') {
      const t = setTimeout(() => setPopup(true), 900)
      return () => clearTimeout(t)
    }
    if (!unseen.length) setPopup(false)
  }, [ready, unseen.length, variant])

  const go = (a: Alert) => {
    markSeen([a])
    setOpen(false)
    setPopup(false)
    navigate(a.productId ? `/?producto=${a.productId}` : '/temporadas')
  }
  const dismiss = () => {
    markSeen(unseen)
    setPopup(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          'relative grid place-items-center rounded-xl transition-colors',
          variant === 'rail' ? 'size-10 text-rail-ink hover:bg-rail-hover hover:text-white' : 'size-10 text-rail-ink hover:bg-rail-hover',
        )}
        aria-label={unseen.length ? `Avisos: ${unseen.length} sin ver` : 'Avisos'}
      >
        <motion.span animate={unseen.length ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.8, repeat: unseen.length ? Infinity : 0, repeatDelay: 4 }}>
          {unseen.length ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        </motion.span>
        {unseen.length > 0 && (
          <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-2xs font-black text-on-fill ring-2 ring-rail">
            {unseen.length > 99 ? '99+' : unseen.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {popup && (
          <motion.div
            role="alertdialog"
            aria-label="Avisos para revisar"
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="fixed bottom-24 right-4 z-[55] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl bg-surface shadow-lift ring-2 ring-coral lg:bottom-6"
          >
            <div className="flex items-center gap-3 bg-coral px-5 py-3 text-on-fill">
              <BellRing className="size-5" aria-hidden />
              <p className="flex-1 font-black">
                {unseen.length} {unseen.length === 1 ? 'aviso para revisar' : 'avisos para revisar'}
              </p>
              <button onClick={() => setPopup(false)} className="grid size-8 place-items-center rounded-lg hover:bg-black/10" aria-label="Cerrar sin marcar">
                <X className="size-4" />
              </button>
            </div>
            <ul className="max-h-64 divide-y divide-line overflow-y-auto">
              {unseen.slice(0, 6).map((a) => (
                <AlertRow key={a.id} alert={a} onClick={() => go(a)} />
              ))}
            </ul>
            {unseen.length > 6 && <p className="px-5 pb-1 pt-2 text-xs font-bold text-ink-soft">y {unseen.length - 6} más…</p>}
            <div className="flex gap-2 p-3">
              <button onClick={dismiss} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-extrabold text-ground">
                <CheckCheck className="size-4" aria-hidden /> Entendido
              </button>
              <button onClick={() => (setPopup(false), setOpen(true))} className="h-10 rounded-xl bg-sunken px-4 text-sm font-extrabold">
                Ver todos
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Drawer open={open} onClose={() => setOpen(false)} title="Avisos">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 pt-16 sm:p-6 sm:pt-16">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black">Avisos</h2>
            {unseen.length > 0 && (
              <button onClick={() => markSeen(unseen)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-extrabold text-turquesa-ink hover:bg-turquesa-wash">
                <CheckCheck className="size-4" aria-hidden /> Marcar todo como visto
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="rounded-2xl bg-sunken px-4 py-10 text-center font-bold text-ink-soft">Todo en orden: nada para reponer.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line">
              {alerts.map((a) => (
                <AlertRow key={a.id} alert={a} seen={!unseen.includes(a)} onClick={() => go(a)} />
              ))}
            </ul>
          )}
        </div>
      </Drawer>
    </>
  )
}

function AlertRow({ alert: a, seen, onClick }: { alert: Alert; seen?: boolean; onClick: () => void }) {
  const Icon = a.seasonId ? CalendarClock : PackageX
  return (
    <li>
      <button onClick={onClick} className={clsx('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken', seen && 'opacity-60')}>
        <span className={clsx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', a.tone === 'peligro' ? 'bg-peligro-wash text-peligro' : 'bg-sol-wash text-sol-ink')}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{a.title}</span>
          <span className="num block text-xs font-semibold text-ink-soft">{a.detail}</span>
        </span>
        {!seen && <span className="mt-2 size-2 shrink-0 rounded-full bg-coral" aria-label="Sin ver" />}
      </button>
    </li>
  )
}
