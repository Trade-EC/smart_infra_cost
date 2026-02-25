-- ============================================
-- MIGRACIÓN: Agregar columna 'notes' a la tabla 'clients'
-- ============================================

-- Agregar columna 'notes' a la tabla clients
-- Si la columna ya existe, no se creará (IF NOT EXISTS no está disponible para ALTER TABLE, pero podemos usar DO)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'clients' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE clients ADD COLUMN notes TEXT;
    END IF;
END $$;

-- La columna 'email' se mantiene por compatibilidad, pero ya no se usa en el código
-- Si quieres eliminar la columna 'email', descomenta la siguiente línea:
-- ALTER TABLE clients DROP COLUMN IF EXISTS email;
