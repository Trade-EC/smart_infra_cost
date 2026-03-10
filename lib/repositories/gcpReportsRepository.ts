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

    // Query via pivot table gcp_report_clients
    const { data: clientRows, error: clientError } = await this.supabase
      .from('gcp_report_clients')
      .select('gcp_report_id')
      .eq('client_id', clientId)

    if (clientError) {
      throw new Error(clientError.message || clientError.details || `Error Supabase [${clientError.code}]`)
    }

    if (!clientRows || clientRows.length === 0) return []

    const reportIds = clientRows.map((r: any) => r.gcp_report_id)

    const { data, error } = await this.supabase
      .from('gcp_reports')
      .select('*')
      .in('id', reportIds)
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

    const reportsToInsert = reports
      .filter((report) => report.cost > 0)
      .map((report) => ({
        project_name: report.projectName,
        project_id: report.projectId,
        cost: report.cost,
        client_id: report.clientId || null,
        date: report.date,
        created_by: user?.user?.id || null,
      }))

    // Obtener registros existentes para las mismas fechas
    const dates = [...new Set(reportsToInsert.map((r) => r.date))]
    const { data: existing, error: fetchError } = await this.supabase
      .from('gcp_reports')
      .select('project_id, date')
      .in('date', dates)

    if (fetchError) {
      throw new Error(fetchError.message || fetchError.details || `Error Supabase [${fetchError.code}]`)
    }

    // Construir un Set con las combinaciones project_id+date ya existentes
    const existingKeys = new Set(
      (existing || []).map((r: { project_id: string; date: string }) => `${r.project_id}|${r.date}`)
    )

    // Solo insertar los que no existen (por project_id + date)
    const newReports = reportsToInsert.filter(
      (r) => !existingKeys.has(`${r.project_id}|${r.date}`)
    )

    if (newReports.length === 0) return []

    const { data, error } = await this.supabase
      .from('gcp_reports')
      .insert(newReports)
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
