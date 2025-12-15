'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  name: string
  email: string | null
  created_at: string
}

export default function ClientsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setClients(data || [])
    } catch (err: any) {
      setError(err.message || 'Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setEmail('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('clients')
          .update({ name: name.trim(), email: email.trim() || null })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('clients')
          .insert({ name: name.trim(), email: email.trim() || null })
        if (error) throw error
      }
      await loadClients()
      resetForm()
    } catch (err: any) {
      setError(err.message || 'Error al guardar el cliente')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (client: Client) => {
    setEditingId(client.id)
    setName(client.name)
    setEmail(client.email || '')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    try {
      setSaving(true)
      setError(null)
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
      await loadClients()
      if (editingId === id) resetForm()
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">
          {editingId ? 'Editar Cliente' : 'Crear Cliente'}
        </h2>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="Nombre del cliente"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha de Creación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : clients && clients.length > 0 ? (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {client.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {client.email || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(client.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 flex gap-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                      >
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-700 hover:bg-red-100 hover:border-red-300"
                      >
                        <span>Eliminar</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay clientes registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
