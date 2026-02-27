import { SupabaseClient } from '@supabase/supabase-js'
import type { TransactionPriceConfig, UpsertTransactionPriceConfigData } from '@/types'

export class TransactionPriceConfigsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getAll(): Promise<TransactionPriceConfig[]> {
    const { data, error } = await this.supabase
      .from('transaction_price_configs')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  async create(config: UpsertTransactionPriceConfigData): Promise<TransactionPriceConfig> {
    const { data, error } = await this.supabase
      .from('transaction_price_configs')
      .insert({
        client_id: config.clientId,
        max_transactions: config.maxTransactions,
        price_per_transaction: config.pricePerTransaction,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, config: UpsertTransactionPriceConfigData): Promise<TransactionPriceConfig> {
    const { data, error } = await this.supabase
      .from('transaction_price_configs')
      .update({
        client_id: config.clientId,
        max_transactions: config.maxTransactions,
        price_per_transaction: config.pricePerTransaction,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('transaction_price_configs')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

