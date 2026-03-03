'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AWSReportsRepository, ClientsRepository } from '@/lib/repositories'
import DateRangePicker from '@/components/ui/DateRangePicker'
import Select from '@/components/ui/Select'

// Estructura de datos apilada estilo AWS Cost Explorer
interface StackedSegment {
  name: string // Nombre del cliente/aplicación/cuenta
  amount: number
  color: string
}

interface StackedReportData {
  month: string // YYYY-MM
  segments: StackedSegment[]
  total: number
}

// Paleta de colores para los segmentos
const COLOR_PALETTE = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
  '#A855F7', // purple-500
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'aws'>('clients')
  const [clientsData, setClientsData] = useState<StackedReportData[]>([])
  const [awsData, setAwsData] = useState<StackedReportData[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const supabase = useMemo(() => createClient(), [])
  const awsReportsRepo = useMemo(() => new AWSReportsRepository(supabase), [supabase])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (dateRange) {
      if (activeTab === 'clients') {
        loadClientsReport()
      } else {
        loadAWSReport()
      }
    } else {
      setClientsData([])
      setAwsData([])
    }
  }, [activeTab, dateRange, selectedClientId])

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data.map(c => ({ id: c.id, name: c.name })))
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const formatMonth = (monthStr: string) => {
    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ]
    const parts = monthStr.split('-')
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      if (!isNaN(year) && !isNaN(month) && month >= 0 && month < 12) {
        return `${monthNames[month]}. ${year}`
      }
    }
    return monthStr
  }

  const getMonthKey = (dateStr: string) => {
    const parts = dateStr.split('-')
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`
    }
    return dateStr
  }

  // Primer día del mes y último día del mes para filtrar monthly_costs correctamente
  const getFirstDayOfMonth = (dateStr: string) => {
    const [y, m] = dateStr.split('T')[0].split('-')
    return `${y}-${m}-01`
  }
  const getLastDayOfMonth = (dateStr: string) => {
    const [y, m] = dateStr.split('T')[0].split('-')
    const year = parseInt(y, 10)
    const month = parseInt(m, 10)
    const lastDay = new Date(year, month, 0).getDate()
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`
  }

  // Función auxiliar para procesar datos agrupados y aplicar top 8 + "Otros"
  const processGroupedData = (groupedByMonth: Record<string, Record<string, number>>): StackedReportData[] => {
    // Calcular totales de cada segmento a través de todos los meses
    const segmentTotals = new Map<string, number>()
    Object.values(groupedByMonth).forEach(monthData => {
      Object.entries(monthData).forEach(([name, amount]) => {
        segmentTotals.set(name, (segmentTotals.get(name) || 0) + amount)
      })
    })

    // Ordenar todos los segmentos por monto total (para orden consistente en leyenda/gráfico)
    const sortedSegmentNames = Array.from(segmentTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
    // Procesar cada mes: mostrar todos los clientes/segmentos (sin agrupar en "Otros")
    const processedData: StackedReportData[] = Object.entries(groupedByMonth)
      .map(([month, segments]) => {
        const monthSegments: Array<{ name: string; amount: number }> = sortedSegmentNames.map(name => ({
          name,
          amount: (segments[name] as number) || 0,
        }))
        const total = monthSegments.reduce((sum, s) => sum + s.amount, 0)
        return {
          month,
          segments: assignColors(monthSegments),
          total,
        }
      })
      .sort((a, b) => a.month.localeCompare(b.month))

    return processedData
  }

  // Función auxiliar para asignar colores a segmentos
  const assignColors = (segments: Array<{ name: string; amount: number }>): StackedSegment[] => {
    const uniqueNames = Array.from(new Set(segments.map(s => s.name))).sort()
    const colorMap = new Map<string, string>()
    // Color gris para "Sin asignar" (costos AWS sin cliente)
    colorMap.set('Sin asignar', '#9CA3AF')

    uniqueNames.forEach((name, index) => {
      if (!colorMap.has(name)) {
        colorMap.set(name, COLOR_PALETTE[index % COLOR_PALETTE.length])
      }
    })

    return segments.map(segment => ({
      ...segment,
      color: colorMap.get(segment.name) || COLOR_PALETTE[0],
    }))
  }

  const loadClientsReport = async () => {
    if (!dateRange) return

    setLoading(true)
    try {
      const startMonth = getFirstDayOfMonth(dateRange.start)
      const endMonth = getLastDayOfMonth(dateRange.end)

      // Obtener monthly_costs en el rango de fechas
      const { data: monthlyCosts, error: monthlyError } = await supabase
        .from('monthly_costs')
        .select('id, month')
        .gte('month', startMonth)
        .lte('month', endMonth)

      if (monthlyError) throw monthlyError

      const monthlyCostIds = monthlyCosts?.map(mc => mc.id) || []
      
      // Obtener cost_allocations
      const { data: costAllocations, error: allocError } = await supabase
        .from('cost_allocations')
        .select('id, monthly_cost_id')
        .in('monthly_cost_id', monthlyCostIds)

      if (allocError) throw allocError

      const costAllocationIds = costAllocations?.map(ca => ca.id) || []

      // Obtener distribuciones de costos con clientes
      const { data: distributions, error: distError } = await supabase
        .from('cost_distributions')
        .select(`
          allocated_amount,
          cost_allocation_id,
          clients!inner (
            id,
            name
          )
        `)
        .in('cost_allocation_id', costAllocationIds)

      if (distError) throw distError

      // Obtener asignaciones de transacciones con clientes
      const { data: transactions, error: transError } = await supabase
        .from('transaction_assignments')
        .select(`
          assigned_cost,
          transaction_id,
          clients!inner (
            id,
            name
          ),
          transactions!inner (
            month
          )
        `)
        .gte('transactions.month', startMonth)
        .lte('transactions.month', endMonth)

      if (transError) throw transError

      // Crear mapa de cost_allocation_id -> month
      const costAllocationToMonth = new Map<string, string>()
      if (monthlyCosts && costAllocations) {
        const monthlyCostMap = new Map(monthlyCosts.map(mc => [mc.id, mc.month]))
        costAllocations.forEach(ca => {
          const month = monthlyCostMap.get(ca.monthly_cost_id)
          if (month) {
            costAllocationToMonth.set(ca.id, month)
          }
        })
      }

      // Agrupar por mes y cliente
      const groupedByMonth: Record<string, Record<string, number>> = {}

      // Sumar costos de aplicaciones por mes y cliente
      ;(distributions || []).forEach((item: any) => {
        const month = costAllocationToMonth.get(item.cost_allocation_id)
        const clientId = item.clients?.id
        const clientName = item.clients?.name || 'Sin nombre'
        
        // Filtrar por cliente si está seleccionado
        if (selectedClientId && clientId !== selectedClientId) return
        
        if (month) {
          const monthKey = getMonthKey(month)
          if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = {}
          }
          groupedByMonth[monthKey][clientName] = (groupedByMonth[monthKey][clientName] || 0) + parseFloat(item.allocated_amount || 0)
        }
      })

      // Sumar costos de transacciones por mes y cliente
      ;(transactions || []).forEach((item: any) => {
        const month = item.transactions?.month
        const clientId = item.clients?.id
        const clientName = item.clients?.name || 'Sin nombre'
        
        // Filtrar por cliente si está seleccionado
        if (selectedClientId && clientId !== selectedClientId) return
        
        if (month) {
          const monthKey = getMonthKey(month)
          if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = {}
          }
          groupedByMonth[monthKey][clientName] = (groupedByMonth[monthKey][clientName] || 0) + parseFloat(item.assigned_cost || 0)
        }
      })

      const reportData = processGroupedData(groupedByMonth)
      setClientsData(reportData)
    } catch (error: any) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAWSReport = async () => {
    if (!dateRange) return

    setLoading(true)
    try {
      const startMonth = getFirstDayOfMonth(dateRange.start)
      const endMonth = getLastDayOfMonth(dateRange.end)

      // Obtener reportes AWS con relación a clientes
      const { data: reports, error: reportsError } = await supabase
        .from('aws_reports')
        .select(`
          seller_cost,
          date,
          client_id,
          clients (
            id,
            name
          )
        `)
        .gte('date', startMonth)
        .lte('date', endMonth)

      if (reportsError) throw reportsError

      // Agrupar por mes y cliente
      const groupedByMonth: Record<string, Record<string, number>> = {}
      
      ;(reports || []).forEach((report: any) => {
        const monthKey = getMonthKey(report.date)
        const clientId = report.client_id
        const clientName = report.clients?.name || 'Sin asignar'
        
        // Filtrar por cliente si está seleccionado
        if (selectedClientId && clientId !== selectedClientId) return
        
        if (!groupedByMonth[monthKey]) {
          groupedByMonth[monthKey] = {}
        }
        groupedByMonth[monthKey][clientName] = (groupedByMonth[monthKey][clientName] || 0) + parseFloat(report.seller_cost || 0)
      })

      const reportData = processGroupedData(groupedByMonth)
      setAwsData(reportData)
    } catch (error: any) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActiveData = () => {
    if (activeTab === 'clients') return clientsData
    return awsData
  }

  const data = getActiveData()

  // Nombres de clientes/segmentos para la tabla
  const allSegmentNames = useMemo(() => {
    const names = new Set<string>()
    data.forEach(monthData => {
      monthData.segments.forEach(segment => {
        names.add(segment.name)
      })
    })
    return Array.from(names).sort()
  }, [data])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
        <div className="mt-4 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Fechas
            </label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          {(activeTab === 'clients' || activeTab === 'aws') && (
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Cliente
              </label>
              <Select
                value={selectedClientId}
                onChange={setSelectedClientId}
                options={clients.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Todos los clientes"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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
          <button
            onClick={() => setActiveTab('aws')}
            className={`border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'aws'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Costos AWS
          </button>
        </nav>
      </div>

      {/* Título y mensajes cuando no hay datos; tabla cuando sí hay */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">
          {activeTab === 'clients'
            ? 'Costos Totales por Cliente por Mes'
            : 'Costos AWS por Mes'}
        </h2>
        {!dateRange && (
          <p className="text-center text-gray-500">Selecciona un rango de fechas para ver los reportes</p>
        )}
        {dateRange && loading && (
          <p className="text-center text-gray-500">Cargando...</p>
        )}
        {dateRange && !loading && data.length === 0 && (
          <p className="text-center text-gray-500">No hay datos para mostrar en el rango de fechas seleccionado</p>
        )}
      </div>

      {/* Tabla: clientes en filas (vertical), meses en columnas (horizontal) */}
      {data.length > 0 && (
        <div className="mt-6 rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky left-0 bg-gray-50">
                    Cliente
                  </th>
                  {data.map((monthData) => (
                    <th key={monthData.month} className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap">
                      {formatMonth(monthData.month)}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {allSegmentNames.map((clientName) => {
                  let rowTotal = 0
                  return (
                    <tr key={clientName} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        {clientName}
                      </td>
                      {data.map((monthData) => {
                        const segment = monthData.segments.find(s => s.name === clientName)
                        const amount = segment ? segment.amount : 0
                        rowTotal += amount
                        return (
                          <td key={monthData.month} className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 text-right">
                            {segment ? `$${segment.amount.toFixed(2)}` : '-'}
                          </td>
                        )
                      })}
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        ${rowTotal.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">
                    Total
                  </td>
                  {data.map((monthData) => (
                    <td key={monthData.month} className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                      ${monthData.total.toFixed(2)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    ${data.reduce((sum, m) => sum + m.total, 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
