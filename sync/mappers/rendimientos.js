import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { DATOS_PATH, readJson, batchUpsert } from '../lib/utils.js'

export async function syncRendimientos(supabase, opts = {}) {
  const base = join(DATOS_PATH, 'finanzas/rendimientos')
  if (!existsSync(base)) {
    console.warn('  ⚠ directorio finanzas/rendimientos no encontrado')
    return { count: 0, errors: [] }
  }

  const rows = []
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const entidad = entry.name
    const data = readJson(`finanzas/rendimientos/${entidad}`)
    if (!Array.isArray(data)) continue
    const filtered = opts.from ? data.filter(r => r.fecha >= opts.from) : data
    for (const item of filtered) {
      rows.push({
        entidad,
        moneda: item.moneda,
        apy: item.apy ?? null,
        fecha: item.fecha,
      })
    }
  }

  // deduplicar por (entidad, moneda, fecha) — último valor gana
  const seen = new Map()
  for (const r of rows) seen.set(`${r.entidad}|${r.moneda}|${r.fecha}`, r)
  const unique = [...seen.values()]

  console.log(`  rendimientos: ${unique.length} filas`)
  return batchUpsert(supabase, 'argentinadatos_rendimientos', unique, 'entidad,moneda,fecha')
}
