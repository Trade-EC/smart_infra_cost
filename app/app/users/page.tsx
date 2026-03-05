'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import {
  PageHeader,
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
  role?: string
}

export default function UsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'owner' | 'admin' | 'reports'>('admin')
  const [editingUser, setEditingUser] = useState<{
    userId: string
    email: string
    role: string
  } | null>(null)
  const [resettingPassword, setResettingPassword] = useState<{ userId: string; email: string } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<{ userId: string; email: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      const response = await fetch('/api/users')
      if (!response.ok) {
        const data = await response.json()
        // Si es un error 401 (no autenticado), redirigir al login
        if (response.status === 401) {
          window.location.href = '/login'
          return
        }
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
    setRole('admin')
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
    if (password.length < 8) {
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
          role,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        // Si es un error 401 (no autenticado), redirigir al login
        if (response.status === 401) {
          window.location.href = '/login'
          return
        }
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

  const handleUpdateUser = async (
    userId: string,
    email: string,
    role: 'owner' | 'admin' | 'reports'
  ) => {
    if (!email.trim()) {
      setError(t('users.emailRequired'))
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 401) {
          window.location.href = '/login'
          return
        }
        throw new Error(data.error || t('users.updateError'))
      }

      await loadUsers()
      setEditingUser(null)
      setSuccess(t('users.updateSuccess'))
    } catch (err: any) {
      setError(err.message || t('users.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = (userId: string, userEmail: string) => {
    setResettingPassword({ userId, email: userEmail })
    setNewPassword('')
  }

  const handleSaveNewPassword = async () => {
    if (!resettingPassword) return

    if (!newPassword.trim()) {
      setError(t('users.passwordRequired'))
      return
    }

    if (newPassword.length < 8) {
      setError(t('users.passwordTooShort'))
      return
    }

    try {
      setSaving(true)
      setError(null)

      const encodedId = encodeURIComponent(resettingPassword.userId.trim())
      const response = await fetch(`/api/users/${encodedId}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      })

      if (!response.ok) {
        const data = await response.json()
        // Si es un error 401 (no autenticado), redirigir al login
        if (response.status === 401) {
          window.location.href = '/login'
          return
        }
        throw new Error(data.error || t('users.resetPasswordError'))
      }

      setResettingPassword(null)
      setNewPassword('')
      setSuccess(t('users.resetPasswordSuccess'))
    } catch (err: any) {
      setError(err.message || t('users.resetPasswordError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string, userEmail: string) => {
    setConfirmingDelete({ userId: id, email: userEmail })
  }

  const executeDelete = async () => {
    if (!confirmingDelete) return

    try {
      setSaving(true)
      setError(null)

      const encodedId = encodeURIComponent(confirmingDelete.userId.trim())
      const response = await fetch(`/api/users/${encodedId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 401) {
          window.location.href = '/login'
          return
        }
        throw new Error(data.error || t('users.deleteError'))
      }

      setConfirmingDelete(null)
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
      render: (user: User) => {
        if (editingUser?.userId === user.id) {
          return (
            <input
              type="email"
              value={editingUser.email}
              onChange={(e) =>
                setEditingUser({ ...editingUser, email: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              disabled={saving}
            />
          )
        }
        return <span className="font-medium text-gray-900">{user.email}</span>
      },
    },
    {
      key: 'role',
      header: t('users.role'),
      render: (user: User) => {
        const userRole = user.role || 'admin'
        if (editingUser?.userId === user.id) {
          return (
            <select
              value={editingUser.role}
              onChange={(e) =>
                setEditingUser({ ...editingUser, role: e.target.value })
              }
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              disabled={saving}
            >
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
              <option value="reports">Reports</option>
            </select>
          )
        }
        const badgeStyle =
          userRole === 'owner'
            ? 'bg-purple-100 text-purple-700'
            : userRole === 'reports'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
        const badgeLabel =
          userRole === 'owner'
            ? 'Owner'
            : userRole === 'reports'
              ? 'Reports'
              : 'Admin'
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeStyle}`}>
            {badgeLabel}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      header: t('users.createdAt'),
      render: (user: User) =>
        new Date(user.created_at).toLocaleDateString('es-ES'),
    },
    {
      key: 'last_sign_in_at',
      header: t('users.lastAccess'),
      render: (user: User) =>
        user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleDateString('es-ES')
          : t('users.neverAccessed'),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (user: User) => {
        const isEditing = editingUser?.userId === user.id

        return (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleUpdateUser(
                      user.id,
                      editingUser.email,
                      editingUser.role as 'owner' | 'admin' | 'reports'
                    )
                  }
                  className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300"
                  disabled={saving}
                >
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                  className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                  disabled={saving}
                >
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEditingUser({
                      userId: user.id,
                      email: user.email,
                      role: user.role || 'admin',
                    })
                  }
                  className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                  disabled={saving}
                >
                  {t('common.edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetPassword(user.id, user.email)}
                  className="rounded-full bg-yellow-50 border border-yellow-200 px-3 py-1 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-300"
                  disabled={saving}
                >
                  {t('users.resetPassword')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(user.id, user.email)}
                  className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-700 hover:bg-red-100 hover:border-red-300"
                  disabled={saving}
                >
                  {t('common.delete')}
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader title={t('users.title')} />

      {!showCreateForm && !resettingPassword && !confirmingDelete && (
        <ErrorMessage message={error || ''} className="mb-4" />
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="mb-6">
        <Button onClick={() => setShowCreateForm(true)}>
          {t('users.create')}
        </Button>
      </div>

      {/* Modal para crear usuario */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden mx-4">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <h3 className="text-lg font-bold text-gray-900">
                {t('users.create')}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              {/* Cuerpo */}
              <div className="p-6 space-y-5">
                <ErrorMessage message={error || ''} />
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('users.role')}
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'owner' | 'admin' | 'reports')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                    <option value="reports">Reports</option>
                  </select>
                </div>
                <p className="text-sm text-gray-600">
                  {t('users.mustChangePassword')}
                </p>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
                >
                  {saving ? t('common.creating') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para restablecer contraseña estilo AWS */}
      {resettingPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          
          {/* Contenedor del Modal */}
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden mx-4">
            
            {/* 1. Header con Título y botón X */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t('users.resetPassword')}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Usuario: {resettingPassword.email}
                </p>
              </div>
              <button 
                onClick={() => {
                  setResettingPassword(null)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {/* Icono X SVG */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulario que envuelve Cuerpo y Footer */}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveNewPassword(); }}>
              
              {/* 2. Cuerpo del Modal (Inputs) */}
              <div className="p-6 space-y-5">
                <ErrorMessage message={error || ''} className="mb-4" />

                <PasswordInput
                  label={t('auth.newPassword')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('users.newPasswordPlaceholder')}
                  required
                />

                <p className="text-sm text-gray-600 pt-2">
                  {t('users.mustChangePasswordNote')}
                </p>
              </div>

              {/* 3. Footer (Fondo Gris) */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setResettingPassword(null)
                    setNewPassword('')
                    setError(null)
                  }}
                  disabled={saving}
                  className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-orange-50 border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 hover:border-orange-300"
                >
                  {saving ? t('common.saving') : t('users.resetPassword')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden mx-4">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t('users.deleteTitle')}
                </h3>
              </div>
              <button
                onClick={() => {
                  setConfirmingDelete(null)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="p-6 space-y-3">
              <ErrorMessage message={error || ''} />
              <p className="text-sm font-medium text-gray-900">
                {confirmingDelete.email}
              </p>
              <p className="text-sm text-red-600">
                {t('users.deleteWarning')}
              </p>
            </div>

            {/* Footer */}
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

      {/* Tabla de usuarios */}
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
