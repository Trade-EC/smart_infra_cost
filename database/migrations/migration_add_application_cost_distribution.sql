-- ============================================
-- MIGRACIÓN: Distribución porcentual de costos de aplicaciones
-- ============================================

-- Tabla: application_cost_distributions
-- Almacena la distribución porcentual del costo de una aplicación entre múltiples clientes
CREATE TABLE IF NOT EXISTS application_cost_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  allocation_percentage DECIMAL(5, 2) NOT NULL, -- Porcentaje (0-100)
  allocated_amount DECIMAL(10, 2) NOT NULL, -- Monto calculado (price * percentage / 100)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(application_id, client_id) -- Un cliente solo puede aparecer una vez por aplicación
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_application_cost_distributions_application ON application_cost_distributions(application_id);
CREATE INDEX IF NOT EXISTS idx_application_cost_distributions_client ON application_cost_distributions(client_id);

-- Política RLS (Row Level Security)
ALTER TABLE application_cost_distributions ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden leer todas las distribuciones
CREATE POLICY "Users can view all application_cost_distributions"
  ON application_cost_distributions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: Los usuarios autenticados pueden insertar distribuciones
CREATE POLICY "Users can insert application_cost_distributions"
  ON application_cost_distributions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política: Los usuarios autenticados pueden actualizar distribuciones
CREATE POLICY "Users can update application_cost_distributions"
  ON application_cost_distributions
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Política: Los usuarios autenticados pueden eliminar distribuciones
CREATE POLICY "Users can delete application_cost_distributions"
  ON application_cost_distributions
  FOR DELETE
  USING (auth.role() = 'authenticated');
