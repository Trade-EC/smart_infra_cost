import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function Home() {
  const session = await getSession()
  
  // Si hay sesión, redirigir al dashboard protegido
  if (session) {
    redirect('/dashboard')
  }
  
  // Si no hay sesión, redirigir al login
  redirect('/login')
}
