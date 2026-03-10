import { SupabaseClient } from '@supabase/supabase-js'

export interface GCPReport {
  id: string
  project_name: string
  project_id: string
  cost: number
  client_id: string | null
  date: string
  created_at: string
  created_by: string | null
}

export interface CreateGCPReportData {
  projectName: string
  projectId: string
  cost: number
  clientId?: string | null
  date: string
}

export class GCPReportsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getByDateRange(startDate: string, endDate: string): Promise<GCPReport[]> {
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]

    const { data, error } = await this.supabase
      .from('gcp_reports')
      .select('*')
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)
      .order('project_id', { ascending: true })

    if (error) {
      throw new Error(error.message || error.details || `Error Supabase [${error.code}]`)
    }
    return data || []
  }

  async getByClientAndDateRange(
    clientId: string,
    startDate: string,
    endDate: string
  ): Promise<GCPReport[]> {
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]

    const { data, error } = await this.supabase
      .from('gcp_reports')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)
      .order('project_id', { ascending: true })

    if (error) {
      throw new Error(error.message || error.details || `Error Supabase [${error.code}]`)
    }
    return data || []
  }

  async createMany(reports: CreateGCPReportData[]): Promise<GCPReport[]> {
    const { data: user } = await this.supabase.auth.getUser()

    const reportsToInsert = reports.map((report) => ({
      project_name: report.projectName,
      project_id: report.projectId,
      cost: report.cost,
      client_id: report.clientId || null,
      date: report.date,
      created_by: user?.user?.id || null,
    }))

    // Eliminar registros existentes para las mismas fechas antes de insertar
    const dates = [...new Set(reportsToInsert.map((r) => r.date))]
    const { error: deleteError } = await this.supabase
      .from('gcp_reports')
      .delete()
      .in('date', dates)

    if (deleteError) {
      throw new Error(
        deleteError.message || deleteError.details || `Error Supabase [${deleteError.code}]`
      )
    }

    const { data, error } = await this.supabase
      .from('gcp_reports')
      .insert(reportsToInsert)
      .select()

    if (error) {
      throw new Error(error.message || error.details || `Error Supabase [${error.code}]`)
    }
    return data || []
  }

  async updateClient(
    projectId: string,
    date: string,
    clientId: string | null
  ): Promise<GCPReport | null> {
    const { data, error } = await this.supabase
      .from('gcp_reports')
      .update({ client_id: clientId })
      .eq('project_id', projectId)
      .eq('date', date)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message || error.details || `Error Supabase [${error.code}]`)
    }
    return data
  }
}
