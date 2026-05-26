import { readJson, batchUpsert } from '../lib/utils.js'

export async function syncRemesas(supabase, _opts = {}) {
  const raw = readJson('finanzas/remesas')
  if (!raw) return { count: 0, errors: [] }

  const fechaActualizacion = raw.fechaActualizacion ?? null
  const lista = Array.isArray(raw) ? raw : (raw.remesas ?? [])

  const rows = lista.map(item => ({
    compania: item.compania,
    cuenta_propia: item.cuentaPropia ?? null,
    moneda: item.moneda ?? null,
    inversiones: item.inversiones ?? null,
    tarjeta_usa: item.tarjetaUsa ?? null,
    costo_recibir_pagos: item.costoRecibirPagos ?? null,
    costo_mantenimiento_tarjeta: item.costoMantenimientoTarjeta ?? null,
    costo_tarjeta: item.costoTarjeta ?? null,
    retiro_ars: item.retiroArs ?? null,
    calificacion_android: item.calificacionAndroid ?? null,
    calificacion_ios: item.calificacionIos ?? null,
    detalles: item.detalles ?? null,
    fecha_actualizacion: fechaActualizacion,
  }))

  console.log(`  remesas: ${rows.length} filas`)
  return batchUpsert(supabase, 'argentinadatos_remesas', rows, 'compania')
}
