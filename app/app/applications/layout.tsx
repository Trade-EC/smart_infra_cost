import { requireFullAccess } from '@/lib/auth'

export default async function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFullAccess()
  return <>{children}</>
}
