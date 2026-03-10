import { SupabaseClient } from '@supabase/supabase-js'

export class AWSReportClientsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getByReportIds(
    reportIds: string[],
  ): Promise<Array<{ aws_report_id: string; client_id: string }>> {
    if (reportIds.length === 0) return []
    const { data, error } = await this.supabase
      .from('aws_report_clients')
      .select('aws_report_id, client_id')
      .in('aws_report_id', reportIds)
    if (error) throw error
    return data || []
  }

  async assign(awsReportId: string, clientId: string): Promise<void> {
    const { error } = await this.supabase
      .from('aws_report_clients')
      .insert({ aws_report_id: awsReportId, client_id: clientId })
    if (error) throw error
  }

  async removeAll(awsReportId: string): Promise<void> {
    const { error } = await this.supabase
      .from('aws_report_clients')
      .delete()
      .eq('aws_report_id', awsReportId)
    if (error) throw error
  }
}
