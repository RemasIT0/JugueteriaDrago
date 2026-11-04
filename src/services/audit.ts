import { uid } from '@/lib/format'
import type { AuditEntry } from '@/types'
import { loadDb, save } from './localDb'
import { currentUser } from './session'
import { cloud, rpc } from './supabase'

/** En la nube la base registra sola lo que pasa en el servidor; desde el navegador solo esto. */
const CLIENT_EVENTS = new Set(['Copia de seguridad descargada', 'Contraseña cambiada'])

const MAX_ENTRIES = 5000

/** Registra una acción sensible con quién y cuándo. Nunca lanza: el registro no debe frenar la operación. */
export async function audit(action: string, detail = '') {
  if (cloud) {
    if (CLIENT_EVENTS.has(action)) await rpc('log_client_event', { p_action: action, p_detail: detail }).catch((e) => console.error('No se pudo registrar en la actividad', e))
    return
  }
  try {
    const db = await loadDb()
    const u = currentUser()
    const entry: AuditEntry = { id: uid('a'), at: new Date().toISOString(), userId: u?.id ?? null, userName: u?.name ?? 'Sistema', action, detail }
    db.audit.unshift(entry)
    if (db.audit.length > MAX_ENTRIES) db.audit.length = MAX_ENTRIES
    await save('audit')
  } catch (e) {
    console.error('No se pudo registrar en la actividad', e)
  }
}

export async function listAudit(): Promise<AuditEntry[]> {
  if (cloud) return rpc('list_audit', { p_limit: 5000 })
  return structuredClone((await loadDb()).audit)
}
