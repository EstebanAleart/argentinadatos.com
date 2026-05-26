import { readJson, batchUpsert, mergeResults } from '../lib/utils.js'

const TODAY = new Date().toISOString().slice(0, 10)

export async function syncTasas(supabase, opts = {}) {
  const results = []

  // ── Plazo fijo tradicional ──────────────────────────────────────────────────
  const pf = readJson('finanzas/tasas/plazoFijo')
  if (pf) {
    const rows = pf.map(item => ({
      entidad: item.entidad,
      logo: item.logo ?? null,
      tna_clientes: item.tnaClientes ?? null,
      tna_no_clientes: item.tnaNoClientes ?? null,
      fecha: TODAY,
      metadata: item.enlace ? { enlace: item.enlace } : null,
    }))
    console.log(`  tasas_plazo_fijo: ${rows.length} filas`)
    results.push(await batchUpsert(supabase, 'argentinadatos_tasas_plazo_fijo', rows, 'entidad,fecha'))
  }

  // ── Plazo fijo UVA precancelable ────────────────────────────────────────────
  const pfUvaPC = readJson('finanzas/tasas/plazoFijoPrecancelable')
  if (pfUvaPC) {
    const rows = pfUvaPC.map(item => ({
      id: item.id,
      entidad: item.entidad,
      logo: item.logo ?? null,
      enlace: item.enlace ?? null,
      canal: item.canal ?? null,
      moneda: item.moneda ?? null,
      plazo_min_dias: item.plazoMinDias ?? null,
      plazo_max_dias: item.plazoMaxDias ?? null,
      plazo_precancelacion_dias: item.plazoPrecancelacionDias ?? null,
      aviso_precancelacion_dias: item.avisoPrecancelacionDias ?? null,
      monto_minimo: item.montoMinimo ?? null,
      monto_maximo: item.montoMaximo ?? null,
      modalidad: item.modalidad ?? null,
      tna: item.tna ?? null,
      tea: item.tea ?? null,
      tna_precancelacion: item.tnaPrecancelacion ?? null,
      tea_precancelacion: item.teaPrecancelacion ?? null,
    }))
    console.log(`  tasas_pf_uva_precancelable: ${rows.length} filas`)
    results.push(
      await batchUpsert(supabase, 'argentinadatos_tasas_pf_uva_precancelable', rows, 'id'),
    )
  }

  // ── Plazo fijo UVA pago periódico (cabecera + tramos) ──────────────────────
  const pfUvaPP = readJson('finanzas/tasas/plazoFijoUvaPagoPeriodico')
  if (pfUvaPP) {
    const cabeceras = pfUvaPP.map(item => ({
      id: item.id,
      entidad: item.entidad,
      logo: item.logo ?? null,
    }))
    console.log(`  tasas_pf_uva_pago_periodico: ${cabeceras.length} entidades`)
    await batchUpsert(
      supabase,
      'argentinadatos_tasas_pf_uva_pago_periodico',
      cabeceras,
      'id',
    )

    const tramos = []
    for (const item of pfUvaPP) {
      for (const t of item.tasas ?? []) {
        tramos.push({
          entidad_id: item.id,
          nombre: t.nombre ?? null,
          plazo_min_dias: t.plazoMinDias ?? null,
          plazo_max_dias: t.plazoMaxDias ?? null,
          tna: t.tna ?? null,
          tea: t.tea ?? null,
        })
      }
    }
    console.log(`  tasas_pf_uva_pp_tramos: ${tramos.length} filas`)
    results.push(
      await batchUpsert(
        supabase,
        'argentinadatos_tasas_pf_uva_pp_tramos',
        tramos,
        'entidad_id,plazo_min_dias,plazo_max_dias',
      ),
    )
  }

  // ── Depósitos 30 días (serie temporal) ─────────────────────────────────────
  const dep30 = readJson('finanzas/tasas/depositos30Dias')
  if (dep30) {
    const filtered = opts.from ? dep30.filter(r => r.fecha >= opts.from) : dep30
    const rows = filtered.map(item => ({ fecha: item.fecha, valor: item.valor }))
    console.log(`  depositos_30d: ${rows.length} filas`)
    results.push(await batchUpsert(supabase, 'argentinadatos_depositos_30d', rows, 'fecha'))
  }

  return mergeResults(...results)
}
