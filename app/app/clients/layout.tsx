import { requireFullAccess } from '@/lib/auth'

export default async function ClientsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFullAccess()
  return <>{children}</>
}
