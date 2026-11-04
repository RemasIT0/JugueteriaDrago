/**
 * Conexión con Supabase. Si .env.local tiene VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY,
 * los servicios guardan en la nube; si no, siguen usando la base local del navegador.
 *
 * La clave publicable es pública por diseño: la seguridad está en las funciones de la base
 * (supabase/migrations), que verifican la sesión y el rol antes de leer o escribir.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from './http'

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? ''

export const cloud = URL.length > 0 && KEY.length > 0

let client: SupabaseClient | null = null
export function sb(): SupabaseClient {
  if (!cloud) throw new Error('Supabase no está configurado')
  client ??= createClient(URL, KEY, { auth: { storageKey: 'dragotoy-auth', persistSession: true, autoRefreshToken: true } })
  return client
}

/**
 * Cliente que no guarda sesión: el dueño lo usa para crear la cuenta de otra persona
 * sin perder la propia.
 */
export function detachedClient(): SupabaseClient {
  return createClient(URL, KEY, { auth: { storageKey: 'dragotoy-alta', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

/** Llama a una función de la base y traduce sus errores a los mismos mensajes de siempre. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let res
  try {
    res = await sb().rpc(fn, args)
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa internet e intenta de nuevo.')
  }
  if (res.error) throw toApiError(res.error)
  return res.data as T
}

export function toApiError(e: { message: string; hint?: string | null; code?: string }) {
  const status = Number(e.hint)
  if (status) return new ApiError(status, e.message)
  // Permiso negado antes de entrar a la función: no hay sesión válida.
  if (e.code === '42501') return new ApiError(401, 'Tu sesión terminó. Vuelve a ingresar.')
  if (/fetch|network/i.test(e.message)) return new ApiError(0, 'No hay conexión con el servidor. Revisa internet e intenta de nuevo.')
  return new ApiError(500, e.message || 'El servidor no pudo completar la operación.')
}

/**
 * Supabase Auth pide un correo. Los usuarios de la tienda entran con un nombre (con ñ y tildes),
 * así que se arma una dirección interna a partir de su código: nunca recibe mails.
 */
export function emailFor(username: string) {
  const bytes = new TextEncoder().encode(username.normalize('NFC').trim().toLocaleLowerCase('es'))
  return `u${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}@usuarios.dragotoy.app`
}
