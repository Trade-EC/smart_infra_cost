import { requireFullAccess } from '@/lib/auth'

export default async function CostsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFullAccess()
  return <>{children}</>
}
