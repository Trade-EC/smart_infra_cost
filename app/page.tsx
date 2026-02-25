import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function Home() {
  const session = await getSession()
  
  // Si hay sesión, redirigir a la aplicación
  if (session) {
    redirect('/app/reports')
  }
  
  // Si no hay sesión, redirigir al login
  redirect('/login')
}
