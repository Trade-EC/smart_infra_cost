'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavItem {
  name: string
  href: string
  icon: string
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Clientes', href: '/clients', icon: '👥' },
  { name: 'Aplicaciones', href: '/applications', icon: '📱' },
  { name: 'Costos', href: '/costs', icon: '💰' },
  { name: 'Transacciones', href: '/transactions', icon: '💳' },
  { name: 'Reportes', href: '/reports', icon: '📈' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      {/* Logo/Header */}
      <div className="flex h-16 items-center justify-center border-b border-gray-800 px-4">
        <h1 className="text-xl font-bold">CostManager TRD</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.name}</span>
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
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  )
}

