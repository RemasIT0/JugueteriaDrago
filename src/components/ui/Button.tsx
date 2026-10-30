import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-ground hover:bg-ink/90 shadow-card',
  accent: 'bg-sol text-on-fill hover:brightness-[1.04] shadow-card',
  secondary: 'bg-sunken text-ink hover:bg-line/70',
  ghost: 'text-ink-soft hover:bg-sunken hover:text-ink',
  // Destructivo: solo contorno hasta que se enfoca o se pasa el mouse.
  danger: 'border-2 border-peligro/40 text-peligro hover:bg-peligro-wash hover:border-peligro focus-visible:bg-peligro-wash',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[0.9375rem] gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2.5 rounded-2xl',
}

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97, y: 0 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center font-extrabold transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        'num inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-sans text-2xs font-extrabold',
        '[background:color-mix(in_srgb,currentColor_16%,transparent)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
