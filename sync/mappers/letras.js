import { readJson, batchUpsert } from '../lib/utils.js'

export async function syncLetras(supabase, _opts = {}) {
  const data = readJson('finanzas/letras')
  if (!data) return { count: 0, errors: [] }

  const rows = data.map(item => ({
    ticker: item.ticker,
    fecha_emision: item.fechaEmision ?? null,
    fecha_vencimiento: item.fechaVencimiento ?? null,
    tem: item.tem ?? null,
    vpv: item.vpv ?? null,
  }))

  console.log(`  letras: ${rows.length} filas`)
  return batchUpsert(supabase, 'argentinadatos_letras', rows, 'ticker')
}
