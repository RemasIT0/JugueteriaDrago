/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_CURRENCY?: string
  /** '1' en la aplicación de escritorio (desktop/): imprime sin ventanas emergentes. */
  readonly VITE_DESKTOP?: string
  /** Dirección pública de la tienda online; en el escritorio se abre en el navegador. */
  readonly VITE_STORE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
