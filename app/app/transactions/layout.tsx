import { requireFullAccess } from '@/lib/auth'

export default async function TransactionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFullAccess()
  return <>{children}</>
}
