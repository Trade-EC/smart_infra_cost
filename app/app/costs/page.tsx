'use client'

import { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createClient } from '@/lib/supabase/client'
import {
  ApplicationsRepository,
  ClientsRepository,
  TransactionsRepository,
  AWSReportsRepository,
  ApplicationCostDistributionsRepository,
  TarifasRepository,
} from '@/lib/repositories'
import type { Tarifa } from '@/lib/repositories/tarifasRepository'
import type { AWSReport } from '@/lib/repositories/awsReportsRepository'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Application, Client, Transaction } from '@/types'
import {
  PageHeader,
  ErrorMessage,
  DateRangePicker,
  Select,
} from '@/components/ui'

interface TransactionWithCost extends Transaction {
  assigned_cost: number
}

export default function CostsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const applicationsRepo = useMemo(() => new ApplicationsRepository(supabase), [supabase])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const transactionsRepo = useMemo(() => new TransactionsRepository(supabase), [supabase])
  const awsReportsRepo = useMemo(() => new AWSReportsRepository(supabase), [supabase])
  const distributionsRepo = useMemo(() => new ApplicationCostDistributionsRepository(supabase), [supabase])
  const tarifasRepo = useMemo(() => new TarifasRepository(supabase), [supabase])

  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [clients, setClients] = useState<Client[]>([])
  const [transactions, setTransactions] = useState<TransactionWithCost[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [awsReports, setAwsReports] = useState<AWSReport[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (dateRange && selectedClientId) {
      loadCosts()
    } else {
      setTransactions([])
      setApplications([])
      setAwsReports([])
      setTarifas([])
    }
  }, [dateRange, selectedClientId])

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const loadCosts = async () => {
    if (!dateRange || !selectedClientId) return

    setLoading(true)
    setError(null)

    try {
      // Todas las queries son independientes — se ejecutan en paralelo
      const [transactionsData, allApplications, distributions, awsReportsData] =
        await Promise.all([
          transactionsRepo.getByClientAndDateRange(
            selectedClientId,
            dateRange.start,
            dateRange.end
          ),
          applicationsRepo.getAll({
            dateFrom: dateRange.start,
            dateTo: dateRange.end,
          }),
          distributionsRepo.getByClientAndDateRange(
            selectedClientId,
            dateRange.start,
            dateRange.end
          ),
          awsReportsRepo.getByClientAndDateRange(
            selectedClientId,
            dateRange.start,
            dateRange.end
          ),
        ])

      const tarifasData = await tarifasRepo.getByClient(selectedClientId, dateRange.end.split('T')[0])
      setTarifas(tarifasData)

      setTransactions(transactionsData)

      // Filtrar aplicaciones que tienen el cliente asignado directamente o a través de distribuciones
      const applicationsWithClient = allApplications.filter((app) => {
        // Verificar si tiene el cliente asignado directamente
        const hasDirectClient = app.clients?.some((c) => c.id === selectedClientId)
        
        // Verificar si tiene distribución para este cliente
        const hasDistribution = distributions.some((dist) => dist.application_id === app.id)
        
        return hasDirectClient || hasDistribution
      })

      // Mapear aplicaciones con el costo distribuido
      const applicationsData = applicationsWithClient.map((app) => {
        const distribution = distributions.find((dist) => dist.application_id === app.id)
        
        if (distribution) {
          // Si tiene distribución, usar el monto distribuido
          return {
            ...app,
            price: distribution.allocated_amount,
          }
        }
        
        // Si no tiene distribución, usar el precio completo
        return app
      })

      setApplications(applicationsData)
      setAwsReports(awsReportsData)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los costos')
    } finally {
      setLoading(false)
    }
  }

  const formatMonth = (monthStr: string) => {
    // Parsear directamente el string de fecha sin usar new Date() para evitar problemas de zona horaria
    // monthStr viene como "YYYY-MM-DD" o "YYYY-MM-01"
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    const parts = monthStr.split('-')
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1 // getMonth() usa índice 0-11
      if (!isNaN(year) && !isNaN(month) && month >= 0 && month < 12) {
        return `${monthNames[month]} ${year}`
      }
    }
    // Fallback si el formato no es el esperado
    return monthStr
  }

  const formatDate = (dateStr: string) => {
    // Parsear directamente el string de fecha sin usar new Date() para evitar problemas de zona horaria
    // dateStr viene como "YYYY-MM-DD"
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1 // Los meses van de 0-11
      const day = parseInt(parts[2], 10)
      
      const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ]
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 0 && month < 12) {
        return `${day} de ${monthNames[month]} de ${year}`
      }
    }
    // Fallback si el formato no es el esperado
    return dateStr
  }

  // Calcular subtotales por fuente
  const transactionsTotal = transactions.reduce((sum, t) => sum + t.assigned_cost, 0)
  const applicationsTotal = applications.reduce((sum, a) => sum + a.price, 0)
  const awsTotal = awsReports.reduce((sum, a) => sum + a.seller_cost, 0)
  const baseTotal = transactionsTotal + applicationsTotal + awsTotal

  // Calcular tarifas aplicadas
  const tarifasAplicadas = tarifas.map((tarifa) => {
    let base = 0
    if (tarifa.aplica_a === 'transactions') base = transactionsTotal
    else if (tarifa.aplica_a === 'applications') base = applicationsTotal
    else if (tarifa.aplica_a === 'aws') base = awsTotal
    else if (tarifa.aplica_a === 'total') base = baseTotal
    return { tarifa, monto: base * (tarifa.porcentaje / 100) }
  })

  const tarifasTotal = tarifasAplicadas.reduce((sum, t) => sum + t.monto, 0)
  const grandTotal = baseTotal + tarifasTotal

  const APLICA_A_LABELS: Record<string, string> = {
    transactions: 'Transacciones',
    aws: 'AWS',
    gcp: 'GCP',
    applications: 'Aplicaciones',
    total: 'Total base',
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  const handleDownloadPDF = () => {
    if (!selectedClient || !dateRange) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Reporte de Costos', pageWidth / 2, 18, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Cliente: ${selectedClient.name}`, 14, 28)
    doc.text(
      `Período: ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`,
      14,
      35,
    )

    let y = 44

    // Transactions table
    if (transactions.length > 0) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Transacciones', 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Mes', 'Cantidad', 'Precio por Transacción', 'Costo Asignado']],
        body: transactions.map((t) => [
          formatMonth(t.month),
          t.quantity,
          `$${t.cost_per_transaction.toFixed(2)}`,
          `$${t.assigned_cost.toFixed(2)}`,
        ]),
        foot: [['', '', 'Total Transacciones:', `$${transactionsTotal.toFixed(2)}`]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
      })

      y = (doc as any).lastAutoTable.finalY + 10
    }

    // Applications table
    if (applications.length > 0) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Aplicaciones', 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Aplicación', 'Responsable', 'Costo']],
        body: applications.map((a) => [
          formatDate(a.date),
          a.name,
          a.responsable,
          `$${a.price.toFixed(2)}`,
        ]),
        foot: [['', '', 'Total Aplicaciones:', `$${applicationsTotal.toFixed(2)}`]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
      })

      y = (doc as any).lastAutoTable.finalY + 10
    }

    // AWS table
    if (awsReports.length > 0) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('AWS', 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Cuenta Cloud', 'Cliente (CSV)', 'Costo']],
        body: awsReports.map((r) => [
          formatDate(r.date),
          r.cloud_account_number,
          r.customer_name,
          `$${r.seller_cost.toFixed(2)}`,
        ]),
        foot: [['', '', 'Total AWS:', `$${awsTotal.toFixed(2)}`]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
      })

      y = (doc as any).lastAutoTable.finalY + 10
    }

    // Grand total
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(59, 130, 246)
    doc.text(`Total General: $${grandTotal.toFixed(2)}`, pageWidth - 14, y, { align: 'right' })

    const fileName = `costos_${selectedClient.name.replace(/\s+/g, '_')}_${dateRange.start}_${dateRange.end}.pdf`
    doc.save(fileName)
  }

  return (
    <div>
      <PageHeader title={t('costs.title')} />

      <ErrorMessage message={error || ''} className="mb-4" />

      {/* Filtros unificados con Reportes */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-wrap items-end gap-4">
          {/* Contenedor de Fechas - flex-1 para que tome el espacio sobrante */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Fechas
            </label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
          </div>

          {/* Filtro de Cliente - w-64 para ancho fijo idéntico a Reportes */}
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Cliente
            </label>
            <Select
              value={selectedClientId}
              onChange={setSelectedClientId}
              options={clients.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Seleccionar cliente"
              searchable
              clearLabel="Sin selección"
            />
          </div>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Cargando...</p>
        </div>
      ) : dateRange && selectedClientId ? (
        <div className="space-y-6">
          {/* Sección de Transacciones */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Transacciones
            </h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500">No hay transacciones en el rango seleccionado</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-blue-50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Mes
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Precio por Transacción
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Costo Asignado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatMonth(transaction.month)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {transaction.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            ${transaction.cost_per_transaction.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            ${transaction.assigned_cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Total Transacciones:
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                          ${transactionsTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Sección de Aplicaciones */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Aplicaciones
            </h2>
            {applications.length === 0 ? (
              <p className="text-sm text-gray-500">No hay aplicaciones en el rango seleccionado</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-blue-50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Aplicación
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Responsable
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Costo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((application) => (
                        <tr key={application.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDate(application.date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {application.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {application.responsable}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            ${application.price.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Total Aplicaciones:
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                          ${applicationsTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Sección de AWS */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              AWS
            </h2>
            {awsReports.length === 0 ? (
              <p className="text-sm text-gray-500">No hay costos de AWS en el rango seleccionado</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-blue-50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Cuenta Cloud
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Cliente (CSV)
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Costo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {awsReports.map((report) => (
                        <tr key={report.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDate(report.date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {report.cloud_account_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {report.customer_name}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            ${report.seller_cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Total AWS:
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                          ${awsTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Sección de Tarifas */}
          {tarifasAplicadas.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-bold text-gray-900">Tarifas Aplicadas</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-amber-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tarifa</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Aplica a</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Base</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">%</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarifasAplicadas.map(({ tarifa, monto }) => {
                      let base = 0
                      if (tarifa.aplica_a === 'transactions') base = transactionsTotal
                      else if (tarifa.aplica_a === 'applications') base = applicationsTotal
                      else if (tarifa.aplica_a === 'aws') base = awsTotal
                      else if (tarifa.aplica_a === 'total') base = baseTotal
                      return (
                        <tr key={tarifa.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{tarifa.nombre}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{tarifa.tipo}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{APLICA_A_LABELS[tarifa.aplica_a]}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">${base.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{tarifa.porcentaje}%</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">${monto.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Tarifas:</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">${tarifasTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Total General */}
          <div className="rounded-lg bg-blue-50 border-2 border-blue-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Cliente: <span className="font-bold">{selectedClient?.name || ''}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Período: {dateRange ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700 mb-1">Total General</p>
                  <p className="text-3xl font-bold text-blue-600">
                    ${grandTotal.toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow text-center">
          <p className="text-gray-500">
            Por favor selecciona un rango de fechas y un cliente para ver el desglose de costos
          </p>
        </div>
      )}
    </div>
  )
}
