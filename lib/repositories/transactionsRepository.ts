import { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction, CreateTransactionData } from '@/types'

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

    // Create assignments
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

    return transaction
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
