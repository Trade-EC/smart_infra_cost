'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { LicensesRepository, ClientsRepository } from '@/lib/repositories'
import type { License } from '@/lib/repositories/licensesRepository'
import type { Client } from '@/types'
import { PageHeader, Button, ErrorMessage, DateRangePicker } from '@/components/ui'
import Select from '@/components/ui/Select'

const emptyForm = { nombre: '', responsable: '', precio: '', fecha: '' }

export default function LicenciasPage() {
  const supabase = useMemo(() => createClient(), [])
  const licensesRepo = useMemo(() => new LicensesRepository(supabase), [supabase])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])

  const [licenses, setLicenses] = useState<License[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedClientFilter, setSelectedClientFilter] = useState('')

  // Modal nueva licencia
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Asignación multi-cliente inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clientSelectors, setClientSelectors] = useState<Record<string, string[]>>({})

  // Modal editar licencia
  const [editingLicense, setEditingLicense] = useState<License | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', responsable: '', precio: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Eliminar
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (dateRange?.start && dateRange?.end) {
      loadLicenses()
    } else {
      setLicenses([])
    }
  }, [dateRange, selectedClientFilter])

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
  }

  const loadLicenses = async () => {
    if (!dateRange?.start || !dateRange?.end) return
    try {
      setLoading(true)
      setError(null)
      let data = await licensesRepo.getAll({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
      })
      if (selectedClientFilter) {
        data = data.filter((l) => l.clients.some((c) => c.id === selectedClientFilter))
      }
      setLicenses(data)
    } catch (err: any) {
      setError(err.message || 'Error al cargar las licencias')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.fecha) { setError('La fecha es requerida'); return }
    const precio = parseFloat(form.precio)
    if (!form.precio || isNaN(precio) || precio < 0) { setError('El precio debe ser un número válido'); return }

    setSaving(true)
    setError(null)
    try {
      await licensesRepo.create({
        name: form.nombre.trim(),
        responsable: form.responsable.trim() || 'Sin asignar',
        price: precio,
        date: form.fecha,
      })
      setShowModal(false)
      setForm(emptyForm)
      await loadLicenses()
      toast.success('Licencia creada correctamente')
    } catch (err: any) {
      setError(err.message || 'Error al crear la licencia')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (license: License) => {
    setEditingLicense(license)
    setEditForm({
      nombre: license.name,
      responsable: license.responsable,
      precio: license.price.toString(),
    })
    setError(null)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLicense) return
    if (!editForm.nombre.trim()) { setError('El nombre es requerido'); return }
    const precio = parseFloat(editForm.precio)
    if (!editForm.precio || isNaN(precio) || precio < 0) { setError('El precio debe ser un número válido'); return }

    setSavingEdit(true)
    setError(null)
    try {
      await licensesRepo.update(editingLicense.id, {
        name: editForm.nombre.trim(),
        responsable: editForm.responsable.trim() || 'Sin asignar',
        price: precio,
      })
      setEditingLicense(null)
      await loadLicenses()
      toast.success('Licencia actualizada correctamente')
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la licencia')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta licencia? Esta acción no se puede deshacer.')) return
    setDeletingId(id)
    try {
      await licensesRepo.delete(id)
      setLicenses((prev) => prev.filter((l) => l.id !== id))
      toast.success('Licencia eliminada')
    } catch (err: any) {
      setError(err.message || 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  const startEditing = (licenseId: string) => {
    const license = licenses.find((l) => l.id === licenseId)
    const currentClientIds = license?.clients?.map((c) => c.id) || []
    setClientSelectors({
      ...clientSelectors,
      [licenseId]: currentClientIds.length > 0 ? [...currentClientIds, ''] : [''],
    })
    setEditingId(licenseId)
  }

  const addClientSelector = (licenseId: string) => {
    const current = clientSelectors[licenseId] || ['']
    setClientSelectors({ ...clientSelectors, [licenseId]: [...current, ''] })
  }

  const updateClientSelector = (licenseId: string, index: number, clientId: string) => {
    const current = clientSelectors[licenseId] || ['']
    const updated = [...current]
    updated[index] = clientId
    if (clientId !== '' && index === current.length - 1 && current[current.length - 1] === '') {
      updated.push('')
    }
    setClientSelectors({ ...clientSelectors, [licenseId]: updated })
  }

  const removeClientSelector = (licenseId: string, index: number) => {
    const current = clientSelectors[licenseId] || ['']
    const updated = current.filter((_, i) => i !== index)
    setClientSelectors({ ...clientSelectors, [licenseId]: updated.length > 0 ? updated : [''] })
  }

  const handleSaveClients = async (licenseId: string) => {
    try {
      const clientIds = (clientSelectors[licenseId] || [])
        .filter((id) => id !== '')
        .filter((id, index, self) => self.indexOf(id) === index)

      await licensesRepo.removeAllClients(licenseId)
      for (const clientId of clientIds) {
        await licensesRepo.assignClient(licenseId, clientId)
      }
      setEditingId(null)
      setClientSelectors({ ...clientSelectors, [licenseId]: [''] })
      await loadLicenses()
      toast.success('Clientes actualizados')
    } catch (err: any) {
      setError(err.message || 'Error al asignar clientes')
    }
  }

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('T')[0].split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div>
      <PageHeader
        title="Licencias"
        actions={
          <Button variant="primary" onClick={() => { setShowModal(true); setError(null) }}>
            + Nueva Licencia
          </Button>
        }
      />

      <ErrorMessage message={error || ''} className="mb-4" />

      {/* Filtros */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rango de Fechas</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Cliente</label>
            <Select
              value={selectedClientFilter}
              onChange={setSelectedClientFilter}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Todos los clientes"
              searchable
              clearLabel="Todos"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg bg-white shadow">
        {!dateRange ? (
          <div className="p-6">
            <p className="text-sm text-gray-500">Selecciona un rango de fechas para ver las licencias.</p>
          </div>
        ) : loading ? (
          <div className="p-6">
            <p className="text-sm text-gray-500">Cargando...</p>
          </div>
        ) : licenses.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-gray-500">No hay licencias en el rango seleccionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Licencia</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Responsable</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente(s)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Precio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((license) => (
                  <tr key={license.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{license.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{license.responsable}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {editingId === license.id ? (
                        <div className="flex flex-col gap-2 min-w-[220px]">
                          {(clientSelectors[license.id] || ['']).map((selectedId, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <div className="flex-1">
                                <Select
                                  value={selectedId}
                                  onChange={(val) => updateClientSelector(license.id, index, val)}
                                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                                  placeholder="Seleccionar cliente"
                                  searchable
                                  clearLabel="Sin cliente"
                                />
                              </div>
                              {(clientSelectors[license.id] || ['']).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeClientSelector(license.id, index)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 text-sm"
                                >
                                  −
                                </button>
                              )}
                            </div>
                          ))}
                          <div className="flex gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => addClientSelector(license.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 text-sm"
                              title="Agregar otro cliente"
                            >
                              +
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveClients(license.id)}
                              className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 text-xs"
                            >
                              Guardar
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-gray-600 hover:bg-gray-200 text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {license.clients && license.clients.length > 0 ? (
                            license.clients.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                              >
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">Sin cliente</span>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditing(license.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 text-xs font-bold"
                            title="Asignar cliente(s)"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${license.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(license.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(license)}
                          className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(license.id)}
                          isLoading={deletingId === license.id}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">
                    ${licenses.reduce((sum, l) => sum + l.price, 0).toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal Editar Licencia */}
      {editingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Editar Licencia</h2>
              <button
                type="button"
                onClick={() => { setEditingLicense(null); setError(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <ErrorMessage message={error || ''} className="mb-4" />

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsable
                </label>
                <input
                  type="text"
                  value={editForm.responsable}
                  onChange={(e) => setEditForm({ ...editForm, responsable: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.precio}
                  onChange={(e) => setEditForm({ ...editForm, precio: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setEditingLicense(null); setError(null) }}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={savingEdit}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva Licencia */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Nueva Licencia</h2>
              <button
                type="button"
                onClick={() => { setShowModal(false); setForm(emptyForm); setError(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <ErrorMessage message={error || ''} className="mb-4" />

            <form onSubmit={handleSaveNew} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Slack, Adobe CC..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsable
                </label>
                <input
                  type="text"
                  value={form.responsable}
                  onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                  placeholder="Nombre del responsable"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowModal(false); setForm(emptyForm); setError(null) }}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={saving}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
