-- Tabla de licencias
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  responsable TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 4) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Pivot table cliente-licencia
CREATE TABLE IF NOT EXISTS license_clients (
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  PRIMARY KEY (license_id, client_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_licenses_date ON licenses(date);
CREATE INDEX IF NOT EXISTS idx_license_clients_license_id ON license_clients(license_id);
CREATE INDEX IF NOT EXISTS idx_license_clients_client_id ON license_clients(client_id);

-- RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage licenses"
  ON licenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage license_clients"
  ON license_clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
