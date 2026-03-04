'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { ClientsRepository, AWSReportsRepository } from '@/lib/repositories'
import type { Client } from '@/types'
import type { AWSReport } from '@/lib/repositories/awsReportsRepository'
import {
  PageHeader,
  Card,
  ErrorMessage,
  DateRangePicker,
  Input,
  Select,
} from '@/components/ui'

interface AWSReportRow {
  customerName: string
  cloudAccountNumber: string
  sellerCost: number
  clientId: string
  date: string
}

export default function AWSPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const awsReportsRepo = useMemo(() => new AWSReportsRepository(supabase), [supabase])
  
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<AWSReportRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [reportDateRange, setReportDateRange] = useState<{ start: string; end: string } | null>(null)
  const [clientAssignments, setClientAssignments] = useState<Record<string, string>>({})
  const [clientNameFilter, setClientNameFilter] = useState<string>('')

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (reportDateRange && reportDateRange.start && reportDateRange.end) {
      loadAWSReports()
    } else {
      setReportData([])
    }
  }, [reportDateRange])

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const loadAWSReports = async () => {
    if (!reportDateRange || !reportDateRange.start || !reportDateRange.end) return

    setLoading(true)
    setError(null)

    try {
      const reports = await awsReportsRepo.getByDateRange(
        reportDateRange.start,
        reportDateRange.end
      )

      const mappedData: AWSReportRow[] = reports.map((report) => ({
        customerName: report.customer_name,
        cloudAccountNumber: report.cloud_account_number,
        sellerCost: report.seller_cost,
        clientId: report.client_id || '',
        date: report.date,
      }))

      setReportData(mappedData)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los reportes AWS')
      console.error('Error loading AWS reports:', err)
    } finally {
      setLoading(false)
    }
  }

  // Función para parsear líneas CSV que maneja comillas
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

    if (!reportDateRange || !reportDateRange.start) {
      setError('Por favor selecciona una fecha para el reporte')
      return
    }

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

      const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''))

      // Buscar índices de las columnas requeridas
      const customerNameIndex = headers.findIndex(
        (h) => h.toLowerCase() === 'customer name'
      )
      const cloudAccountNumberIndex = headers.findIndex(
        (h) => h.toLowerCase() === 'cloud account number'
      )
      const sellerCostIndex = headers.findIndex(
        (h) => h.toLowerCase() === 'seller cost (usd)'
      )

      if (
        customerNameIndex === -1 ||
        cloudAccountNumberIndex === -1 ||
        sellerCostIndex === -1
      ) {
        throw new Error(t('aws.csvFormat'))
      }

      // Procesar datos y agrupar por Cloud Account Number
      const groupedData = new Map<string, { customerName: string; totalCost: number }>()

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = parseCSVLine(line).map((v) => v.replace(/^"|"$/g, ''))

        const customerName = values[customerNameIndex]?.trim() || ''
        const cloudAccountNumber = values[cloudAccountNumberIndex]?.trim() || ''
        const sellerCostStr = values[sellerCostIndex]?.trim() || '0'

        if (!cloudAccountNumber) continue

        const sellerCost = parseFloat(sellerCostStr) || 0

        if (groupedData.has(cloudAccountNumber)) {
          // Si ya existe, sumar el costo
          const existing = groupedData.get(cloudAccountNumber)!
          existing.totalCost += sellerCost
          // Conservar el primer Customer Name encontrado
        } else {
          // Crear nueva entrada
          groupedData.set(cloudAccountNumber, {
            customerName: customerName || 'Sin nombre',
            totalCost: sellerCost,
          })
        }
      }

      // Convertir a array y ordenar por Cloud Account Number
      const processedData: AWSReportRow[] = Array.from(groupedData.entries())
        .map(([cloudAccountNumber, data]) => ({
          customerName: data.customerName,
          cloudAccountNumber,
          sellerCost: data.totalCost,
          clientId: '',
          date: reportDateRange.start,
        }))
        .sort((a, b) => a.cloudAccountNumber.localeCompare(b.cloudAccountNumber))

      if (processedData.length === 0) {
        throw new Error('No se encontraron datos válidos en el CSV')
      }

      // Guardar en la base de datos
      await awsReportsRepo.createMany(
        processedData.map((row) => ({
          customerName: row.customerName,
          cloudAccountNumber: row.cloudAccountNumber,
          sellerCost: row.sellerCost,
          clientId: row.clientId || null,
          date: row.date,
        }))
      )

      // Recargar los datos desde la base de datos
      await loadAWSReports()
      setClientAssignments({})
      e.target.value = ''
    } catch (err: any) {
      setError(err.message || t('aws.uploadError'))
      console.error('Error al procesar CSV:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleClientChange = async (cloudAccountNumber: string, clientId: string) => {
    if (!reportDateRange || !reportDateRange.start) {
      // Si no hay fecha, solo actualizar el estado local (para cuando se carga desde CSV antes de guardar)
      setClientAssignments((prev) => ({
        ...prev,
        [cloudAccountNumber]: clientId,
      }))
      setReportData((prev) =>
        prev.map((row) =>
          row.cloudAccountNumber === cloudAccountNumber
            ? { ...row, clientId }
            : row
        )
      )
      return
    }

    try {
      // Actualizar en la base de datos
      const updated = await awsReportsRepo.updateClient(
        cloudAccountNumber,
        reportDateRange.start,
        clientId || null
      )

      // Si el registro no existe en la BD, solo actualizar el estado local
      if (!updated) {
        console.warn(`Reporte AWS no encontrado para actualizar: ${cloudAccountNumber} - ${reportDateRange.start}`)
      }

      // Actualizar el estado local
      setClientAssignments((prev) => ({
        ...prev,
        [cloudAccountNumber]: clientId,
      }))
      setReportData((prev) =>
        prev.map((row) =>
          row.cloudAccountNumber === cloudAccountNumber
            ? { ...row, clientId }
            : row
        )
      )
    } catch (err: any) {
      // Si hay un error, aún actualizar el estado local para que la UI responda
      setClientAssignments((prev) => ({
        ...prev,
        [cloudAccountNumber]: clientId,
      }))
      setReportData((prev) =>
        prev.map((row) =>
          row.cloudAccountNumber === cloudAccountNumber
            ? { ...row, clientId }
            : row
        )
      )
      setError(err.message || 'Error al actualizar el cliente asignado en la base de datos')
      console.error('Error updating client assignment:', err)
    }
  }

  // Filtrar datos por nombre del cliente
  const filteredReportData = reportData.filter((row) => {
    if (!clientNameFilter) return true
    const searchTerm = clientNameFilter.toLowerCase()
    return (
      row.customerName.toLowerCase().includes(searchTerm) ||
      row.cloudAccountNumber.toLowerCase().includes(searchTerm) ||
      (row.clientId && clients.find(c => c.id === row.clientId)?.name.toLowerCase().includes(searchTerm))
    )
  })

  const totalCost = filteredReportData.reduce((sum, row) => sum + row.sellerCost, 0)

  return (
    <div>
      <PageHeader title={t('aws.title')} />

      <ErrorMessage message={error || ''} className="mb-4" />

      {/* Sección de carga de CSV */}
      <Card title={t('aws.uploadCSVTitle')} className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Fechas
            </label>
            <DateRangePicker value={reportDateRange} onChange={setReportDateRange} />
            <p className="mt-1 text-xs text-gray-500">
              Esta fecha se asignará a todos los registros del CSV
            </p>
          </div>
          <div className="flex-1 min-w-[300px]">
            <p className="mb-2 text-sm font-medium text-gray-700">Archivo CSV</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading || !reportDateRange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {uploading && (
              <p className="mt-2 text-sm text-gray-600">{t('aws.uploading')}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Filtro de búsqueda unificado */}
      {reportData.length > 0 && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <Input
                label="Filtrar por nombre del cliente"
                type="text"
                value={clientNameFilter}
                onChange={(e) => setClientNameFilter(e.target.value)}
                placeholder="Buscar por nombre del cliente, cuenta cloud o cliente asignado..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabla de resultados */}
      {loading ? (
        <Card title="Cargando..." className="mb-6 text-center">
          <p className="text-gray-600">Cargando reportes AWS...</p>
        </Card>
      ) : reportData.length > 0 ? (
        <Card title="Resultados del Reporte AWS" className="mb-6">
          {clientNameFilter && (
            <p className="mb-4 text-sm text-gray-600">
              Mostrando {filteredReportData.length} de {reportData.length} registros
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-blue-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('aws.customerName')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('aws.cloudAccountNumber')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('aws.sellerCost')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Cliente Asignado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReportData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      No se encontraron registros que coincidan con el filtro
                    </td>
                  </tr>
                ) : (
                  filteredReportData.map((row, index) => (
                  <tr
                    key={`${row.cloudAccountNumber}-${index}`}
                    className="border-b border-gray-100"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.customerName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.cloudAccountNumber}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${row.sellerCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm min-w-[220px]">
                      <Select
                        value={row.clientId || ''}
                        onChange={(val) => handleClientChange(row.cloudAccountNumber, val)}
                        options={clients.map((client) => ({
                          value: client.id,
                          label: client.name,
                        }))}
                        placeholder="Seleccionar cliente"
                      />
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
                  >
                    {t('aws.totalCost')}:
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">
                    ${totalCost.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        <Card title={t('aws.noData')} className="text-center">
          <p className="text-gray-500">
            {reportDateRange
              ? 'No hay reportes AWS para el rango de fechas seleccionado. Puedes subir un CSV para crear uno nuevo.'
              : 'Selecciona un rango de fechas para ver o cargar reportes AWS.'}
          </p>
        </Card>
      )}
    </div>
  )
}
