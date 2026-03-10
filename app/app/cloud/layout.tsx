import { requireFullAccess } from '@/lib/auth'

export default async function AwsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFullAccess()
  return <>{children}</>
}
