-- ============================================
-- MIGRACIÓN: Tabla para Reportes GCP
-- ============================================

CREATE TABLE IF NOT EXISTS gcp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name VARCHAR(255) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_gcp_reports_date ON gcp_reports(date);
CREATE INDEX IF NOT EXISTS idx_gcp_reports_client_id ON gcp_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_gcp_reports_project_id ON gcp_reports(project_id);

ALTER TABLE gcp_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all gcp reports"
  ON gcp_reports FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert gcp reports"
  ON gcp_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update gcp reports"
  ON gcp_reports FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete gcp reports"
  ON gcp_reports FOR DELETE
  USING (auth.role() = 'authenticated');
