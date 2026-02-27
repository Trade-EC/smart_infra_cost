'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { TransactionsRepository, ClientsRepository, TransactionPriceConfigsRepository } from '@/lib/repositories'
import type { TransactionWithClients } from '@/lib/repositories/transactionsRepository'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Client, TransactionPriceConfig } from '@/types'
import {
  PageHeader,
  Input,
  Button,
  ErrorMessage,
  Table,
  DateRangePicker,
} from '@/components/ui'

export default function TransactionsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const transactionsRepo = useMemo(() => new TransactionsRepository(supabase), [supabase])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const priceConfigsRepo = useMemo(() => new TransactionPriceConfigsRepository(supabase), [supabase])
  
  const [activeTab, setActiveTab] = useState<'transactions' | 'prices'>('transactions')
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [month, setMonth] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [transactions, setTransactions] = useState<TransactionWithClients[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [priceRows, setPriceRows] = useState<
    Array<{
      clientId: string
      ranges: Array<{ id?: string; maxTransactions: string; price: string }>
    }>
  >([])
  const [editingPriceRows, setEditingPriceRows] = useState<Set<number>>(new Set())
  const [priceConfigsLoading, setPriceConfigsLoading] = useState(false)
  const [priceConfigsSaving, setPriceConfigsSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMonth, setEditingMonth] = useState('')
  const [editingQuantity, setEditingQuantity] = useState('')
  const [editingClientId, setEditingClientId] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
    loadPriceConfigs()
  }, [])

  useEffect(() => {
    if (dateRange && dateRange.start && dateRange.end) {
      loadTransactions()
    } else {
      setTransactions([])
    }
  }, [dateRange])

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const loadPriceConfigs = async () => {
    try {
      setPriceConfigsLoading(true)
      const data = await priceConfigsRepo.getAll()
      
      // Agrupar por client_id
      const groupedByClient = data.reduce((acc, config) => {
        const clientId = config.client_id
        if (!acc[clientId]) {
          acc[clientId] = []
        }
        acc[clientId].push({
          id: config.id,
          maxTransactions: config.max_transactions !== null ? String(config.max_transactions) : '',
          price: config.price_per_transaction.toFixed(4),
        })
        return acc
      }, {} as Record<string, Array<{ id?: string; maxTransactions: string; price: string }>>)

      // Convertir a array de filas, asegurando que cada fila tenga exactamente 3 rangos
      const rows = Object.entries(groupedByClient).map(([clientId, ranges]) => {
        // Ordenar por maxTransactions ascendente
        const sortedRanges = ranges.sort((a, b) => {
          const aMax = parseInt(a.maxTransactions || '0', 10)
          const bMax = parseInt(b.maxTransactions || '0', 10)
          return aMax - bMax
        })
        
        // Asegurar que siempre hay 3 rangos (rellenar con vacíos si faltan)
        while (sortedRanges.length < 3) {
          sortedRanges.push({ maxTransactions: '', price: '' })
        }
        
        return {
          clientId,
          ranges: sortedRanges.slice(0, 3), // Solo tomar los primeros 3
        }
      })

      setPriceRows(rows)
    } catch (err: any) {
      console.error('Error loading transaction price configs:', err)
    } finally {
      setPriceConfigsLoading(false)
    }
  }

  const loadTransactions = async () => {
    if (!dateRange || !dateRange.start || !dateRange.end) {
      setTransactions([])
      return
    }

    try {
      setLoading(true)
      const data = await transactionsRepo.getByDateRange(dateRange.start, dateRange.end)
      setTransactions(data)
    } catch (err: any) {
      setError(err.message || t('transactions.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTransaction = async () => {
    setError(null)

    if (!month || !selectedClientId || !quantity) {
      setError('Por favor completa todos los campos')
      return
    }

    const qty = parseInt(quantity)

    if (isNaN(qty) || qty <= 0) {
      setError('La cantidad debe ser un número válido mayor a 0')
      return
    }

    // Calcular el precio automáticamente según los rangos configurados
    const autoPrice = getAutoPriceForQuantity(selectedClientId, qty)
    if (autoPrice === null) {
      setError('No hay configuración de precios para este cliente. Por favor configura los precios en la pestaña "Precios" primero.')
      return
    }

    setLoading(true)

    try {
      const monthDate = new Date(month + '-01')
      
      await transactionsRepo.create({
        month: monthDate.toISOString().split('T')[0],
        quantity: qty,
        costPerTransaction: autoPrice,
        description: null,
        clientIds: [selectedClientId],
      })

      toast.success('Transacción creada exitosamente')
      setMonth('')
      setSelectedClientId('')
      setQuantity('')
      await loadTransactions()
    } catch (err: any) {
      setError(err.message || 'Error al crear la transacción')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (transaction: TransactionWithClients) => {
    setEditingId(transaction.id)
    const monthValue = transaction.month.substring(0, 7) // YYYY-MM
    setEditingMonth(monthValue)
    setEditingQuantity(transaction.quantity.toString())
    const clientId = transaction.clients?.[0]?.id || null
    setEditingClientId(clientId)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingMonth('')
    setEditingQuantity('')
    setEditingClientId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingMonth || !editingQuantity || !editingClientId) {
      setError('Por favor completa todos los campos')
      return
    }

    const qty = parseInt(editingQuantity)

    if (isNaN(qty) || qty <= 0) {
      setError('La cantidad debe ser un número válido mayor a 0')
      return
    }

    // Calcular el precio automáticamente según los rangos configurados
    const autoPrice = getAutoPriceForQuantity(editingClientId, qty)
    if (autoPrice === null) {
      setError('No hay configuración de precios para este cliente. Por favor configura los precios en la pestaña "Precios" primero.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const monthDate = new Date(editingMonth + '-01')
      
      await transactionsRepo.update(editingId, {
        month: monthDate.toISOString().split('T')[0],
        quantity: qty,
        costPerTransaction: autoPrice,
      })

      toast.success('Transacción actualizada exitosamente')
      handleCancelEdit()
      await loadTransactions()
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la transacción')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta transacción? Esta acción no se puede deshacer.')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await transactionsRepo.delete(id)
      toast.success('Transacción eliminada exitosamente')
      await loadTransactions()
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la transacción')
    } finally {
      setLoading(false)
    }
  }

  const getAutoPriceForQuantity = (clientId: string | null, qty: number): number | null => {
    if (!qty || isNaN(qty) || qty <= 0) return null
    if (!clientId) return null

    // Buscar la fila del cliente
    const clientRow = priceRows.find((row) => row.clientId === clientId)
    if (!clientRow) return null

    // Obtener todos los rangos válidos (con maxTransactions y price)
    const validRanges = clientRow.ranges
      .map((range) => ({
        max: parseInt(range.maxTransactions || '0', 10),
        price: parseFloat(range.price || '0'),
      }))
      .filter((r) => !isNaN(r.max) && r.max > 0 && !isNaN(r.price) && r.price >= 0)
      .sort((a, b) => a.max - b.max)

    if (validRanges.length === 0) return null

    // Si está por debajo del primer tramo, usar el primer precio
    if (qty <= validRanges[0].max) {
      return validRanges[0].price
    }

    // Buscar el tramo donde cae qty y hacer interpolación lineal como en tu fórmula de Sheets
    for (let i = 1; i < validRanges.length; i++) {
      const prev = validRanges[i - 1]
      const curr = validRanges[i]

      if (qty <= curr.max) {
        const rangeSize = curr.max - prev.max
        if (rangeSize <= 0) {
          return curr.price
        }

        const progress = (qty - prev.max) / rangeSize
        return prev.price + progress * (curr.price - prev.price)
      }
    }

    // Si la cantidad supera todos los rangos, usamos el último precio
    return validRanges[validRanges.length - 1].price
  }

  const calculatedPrice = selectedClientId && quantity
    ? getAutoPriceForQuantity(selectedClientId, parseInt(quantity, 10))
    : null

  const totalCost = calculatedPrice !== null && quantity
    ? parseInt(quantity, 10) * calculatedPrice
    : 0

  const handleAddPriceRow = () => {
    setPriceRows((prev) => [
      ...prev,
      {
        clientId: '',
        ranges: [
          { maxTransactions: '', price: '' },
          { maxTransactions: '', price: '' },
          { maxTransactions: '', price: '' },
        ],
      },
    ])
  }

  const handleRemovePriceRow = async (index: number) => {
    const row = priceRows[index]
    try {
      setPriceConfigsSaving(true)
      setError(null)
      
      // Eliminar todos los rangos guardados de este cliente
      for (const range of row.ranges) {
        if (range.id) {
          await priceConfigsRepo.delete(range.id)
        }
      }
      
      setPriceRows((prev) => prev.filter((_, i) => i !== index))
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la configuración de precios')
    } finally {
      setPriceConfigsSaving(false)
    }
  }

  const handleChangePriceRow = (
    rowIndex: number,
    rangeIndex: number,
    field: 'maxTransactions' | 'price',
    value: string
  ) => {
    setPriceRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              ranges: row.ranges.map((range, rIdx) =>
                rIdx === rangeIndex ? { ...range, [field]: value } : range
              ),
            }
          : row
      )
    )
  }

  const handleChangeClientId = (rowIndex: number, clientId: string) => {
    setPriceRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, clientId } : row))
    )
  }

  const handleSavePriceRow = async (index: number) => {
    const row = priceRows[index]
    if (!row) return

    if (!row.clientId) {
      setError('Selecciona un cliente para la configuración de precios')
      return
    }

    // Validar que al menos un rango tenga datos
    const hasValidRange = row.ranges.some(
      (range) =>
        range.maxTransactions.trim() !== '' &&
        range.price.trim() !== '' &&
        !isNaN(parseInt(range.maxTransactions, 10)) &&
        !isNaN(parseFloat(range.price))
    )

    if (!hasValidRange) {
      setError('Debes configurar al menos un rango con cantidad y precio válidos')
      return
    }

    try {
      setPriceConfigsSaving(true)
      setError(null)

      // Guardar/actualizar cada rango que tenga datos
      const updatedRanges: Array<{ id?: string; maxTransactions: string; price: string }> = []
      for (const range of row.ranges) {
        const max = range.maxTransactions.trim() === '' ? null : parseInt(range.maxTransactions, 10)
        const price = parseFloat(range.price || '0')

        // Solo guardar si tiene datos válidos
        if (max !== null && !isNaN(max) && max > 0 && !isNaN(price) && price >= 0) {
          if (range.id) {
            // Actualizar existente
            const updated = await priceConfigsRepo.update(range.id, {
              clientId: row.clientId,
              maxTransactions: max,
              pricePerTransaction: price,
            })
            updatedRanges.push({
              id: updated.id,
              maxTransactions: updated.max_transactions !== null ? String(updated.max_transactions) : '',
              price: updated.price_per_transaction.toFixed(4),
            })
          } else {
            // Crear nuevo
            const created = await priceConfigsRepo.create({
              clientId: row.clientId,
              maxTransactions: max,
              pricePerTransaction: price,
            })
            updatedRanges.push({
              id: created.id,
              maxTransactions: created.max_transactions !== null ? String(created.max_transactions) : '',
              price: created.price_per_transaction.toFixed(4),
            })
          }
        } else if (range.id) {
          // Si tenía ID pero ahora está vacío, eliminar
          await priceConfigsRepo.delete(range.id)
          updatedRanges.push({ maxTransactions: '', price: '' })
        } else {
          // Mantener vacío
          updatedRanges.push({ maxTransactions: '', price: '' })
        }
      }

      // Asegurar que siempre hay 3 rangos
      while (updatedRanges.length < 3) {
        updatedRanges.push({ maxTransactions: '', price: '' })
      }

      setPriceRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                ranges: updatedRanges.slice(0, 3),
              }
            : r
        )
      )

      // Quitar del modo edición después de guardar
      setEditingPriceRows((prev) => {
        const newSet = new Set(prev)
        newSet.delete(index)
        return newSet
      })

      toast.success('Configuración de precios guardada exitosamente')
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración de precios')
    } finally {
      setPriceConfigsSaving(false)
    }
  }

  // Meses en español
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr)
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`
  }

  const columns = [
    {
      key: 'month',
      header: 'Mes',
      render: (transaction: TransactionWithClients) => {
        if (editingId === transaction.id) {
          return (
            <input
              type="month"
              value={editingMonth}
              onChange={(e) => setEditingMonth(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          )
        }
        return formatMonth(transaction.month)
      },
    },
    {
      key: 'client',
      header: 'Cliente',
      render: (transaction: TransactionWithClients) => {
        if (editingId === transaction.id) {
          // Durante la edición, mostrar el cliente actual si existe
          const currentClient = transaction.clients?.[0]
          return currentClient ? currentClient.name : 'Sin cliente'
        }
        if (transaction.clients && transaction.clients.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {transaction.clients.map((client) => (
                <span
                  key={client.id}
                  className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                >
                  {client.name}
                </span>
              ))}
            </div>
          )
        }
        return <span className="text-gray-400">Sin cliente asignado</span>
      },
    },
    {
      key: 'quantity',
      header: 'Cantidad de Transacciones',
      render: (transaction: TransactionWithClients) => {
        if (editingId === transaction.id) {
          return (
            <input
              type="number"
              value={editingQuantity}
              onChange={(e) => setEditingQuantity(e.target.value)}
              min="1"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          )
        }
        return transaction.quantity
      },
    },
    {
      key: 'cost_per_transaction',
      header: 'Precio',
      render: (transaction: TransactionWithClients) => {
        if (editingId === transaction.id) {
          const editQty = parseInt(editingQuantity || '0', 10)
          const editPrice = editingClientId && editQty > 0
            ? getAutoPriceForQuantity(editingClientId, editQty)
            : null
          return editPrice !== null
            ? `$${editPrice.toFixed(4)}`
            : '-'
        }
        return `$${transaction.cost_per_transaction.toFixed(4)}`
      },
    },
    {
      key: 'total_cost',
      header: 'Total',
      className: 'font-medium text-gray-900',
      render: (transaction: TransactionWithClients) => {
        if (editingId === transaction.id) {
          const editQty = parseInt(editingQuantity || '0', 10)
          const editPrice = editingClientId && editQty > 0
            ? getAutoPriceForQuantity(editingClientId, editQty)
            : null
          const editTotal = editPrice !== null ? editQty * editPrice : 0
          return `$${editTotal.toFixed(2)}`
        }
        return `$${transaction.total_cost.toFixed(2)}`
      },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (transaction: TransactionWithClients) => {
        if (editingId === transaction.id) {
          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveEdit}
                disabled={loading}
                className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300 disabled:opacity-50"
              >
                {loading ? t('common.saving') : t('common.save')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={loading}
                className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-100 hover:border-gray-300 disabled:opacity-50"
              >
                {t('common.cancel')}
              </Button>
            </div>
          )
        }
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(transaction)}
              className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
            >
              {t('common.edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(transaction.id)}
              className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-700 hover:bg-red-100 hover:border-red-300"
            >
              {t('common.delete')}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader title="Transacciones Mensuales" />

      <ErrorMessage message={error || ''} className="mb-4" />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`border-b-2 py-2 px-1 text-sm font-medium ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Transacciones
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`border-b-2 py-2 px-1 text-sm font-medium ${
              activeTab === 'prices'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Precios
          </button>
        </nav>
      </div>

      {activeTab === 'transactions' && (
        <>
          {/* Filtro de rango de fechas */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Fechas
            </label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          {/* Formulario horizontal */}
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-sm font-medium text-gray-700">
              Nueva transacción mensual
            </h3>

            <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mes
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="">Seleccionar Mes</option>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date()
                date.setMonth(date.getMonth() - i)
                const year = date.getFullYear()
                const monthNum = String(date.getMonth() + 1).padStart(2, '0')
                const monthValue = `${year}-${monthNum}`
                return (
                  <option key={monthValue} value={monthValue}>
                    {monthNames[date.getMonth()]} {year}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="">Seleccionar Cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              # de Transacciones
            </label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="w-full"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio por Transacción
            </label>
            <Input
              type="text"
              value={calculatedPrice !== null ? `$${calculatedPrice.toFixed(4)}` : '-'}
              disabled
              className="w-full bg-gray-50"
            />
            {calculatedPrice === null && selectedClientId && quantity && (
              <p className="mt-1 text-xs text-red-600">
                No hay configuración de precios para este cliente
              </p>
            )}
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total
            </label>
            <Input
              type="text"
              value={`$${totalCost.toFixed(2)}`}
              disabled
              className="w-full bg-gray-50"
            />
          </div>

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateTransaction}
              disabled={
                loading ||
                !month ||
                !selectedClientId ||
                !quantity ||
                calculatedPrice === null
              }
              className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
          </div>
        </div>

        {/* Tabla de historial */}
        {dateRange && dateRange.start && dateRange.end ? (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">Historial de transacciones</h2>
            <Table
              columns={columns}
              data={transactions}
              loading={loading}
              emptyMessage="No hay transacciones registradas en el rango seleccionado"
              keyExtractor={(transaction) => transaction.id}
            />
          </div>
        ) : (
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Selecciona un rango de fechas para ver las transacciones
            </p>
          </div>
        )}
        </>
      )}

      {activeTab === 'prices' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Precios por cliente</h2>
          <p className="mb-4 text-sm text-gray-600">
            Configura reglas de precio por rango de transacciones para cada cliente. Puedes agregar
            solo los clientes y rangos que necesites.
          </p>

          <div className="space-y-3">
            {priceRows.map((row, rowIndex) => {
              const hasSavedData = row.ranges.some((range) => range.id)
              const isEditing = editingPriceRows.has(rowIndex)
              const isDisabled = hasSavedData && !isEditing

              return (
                <div
                  key={row.clientId || rowIndex}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-3"
                >
                  <div className="w-[160px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Cliente
                    </label>
                    <select
                      value={row.clientId}
                      onChange={(e) => handleChangeClientId(rowIndex, e.target.value)}
                      disabled={isDisabled}
                      className={`w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 ${
                        isDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">Seleccionar cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rango 1 */}
                  <div className="w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Hasta 1
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={row.ranges[0]?.maxTransactions || ''}
                      onChange={(e) =>
                        handleChangePriceRow(rowIndex, 0, 'maxTransactions', e.target.value)
                      }
                      disabled={isDisabled}
                      className={`w-full text-sm ${isDisabled ? 'bg-gray-50' : ''}`}
                      placeholder="Ej: 5000"
                    />
                  </div>
                  <div className="w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Precio 1
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={row.ranges[0]?.price || ''}
                        onChange={(e) =>
                          handleChangePriceRow(rowIndex, 0, 'price', e.target.value)
                        }
                        disabled={isDisabled}
                        className={`w-full pl-5 text-sm ${isDisabled ? 'bg-gray-50' : ''}`}
                        placeholder="0.20"
                      />
                    </div>
                  </div>

                  {/* Rango 2 */}
                  <div className="w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Hasta 2
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={row.ranges[1]?.maxTransactions || ''}
                      onChange={(e) =>
                        handleChangePriceRow(rowIndex, 1, 'maxTransactions', e.target.value)
                      }
                      disabled={isDisabled}
                      className={`w-full text-sm ${isDisabled ? 'bg-gray-50' : ''}`}
                      placeholder="Ej: 50000"
                    />
                  </div>
                  <div className="w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Precio 2
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={row.ranges[1]?.price || ''}
                        onChange={(e) =>
                          handleChangePriceRow(rowIndex, 1, 'price', e.target.value)
                        }
                        disabled={isDisabled}
                        className={`w-full pl-5 text-sm ${isDisabled ? 'bg-gray-50' : ''}`}
                        placeholder="0.15"
                      />
                    </div>
                  </div>

                  {/* Rango 3 */}
                  <div className="w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Hasta 3
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={row.ranges[2]?.maxTransactions || ''}
                      onChange={(e) =>
                        handleChangePriceRow(rowIndex, 2, 'maxTransactions', e.target.value)
                      }
                      disabled={isDisabled}
                      className={`w-full text-sm ${isDisabled ? 'bg-gray-50' : ''}`}
                      placeholder="Ej: 150000"
                    />
                  </div>
                  <div className="w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Precio 3
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={row.ranges[2]?.price || ''}
                        onChange={(e) =>
                          handleChangePriceRow(rowIndex, 2, 'price', e.target.value)
                        }
                        disabled={isDisabled}
                        className={`w-full pl-5 text-sm ${isDisabled ? 'bg-gray-50' : ''}`}
                        placeholder="0.10"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(() => {
                      if (hasSavedData && !isEditing) {
                        // Mostrar botón "Editar" cuando hay datos guardados y no está en edición
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPriceRows((prev) => new Set(prev).add(rowIndex))
                            }}
                            className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                          >
                            {t('common.edit')}
                          </Button>
                        )
                      } else {
                        // Mostrar botón "Guardar" cuando no hay datos o está en edición
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSavePriceRow(rowIndex)}
                            disabled={priceConfigsSaving}
                            className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300 disabled:opacity-50"
                          >
                            {priceConfigsSaving ? t('common.saving') : t('common.save')}
                          </Button>
                        )
                      }
                    })()}
                    <button
                      type="button"
                      onClick={() => handleRemovePriceRow(rowIndex)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                      title={t('common.delete')}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}

            {priceRows.length === 0 && (
              <p className="text-sm text-gray-500">
                Aún no hay reglas de precios. Agrega una para comenzar.
              </p>
            )}

            <button
              type="button"
              onClick={handleAddPriceRow}
              className="flex items-center gap-2 rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <span>+</span>
              Agregar regla de precio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
