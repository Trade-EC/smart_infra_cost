import { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction, CreateTransactionData, Client } from '@/types'

export interface TransactionWithClients extends Transaction {
  clients?: Client[]
}

export class TransactionsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getAll(): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .order('month', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getByDateRange(
    dateFrom: string,
    dateTo: string
  ): Promise<TransactionWithClients[]> {
    const { data: transactions, error } = await this.supabase
      .from('transactions')
      .select('*')
      .gte('month', dateFrom)
      .lte('month', dateTo)
      .order('month', { ascending: false })

    if (error) throw error
    if (!transactions || transactions.length === 0) return []

    // Obtener los clientes asociados a cada transacción
    const transactionIds = transactions.map(t => t.id)
    const { data: assignments, error: assignError } = await this.supabase
      .from('transaction_assignments')
      .select('transaction_id, client_id, clients(id, name)')
      .in('transaction_id', transactionIds)

    if (assignError) throw assignError

    // Agrupar clientes por transacción
    const clientsByTransaction = new Map<string, Client[]>()
    if (assignments) {
      assignments.forEach((assignment: any) => {
        if (assignment.clients) {
          const existing = clientsByTransaction.get(assignment.transaction_id) || []
          clientsByTransaction.set(assignment.transaction_id, [...existing, assignment.clients])
        }
      })
    }

    // Combinar transacciones con sus clientes
    return transactions.map((transaction: Transaction) => ({
      ...transaction,
      clients: clientsByTransaction.get(transaction.id) || [],
    }))
  }

  async getById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  }

  async create(data: CreateTransactionData): Promise<Transaction> {
    const { data: user } = await this.supabase.auth.getUser()
    const total = data.quantity * data.costPerTransaction

    // Create transaction
    const { data: transaction, error: transError } = await this.supabase
      .from('transactions')
      .insert({
        month: data.month,
        quantity: data.quantity,
        cost_per_transaction: data.costPerTransaction,
        total_cost: total,
        description: data.description || null,
        created_by: user?.user?.id,
      })
      .select()
      .single()

    if (transError) throw transError

    // Create assignments only if clientIds are provided
    if (data.clientIds && data.clientIds.length > 0) {
      const costPerClient = total / data.clientIds.length
      const assignments = data.clientIds.map((clientId) => ({
        transaction_id: transaction.id,
        client_id: clientId,
        assigned_cost: costPerClient,
      }))

      const { error: assignError } = await this.supabase
        .from('transaction_assignments')
        .insert(assignments)

      if (assignError) throw assignError
    }

    return transaction
  }

  async update(id: string, data: Partial<CreateTransactionData>): Promise<Transaction> {
    const updateData: any = {}
    
    if (data.month) updateData.month = data.month
    if (data.quantity !== undefined) updateData.quantity = data.quantity
    if (data.costPerTransaction !== undefined) {
      updateData.cost_per_transaction = data.costPerTransaction
    }
    if (data.description !== undefined) updateData.description = data.description || null
    
    // Recalcular total si quantity o costPerTransaction cambian
    if (data.quantity !== undefined || data.costPerTransaction !== undefined) {
      const current = await this.getById(id)
      if (current) {
        const qty = data.quantity !== undefined ? data.quantity : current.quantity
        const cost = data.costPerTransaction !== undefined ? data.costPerTransaction : current.cost_per_transaction
        updateData.total_cost = qty * cost
      }
    }

    const { data: transaction, error } = await this.supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return transaction
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getByClientAndDateRange(
    clientId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<Array<Transaction & { assigned_cost: number }>> {
    // Primero obtener las asignaciones del cliente
    const { data: assignments, error: assignError } = await this.supabase
      .from('transaction_assignments')
      .select('transaction_id, assigned_cost')
      .eq('client_id', clientId)

    if (assignError) throw assignError

    if (!assignments || assignments.length === 0) {
      return []
    }

    const transactionIds = assignments.map(a => a.transaction_id)

    // Luego obtener las transacciones en el rango de fechas
    const { data: transactions, error: transError } = await this.supabase
      .from('transactions')
      .select('*')
      .in('id', transactionIds)
      .gte('month', dateFrom)
      .lte('month', dateTo)
      .order('month', { ascending: false })

    if (transError) throw transError

    // Combinar los datos
    const assignmentMap = new Map(assignments.map(a => [a.transaction_id, a.assigned_cost]))

    return (transactions || []).map((transaction: any) => ({
      ...transaction,
      assigned_cost: assignmentMap.get(transaction.id) || 0,
    }))
  }
}
