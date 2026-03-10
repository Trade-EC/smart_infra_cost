import { SupabaseClient } from '@supabase/supabase-js'

export type TarifaTipo = 'ISD' | 'IVA' | 'administracion' | 'otro'
export type TarifaAplicaA = 'transactions' | 'aws' | 'gcp' | 'applications' | 'total'

export interface Tarifa {
  id: string
  nombre: string
  tipo: TarifaTipo
  porcentaje: number
  aplica_a: TarifaAplicaA
  client_id: string | null
  activa: boolean
  fecha_inicio: string
  created_at: string
  created_by: string | null
  client_name?: string | null
}

export interface CreateTarifaData {
  nombre: string
  tipo: TarifaTipo
  porcentaje: number
  aplica_a: TarifaAplicaA
  clientId: string | null
  fechaInicio?: string
}

const mapRow = (row: any): Tarifa => ({
  id: row.id,
  nombre: row.nombre,
  tipo: row.tipo,
  porcentaje: row.porcentaje,
  aplica_a: row.aplica_a,
  client_id: row.client_id,
  activa: row.activa,
  fecha_inicio: row.fecha_inicio,
  created_at: row.created_at,
  created_by: row.created_by,
  client_name: row.clients?.name ?? null,
})

export class TarifasRepository {
  constructor(private supabase: SupabaseClient) {}

  async getAll(): Promise<Tarifa[]> {
    const { data, error } = await this.supabase
      .from('tarifas')
      .select(`*, clients(name)`)
      .order('activa', { ascending: false })
      .order('fecha_inicio', { ascending: false })

    if (error) throw new Error(error.message || `Error Supabase [${error.code}]`)
    return (data || []).map(mapRow)
  }

  async getByClientAndScope(
    clientId: string | null,
    aplicaA: TarifaAplicaA
  ): Promise<Tarifa[]> {
    let query = this.supabase
      .from('tarifas')
      .select(`*, clients(name)`)
      .eq('aplica_a', aplicaA)

    if (clientId) {
      query = query.or(`client_id.eq.${clientId},client_id.is.null`)
    } else {
      query = query.is('client_id', null)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message || `Error Supabase [${error.code}]`)
    return (data || []).map(mapRow)
  }

  // Tarifas activas para un cliente en un período (fecha_inicio <= endDate)
  async getByClient(clientId: string, endDate?: string): Promise<Tarifa[]> {
    let query = this.supabase
      .from('tarifas')
      .select(`*, clients(name)`)
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .eq('activa', true)
      .order('tipo', { ascending: true })

    if (endDate) {
      query = query.lte('fecha_inicio', endDate)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message || `Error Supabase [${error.code}]`)
    return (data || []).map(mapRow)
  }

  async create(data: CreateTarifaData): Promise<Tarifa> {
    const { data: user } = await this.supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]

    const { data: row, error } = await this.supabase
      .from('tarifas')
      .insert({
        nombre: data.nombre,
        tipo: data.tipo,
        porcentaje: data.porcentaje,
        aplica_a: data.aplica_a,
        client_id: data.clientId || null,
        activa: true,
        fecha_inicio: data.fechaInicio || today,
        created_by: user?.user?.id || null,
      })
      .select(`*, clients(name)`)
      .single()

    if (error) throw new Error(error.message || `Error Supabase [${error.code}]`)
    return mapRow(row)
  }

  async toggleActive(id: string, activa: boolean): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    const updateData: Record<string, any> = { activa }
    if (activa) {
      // Al reactivar, la fecha de inicio se actualiza a hoy
      updateData.fecha_inicio = today
    }
    const { error } = await this.supabase.from('tarifas').update(updateData).eq('id', id)
    if (error) throw new Error(error.message || `Error Supabase [${error.code}]`)
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('tarifas').delete().eq('id', id)
    if (error) throw new Error(error.message || `Error Supabase [${error.code}]`)
  }
}
