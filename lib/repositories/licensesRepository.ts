import { SupabaseClient } from '@supabase/supabase-js'

export interface LicenseClient {
  id: string
  name: string
}

export interface License {
  id: string
  name: string
  responsable: string
  price: number
  date: string
  created_at: string
  clients: LicenseClient[]
}

export interface CreateLicenseData {
  name: string
  responsable: string
  price: number
  date: string
}

export interface LicenseFilters {
  dateFrom?: string
  dateTo?: string
  clientId?: string
  nameFilter?: string
}

export class LicensesRepository {
  constructor(private supabase: SupabaseClient) {}

  async getAll(filters?: LicenseFilters): Promise<License[]> {
    let query = this.supabase
      .from('licenses')
      .select(`
        *,
        license_clients (
          clients (
            id,
            name
          )
        )
      `)
      .order('date', { ascending: false })

    if (filters?.dateFrom) {
      query = query.gte('date', filters.dateFrom.split('T')[0])
    }
    if (filters?.dateTo) {
      query = query.lte('date', filters.dateTo.split('T')[0])
    }
    if (filters?.nameFilter) {
      query = query.ilike('name', `%${filters.nameFilter}%`)
    }

    const { data, error } = await query
    if (error) throw error

    const licenses: License[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      responsable: row.responsable,
      price: row.price,
      date: row.date,
      created_at: row.created_at,
      clients:
        row.license_clients?.map((lc: any) => ({
          id: lc.clients.id,
          name: lc.clients.name,
        })) || [],
    }))

    if (filters?.clientId) {
      return licenses.filter((l) => l.clients.some((c) => c.id === filters.clientId))
    }

    return licenses
  }

  async create(data: CreateLicenseData): Promise<License> {
    const { data: row, error } = await this.supabase
      .from('licenses')
      .insert({
        name: data.name.trim(),
        responsable: data.responsable.trim(),
        price: Math.abs(data.price),
        date: data.date,
      })
      .select()
      .single()

    if (error) throw error
    return { ...row, clients: [] }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('licenses').delete().eq('id', id)
    if (error) throw error
  }

  async assignClient(licenseId: string, clientId: string): Promise<void> {
    const { error } = await this.supabase
      .from('license_clients')
      .insert({ license_id: licenseId, client_id: clientId })
    if (error) throw error
  }

  async removeClient(licenseId: string, clientId: string): Promise<void> {
    const { error } = await this.supabase
      .from('license_clients')
      .delete()
      .eq('license_id', licenseId)
      .eq('client_id', clientId)
    if (error) throw error
  }

  async removeAllClients(licenseId: string): Promise<void> {
    const { error } = await this.supabase
      .from('license_clients')
      .delete()
      .eq('license_id', licenseId)
    if (error) throw error
  }

  async getByClientAndDateRange(
    clientId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<License[]> {
    const { data: assignments, error: assignError } = await this.supabase
      .from('license_clients')
      .select('license_id')
      .eq('client_id', clientId)

    if (assignError) throw assignError
    if (!assignments || assignments.length === 0) return []

    const licenseIds = assignments.map((a: any) => a.license_id)

    const { data, error } = await this.supabase
      .from('licenses')
      .select('*')
      .in('id', licenseIds)
      .gte('date', dateFrom.split('T')[0])
      .lte('date', dateTo.split('T')[0])
      .order('date', { ascending: false })

    if (error) throw error
    return (data || []).map((row: any): License => ({ ...row, clients: [] }))
  }
}
