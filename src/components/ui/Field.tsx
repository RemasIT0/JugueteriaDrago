import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'

export const inputClass = clsx(
  'h-12 w-full rounded-xl border-2 border-line bg-surface px-3.5 text-[0.9375rem] font-bold text-ink',
  'placeholder:font-semibold placeholder:text-ink-soft/80',
  'transition-[border-color,box-shadow] duration-150 ease-out',
  'hover:border-ink-soft/40 focus:border-turquesa focus:shadow-focus focus:outline-none',
  'aria-[invalid=true]:border-peligro aria-[invalid=true]:focus:shadow-[0_0_0_4px_rgb(var(--peligro)/0.2)]',
)

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-extrabold text-ink-soft">
        {label}
      </label>
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="err"
            id={`${htmlFor}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-bold text-peligro"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" initial={false} className="text-xs font-semibold text-ink-soft">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(inputClass, className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={clsx(
        inputClass,
        'cursor-pointer appearance-none bg-[length:1.1rem] bg-[right_0.8rem_center] bg-no-repeat pr-10',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235A666F' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
})
