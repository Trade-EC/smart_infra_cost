# Base de Datos - Smart Infra Cost

## 📋 Estructura de Tablas

### 1. **clients** - Clientes
- `id` (UUID): Identificador único
- `name` (VARCHAR): Nombre del cliente
- `email` (VARCHAR): Email del cliente (opcional)
- `created_at`, `updated_at`: Timestamps

### 2. **applications** - Aplicaciones del CSV
- `id` (UUID): Identificador único
- `name` (VARCHAR): Nombre de la aplicación (ej: "Github")
- `client_name` (VARCHAR): Nombre del cliente del CSV
- `price` (DECIMAL): Precio de la aplicación
- `date` (DATE): Fecha del cargo
- `csv_upload_id` (UUID): Para agrupar cargas del mismo CSV
- `created_at`: Timestamp
- `created_by` (UUID): Usuario que cargó el CSV

### 3. **monthly_costs** - Costos Mensuales
- `id` (UUID): Identificador único
- `month` (DATE): Mes del costo (primer día del mes)
- `description` (TEXT): Descripción opcional
- `total_amount` (DECIMAL): Monto total del mes
- `created_at`: Timestamp
- `created_by` (UUID): Usuario que creó el costo

### 4. **cost_allocations** - Asignaciones de Costos
- `id` (UUID): Identificador único
- `monthly_cost_id` (UUID): Referencia al costo mensual
- `application_id` (UUID): Referencia a la aplicación
- `total_amount` (DECIMAL): Monto total de la aplicación

### 5. **cost_distributions** - Distribución por Cliente
- `id` (UUID): Identificador único
- `cost_allocation_id` (UUID): Referencia a la asignación
- `client_id` (UUID): Referencia al cliente
- `allocation_percentage` (DECIMAL): Porcentaje asignado (0-100)
- `allocated_amount` (DECIMAL): Monto calculado

### 6. **transactions** - Transacciones
- `id` (UUID): Identificador único
- `month` (DATE): Mes de las transacciones
- `quantity` (INTEGER): Cantidad de transacciones
- `cost_per_transaction` (DECIMAL): Costo por transacción
- `total_cost` (DECIMAL): Costo total (quantity × cost_per_transaction)
- `description` (TEXT): Descripción opcional
- `created_at`: Timestamp
- `created_by` (UUID): Usuario que creó la transacción

### 7. **transaction_assignments** - Asignación de Transacciones
- `id` (UUID): Identificador único
- `transaction_id` (UUID): Referencia a la transacción
- `client_id` (UUID): Referencia al cliente
- `assigned_cost` (DECIMAL): Costo asignado al cliente

## 🚀 Cómo Ejecutar el Script

1. Ve a tu proyecto en Supabase Dashboard
2. Ve a **SQL Editor**
3. Copia y pega el contenido de `schema.sql`
4. Haz clic en **Run** o presiona `Ctrl/Cmd + Enter`
5. Verifica que todas las tablas se crearon correctamente

## 📊 Relaciones entre Tablas

```
clients
  └── cost_distributions (client_id)
  └── transaction_assignments (client_id)

applications
  └── cost_allocations (application_id)

monthly_costs
  └── cost_allocations (monthly_cost_id)
      └── cost_distributions (cost_allocation_id)

transactions
  └── transaction_assignments (transaction_id)
```

## 🔒 Seguridad (RLS)

Todas las tablas tienen Row Level Security (RLS) habilitado, permitiendo solo operaciones a usuarios autenticados.

