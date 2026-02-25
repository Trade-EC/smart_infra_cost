import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Si ya hay sesión válida, redirigir a la aplicación
  const user = await getUser()
  if (user) {
    redirect('/app/reports')
  }

  return <>{children}</>
}


