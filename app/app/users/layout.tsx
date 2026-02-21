import { requireOwner } from '@/lib/auth'

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Solo los Owners pueden acceder a esta sección
  await requireOwner()

  return <>{children}</>
}
