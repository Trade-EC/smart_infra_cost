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

  /**
   * Consulta masiva: todas las distribuciones de aplicaciones en un rango de fechas,
   * con fecha de la aplicación. Dos consultas para evitar filtrar por tabla anidada.
   */
  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<Array<{ application_id: string; client_id: string; allocated_amount: number; application_date: string }>> {
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]

    const { data: applications, error: appError } = await this.supabase
      .from('applications')
      .select('id, date')
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)

    if (appError) throw appError
    if (!applications || applications.length === 0) return []

    const applicationIds = applications.map((app: any) => app.id)
    const dateByApplicationId = new Map(applications.map((app: any) => [app.id, app.date]))

    const { data: distributions, error: distError } = await this.supabase
      .from('application_cost_distributions')
      .select('application_id, client_id, allocated_amount')
      .in('application_id', applicationIds)

    if (distError) throw distError
    if (!distributions || distributions.length === 0) return []

    return distributions.map((row: any) => ({
      application_id: row.application_id,
      client_id: row.client_id,
      allocated_amount: parseFloat(row.allocated_amount || 0),
      application_date: dateByApplicationId.get(row.application_id) || '',
    }))
  }

  async getByClientAndDateRange(
    clientId: string,
    startDate: string,
    endDate: string
  ): Promise<ApplicationCostDistribution[]> {
    // Asegurar que las fechas estén en formato YYYY-MM-DD sin problemas de zona horaria
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]
    
    // Primero obtener las aplicaciones en el rango de fechas
    const { data: applications, error: appError } = await this.supabase
      .from('applications')
      .select('id')
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)

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
