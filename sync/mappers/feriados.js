import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { DATOS_PATH, readJson, batchUpsert } from '../lib/utils.js'

export async function syncFeriados(supabase, _opts = {}) {
  const base = join(DATOS_PATH, 'feriados')
  if (!existsSync(base)) return { count: 0, errors: [] }

  const rows = []

  // Lee todos los años disponibles + el index raíz
  const años = readdirSync(base).filter(d => /^\d{4}$/.test(d))
  for (const año of años) {
    const data = readJson(`feriados/${año}`)
    if (!Array.isArray(data)) continue
    for (const item of data) {
      rows.push({
        fecha: item.fecha,
        anio: parseInt(item.fecha.slice(0, 4), 10),
        nombre: item.nombre,
        tipo: item.tipo ?? null,
        motivo: null,
      })
    }
  }

  // también el index raíz (año actual + próximos)
  const root = readJson('feriados')
  if (Array.isArray(root)) {
    for (const item of root) {
      rows.push({
        fecha: item.fecha,
        anio: parseInt(item.fecha.slice(0, 4), 10),
        nombre: item.nombre,
        tipo: item.tipo ?? null,
        motivo: null,
      })
    }
  }

  // deduplicar por fecha
  const unique = [...new Map(rows.map(r => [r.fecha, r])).values()]
  console.log(`  feriados: ${unique.length} filas`)
  return batchUpsert(supabase, 'argentinadatos_feriados', unique, 'fecha')
}
