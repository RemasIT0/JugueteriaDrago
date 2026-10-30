import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { DatabaseBackup, Download, KeyRound, Loader2, Upload, UserPlus, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Shimmer } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toaster'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { formatDate, formatTime } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/permissions'
import { audit } from '@/services/audit'
import { createUser, listUsers, resetPassword, setUserActive, setUserRole, validatePassword } from '@/services/auth'
import { exportBackup, importBackup } from '@/services/localDb'
import { useAuth } from '@/stores/auth'
import type { PublicUser, Role } from '@/types'

const passwordRule = z.string().superRefine((v, ctx) => {
  const p = validatePassword(v)
  if (p) ctx.addIssue({ code: 'custom', message: p })
})

const newUserSchema = z.object({
  name: z.string().trim().min(2, { error: 'Escribe el nombre' }).max(60),
  username: z
    .string()
    .trim()
    .min(3, { error: 'Mínimo 3 caracteres' })
    .max(30)
    .regex(/^[\p{L}\p{N}._-]+$/u, { error: 'Solo letras (con ñ y tildes), números, punto, guion y guion bajo' }),
  password: passwordRule,
  role: z.enum(['dueno', 'vendedor']),
})
type NewUser = z.infer<typeof newUserSchema>

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

export default function UsersPage() {
  const me = useAuth((s) => s.user)
  const [users, setUsers] = useState<PublicUser[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetFor, setResetFor] = useState<string | null>(null)

  const refresh = useCallback(() => listUsers().then(setUsers), [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast({ tone: 'ok', text: ok })
      await refresh()
    } catch (e) {
      toast({ tone: 'error', text: errorText(e, 'No se pudo completar.') })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Usuarios</h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">Quién puede ingresar y qué puede hacer cada uno.</p>
        </div>
        {!creating && (
          <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
            <UserPlus className="size-5" strokeWidth={2.5} aria-hidden /> Nuevo usuario
          </Button>
        )}
      </header>

      <AnimatePresence>{creating && <NewUserCard onDone={() => (setCreating(false), void refresh())} />}</AnimatePresence>

      <section className="overflow-hidden rounded-3xl bg-surface shadow-card">
        {!users ? (
          <div className="flex flex-col gap-3 p-5">
            <Shimmer className="h-14 rounded-2xl" />
            <Shimmer className="h-14 rounded-2xl" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className={clsx('flex flex-col gap-3 px-5 py-4', !u.active && 'bg-sunken/50')}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-extrabold">
                      {u.name}
                      {u.id === me?.id && <span className="rounded-full bg-turquesa-wash px-2 py-0.5 text-2xs font-black text-turquesa-ink">Tú</span>}
                      {!u.active && <span className="rounded-full bg-peligro-wash px-2 py-0.5 text-2xs font-black text-peligro">Desactivado</span>}
                    </p>
                    <p className="text-xs font-semibold text-ink-soft">
                      @{u.username} · {u.lastLoginAt ? `último ingreso ${formatDate(u.lastLoginAt)} ${formatTime(u.lastLoginAt)}` : 'nunca ingresó'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-extrabold text-ink-soft">
                    Rol
                    <Select
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={(e) => void run(() => setUserRole(u.id, e.target.value as Role), 'Rol actualizado')}
                      className="h-10 w-36 text-sm"
                      title={u.id === me?.id ? 'No puedes cambiar tu propio rol' : undefined}
                    >
                      <option value="vendedor">{ROLE_LABEL.vendedor}</option>
                      <option value="dueno">{ROLE_LABEL.dueno}</option>
                    </Select>
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => setResetFor(resetFor === u.id ? null : u.id)}>
                    <KeyRound className="size-4" aria-hidden /> Nueva contraseña
                  </Button>
                  {u.id !== me?.id &&
                    (u.active ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => confirm(`¿Desactivar a ${u.name}? No podrá ingresar hasta que lo reactives.`) && void run(() => setUserActive(u.id, false), `${u.name} desactivado`)}
                      >
                        <UserRoundX className="size-4" aria-hidden /> Desactivar
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void run(() => setUserActive(u.id, true), `${u.name} reactivado`)}>
                        <UserRoundCheck className="size-4" aria-hidden /> Reactivar
                      </Button>
                    ))}
                </div>
                <AnimatePresence>
                  {resetFor === u.id && (
                    <ResetPasswordRow
                      user={u}
                      onDone={() => setResetFor(null)}
                      submit={(pw) => run(() => resetPassword(u.id, pw), `Contraseña de ${u.name} cambiada`)}
                    />
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RoleLegend />
      <BackupCard />
    </div>
  )
}

function NewUserCard({ onDone }: { onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewUser>({ resolver: zodResolver(newUserSchema), defaultValues: { name: '', username: '', password: '', role: 'vendedor' } })

  const submit = handleSubmit(async (v) => {
    try {
      await createUser(v)
      toast({ tone: 'ok', text: `Usuario ${v.username} creado` })
      onDone()
    } catch (e) {
      toast({ tone: 'error', text: errorText(e, 'No se pudo crear el usuario.') })
    }
  })

  return (
    <motion.form
      onSubmit={submit}
      noValidate
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 className="font-black">Nuevo usuario</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="nu-name" error={errors.name?.message}>
          <Input id="nu-name" autoFocus aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="Usuario para ingresar" htmlFor="nu-user" error={errors.username?.message}>
          <Input id="nu-user" autoCapitalize="none" spellCheck={false} aria-invalid={!!errors.username} {...register('username')} />
        </Field>
        <Field label="Contraseña inicial" htmlFor="nu-pass" error={errors.password?.message} hint="Mínimo 8, con letras y números. Pásasela en persona.">
          <PasswordInput id="nu-pass" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Field label="Rol" htmlFor="nu-role">
          <Select id="nu-role" {...register('role')}>
            <option value="vendedor">{ROLE_LABEL.vendedor}</option>
            <option value="dueno">{ROLE_LABEL.dueno}</option>
          </Select>
        </Field>
      </div>
      <div className="flex gap-3">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />} Crear usuario
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  )
}

function ResetPasswordRow({ user, submit, onDone }: { user: PublicUser; submit: (pw: string) => Promise<void>; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const problem = pw ? validatePassword(pw) : null
  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault()
        if (!pw || problem) return
        void submit(pw).then(onDone)
      }}
    >
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-sunken p-3">
        <Field label={`Nueva contraseña para ${user.name}`} htmlFor={`rp-${user.id}`} error={problem ?? undefined} className="min-w-56 flex-1">
          <PasswordInput id={`rp-${user.id}`} autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!problem} />
        </Field>
        <Button type="submit" variant="primary" disabled={!pw || !!problem}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </motion.form>
  )
}

