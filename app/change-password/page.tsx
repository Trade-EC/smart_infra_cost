'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/useTranslation'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'

export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Verificar si el usuario realmente debe cambiar la contraseña
      if (!user.user_metadata?.must_change_password) {
        router.push('/')
        return
      }

      setChecking(false)
    } catch (error) {
      router.push('/login')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!newPassword.trim()) {
      setError('La nueva contraseña es requerida')
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    try {
      // Actualizar la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      // Remover el flag de must_change_password
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          must_change_password: false,
        },
      })

      if (metadataError) throw metadataError

      // Redirigir al dashboard
      router.push('/')
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Verificando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Cambiar Contraseña
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Debes cambiar tu contraseña antes de continuar
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleChangePassword}>
          <ErrorMessage message={error || ''} />

          <div className="space-y-4">
            <PasswordInput
              label="Nueva Contraseña"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ingresa tu nueva contraseña"
            />

            <PasswordInput
              label="Confirmar Nueva Contraseña"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirma tu nueva contraseña"
            />
          </div>

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading}
              isLoading={loading}
              className="w-full"
            >
              {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
