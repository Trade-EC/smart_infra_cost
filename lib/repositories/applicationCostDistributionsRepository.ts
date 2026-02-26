import { SupabaseClient } from '@supabase/supabase-js'

export interface ApplicationCostDistribution {
  id: string
  application_id: string
  client_id: string
  allocation_percentage: number
  allocated_amount: number
  created_at: string
  updated_at: string
}

export interface CreateDistributionData {
  applicationId: string
  clientId: string
  percentage: number
  allocatedAmount: number
}

export class ApplicationCostDistributionsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getByApplication(applicationId: string): Promise<ApplicationCostDistribution[]> {
    const { data, error } = await this.supabase
      .from('application_cost_distributions')
      .select('*')
      .eq('application_id', applicationId)
      .order('client_id', { ascending: true })

    if (error) throw error
    return data || []
  }

  async getByClientAndDateRange(
    clientId: string,
    startDate: string,
    endDate: string
  ): Promise<ApplicationCostDistribution[]> {
    // Primero obtener las aplicaciones en el rango de fechas
    const { data: applications, error: appError } = await this.supabase
      .from('applications')
      .select('id')
      .gte('date', startDate)
      .lte('date', endDate)

    if (appError) throw appError

    if (!applications || applications.length === 0) {
      return []
    }

    const applicationIds = applications.map((app: any) => app.id)

    // Luego obtener las distribuciones para esas aplicaciones y el cliente
    const { data, error } = await this.supabase
      .from('application_cost_distributions')
      .select('*')
      .eq('client_id', clientId)
      .in('application_id', applicationIds)

    if (error) throw error
    return data || []
  }

  async createOrUpdateMany(distributions: CreateDistributionData[]): Promise<ApplicationCostDistribution[]> {
    const distributionsToUpsert = distributions.map((dist) => ({
      application_id: dist.applicationId,
      client_id: dist.clientId,
      allocation_percentage: dist.percentage,
      allocated_amount: dist.allocatedAmount,
    }))

    const { data, error } = await this.supabase
      .from('application_cost_distributions')
      .upsert(distributionsToUpsert, {
        onConflict: 'application_id,client_id',
        ignoreDuplicates: false,
      })
      .select()

    if (error) throw error
    return data || []
  }

  async deleteByApplication(applicationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('application_cost_distributions')
      .delete()
      .eq('application_id', applicationId)

    if (error) throw error
  }
}
