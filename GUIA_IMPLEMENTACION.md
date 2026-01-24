# 🚀 Guía de Implementación - Smart Infra Cost

## 📋 Paso 1: Crear la Base de Datos

### 1.1 Ejecutar el Script SQL

1. Ve a tu proyecto en **Supabase Dashboard**
2. Ve a **SQL Editor** (en el menú lateral)
3. Abre el archivo `database/schema.sql` de este proyecto
4. Copia TODO el contenido del archivo
5. Pégalo en el SQL Editor de Supabase
6. Haz clic en **Run** o presiona `Ctrl/Cmd + Enter`
7. Verifica que todas las tablas se crearon correctamente

### 1.2 Verificar las Tablas

Ve a **Table Editor** en Supabase y verifica que existan estas tablas:
- ✅ `clients`
- ✅ `applications`
- ✅ `monthly_costs`
- ✅ `cost_allocations`
- ✅ `cost_distributions`
- ✅ `transactions`
- ✅ `transaction_assignments`

## 📊 Estructura de la Base de Datos

### Tablas Principales

1. **clients**: Almacena los clientes
2. **applications**: Aplicaciones cargadas desde CSV
3. **monthly_costs**: Costos mensuales creados
4. **cost_allocations**: Relaciona aplicaciones con costos mensuales
5. **cost_distributions**: Distribuye costos entre clientes
6. **transactions**: Transacciones por mes
7. **transaction_assignments**: Asigna transacciones a clientes

## 🎯 Funcionalidades Implementadas

### 1. Clientes (`/clients`)
- ✅ Listado de hasta 20 clientes
- ⚠️ **Pendiente**: Formulario para crear/editar clientes

### 2. Aplicaciones (`/applications`)
- ✅ Carga de CSV con aplicaciones
- ✅ Filtros por fecha (desde/hasta)
- ✅ Filtro por cliente
- ✅ Visualización en tabla

**Formato CSV esperado:**
```csv
nombre,aplicacion,cliente,precio,fecha
Github,github.com,Cliente1,20.00,2024-01-15
AWS,aws.amazon.com,Cliente2,50.00,2024-01-16
```

### 3. Costos (`/costs`)
- ✅ Crear mes de costos
- ✅ Seleccionar aplicaciones del CSV
- ✅ Distribuir costos entre múltiples clientes
- ✅ Cálculo automático de distribución equitativa

**Flujo:**
1. Seleccionar mes
2. Seleccionar aplicaciones (checkbox)
3. Para cada aplicación, agregar clientes
4. El sistema distribuye el costo equitativamente
5. Crear el mes

### 4. Transacciones (`/transactions`)
- ✅ Crear transacciones por mes
- ✅ Especificar cantidad y costo por transacción
- ✅ Asignar a múltiples clientes
- ✅ Cálculo automático del total

### 5. Reportes (`/reports`)
- ✅ Reporte de costos por aplicación (gráfico de barras)
- ✅ Reporte de costos por cliente (gráfico de barras)
- ✅ Tablas de datos

## 🔧 Próximos Pasos de Desarrollo

### Prioridad Alta

1. **Formulario de Clientes**
   - Agregar formulario para crear clientes
   - Agregar formulario para editar clientes
   - Agregar botón de eliminar

2. **Mejorar Carga de CSV**
   - Validación más robusta del formato
   - Preview antes de cargar
   - Manejo de errores mejorado

3. **Edición de Costos**
   - Permitir editar costos mensuales creados
   - Permitir eliminar costos

### Prioridad Media

4. **Mejoras en Reportes**
   - Filtros por fecha en reportes
   - Exportar reportes a PDF/Excel
   - Gráficos más avanzados (usar Chart.js o Recharts)

5. **Dashboard Mejorado**
   - Resumen de costos del mes actual
   - Gráficos de tendencias
   - Alertas de costos altos

6. **Validaciones**
   - Validar que no se dupliquen meses
   - Validar que los clientes existan antes de asignar

## 📝 Cómo Usar la Aplicación

### Flujo de Trabajo Recomendado

1. **Crear Clientes** (desde Supabase por ahora)
   - Ve a Supabase Dashboard > Table Editor > clients
   - Agrega los clientes manualmente

2. **Cargar Aplicaciones**
   - Ve a `/applications`
   - Sube el CSV del estado de cuenta
   - Verifica que se cargaron correctamente

3. **Crear Costos Mensuales**
   - Ve a `/costs`
   - Selecciona el mes
   - Selecciona las aplicaciones
   - Asigna clientes a cada aplicación
   - Crea el mes

4. **Registrar Transacciones**
   - Ve a `/transactions`
   - Completa el formulario
   - Selecciona los clientes
   - Crea la transacción

5. **Ver Reportes**
   - Ve a `/reports`
   - Cambia entre pestañas para ver diferentes reportes

## 🐛 Solución de Problemas

### Error: "relation does not exist"
- **Solución**: Ejecuta el script SQL en Supabase

### Error: "permission denied"
- **Solución**: Verifica que las políticas RLS estén creadas correctamente

### CSV no se carga
- **Solución**: Verifica el formato del CSV. Debe tener columnas: nombre, cliente, precio, fecha

### No aparecen datos en reportes
- **Solución**: Asegúrate de haber creado costos mensuales y transacciones primero

## 📚 Recursos Útiles

- [Documentación de Supabase](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🎨 Personalización

### Cambiar Colores
Edita las clases de Tailwind en los componentes:
- `bg-blue-600` → Cambia el color principal
- `text-blue-600` → Cambia el color del texto

### Agregar Más Campos
1. Modifica el schema SQL
2. Ejecuta las migraciones
3. Actualiza los componentes que usan esa tabla

---

**¿Necesitas ayuda?** Revisa los comentarios en el código o consulta la documentación de Supabase.


