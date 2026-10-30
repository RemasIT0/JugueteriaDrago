import { AnimatePresence, motion } from 'framer-motion'
import { ScanLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

/**
 * La cámara como lector. Usa BarcodeDetector nativo donde existe (Chrome en Android) y,
 * si no, el decodificador zxing, que se descarga solo la primera vez (iPhone, Safari, Firefox).
 */
export const cameraScanSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export function CameraScanner({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    let stream: MediaStream | null = null
    let raf = 0
    let alive = true
    let stopZxing: (() => void) | undefined

    const found = (code: string) => {
      if (!alive) return
      alive = false
      navigator.vibrate?.(60)
      onScan(code)
      onClose()
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        stream = s
        if (!video.current || !alive) return
        video.current.srcObject = s
        await video.current.play()

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] })
          const tick = async () => {
            if (!alive || !video.current) return
            const codes = await detector.detect(video.current).catch(() => [])
            if (codes[0]?.rawValue) return found(codes[0].rawValue)
            raf = requestAnimationFrame(tick)
          }
          void tick()
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (!alive || !video.current) return
          const controls = await new BrowserMultiFormatReader().decodeFromVideoElement(video.current, (result) => {
            if (result) found(result.getText())
          })
          stopZxing = () => controls.stop()
        }
      })
      .catch(() => setError('No hay permiso para usar la cámara. Actívalo en el navegador o usa el lector USB.'))

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      stopZxing?.()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, onClose, onScan])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Escanear con la cámara"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-ink shadow-lift"
          >
            <video ref={video} className="aspect-[3/4] w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-28 -translate-y-1/2 rounded-2xl border-[3px] border-sol">
              <motion.div
                className="absolute inset-x-2 h-0.5 rounded-full bg-coral"
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-ink/80 px-5 py-4 text-sm font-bold text-ground">
              <span className="flex items-center gap-2">
                <ScanLine className="size-5 text-sol" aria-hidden />
                {error ?? 'Apunta al código de barras'}
              </span>
              <button onClick={onClose} className="grid size-10 place-items-center rounded-xl hover:bg-ground/10" aria-label="Cerrar cámara">
                <X className="size-5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
