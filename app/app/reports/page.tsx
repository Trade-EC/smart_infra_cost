'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AWSReportsRepository,
  AWSReportClientsRepository,
  GCPReportsRepository,
  GCPReportClientsRepository,
  LicensesRepository,
  ClientsRepository,
  ApplicationsRepository,
  TransactionsRepository,
  ApplicationCostDistributionsRepository,
} from '@/lib/repositories'
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
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const t = `${y}-${m}-${day}`
    return { start: t, end: t }
  })
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const supabase = useMemo(() => createClient(), [])
  const awsReportsRepo = useMemo(() => new AWSReportsRepository(supabase), [supabase])
  const awsReportClientsRepo = useMemo(() => new AWSReportClientsRepository(supabase), [supabase])
  const gcpReportsRepo = useMemo(() => new GCPReportsRepository(supabase), [supabase])
  const gcpReportClientsRepo = useMemo(() => new GCPReportClientsRepository(supabase), [supabase])
  const licensesRepo = useMemo(() => new LicensesRepository(supabase), [supabase])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const applicationsRepo = useMemo(() => new ApplicationsRepository(supabase), [supabase])
  const transactionsRepo = useMemo(() => new TransactionsRepository(supabase), [supabase])
  const distributionsRepo = useMemo(
    () => new ApplicationCostDistributionsRepository(supabase),
    [supabase]
  )

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
      const startDate = dateRange.start
      const endDate = dateRange.end

      let clientList = clients
      if (!clientList || clientList.length === 0) {
        const data = await clientsRepo.getAll()
        clientList = data.map(c => ({ id: c.id, name: c.name }))
        setClients(clientList)
      }

      const clientIdToName = new Map(clientList.map(c => [c.id, c.name]))

      // 1. Consultas masivas en paralelo
      const [allAssignments, allDistributions, allAwsReports, allApplications, allGcpReports, allLicenses] =
        await Promise.all([
          transactionsRepo.getAssignmentsByDateRange(startDate, endDate),
          distributionsRepo.getByDateRange(startDate, endDate),
          awsReportsRepo.getByDateRange(startDate, endDate),
          applicationsRepo.getAll({ dateFrom: startDate, dateTo: endDate }),
          gcpReportsRepo.getByDateRange(startDate, endDate),
          licensesRepo.getAll({ dateFrom: startDate, dateTo: endDate }),
        ])

      // 2. Obtener asignaciones de clientes via tablas pivot (igual que módulo Costos)
      const awsReportIds = (allAwsReports || []).map((r: any) => r.id)
      const gcpReportIds = (allGcpReports || []).map((r: any) => r.id)
      const [awsClientAssignments, gcpClientAssignments] = await Promise.all([
        awsReportClientsRepo.getByReportIds(awsReportIds),
        gcpReportClientsRepo.getByReportIds(gcpReportIds),
      ])

      const groupedByMonth: Record<string, Record<string, number>> = {}

      const addToGroup = (monthKey: string, clientName: string, amount: number) => {
        if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = {}
        groupedByMonth[monthKey][clientName] =
          (groupedByMonth[monthKey][clientName] || 0) + amount
      }

      // 2. Procesar todo en memoria

      // A. Transacciones
      ;(allAssignments || []).forEach((row: any) => {
        if (selectedClientId && row.client_id !== selectedClientId) return
        const monthKey = getMonthKey(row.month)
        addToGroup(monthKey, row.client_name || 'Sin nombre', row.assigned_cost || 0)
      })

      // B. Distribuciones de aplicaciones (monto ya asignado por cliente)
      ;(allDistributions || []).forEach((dist: any) => {
        if (selectedClientId && dist.client_id !== selectedClientId) return
        const clientName = clientIdToName.get(dist.client_id) || 'Sin nombre'
        const monthKey = getMonthKey(dist.application_date)
        addToGroup(monthKey, clientName, dist.allocated_amount || 0)
      })

      // C. Aplicaciones con cliente directo (sin distribución): repartir precio entre esos clientes
      const distSet = new Set(
        (allDistributions || []).map(
          (d: any) => `${d.application_id}_${d.client_id}`
        )
      )
      ;(allApplications || []).forEach((app: any) => {
        const monthKey = getMonthKey(app.date)
        const price = app.price || 0
        const clientsWithoutDist = (app.clients || []).filter(
          (c: any) => !distSet.has(`${app.id}_${c.id}`)
        )
        const toProcess = selectedClientId
          ? clientsWithoutDist.filter((c: any) => c.id === selectedClientId)
          : clientsWithoutDist
        if (toProcess.length === 0) return
        const amountEach = price / toProcess.length
        toProcess.forEach((c: any) => {
          addToGroup(monthKey, c.name || 'Sin nombre', amountEach)
        })
      })

      // D. AWS — via tabla pivot aws_report_clients (consistente con módulo Costos)
      const awsReportMap = new Map((allAwsReports || []).map((r: any) => [r.id, r]))
      ;(awsClientAssignments || []).forEach((assignment) => {
        if (selectedClientId && assignment.client_id !== selectedClientId) return
        const report = awsReportMap.get(assignment.aws_report_id)
        if (!report) return
        const clientName = clientIdToName.get(assignment.client_id) || 'Sin nombre'
        const monthKey = getMonthKey(report.date)
        addToGroup(monthKey, clientName, report.seller_cost || 0)
      })

      // E. GCP — via tabla pivot gcp_report_clients (consistente con módulo Costos)
      const gcpReportMap = new Map((allGcpReports || []).map((r: any) => [r.id, r]))
      ;(gcpClientAssignments || []).forEach((assignment) => {
        if (selectedClientId && assignment.client_id !== selectedClientId) return
        const report = gcpReportMap.get(assignment.gcp_report_id)
        if (!report) return
        const clientName = clientIdToName.get(assignment.client_id) || 'Sin nombre'
        const monthKey = getMonthKey(report.date)
        addToGroup(monthKey, clientName, report.cost || 0)
      })

      // F. Licencias (precio completo por cliente, consistente con módulo Costos)
      ;(allLicenses || []).forEach((license: any) => {
        const monthKey = getMonthKey(license.date)
        const price = license.price || 0
        const licenseClients: any[] = license.clients || []
        const toProcess = selectedClientId
          ? licenseClients.filter((c: any) => c.id === selectedClientId)
          : licenseClients
        toProcess.forEach((c: any) => {
          addToGroup(monthKey, c.name || 'Sin nombre', price)
        })
      })

      const reportData = processGroupedData(groupedByMonth)
      setClientsData(reportData)
    } catch (error: any) {
      const message = error?.message ?? String(error)
      console.error('Error al cargar reporte:', message, error)
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

      let clientList = clients
      if (!clientList || clientList.length === 0) {
        const data = await clientsRepo.getAll()
        clientList = data.map(c => ({ id: c.id, name: c.name }))
        setClients(clientList)
      }
      const clientIdToName = new Map(clientList.map(c => [c.id, c.name]))

      // 1. Obtener todos los reportes AWS en el rango
      const allAwsReports = await awsReportsRepo.getByDateRange(startMonth, endMonth)

      // 2. Obtener asignaciones de clientes via tabla pivot
      const awsReportIds = allAwsReports.map(r => r.id)
      const awsClientAssignments = await awsReportClientsRepo.getByReportIds(awsReportIds)

      // 3. Agrupar por mes y cliente
      const groupedByMonth: Record<string, Record<string, number>> = {}
      const awsReportMap = new Map(allAwsReports.map(r => [r.id, r]))

      ;(awsClientAssignments || []).forEach((assignment) => {
        if (selectedClientId && assignment.client_id !== selectedClientId) return
        const report = awsReportMap.get(assignment.aws_report_id)
        if (!report) return
        const clientName = clientIdToName.get(assignment.client_id) || 'Sin nombre'
        const monthKey = getMonthKey(report.date)
        if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = {}
        groupedByMonth[monthKey][clientName] = (groupedByMonth[monthKey][clientName] || 0) + (report.seller_cost || 0)
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

  // Nombres de clientes/segmentos para la tabla (filas = un cliente por fila)
  // En AWS: solo clientes que tengan al menos un costo en el rango; meses sin costo se muestran vacíos
  const allSegmentNames = useMemo(() => {
    const names = new Set<string>()
    data.forEach(monthData => {
      monthData.segments.forEach(segment => {
        names.add(segment.name)
      })
    })
    return Array.from(names).sort()
  }, [data])

  // Top 5 segmentos por costo total en el período
  const top5 = useMemo(() => {
    const totals = new Map<string, { color: string; total: number }>()
    data.forEach(month => {
      month.segments.forEach(seg => {
        const ex = totals.get(seg.name)
        if (ex) ex.total += seg.amount
        else totals.set(seg.name, { color: seg.color, total: seg.amount })
      })
    })
    return Array.from(totals.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, info]) => ({ name, color: info.color, total: info.total }))
  }, [data])

  const top5Names = useMemo(() => new Set(top5.map(t => t.name)), [top5])

  const maxChartTotal = useMemo(() => {
    return Math.max(
      ...data.map(d =>
        d.segments
          .filter(s => top5Names.has(s.name))
          .reduce((sum, s) => sum + s.amount, 0)
      ),
      1
    )
  }, [data, top5Names])

  const formatChartAmount = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`

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
                searchable
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
          <p className="text-center text-gray-500">
            Selecciona un rango de fechas para ver los reportes
          </p>
        )}

        {dateRange && loading && (
          <p className="text-center text-gray-500">Cargando...</p>
        )}
        {dateRange && !loading && data.length === 0 && (
          <p className="text-center text-gray-500">
            No hay datos para mostrar en el rango de fechas seleccionado
          </p>
        )}
      </div>

      {/* Gráfica de barras: Top 5 costos */}
      {data.length > 0 && top5.length > 0 && (
        <div className="mt-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Top 5 Costos por Mes</h2>
          <p className="mb-6 text-sm text-gray-500">
            Los 5 conceptos con mayor costo en el período seleccionado
          </p>
          <div className="flex gap-4">
            {/* Eje Y */}
            <div
              className="flex flex-col justify-between text-right shrink-0"
              style={{ height: '200px' }}
            >
              {[1, 0.75, 0.5, 0.25, 0].map((pct) => (
                <span key={pct} className="text-xs text-gray-400 leading-none">
                  {formatChartAmount(maxChartTotal * pct)}
                </span>
              ))}
            </div>
            {/* Barras + etiquetas de mes */}
            <div className="flex-1">
              {/* Área de barras */}
              <div
                className="flex items-end gap-2 border-b border-l border-gray-200"
                style={{ height: '200px' }}
              >
                {data.map((monthData) => {
                  const segs = top5.map((t) => ({
                    name: t.name,
                    color: t.color,
                    amount: monthData.segments.find((s) => s.name === t.name)?.amount || 0,
                  }))
                  const monthSum = segs.reduce((s, x) => s + x.amount, 0)
                  const barH = Math.round((monthSum / maxChartTotal) * 200)
                  return (
                    <div
                      key={monthData.month}
                      className="flex-1 flex items-end justify-center"
                    >
                      <div
                        className="overflow-hidden rounded-t-sm"
                        style={{ height: `${barH}px`, width: '32px' }}
                      >
                        {segs
                          .filter((s) => s.amount > 0)
                          .map((seg) => (
                            <div
                              key={seg.name}
                              title={`${seg.name}: ${formatChartAmount(seg.amount)}`}
                              style={{
                                height: `${Math.round((seg.amount / monthSum) * barH)}px`,
                                backgroundColor: seg.color,
                              }}
                            />
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Etiquetas de mes — fuera del área con borde */}
              <div className="flex gap-2 mt-2">
                {data.map((monthData) => (
                  <div key={monthData.month} className="flex-1 text-center">
                    <span className="text-xs text-gray-500">
                      {formatMonth(monthData.month)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Leyenda */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {top5.map((seg) => (
              <div key={seg.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-xs text-gray-600">{seg.name}</span>
                <span className="text-xs text-gray-400">{formatChartAmount(seg.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <th
                      key={monthData.month}
                      className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap"
                    >
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
                        const segment = monthData.segments.find(
                          (s) => s.name === clientName
                        )
                        const amount = segment ? segment.amount : 0
                        rowTotal += amount
                        const cellContent =
                          segment && amount > 0
                            ? `$${amount.toFixed(2)}`
                            : activeTab === 'aws'
                              ? ''
                              : '-'
                        return (
                          <td
                            key={monthData.month}
                            className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 text-right"
                          >
                            {cellContent}
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
                    <td
                      key={monthData.month}
                      className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900 text-right"
                    >
                      ${monthData.total.toFixed(2)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                    $
                    {data
                      .reduce((sum, m) => sum + m.total, 0)
                      .toFixed(2)}
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
