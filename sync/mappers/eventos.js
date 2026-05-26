import { readJson, batchUpsert } from '../lib/utils.js'

export async function syncEventos(supabase, _opts = {}) {
  const data = readJson('eventos/presidenciales')
  if (!Array.isArray(data)) return { count: 0, errors: [] }

  const rows = data.map(item => ({
    fecha: item.fecha,
    tipo: item.tipo ?? null,
    evento: item.evento ?? item.descripcion ?? null,
  }))

  console.log(`  eventos_presidenciales: ${rows.length} filas`)
  return batchUpsert(
    supabase,
    'argentinadatos_eventos_presidenciales',
    rows,
    'fecha,tipo,evento',
  )
}
