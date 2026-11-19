/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_CURRENCY?: string
  /** '1' en la aplicación de escritorio (desktop/): imprime sin ventanas emergentes. */
  readonly VITE_DESKTOP?: string
  /** Dirección pública de la tienda online; en el escritorio se abre en el navegador. */
  readonly VITE_STORE_URL?: string
  /** Dónde está publicada la versión más nueva (solo en el escritorio): para avisar que hay actualización. */
  readonly VITE_UPDATE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Versión de este programa (commit de git), la pone vite.config.ts al compilar. */
declare const __BUILD_ID__: string
