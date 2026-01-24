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
  const [email, setEmail] = useState('')

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
    setEmail('')
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
          email: email.trim() || null,
        })
      } else {
        await clientsRepo.create({
          name: name.trim(),
          email: email.trim() || null,
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
    setEmail(client.email || '')
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
    },
    {
      key: 'email',
      header: t('clients.email'),
      render: (client: Client) => client.email || '-',
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
      render: (client: Client) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(client)}
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
      ),
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
          <Input
            label={t('clients.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('clients.emailPlaceholder')}
          />
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
