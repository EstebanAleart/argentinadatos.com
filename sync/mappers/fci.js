import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { DATOS_PATH, readJson, walkDatedDirs, batchUpsert, mergeResults } from '../lib/utils.js'

const CATEGORIAS = [
  'mercadoDinero',
  'rentaFija',
  'rentaMixta',
  'rentaVariable',
  'retornoTotal',
]

export async function syncFci(supabase, opts = {}) {
  const results = []

  // ── Catálogo de fondos ──────────────────────────────────────────────────────
  // datos/v1/finanzas/fci/fondos/index.json → { fondos: [...] }
  const catalogoRaw = readJson('finanzas/fci/fondos')
  if (catalogoRaw) {
    const lista = Array.isArray(catalogoRaw) ? catalogoRaw : (catalogoRaw.fondos ?? [])
    const rows = lista.map(item => ({
      nombre: item.nombre,
      tipo: item.tipoRenta ?? null,
      sociedad: item.administradora ?? null,
      horizonte: item.horizonte ?? null,
      riesgo: null,
      moneda: item.moneda ?? null,
      metadata: {
        fondoId: item.fondoId,
        claseId: item.claseId,
        depositaria: item.depositaria,
        tipoDD: item.tipoDD,
        codigoCNV: item.codigoCNV,
        patrimonio: item.patrimonio,
        inversionMinima: item.inversionMinima,
        plazoLiquidacionDias: item.plazoLiquidacionDias,
        rendimientos: item.rendimientos,
      },
    }))
    console.log(`  fci_fondos (catálogo): ${rows.length} filas`)
    results.push(await batchUpsert(supabase, 'argentinadatos_fci_fondos', rows, 'nombre'))
  }

  // ── Snapshots por categoría ─────────────────────────────────────────────────
  // datos/v1/finanzas/fci/{categoria}/YYYY/MM/DD/index.json
  for (const categoria of CATEGORIAS) {
    const basePath = `finanzas/fci/${categoria}`
    const entries = walkDatedDirs(basePath, opts.from)
    const rows = []

    for (const { fecha: fechaPath, data } of entries) {
      if (!Array.isArray(data)) continue
      for (const item of data) {
        if (!item.fondo) continue
        rows.push({
          fondo: item.fondo,
          tipo: categoria,
          fecha: item.fecha ?? fechaPath,   // fecha del JSON, o del path como fallback
          vcp: item.vcp ?? null,
          ccp: item.ccp ?? null,
          patrimonio: item.patrimonio ?? null,
          horizonte: item.horizonte ?? null,
        })
      }
    }

    // deduplicar por (fondo, fecha) — el mismo fondo puede aparecer dos veces en la fuente
    const seen = new Map()
    for (const r of rows) seen.set(`${r.fondo}|${r.fecha}`, r)
    const unique = [...seen.values()]

    console.log(`  fci_snapshots [${categoria}]: ${unique.length} filas`)
    if (unique.length) {
      results.push(
        await batchUpsert(supabase, 'argentinadatos_fci_snapshots', unique, 'fondo,fecha'),
      )
    }
  }

  return mergeResults(...results)
}
