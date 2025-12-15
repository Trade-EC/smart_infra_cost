# 📄 Cómo Funciona el Guardado del CSV

## 🔍 Resumen

**El archivo CSV NO se guarda como archivo.** Solo se extraen los datos y se guardan en la base de datos.

## 📊 Proceso Paso a Paso

### 1. **Carga del Archivo**
- Cuando seleccionas un archivo CSV, se lee su contenido en memoria
- El archivo se procesa línea por línea
- **El archivo original NO se guarda en ningún servidor o base de datos**

### 2. **Extracción de Datos**
El sistema extrae solo estas columnas del CSV:
- `Date (UTC)` → Se convierte a formato estándar (YYYY-MM-DD)
- `Description` → Nombre de la aplicación (ej: "Supabase", "Vercel")
- `Amount` → Precio (se toma el valor absoluto porque viene negativo)
- `Name On Card` → Se guarda como "Responsable" (o "client_name" antes de la migración)

### 3. **Guardado en Base de Datos**
Los datos extraídos se guardan en la tabla `applications` con esta estructura:

```sql
applications
├── id (UUID único)
├── name (Description del CSV)
├── responsable (Name On Card del CSV)
├── price (Amount del CSV)
├── date (Date (UTC) del CSV)
├── csv_upload_id (UUID para agrupar aplicaciones del mismo CSV)
├── created_at (Fecha de carga)
└── created_by (Usuario que cargó el CSV)
```

### 4. **Agrupación por CSV**
- Cada carga de CSV genera un `csv_upload_id` único
- Todas las aplicaciones del mismo CSV comparten el mismo `csv_upload_id`
- Esto permite identificar qué aplicaciones vinieron del mismo archivo

## 💾 ¿Dónde se Guardan los Datos?

### ✅ Se Guarda:
- **Datos extraídos** en la tabla `applications` de Supabase
- **Metadatos**: fecha de carga, usuario que cargó, ID de agrupación

### ❌ NO Se Guarda:
- El archivo CSV original
- El contenido completo del CSV
- Otras columnas que no se usan (Status, Source Account, etc.)

## 🔄 Flujo Completo

```
1. Usuario selecciona CSV
   ↓
2. Se lee el contenido del archivo (en memoria)
   ↓
3. Se parsean las líneas y se extraen datos relevantes
   ↓
4. Se validan los datos (fechas, precios, etc.)
   ↓
5. Se insertan en la tabla `applications`
   ↓
6. El archivo CSV se descarta (no se guarda)
   ↓
7. Se muestra confirmación: "Se cargaron X aplicaciones"
```

## 📋 Ejemplo Práctico

**CSV Original:**
```csv
Date (UTC),Description,Amount,Status,Source Account,...
11-30-2025,Supabase,-25.00,Sent,Mercury Credit,...
11-29-2025,Vercel,-261.22,Sent,Mercury Credit,...
```

**Datos Guardados en Base de Datos:**
```sql
-- Aplicación 1
name: "Supabase"
responsable: "Emilia Aceldo"
price: 25.00
date: "2025-11-30"
csv_upload_id: "abc-123-def"

-- Aplicación 2
name: "Vercel"
responsable: "Emilia Aceldo"
price: 261.22
date: "2025-11-29"
csv_upload_id: "abc-123-def"  -- Mismo ID porque vienen del mismo CSV
```

## ⚠️ Importante

- **Si necesitas el CSV original**, debes guardarlo en tu computadora
- **Si cargas el mismo CSV dos veces**, se crearán registros duplicados (con diferentes `csv_upload_id`)
- **No hay forma de recuperar el CSV original** desde la aplicación
- **Solo se guardan los datos relevantes** para la gestión de costos

## 🔧 Si Quieres Guardar el CSV Original

Si necesitas guardar el archivo CSV original, necesitarías:
1. Crear una tabla adicional para almacenar archivos
2. Usar Supabase Storage para guardar el archivo
3. Modificar el código para subir el archivo a Storage

¿Necesitas que implemente el guardado del archivo CSV original?

