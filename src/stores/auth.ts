import { create } from 'zustand'
import { can, type Permission } from '@/lib/permissions'
import * as auth from '@/services/auth'
import { initializeLocalData } from '@/services/api'
import { isInitialized } from '@/services/localDb'
import { useInventory } from './inventory'
import type { PublicUser } from '@/types'

type Phase = 'checking' | 'setup' | 'login' | 'in'

interface AuthState {
  phase: Phase
  user: PublicUser | null
  boot: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  setupDone: (user: PublicUser) => void
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  phase: 'checking',
  user: null,

  async boot() {
    const [hasUsers, initialized] = await Promise.all([auth.hasUsers(), isInitialized()])
    if (!hasUsers) return set({ phase: 'setup' })
    // Hay dueño pero la configuración se cortó a mitad: se completa sin datos de ejemplo.
    if (!initialized) await initializeLocalData({ demo: false })
    const user = await auth.restoreSession()
    set(user ? { phase: 'in', user } : { phase: 'login' })
  },

  async login(username, password) {
    const user = await auth.login(username, password)
    set({ phase: 'in', user })
  },

  setupDone: (user) => set({ phase: 'in', user }),

  async logout() {
    await auth.logout()
    useInventory.getState().reset()
    set({ phase: 'login', user: null })
  },
}))

/** ¿El usuario con sesión puede hacer esto? Para mostrar u ocultar acciones. */
export const useCan = (p: Permission) => useAuth((s) => can(s.user?.role, p))
