import { SupabaseClient } from '@supabase/supabase-js'
import type {
  Application,
  ApplicationClient,
  CreateApplicationData,
  ApplicationFilters,
  SupabaseApplicationRow,
  SupabaseApplicationClientRelation,
} from '@/types'

export class ApplicationsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getAll(filters?: ApplicationFilters): Promise<Application[]> {
    let query = this.supabase
      .from('applications')
      .select(`
        *,
        application_clients (
          clients (
            id,
            name
          )
        )
      `)
      .order('date', { ascending: false })

    if (filters?.dateFrom) {
      const dateFromFormatted = filters.dateFrom.split('T')[0]
      query = query.gte('date', dateFromFormatted)
    }

    if (filters?.dateTo) {
      const dateToFormatted = filters.dateTo.split('T')[0]
      const [year, month, day] = dateToFormatted.split('-').map(Number)
      const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
      const dateToNextDay = nextDay.toISOString().split('T')[0]
      query = query.lt('date', dateToNextDay)
    }

    if (filters?.applicationFilter) {
      query = query.ilike('name', `%${filters.applicationFilter}%`)
    }

    const { data, error } = await query

    if (error) throw error

    // Transform the data to match the Application interface
    const applications: Application[] = (data || []).map(
      (app: SupabaseApplicationRow) => ({
        id: app.id,
        name: app.name,
        responsable: app.responsable,
        price: app.price,
        date: app.date,
        clients:
          app.application_clients?.map(
            (ac: SupabaseApplicationClientRelation): ApplicationClient => ({
              id: ac.clients.id,
              name: ac.clients.name,
            })
          ) || [],
      })
    )

    // Filter by client if needed (client-side filter)
    if (filters?.clientFilter) {
      return applications.filter((app) =>
        app.clients?.some(
          (c) =>
            c.name.toLowerCase().includes(filters.clientFilter!.toLowerCase()) ||
            app.responsable.toLowerCase().includes(filters.clientFilter!.toLowerCase())
        )
      )
    }

    return applications
  }

  async getById(id: string): Promise<Application | null> {
    const { data, error } = await this.supabase
      .from('applications')
      .select(`
        *,
        application_clients (
          clients (
            id,
            name
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    const row = data as SupabaseApplicationRow
    return {
      id: row.id,
      name: row.name,
      responsable: row.responsable,
      price: row.price,
      date: row.date,
      clients:
        row.application_clients?.map(
          (ac: SupabaseApplicationClientRelation): ApplicationClient => ({
            id: ac.clients.id,
            name: ac.clients.name,
          })
        ) || [],
    }
  }

  async create(applicationData: CreateApplicationData): Promise<Application> {
    const { data, error } = await this.supabase
      .from('applications')
      .insert({
        name: applicationData.name.trim(),
        responsable: applicationData.responsable.trim(),
        price: Math.abs(applicationData.price), // Ensure positive
        date: applicationData.date,
      })
      .select()
      .single()

    if (error) throw error
    return {
      id: data.id,
      name: data.name,
      responsable: data.responsable,
      price: data.price,
      date: data.date,
      clients: [],
    }
  }

  async createMany(applicationsData: CreateApplicationData[]): Promise<Application[]> {
    const { data, error } = await this.supabase
      .from('applications')
      .insert(
        applicationsData.map((app) => ({
          name: app.name.trim(),
          responsable: app.responsable.trim(),
          price: Math.abs(app.price),
          date: app.date,
        }))
      )
      .select()

    if (error) throw error
    return data || []
  }

  async assignClient(applicationId: string, clientId: string): Promise<void> {
    const { error } = await this.supabase.from('application_clients').insert({
      application_id: applicationId,
      client_id: clientId,
    })

    if (error) throw error
  }

  async removeClient(applicationId: string, clientId: string): Promise<void> {
    const { error } = await this.supabase
      .from('application_clients')
      .delete()
      .eq('application_id', applicationId)
      .eq('client_id', clientId)

    if (error) throw error
  }

  async removeAllClients(applicationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('application_clients')
      .delete()
      .eq('application_id', applicationId)

    if (error) throw error
  }

  async checkDuplicate(
    name: string,
    date: string,
    price: number,
    responsable: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('applications')
      .select('id')
      .eq('name', name.trim())
      .eq('date', date)
      .eq('price', Math.abs(price))
      .eq('responsable', responsable.trim())
      .limit(1)

    if (error) throw error
    return (data?.length || 0) > 0
  }

  /**
   * Verifica duplicados en batch (1 query en lugar de N).
   * Retorna un Set de claves "name|date|price|responsable" ya existentes en la BD.
   */
  async batchCheckDuplicates(
    items: Array<{ name: string; date: string; price: number; responsable: string }>
  ): Promise<Set<string>> {
    if (items.length === 0) return new Set()

    const names = [...new Set(items.map((i) => i.name.trim()))]
    const dates = [...new Set(items.map((i) => i.date))]

    const { data, error } = await this.supabase
      .from('applications')
      .select('name, date, price, responsable')
      .in('name', names)
      .in('date', dates)

    if (error) throw error

    return new Set(
      (data || []).map(
        (r: any) =>
          `${r.name.trim()}|${r.date}|${Math.abs(r.price)}|${r.responsable.trim()}`
      )
    )
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('applications')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getByClientAndDateRange(
    clientId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<Application[]> {
    // Primero obtener las aplicaciones asignadas al cliente
    const { data: assignments, error: assignError } = await this.supabase
      .from('application_clients')
      .select('application_id')
      .eq('client_id', clientId)

    if (assignError) throw assignError

    if (!assignments || assignments.length === 0) {
      return []
    }

    const applicationIds = assignments.map(a => a.application_id)

    // Luego obtener las aplicaciones en el rango de fechas
    const { data: applications, error: appError } = await this.supabase
      .from('applications')
      .select('*')
      .in('id', applicationIds)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false })

    if (appError) throw appError

    // Transform the data
    return (applications || []).map((app: any): Application => ({
      id: app.id,
      name: app.name,
      responsable: app.responsable,
      price: app.price,
      date: app.date,
      clients: [], // No necesitamos los clientes aquí
    }))
  }
}
