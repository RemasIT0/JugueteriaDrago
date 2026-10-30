import { zodResolver } from '@hookform/resolvers/zod'
import { LuCircleAlert as AlertCircle, LuLoaderCircle as Loader2, LuRocket as Rocket } from 'react-icons/lu'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { initializeLocalData } from '@/services/api'
import { setupOwner, validatePassword } from '@/services/auth'
import { useAuth } from '@/stores/auth'
import { AuthLayout } from './AuthLayout'
import { PasswordInput } from './PasswordInput'

const schema = z
  .object({
    name: z.string().trim().min(2, { error: 'Escribe tu nombre' }).max(60),
    username: z
      .string()
      .trim()
      .min(3, { error: 'Mínimo 3 caracteres' })
      .max(30)
      .regex(/^[\p{L}\p{N}._-]+$/u, { error: 'Solo letras (con ñ y tildes), números, punto, guion y guion bajo' }),
    password: z.string().superRefine((v, ctx) => {
      const p = validatePassword(v)
      if (p) ctx.addIssue({ code: 'custom', message: p })
    }),
    confirm: z.string(),
    demo: z.boolean(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], error: 'Las contraseñas no coinciden' })
type Values = z.infer<typeof schema>

/** Primer uso: se crea la cuenta del dueño. Solo aparece si el sistema no tiene ningún usuario. */
export default function SetupPage() {
  const setupDone = useAuth((s) => s.setupDone)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', username: '', password: '', confirm: '', demo: false } })

  const submit = handleSubmit(async ({ name, username, password, demo }) => {
    setError(null)
    try {
      const user = await setupOwner({ name, username, password })
      await initializeLocalData({ demo })
      setupDone(user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la configuración.')
    }
  })

  return (
    <AuthLayout title="Configurar la tienda" subtitle="Crea la cuenta del dueño. Con ella vas a poder dar de alta a los vendedores.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-peligro-wash px-4 py-3 text-sm font-bold text-peligro">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        <Field label="Tu nombre" htmlFor="setup-name" error={errors.name?.message}>
          <Input id="setup-name" autoComplete="name" autoFocus aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="Usuario para ingresar" htmlFor="setup-user" error={errors.username?.message} hint="Ej.: maría o dueño">
          <Input id="setup-user" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={!!errors.username} {...register('username')} />
        </Field>
        <Field label="Contraseña" htmlFor="setup-pass" error={errors.password?.message} hint="Mínimo 8 caracteres, con letras y números">
          <PasswordInput id="setup-pass" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Field label="Repite la contraseña" htmlFor="setup-confirm" error={errors.confirm?.message}>
          <PasswordInput id="setup-confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-sunken p-4">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--turquesa))]" {...register('demo')} />
          <span className="text-sm">
            <span className="block font-extrabold">Cargar productos de ejemplo</span>
            <span className="font-semibold text-ink-soft">Para probar el sistema. Quedan marcados como «(ejemplo)» y los puedes borrar después.</span>
          </span>
        </label>
        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <Rocket className="size-5" strokeWidth={2.5} />}
          Crear cuenta y empezar
        </Button>
      </form>
    </AuthLayout>
  )
}
