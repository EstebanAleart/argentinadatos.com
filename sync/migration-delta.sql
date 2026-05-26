-- ============================================================
-- ArgentinaDatos · migration-delta.sql
-- Ajustes al schema inicial para alinear con los datos reales.
-- Correr en Supabase SQL Editor antes de ejecutar el sync.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ELIMINAR tablas no utilizadas
-- ------------------------------------------------------------
DROP TABLE IF EXISTS argentinadatos_diputados_votos     CASCADE;
DROP TABLE IF EXISTS argentinadatos_diputados_actas     CASCADE;
DROP TABLE IF EXISTS argentinadatos_diputados           CASCADE;
DROP TABLE IF EXISTS argentinadatos_presidentes         CASCADE;

-- ------------------------------------------------------------
-- 2. argentinadatos_rendimientos
-- Real: { moneda, apy, fecha }  — entidad viene del directorio
-- Tenía: tna, tea, tipo, monto_minimo (todos incorrectos)
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'argentinadatos_rendimientos'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE argentinadatos_rendimientos DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE argentinadatos_rendimientos
  DROP COLUMN IF EXISTS tna,
  DROP COLUMN IF EXISTS tea,
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS monto_minimo,
  ADD COLUMN IF NOT EXISTS moneda TEXT,
  ADD COLUMN IF NOT EXISTS apy    NUMERIC(8,4);

ALTER TABLE argentinadatos_rendimientos
  ADD CONSTRAINT argentinadatos_rendimientos_entidad_moneda_fecha_key
  UNIQUE(entidad, moneda, fecha);

-- ------------------------------------------------------------
-- 3. argentinadatos_criptopesos
-- Real: { token, entidad, tna }  — sin fecha
-- Tenía: moneda (→ token), apy (→ tna), fecha
-- ------------------------------------------------------------
ALTER TABLE argentinadatos_criptopesos RENAME COLUMN moneda TO token;
ALTER TABLE argentinadatos_criptopesos RENAME COLUMN apy   TO tna;
ALTER TABLE argentinadatos_criptopesos DROP COLUMN IF EXISTS fecha;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'argentinadatos_criptopesos'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE argentinadatos_criptopesos DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS idx_ad_crypto_fecha;

ALTER TABLE argentinadatos_criptopesos
  ADD CONSTRAINT argentinadatos_criptopesos_entidad_token_key
  UNIQUE(entidad, token);

-- ------------------------------------------------------------
-- 4. argentinadatos_remesas
-- Real: lista de compañías con ~12 campos. NO es serie temporal.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS argentinadatos_remesas CASCADE;

