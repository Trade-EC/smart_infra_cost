export default async function ChangePasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Layout sin protección para permitir el cambio de contraseña
  return <>{children}</>
}
