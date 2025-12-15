'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Application {
  id: string
  name: string
  client_name: string
  price: number
}

interface Client {
  id: string
  name: string
}

interface SelectedClient {
  clientId: string
  clientName: string
}

export default function CostsPage() {
  const [month, setMonth] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set())
  const [allocations, setAllocations] = useState<Record<string, SelectedClient[]>>({})
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadApplications()
    loadClients()
  }, [])

  const loadApplications = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .order('date', { ascending: false })
    setApplications(data || [])
  }

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })
    setClients(data || [])
  }

  const toggleApplication = (appId: string) => {
    const newSelected = new Set(selectedApplications)
    if (newSelected.has(appId)) {
      newSelected.delete(appId)
      const newAllocations = { ...allocations }
      delete newAllocations[appId]
      setAllocations(newAllocations)
    } else {
      newSelected.add(appId)
    }
    setSelectedApplications(newSelected)
  }

  const addClientToAllocation = (appId: string) => {
    if (clients.length === 0) {
      alert('Primero debes crear clientes')
      return
    }
    
    const current = allocations[appId] || []
    const availableClients = clients.filter(
      c => !current.some(a => a.clientId === c.id)
    )
    
    if (availableClients.length === 0) {
      alert('Todos los clientes ya están asignados')
      return
    }

    const newClient = availableClients[0]
    setAllocations({
      ...allocations,
      [appId]: [...current, { clientId: newClient.id, clientName: newClient.name }]
    })
  }

  const removeClientFromAllocation = (appId: string, clientId: string) => {
    const current = allocations[appId] || []
    setAllocations({
      ...allocations,
      [appId]: current.filter(c => c.clientId !== clientId)
    })
  }

  const calculateDistribution = (appId: string) => {
    const app = applications.find(a => a.id === appId)
    const selectedClients = allocations[appId] || []
    
    if (!app || selectedClients.length === 0) return null
    
    const amountPerClient = app.price / selectedClients.length
    return { amountPerClient, total: app.price }
  }

  const handleCreateMonth = async () => {
    if (!month) {
      alert('Selecciona un mes')
      return
    }

    if (selectedApplications.size === 0) {
      alert('Selecciona al menos una aplicación')
      return
    }

    // Validar que todas las aplicaciones tengan clientes asignados
    for (const appId of selectedApplications) {
      if (!allocations[appId] || allocations[appId].length === 0) {
        alert(`La aplicación ${applications.find(a => a.id === appId)?.name} debe tener al menos un cliente asignado`)
        return
      }
    }

    setLoading(true)

    try {
      const { data: user } = await supabase.auth.getUser()
      const monthDate = new Date(month + '-01')

      // Crear el costo mensual
      const totalAmount = Array.from(selectedApplications).reduce((sum, appId) => {
        const app = applications.find(a => a.id === appId)
        return sum + (app?.price || 0)
      }, 0)

      const { data: monthlyCost, error: monthlyError } = await supabase
        .from('monthly_costs')
        .insert({
          month: monthDate.toISOString().split('T')[0],
          total_amount: totalAmount,
          created_by: user?.user?.id,
        })
        .select()
        .single()

      if (monthlyError) throw monthlyError

      // Crear asignaciones y distribuciones
      for (const appId of selectedApplications) {
        const app = applications.find(a => a.id === appId)
        const selectedClients = allocations[appId] || []
        
        if (!app) continue

        const { data: allocation, error: allocError } = await supabase
          .from('cost_allocations')
          .insert({
            monthly_cost_id: monthlyCost.id,
            application_id: appId,
            total_amount: app.price,
          })
          .select()
          .single()

        if (allocError) throw allocError

        const amountPerClient = app.price / selectedClients.length

        for (const client of selectedClients) {
          const { error: distError } = await supabase
            .from('cost_distributions')
            .insert({
              cost_allocation_id: allocation.id,
              client_id: client.clientId,
              allocation_percentage: (100 / selectedClients.length),
              allocated_amount: amountPerClient,
            })

          if (distError) throw distError
        }
      }

      alert('Mes creado exitosamente')
      setMonth('')
      setSelectedApplications(new Set())
      setAllocations({})
    } catch (error: any) {
      alert('Error al crear el mes: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Costos</h1>
      </div>

      {/* Crear Mes */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Crear Mes</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Mes
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleCreateMonth}
          disabled={loading || !month || selectedApplications.size === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear Mes'}
        </button>
      </div>

      {/* Lista de Aplicaciones */}
      <div className="rounded-lg bg-white shadow">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Aplicaciones Disponibles</h2>
          <div className="space-y-4">
            {applications.map((app) => {
              const isSelected = selectedApplications.has(app.id)
              const distribution = calculateDistribution(app.id)
              const selectedClients = allocations[app.id] || []

              return (
                <div
                  key={app.id}
                  className={`rounded-lg border-2 p-4 ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleApplication(app.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-semibold">{app.name}</p>
                        <p className="text-sm text-gray-500">${app.price.toFixed(2)}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <button
                        onClick={() => addClientToAllocation(app.id)}
                        className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                      >
                        + Cliente
                      </button>
                    )}
                  </div>

                  {isSelected && (
                    <div className="mt-4 space-y-2">
                      {selectedClients.map((client) => (
                        <div
                          key={client.clientId}
                          className="flex items-center justify-between rounded bg-white p-2"
                        >
                          <span>{client.clientName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              ${distribution ? distribution.amountPerClient.toFixed(2) : '0.00'}
                            </span>
                            <button
                              onClick={() => removeClientFromAllocation(app.id, client.clientId)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      {selectedClients.length === 0 && (
                        <p className="text-sm text-gray-500">
                          Agrega clientes para distribuir el costo
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

