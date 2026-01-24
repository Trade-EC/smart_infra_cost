'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  ApplicationsRepository,
  ClientsRepository,
  MonthlyCostsRepository,
} from '@/lib/repositories'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Application, Client } from '@/types'
import {
  PageHeader,
  Card,
  Input,
  Button,
  ErrorMessage,
} from '@/components/ui'

interface SelectedClient {
  clientId: string
  clientName: string
}

export default function CostsPage() {
  const { t } = useTranslation()
  const supabase = useMemo(() => createClient(), [])
  const applicationsRepo = useMemo(() => new ApplicationsRepository(supabase), [supabase])
  const clientsRepo = useMemo(() => new ClientsRepository(supabase), [supabase])
  const monthlyCostsRepo = useMemo(() => new MonthlyCostsRepository(supabase), [supabase])
  
  const [month, setMonth] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set())
  const [allocations, setAllocations] = useState<Record<string, SelectedClient[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadApplications()
    loadClients()
  }, [])

  const loadApplications = async () => {
    try {
      const data = await applicationsRepo.getAll()
      setApplications(data)
    } catch (err: any) {
      setError(err.message || t('costs.loadError'))
    }
  }

  const loadClients = async () => {
    try {
      const data = await clientsRepo.getAll()
      setClients(data)
    } catch (err: any) {
      console.error('Error loading clients:', err)
    }
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
      setError(t('costs.noClients'))
      return
    }

    const current = allocations[appId] || []
    const availableClients = clients.filter(
      (c) => !current.some((a) => a.clientId === c.id)
    )

    if (availableClients.length === 0) {
      setError(t('costs.allClientsAssigned'))
      return
    }

    const newClient = availableClients[0]
    setAllocations({
      ...allocations,
      [appId]: [...current, { clientId: newClient.id, clientName: newClient.name }],
    })
    setError(null)
  }

  const removeClientFromAllocation = (appId: string, clientId: string) => {
    const current = allocations[appId] || []
    setAllocations({
      ...allocations,
      [appId]: current.filter((c) => c.clientId !== clientId),
    })
  }

  const calculateDistribution = (appId: string) => {
    const app = applications.find((a) => a.id === appId)
    const selectedClients = allocations[appId] || []

    if (!app || selectedClients.length === 0) return null

    const amountPerClient = app.price / selectedClients.length
    return { amountPerClient, total: app.price }
  }

  const handleCreateMonth = async () => {
    setError(null)

    if (!month) {
      setError(t('costs.selectMonth'))
      return
    }

    if (selectedApplications.size === 0) {
      setError(t('costs.selectApplication'))
      return
    }

    // Validar que todas las aplicaciones tengan clientes asignados
    for (const appId of selectedApplications) {
      if (!allocations[appId] || allocations[appId].length === 0) {
        const appName = applications.find((a) => a.id === appId)?.name || ''
        setError(t('costs.assignClient', { name: appName }))
        return
      }
    }

    setLoading(true)

    try {
      const monthDate = new Date(month + '-01')
      const totalAmount = Array.from(selectedApplications).reduce((sum, appId) => {
        const app = applications.find((a) => a.id === appId)
        return sum + (app?.price || 0)
      }, 0)

      const allocationsData = Array.from(selectedApplications).map((appId) => {
        const app = applications.find((a) => a.id === appId)
        const selectedClients = allocations[appId] || []
        return {
          applicationId: appId,
          applicationPrice: app?.price || 0,
          clientIds: selectedClients.map((c) => c.clientId),
        }
      })

      await monthlyCostsRepo.create({
        month: monthDate.toISOString().split('T')[0],
        totalAmount,
        allocations: allocationsData,
      })

      toast.success(t('costs.createSuccess'))
      setMonth('')
      setSelectedApplications(new Set())
      setAllocations({})
    } catch (err: any) {
      setError(err.message || t('costs.createError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('costs.title')} />

      <ErrorMessage message={error || ''} className="mb-4" />

      <Card title={t('costs.createMonth')} className="mb-6">
        <div className="mb-4">
          <Input
            label={t('common.month')}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button
          onClick={handleCreateMonth}
          disabled={loading || !month || selectedApplications.size === 0}
          isLoading={loading}
        >
          {loading ? t('common.creating') : t('costs.createMonth')}
        </Button>
      </Card>

      <Card title={t('costs.availableApplications')}>
        <div className="space-y-4">
          {applications.length === 0 ? (
            <p className="text-sm text-gray-500">{t('applications.noApplications')}</p>
          ) : (
            applications.map((app) => {
              const isSelected = selectedApplications.has(app.id)
              const distribution = calculateDistribution(app.id)
              const selectedClients = allocations[app.id] || []

              return (
                <div
                  key={app.id}
                  className={`rounded-lg border-2 p-4 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
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
                        <p className="text-sm text-gray-500">
                          ${app.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => addClientToAllocation(app.id)}
                      >
                        {t('costs.addClient')}
                      </Button>
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
                              ${distribution
                                ? distribution.amountPerClient.toFixed(2)
                                : '0.00'}
                            </span>
                            <button
                              onClick={() =>
                                removeClientFromAllocation(app.id, client.clientId)
                              }
                              className="text-red-600 hover:text-red-800"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      {selectedClients.length === 0 && (
                        <p className="text-sm text-gray-500">
                          {t('costs.addClientsToDistribute')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
