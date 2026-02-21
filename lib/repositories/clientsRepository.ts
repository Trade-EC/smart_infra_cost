import { SupabaseClient } from '@supabase/supabase-js'
import type {
  Client,
  CreateClientData,
  UpdateClientData,
  SupabaseUpdateData,
} from '@/types'

export class ClientsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getAll(): Promise<Client[]> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  }

  async getById(id: string): Promise<Client | null> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  async create(clientData: CreateClientData): Promise<Client> {
    const { data, error } = await this.supabase
      .from('clients')
      .insert({
        name: clientData.name.trim(),
        notes: clientData.notes?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, clientData: UpdateClientData): Promise<Client> {
    const updateData: SupabaseUpdateData = {}
    if (clientData.name !== undefined) {
      updateData.name = clientData.name.trim()
    }
    if (clientData.notes !== undefined) {
      updateData.notes = clientData.notes?.trim() || null
    }

    const { data, error } = await this.supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('clients')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
