'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ApplicationsRepository,
  ClientsRepository,
  TransactionsRepository,
  AWSReportsRepository,
  ApplicationCostDistributionsRepository,
} from '@/lib/repositories'
import type { AWSReport } from '@/lib/repositories/awsReportsRepository'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Application, Client, Transaction } from '@/types'
import {
  PageHeader,
  Input,
  ErrorMessage,
  DateRangePicker,
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
  
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [clients, setClients] = useState<Client[]>([])
  const [transactions, setTransactions] = useState<TransactionWithCost[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [awsReports, setAwsReports] = useState<AWSReport[]>([])
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
      // Cargar transacciones
      const transactionsData = await transactionsRepo.getByClientAndDateRange(
        selectedClientId,
        dateRange.start,
        dateRange.end
      )
      setTransactions(transactionsData)

      // Cargar aplicaciones con distribuciones
      // Primero obtener todas las aplicaciones en el rango de fechas
      const allApplications = await applicationsRepo.getAll({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
      })

      // Obtener distribuciones para el cliente seleccionado
      const distributions = await distributionsRepo.getByClientAndDateRange(
        selectedClientId,
        dateRange.start,
        dateRange.end
      )

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

      // Cargar reportes AWS
      const awsReportsData = await awsReportsRepo.getByClientAndDateRange(
        selectedClientId,
        dateRange.start,
        dateRange.end
      )
      setAwsReports(awsReportsData)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los costos')
    } finally {
      setLoading(false)
    }
  }

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr)
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Calcular totales
  const transactionsTotal = transactions.reduce((sum, t) => sum + t.assigned_cost, 0)
  const applicationsTotal = applications.reduce((sum, a) => sum + a.price, 0)
  const awsTotal = awsReports.reduce((sum, a) => sum + a.seller_cost, 0)
  const grandTotal = transactionsTotal + applicationsTotal + awsTotal

  const selectedClient = clients.find(c => c.id === selectedClientId)

  return (
    <div>
      <PageHeader title={t('costs.title')} />

      <ErrorMessage message={error || ''} className="mb-4" />

      {/* Filtros */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fechas
            </label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="">Seleccionar cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
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
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700 mb-1">Total General</p>
                <p className="text-3xl font-bold text-blue-600">
                  ${grandTotal.toFixed(2)}
                </p>
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
