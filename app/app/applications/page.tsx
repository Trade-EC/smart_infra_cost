'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  ApplicationsRepository,
  ClientsRepository,
  ApplicationCostDistributionsRepository,
} from '@/lib/repositories'
import type { ApplicationCostDistribution } from '@/lib/repositories/applicationCostDistributionsRepository'
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
import Select from '@/components/ui/Select'

export default function ApplicationsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const applicationsRepo = useMemo(
    () => new ApplicationsRepository(supabase),
    [supabase]
  )
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const distributionsRepo = useMemo(() => new ApplicationCostDistributionsRepository(supabase), [supabase])
  const [applications, setApplications] = useState<Application[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [clientFilter, setClientFilter] = useState('')
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('')
  const [applicationFilter, setApplicationFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [editingApp, setEditingApp] = useState<string | null>(null)
  const [clientSelectors, setClientSelectors] = useState<
    Record<string, string[]>
  >({})
  const [distributingApp, setDistributingApp] = useState<Application | null>(null)
  const [distributionRows, setDistributionRows] = useState<Array<{ clientId: string; percentage: number | '' | string }>>([])
  const [savingDistribution, setSavingDistribution] = useState(false)

  const TODOS_CLIENT_ID = 'abe57007-076c-492a-84da-0e5d075af2f9'

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
  }, [dateRange, clientFilter, selectedClientFilter, applicationFilter])

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
      
      // Filtrar por cliente seleccionado si hay uno
      let filteredData = data
      if (selectedClientFilter) {
        filteredData = data.filter((app) =>
          app.clients?.some((c) => c.id === selectedClientFilter)
        )
      }
      
      setApplications(filteredData)
      setPage(1)
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

      // Eliminar todas las asignaciones actuales en una sola query
      await applicationsRepo.removeAllClients(appId)

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

  const handleOpenDistributionModal = async (app: Application) => {
    try {
      setDistributingApp(app)
      setError(null)
      
      // Cargar distribuciones existentes
      const existingDistributions = await distributionsRepo.getByApplication(app.id)
      
      if (existingDistributions.length > 0) {
        setDistributionRows(
          existingDistributions.map((dist) => ({
            clientId: dist.client_id,
            percentage: dist.allocation_percentage,
          }))
        )
      } else {
        // Inicializar con una fila vacía
        setDistributionRows([{ clientId: '', percentage: '' }])
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar las distribuciones')
    }
  }

  const handleAddDistributionRow = () => {
    setDistributionRows([...distributionRows, { clientId: '', percentage: '' }])
  }

  const handleRemoveDistributionRow = (index: number) => {
    setDistributionRows(distributionRows.filter((_, i) => i !== index))
  }

  const handleUpdateDistributionRow = (index: number, field: 'clientId' | 'percentage', value: string | number | '') => {
    const updated = [...distributionRows]
    updated[index] = { ...updated[index], [field]: value }
    setDistributionRows(updated)
  }

  const handleSaveDistribution = async () => {
    if (!distributingApp) return

    // Validar que todos los campos estén completos
    const incompleteRows = distributionRows.some(
      (row) => !row.clientId || row.percentage === '' || typeof row.percentage !== 'number' || row.percentage <= 0 || row.percentage > 100
    )
    
    if (incompleteRows) {
      setError('Todos los clientes deben estar seleccionados y los porcentajes deben ser mayores a 0 y menores o iguales a 100')
      return
    }

    // Validar que la suma de porcentajes sea 100
    const totalPercentage = distributionRows.reduce((sum, row) => sum + (typeof row.percentage === 'number' ? row.percentage : 0), 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      setError(`La suma de los porcentajes debe ser 100%. Actual: ${totalPercentage.toFixed(2)}%`)
      return
    }

    // Validar que no haya clientes duplicados
    const clientIds = distributionRows.map((row) => row.clientId)
    const uniqueClientIds = new Set(clientIds)
    if (clientIds.length !== uniqueClientIds.size) {
      setError('No puedes asignar el mismo cliente más de una vez')
      return
    }

    setSavingDistribution(true)
    setError(null)

    try {
      // Eliminar distribuciones existentes
      await distributionsRepo.deleteByApplication(distributingApp.id)

      // Crear nuevas distribuciones
      const distributions = distributionRows.map((row) => {
        const percentage = typeof row.percentage === 'number' ? row.percentage : 0
        return {
          applicationId: distributingApp.id,
          clientId: row.clientId,
          percentage: percentage,
          allocatedAmount: (distributingApp.price * percentage) / 100,
        }
      })

      await distributionsRepo.createOrUpdateMany(distributions)
      
      toast.success('Distribución de costos guardada exitosamente')
      setDistributingApp(null)
      setDistributionRows([])
      await loadApplications()
    } catch (err: any) {
      setError(err.message || 'Error al guardar la distribución')
    } finally {
      setSavingDistribution(false)
    }
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

      // Verificar duplicados en 1 sola query batch
      const existingKeys = await applicationsRepo.batchCheckDuplicates(applicationsToInsert)
      const newApplications = applicationsToInsert.filter(
        (app) =>
          !existingKeys.has(
            `${app.name.trim()}|${app.date}|${Math.abs(app.price)}|${app.responsable.trim()}`
          )
      )

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
                      <div className="flex-1">
                        <Select
                          value={selectedClientId}
                          onChange={(val) => updateClientSelector(app.id, index, val)}
                          options={clients
                            .filter((client) => {
                              const otherSelections = selectors.filter(
                                (id, i) => i !== index && id !== ''
                              )
                              return !otherSelections.includes(client.id)
                            })
                            .map((client) => ({ value: client.id, label: client.name }))}
                          placeholder="Seleccione un Cliente"
                          searchable
                          clearLabel="Sin cliente"
                        />
                      </div>
                      {!isLastEmpty && (
                        <button
                          onClick={() => removeClientSelector(app.id, index)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 shrink-0"
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
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSaveClients(app.id)}
                  className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300"
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
                  variant="ghost"
                  className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )
        }

        const hasTodosClient = app.clients?.some(c => c.id === TODOS_CLIENT_ID)

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
            {hasTodosClient && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenDistributionModal(app)}
                className="rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-orange-700 hover:bg-orange-100 hover:border-orange-300 mr-2"
              >
                Distribuir Costo
              </Button>
            )}
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
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Cliente
            </label>
            <Select
              value={selectedClientFilter}
              onChange={setSelectedClientFilter}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Todos los clientes"
              searchable
            />
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

      {/* Modal de distribución de costos */}
      {distributingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden mx-4">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Distribuir Costo de Aplicación
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Aplicación: {distributingApp.name}
                </p>
                <p className="text-sm text-gray-500">
                  Monto Total: ${distributingApp.price.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => {
                  setDistributingApp(null)
                  setDistributionRows([])
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <ErrorMessage message={error || ''} className="mb-4" />

              <div className="space-y-3">
                {distributionRows.map((row, index) => {
                  let percentageValue = 0
                  if (typeof row.percentage === 'number') {
                    percentageValue = row.percentage
                  } else if (typeof row.percentage === 'string' && row.percentage !== '') {
                    const parsed = parseFloat(row.percentage)
                    percentageValue = isNaN(parsed) ? 0 : parsed
                  }
                  const allocatedAmount = (distributingApp.price * percentageValue) / 100
                  const availableClients = clients.filter(
                    (c) => c.id !== TODOS_CLIENT_ID && !distributionRows.some((r, i) => i !== index && r.clientId === c.id)
                  )

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cliente
                        </label>
                        <Select
                          value={row.clientId}
                          onChange={(val) => handleUpdateDistributionRow(index, 'clientId', val)}
                          options={availableClients.map((client) => ({
                            value: client.id,
                            label: client.name,
                          }))}
                          placeholder="Seleccionar cliente"
                          searchable
                          clearLabel="Sin cliente"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Porcentaje (%)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.percentage === '' ? '' : String(row.percentage)}
                          onChange={(e) => {
                            const value = e.target.value.trim()
                            
                            // Permitir string vacío
                            if (value === '') {
                              handleUpdateDistributionRow(index, 'percentage', '')
                              return
                            }
                            
                            // Validar que sea un número válido (permite "0", "0.", "0.5", etc.)
                            const numberRegex = /^(\d+\.?\d*|\.\d+)$/
                            if (numberRegex.test(value)) {
                              const numValue = parseFloat(value)
                              // Solo guardar si es un número válido y está en el rango
                              if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                                handleUpdateDistributionRow(index, 'percentage', numValue)
                              } else if (value === '0' || value.startsWith('0.') || value === '.') {
                                // Permitir escribir "0", "0.", ".5" mientras se escribe
                                handleUpdateDistributionRow(index, 'percentage', value as any)
                              }
                            }
                          }}
                          onBlur={(e) => {
                            // Al perder el foco, convertir a número si es válido
                            const value = e.target.value.trim()
                            if (value === '') {
                              handleUpdateDistributionRow(index, 'percentage', '')
                            } else {
                              const numValue = parseFloat(value)
                              if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                                handleUpdateDistributionRow(index, 'percentage', numValue)
                              } else {
                                handleUpdateDistributionRow(index, 'percentage', '')
                              }
                            }
                          }}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                          placeholder=""
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Monto
                        </label>
                        <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          ${allocatedAmount.toFixed(2)}
                        </div>
                      </div>
                      {distributionRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDistributionRow(index)}
                          className="mt-6 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleAddDistributionRow}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                >
                  <span>+</span>
                  Agregar Cliente
                </button>
                <div className="text-sm text-gray-600">
                  Total: <span className={`font-semibold ${Math.abs(distributionRows.reduce((sum, r) => sum + (typeof r.percentage === 'number' ? r.percentage : 0), 0) - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    {distributionRows.reduce((sum, r) => sum + (typeof r.percentage === 'number' ? r.percentage : 0), 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDistributingApp(null)
                  setDistributionRows([])
                  setError(null)
                }}
                disabled={savingDistribution}
                className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-100 hover:border-gray-300 disabled:opacity-50"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveDistribution}
                disabled={savingDistribution}
                className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300 disabled:opacity-50"
              >
                {savingDistribution ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

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
        <>
          <Table
            columns={columns}
            data={applications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
            loading={loading}
            emptyMessage={t('applications.noApplications')}
            keyExtractor={(app) => app.id}
          />
          {Math.ceil(applications.length / PAGE_SIZE) > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, applications.length)} de{' '}
                {applications.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('common.previous')}
                </Button>
                {Array.from({ length: Math.ceil(applications.length / PAGE_SIZE) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 rounded-full text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(Math.ceil(applications.length / PAGE_SIZE), p + 1))}
                  disabled={page === Math.ceil(applications.length / PAGE_SIZE)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
