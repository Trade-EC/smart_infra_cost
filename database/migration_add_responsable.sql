-- ============================================
-- MIGRACIÓN: Agregar Responsable y Relación Many-to-Many
-- ============================================

-- 1. Renombrar client_name a responsable en applications
ALTER TABLE applications RENAME COLUMN client_name TO responsable;

-- 2. Crear tabla de relación many-to-many entre applications y clients
CREATE TABLE IF NOT EXISTS application_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(application_id, client_id) -- Evitar duplicados
);

-- 3. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_application_clients_application ON application_clients(application_id);
CREATE INDEX IF NOT EXISTS idx_application_clients_client ON application_clients(client_id);

-- 4. Habilitar RLS en la nueva tabla
ALTER TABLE application_clients ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS para application_clients
CREATE POLICY "Users can view all application_clients" ON application_clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert application_clients" ON application_clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update application_clients" ON application_clients FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete application_clients" ON application_clients FOR DELETE USING (auth.role() = 'authenticated');

