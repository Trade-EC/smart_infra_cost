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
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'reports' | null>(null)
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    checkUserRole()
  }, [])

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.role) {
        setUserRole(user.user_metadata.role)
      } else {
        setUserRole('admin')
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

  const filteredItems = NAVIGATION_ITEMS.filter((item: NavItem) => {
    const fakeUser = { user_metadata: { role: userRole } }
    if (item.key === 'users') {
      return isOwner(fakeUser)
    }
    if (userRole === 'reports') {
      return item.key === 'reports'
    }
    return true
  })

  return (
    <aside
      className={`flex h-screen flex-col bg-gray-900 text-white transition-all duration-300 ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      {/* Botón colapsar/expandir + Logo/Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 px-3">
        {isExpanded && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className="truncate text-lg font-bold">{t('appName')}</h1>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white ${
            !isExpanded ? 'mx-auto' : ''
          }`}
          aria-label={isExpanded ? 'Colapsar menú' : 'Expandir menú'}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-hidden px-2 py-4">
        {!loading &&
          filteredItems.map((item: NavItem) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.key}
                href={item.href}
                title={!isExpanded ? t(`nav.${item.key}` as TranslationKey) : undefined}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isExpanded ? 'gap-3' : 'justify-center px-0'
                } ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="shrink-0 text-lg">{item.icon}</span>
                {isExpanded && (
                  <span className="min-w-0 truncate">
                    {t(`nav.${item.key}` as TranslationKey)}
                  </span>
                )}
              </Link>
            )
          })}
      </nav>

      {/* Logout */}
      <div className="shrink-0 border-t border-gray-800 p-2">
        <button
          type="button"
          onClick={handleLogout}
          title={!isExpanded ? t('nav.logout') : undefined}
          className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white ${
            isExpanded ? 'gap-3' : 'justify-center px-0'
          }`}
        >
          <span className="shrink-0 text-lg">🚪</span>
          {isExpanded && <span>{t('nav.logout')}</span>}
        </button>
      </div>
    </aside>
  )
}
