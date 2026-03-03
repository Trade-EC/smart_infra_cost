import { SupabaseClient } from '@supabase/supabase-js'

export interface AWSReport {
  id: string
  customer_name: string
  cloud_account_number: string
  seller_cost: number
  client_id: string | null
  date: string
  created_at: string
  created_by: string | null
}

export interface CreateAWSReportData {
  customerName: string
  cloudAccountNumber: string
  sellerCost: number
  clientId?: string | null
  date: string
}

export class AWSReportsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AWSReport[]> {
    // Asegurar que las fechas estén en formato YYYY-MM-DD sin problemas de zona horaria
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]
    
    const { data, error } = await this.supabase
      .from('aws_reports')
      .select('*')
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)
      .order('cloud_account_number', { ascending: true })

    if (error) throw error
    return data || []
  }

  async getByClientAndDateRange(
    clientId: string,
    startDate: string,
    endDate: string
  ): Promise<AWSReport[]> {
    // Asegurar que las fechas estén en formato YYYY-MM-DD sin problemas de zona horaria
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]
    
    const { data, error } = await this.supabase
      .from('aws_reports')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)
      .order('cloud_account_number', { ascending: true })

    if (error) throw error
    return data || []
  }

  async createMany(reports: CreateAWSReportData[]): Promise<AWSReport[]> {
    const { data: user } = await this.supabase.auth.getUser()

    const reportsToInsert = reports.map((report) => ({
      customer_name: report.customerName,
      cloud_account_number: report.cloudAccountNumber,
      seller_cost: report.sellerCost,
      client_id: report.clientId || null,
      date: report.date,
      created_by: user?.user?.id || null,
    }))

    // Usar upsert para evitar duplicados (basado en UNIQUE constraint)
    const { data, error } = await this.supabase
      .from('aws_reports')
      .upsert(reportsToInsert, {
        onConflict: 'cloud_account_number,date',
        ignoreDuplicates: false,
      })
      .select()

    if (error) throw error
    return data || []
  }

  async updateClient(
    cloudAccountNumber: string,
    date: string,
    clientId: string | null
  ): Promise<AWSReport | null> {
    const { data, error } = await this.supabase
      .from('aws_reports')
      .update({ client_id: clientId })
      .eq('cloud_account_number', cloudAccountNumber)
      .eq('date', date)
      .select()
      .single()

    if (error) {
      // Si el registro no existe, no es un error crítico
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }
    return data
  }

  async deleteByDateRange(
    startDate: string,
    endDate: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('aws_reports')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) throw error
  }
}