CREATE TABLE argentinadatos_remesas (
  compania                     TEXT PRIMARY KEY,
  cuenta_propia                BOOLEAN,
  moneda                       TEXT,
  inversiones                  BOOLEAN,
  tarjeta_usa                  BOOLEAN,
  costo_recibir_pagos          TEXT,
  costo_mantenimiento_tarjeta  TEXT,
  costo_tarjeta                TEXT,
  retiro_ars                   TEXT,
  calificacion_android         NUMERIC(4,2),
  calificacion_ios             NUMERIC(4,2),
  detalles                     JSONB,
  fecha_actualizacion          TIMESTAMPTZ,
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_ad_remesas_upd
  BEFORE UPDATE ON argentinadatos_remesas
  FOR EACH ROW EXECUTE FUNCTION argentinadatos_set_updated_at();

ALTER TABLE argentinadatos_remesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "argentinadatos_public_read" ON argentinadatos_remesas
  FOR SELECT TO anon, authenticated USING (true);

-- ------------------------------------------------------------
-- 5. argentinadatos_rem
-- Real: { informe, fecha, muestra, indicador, periodo, periodoTipo,
--         periodoDesde, periodoHasta, referencia, referenciaFecha,
--         unidad, mediana, promedio, desvio, maximo, minimo,
--         percentil90/75/25/10, participantes, publicacionUrl, xlsxUrl }
-- Tenía: anio, mes, variable  — incompleto e incorrecto
-- ------------------------------------------------------------
ALTER TABLE argentinadatos_rem RENAME COLUMN variable TO indicador;

ALTER TABLE argentinadatos_rem
  ADD COLUMN IF NOT EXISTS informe          TEXT,
  ADD COLUMN IF NOT EXISTS muestra          TEXT,
  ADD COLUMN IF NOT EXISTS periodo_tipo     TEXT,
  ADD COLUMN IF NOT EXISTS periodo_desde    DATE,
  ADD COLUMN IF NOT EXISTS periodo_hasta    DATE,
  ADD COLUMN IF NOT EXISTS referencia       TEXT,
  ADD COLUMN IF NOT EXISTS referencia_fecha DATE,
  ADD COLUMN IF NOT EXISTS unidad           TEXT,
  ADD COLUMN IF NOT EXISTS percentil90      NUMERIC(16,4),
  ADD COLUMN IF NOT EXISTS percentil75      NUMERIC(16,4),
  ADD COLUMN IF NOT EXISTS percentil25      NUMERIC(16,4),
  ADD COLUMN IF NOT EXISTS percentil10      NUMERIC(16,4),
  ADD COLUMN IF NOT EXISTS publicacion_url  TEXT,
  ADD COLUMN IF NOT EXISTS xlsx_url         TEXT;

-- anio y mes son redundantes con informe ("2026-04")
ALTER TABLE argentinadatos_rem
  DROP COLUMN IF EXISTS anio,
  DROP COLUMN IF EXISTS mes;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'argentinadatos_rem'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE argentinadatos_rem DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE argentinadatos_rem
  ADD CONSTRAINT argentinadatos_rem_unique_key
  UNIQUE(informe, indicador, muestra, periodo_proyectado);

-- ------------------------------------------------------------
-- 6. argentinadatos_letras
-- Real: { ticker, fechaEmision, fechaVencimiento, tem, vpv }
-- Tenía: tna, tea, precio  — incorrectos
-- ------------------------------------------------------------
ALTER TABLE argentinadatos_letras
  DROP COLUMN IF EXISTS tna,
  DROP COLUMN IF EXISTS tea,
  DROP COLUMN IF EXISTS precio,
  ADD COLUMN IF NOT EXISTS tem NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS vpv NUMERIC(16,6);

-- ------------------------------------------------------------
-- 7. argentinadatos_fci_snapshots
-- Real: { fondo, horizonte, fecha, vcp, ccp, patrimonio }
-- Tenía: variacion_diaria/mensual/anual (no existen); faltaban ccp y horizonte
-- Se quita FK para soportar fondos históricos fuera del catálogo actual
-- ------------------------------------------------------------
ALTER TABLE argentinadatos_fci_snapshots
  DROP COLUMN IF EXISTS variacion_diaria,
  DROP COLUMN IF EXISTS variacion_mensual,
  DROP COLUMN IF EXISTS variacion_anual,
  ADD COLUMN IF NOT EXISTS ccp      NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS horizonte TEXT;

ALTER TABLE argentinadatos_fci_snapshots
  DROP CONSTRAINT IF EXISTS argentinadatos_fci_snapshots_fondo_fkey;

-- ------------------------------------------------------------
-- 8. argentinadatos_tasas_pf_uva_precancelable
-- Real: 15+ campos (id, canal, moneda, plazos, montos, modalidad, etc.)
-- Se recrea completa
-- ------------------------------------------------------------
DROP TABLE IF EXISTS argentinadatos_tasas_pf_uva_precancelable CASCADE;

CREATE TABLE argentinadatos_tasas_pf_uva_precancelable (
  id                        TEXT PRIMARY KEY,
  entidad                   TEXT NOT NULL,
  logo                      TEXT,
  enlace                    TEXT,
  canal                     TEXT,
  moneda                    TEXT,
  plazo_min_dias            INT,
  plazo_max_dias            INT,
  plazo_precancelacion_dias INT,
  aviso_precancelacion_dias INT,
  monto_minimo              NUMERIC(16,2),
  monto_maximo              NUMERIC(16,2),
  modalidad                 TEXT,
  tna                       NUMERIC(10,6),
  tea                       NUMERIC(10,6),
  tna_precancelacion        NUMERIC(10,6),
  tea_precancelacion        NUMERIC(10,6),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_ad_pf_uva_pc_upd
  BEFORE UPDATE ON argentinadatos_tasas_pf_uva_precancelable
  FOR EACH ROW EXECUTE FUNCTION argentinadatos_set_updated_at();

ALTER TABLE argentinadatos_tasas_pf_uva_precancelable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "argentinadatos_public_read" ON argentinadatos_tasas_pf_uva_precancelable
  FOR SELECT TO anon, authenticated USING (true);

-- ------------------------------------------------------------
-- 9. argentinadatos_tasas_pf_uva_pago_periodico
-- Real: entidad + array anidado de tasas por tramo de plazo
-- Se separa en entidad (cabecera) + tramos (detalle)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS argentinadatos_tasas_pf_uva_pago_periodico CASCADE;

CREATE TABLE argentinadatos_tasas_pf_uva_pago_periodico (
  id         TEXT PRIMARY KEY,
  entidad    TEXT NOT NULL,
  logo       TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE argentinadatos_tasas_pf_uva_pp_tramos (
  id             BIGSERIAL PRIMARY KEY,
  entidad_id     TEXT NOT NULL
    REFERENCES argentinadatos_tasas_pf_uva_pago_periodico(id) ON DELETE CASCADE,
  nombre         TEXT,
  plazo_min_dias INT,
  plazo_max_dias INT,
  tna            NUMERIC(10,6),
  tea            NUMERIC(10,6),
  UNIQUE(entidad_id, plazo_min_dias, plazo_max_dias)
);

CREATE TRIGGER trg_ad_pf_uva_pp_upd
  BEFORE UPDATE ON argentinadatos_tasas_pf_uva_pago_periodico
  FOR EACH ROW EXECUTE FUNCTION argentinadatos_set_updated_at();

ALTER TABLE argentinadatos_tasas_pf_uva_pago_periodico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "argentinadatos_public_read" ON argentinadatos_tasas_pf_uva_pago_periodico
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE argentinadatos_tasas_pf_uva_pp_tramos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "argentinadatos_public_read" ON argentinadatos_tasas_pf_uva_pp_tramos
  FOR SELECT TO anon, authenticated USING (true);

-- ------------------------------------------------------------
-- 10. argentinadatos_cuentas_remuneradas_usd
-- Real: { entidad, tasa, tope }  — sin fecha
-- Tenía fecha en la UNIQUE; faltaba tope
-- ------------------------------------------------------------
ALTER TABLE argentinadatos_cuentas_remuneradas_usd DROP COLUMN IF EXISTS fecha;
ALTER TABLE argentinadatos_cuentas_remuneradas_usd
  ADD COLUMN IF NOT EXISTS tope NUMERIC(16,2);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'argentinadatos_cuentas_remuneradas_usd'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE argentinadatos_cuentas_remuneradas_usd DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE argentinadatos_cuentas_remuneradas_usd
  ADD CONSTRAINT argentinadatos_cuentas_remuneradas_usd_entidad_key UNIQUE(entidad);

-- ------------------------------------------------------------
-- 11. argentinadatos_eventos_presidenciales
-- Real: { fecha, tipo, evento }  — sin presidente ni descripcion
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'argentinadatos_eventos_presidenciales'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE argentinadatos_eventos_presidenciales DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE argentinadatos_eventos_presidenciales
  DROP COLUMN IF EXISTS presidente;

ALTER TABLE argentinadatos_eventos_presidenciales
  RENAME COLUMN descripcion TO evento;

ALTER TABLE argentinadatos_eventos_presidenciales
  ADD CONSTRAINT argentinadatos_eventos_presidenciales_unique_key
  UNIQUE(fecha, tipo, evento);

-- ============================================================
-- FIN DEL DELTA
-- ============================================================
