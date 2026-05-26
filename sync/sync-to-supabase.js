/**
 * sync/sync-to-supabase.js
 *
 * Uso:
 *   node sync/sync-to-supabase.js                     → todos los mappers
 *   node sync/sync-to-supabase.js cotizaciones         → solo ese mapper
 *   node sync/sync-to-supabase.js indices tasas fci    → varios
 *   node sync/sync-to-supabase.js --from=2024-01-01    → filtra series temporales
 *
 * Requiere .env en la raíz del proyecto con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */

import { supabase } from './lib/supabase.js'
import { logSync } from './lib/utils.js'

import { syncCotizaciones }           from './mappers/cotizaciones.js'
import { syncIndices }                from './mappers/indices.js'
import { syncTasas }                  from './mappers/tasas.js'
import { syncRendimientos }           from './mappers/rendimientos.js'
import { syncCriptopesos }            from './mappers/criptopesos.js'
import { syncCuentasRemuneradasUsd }  from './mappers/cuentas-remuneradas-usd.js'
import { syncRemesas }                from './mappers/remesas.js'
import { syncLetras }                 from './mappers/letras.js'
import { syncFci }                    from './mappers/fci.js'
import { syncRem }                    from './mappers/rem.js'
import { syncFeriados }               from './mappers/feriados.js'
import { syncEventos }                from './mappers/eventos.js'

// ── Registro de mappers disponibles ──────────────────────────────────────────
const MAPPERS = {
  cotizaciones:          syncCotizaciones,
  indices:               syncIndices,
  tasas:                 syncTasas,
  rendimientos:          syncRendimientos,
  criptopesos:           syncCriptopesos,
  'cuentas-remuneradas': syncCuentasRemuneradasUsd,
  remesas:               syncRemesas,
  letras:                syncLetras,
  fci:                   syncFci,
  rem:                   syncRem,
  feriados:              syncFeriados,
  eventos:               syncEventos,
}

// ── Parseo de args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const fromArg = args.find(a => a.startsWith('--from='))
const opts = { from: fromArg ? fromArg.split('=')[1] : null }
const targets = args.filter(a => !a.startsWith('--'))

const toRun = targets.length
  ? targets.filter(t => {
      if (!MAPPERS[t]) {
        console.warn(`⚠ mapper desconocido: "${t}" (disponibles: ${Object.keys(MAPPERS).join(', ')})`)
        return false
      }
      return true
    })
  : Object.keys(MAPPERS)

// ── Ejecución ─────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n▶ ArgentinaDatos → Supabase sync`)
  console.log(`  mappers: ${toRun.join(', ')}`)
  if (opts.from) console.log(`  desde: ${opts.from}`)
  console.log()

  let totalInserted = 0
  let totalErrors = 0

  for (const name of toRun) {
    const startedAt = new Date().toISOString()
    console.log(`[${name}]`)

    try {
      const result = await MAPPERS[name](supabase, opts)
      const count = result?.count ?? 0
      const errors = result?.errors ?? []
      totalInserted += count
      totalErrors += errors.length

      const status = errors.length ? `⚠ ${errors.length} errores` : `✓ ${count} filas`
      console.log(`  → ${status}\n`)

      await logSync(supabase, name, startedAt, result)
    } catch (err) {
      totalErrors++
      console.error(`  ✗ error inesperado en [${name}]: ${err.message}\n`)
      await logSync(supabase, name, startedAt, { count: 0, errors: [{ message: err.message }] })
    }
  }

  console.log('─'.repeat(50))
  console.log(`Listo: ${totalInserted} filas upserted, ${totalErrors} errores`)
}

run().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
