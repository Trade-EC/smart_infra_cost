# 🗄️ Comandos para Base de Datos

## 📋 Opción 1: Usar Supabase CLI (Recomendado)

### Paso 1: Vincular tu proyecto con Supabase

Primero necesitas vincular tu proyecto local con tu proyecto de Supabase remoto:

```bash
supabase link --project-ref tu-project-ref
```

**¿Dónde encontrar el project-ref?**
- Ve a tu proyecto en Supabase Dashboard
- Ve a Settings > General
- Copia el "Reference ID" (es algo como `vfnopxowifjwo`)

**O usar el método interactivo:**
```bash
supabase link
```
Te pedirá que inicies sesión y selecciones tu proyecto.

### Paso 2: Aplicar las migraciones

Una vez vinculado, ejecuta:

```bash
supabase db push
```

Este comando aplicará todas las migraciones pendientes a tu base de datos remota.

---

## 📋 Opción 2: Ejecutar directamente con psql

Si prefieres ejecutar el SQL directamente:

```bash
# Conectar a tu base de datos de Supabase
psql "postgresql://postgres:[TU_PASSWORD]@db.[TU_PROJECT_REF].supabase.co:5432/postgres" -f database/schema.sql
```

**¿Dónde encontrar la conexión?**
- Ve a Supabase Dashboard > Settings > Database
- Copia la "Connection string" (URI)
- Reemplaza `[YOUR-PASSWORD]` con tu contraseña de la base de datos

---

## 📋 Opción 3: Desde el Dashboard de Supabase (Manual)

1. Ve a tu proyecto en Supabase Dashboard
2. Ve a **SQL Editor**
3. Abre el archivo `database/schema.sql`
4. Copia todo el contenido
5. Pégalo en el SQL Editor
6. Haz clic en **Run**

---

## 🔄 Comandos Útiles de Supabase CLI

### Ver estado de las migraciones
```bash
supabase migration list
```

### Crear una nueva migración
```bash
supabase migration new nombre_de_la_migracion
```

### Aplicar migraciones localmente (si usas Supabase local)
```bash
supabase db reset
```

### Ver diferencias entre local y remoto
```bash
supabase db diff
```

---

## ✅ Verificar que todo se creó correctamente

Después de ejecutar cualquiera de los métodos, verifica:

1. Ve a Supabase Dashboard > **Table Editor**
2. Deberías ver estas 7 tablas:
   - ✅ `clients`
   - ✅ `applications`
   - ✅ `monthly_costs`
   - ✅ `cost_allocations`
   - ✅ `cost_distributions`
   - ✅ `transactions`
   - ✅ `transaction_assignments`

---

## 🐛 Solución de Problemas

### Error: "project not linked"
**Solución**: Ejecuta `supabase link` primero

### Error: "migration already applied"
**Solución**: Las migraciones ya están aplicadas. Si quieres reaplicarlas, primero elimina las tablas manualmente desde el Dashboard.

### Error: "permission denied"
**Solución**: Verifica que tengas los permisos correctos en tu proyecto de Supabase.

---

## 💡 Recomendación

**Usa la Opción 1 (Supabase CLI)** porque:
- ✅ Es más profesional
- ✅ Mantiene un historial de migraciones
- ✅ Facilita el trabajo en equipo
- ✅ Permite revertir cambios si es necesario

