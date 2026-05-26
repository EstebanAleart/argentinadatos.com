import { readJson, batchUpsert } from '../lib/utils.js'

export async function syncCuentasRemuneradasUsd(supabase, _opts = {}) {
  const data = readJson('finanzas/cuentas-remuneradas-usd')
  if (!data) return { count: 0, errors: [] }

  const rows = data.map(item => ({
    entidad: item.entidad,
    tna: item.tasa ?? null,
    tope: item.tope ?? null,
  }))

  console.log(`  cuentas_remuneradas_usd: ${rows.length} filas`)
  return batchUpsert(supabase, 'argentinadatos_cuentas_remuneradas_usd', rows, 'entidad')
}
