# Migraciones de Base de Datos

Todas las migraciones SQL están organizadas en esta carpeta.

## Estructura

- `schema.sql` - Esquema inicial de la base de datos
- `migration_add_responsable.sql` - Migración para agregar campo responsable
- `20251213170738_initial_schema.sql` - Migración inicial con timestamp

## Cómo aplicar migraciones

### Opción 1: Desde Supabase Dashboard
1. Ve a tu proyecto en Supabase
2. Navega a SQL Editor
3. Copia y pega el contenido de cada archivo SQL
4. Ejecuta en orden cronológico

### Opción 2: Desde CLI de Supabase
```bash
# Si tienes Supabase CLI instalado
supabase db push
```

## Orden recomendado de aplicación

1. `schema.sql` o `20251213170738_initial_schema.sql` (esquema base)
2. `migration_add_responsable.sql` (si aplica)
