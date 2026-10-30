import { STORE } from '@/lib/config'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Cliente mínimo para la API real. Se usa solo cuando VITE_API_URL está definido. */
export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${STORE.apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, text || `Error ${res.status} al llamar ${path}`)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const useRealApi = () => STORE.apiUrl.length > 0

/** Latencia simulada para el modo sin backend, para que los estados de carga existan. */
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
