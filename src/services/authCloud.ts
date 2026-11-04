/**
 * Autenticación con Supabase Auth. Las contraseñas las guarda Supabase (bcrypt) y cada pedido
 * a la base lleva la sesión, así los permisos se verifican en el servidor.
 *
 * Los usuarios entran con un nombre, no con un correo: emailFor() arma la dirección interna.
 * Por eso en el proyecto de Supabase tiene que estar apagado «Confirm email».
 */
import type { AuthError } from '@supabase/supabase-js'
import type { PublicUser, Role } from '@/types'
import { ApiError } from './http'
import { setCurrentUser } from './session'
import { detachedClient, emailFor, rpc, sb } from './supabase'

const LOGIN_AT = 'dragotoy-login-at'
const SESSION_HOURS = 12

type Profile = PublicUser & { approved: boolean }
type LoginResult = Profile | { rejected: true; message: string }

function authError(e: AuthError | null, fallback: string): ApiError {
  const code = e?.code ?? ''
  if (code === 'invalid_credentials') return new ApiError(401, 'Usuario o contraseña incorrectos.')
  if (code === 'user_already_exists' || code === 'email_exists') return new ApiError(409, 'Ya existe un usuario con ese nombre de ingreso.')
  if (code === 'weak_password') return new ApiError(400, 'La contraseña es muy débil. Usa al menos 8 caracteres con letras y números.')
  if (code === 'same_password') return new ApiError(400, 'La contraseña nueva tiene que ser distinta de la actual.')
  if (code === 'email_not_confirmed') return new ApiError(403, 'Supabase está pidiendo confirmar el correo: en el proyecto hay que apagar «Confirm email».')
  if (code === 'signup_disabled') return new ApiError(403, 'El proyecto de Supabase no permite crear cuentas: activa «Allow new users to sign up».')
  if (code === 'over_request_rate_limit' || e?.status === 429) return new ApiError(429, 'Demasiados intentos. Espera un momento e intenta de nuevo.')
  if (e && /fetch|network/i.test(e.message)) return new ApiError(0, 'No hay conexión con el servidor. Revisa internet e intenta de nuevo.')
  return new ApiError(e?.status ?? 500, e?.message || fallback)
}

function startSession(profile: PublicUser) {
  setCurrentUser(profile)
  try {
    localStorage.setItem(LOGIN_AT, String(Date.now()))
  } catch {
    /* sin almacenamiento: la sesión de Supabase igual vence sola */
  }
}

/** Después de que Supabase acepta la contraseña: la base confirma que la cuenta esté habilitada. */
async function enter(): Promise<PublicUser> {
  const res = await rpc<LoginResult>('register_login')
  if ('rejected' in res) {
    await sb().auth.signOut()
    throw new ApiError(403, res.message)
  }
  startSession(res)
  return res
}

export const hasUsers = () => rpc<boolean>('has_users')

export async function setupOwner(input: { name: string; username: string; password: string }, username: string) {
  if (await hasUsers()) throw new ApiError(409, 'El sistema ya tiene usuarios. Ingresa con tu cuenta.')
  const { data, error } = await sb().auth.signUp({ email: emailFor(username), password: input.password, options: { data: { username, name: input.name.trim() } } })
  if (error) throw authError(error, 'No se pudo crear la cuenta.')
  if (!data.session) throw authError({ code: 'email_not_confirmed' } as AuthError, '')
  return enter()
}

export async function login(username: string, password: string): Promise<PublicUser> {
  const { error } = await sb().auth.signInWithPassword({ email: emailFor(username), password })
  if (error) {
    if (error.code === 'invalid_credentials') await rpc('log_login_failure', { p_username: username }).catch(() => {})
    throw authError(error, 'No se pudo ingresar.')
  }
  return enter()
}

/** Al recargar: la sesión de Supabase sigue guardada; vence a las 12 h como antes. */
export async function restoreSession(): Promise<PublicUser | null> {
  const { data } = await sb().auth.getSession()
  if (!data.session) return null
  const at = Number(localStorage.getItem(LOGIN_AT) ?? 0)
  if (!at || Date.now() - at > SESSION_HOURS * 3_600_000) {
    await sb().auth.signOut()
    return null
  }
  const profile = await rpc<Profile | null>('my_profile').catch(() => null)
  if (!profile) {
    await sb().auth.signOut()
    return null
  }
  setCurrentUser(profile)
  return profile
}

export async function logout() {
  await rpc('register_logout').catch(() => {})
  await sb().auth.signOut()
  setCurrentUser(null)
  try {
    localStorage.removeItem(LOGIN_AT)
  } catch {
    /* nada que limpiar */
  }
}

export const userNames = () => rpc<Record<string, string>>('user_names')
export const listUsers = () => rpc<PublicUser[]>('list_users')

/**
 * Alta de un usuario por el dueño. La cuenta se crea con un cliente aparte (para no cerrar la
 * sesión del dueño) y nace pendiente; enseguida el dueño la habilita con su rol.
 */
export async function createUser(input: { name: string; username: string; password: string; role: Role }, username: string) {
  if (!(await rpc<boolean>('username_available', { p_username: username }))) throw new ApiError(409, 'Ya existe un usuario con ese nombre de ingreso.')
  const { data, error } = await detachedClient().auth.signUp({ email: emailFor(username), password: input.password, options: { data: { username, name: input.name.trim() } } })
  if (error) throw authError(error, 'No se pudo crear el usuario.')
  if (!data.user) throw new ApiError(500, 'Supabase no devolvió el usuario creado.')
  return rpc<PublicUser>('admin_approve_user', { p_id: data.user.id, p_role: input.role })
}

export const setUserActive = (id: string, active: boolean) => rpc('admin_set_active', { p_id: id, p_active: active })
export const setUserRole = (id: string, role: Role) => rpc('admin_set_role', { p_id: id, p_role: role })
export const resetPassword = (id: string, password: string) => rpc<void>('admin_set_password', { p_id: id, p_password: password })

/** Cambio de la propia contraseña: se vuelve a verificar la actual antes de cambiarla. */
export async function changeOwnPassword(me: PublicUser, current: string, next: string) {
  const check = await sb().auth.signInWithPassword({ email: emailFor(me.username), password: current })
  if (check.error) throw new ApiError(400, 'La contraseña actual no es correcta.')
  const { error } = await sb().auth.updateUser({ password: next })
  if (error) throw authError(error, 'No se pudo cambiar la contraseña.')
  await rpc('log_client_event', { p_action: 'Contraseña cambiada', p_detail: 'Propia' }).catch(() => {})
}
