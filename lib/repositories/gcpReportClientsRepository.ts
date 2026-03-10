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
}
