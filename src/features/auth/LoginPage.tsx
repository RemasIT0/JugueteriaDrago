import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Loader2, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/stores/auth'
import { AuthLayout } from './AuthLayout'
import { PasswordInput } from './PasswordInput'

const schema = z.object({
  username: z.string().trim().min(1, { error: 'Escribe tu usuario' }),
  password: z.string().min(1, { error: 'Escribe tu contraseña' }),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const login = useAuth((s) => s.login)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  const submit = handleSubmit(async ({ username, password }) => {
    setError(null)
    try {
      await login(username, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ingresar.')
      setValue('password', '')
      setFocus('password')
    }
  })

  return (
    <AuthLayout title="Ingresar" subtitle="Usa el usuario que te dio el dueño de la tienda.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 rounded-2xl bg-peligro-wash px-4 py-3 text-sm font-bold text-peligro"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <Field label="Usuario" htmlFor="login-user" error={errors.username?.message}>
          <Input id="login-user" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus aria-invalid={!!errors.username} {...register('username')} />
        </Field>
        <Field label="Contraseña" htmlFor="login-pass" error={errors.password?.message}>
          <PasswordInput id="login-pass" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" strokeWidth={2.5} />}
          Ingresar
        </Button>
        <p className="text-center text-xs font-semibold text-ink-soft">¿Olvidaste la contraseña? El dueño puede asignarte una nueva desde Usuarios.</p>
      </form>
    </AuthLayout>
  )
}
