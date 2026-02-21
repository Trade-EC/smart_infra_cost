'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { TranslationKey } from '@/lib/i18n/useTranslation'
import { NAVIGATION_ITEMS } from '@/constants'
import type { NavItem } from '@/types'
import { isOwner } from '@/lib/roles'

export default function Sidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userRole, setUserRole] = useState<'owner' | 'admin' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUserRole()
  }, [])

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.role) {
        setUserRole(user.user_metadata.role)
      } else {
        setUserRole('admin') // Por defecto es admin si no tiene rol
      }
    } catch (error) {
      console.error('Error al obtener rol del usuario:', error)
      setUserRole('admin')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Filtrar items de navegación basándose en el rol
  const filteredItems = NAVIGATION_ITEMS.filter((item: NavItem) => {
    // Solo mostrar "usuarios" si el usuario es Owner
    if (item.key === 'users') {
      return isOwner({ user_metadata: { role: userRole } })
    }
    return true
  })

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      {/* Logo/Header */}
      <div className="flex h-16 items-center justify-center border-b border-gray-800 px-4">
        <h1 className="text-xl font-bold">{t('appName')}</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {!loading && filteredItems.map((item: NavItem) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{t(`nav.${item.key}` as TranslationKey)}</span>
            </Link>
          )
        })}
      </nav>

      {/* Logout Button */}
      <div className="border-t border-gray-800 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <span className="text-lg">🚪</span>
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </div>
  )
}

