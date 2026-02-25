'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { TransactionsRepository } from '@/lib/repositories'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Transaction } from '@/types'
import {
  PageHeader,
  Input,
  Button,
  ErrorMessage,
  Table,
} from '@/components/ui'

export default function TransactionsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const transactionsRepo = useMemo(() => new TransactionsRepository(supabase), [supabase])
  
  const [month, setMonth] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costPerTransaction, setCostPerTransaction] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMonth, setEditingMonth] = useState('')
  const [editingQuantity, setEditingQuantity] = useState('')
  const [editingCost, setEditingCost] = useState('')

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      const data = await transactionsRepo.getAll()
      setTransactions(data)
    } catch (err: any) {
      setError(err.message || t('transactions.loadError'))
    }
  }

  const handleCreateTransaction = async () => {
    setError(null)

    if (!month || !quantity || !costPerTransaction) {
      setError('Por favor completa todos los campos')
      return
    }

    const qty = parseInt(quantity)
    const cost = parseFloat(costPerTransaction)

    if (isNaN(qty) || qty <= 0) {
      setError('La cantidad debe ser un número válido mayor a 0')
      return
    }

    if (isNaN(cost) || cost <= 0) {
      setError('El precio por transacción debe ser un número válido mayor a 0')
      return
    }

    setLoading(true)

    try {
      const monthDate = new Date(month + '-01')
      
      // Crear transacción sin asignaciones de clientes (versión simplificada)
      await transactionsRepo.create({
        month: monthDate.toISOString().split('T')[0],
        quantity: qty,
        costPerTransaction: cost,
        description: null,
        clientIds: [], // Sin clientes en la versión simplificada
      })

      toast.success('Transacción creada exitosamente')
      setMonth('')
      setQuantity('')
      setCostPerTransaction('')
      await loadTransactions()
    } catch (err: any) {
      setError(err.message || 'Error al crear la transacción')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id)
    const monthValue = transaction.month.substring(0, 7) // YYYY-MM
    setEditingMonth(monthValue)
    setEditingQuantity(transaction.quantity.toString())
    setEditingCost(transaction.cost_per_transaction.toFixed(2))
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingMonth('')
    setEditingQuantity('')
    setEditingCost('')
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingMonth || !editingQuantity || !editingCost) {
      setError('Por favor completa todos los campos')
      return
    }

    const qty = parseInt(editingQuantity)
    const cost = parseFloat(editingCost)

    if (isNaN(qty) || qty <= 0) {
      setError('La cantidad debe ser un número válido mayor a 0')
      return
    }

    if (isNaN(cost) || cost <= 0) {
      setError('El precio por transacción debe ser un número válido mayor a 0')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const monthDate = new Date(editingMonth + '-01')
      
      await transactionsRepo.update(editingId, {
        month: monthDate.toISOString().split('T')[0],
        quantity: qty,
        costPerTransaction: cost,
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

  const totalCost = quantity && costPerTransaction
    ? parseFloat(quantity) * parseFloat(costPerTransaction)
    : 0

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
      header: 'Month',
      render: (transaction: Transaction) => {
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
      key: 'quantity',
      header: '# of Transactions',
      render: (transaction: Transaction) => {
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
      header: 'Price per Transaction',
      render: (transaction: Transaction) => {
        if (editingId === transaction.id) {
          return (
            <input
              type="number"
              step="0.01"
              value={editingCost}
              onChange={(e) => setEditingCost(e.target.value)}
              min="0"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          )
        }
        return `$${transaction.cost_per_transaction.toFixed(2)}`
      },
    },
    {
      key: 'total_cost',
      header: 'Total',
      className: 'font-medium text-gray-900',
      render: (transaction: Transaction) => {
        if (editingId === transaction.id) {
          const editTotal = parseFloat(editingQuantity) * parseFloat(editingCost)
          return isNaN(editTotal) ? '$0.00' : `$${editTotal.toFixed(2)}`
        }
        return `$${transaction.total_cost.toFixed(2)}`
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (transaction: Transaction) => {
        if (editingId === transaction.id) {
          return (
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                title="Guardar"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
                title="Cancelar"
              >
                ×
              </button>
            </div>
          )
        }
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(transaction)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
              title="Editar"
            >
              ✎
            </button>
            <button
              onClick={() => handleDelete(transaction.id)}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              title="Eliminar"
            >
              🗑
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader title="Monthly Transaction Costs" />

      <ErrorMessage message={error || ''} className="mb-4" />

      {/* Formulario horizontal */}
      <div className="mb-8 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="">Select Month</option>
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
              # of Transactions
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
              Price per Transaction
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                type="number"
                step="0.01"
                value={costPerTransaction}
                onChange={(e) => setCostPerTransaction(e.target.value)}
                min="0"
                className="w-full pl-7"
              />
            </div>
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
              onClick={handleCreateTransaction}
              disabled={
                loading ||
                !month ||
                !quantity ||
                !costPerTransaction
              }
              isLoading={loading}
              variant="success"
              className="whitespace-nowrap"
            >
              {loading ? 'Adding...' : 'Add Record'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla de historial */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">Transaction History</h2>
        <Table
          columns={columns}
          data={transactions}
          loading={false}
          emptyMessage="No hay transacciones registradas"
          keyExtractor={(transaction) => transaction.id}
        />
      </div>
    </div>
  )
}
