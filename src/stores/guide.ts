import { create } from 'zustand'

/** Clave por usuario: la guía se ofrece sola la primera vez que cada persona entra. */
const key = (userId: string) => `dragotoy-guide-done:${userId}`

export function guideSeen(userId: string) {
  try {
    return localStorage.getItem(key(userId)) === '1'
  } catch {
    return true // sin almacenamiento no se insiste: queda el botón «Guía de uso»
  }
}

export function markGuideSeen(userId: string) {
  try {
    localStorage.setItem(key(userId), '1')
  } catch {
    /* sin almacenamiento: se vuelve a ofrecer la próxima vez */
  }
}

export const useGuide = create<{ open: boolean; start: () => void; stop: () => void }>((set) => ({
  open: false,
  start: () => set({ open: true }),
  stop: () => set({ open: false }),
}))
