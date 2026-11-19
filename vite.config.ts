import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

/**
 * Número de esta versión del programa: el commit de git (en Vercel, el que se está publicando).
 * Va dentro del código (__BUILD_ID__) y en /version.json, así el panel puede darse cuenta de que
 * hay una versión más nueva publicada y ofrecer actualizar.
 */
function buildId() {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  if (fromVercel) return fromVercel
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return `local-${Date.now().toString(36)}`
  }
}

const BUILD_ID = buildId()
const BUILT_AT = new Date().toISOString()

function versionFile(): Plugin {
  return {
    name: 'dragotoy-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, builtAt: BUILT_AT }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
