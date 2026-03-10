import { requireFullAccess } from '@/lib/auth'

export default async function TarifasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFullAccess()
  return <>{children}</>
}
