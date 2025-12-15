'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Application {
  id: string
  name: string
  responsable: string
  price: number
  date: string
  clients?: { id: string; name: string }[]
}

interface Client {
  id: string
  name: string
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [applicationFilter, setApplicationFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('') // YYYY-MM
  const [uploading, setUploading] = useState(false)
  const [editingApp, setEditingApp] = useState<string | null>(null)
  const [selectedClients, setSelectedClients] = useState<Record<string, string[]>>({})
  const [clientSelectors, setClientSelectors] = useState<Record<string, string[]>>({}) // Para los dropdowns
  const supabase = createClient()

  useEffect(() => {
    loadApplications()
    loadClients()
  }, [dateFrom, dateTo, clientFilter, applicationFilter])

  // Inicializar mes actual y ajustar rango al cambiar monthFilter
  useEffect(() => {
    if (!monthFilter) {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      setMonthFilter(`${yyyy}-${mm}`)
      return
    }
    const [year, month] = monthFilter.split('-').map(Number)
    if (year && month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0) // último día del mes
      const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      setDateFrom(start)
      setDateTo(end)
    }
  }, [monthFilter])

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })
    setClients(data || [])
  }

  const loadApplications = async () => {
    try {
      setLoading(true)
      // Intentar cargar con 'responsable', si falla usar 'client_name'
      // Cargar aplicaciones con relaciones (si la tabla application_clients existe)
      let query = supabase
        .from('applications')
        .select(`
          *,
          application_clients (
            clients (
              id,
              name
            )
          )
        `)
        .order('date', { ascending: false })

      if (dateFrom) {
        // Normalizar fecha: extraer solo YYYY-MM-DD sin hora
        const dateFromFormatted = dateFrom.split('T')[0]
        // Usar >= para incluir desde el día especificado (inclusive)
        query = query.gte('date', dateFromFormatted)
      }
      if (dateTo) {
        // Normalizar fecha: extraer solo YYYY-MM-DD sin hora
        const dateToFormatted = dateTo.split('T')[0]
        // Calcular el día siguiente para usar < (menor que, exclusivo)
        // Esto asegura que se incluya todo el día "hasta"
        const [year, month, day] = dateToFormatted.split('-').map(Number)
        const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
        const dateToNextDay = nextDay.toISOString().split('T')[0]
        query = query.lt('date', dateToNextDay)
      }
      if (clientFilter) {
        query = query.ilike('responsable', `%${clientFilter}%`)
      }
      if (applicationFilter) {
        query = query.ilike('name', `%${applicationFilter}%`)
      }

      const { data, error } = await query

      if (error) {
        // Si falla porque application_clients no existe, cargar solo applications
        if (error.message?.includes('application_clients')) {
          const simpleQuery = supabase
            .from('applications')
            .select('*')
            .order('date', { ascending: false })
          
          if (dateFrom) {
            // Normalizar fecha: extraer solo YYYY-MM-DD sin hora
            const dateFromFormatted = dateFrom.split('T')[0]
            simpleQuery.gte('date', dateFromFormatted)
          }
          if (dateTo) {
            // Normalizar fecha: extraer solo YYYY-MM-DD sin hora
            const dateToFormatted = dateTo.split('T')[0]
            // Calcular el día siguiente usando UTC para evitar problemas de zona horaria
            const [year, month, day] = dateToFormatted.split('-').map(Number)
            const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
            const dateToNextDay = nextDay.toISOString().split('T')[0]
            simpleQuery.lt('date', dateToNextDay)
          }
          if (clientFilter) {
            simpleQuery.ilike('responsable', `%${clientFilter}%`)
          }
          if (applicationFilter) {
            simpleQuery.ilike('name', `%${applicationFilter}%`)
          }
          
          const { data: simpleData, error: simpleError } = await simpleQuery
          if (simpleError) throw simpleError
          
          const transformed = (simpleData || []).map((app: any) => ({
            ...app,
            responsable: app.responsable || app.client_name || 'Sin asignar',
            clients: [],
          }))
          setApplications(transformed)
          return
        }
        throw error
      }

      // Transformar los datos para facilitar el uso
      const transformed = (data || []).map((app: any) => ({
        ...app,
        responsable: app.responsable || app.client_name || 'Sin asignar', // Compatibilidad: usar responsable si existe, sino client_name
        clients: app.application_clients?.map((ac: any) => ac.clients) || [],
      }))

      setApplications(transformed)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveClients = async (appId: string) => {
    try {
      // Obtener los clientes seleccionados de los dropdowns (filtrar vacíos)
      const clientIds = (clientSelectors[appId] || [])
        .filter(id => id !== '')
        .filter((id, index, self) => self.indexOf(id) === index) // Eliminar duplicados

      if (clientIds.length === 0) {
        setError('Selecciona al menos un cliente')
        return
      }

      // Verificar si la tabla application_clients existe
      const { error: checkError } = await supabase
        .from('application_clients')
        .select('id')
        .limit(1)

      if (checkError) {
        if (checkError.message?.includes('does not exist') || checkError.message?.includes('relation')) {
          setError('Por favor ejecuta la migración SQL primero. La tabla application_clients no existe.')
          return
        }
        throw checkError
      }

      // Eliminar todas las asignaciones actuales
      await supabase
        .from('application_clients')
        .delete()
        .eq('application_id', appId)

      // Crear nuevas asignaciones
      const assignments = clientIds.map(clientId => ({
        application_id: appId,
        client_id: clientId,
      }))

      const { error } = await supabase
        .from('application_clients')
        .insert(assignments)

      if (error) throw error

      setEditingApp(null)
      setClientSelectors({ ...clientSelectors, [appId]: [''] })
      await loadApplications()
    } catch (err: any) {
      setError(err.message || 'Error al guardar los clientes. Asegúrate de haber ejecutado la migración SQL.')
    }
  }

  const startEditing = (appId: string) => {
    const app = applications.find(a => a.id === appId)
    const currentClientIds = app?.clients?.map(c => c.id) || []
    
    // Inicializar con los clientes actuales
    setSelectedClients({
      ...selectedClients,
      [appId]: currentClientIds,
    })
    
    // Inicializar los selectores: si hay clientes, mostrarlos, sino un dropdown vacío
    setClientSelectors({
      ...clientSelectors,
      [appId]: currentClientIds.length > 0 ? [...currentClientIds, ''] : [''],
    })
    
    setEditingApp(appId)
  }

  const addClientSelector = (appId: string) => {
    const current = clientSelectors[appId] || ['']
    setClientSelectors({
      ...clientSelectors,
      [appId]: [...current, ''],
    })
  }

  const updateClientSelector = (appId: string, index: number, clientId: string) => {
    const current = clientSelectors[appId] || ['']
    const updated = [...current]
    updated[index] = clientId
    
    // Si se seleccionó un cliente y es el último dropdown (vacío), agregar uno nuevo vacío
    if (clientId !== '' && index === current.length - 1 && current[current.length - 1] === '') {
      updated.push('')
    }
    
    setClientSelectors({
      ...clientSelectors,
      [appId]: updated,
    })
    
    // Actualizar selectedClients eliminando duplicados
    const uniqueClients = Array.from(new Set(updated.filter(id => id !== '')))
    setSelectedClients({
      ...selectedClients,
      [appId]: uniqueClients,
    })
  }

  const removeClientSelector = (appId: string, index: number) => {
    const current = clientSelectors[appId] || ['']
    const updated = current.filter((_, i) => i !== index)
    
    setClientSelectors({
      ...clientSelectors,
      [appId]: updated.length > 0 ? updated : [''],
    })
    
    // Actualizar selectedClients
    const uniqueClients = Array.from(new Set(updated.filter(id => id !== '')))
    setSelectedClients({
      ...selectedClients,
      [appId]: uniqueClients,
    })
  }

  // Función para convertir fecha de MM-DD-YYYY a YYYY-MM-DD
  const convertDate = (dateStr: string): string => {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const [month, day, year] = parts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    return dateStr
  }

  // Función para parsear CSV considerando comas dentro de campos entre comillas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('El CSV debe tener al menos una fila de encabezados y una fila de datos')
      }

      const headers = parseCSVLine(lines[0]).map(h => h.trim())
      
      const dateIndex = headers.findIndex(h => h.toLowerCase().includes('date (utc)') || h.toLowerCase() === 'date (utc)')
      const descriptionIndex = headers.findIndex(h => h.toLowerCase() === 'description')
      const amountIndex = headers.findIndex(h => h.toLowerCase() === 'amount')
      const nameOnCardIndex = headers.findIndex(h => h.toLowerCase().includes('name on card') || h.toLowerCase() === 'name on card')
      const statusIndex = headers.findIndex(h => h.toLowerCase() === 'status')

      if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
        throw new Error('El CSV debe tener las columnas: Date (UTC), Description, Amount')
      }

      const uploadId = crypto.randomUUID()
      const { data: user } = await supabase.auth.getUser()

      const applicationsToInsert = lines.slice(1)
        .map(line => {
          const values = parseCSVLine(line)
          
          const dateStr = values[dateIndex] || ''
          const description = values[descriptionIndex] || ''
          const amountStr = values[amountIndex] || '0'
          const nameOnCard = nameOnCardIndex !== -1 ? values[nameOnCardIndex] : 'Sin asignar'
          const status = statusIndex !== -1 ? values[statusIndex]?.trim() : ''

          // Solo procesar si el status es "Sent", ignorar "Failed" y otros
          if (statusIndex !== -1 && status.toLowerCase() !== 'sent') {
            return null
          }

          const date = convertDate(dateStr)
          const amount = Math.abs(parseFloat(amountStr) || 0)

          if (!description || !date || amount === 0) {
            return null
          }

          return {
            name: description,
            responsable: nameOnCard || 'Sin asignar',
            price: amount,
            date: date,
            csv_upload_id: uploadId,
            created_by: user?.user?.id,
          }
        })
        .filter((app): app is NonNullable<typeof app> => app !== null)

      if (applicationsToInsert.length === 0) {
        throw new Error('No se encontraron aplicaciones válidas en el CSV')
      }

      // Verificar duplicados: buscar aplicaciones existentes con mismo nombre, fecha, precio y responsable
      const { data: existingApps, error: checkError } = await supabase
        .from('applications')
        .select('name, date, price, responsable')

      if (checkError) throw checkError

      // Crear un Set de claves para verificar duplicados (nombre + fecha + precio + responsable)
      const existingKeys = new Set(
        (existingApps || []).map((app: any) => 
          `${app.name}|${app.date}|${app.price}|${app.responsable || ''}`
        )
      )

      // Filtrar duplicados
      const newApplications = applicationsToInsert.filter(app => {
        const key = `${app.name}|${app.date}|${app.price}|${app.responsable}`
        return !existingKeys.has(key)
      })

      const duplicatesCount = applicationsToInsert.length - newApplications.length

      if (newApplications.length === 0) {
        throw new Error(`Todas las aplicaciones del CSV ya existen en la base de datos. ${duplicatesCount} duplicados encontrados.`)
      }

      // Insertar solo las aplicaciones nuevas
      const { error } = await supabase
        .from('applications')
        .insert(newApplications)

      if (error) throw error

      await loadApplications()
      
      let message = `Se cargaron ${newApplications.length} aplicaciones exitosamente`
      if (duplicatesCount > 0) {
        message += `. ${duplicatesCount} aplicaciones duplicadas fueron omitidas.`
      }
      alert(message)
      
      e.target.value = ''
    } catch (err: any) {
      setError(err.message || 'Error al cargar el CSV')
      console.error('Error al procesar CSV:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Aplicaciones</h1>
      </div>

      {/* Filtros */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold">Filtros</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mes (YYYY-MM)
            </label>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fecha Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Aplicación
            </label>
            <input
              type="text"
              value={applicationFilter}
              onChange={(e) => setApplicationFilter(e.target.value)}
              placeholder="Buscar por aplicación..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Responsable
            </label>
            <input
              type="text"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              placeholder="Buscar por responsable..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Carga de CSV */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold">Cargar CSV</h2>
        <p className="mb-3 text-sm text-gray-600">
          El CSV debe tener las columnas: <strong>Date (UTC)</strong>, <strong>Description</strong>, <strong>Amount</strong>
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100"
        />
        {uploading && <p className="mt-2 text-sm text-gray-600">Cargando y procesando CSV...</p>}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tabla de aplicaciones */}
      <div className="rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Aplicación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Responsable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Clientes Asignados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : applications.length > 0 ? (
                applications.map((app) => {
                  const isEditing = editingApp === app.id
                  const currentSelection = selectedClients[app.id] || app.clients?.map(c => c.id) || []

                  return (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {app.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {app.responsable}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {isEditing ? (
                          <div className="space-y-2 min-w-[300px]">
                            {(clientSelectors[app.id] || ['']).map((selectedClientId, index) => {
                              const selectors = clientSelectors[app.id] || ['']
                              const isLastEmpty = index === selectors.length - 1 && selectedClientId === ''
                              
                              return (
                                <div key={index} className="flex items-center gap-2">
                                  <select
                                    value={selectedClientId}
                                    onChange={(e) => updateClientSelector(app.id, index, e.target.value)}
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                  >
                                    <option value="">Seleccione un Cliente</option>
                                    {clients
                                      .filter(client => {
                                        // No mostrar clientes ya seleccionados en otros dropdowns (excepto el actual)
                                        const otherSelections = selectors.filter((id, i) => i !== index && id !== '')
                                        return !otherSelections.includes(client.id)
                                      })
                                      .map((client) => (
                                        <option key={client.id} value={client.id}>
                                          {client.name}
                                        </option>
                                      ))}
                                  </select>
                                  {!isLastEmpty && (
                                    <button
                                      onClick={() => removeClientSelector(app.id, index)}
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                                      title="Eliminar"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => addClientSelector(app.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600"
                                title="Agregar otro cliente"
                              >
                                +
                              </button>
                              <div className="flex-1"></div>
                              <button
                                onClick={() => handleSaveClients(app.id)}
                                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => {
                                  setEditingApp(null)
                                  setSelectedClients({ ...selectedClients, [app.id]: [] })
                                  setClientSelectors({ ...clientSelectors, [app.id]: [''] })
                                }}
                                className="rounded bg-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-400"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              {app.clients && app.clients.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {app.clients.map((client) => (
                                    <span
                                      key={client.id}
                                      className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                                    >
                                      {client.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">Sin clientes asignados</span>
                              )}
                            </div>
                            <button
                              onClick={() => startEditing(app.id)}
                              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 whitespace-nowrap"
                            >
                              {app.clients && app.clients.length > 0 ? 'Editar' : 'Asignar'}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        ${app.price.toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {(() => {
                          // Formatear fecha sin conversión de zona horaria
                          const [year, month, day] = app.date.split('T')[0].split('-')
                          return `${day}/${month}/${year}`
                        })()}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay aplicaciones cargadas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
