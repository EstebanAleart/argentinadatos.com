import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
export const DATOS_PATH = resolve(__dirname, '../../datos/v1')

/** Lee un index.json relativo a datos/v1. Devuelve null si no existe. */
export function readJson(relativePath) {
  const fullPath = join(DATOS_PATH, relativePath, 'index.json')
  if (!existsSync(fullPath)) {
    console.warn(`  ⚠ no existe: ${fullPath}`)
    return null
  }
  try {
    return JSON.parse(readFileSync(fullPath, 'utf-8'))
  } catch (e) {
    console.warn(`  ⚠ error leyendo ${fullPath}: ${e.message}`)
    return null
  }
}

/**
 * Traversa un directorio con estructura YYYY/MM/DD y devuelve todos los
 * index.json como array de { fecha: 'YYYY-MM-DD', data: [...] }.
 * Soporta tanto YYYY/MM/DD/index.json como YYYY/MM/index.json.
 */
export function walkDatedDirs(basePath, fromDate = null) {
  const results = []
  const base = join(DATOS_PATH, basePath)
  if (!existsSync(base)) return results

  for (const year of readdirSync(base).sort()) {
    if (!/^\d{4}$/.test(year)) continue
    const yearPath = join(base, year)

    for (const month of readdirSync(yearPath).sort()) {
      if (!/^\d{2}$/.test(month)) continue
      const monthPath = join(yearPath, month)

      // Intentar YYYY/MM/index.json primero (e.g. rems)
      const monthIndex = join(monthPath, 'index.json')
      if (existsSync(monthIndex)) {
        const fecha = `${year}-${month}`
        if (!fromDate || fecha >= fromDate.slice(0, 7)) {
          try {
            results.push({ fecha, data: JSON.parse(readFileSync(monthIndex, 'utf-8')) })
          } catch (e) {
            console.warn(`  ⚠ error leyendo ${monthIndex}`)
          }
        }
        continue
      }

      // YYYY/MM/DD/index.json
      const days = existsSync(monthPath) ? readdirSync(monthPath).sort() : []
      for (const day of days) {
        if (!/^\d{2}$/.test(day)) continue
        const fecha = `${year}-${month}-${day}`
        if (fromDate && fecha < fromDate) continue
        const dayIndex = join(monthPath, day, 'index.json')
        if (existsSync(dayIndex)) {
          try {
            results.push({ fecha, data: JSON.parse(readFileSync(dayIndex, 'utf-8')) })
          } catch (e) {
            console.warn(`  ⚠ error leyendo ${dayIndex}`)
          }
        }
      }
    }
  }
  return results
}

/**
 * Upsert en lotes de batchSize filas.
 * onConflict: columnas separadas por coma, e.g. 'casa,fecha'
 */
export async function batchUpsert(supabase, table, rows, onConflict, batchSize = 1000) {
  if (!rows.length) return { count: 0, errors: [] }

  let count = 0
  const errors = []

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: false })

    if (error) {
      errors.push({ batchStart: i, message: error.message })
      console.error(`  ✗ [${table}] batch ${i}–${i + batch.length}: ${error.message}`)
    } else {
      count += batch.length
    }
  }

  return { count, errors }
}

/** Registra el resultado en argentinadatos_sync_log */
export async function logSync(supabase, endpoint, startedAt, result) {
  const finishedAt = new Date().toISOString()
  const durationMs = Date.now() - new Date(startedAt).getTime()

  await supabase.from('argentinadatos_sync_log').insert({
    endpoint,
    started_at: startedAt,
    finished_at: finishedAt,
    status: result.errors?.length ? 'error' : 'ok',
    rows_upserted: result.count ?? 0,
    duration_ms: durationMs,
    error_message: result.errors?.length ? JSON.stringify(result.errors.slice(0, 5)) : null,
  })
}

/** Une múltiples resultados de batchUpsert en uno solo */
export function mergeResults(...results) {
  return results.reduce(
    (acc, r) => ({
      count: acc.count + (r?.count ?? 0),
      errors: [...acc.errors, ...(r?.errors ?? [])],
    }),
    { count: 0, errors: [] },
  )
}
