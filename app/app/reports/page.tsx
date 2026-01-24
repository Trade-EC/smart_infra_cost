'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ReportData {
  name: string
  total: number
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'applications' | 'clients'>('applications')
  const [applicationsData, setApplicationsData] = useState<ReportData[]>([])
  const [clientsData, setClientsData] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (activeTab === 'applications') {
      loadApplicationsReport()
    } else {
      loadClientsReport()
    }
  }, [activeTab])

  const loadApplicationsReport = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cost_allocations')
        .select(`
          total_amount,
          applications (
            name
          )
        `)

      if (error) throw error

      const grouped = (data || []).reduce((acc: Record<string, number>, item: any) => {
        const appName = item.applications?.name || 'Sin nombre'
        acc[appName] = (acc[appName] || 0) + parseFloat(item.total_amount)
        return acc
      }, {})

      const reportData = Object.entries(grouped).map(([name, total]) => ({
        name,
        total: total as number,
      }))

      setApplicationsData(reportData)
    } catch (error: any) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClientsReport = async () => {
    setLoading(true)
    try {
      // Obtener distribuciones de costos
      const { data: distributions, error: distError } = await supabase
        .from('cost_distributions')
        .select(`
          allocated_amount,
          clients (
            name
          )
        `)

      if (distError) throw distError

      // Obtener asignaciones de transacciones
      const { data: transactions, error: transError } = await supabase
        .from('transaction_assignments')
        .select(`
          assigned_cost,
          clients (
            name
          )
        `)

      if (transError) throw transError

      const grouped: Record<string, number> = {}

      // Sumar costos de aplicaciones
      ;(distributions || []).forEach((item: any) => {
        const clientName = item.clients?.name || 'Sin nombre'
        grouped[clientName] = (grouped[clientName] || 0) + parseFloat(item.allocated_amount)
      })

      // Sumar costos de transacciones
      ;(transactions || []).forEach((item: any) => {
        const clientName = item.clients?.name || 'Sin nombre'
        grouped[clientName] = (grouped[clientName] || 0) + parseFloat(item.assigned_cost)
      })

      const reportData = Object.entries(grouped).map(([name, total]) => ({
        name,
        total,
      }))

      setClientsData(reportData)
    } catch (error: any) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const maxValue = activeTab === 'applications'
    ? Math.max(...applicationsData.map(d => d.total), 0)
    : Math.max(...clientsData.map(d => d.total), 0)

  const data = activeTab === 'applications' ? applicationsData : clientsData

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('applications')}
            className={`border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'applications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Costos de Aplicaciones
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'clients'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Costos por Cliente
          </button>
        </nav>
      </div>

      {/* Gráfico de barras */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">
          {activeTab === 'applications'
            ? 'Costos por Aplicación'
            : 'Costos Totales por Cliente'}
        </h2>

        {loading ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : data.length === 0 ? (
          <p className="text-center text-gray-500">No hay datos para mostrar</p>
        ) : (
          <div className="space-y-4">
            {data.map((item, index) => {
              const percentage = maxValue > 0 ? (item.total / maxValue) * 100 : 0
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{item.name}</span>
                    <span className="font-semibold text-gray-900">
                      ${item.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-6 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabla de datos */}
      {data.length > 0 && (
        <div className="mt-6 rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {activeTab === 'applications' ? 'Aplicación' : 'Cliente'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      ${item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


