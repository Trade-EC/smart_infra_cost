'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TarifasRepository, ClientsRepository } from '@/lib/repositories'
import type { Tarifa, TarifaTipo, TarifaAplicaA } from '@/lib/repositories/tarifasRepository'
import type { Client } from '@/types'
import toast from 'react-hot-toast'
import { PageHeader, Card, Button, ErrorMessage } from '@/components/ui'
import Select from '@/components/ui/Select'

const TIPO_LABELS: Record<TarifaTipo, string> = {
  ISD: 'ISD',
  IVA: 'IVA',
  administracion: 'Administración',
  otro: 'Otro',
}

const APLICA_A_LABELS: Record<TarifaAplicaA, string> = {
  transactions: 'Transacciones',
  aws: 'AWS',
  gcp: 'GCP',
  applications: 'Aplicaciones',
  total: 'Total de factura',
}

const TIPO_OPTIONS: { value: TarifaTipo; label: string }[] = [
  { value: 'ISD', label: 'ISD' },
  { value: 'IVA', label: 'IVA' },
  { value: 'administracion', label: 'Administración' },
  { value: 'otro', label: 'Otro' },
]

const APLICA_A_OPTIONS: { value: TarifaAplicaA; label: string }[] = [
  { value: 'transactions', label: 'Transacciones' },
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'GCP' },
  { value: 'applications', label: 'Aplicaciones' },
  { value: 'total', label: 'Total de factura' },
]

const TIPO_COLORS: Record<TarifaTipo, string> = {
  ISD: 'bg-purple-100 text-purple-800',
  IVA: 'bg-blue-100 text-blue-800',
  administracion: 'bg-green-100 text-green-800',
  otro: 'bg-gray-100 text-gray-800',
}

const APLICA_A_COLORS: Record<TarifaAplicaA, string> = {
  transactions: 'bg-orange-100 text-orange-800',
  aws: 'bg-yellow-100 text-yellow-800',
  gcp: 'bg-red-100 text-red-800',
  applications: 'bg-indigo-100 text-indigo-800',
  total: 'bg-teal-100 text-teal-800',
}

const today = new Date().toISOString().split('T')[0]

const emptyForm = {
  nombre: '',
  tipo: '' as TarifaTipo | '',
  porcentaje: '',
  aplica_a: '' as TarifaAplicaA | '',
  clientId: '',
  fechaInicio: today,
}

