import { SupabaseClient } from '@supabase/supabase-js'

export class GCPReportClientsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getByReportIds(
    reportIds: string[],
  ): Promise<Array<{ gcp_report_id: string; client_id: string }>> {
    if (reportIds.length === 0) return []
    const { data, error } = await this.supabase
      .from('gcp_report_clients')
      .select('gcp_report_id, client_id')
      .in('gcp_report_id', reportIds)
    if (error) throw error
    return data || []
  }

  async assign(gcpReportId: string, clientId: string): Promise<void> {
    const { error } = await this.supabase
      .from('gcp_report_clients')
      .insert({ gcp_report_id: gcpReportId, client_id: clientId })
    if (error) throw error
  }

  async removeAll(gcpReportId: string): Promise<void> {
    const { error } = await this.supabase
      .from('gcp_report_clients')
      .delete()
      .eq('gcp_report_id', gcpReportId)
    if (error) throw error
  }

  async getReportsByClientAndDateRange(
    clientId: string,
    startDate: string,
    endDate: string,
  ): Promise<string[]> {
    const startDateFormatted = startDate.split('T')[0]
    const endDateFormatted = endDate.split('T')[0]

    const { data: clientRows, error: clientError } = await this.supabase
      .from('gcp_report_clients')
      .select('gcp_report_id')
      .eq('client_id', clientId)
    if (clientError) throw clientError
    if (!clientRows || clientRows.length === 0) return []

    const reportIds = clientRows.map((r: any) => r.gcp_report_id)

    const { data, error } = await this.supabase
      .from('gcp_reports')
      .select('id')
      .in('id', reportIds)
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted)
    if (error) throw error
    return (data || []).map((r: any) => r.id)
  }
}
