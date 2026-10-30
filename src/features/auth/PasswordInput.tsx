import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/Field'

/** Contraseña con botón para mostrarla y aviso de Bloq Mayús. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const checkCaps = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Input ref={ref} type={show ? 'text' : 'password'} className="pr-12" onKeyUp={checkCaps} onKeyDown={checkCaps} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {caps && <p className="text-xs font-bold text-sol-ink">Bloq Mayús está activado</p>}
    </div>
  )
})