function RoleLegend() {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {(
        [
          ['dueno', 'Todo: inventario, carga, importar archivos, ajustar o borrar stock, reportes, usuarios, actividad y copias de seguridad.'],
          ['vendedor', 'Ver inventario, cargar productos nuevos, reponer stock y subir fotos. No puede ajustar ni borrar stock, ni ver reportes.'],
        ] as const
      ).map(([role, text]) => (
        <div key={role} className="rounded-2xl bg-sunken p-4">
          <p className="font-black">{ROLE_LABEL[role]}</p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">{text}</p>
        </div>
      ))}
    </section>
  )
}

function BackupCard() {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    const blob = await exportBackup()
    const url = URL.createObjectURL(blob)
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    Object.assign(document.createElement('a'), { href: url, download: `dragotoy-respaldo-${stamp}.json` }).click()
    URL.revokeObjectURL(url)
    await audit('Copia de seguridad descargada', '')
    toast({ tone: 'ok', text: 'Copia de seguridad descargada' })
  }

  const restore = async (file?: File) => {
    if (!file) return
    const typed = prompt('Restaurar REEMPLAZA todos los datos actuales por los de la copia.\nPara confirmar escribe: RESTAURAR')
    if (typed?.trim().toUpperCase() !== 'RESTAURAR') return toast({ tone: 'error', text: 'Restauración cancelada.' })
    setBusy(true)
    try {
      await importBackup(file)
      await audit('Copia de seguridad restaurada', file.name)
      toast({ tone: 'ok', text: 'Datos restaurados. Recargando…' })
      setTimeout(() => location.reload(), 900)
    } catch (e) {
      toast({ tone: 'error', text: errorText(e, 'No se pudo restaurar la copia.') })
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cielo-wash text-cielo-ink">
          <DatabaseBackup className="size-5" strokeWidth={2.4} aria-hidden />
        </div>
        <div>
          <h2 className="font-black">Copia de seguridad</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
            Los datos viven solo en este navegador. Descarga una copia al menos una vez por semana y guárdala fuera de esta computadora (pendrive o nube).
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => void download()}>
          <Download className="size-4" aria-hidden /> Descargar copia
        </Button>
        {/* Restaurar reemplaza todo: separado y con confirmación escrita. */}
        <label className={clsx('ml-auto inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-peligro/40 px-4 text-[0.9375rem] font-extrabold text-peligro transition-colors hover:border-peligro hover:bg-peligro-wash', busy && 'pointer-events-none opacity-50')}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" aria-hidden />} Restaurar desde archivo
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => (void restore(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
      </div>
    </section>
  )
}
