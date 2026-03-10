CREATE TABLE IF NOT EXISTS gcp_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gcp_report_id UUID NOT NULL REFERENCES gcp_reports(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gcp_report_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_gcp_report_clients_report ON gcp_report_clients(gcp_report_id);
CREATE INDEX IF NOT EXISTS idx_gcp_report_clients_client ON gcp_report_clients(client_id);
ALTER TABLE gcp_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view gcp_report_clients" ON gcp_report_clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert gcp_report_clients" ON gcp_report_clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete gcp_report_clients" ON gcp_report_clients FOR DELETE USING (auth.role() = 'authenticated');
