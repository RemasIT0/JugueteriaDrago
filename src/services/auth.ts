/**
 * Autenticación en modo local. Las contraseñas se guardan como hash PBKDF2 con sal propia.
 * Sin servidor esto ordena el acceso y deja rastro de quién hizo qué, pero no es una
 * barrera ante alguien con acceso técnico al equipo: para eso hace falta un backend.
 */
import { can, type Permission } from '@/lib/permissions'
import { uid } from '@/lib/format'
import type { PublicUser, Role, User } from '@/types'
import { audit } from './audit'
import { ApiError } from './http'
import { loadDb, save } from './localDb'
import { currentUser, setCurrentUser } from './session'

const ITERATIONS = 210_000
const SESSION_KEY = 'dragotoy-session'
const SESSION_HOURS = 12
const MAX_ATTEMPTS = 5
const LOCK_MS = 60_000

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))

async function hash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: ITERATIONS },
    key,
    256,
  )
  return b64(bits)
}

const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)))

/** Comparación en tiempo constante para no filtrar por cuánto tarda. */
function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const toPublic = ({ passwordHash: _h, salt: _s, ...u }: User): PublicUser => u
// NFC: una «ñ» o «á» tecleada en otro teclado o celular puede llegar como letra + tilde por separado.
const normalize = (username: string) => username.normalize('NFC').trim().toLocaleLowerCase('es')

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'La contraseña necesita al menos 8 caracteres'
  // \p{L} acepta cualquier letra, incluidas ñ y vocales con tilde.
  if (!/\p{L}/u.test(pw) || !/\p{N}/u.test(pw)) return 'Usa letras y números'
  return null
}

export function requirePermission(p: Permission) {
  const u = currentUser()
  if (!u) throw new ApiError(401, 'Tu sesión terminó. Vuelve a ingresar.')
  if (!can(u.role, p)) throw new ApiError(403, 'Tu usuario no tiene permiso para esta acción.')
}

// ── Intentos fallidos ────────────────────────────────────────────────────────────
type Attempts = Record<string, { count: number; until: number }>
const readAttempts = (): Attempts => {
  try {
    return JSON.parse(localStorage.getItem('dragotoy-attempts') ?? '{}')
  } catch {
    return {}
  }
}
const writeAttempts = (a: Attempts) => {
  try {
    localStorage.setItem('dragotoy-attempts', JSON.stringify(a))
  } catch {
    /* sin almacenamiento: el bloqueo dura solo esta pestaña */
  }
}

// ── API pública ──────────────────────────────────────────────────────────────────
export async function hasUsers() {
  return (await loadDb()).users.length > 0
}

/** Primer uso: crea la cuenta del dueño. Solo funciona si no hay ningún usuario. */
export async function setupOwner(input: { name: string; username: string; password: string }) {
  const db = await loadDb()
  if (db.users.length) throw new ApiError(409, 'El sistema ya tiene usuarios. Ingresa con tu cuenta.')
  const user = await buildUser({ ...input, role: 'dueno' })
  user.lastLoginAt = new Date().toISOString()
  db.users.push(user)
  await save('users')
  startSession(user)
  await audit('Configuración inicial', `Se creó la cuenta del dueño «${user.username}»`)
  return toPublic(user)
}

async function buildUser(input: { name: string; username: string; password: string; role: Role }): Promise<User> {
  const problem = validatePassword(input.password)
  if (problem) throw new ApiError(400, problem)
  const salt = newSalt()
  return {
    id: uid('usr'),
    username: normalize(input.username),
    name: input.name.trim(),
    role: input.role,
    active: true,
    salt,
    passwordHash: await hash(input.password, salt),
    createdAt: new Date().toISOString(),
  }
}

export async function login(username: string, password: string): Promise<PublicUser> {
  const key = normalize(username)
  const attempts = readAttempts()
  const a = attempts[key]
  if (a && a.until > Date.now()) {
    const secs = Math.ceil((a.until - Date.now()) / 1000)
    throw new ApiError(429, `Demasiados intentos. Espera ${secs} segundos e intenta de nuevo.`)
  }

  const db = await loadDb()
  const user = db.users.find((u) => u.username === key)
  // Se calcula el hash aunque el usuario no exista, para no revelar qué usuarios hay.
  const candidate = await hash(password, user?.salt ?? newSalt())
  if (!user || !sameHash(candidate, user.passwordHash)) {
    const count = (a?.count ?? 0) + 1
    attempts[key] = { count: count >= MAX_ATTEMPTS ? 0 : count, until: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 }
    writeAttempts(attempts)
    await audit('Ingreso fallido', `Usuario «${key}»`)
    throw new ApiError(401, count >= MAX_ATTEMPTS ? 'Demasiados intentos. Espera 1 minuto.' : 'Usuario o contraseña incorrectos.')
  }
  if (!user.active) {
    await audit('Ingreso rechazado', `Usuario desactivado «${key}»`)
    throw new ApiError(403, 'Este usuario está desactivado. Pide al dueño que lo reactive.')
  }

  delete attempts[key]
  writeAttempts(attempts)
  user.lastLoginAt = new Date().toISOString()
  await save('users')
  startSession(user)
  await audit('Ingreso', '')
  return toPublic(user)
}

