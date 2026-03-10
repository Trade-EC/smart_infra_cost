-- ============================================
-- MIGRACIÓN: Agregar activa y fecha_inicio a tarifas
-- ============================================

ALTER TABLE tarifas ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tarifas ADD COLUMN IF NOT EXISTS fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_tarifas_activa ON tarifas(activa);
CREATE INDEX IF NOT EXISTS idx_tarifas_fecha_inicio ON tarifas(fecha_inicio);
