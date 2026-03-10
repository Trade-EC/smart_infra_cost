CREATE TABLE IF NOT EXISTS aws_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aws_report_id UUID NOT NULL REFERENCES aws_reports(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(aws_report_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_aws_report_clients_report ON aws_report_clients(aws_report_id);
CREATE INDEX IF NOT EXISTS idx_aws_report_clients_client ON aws_report_clients(client_id);
ALTER TABLE aws_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view aws_report_clients" ON aws_report_clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert aws_report_clients" ON aws_report_clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete aws_report_clients" ON aws_report_clients FOR DELETE USING (auth.role() = 'authenticated');
