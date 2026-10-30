import { create } from 'zustand'

type Theme = 'light' | 'dark'

const read = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export const useTheme = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: read(),
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem('dragotoy-theme', next)
    } catch {
      /* sin almacenamiento: el tema dura solo esta sesión */
    }
    set({ theme: next })
  },
}))
