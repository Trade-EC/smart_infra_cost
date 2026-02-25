-- ============================================
-- MIGRACIÓN: Tabla para Reportes AWS
-- ============================================

-- Tabla: aws_reports
-- Almacena los reportes AWS procesados desde CSV
CREATE TABLE IF NOT EXISTS aws_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(255) NOT NULL,
  cloud_account_number VARCHAR(255) NOT NULL,
  seller_cost DECIMAL(10, 2) NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(cloud_account_number, date) -- Un solo registro por cuenta cloud y fecha
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_aws_reports_date ON aws_reports(date);
CREATE INDEX IF NOT EXISTS idx_aws_reports_client_id ON aws_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_aws_reports_cloud_account_number ON aws_reports(cloud_account_number);

-- Política RLS (Row Level Security)
ALTER TABLE aws_reports ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden leer sus propios reportes
CREATE POLICY "Users can read their own aws reports"
  ON aws_reports
  FOR SELECT
  USING (auth.uid() = created_by);

-- Política: Los usuarios autenticados pueden insertar sus propios reportes
CREATE POLICY "Users can insert their own aws reports"
  ON aws_reports
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Política: Los usuarios autenticados pueden actualizar sus propios reportes
CREATE POLICY "Users can update their own aws reports"
  ON aws_reports
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Política: Los usuarios autenticados pueden eliminar sus propios reportes
CREATE POLICY "Users can delete their own aws reports"
  ON aws_reports
  FOR DELETE
  USING (auth.uid() = created_by);
