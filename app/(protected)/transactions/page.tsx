'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  name: string
}

interface Transaction {
  id: string
  month: string
  quantity: number
  cost_per_transaction: number
  total_cost: number
  description: string
}

interface TransactionAssignment {
  transaction_id: string
  client_id: string
  assigned_cost: number
}

export default function TransactionsPage() {
  const [month, setMonth] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costPerTransaction, setCostPerTransaction] = useState('')
  const [description, setDescription] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadClients()
    loadTransactions()
  }, [])

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })
    setClients(data || [])
  }

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('month', { ascending: false })
    setTransactions(data || [])
  }

  const toggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients)
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId)
    } else {
      newSelected.add(clientId)
    }
    setSelectedClients(newSelected)
  }

  const handleCreateTransaction = async () => {
    if (!month || !quantity || !costPerTransaction) {
      alert('Completa todos los campos requeridos')
      return
    }

    if (selectedClients.size === 0) {
      alert('Selecciona al menos un cliente')
      return
    }

    setLoading(true)

    try {
      const { data: user } = await supabase.auth.getUser()
      const qty = parseInt(quantity)
      const cost = parseFloat(costPerTransaction)
      const total = qty * cost
      const monthDate = new Date(month + '-01')

      // Crear la transacción
      const { data: transaction, error: transError } = await supabase
        .from('transactions')
        .insert({
          month: monthDate.toISOString().split('T')[0],
          quantity: qty,
          cost_per_transaction: cost,
          total_cost: total,
          description: description || null,
          created_by: user?.user?.id,
        })
        .select()
        .single()

      if (transError) throw transError

      // Distribuir el costo entre los clientes seleccionados
      const costPerClient = total / selectedClients.size

      const assignments = Array.from(selectedClients).map(clientId => ({
        transaction_id: transaction.id,
        client_id: clientId,
        assigned_cost: costPerClient,
      }))

      const { error: assignError } = await supabase
        .from('transaction_assignments')
        .insert(assignments)

      if (assignError) throw assignError

      alert('Transacción creada exitosamente')
      setMonth('')
      setQuantity('')
      setCostPerTransaction('')
      setDescription('')
      setSelectedClients(new Set())
      loadTransactions()
    } catch (error: any) {
      alert('Error al crear la transacción: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Transacciones</h1>
      </div>

      {/* Formulario de creación */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Crear Transacción</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mes *
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cantidad de Transacciones *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Costo por Transacción *
            </label>
            <input
              type="number"
              step="0.01"
              value={costPerTransaction}
              onChange={(e) => setCostPerTransaction(e.target.value)}
              min="0"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Costo Total
            </label>
            <input
              type="text"
              value={
                quantity && costPerTransaction
                  ? `$${(parseFloat(quantity) * parseFloat(costPerTransaction)).toFixed(2)}`
                  : '$0.00'
              }
              disabled
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Selección de clientes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Asignar a Clientes *
          </label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {clients.map((client) => (
              <label
                key={client.id}
                className="flex items-center gap-2 rounded border p-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedClients.has(client.id)}
                  onChange={() => toggleClient(client.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{client.name}</span>
              </label>
            ))}
          </div>
          {selectedClients.size > 0 && quantity && costPerTransaction && (
            <p className="mt-2 text-sm text-gray-600">
              Costo por cliente: ${(
                (parseFloat(quantity) * parseFloat(costPerTransaction)) /
                selectedClients.size
              ).toFixed(2)}
            </p>
          )}
        </div>

        <button
          onClick={handleCreateTransaction}
          disabled={loading || !month || !quantity || !costPerTransaction || selectedClients.size === 0}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear Transacción'}
        </button>
      </div>

      {/* Lista de transacciones */}
      <div className="rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Mes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Costo/Transacción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Descripción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {new Date(transaction.month).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {transaction.quantity}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      ${transaction.cost_per_transaction.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      ${transaction.total_cost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {transaction.description || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay transacciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