function startSession(user: User) {
  setCurrentUser(toPublic(user))
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, expiresAt: Date.now() + SESSION_HOURS * 3_600_000 }))
  } catch {
    /* la sesión durará solo mientras la pestaña siga abierta */
  }
}

/** Recupera la sesión guardada si no venció y el usuario sigue activo. */
export async function restoreSession(): Promise<PublicUser | null> {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { userId, expiresAt } = JSON.parse(raw) as { userId: string; expiresAt: number }
    if (expiresAt < Date.now()) return (localStorage.removeItem(SESSION_KEY), null)
    const user = (await loadDb()).users.find((u) => u.id === userId && u.active)
    if (!user) return (localStorage.removeItem(SESSION_KEY), null)
    setCurrentUser(toPublic(user))
    return toPublic(user)
  } catch {
    return null
  }
}

export async function logout() {
  await audit('Salida', '')
  setCurrentUser(null)
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* nada que limpiar */
  }
}

/** Solo id → nombre, para mostrar quién hizo cada movimiento (sin datos sensibles). */
export async function userNames(): Promise<Record<string, string>> {
  if (!currentUser()) return {}
  return Object.fromEntries((await loadDb()).users.map((u) => [u.id, u.name]))
}

// ── Gestión de usuarios (dueño) ──────────────────────────────────────────────────
export async function listUsers(): Promise<PublicUser[]> {
  requirePermission('usuarios.gestionar')
  return (await loadDb()).users.map(toPublic)
}

export async function createUser(input: { name: string; username: string; password: string; role: Role }) {
  requirePermission('usuarios.gestionar')
  const db = await loadDb()
  if (db.users.some((u) => u.username === normalize(input.username))) throw new ApiError(409, 'Ya existe un usuario con ese nombre de ingreso.')
  const user = await buildUser(input)
  db.users.push(user)
  await save('users')
  await audit('Usuario creado', `«${user.username}» como ${input.role === 'dueno' ? 'Dueño' : 'Vendedor'}`)
  return toPublic(user)
}

const activeOwners = (users: User[]) => users.filter((u) => u.role === 'dueno' && u.active)

export async function setUserActive(id: string, active: boolean) {
  requirePermission('usuarios.gestionar')
  const db = await loadDb()
  const user = db.users.find((u) => u.id === id)
  if (!user) throw new ApiError(404, 'El usuario ya no existe')
  if (user.id === currentUser()?.id) throw new ApiError(400, 'No puedes desactivar tu propio usuario.')
  if (!active && user.role === 'dueno' && activeOwners(db.users).length <= 1) throw new ApiError(400, 'Debe quedar al menos un dueño activo.')
  user.active = active
  await save('users')
  await audit(active ? 'Usuario reactivado' : 'Usuario desactivado', `«${user.username}»`)
}

export async function setUserRole(id: string, role: Role) {
  requirePermission('usuarios.gestionar')
  const db = await loadDb()
  const user = db.users.find((u) => u.id === id)
  if (!user) throw new ApiError(404, 'El usuario ya no existe')
  if (user.role === 'dueno' && role !== 'dueno' && activeOwners(db.users).length <= 1) throw new ApiError(400, 'Debe quedar al menos un dueño activo.')
  user.role = role
  await save('users')
  await audit('Rol cambiado', `«${user.username}» ahora es ${role === 'dueno' ? 'Dueño' : 'Vendedor'}`)
}

export async function resetPassword(id: string, password: string) {
  const me = currentUser()
  if (me?.id !== id) requirePermission('usuarios.gestionar')
  const db = await loadDb()
  const user = db.users.find((u) => u.id === id)
  if (!user) throw new ApiError(404, 'El usuario ya no existe')
  const problem = validatePassword(password)
  if (problem) throw new ApiError(400, problem)
  user.salt = newSalt()
  user.passwordHash = await hash(password, user.salt)
  await save('users')
  await audit('Contraseña cambiada', me?.id === id ? 'Propia' : `De «${user.username}»`)
}

/** Cambio de la propia contraseña: exige la actual. */
export async function changeOwnPassword(current: string, next: string) {
  const me = currentUser()
  if (!me) throw new ApiError(401, 'Tu sesión terminó. Vuelve a ingresar.')
  const user = (await loadDb()).users.find((u) => u.id === me.id)
  if (!user || !sameHash(await hash(current, user.salt), user.passwordHash)) throw new ApiError(400, 'La contraseña actual no es correcta.')
  await resetPassword(me.id, next)
}
