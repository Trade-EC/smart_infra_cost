'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClientsRepository } from '@/lib/repositories'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Client } from '@/types'
import {
  PageHeader,
  Input,
  Button,
  ErrorMessage,
  Table,
} from '@/components/ui'

const PAGE_SIZE = 10

interface ClientForm {
  name: string
  email: string
  phone: string
  notes: string
  status: 'active' | 'inactive'
  billing_start_date: string
}

const emptyForm: ClientForm = {
  name: '',
  email: '',
  phone: '',
  notes: '',
  status: 'active',
  billing_start_date: '',
}

export default function ClientsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingClient, setViewingClient] = useState<Client | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<Client | null>(null)

  // Form state shared between create and edit
  const [form, setForm] = useState<ClientForm>(emptyForm)

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      setError(err.message || t('clients.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setForm(emptyForm)
    setError(null)
    setSuccess(null)
    setShowCreateModal(true)
  }

  const openEdit = (client: Client) => {
    setForm({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      notes: client.notes || '',
      status: client.status || 'active',
      billing_start_date: client.billing_start_date || '',
    })
    setError(null)
    setEditingClient(client)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError(t('clients.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await clientsRepo.create({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
        billing_start_date: form.billing_start_date || null,
      })
      await loadClients()
      setShowCreateModal(false)
      setSuccess(t('clients.createSuccess'))
    } catch (err: any) {
      setError(err.message || t('clients.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient) return
    if (!form.name.trim()) {
      setError(t('clients.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await clientsRepo.update(editingClient.id, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
        billing_start_date: form.billing_start_date || null,
      })
      await loadClients()
      setEditingClient(null)
      setSuccess(t('clients.updateSuccess'))
    } catch (err: any) {
      setError(err.message || t('clients.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const executeDelete = async () => {
    if (!confirmingDelete) return
    setSaving(true)
    setError(null)
    try {
      await clientsRepo.delete(confirmingDelete.id)
      await loadClients()
      setConfirmingDelete(null)
      setPage(1)
    } catch (err: any) {
      setError(err.message || t('clients.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  // Filtro y paginación
  const filteredClients = search.trim()
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : clients
  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE)
  const paginatedClients = filteredClients.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  const columns = [
    {
      key: 'name',
      header: t('clients.name'),
      render: (client: Client) => (
        <span className="font-medium text-gray-900">{client.name}</span>
      ),
    },
    {
      key: 'email',
      header: t('clients.email'),
      render: (client: Client) => (
        <span className="text-gray-600">{client.email || '-'}</span>
      ),
    },
    {
      key: 'phone',
      header: t('clients.phone'),
      render: (client: Client) => (
        <span className="text-gray-600">{client.phone || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: t('clients.status'),
      render: (client: Client) => {
        const isActive = (client.status || 'active') === 'active'
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isActive ? t('clients.active') : t('clients.inactive')}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (client: Client) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(client)}
            className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
          >
            {t('common.edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setViewingClient(client)
              setError(null)
            }}
            className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-purple-700 hover:bg-purple-100 hover:border-purple-300"
          >
            Ver
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirmingDelete(client)
              setError(null)
            }}
            className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-700 hover:bg-red-100 hover:border-red-300"
          >
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ]

  const isAnyModalOpen =
    showCreateModal || !!editingClient || !!viewingClient || !!confirmingDelete

  return (
    <div>
      <PageHeader title={t('clients.title')} />

      {!isAnyModalOpen && <ErrorMessage message={error || ''} className="mb-4" />}
      {!isAnyModalOpen && success && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="mb-4 flex items-center gap-4">
        <Button onClick={openCreate}>{t('clients.create')}</Button>
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={`${t('common.search')} por nombre...`}
            className="w-full rounded-full border border-gray-300 px-4 py-2 pl-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        </div>
      </div>

      <Table
        columns={columns}
        data={paginatedClients}
        loading={loading}
        emptyMessage={t('clients.noClients')}
        keyExtractor={(client) => client.id}
      />

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filteredClients.length)} de{' '}
            {filteredClients.length} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              {t('common.previous')}
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`h-8 w-8 rounded-full text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Modal Crear Cliente */}
      {showCreateModal && (
        <ClientFormModal
          title={t('clients.create')}
          form={form}
          setForm={setForm}
          error={error}
          saving={saving}
          onSubmit={handleCreate}
          onClose={() => {
            setShowCreateModal(false)
            setError(null)
          }}
          submitLabel={saving ? t('common.creating') : t('common.create')}
          t={t}
        />
      )}

      {/* Modal Editar Cliente */}
      {editingClient && (
        <ClientFormModal
          title={t('clients.edit')}
          form={form}
          setForm={setForm}
          error={error}
          saving={saving}
          onSubmit={handleEdit}
          onClose={() => {
            setEditingClient(null)
            setError(null)
          }}
          submitLabel={saving ? t('common.saving') : t('common.save')}
          t={t}
        />
      )}

      {/* Modal Visualizar Cliente */}
      {viewingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <h3 className="text-lg font-bold text-gray-900">
                {t('clients.view')}
              </h3>
              <button
                onClick={() => setViewingClient(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <DetailRow label={t('clients.name')} value={viewingClient.name} />
              <DetailRow label={t('clients.email')} value={viewingClient.email} />
              <DetailRow label={t('clients.phone')} value={viewingClient.phone} />
              <DetailRow
                label={t('clients.status')}
                value={
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      (viewingClient.status || 'active') === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {(viewingClient.status || 'active') === 'active'
                      ? t('clients.active')
                      : t('clients.inactive')}
                  </span>
                }
              />
              <DetailRow
                label={t('clients.billingStartDate')}
                value={
                  viewingClient.billing_start_date
                    ? new Date(
                        viewingClient.billing_start_date + 'T00:00:00'
                      ).toLocaleDateString('es-ES')
                    : null
                }
              />
              <DetailRow
                label={t('clients.observations')}
                value={viewingClient.notes}
              />
              <DetailRow
                label={t('clients.createdAt')}
                value={new Date(viewingClient.created_at).toLocaleDateString(
                  'es-ES'
                )}
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setViewingClient(null)}
                className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t('clients.deleteTitle')}
                </h3>
              </div>
              <button
                onClick={() => {
                  setConfirmingDelete(null)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              <ErrorMessage message={error || ''} />
              <p className="text-sm font-medium text-gray-900">
                {confirmingDelete.name}
              </p>
              <p className="text-sm text-red-600">{t('clients.deleteWarning')}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(null)
                  setError(null)
                }}
                disabled={saving}
                className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={saving}
                className="rounded-full bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 hover:border-red-300"
              >
                {saving ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="text-sm text-gray-900">{value || '-'}</div>
    </div>
  )
}

interface ClientForm {
  name: string
  email: string
  phone: string
  notes: string
  status: 'active' | 'inactive'
  billing_start_date: string
}

function ClientFormModal({
  title,
  form,
  setForm,
  error,
  saving,
  onSubmit,
  onClose,
  submitLabel,
  t,
}: {
  title: string
  form: ClientForm
  setForm: React.Dispatch<React.SetStateAction<ClientForm>>
  error: string | null
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  submitLabel: string
  t: (key: any) => string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start shrink-0">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto">
            <ErrorMessage message={error || ''} />

            <Input
              label={t('clients.name')}
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('clients.namePlaceholder')}
              required
            />

            <Input
              label={t('clients.email')}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder={t('clients.emailPlaceholder')}
            />

            <Input
              label={t('clients.phone')}
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder={t('clients.phonePlaceholder')}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('clients.status')}
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as 'active' | 'inactive',
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="active">{t('clients.active')}</option>
                <option value="inactive">{t('clients.inactive')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('clients.billingStartDate')}
              </label>
              <input
                type="date"
                value={form.billing_start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, billing_start_date: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('clients.observations')}
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder={t('clients.observationsPlaceholder')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
