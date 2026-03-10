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

    if (error) {
      throw new Error(
        error.message || error.details || `Error Supabase [${error.code}]`
      )
    }
    return data || []
  }

  async getByClientAndDateRange(
    clientId: string,
    startDate: string,
    endDate: string
  ): Promise<AWSReport[]> {
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]

    // Query via pivot table aws_report_clients
    const { data: clientRows, error: clientError } = await this.supabase
      .from('aws_report_clients')
      .select('aws_report_id')
      .eq('client_id', clientId)

    if (clientError) {
      throw new Error(clientError.message || clientError.details || `Error Supabase [${clientError.code}]`)
    }

    if (!clientRows || clientRows.length === 0) return []

    const reportIds = clientRows.map((r: any) => r.aws_report_id)

    const { data, error } = await this.supabase
      .from('aws_reports')
      .select('*')
      .in('id', reportIds)
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)
      .order('cloud_account_number', { ascending: true })

    if (error) {
      throw new Error(error.message || error.details || `Error Supabase [${error.code}]`)
    }
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

    // Eliminar registros existentes para las mismas fechas antes de insertar
    const dates = [...new Set(reportsToInsert.map((r) => r.date))]
    const { error: deleteError } = await this.supabase
      .from('aws_reports')
      .delete()
      .in('date', dates)

    if (deleteError) {
      throw new Error(
        deleteError.message ||
          deleteError.details ||
          `Error Supabase [${deleteError.code}]`
      )
    }

    const { data, error } = await this.supabase
      .from('aws_reports')
      .insert(reportsToInsert)
      .select()

    if (error) {
      throw new Error(
        error.message ||
          error.details ||
          `Error Supabase [${error.code}]`
      )
    }
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
      throw new Error(
        error.message || error.details || `Error Supabase [${error.code}]`
      )
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
