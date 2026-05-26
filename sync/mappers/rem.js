import { walkDatedDirs, batchUpsert } from '../lib/utils.js'

export async function syncRem(supabase, opts = {}) {
  // datos/v1/rems/YYYY/MM/index.json
  const entries = walkDatedDirs('rems', opts.from)
  const rows = []

  for (const { data } of entries) {
    if (!Array.isArray(data)) continue
    for (const item of data) {
      rows.push({
        informe: item.informe,
        indicador: item.indicador,
        muestra: item.muestra ?? null,
        periodo_proyectado: item.periodo ?? null,
        periodo_tipo: item.periodoTipo ?? null,
        periodo_desde: item.periodoDesde ?? null,
        periodo_hasta: item.periodoHasta ?? null,
        referencia: item.referencia ?? null,
        referencia_fecha: item.referenciaFecha ?? null,
        unidad: item.unidad ?? null,
        mediana: item.mediana ?? null,
        promedio: item.promedio ?? null,
        desvio_estandar: item.desvio ?? null,
        minimo: item.minimo ?? null,
        maximo: item.maximo ?? null,
        percentil90: item.percentil90 ?? null,
        percentil75: item.percentil75 ?? null,
        percentil25: item.percentil25 ?? null,
        percentil10: item.percentil10 ?? null,
        metadata: {
          participantes: item.participantes,
          publicacionUrl: item.publicacionUrl,
          xlsxUrl: item.xlsxUrl,
        },
        publicacion_url: item.publicacionUrl ?? null,
        xlsx_url: item.xlsxUrl ?? null,
      })
    }
  }

  console.log(`  rem: ${rows.length} filas`)
  return batchUpsert(
    supabase,
    'argentinadatos_rem',
    rows,
    'informe,indicador,muestra,periodo_proyectado',
  )
}
