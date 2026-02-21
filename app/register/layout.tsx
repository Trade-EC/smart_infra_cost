import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    // Si ya hay sesión válida, redirigir al dashboard
    const user = await getUser()
    if (user) {
      redirect('/app/dashboard')
    }
  } catch (error) {
    // Si hay error al obtener el usuario, continuar mostrando el registro
    // Esto evita bucles de redirección
    console.error('Error al verificar sesión en registro:', error)
  }

  return <>{children}</>
}


