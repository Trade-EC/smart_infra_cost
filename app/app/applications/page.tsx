'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  ApplicationsRepository,
  ClientsRepository,
} from '@/lib/repositories'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Application, Client } from '@/types'
import {
  PageHeader,
  Card,
  Input,
  Button,
  ErrorMessage,
  Table,
} from '@/components/ui'
import DateRangePicker from '@/components/ui/DateRangePicker'

export default function ApplicationsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const applicationsRepo = useMemo(
    () => new ApplicationsRepository(supabase),
    [supabase]
  )
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const [applications, setApplications] = useState<Application[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [clientFilter, setClientFilter] = useState('')
  const [applicationFilter, setApplicationFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editingApp, setEditingApp] = useState<string | null>(null)
  const [clientSelectors, setClientSelectors] = useState<
    Record<string, string[]>
  >({})

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    // Solo cargar aplicaciones si hay un rango de fechas seleccionado
    if (dateRange?.start && dateRange?.end) {
      loadApplications()
    } else {
      // Si no hay rango de fechas, limpiar los datos
      setApplications([])
      setLoading(false)
    }
  }, [dateRange, clientFilter, applicationFilter])

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const loadApplications = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await applicationsRepo.getAll({
        dateFrom: dateRange?.start || undefined,
        dateTo: dateRange?.end || undefined,
        clientFilter,
        applicationFilter,
      })
      setApplications(data)
    } catch (err: any) {
      setError(err.message || t('applications.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveClients = async (appId: string) => {
    try {
      const clientIds = (clientSelectors[appId] || [])
        .filter((id) => id !== '')
        .filter((id, index, self) => self.indexOf(id) === index)

      if (clientIds.length === 0) {
        setError(t('applications.selectClient'))
        return
      }

      // Eliminar todas las asignaciones actuales
      const currentApp = applications.find((a) => a.id === appId)
      if (currentApp?.clients) {
        for (const client of currentApp.clients) {
          try {
            await applicationsRepo.removeClient(appId, client.id)
          } catch (err) {
            // Ignore errors if relationship doesn't exist
          }
        }
      }

      // Crear nuevas asignaciones
      for (const clientId of clientIds) {
        await applicationsRepo.assignClient(appId, clientId)
      }

      setEditingApp(null)
      setClientSelectors({ ...clientSelectors, [appId]: [''] })
      await loadApplications()
    } catch (err: any) {
      setError(err.message || t('applications.assignError'))
    }
  }

  const startEditing = (appId: string) => {
    const app = applications.find((a) => a.id === appId)
    const currentClientIds = app?.clients?.map((c) => c.id) || []

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

  const updateClientSelector = (
    appId: string,
    index: number,
    clientId: string
  ) => {
    const current = clientSelectors[appId] || ['']
    const updated = [...current]
    updated[index] = clientId

    if (
      clientId !== '' &&
      index === current.length - 1 &&
      current[current.length - 1] === ''
    ) {
      updated.push('')
    }

    setClientSelectors({
      ...clientSelectors,
      [appId]: updated,
    })
  }

  const removeClientSelector = (appId: string, index: number) => {
    const current = clientSelectors[appId] || ['']
    const updated = current.filter((_, i) => i !== index)

    setClientSelectors({
      ...clientSelectors,
      [appId]: updated.length > 0 ? updated : [''],
    })
  }

  const convertDate = (dateStr: string): string => {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const [month, day, year] = parts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    return dateStr
  }

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
      const lines = text.split('\n').filter((line) => line.trim())

      if (lines.length < 2) {
        throw new Error(
          'El CSV debe tener al menos una fila de encabezados y una fila de datos'
        )
      }

      const headers = parseCSVLine(lines[0]).map((h) => h.trim())

      const dateIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes('date (utc)') || h.toLowerCase() === 'date (utc)'
      )
      const descriptionIndex = headers.findIndex(
        (h) => h.toLowerCase() === 'description'
      )
      const amountIndex = headers.findIndex((h) => h.toLowerCase() === 'amount')
      const nameOnCardIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes('name on card') ||
          h.toLowerCase() === 'name on card'
      )
      const statusIndex = headers.findIndex((h) => h.toLowerCase() === 'status')

      if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
        throw new Error(
          'El CSV debe tener las columnas: Date (UTC), Description, Amount'
        )
      }

      const applicationsToInsert = lines
        .slice(1)
        .map((line) => {
          const values = parseCSVLine(line)

          const dateStr = values[dateIndex] || ''
          const description = values[descriptionIndex] || ''
          const amountStr = values[amountIndex] || '0'
          const nameOnCard =
            nameOnCardIndex !== -1 ? values[nameOnCardIndex] : 'Sin asignar'
          const status = statusIndex !== -1 ? values[statusIndex]?.trim() : ''

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
          }
        })
        .filter((app): app is NonNullable<typeof app> => app !== null)

      if (applicationsToInsert.length === 0) {
        throw new Error('No se encontraron aplicaciones válidas en el CSV')
      }

      // Verificar duplicados
      const newApplications: typeof applicationsToInsert = []
      for (const app of applicationsToInsert) {
        const isDuplicate = await applicationsRepo.checkDuplicate(
          app.name,
          app.date,
          app.price,
          app.responsable
        )
        if (!isDuplicate) {
          newApplications.push(app)
        }
      }

      const duplicatesCount = applicationsToInsert.length - newApplications.length

      if (newApplications.length === 0) {
        throw new Error(
          `Todas las aplicaciones del CSV ya existen en la base de datos. ${duplicatesCount} duplicados encontrados.`
        )
      }

      await applicationsRepo.createMany(newApplications)
      await loadApplications()

      let message = `Se cargaron ${newApplications.length} aplicaciones exitosamente`
      if (duplicatesCount > 0) {
        message += `. ${duplicatesCount} aplicaciones duplicadas fueron omitidas.`
      }
      toast.success(message)

      e.target.value = ''
    } catch (err: any) {
      setError(err.message || t('applications.uploadError'))
      console.error('Error al procesar CSV:', err)
    } finally {
      setUploading(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: t('applications.applicationName'),
      className: 'font-medium text-gray-900',
    },
    {
      key: 'responsable',
      header: t('applications.responsable'),
    },
    {
      key: 'clients',
      header: t('applications.assignedClients'),
      render: (app: Application) => {
        const isEditing = editingApp === app.id

        if (isEditing) {
          return (
            <div className="space-y-2 min-w-[300px]">
              {(clientSelectors[app.id] || ['']).map(
                (selectedClientId, index) => {
                  const selectors = clientSelectors[app.id] || ['']
                  const isLastEmpty =
                    index === selectors.length - 1 && selectedClientId === ''

                  return (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={selectedClientId}
                        onChange={(e) =>
                          updateClientSelector(app.id, index, e.target.value)
                        }
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      >
                        <option value="">Seleccione un Cliente</option>
                        {clients
                          .filter((client) => {
                            const otherSelections = selectors.filter(
                              (id, i) => i !== index && id !== ''
                            )
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
                          title={t('common.remove')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                }
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addClientSelector(app.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600"
                  title={t('applications.addClient')}
                >
                  +
                </button>
                <div className="flex-1"></div>
                <Button
                  size="sm"
                  onClick={() => handleSaveClients(app.id)}
                  variant="primary"
                >
                  {t('common.save')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingApp(null)
                    setClientSelectors({
                      ...clientSelectors,
                      [app.id]: [''],
                    })
                  }}
                  variant="secondary"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )
        }

        return (
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
                <span className="text-gray-400">
                  {t('applications.noClientsAssigned')}
                </span>
              )}
            </div>
            <Button
            variant="ghost"
              size="sm"
              onClick={() => startEditing(app.id)}
              className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
            >
              {app.clients && app.clients.length > 0
                ? t('common.edit')
                : t('applications.addClient')}
            </Button>
          </div>
        )
      },
    },
    {
      key: 'price',
      header: t('common.price'),
      render: (app: Application) => `$${app.price.toFixed(2)}`,
    },
    {
      key: 'date',
      header: t('common.date'),
      render: (app: Application) => {
        const [year, month, day] = app.date.split('T')[0].split('-')
        return `${day}/${month}/${year}`
      },
    },
  ]

  return (
    <div>
      <PageHeader title={t('applications.title')} />

      <Card title={t('common.filter')} className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Fechas
            </label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Input
              label={t('applications.filters.application')}
              type="text"
              value={applicationFilter}
              onChange={(e) => setApplicationFilter(e.target.value)}
              placeholder={t('common.search')}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Input
              label={t('applications.filters.client')}
              type="text"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              placeholder={t('common.search')}
            />
          </div>
        </div>
      </Card>

      <Card title={t('applications.uploadCSVTitle')} className="mb-6">
        <p className="mb-3 text-sm text-gray-600">
          El CSV debe tener las columnas: <strong>Date (UTC)</strong>,{' '}
          <strong>Description</strong>, <strong>Amount</strong>
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100"
        />
        {uploading && (
          <p className="mt-2 text-sm text-gray-600">
            {t('applications.uploading')}
          </p>
        )}
      </Card>

      <ErrorMessage message={error || ''} className="mb-4" />

      {!dateRange ? (
        <Card className="mb-6">
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-2">
              Selecciona un rango de fechas para ver las aplicaciones
            </p>
            <p className="text-gray-500 text-sm">
              Usa el selector de fechas arriba para filtrar los resultados
            </p>
          </div>
        </Card>
      ) : (
        <Table
          columns={columns}
          data={applications}
          loading={loading}
          emptyMessage={t('applications.noApplications')}
          keyExtractor={(app) => app.id}
        />
      )}
    </div>
  )
}
