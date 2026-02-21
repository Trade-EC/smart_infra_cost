'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ClientsRepository } from '@/lib/repositories'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Client } from '@/types'
import {
  PageHeader,
  Card,
  Input,
  Button,
  ErrorMessage,
  Table,
} from '@/components/ui'

export default function ClientsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingRowName, setEditingRowName] = useState('')
  const [editingRowNotes, setEditingRowNotes] = useState('')

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

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setNotes('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('clients.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await clientsRepo.update(editingId, {
          name: name.trim(),
          notes: notes.trim() || null,
        })
      } else {
        await clientsRepo.create({
          name: name.trim(),
          notes: notes.trim() || null,
        })
      }
      await loadClients()
      resetForm()
    } catch (err: any) {
      setError(err.message || t('clients.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (client: Client) => {
    setEditingId(client.id)
    setName(client.name)
    setNotes(client.notes || '')
  }

  const startEditingRow = (client: Client) => {
    setEditingRowId(client.id)
    setEditingRowName(client.name)
    setEditingRowNotes(client.notes || '')
  }

  const cancelEditingRow = () => {
    setEditingRowId(null)
    setEditingRowName('')
    setEditingRowNotes('')
  }

  const handleSaveRow = async (id: string) => {
    if (!editingRowName.trim()) {
      setError(t('clients.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await clientsRepo.update(id, {
        name: editingRowName.trim(),
        notes: editingRowNotes.trim() || null,
      })
      await loadClients()
      cancelEditingRow()
      toast.success(t('clients.updateSuccess') || 'Cliente actualizado exitosamente')
    } catch (err: any) {
      setError(err.message || t('clients.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('clients.deleteConfirm'))) return
    try {
      setSaving(true)
      setError(null)
      await clientsRepo.delete(id)
      await loadClients()
      if (editingId === id) resetForm()
    } catch (err: any) {
      setError(err.message || t('clients.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: t('clients.name'),
      className: 'font-medium text-gray-900',
      render: (client: Client) => {
        if (editingRowId === client.id) {
          return (
            <input
              type="text"
              value={editingRowName}
              onChange={(e) => setEditingRowName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              autoFocus
            />
          )
        }
        return <span className="font-medium text-gray-900">{client.name}</span>
      },
    },
    {
      key: 'notes',
      header: 'Observaciones',
      render: (client: Client) => {
        if (editingRowId === client.id) {
          return (
            <textarea
              value={editingRowNotes}
              onChange={(e) => setEditingRowNotes(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 resize-none"
              rows={2}
            />
          )
        }
        return <span className="text-gray-600">{client.notes || '-'}</span>
      },
    },
    {
      key: 'created_at',
      header: t('clients.createdAt'),
      render: (client: Client) =>
        new Date(client.created_at).toLocaleDateString('es-ES'),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (client: Client) => {
        if (editingRowId === client.id) {
          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSaveRow(client.id)}
                disabled={saving}
                className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300 disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEditingRow}
                disabled={saving}
                className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-100 hover:border-gray-300 disabled:opacity-50"
              >
                {t('common.cancel')}
              </Button>
            </div>
          )
        }
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEditingRow(client)}
              className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
            >
              {t('common.edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(client.id)}
              className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-700 hover:bg-red-100 hover:border-red-300"
            >
              {t('common.delete')}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader title={t('clients.title')} />

      <ErrorMessage message={error || ''} className="mb-4" />

      <Card
        title={editingId ? t('clients.edit') : t('clients.create')}
        className="mb-6"
      >
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <Input
            label={t('clients.name')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('clients.namePlaceholder')}
            required
          />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregar notas u observaciones sobre el cliente"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 resize-none"
              rows={3}
            />
          </div>
          <div className="md:col-span-2 flex gap-3">
            <Button type="submit" isLoading={saving} disabled={saving}>
              {saving
                ? t('common.saving')
                : editingId
                  ? t('common.update')
                  : t('common.create')}
            </Button>
            {editingId && (
              <Button variant="secondary" type="button" onClick={resetForm}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Table
        columns={columns}
        data={clients}
        loading={loading}
        emptyMessage={t('clients.noClients')}
        keyExtractor={(client) => client.id}
      />
    </div>
  )
}
