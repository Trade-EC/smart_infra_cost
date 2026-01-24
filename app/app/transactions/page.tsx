'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  ClientsRepository,
  TransactionsRepository,
} from '@/lib/repositories'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Transaction } from '@/types'
import {
  PageHeader,
  Card,
  Input,
  Button,
  ErrorMessage,
  Table,
} from '@/components/ui'

export default function TransactionsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const transactionsRepo = useMemo(() => new TransactionsRepository(supabase), [supabase])
  
  const [month, setMonth] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costPerTransaction, setCostPerTransaction] = useState('')
  const [description, setDescription] = useState('')
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
    loadTransactions()
  }, [])

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const loadTransactions = async () => {
    try {
      const data = await transactionsRepo.getAll()
      setTransactions(data)
    } catch (err: any) {
      setError(err.message || t('transactions.loadError'))
    }
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
    setError(null)

    if (!month || !quantity || !costPerTransaction) {
      setError(t('transactions.completeFields'))
      return
    }

    if (selectedClients.size === 0) {
      setError(t('transactions.selectClient'))
      return
    }

    setLoading(true)

    try {
      const monthDate = new Date(month + '-01')
      const qty = parseInt(quantity)
      const cost = parseFloat(costPerTransaction)

      await transactionsRepo.create({
        month: monthDate.toISOString().split('T')[0],
        quantity: qty,
        costPerTransaction: cost,
        description: description || null,
        clientIds: Array.from(selectedClients),
      })

      toast.success(t('transactions.createSuccess'))
      setMonth('')
      setQuantity('')
      setCostPerTransaction('')
      setDescription('')
      setSelectedClients(new Set())
      await loadTransactions()
    } catch (err: any) {
      setError(err.message || t('transactions.createError'))
    } finally {
      setLoading(false)
    }
  }

  const totalCost = quantity && costPerTransaction
    ? parseFloat(quantity) * parseFloat(costPerTransaction)
    : 0

  const costPerClient =
    selectedClients.size > 0 && totalCost > 0
      ? totalCost / selectedClients.size
      : 0

  const columns = [
    {
      key: 'month',
      header: t('common.month'),
      render: (transaction: Transaction) =>
        new Date(transaction.month).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
        }),
    },
    {
      key: 'quantity',
      header: t('transactions.quantity'),
    },
    {
      key: 'cost_per_transaction',
      header: t('transactions.costPerTransaction'),
      render: (transaction: Transaction) =>
        `$${transaction.cost_per_transaction.toFixed(2)}`,
    },
    {
      key: 'total_cost',
      header: t('common.total'),
      className: 'font-medium text-gray-900',
      render: (transaction: Transaction) =>
        `$${transaction.total_cost.toFixed(2)}`,
    },
    {
      key: 'description',
      header: t('common.description'),
      render: (transaction: Transaction) => transaction.description || '-',
    },
  ]

  return (
    <div>
      <PageHeader title={t('transactions.title')} />

      <ErrorMessage message={error || ''} className="mb-4" />

      <Card title={t('transactions.create')} className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label={t('common.month')}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
          />
          <Input
            label={t('transactions.quantity')}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            required
          />
          <Input
            label={t('transactions.costPerTransaction')}
            type="number"
            step="0.01"
            value={costPerTransaction}
            onChange={(e) => setCostPerTransaction(e.target.value)}
            min="0"
            required
          />
          <Input
            label={t('transactions.totalCost')}
            type="text"
            value={`$${totalCost.toFixed(2)}`}
            disabled
            className="bg-gray-50"
          />
          <div className="md:col-span-2">
            <Input
              label={t('common.description')}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('transactions.assignToClients')}
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
              {t('transactions.costPerClient')}: ${costPerClient.toFixed(2)}
            </p>
          )}
        </div>

        <Button
          onClick={handleCreateTransaction}
          disabled={
            loading ||
            !month ||
            !quantity ||
            !costPerTransaction ||
            selectedClients.size === 0
          }
          isLoading={loading}
          className="mt-4"
        >
          {loading ? t('common.creating') : t('transactions.create')}
        </Button>
      </Card>

      <Table
        columns={columns}
        data={transactions}
        loading={false}
        emptyMessage={t('transactions.noTransactions')}
        keyExtractor={(transaction) => transaction.id}
      />
    </div>
  )
}
