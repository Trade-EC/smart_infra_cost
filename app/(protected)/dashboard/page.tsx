import { getUser } from '@/lib/auth'

export default async function DashboardPage() {
  const user = await getUser()

  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold text-gray-900">
        Dashboard
      </h1>
      <p className="text-gray-600">
        Bienvenido, {user?.email}
      </p>
      <div className="mt-8 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">
          Resumen de Costos
        </h2>
        <p className="text-gray-600">
          Aquí irá el contenido principal de tu aplicación.
        </p>
      </div>
    </div>
  )
}

