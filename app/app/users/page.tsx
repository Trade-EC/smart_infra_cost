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
  role?: string
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
  const [role, setRole] = useState<'owner' | 'admin'>('admin')
  const [editingRole, setEditingRole] = useState<{ userId: string; role: string } | null>(null)
  const [resettingPassword, setResettingPassword] = useState<{ userId: string; email: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')

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

  const handleUpdateRole = async (userId: string, newRole: 'owner' | 'admin') => {
    try {
      setSaving(true)
      setError(null)
      
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        const data = await response.json()
        // Si es un error 401 (no autenticado), redirigir al login
        if (response.status === 401) {
          window.location.href = '/login'
          return
        }
        throw new Error(data.error || 'Error al actualizar el rol')
      }

      await loadUsers()
      setEditingRole(null)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el rol')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (userId: string, userEmail: string) => {
    setResettingPassword({ userId, email: userEmail })
    setNewPassword('')
  }

  const handleSaveNewPassword = async () => {
    if (!resettingPassword) return

    if (!newPassword.trim()) {
      setError('La contraseña es requerida')
      return
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
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
        throw new Error(data.error || 'Error al restablecer la contraseña')
      }

      setResettingPassword(null)
      setNewPassword('')
      // Mostrar mensaje de éxito
      alert('Contraseña restablecida exitosamente. El usuario deberá cambiarla en el próximo inicio de sesión.')
    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña')
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
        // Si es un error 401 (no autenticado), redirigir al login
        if (response.status === 401) {
          window.location.href = '/login'
          return
        }
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
      key: 'role',
      header: 'Rol',
      render: (user: User) => {
        const userRole = user.role || 'admin'
        const isEditing = editingRole?.userId === user.id
        
        if (isEditing) {
          return (
            <select
              value={editingRole.role}
              onChange={(e) => setEditingRole({ userId: user.id, role: e.target.value })}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              disabled={saving}
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
            </select>
          )
        }
        
        return (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              userRole === 'owner' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {userRole === 'owner' ? 'Owner' : 'Admin'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingRole({ userId: user.id, role: userRole })}
              className="text-xs"
              disabled={saving}
            >
              Editar
            </Button>
          </div>
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
      header: 'Último acceso',
      render: (user: User) =>
        user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleDateString('es-ES')
          : 'Nunca',
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (user: User) => {
        const isEditing = editingRole?.userId === user.id
        
        return (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateRole(user.id, editingRole.role as 'owner' | 'admin')}
                  className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 hover:bg-green-100 hover:border-green-300"
                  disabled={saving}
                >
                  Guardar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingRole(null)}
                  className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetPassword(user.id, user.email)}
                  className="rounded-full bg-yellow-50 border border-yellow-200 px-3 py-1 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-300"
                  disabled={saving}
                >
                  Restablecer contraseña
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(user.id)}
                  className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-700 hover:bg-red-100 hover:border-red-300"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'owner' | 'admin')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
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

      {/* Modal para restablecer contraseña estilo AWS */}
      {resettingPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          
          {/* Contenedor del Modal */}
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden mx-4">
            
            {/* 1. Header con Título y botón X */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Restablecer contraseña
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
                  label="Nueva Contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresa la nueva contraseña"
                  required
                />

                <div className="flex items-start pt-2">
                  <input
                    type="checkbox"
                    id="must-change"
                    checked
                    readOnly
                    className="mt-1 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="must-change" className="ml-2 text-sm text-gray-700">
                    El usuario deberá cambiar esta contraseña en su próximo inicio de sesión
                  </label>
                </div>
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
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                >
                  Cancelar
                </button>
                
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-medium hover:bg-orange-600 shadow-sm flex items-center"
                >
                  {saving ? 'Guardando...' : 'Restablecer contraseña'}
                </button>
              </div>
            </form>
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
