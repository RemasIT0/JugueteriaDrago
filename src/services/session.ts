import type { PublicUser } from '@/types'

/** Usuario con sesión iniciada, accesible desde la capa de datos (auditoría y permisos). */
let user: PublicUser | null = null

export const currentUser = () => user
export const setCurrentUser = (u: PublicUser | null) => {
  user = u
}
