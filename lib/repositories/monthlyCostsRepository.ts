import { SupabaseClient } from '@supabase/supabase-js'
import type {
  MonthlyCost,
  CreateMonthlyCostData,
  MonthlyCostAllocation,
} from '@/types'

export class MonthlyCostsRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(data: CreateMonthlyCostData): Promise<MonthlyCost> {
    const { data: user } = await this.supabase.auth.getUser()

    // Create monthly cost
    const { data: monthlyCost, error: monthlyError } = await this.supabase
      .from('monthly_costs')
      .insert({
        month: data.month,
        total_amount: data.totalAmount,
        created_by: user?.user?.id,
      })
      .select()
      .single()

    if (monthlyError) throw monthlyError

    // Create allocations and distributions
    for (const allocation of data.allocations) {
      const { data: costAllocation, error: allocError } = await this.supabase
        .from('cost_allocations')
        .insert({
          monthly_cost_id: monthlyCost.id,
          application_id: allocation.applicationId,
          total_amount: allocation.applicationPrice,
        })
        .select()
        .single()

      if (allocError) throw allocError

      const amountPerClient = allocation.applicationPrice / allocation.clientIds.length

      for (const clientId of allocation.clientIds) {
        const { error: distError } = await this.supabase
          .from('cost_distributions')
          .insert({
            cost_allocation_id: costAllocation.id,
            client_id: clientId,
            allocation_percentage: 100 / allocation.clientIds.length,
            allocated_amount: amountPerClient,
          })

        if (distError) throw distError
      }
    }

    return monthlyCost
  }

  async getAll(): Promise<MonthlyCost[]> {
    const { data, error } = await this.supabase
      .from('monthly_costs')
      .select('*')
      .order('month', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getById(id: string): Promise<MonthlyCost | null> {
    const { data, error } = await this.supabase
      .from('monthly_costs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  }
}
