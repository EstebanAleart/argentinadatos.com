import { readJson, batchUpsert } from '../lib/utils.js'

export async function syncCriptopesos(supabase, _opts = {}) {
  const data = readJson('finanzas/criptopesos')
  if (!data) return { count: 0, errors: [] }

  const rows = data.map(item => ({
    entidad: item.entidad,
    token: item.token,
    tna: item.tna ?? null,
  }))

  console.log(`  criptopesos: ${rows.length} filas`)
  return batchUpsert(supabase, 'argentinadatos_criptopesos', rows, 'entidad,token')
}