export default function TarifasPage() {
  const supabase = useMemo(() => createClient(), [])
  const tarifasRepo = useMemo(() => new TarifasRepository(supabase), [supabase])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])

  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterTipo, setFilterTipo] = useState('')
  const [filterAplicaA, setFilterAplicaA] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterActiva, setFilterActiva] = useState<'all' | 'active' | 'inactive'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    Promise.all([loadTarifas(), loadClients()])
  }, [])

  const loadTarifas = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await tarifasRepo.getAll()
      setTarifas(data)
    } catch (err: any) {
      setError(err.message || 'Error al cargar las tarifas')
    } finally {
      setLoading(false)
    }
  }

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.tipo) { setError('El tipo es requerido'); return }
    if (!form.porcentaje || isNaN(Number(form.porcentaje)) || Number(form.porcentaje) <= 0) {
      setError('El porcentaje debe ser mayor a 0'); return
    }
    if (!form.aplica_a) { setError('Debe indicar a qué aplica'); return }
    if (!form.fechaInicio) { setError('La fecha de inicio es requerida'); return }

    setSaving(true)
    setError(null)
    try {
      await tarifasRepo.create({
        nombre: form.nombre.trim(),
        tipo: form.tipo as TarifaTipo,
        porcentaje: Number(form.porcentaje),
        aplica_a: form.aplica_a as TarifaAplicaA,
        clientId: form.clientId || null,
        fechaInicio: form.fechaInicio,
      })
      setForm(emptyForm)
      setShowForm(false)
      await loadTarifas()
      toast.success('Tarifa creada correctamente')
    } catch (err: any) {
      setError(err.message || 'Error al crear la tarifa')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (tarifa: Tarifa) => {
    setTogglingId(tarifa.id)
    setError(null)
    try {
      await tarifasRepo.toggleActive(tarifa.id, !tarifa.activa)
      await loadTarifas()
      toast.success(tarifa.activa ? 'Tarifa desactivada' : 'Tarifa activada — fecha de inicio actualizada a hoy')
    } catch (err: any) {
      setError(err.message || 'Error al cambiar el estado')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      await tarifasRepo.delete(id)
      setTarifas((prev) => prev.filter((t) => t.id !== id))
      toast.success('Tarifa eliminada')
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la tarifa')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = tarifas.filter((t) => {
    if (filterTipo && t.tipo !== filterTipo) return false
    if (filterAplicaA && t.aplica_a !== filterAplicaA) return false
    if (filterActiva === 'active' && !t.activa) return false
    if (filterActiva === 'inactive' && t.activa) return false
    if (filterClient) {
      if (filterClient === '__todos__') return t.client_id === null
      if (t.client_id !== filterClient) return false
    }
    return true
  })

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div>
      <PageHeader
        title="Tarifas"
        actions={
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Crear Tarifa'}
          </Button>
        }
      />

      <ErrorMessage message={error || ''} className="mb-4" />

      {/* Formulario nueva tarifa */}
      {showForm && <Card title="Nueva Tarifa" className="mb-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: IVA 12%, ISD 5%"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.tipo}
                onChange={(val) => setForm({ ...form, tipo: val as TarifaTipo })}
                options={TIPO_OPTIONS}
                placeholder="Seleccionar tipo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porcentaje (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                max="100"
                value={form.porcentaje}
                onChange={(e) => setForm({ ...form, porcentaje: e.target.value })}
                placeholder="Ej: 12"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aplica a <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.aplica_a}
                onChange={(val) => setForm({ ...form, aplica_a: val as TarifaAplicaA })}
                options={APLICA_A_OPTIONS}
                placeholder="Seleccionar destino"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente <span className="text-gray-400 text-xs font-normal">(vacío = todos)</span>
              </label>
              <Select
                value={form.clientId}
                onChange={(val) => setForm({ ...form, clientId: val })}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Todos los clientes"
                searchable
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="submit" variant="primary" isLoading={saving}>
              Crear Tarifa
            </Button>
          </div>
        </form>
      </Card>}

      {/* Filtros */}
      <Card title="Filtros" className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <Select
              value={filterTipo}
              onChange={setFilterTipo}
              options={TIPO_OPTIONS}
              placeholder="Todos los tipos"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Aplica a</label>
            <Select
              value={filterAplicaA}
              onChange={setFilterAplicaA}
              options={APLICA_A_OPTIONS}
              placeholder="Todos"
            />
          </div>
          <div className="w-56">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <Select
              value={filterClient}
              onChange={setFilterClient}
              options={[
                { value: '__todos__', label: 'Aplica a todos' },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="Todos"
              searchable
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 sr-only">Estado</label>
            {(['all', 'active', 'inactive'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterActiva(v)}
                className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  filterActiva === v
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v === 'all' ? 'Todas' : v === 'active' ? 'Activas' : 'Inactivas'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card title={`Tarifas${filtered.length !== tarifas.length ? ` (${filtered.length} de ${tarifas.length})` : ` (${tarifas.length})`}`}>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Cargando tarifas...</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {tarifas.length === 0 ? 'No hay tarifas creadas aún.' : 'No hay tarifas que coincidan con los filtros.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">%</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Aplica a</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Desde</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tarifa) => (
                  <tr
                    key={tarifa.id}
                    className={`border-b border-gray-100 ${tarifa.activa ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60'}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(tarifa)}
                        disabled={togglingId === tarifa.id}
                        title={tarifa.activa ? 'Desactivar tarifa' : 'Activar tarifa (fecha de inicio se actualiza a hoy)'}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          tarifa.activa
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${tarifa.activa ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {togglingId === tarifa.id ? '...' : tarifa.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{tarifa.nombre}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${TIPO_COLORS[tarifa.tipo]}`}>
                        {TIPO_LABELS[tarifa.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{tarifa.porcentaje}%</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${APLICA_A_COLORS[tarifa.aplica_a]}`}>
                        {APLICA_A_LABELS[tarifa.aplica_a]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {tarifa.client_id ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                          {tarifa.client_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Todos</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(tarifa.fecha_inicio)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(tarifa.id)}
                        isLoading={deletingId === tarifa.id}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
