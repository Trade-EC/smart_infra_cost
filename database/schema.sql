-- ============================================
-- ESQUEMA DE BASE DE DATOS - SMART INFRA COST
-- ============================================

-- Tabla: Clientes
-- Almacena la información de los clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Aplicaciones
-- Almacena las aplicaciones cargadas desde el CSV del estado de cuenta
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL, -- Nombre del cliente del CSV
  price DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  csv_upload_id UUID, -- Para agrupar cargas del mismo CSV
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabla: Costos Mensuales
-- Representa un mes de costos creado
CREATE TABLE IF NOT EXISTS monthly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL, -- Primer día del mes (YYYY-MM-01)
  description TEXT,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(month) -- Un solo costo por mes
);

-- Tabla: Asignaciones de Costos
-- Relaciona aplicaciones con costos mensuales y distribuye entre clientes
CREATE TABLE IF NOT EXISTS cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_cost_id UUID NOT NULL REFERENCES monthly_costs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  total_amount DECIMAL(10, 2) NOT NULL, -- Monto total de la aplicación
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Distribución de Costos por Cliente
-- Distribuye el costo de una aplicación entre múltiples clientes
CREATE TABLE IF NOT EXISTS cost_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_allocation_id UUID NOT NULL REFERENCES cost_allocations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  allocation_percentage DECIMAL(5, 2) NOT NULL, -- Porcentaje (0-100)
  allocated_amount DECIMAL(10, 2) NOT NULL, -- Monto calculado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cost_allocation_id, client_id) -- Un cliente solo puede aparecer una vez por asignación
);

-- Tabla: Transacciones
-- Almacena las transacciones por mes
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL, -- Primer día del mes (YYYY-MM-01)
  quantity INTEGER NOT NULL, -- Cantidad de transacciones
  cost_per_transaction DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL, -- quantity * cost_per_transaction
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabla: Asignación de Transacciones a Clientes
-- Asigna transacciones a clientes específicos
CREATE TABLE IF NOT EXISTS transaction_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assigned_cost DECIMAL(10, 2) NOT NULL, -- Costo asignado a este cliente
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(transaction_id, client_id) -- Un cliente solo puede aparecer una vez por transacción
);

-- ============================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_applications_date ON applications(date);
CREATE INDEX IF NOT EXISTS idx_applications_client_name ON applications(client_name);
CREATE INDEX IF NOT EXISTS idx_monthly_costs_month ON monthly_costs(month);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions(month);
CREATE INDEX IF NOT EXISTS idx_cost_allocations_monthly_cost ON cost_allocations(monthly_cost_id);
CREATE INDEX IF NOT EXISTS idx_cost_distributions_allocation ON cost_distributions(cost_allocation_id);
CREATE INDEX IF NOT EXISTS idx_transaction_assignments_transaction ON transaction_assignments(transaction_id);

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas: Permitir todo a usuarios autenticados (puedes ajustar según necesites)
CREATE POLICY "Users can view all clients" ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert clients" ON clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update clients" ON clients FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete clients" ON clients FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all applications" ON applications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert applications" ON applications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update applications" ON applications FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete applications" ON applications FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all monthly_costs" ON monthly_costs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert monthly_costs" ON monthly_costs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update monthly_costs" ON monthly_costs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete monthly_costs" ON monthly_costs FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all cost_allocations" ON cost_allocations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert cost_allocations" ON cost_allocations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update cost_allocations" ON cost_allocations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete cost_allocations" ON cost_allocations FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all cost_distributions" ON cost_distributions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert cost_distributions" ON cost_distributions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update cost_distributions" ON cost_distributions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete cost_distributions" ON cost_distributions FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all transactions" ON transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert transactions" ON transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update transactions" ON transactions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete transactions" ON transactions FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all transaction_assignments" ON transaction_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert transaction_assignments" ON transaction_assignments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update transaction_assignments" ON transaction_assignments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete transaction_assignments" ON transaction_assignments FOR DELETE USING (auth.role() = 'authenticated');

