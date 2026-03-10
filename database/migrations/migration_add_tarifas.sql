-- ============================================
-- MIGRACIÓN: Tabla para Tarifas
-- ============================================

CREATE TABLE IF NOT EXISTS tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('ISD', 'IVA', 'administracion', 'otro')),
  porcentaje DECIMAL(8, 4) NOT NULL CHECK (porcentaje > 0),
  aplica_a VARCHAR(50) NOT NULL CHECK (aplica_a IN ('transactions', 'aws', 'gcp', 'applications', 'total')),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_client_id ON tarifas(client_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_tipo ON tarifas(tipo);
CREATE INDEX IF NOT EXISTS idx_tarifas_aplica_a ON tarifas(aplica_a);

ALTER TABLE tarifas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all tarifas"
  ON tarifas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert tarifas"
  ON tarifas FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update tarifas"
  ON tarifas FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete tarifas"
  ON tarifas FOR DELETE
  USING (auth.role() = 'authenticated');
