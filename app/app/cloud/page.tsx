'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { createClient } from '@/lib/supabase/client'
import {
  ClientsRepository,
  AWSReportsRepository,
  GCPReportsRepository,
  AWSReportClientsRepository,
  GCPReportClientsRepository,
} from '@/lib/repositories'
import type { Client } from '@/types'
import type { AWSReport } from '@/lib/repositories/awsReportsRepository'
import type { GCPReport } from '@/lib/repositories/gcpReportsRepository'
import toast from 'react-hot-toast'
import {
  PageHeader,
  Card,
  ErrorMessage,
  DateRangePicker,
  Select,
  Button,
} from '@/components/ui'

interface AWSReportRow {
  id: string
  customerName: string
  cloudAccountNumber: string
  sellerCost: number
  clientIds: string[]
  date: string
}

interface GCPReportRow {
  id: string
  projectName: string
  projectId: string
  cost: number
  clientIds: string[]
  date: string
}

// ─── Parser CSV genérico ───────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
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

// ─── Paginación reutilizable ───────────────────────────────────────────────
function Pagination({
  page,
  total,
  pageSize,
  onPage,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-gray-600">
        Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={page === 1}>
          {prevLabel}
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`h-8 w-8 rounded-full text-sm font-medium transition-colors ${
              p === page
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <Button variant="secondary" size="sm" onClick={onNext} disabled={page === totalPages}>
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}

// ─── Tab AWS ──────────────────────────────────────────────────────────────
function AWSTab({ clients }: { clients: Client[] }) {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const awsRepo = useMemo(() => new AWSReportsRepository(supabase), [supabase])
  const awsClientsRepo = useMemo(() => new AWSReportClientsRepository(supabase), [supabase])

  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<AWSReportRow[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [clientSelectors, setClientSelectors] = useState<Record<string, string[]>>({})
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkClientId, setBulkClientId] = useState<string>('')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  useEffect(() => {
    if (dateRange?.start && dateRange?.end) loadReports()
    else setReportData([])
  }, [dateRange])

  const loadReports = async () => {
    if (!dateRange) return
    setLoading(true)
    setError(null)
    try {
      const reports = await awsRepo.getByDateRange(dateRange.start, dateRange.end)
      const reportIds = reports.map((r: AWSReport) => r.id)
      const clientAssignments = await awsClientsRepo.getByReportIds(reportIds)
      const clientsByReport = new Map<string, string[]>()
      clientAssignments.forEach((a) => {
        if (!clientsByReport.has(a.aws_report_id)) clientsByReport.set(a.aws_report_id, [])
        clientsByReport.get(a.aws_report_id)!.push(a.client_id)
      })
      setReportData(
        reports.map((r: AWSReport) => ({
          id: r.id,
          customerName: r.customer_name,
          cloudAccountNumber: r.cloud_account_number,
          sellerCost: r.seller_cost,
          clientIds: clientsByReport.get(r.id) || [],
          date: r.date,
        }))
      )
    } catch (err: any) {
      setError(err.message || 'Error al cargar los reportes AWS')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!dateRange?.start) { setError('Selecciona un rango de fechas antes de subir el CSV'); return }

    setUploading(true)
    setError(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) throw new Error('El CSV debe tener al menos una fila de encabezados y una fila de datos')

      const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''))
      const customerNameIndex = headers.findIndex((h) => h.toLowerCase() === 'customer name')
      const cloudAccountNumberIndex = headers.findIndex((h) => h.toLowerCase() === 'cloud account number')
      const sellerCostIndex = headers.findIndex((h) => h.toLowerCase() === 'customer cost (usd)')

      if (customerNameIndex === -1 || cloudAccountNumberIndex === -1 || sellerCostIndex === -1) {
        throw new Error(t('aws.csvFormat'))
      }

      const groupedData = new Map<string, { customerName: string; totalCost: number }>()
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const values = parseCSVLine(line).map((v) => v.replace(/^"|"$/g, ''))
        const customerName = values[customerNameIndex]?.trim() || ''
        const cloudAccountNumber = values[cloudAccountNumberIndex]?.trim() || ''
        const cost = parseFloat(values[sellerCostIndex]?.trim() || '0') || 0
        if (!cloudAccountNumber) continue
        if (groupedData.has(cloudAccountNumber)) {
          groupedData.get(cloudAccountNumber)!.totalCost += cost
        } else {
          groupedData.set(cloudAccountNumber, { customerName: customerName || 'Sin nombre', totalCost: cost })
        }
      }

      const processedData: AWSReportRow[] = Array.from(groupedData.entries())
        .map(([cloudAccountNumber, d]) => ({
          id: '',
          customerName: d.customerName,
          cloudAccountNumber,
          sellerCost: d.totalCost,
          clientIds: [],
          date: dateRange.start,
        }))
        .filter((row) => row.sellerCost >= 0.01)
        .sort((a, b) => a.cloudAccountNumber.localeCompare(b.cloudAccountNumber))

      if (processedData.length === 0) throw new Error('No se encontraron datos válidos en el CSV')

      await awsRepo.createMany(
        processedData.map((row) => ({
          customerName: row.customerName,
          cloudAccountNumber: row.cloudAccountNumber,
          sellerCost: row.sellerCost,
          clientId: null,
          date: row.date,
        }))
      )

      await loadReports()
      e.target.value = ''
      toast.success(`${processedData.length} registros AWS cargados correctamente`)
    } catch (err: any) {
      setError(err.message || t('aws.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const handleBulkAssign = async () => {
    if (!bulkClientId || selectedKeys.size === 0) return
    setBulkAssigning(true)
    try {
      for (const key of selectedKeys) {
        const row = reportData.find((r) => r.cloudAccountNumber === key)
        if (row) {
          await awsClientsRepo.removeAll(row.id)
          await awsClientsRepo.assign(row.id, bulkClientId)
        }
      }
      setReportData((prev) =>
        prev.map((row) =>
          selectedKeys.has(row.cloudAccountNumber) ? { ...row, clientIds: [bulkClientId] } : row
        )
      )
      toast.success(`Cliente asignado a ${selectedKeys.size} registros`)
      setSelectedKeys(new Set())
      setBulkClientId('')
    } catch (err: any) {
      setError(err.message || 'Error al asignar clientes')
    } finally {
      setBulkAssigning(false)
    }
  }

  const startEditing = (row: AWSReportRow) => {
    setEditingRow(row.cloudAccountNumber)
    setClientSelectors({
      ...clientSelectors,
      [row.cloudAccountNumber]: row.clientIds.length > 0 ? [...row.clientIds, ''] : [''],
    })
  }

  const addClientSelector = (key: string) => {
    const current = clientSelectors[key] || ['']
    setClientSelectors({ ...clientSelectors, [key]: [...current, ''] })
  }

  const updateClientSelector = (key: string, index: number, clientId: string) => {
    const current = clientSelectors[key] || ['']
    const updated = [...current]
    updated[index] = clientId
    setClientSelectors({ ...clientSelectors, [key]: updated })
  }

  const removeClientSelector = (key: string, index: number) => {
    const current = clientSelectors[key] || ['']
    const updated = current.filter((_, i) => i !== index)
    setClientSelectors({ ...clientSelectors, [key]: updated.length > 0 ? updated : [''] })
  }

  const handleSaveClients = async (row: AWSReportRow) => {
    const clientIds = (clientSelectors[row.cloudAccountNumber] || [])
      .filter((id) => id !== '')
      .filter((id, index, self) => self.indexOf(id) === index)

    try {
      await awsClientsRepo.removeAll(row.id)
      for (const clientId of clientIds) {
        await awsClientsRepo.assign(row.id, clientId)
      }
      setReportData((prev) =>
        prev.map((r) =>
          r.cloudAccountNumber === row.cloudAccountNumber ? { ...r, clientIds } : r
        )
      )
      setEditingRow(null)
      toast.success('Clientes actualizados')
    } catch (err: any) {
      setError(err.message || 'Error al guardar clientes')
    }
  }

  const filtered = reportData.filter((row) => {
    if (!nameFilter) return true
    const s = nameFilter.toLowerCase()
    return (
      row.customerName.toLowerCase().includes(s) ||
      row.cloudAccountNumber.toLowerCase().includes(s) ||
      (row.clientIds.length > 0 &&
        row.clientIds.some((cid) =>
          clients.find((c) => c.id === cid)?.name.toLowerCase().includes(s)
        ))
    )
  })
  const totalCost = filtered.reduce((sum, r) => sum + r.sellerCost, 0)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedKeys.has(r.cloudAccountNumber))

  return (
    <div>
      <ErrorMessage message={error || ''} className="mb-4" />

      <Card title={t('aws.uploadCSVTitle')} className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rango de Fechas</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <p className="mt-1 text-xs text-gray-500">Esta fecha se asignará a todos los registros del CSV</p>
          </div>
          <div className="flex-1 min-w-[300px]">
            <p className="mb-2 text-sm font-medium text-gray-700">Archivo CSV</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading || !dateRange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {!dateRange && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                Selecciona un rango de fechas antes de subir el CSV
              </p>
            )}
            {uploading && <p className="mt-2 text-sm text-gray-600">{t('aws.uploading')}</p>}
          </div>
        </div>
      </Card>

      {reportData.length > 0 && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar</label>
          <div className="relative">
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => { setNameFilter(e.target.value); setPage(1) }}
              placeholder="Buscar por nombre, cuenta cloud o cliente asignado..."
              className="w-full rounded-full border border-gray-300 px-4 py-2 pl-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
        </div>
      )}

      {selectedKeys.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedKeys.size} seleccionada{selectedKeys.size !== 1 ? 's' : ''}
          </span>
          <div className="w-60">
            <Select
              value={bulkClientId}
              onChange={setBulkClientId}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Seleccionar cliente"
              searchable
            />
          </div>
          <button
            onClick={handleBulkAssign}
            disabled={!bulkClientId || bulkAssigning}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkAssigning ? 'Asignando...' : 'Asignar a seleccionadas'}
          </button>
          <button
            onClick={() => { setSelectedKeys(new Set()); setBulkClientId('') }}
            className="ml-auto text-blue-400 hover:text-blue-700"
            title="Cancelar selección"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <Card title="Cargando..." className="mb-6 text-center">
          <p className="text-gray-600">Cargando reportes AWS...</p>
        </Card>
      ) : reportData.length > 0 ? (
        <Card title="Resultados del Reporte AWS" className="mb-6">
          {nameFilter && (
            <p className="mb-4 text-sm text-gray-600">
              Mostrando {filtered.length} de {reportData.length} registros
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-blue-50">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={(e) => {
                        const next = new Set(selectedKeys)
                        pageRows.forEach((r) => e.target.checked ? next.add(r.cloudAccountNumber) : next.delete(r.cloudAccountNumber))
                        setSelectedKeys(next)
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('aws.customerName')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('aws.cloudAccountNumber')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('aws.sellerCost')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente Asignado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No se encontraron registros</td></tr>
                ) : (
                  pageRows.map((row, i) => (
                    <tr key={`${row.cloudAccountNumber}-${i}`} className="border-b border-gray-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.cloudAccountNumber)}
                          onChange={(e) => {
                            const next = new Set(selectedKeys)
                            e.target.checked ? next.add(row.cloudAccountNumber) : next.delete(row.cloudAccountNumber)
                            setSelectedKeys(next)
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.cloudAccountNumber}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">${row.sellerCost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm min-w-[280px]">
                        {editingRow === row.cloudAccountNumber ? (
                          <div className="space-y-2 min-w-[300px]">
                            {(clientSelectors[row.cloudAccountNumber] || ['']).map((selectedClientId, index) => {
                              const selectors = clientSelectors[row.cloudAccountNumber] || ['']
                              const isLastEmpty = index === selectors.length - 1 && selectedClientId === ''
                              return (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <Select
                                      value={selectedClientId}
                                      onChange={(val) => updateClientSelector(row.cloudAccountNumber, index, val)}
                                      options={clients
                                        .filter((client) => {
                                          const otherSelections = selectors.filter((id, i) => i !== index && id !== '')
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
                                      onClick={() => removeClientSelector(row.cloudAccountNumber, index)}
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 shrink-0"
                                    >×</button>
                                  )}
                                </div>
                              )
                            })}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => addClientSelector(row.cloudAccountNumber)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600"
                              >+</button>
                              <div className="flex-1" />
                              <button
                                onClick={() => handleSaveClients(row)}
                                className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                              >{t('common.save')}</button>
                              <button
                                onClick={() => { setEditingRow(null); setClientSelectors({ ...clientSelectors, [row.cloudAccountNumber]: [''] }) }}
                                className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                              >{t('common.cancel')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex flex-wrap gap-1">
                              {row.clientIds.length > 0 ? (
                                row.clientIds.map((cid) => (
                                  <span key={cid} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                    {clients.find((c) => c.id === cid)?.name || cid}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-xs">Sin asignar</span>
                              )}
                            </div>
                            <button
                              onClick={() => startEditing(row)}
                              className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              {row.clientIds.length > 0 ? t('common.edit') : 'Asignar Cliente'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t('aws.totalCost')}:</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">${totalCost.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination
            page={page}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))}
            prevLabel={t('common.previous')}
            nextLabel={t('common.next')}
          />
        </Card>
      ) : (
        <Card title={t('aws.noData')} className="text-center">
          <p className="text-gray-500">
            {dateRange
              ? 'No hay reportes AWS para el rango de fechas seleccionado. Puedes subir un CSV para crear uno.'
              : 'Selecciona un rango de fechas para ver o cargar reportes AWS.'}
          </p>
        </Card>
      )}
    </div>
  )
}

// ─── Tab GCP ──────────────────────────────────────────────────────────────
function GCPTab({ clients }: { clients: Client[] }) {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const gcpRepo = useMemo(() => new GCPReportsRepository(supabase), [supabase])
  const gcpClientsRepo = useMemo(() => new GCPReportClientsRepository(supabase), [supabase])

  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<GCPReportRow[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [clientSelectors, setClientSelectors] = useState<Record<string, string[]>>({})
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkClientId, setBulkClientId] = useState<string>('')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  useEffect(() => {
    if (dateRange?.start && dateRange?.end) loadReports()
    else setReportData([])
  }, [dateRange])

  const loadReports = async () => {
    if (!dateRange) return
    setLoading(true)
    setError(null)
    try {
      const reports = await gcpRepo.getByDateRange(dateRange.start, dateRange.end)
      const reportIds = reports.map((r: GCPReport) => r.id)
      const clientAssignments = await gcpClientsRepo.getByReportIds(reportIds)
      const clientsByReport = new Map<string, string[]>()
      clientAssignments.forEach((a) => {
        if (!clientsByReport.has(a.gcp_report_id)) clientsByReport.set(a.gcp_report_id, [])
        clientsByReport.get(a.gcp_report_id)!.push(a.client_id)
      })
      setReportData(
        reports.map((r: GCPReport) => ({
          id: r.id,
          projectName: r.project_name,
          projectId: r.project_id,
          cost: r.cost,
          clientIds: clientsByReport.get(r.id) || [],
          date: r.date,
        }))
      )
    } catch (err: any) {
      setError(err.message || 'Error al cargar los reportes GCP')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!dateRange?.start) { setError('Selecciona un rango de fechas antes de subir el CSV'); return }

    setUploading(true)
    setError(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) throw new Error('El CSV debe tener al menos una fila de encabezados y una fila de datos')

      const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''))

      // GCP billing CSV columns
      // Support Spanish headers (including encoding variants) and English headers
      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      const projectNameIndex = headers.findIndex((h) =>
        normalize(h).includes('nombre del proyecto') || normalize(h).includes('project name') || normalize(h) === 'project.name'
      )
      // Prefer "ID del proyecto" (slug like "my-project") over "Número del proyecto" (numeric ID)
      const projectIdIndex = (() => {
        const bySlug = headers.findIndex((h) => normalize(h) === 'id del proyecto' || normalize(h) === 'project id' || normalize(h) === 'project.id')
        if (bySlug !== -1) return bySlug
        return headers.findIndex((h) =>
          normalize(h).includes('numero del proyecto') ||
          normalize(h).includes('project number')
        )
      })()
      // Use "Subtotal ($)" (exact) first, then "Costo ($)", then any subtotal column
      const costIndex = (() => {
        const exact = headers.findIndex((h) => normalize(h) === 'subtotal ($)' || normalize(h) === 'subtotal')
        if (exact !== -1) return exact
        const costo = headers.findIndex((h) => normalize(h) === 'costo ($)' || normalize(h) === 'cost ($)')
        if (costo !== -1) return costo
        return headers.findIndex((h) => normalize(h).includes('subtotal') || normalize(h).includes('total cost'))
      })()

      if (projectIdIndex === -1 || costIndex === -1) {
        throw new Error(
          'El CSV debe tener las columnas: "ID del proyecto" (o "Nombre del proyecto"), "Subtotal ($)" (o "Costo ($)")'
        )
      }

      const groupedData = new Map<string, { projectName: string; totalCost: number }>()
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const values = parseCSVLine(line).map((v) => v.replace(/^"|"$/g, ''))
        const projectName = projectNameIndex !== -1 ? values[projectNameIndex]?.trim() || '' : ''
        const projectId = values[projectIdIndex]?.trim() || ''
        const cost = parseFloat(values[costIndex]?.trim().replace(/[^0-9.-]/g, '') || '0') || 0
        if (!projectId) continue
        if (groupedData.has(projectId)) {
          groupedData.get(projectId)!.totalCost += cost
        } else {
          groupedData.set(projectId, { projectName: projectName || projectId, totalCost: cost })
        }
      }

      const processedData: GCPReportRow[] = Array.from(groupedData.entries())
        .map(([projectId, d]) => ({
          id: '',
          projectName: d.projectName,
          projectId,
          cost: d.totalCost,
          clientIds: [],
          date: dateRange.start,
        }))
        .filter((row) => row.cost >= 0.01)
        .sort((a, b) => a.projectId.localeCompare(b.projectId))

      if (processedData.length === 0) throw new Error('No se encontraron datos válidos en el CSV')

      await gcpRepo.createMany(
        processedData.map((row) => ({
          projectName: row.projectName,
          projectId: row.projectId,
          cost: row.cost,
          clientId: null,
          date: row.date,
        }))
      )

      await loadReports()
      e.target.value = ''
      toast.success(`${processedData.length} registros GCP cargados correctamente`)
    } catch (err: any) {
      setError(err.message || 'Error al procesar el CSV')
    } finally {
      setUploading(false)
    }
  }

  const handleBulkAssign = async () => {
    if (!bulkClientId || selectedKeys.size === 0) return
    setBulkAssigning(true)
    try {
      for (const key of selectedKeys) {
        const row = reportData.find((r) => r.projectId === key)
        if (row) {
          await gcpClientsRepo.removeAll(row.id)
          await gcpClientsRepo.assign(row.id, bulkClientId)
        }
      }
      setReportData((prev) =>
        prev.map((row) =>
          selectedKeys.has(row.projectId) ? { ...row, clientIds: [bulkClientId] } : row
        )
      )
      toast.success(`Cliente asignado a ${selectedKeys.size} registros`)
      setSelectedKeys(new Set())
      setBulkClientId('')
    } catch (err: any) {
      setError(err.message || 'Error al asignar clientes')
    } finally {
      setBulkAssigning(false)
    }
  }

  const startEditing = (row: GCPReportRow) => {
    setEditingRow(row.projectId)
    setClientSelectors({
      ...clientSelectors,
      [row.projectId]: row.clientIds.length > 0 ? [...row.clientIds, ''] : [''],
    })
  }

  const addClientSelector = (key: string) => {
    const current = clientSelectors[key] || ['']
    setClientSelectors({ ...clientSelectors, [key]: [...current, ''] })
  }

  const updateClientSelector = (key: string, index: number, clientId: string) => {
    const current = clientSelectors[key] || ['']
    const updated = [...current]
    updated[index] = clientId
    setClientSelectors({ ...clientSelectors, [key]: updated })
  }

  const removeClientSelector = (key: string, index: number) => {
    const current = clientSelectors[key] || ['']
    const updated = current.filter((_, i) => i !== index)
    setClientSelectors({ ...clientSelectors, [key]: updated.length > 0 ? updated : [''] })
  }

  const handleSaveClients = async (row: GCPReportRow) => {
    const clientIds = (clientSelectors[row.projectId] || [])
      .filter((id) => id !== '')
      .filter((id, index, self) => self.indexOf(id) === index)

    try {
      await gcpClientsRepo.removeAll(row.id)
      for (const clientId of clientIds) {
        await gcpClientsRepo.assign(row.id, clientId)
      }
      setReportData((prev) =>
        prev.map((r) => (r.projectId === row.projectId ? { ...r, clientIds } : r))
      )
      setEditingRow(null)
      toast.success('Clientes actualizados')
    } catch (err: any) {
      setError(err.message || 'Error al guardar clientes')
    }
  }

  const filtered = reportData.filter((row) => {
    if (!nameFilter) return true
    const s = nameFilter.toLowerCase()
    return (
      row.projectName.toLowerCase().includes(s) ||
      row.projectId.toLowerCase().includes(s) ||
      (row.clientIds.length > 0 &&
        row.clientIds.some((cid) =>
          clients.find((c) => c.id === cid)?.name.toLowerCase().includes(s)
        ))
    )
  })
  const totalCost = filtered.reduce((sum, r) => sum + r.cost, 0)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedKeys.has(r.projectId))

  return (
    <div>
      <ErrorMessage message={error || ''} className="mb-4" />

      <Card title="Cargar Reporte GCP" className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rango de Fechas</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <p className="mt-1 text-xs text-gray-500">Esta fecha se asignará a todos los registros del CSV</p>
          </div>
          <div className="flex-1 min-w-[300px]">
            <p className="mb-2 text-sm font-medium text-gray-700">Archivo CSV</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading || !dateRange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Columnas requeridas: <strong>ID del proyecto</strong>, <strong>Subtotal ($)</strong>
            </p>
            {!dateRange && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                Selecciona un rango de fechas antes de subir el CSV
              </p>
            )}
            {uploading && <p className="mt-2 text-sm text-gray-600">Procesando CSV...</p>}
          </div>
        </div>
      </Card>

      {reportData.length > 0 && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar</label>
          <div className="relative">
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => { setNameFilter(e.target.value); setPage(1) }}
              placeholder="Buscar por proyecto, ID de proyecto o cliente asignado..."
              className="w-full rounded-full border border-gray-300 px-4 py-2 pl-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
        </div>
      )}

      {selectedKeys.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedKeys.size} seleccionada{selectedKeys.size !== 1 ? 's' : ''}
          </span>
          <div className="w-60">
            <Select
              value={bulkClientId}
              onChange={setBulkClientId}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Seleccionar cliente"
              searchable
            />
          </div>
          <button
            onClick={handleBulkAssign}
            disabled={!bulkClientId || bulkAssigning}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkAssigning ? 'Asignando...' : 'Asignar a seleccionadas'}
          </button>
          <button
            onClick={() => { setSelectedKeys(new Set()); setBulkClientId('') }}
            className="ml-auto text-blue-400 hover:text-blue-700"
            title="Cancelar selección"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <Card title="Cargando..." className="mb-6 text-center">
          <p className="text-gray-600">Cargando reportes GCP...</p>
        </Card>
      ) : reportData.length > 0 ? (
        <Card title="Resultados del Reporte GCP" className="mb-6">
          {nameFilter && (
            <p className="mb-4 text-sm text-gray-600">
              Mostrando {filtered.length} de {reportData.length} registros
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-green-50">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={(e) => {
                        const next = new Set(selectedKeys)
                        pageRows.forEach((r) => e.target.checked ? next.add(r.projectId) : next.delete(r.projectId))
                        setSelectedKeys(next)
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nombre del Proyecto</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID del Proyecto</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Costo (USD)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente Asignado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No se encontraron registros</td></tr>
                ) : (
                  pageRows.map((row, i) => (
                    <tr key={`${row.projectId}-${i}`} className="border-b border-gray-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.projectId)}
                          onChange={(e) => {
                            const next = new Set(selectedKeys)
                            e.target.checked ? next.add(row.projectId) : next.delete(row.projectId)
                            setSelectedKeys(next)
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.projectName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.projectId}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">${row.cost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm min-w-[280px]">
                        {editingRow === row.projectId ? (
                          <div className="space-y-2 min-w-[300px]">
                            {(clientSelectors[row.projectId] || ['']).map((selectedClientId, index) => {
                              const selectors = clientSelectors[row.projectId] || ['']
                              const isLastEmpty = index === selectors.length - 1 && selectedClientId === ''
                              return (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <Select
                                      value={selectedClientId}
                                      onChange={(val) => updateClientSelector(row.projectId, index, val)}
                                      options={clients
                                        .filter((client) => {
                                          const otherSelections = selectors.filter((id, i) => i !== index && id !== '')
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
                                      onClick={() => removeClientSelector(row.projectId, index)}
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 shrink-0"
                                    >×</button>
                                  )}
                                </div>
                              )
                            })}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => addClientSelector(row.projectId)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600"
                              >+</button>
                              <div className="flex-1" />
                              <button
                                onClick={() => handleSaveClients(row)}
                                className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                              >{t('common.save')}</button>
                              <button
                                onClick={() => { setEditingRow(null); setClientSelectors({ ...clientSelectors, [row.projectId]: [''] }) }}
                                className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                              >{t('common.cancel')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex flex-wrap gap-1">
                              {row.clientIds.length > 0 ? (
                                row.clientIds.map((cid) => (
                                  <span key={cid} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                    {clients.find((c) => c.id === cid)?.name || cid}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-xs">Sin asignar</span>
                              )}
                            </div>
                            <button
                              onClick={() => startEditing(row)}
                              className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              {row.clientIds.length > 0 ? t('common.edit') : 'Asignar Cliente'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Costo Total:</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">${totalCost.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination
            page={page}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))}
            prevLabel={t('common.previous')}
            nextLabel={t('common.next')}
          />
        </Card>
      ) : (
        <Card title="No hay datos para mostrar" className="text-center">
          <p className="text-gray-500">
            {dateRange
              ? 'No hay reportes GCP para el rango de fechas seleccionado. Puedes subir un CSV para crear uno.'
              : 'Selecciona un rango de fechas para ver o cargar reportes GCP.'}
          </p>
        </Card>
      )}
    </div>
  )
}

// ─── Página principal Cloud ───────────────────────────────────────────────
export default function CloudPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])

  const [activeTab, setActiveTab] = useState<'aws' | 'gcp'>('aws')
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    clientsRepo.getAll().then(setClients).catch(console.error)
  }, [])

  return (
    <div>
      <PageHeader title={t('aws.title')} />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['aws', 'gcp'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'aws' ? (
        <AWSTab clients={clients} />
      ) : (
        <GCPTab clients={clients} />
      )}
    </div>
  )
}
