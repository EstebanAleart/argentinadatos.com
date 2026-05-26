import { readJson, batchUpsert, mergeResults } from '../lib/utils.js'

const CASAS_DOLAR = [
  'oficial',
  'blue',
  'bolsa',
  'contadoconliqui',
  'cripto',
  'mayorista',
  'tarjeta',
  'solidario',
]

const OTRAS_MONEDAS = ['usd', 'eur', 'brl', 'clp', 'uyu']

export async function syncCotizaciones(supabase, opts = {}) {
  // --- Dólar ---
  const rowsDolar = []
  for (const casa of CASAS_DOLAR) {
    const data = readJson(`cotizaciones/dolares/${casa}`)
    if (!data) continue
    const filtered = opts.from ? data.filter(r => r.fecha >= opts.from) : data
    for (const item of filtered) {
      rowsDolar.push({
        casa: item.casa ?? casa,
        fecha: item.fecha,
        compra: item.compra ?? null,
        venta: item.venta,
      })
    }
  }
  console.log(`  cotizaciones_dolar: ${rowsDolar.length} filas`)
  const resDolar = await batchUpsert(
    supabase,
    'argentinadatos_cotizaciones_dolar',
    rowsDolar,
    'casa,fecha',
  )

  return resDolar
}
