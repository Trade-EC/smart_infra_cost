# 🔄 Migración: Agregar Responsable y Relación Many-to-Many

## 📋 Cambios Realizados

1. **Renombrar columna**: `client_name` → `responsable` en la tabla `applications`
2. **Nueva tabla**: `application_clients` para relación many-to-many entre aplicaciones y clientes
3. **Índices y políticas RLS** configurados

## 🚀 Cómo Ejecutar la Migración

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en **Supabase Dashboard**
2. Ve a **SQL Editor**
3. Abre el archivo `database/migration_add_responsable.sql`
4. Copia TODO el contenido
5. Pégalo en el SQL Editor
6. Haz clic en **Run** o presiona `Ctrl/Cmd + Enter`
7. Verifica que no haya errores

### Opción 2: Desde la Terminal (si usas Supabase CLI)

```bash
# Si ya tienes el proyecto vinculado
supabase db push

# O ejecutar el SQL directamente
psql "tu-connection-string" -f database/migration_add_responsable.sql
```

## ✅ Verificar que Funcionó

Después de ejecutar la migración:

1. Ve a **Table Editor** en Supabase
2. Verifica que:
   - La tabla `applications` ahora tiene la columna `responsable` (en lugar de `client_name`)
   - Existe la nueva tabla `application_clients`
3. Prueba cargar un CSV y asignar clientes desde la interfaz

## 📊 Estructura de la Nueva Tabla

**application_clients**
- `id` (UUID): Identificador único
- `application_id` (UUID): Referencia a la aplicación
- `client_id` (UUID): Referencia al cliente
- `created_at`: Timestamp

## ⚠️ Nota Importante

Si ya tienes datos en la tabla `applications`:
- La columna `client_name` se renombrará a `responsable`
- Los datos existentes se mantendrán
- Las aplicaciones existentes NO tendrán clientes asignados automáticamente
- Deberás asignar los clientes manualmente desde la interfaz

## 🔄 Después de la Migración

Una vez ejecutada la migración:
1. Recarga la página de Aplicaciones
2. Verás "Responsable" en lugar de "Cliente"
3. Podrás asignar múltiples clientes a cada aplicación
4. Los clientes asignados se mostrarán como badges

