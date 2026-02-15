'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import {
  PageHeader,
  Card,
  Input,
  PasswordInput,
  Button,
  ErrorMessage,
  Table,
} from '@/components/ui'

interface User {
  id: string
  email: string
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
}

export default function UsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/users')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('users.loadError'))
      }
      const data = await response.json()
      setUsers(data)
    } catch (err: any) {
      setError(err.message || t('users.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setShowCreateForm(false)
    setEmail('')
    setPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError(t('users.emailRequired'))
      return
    }
    if (!password.trim()) {
      setError(t('users.passwordRequired'))
      return
    }
    if (password.length < 6) {
      setError(t('users.passwordTooShort'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('users.createError'))
      }

      await loadUsers()
      resetForm()
    } catch (err: any) {
      setError(err.message || t('users.createError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('users.deleteConfirm'))) return
    
    // Validar que el ID sea válido antes de hacer la petición
    if (!id || typeof id !== 'string' || id.trim() === '') {
      setError('ID de usuario inválido')
      return
    }

    try {
      setSaving(true)
      setError(null)
      
      // Codificar el ID para la URL
      const encodedId = encodeURIComponent(id.trim())
      const response = await fetch(`/api/users/${encodedId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('users.deleteError'))
      }

      await loadUsers()
    } catch (err: any) {
      setError(err.message || t('users.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'email',
      header: t('users.email'),
      className: 'font-medium text-gray-900',
    },
    {
      key: 'created_at',
      header: t('users.createdAt'),
      render: (user: User) =>
        new Date(user.created_at).toLocaleDateString('es-ES'),
    },
    {
      key: 'last_sign_in_at',
      header: 'Último acceso',
      render: (user: User) =>
        user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleDateString('es-ES')
          : 'Nunca',
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (user: User) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(user.id)}
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
      <PageHeader title={t('users.title')} />

      <ErrorMessage message={error || ''} className="mb-4" />

      {!showCreateForm ? (
        <div className="mb-6">
          <Button onClick={() => setShowCreateForm(true)}>
            {t('users.create')}
          </Button>
        </div>
      ) : (
        <Card title={t('users.create')} className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('users.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('users.emailPlaceholder')}
              required
            />
            <PasswordInput
              label={t('users.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('users.passwordPlaceholder')}
              required
            />
            <p className="text-sm text-gray-600">
              {t('users.mustChangePassword')}
            </p>
            <div className="flex gap-3">
              <Button type="submit" isLoading={saving} disabled={saving}>
                {saving ? t('common.saving') : t('common.create')}
              </Button>
              <Button variant="secondary" type="button" onClick={resetForm}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Table
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage={t('users.noUsers')}
        keyExtractor={(user) => user.id}
      />
    </div>
  )
}
