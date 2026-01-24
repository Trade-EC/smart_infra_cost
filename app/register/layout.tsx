import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Si ya hay sesión, redirigir al dashboard
  const session = await getSession()
  if (session) {
    redirect('/dashboard')
  }

  return <>{children}</>
}


