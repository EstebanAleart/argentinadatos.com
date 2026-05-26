import { readJson, batchUpsert, mergeResults } from '../lib/utils.js'

const INDICES = [
  { tipo: 'inflacion_mensual',    path: 'finanzas/indices/inflacion' },
  { tipo: 'inflacion_interanual', path: 'finanzas/indices/inflacionInteranual' },
  { tipo: 'uva',                  path: 'finanzas/indices/uva' },
  { tipo: 'riesgo_pais',          path: 'finanzas/indices/riesgo-pais' },
]

export async function syncIndices(supabase, opts = {}) {
  const rows = []
  for (const { tipo, path } of INDICES) {
    const data = readJson(path)
    if (!data) continue
    const filtered = opts.from ? data.filter(r => r.fecha >= opts.from) : data
    for (const item of filtered) {
      rows.push({ tipo, fecha: item.fecha, valor: item.valor })
    }
  }
  console.log(`  indices: ${rows.length} filas`)
  return batchUpsert(supabase, 'argentinadatos_indices', rows, 'tipo,fecha')
}
