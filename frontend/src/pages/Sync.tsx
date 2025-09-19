import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Play, Square, Settings, X } from 'lucide-react'
import { Repository } from '@/types'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

export const Sync: React.FC = () => {
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncingRepositories, setSyncingRepositories] = useState<Set<string>>(new Set())
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const previousStatuses = useRef<Record<string, string>>({})

  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch scheduler logs
  const { data: schedulerLogs } = useQuery({
    queryKey: ['scheduler-logs'],
    queryFn: async () => {
      const response = await api.get('/sync/scheduler/logs')
      return response.data.data
    },
    enabled: !!user,
    retry: false,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  })

  // Fetch scheduler configuration
  const { data: schedulerConfig, refetch: refetchSchedulerConfig } = useQuery({
    queryKey: ['scheduler-config'],
    queryFn: async () => {
      const response = await api.get('/sync/scheduler/config')
      return response.data.data
    },
    enabled: !!user,
    retry: false,
  })

  // Update scheduler configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const response = await api.put('/sync/scheduler/config', config)
      return response.data
    },
    onSuccess: () => {
      refetchSchedulerConfig()
      setIsConfigModalOpen(false)
      toast.success('Configuração da sincronização automática atualizada!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar configuração: ${error.response?.data?.message || 'Erro desconhecido'}`)
    }
  })

  // Fetch repositories
  const { data: repositoriesData, isLoading, error: reposError } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const response = await api.get('/repositories')
      return response.data
    },
    enabled: !!user, // Só executar se o usuário estiver logado
  })

  // Fetch sync status for all repositories
  const { data: syncStatuses, error: syncStatusError } = useQuery({
    queryKey: ['sync-statuses'],
    queryFn: async () => {
      const statuses = await Promise.all(
        repositoriesData?.data?.map(async (repo: Repository) => {
          try {
            const response = await api.get(`/sync/${repo.id}/status`)
            return { repositoryId: repo.id, ...response.data.data }
          } catch (error: any) {
            // Se for erro de permissão, retornar status específico
            if (error.response?.status === 401) {
              return { repositoryId: repo.id, status: 'no_permission', error: 'Sem permissão para visualizar status' }
            }
            return { repositoryId: repo.id, status: 'unknown', error: 'Erro ao buscar status' }
          }
        }) || []
      )
      return statuses
    },
    enabled: !!repositoriesData?.data && !!user,
    refetchInterval: (data) => {
      // Se há dados com status de 'no_permission', não fazer polling
      if (Array.isArray(data) && data.some((status: any) => status.status === 'no_permission')) {
        return false
      }
      
      // Refetch every 2 seconds if there are running jobs OR if we have syncing repositories
      const hasRunningJobs = Array.isArray(data) && data.some((status: any) => 
        status.status === 'running' || status.status === 'pending'
      )
      const hasSyncingRepos = syncingRepositories.size > 0
      
      console.log('Sync status polling:', { hasRunningJobs, hasSyncingRepos, syncingRepos: Array.from(syncingRepositories) })
      return (hasRunningJobs || hasSyncingRepos) ? 2000 : false
    },
    refetchIntervalInBackground: true,
  })

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async ({ repositoryId, syncType }: { repositoryId: string; syncType: 'full' | 'incremental' }) => {
      const response = await api.post(`/sync/${repositoryId}`, { syncType })
      return response.data
    },
    onSuccess: (_data, { repositoryId }) => {
      // Forçar refetch imediato do status
      queryClient.invalidateQueries({ queryKey: ['sync-statuses'] })
      queryClient.refetchQueries({ queryKey: ['sync-statuses'] })
      
      const repoName = repositoriesData?.data?.find((repo: Repository) => repo.id === repositoryId)?.name
      toast.success(`Sincronização iniciada para ${repoName || 'repositório'}`)
    },
    onError: (error: any, { repositoryId }) => {
      const repoName = repositoriesData?.data?.find((repo: Repository) => repo.id === repositoryId)?.name
      toast.error(`Erro ao iniciar sincronização para ${repoName || 'repositório'}: ${error.response?.data?.message || 'Erro desconhecido'}`)
    }
  })

  // Cancel sync mutation
  const cancelSyncMutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      await api.delete(`/sync/${repositoryId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-statuses'] })
    },
  })

  const handleSync = (repositoryId: string, syncType: 'full' | 'incremental' = 'incremental') => {
    // Adicionar repositório à lista de sincronização
    setSyncingRepositories(prev => new Set(prev).add(repositoryId))
    
    syncMutation.mutate({ repositoryId, syncType }, {
      onSettled: () => {
        // Remover repositório da lista de sincronização após concluir (sucesso ou erro)
        setSyncingRepositories(prev => {
          const newSet = new Set(prev)
          newSet.delete(repositoryId)
          return newSet
        })
      }
    })
  }

  const handleCancelSync = (repositoryId: string) => {
    if (confirm('Tem certeza que deseja cancelar a sincronização?')) {
      cancelSyncMutation.mutate(repositoryId)
    }
  }

  const handleViewHistory = (repository: Repository) => {
    setSelectedRepository(repository)
    setIsHistoryModalOpen(true)
  }

  // Monitor status changes and show toasts
  useEffect(() => {
    if (Array.isArray(syncStatuses) && repositoriesData?.data) {
      syncStatuses.forEach((status: any) => {
        const previousStatus = previousStatuses.current[status.repositoryId]
        const currentStatus = status.status
        const repoName = repositoriesData.data.find((repo: Repository) => repo.id === status.repositoryId)?.name

        console.log('Status change detected:', { 
          repositoryId: status.repositoryId, 
          repoName, 
          previousStatus, 
          currentStatus 
        })

        if (previousStatus && previousStatus !== currentStatus) {
          if (currentStatus === 'completed') {
            toast.success(`Sincronização concluída para ${repoName || 'repositório'}`)
          } else if (currentStatus === 'failed') {
            toast.error(`Sincronização falhou para ${repoName || 'repositório'}: ${status.error || 'Erro desconhecido'}`)
          } else if (currentStatus === 'running') {
            toast.success(`Sincronização iniciada para ${repoName || 'repositório'}`)
          }
        }

        previousStatuses.current[status.repositoryId] = currentStatus
      })
    }
  }, [syncStatuses, repositoriesData?.data])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Sincronizando'
      case 'completed':
        return 'Concluído'
      case 'failed':
        return 'Falhou'
      case 'pending':
        return 'Pendente'
      default:
        return 'Desconhecido'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sincronização</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie a sincronização com Azure DevOps
            </p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-600">Carregando repositórios...</span>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (reposError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sincronização</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie a sincronização com Azure DevOps
            </p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-center text-red-600">
            <AlertCircle className="h-8 w-8 mr-2" />
            <span>Erro ao carregar repositórios: {reposError.message}</span>
          </div>
        </div>
      </div>
    )
  }

  // Verificar se há erro de permissão específico (não bloquear toda a página)
  const hasStatusPermissionError = syncStatusError?.response?.status === 401 || 
    (Array.isArray(syncStatuses) && syncStatuses.some((s: any) => s.status === 'no_permission'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sincronização</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie a sincronização com Azure DevOps
          </p>
          <p className="mt-1 text-xs text-gray-400">
            A sincronização é automática: completa para repositórios nunca sincronizados, incremental para os demais
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            className="btn btn-primary btn-md"
            onClick={() => {
              if (!repositoriesData?.data) return
              
              setIsSyncingAll(true)
              
              // Adicionar todos os repositórios ao estado de sincronização
              const allRepoIds = new Set(repositoriesData.data.map(repo => repo.id))
              setSyncingRepositories(allRepoIds)
              
              // Contar quantos repositórios serão sincronizados
              let completedSyncs = 0
              const totalRepos = repositoriesData.data.length
              
              repositoriesData.data.forEach((repo: Repository) => {
                syncMutation.mutate({ repositoryId: repo.id, syncType: 'incremental' }, {
                  onSettled: () => {
                    completedSyncs++
                    
                    // Remover repositório específico da lista
                    setSyncingRepositories(prev => {
                      const newSet = new Set(prev)
                      newSet.delete(repo.id)
                      return newSet
                    })
                    
                    // Resetar estado geral quando todos terminarem
                    if (completedSyncs >= totalRepos) {
                      setIsSyncingAll(false)
                    }
                  }
                })
              })
            }}
            disabled={isSyncingAll}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
            Sincronizar Todos
          </button>
        </div>
      </div>

      {/* Aviso sobre permissão de status */}
      {hasStatusPermissionError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Aviso de Permissão
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Você não tem permissão para visualizar o status detalhado de sincronização, 
                  mas pode executar sincronizações e visualizar o histórico.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <RefreshCw className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total de Repositórios</p>
              <p className="text-2xl font-bold text-gray-900">
                {repositoriesData?.data?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Sincronizados</p>
              <p className="text-2xl font-bold text-gray-900">
                {Array.isArray(syncStatuses) ? syncStatuses.filter((status: any) => status.status === 'completed').length : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Em Andamento</p>
              <p className="text-2xl font-bold text-gray-900">
                {Array.isArray(syncStatuses) ? syncStatuses.filter((status: any) => status.status === 'running').length : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Falharam</p>
              <p className="text-2xl font-bold text-gray-900">
                {Array.isArray(syncStatuses) ? syncStatuses.filter((status: any) => status.status === 'failed').length : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sincronização Automática */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Sincronização Automática</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configuração e histórico de execuções automáticas
              </p>
            </div>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="btn btn-primary btn-sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {schedulerLogs && schedulerLogs.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Últimas Execuções</h4>
              <div className="space-y-2">
                {schedulerLogs.slice(0, 5).map((log: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm text-gray-900">
                        {log.success ? 'Sincronização concluída' : 'Sincronização falhou'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(log.executedAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p>Nenhuma execução automática registrada</p>
              <p className="text-sm">Configure a sincronização automática para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* Repositories List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Repositórios</h3>
        </div>
        
        {!repositoriesData?.data || repositoriesData.data.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <RefreshCw className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p>Nenhum repositório configurado</p>
            <p className="text-sm">Adicione repositórios em &quot;Repositórios&quot; para começar a sincronizar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Repositório
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Sincronização
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pull Requests
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {repositoriesData?.data?.map((repository: Repository) => {
                  const status = Array.isArray(syncStatuses) ? syncStatuses.find((s: any) => s.repositoryId === repository.id) : null
                  return (
                    <tr key={repository.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {repository.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {repository.organization}/{repository.project}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {hasStatusPermissionError ? (
                            <>
                              <AlertCircle className="h-4 w-4 text-gray-400" />
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Sem permissão
                              </span>
                            </>
                          ) : (
                            <>
                              {getStatusIcon(status?.status || 'unknown')}
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status?.status || 'unknown')}`}>
                                {getStatusText(status?.status || 'unknown')}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {status?.completedAt ? 
                          new Date(status.completedAt).toLocaleString('pt-BR') : 
                          'Nunca sincronizado'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {repository._count?.pullRequests || 0} PRs
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {status?.status === 'running' ? (
                            <button
                              onClick={() => handleCancelSync(repository.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Cancelar sincronização"
                            >
                              <Square className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSync(repository.id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Sincronizar (automático: completa se nunca sincronizado, incremental se já sincronizado)"
                              disabled={syncingRepositories.has(repository.id)}
                            >
                              {syncingRepositories.has(repository.id) ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleViewHistory(repository)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Ver histórico"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Modal */}
      {isHistoryModalOpen && selectedRepository && (
        <SyncHistoryModal
          repository={selectedRepository}
          onClose={() => {
            setIsHistoryModalOpen(false)
            setSelectedRepository(null)
          }}
        />
      )}
    </div>
  )
}

// Sync History Modal Component
interface SyncHistoryModalProps {
  repository: Repository
  onClose: () => void
}

const SyncHistoryModal: React.FC<SyncHistoryModalProps> = ({
  repository,
  onClose,
}) => {
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
  })

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['sync-history', repository.id, pagination],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(pagination).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })
      
      const response = await api.get(`/sync/${repository.id}/history?${params.toString()}`)
      return response.data
    },
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Histórico de Sincronização - {repository.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Iniciado em
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concluído em
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Erro
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : !historyData?.data || historyData.data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      Nenhum histórico encontrado
                    </td>
                  </tr>
                ) : (
                  historyData?.data?.map((job: any) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(job.status)}
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.startedAt ? new Date(job.startedAt).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.completedAt ? new Date(job.completedAt).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {job.error ? (
                          <div className="max-w-xs truncate" title={job.error}>
                            {job.error}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {historyData?.pagination && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={!historyData.pagination.hasPrev}
                  className="btn btn-secondary btn-sm"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!historyData.pagination.hasNext}
                  className="btn btn-secondary btn-sm"
                >
                  Próximo
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando{' '}
                    <span className="font-medium">
                      {(historyData.pagination.page - 1) * historyData.pagination.pageSize + 1}
                    </span>{' '}
                    a{' '}
                    <span className="font-medium">
                      {Math.min(
                        historyData.pagination.page * historyData.pagination.pageSize,
                        historyData.pagination.total
                      )}
                    </span>{' '}
                    de{' '}
                    <span className="font-medium">{historyData.pagination.total}</span>{' '}
                    resultados
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={!historyData.pagination.hasPrev}
                      className="btn btn-secondary btn-sm"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!historyData.pagination.hasNext}
                      className="btn btn-secondary btn-sm"
                    >
                      Próximo
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configuração */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Configuração da Sincronização Automática
              </h3>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              {schedulerConfig ? (
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target as HTMLFormElement)
                  const config = {
                    defaultIntervalMinutes: parseInt(formData.get('interval') as string),
                    maxConcurrentRepos: parseInt(formData.get('maxConcurrent') as string),
                    delayBetweenReposSeconds: parseInt(formData.get('delayBetween') as string),
                    maxRetries: parseInt(formData.get('maxRetries') as string),
                    retryDelayMinutes: parseInt(formData.get('retryDelay') as string),
                  }
                  updateConfigMutation.mutate(config)
                }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="interval" className="block text-sm font-medium text-gray-700 mb-2">
                        Intervalo entre sincronizações (minutos)
                      </label>
                      <input
                        type="number"
                        id="interval"
                        name="interval"
                        defaultValue={schedulerConfig.defaultIntervalMinutes || 30}
                        min="1"
                        max="1440"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Entre 1 minuto e 24 horas</p>
                    </div>
                    
                    <div>
                      <label htmlFor="maxConcurrent" className="block text-sm font-medium text-gray-700 mb-2">
                        Máximo de repositórios simultâneos
                      </label>
                      <input
                        type="number"
                        id="maxConcurrent"
                        name="maxConcurrent"
                        defaultValue={schedulerConfig.maxConcurrentRepos || 3}
                        min="1"
                        max="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Quantos repositórios sincronizar ao mesmo tempo</p>
                    </div>
                    
                    <div>
                      <label htmlFor="delayBetween" className="block text-sm font-medium text-gray-700 mb-2">
                        Delay entre repositórios (segundos)
                      </label>
                      <input
                        type="number"
                        id="delayBetween"
                        name="delayBetween"
                        defaultValue={schedulerConfig.delayBetweenReposSeconds || 30}
                        min="1"
                        max="300"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Tempo de espera entre cada repositório</p>
                    </div>
                    
                    <div>
                      <label htmlFor="maxRetries" className="block text-sm font-medium text-gray-700 mb-2">
                        Máximo de tentativas em caso de erro
                      </label>
                      <input
                        type="number"
                        id="maxRetries"
                        name="maxRetries"
                        defaultValue={schedulerConfig.maxRetries || 3}
                        min="0"
                        max="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Quantas vezes tentar novamente se falhar</p>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label htmlFor="retryDelay" className="block text-sm font-medium text-gray-700 mb-2">
                        Delay entre tentativas (minutos)
                      </label>
                      <input
                        type="number"
                        id="retryDelay"
                        name="retryDelay"
                        defaultValue={schedulerConfig.retryDelayMinutes || 5}
                        min="1"
                        max="60"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Tempo de espera antes de tentar novamente</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsConfigModalOpen(false)}
                      className="btn btn-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={updateConfigMutation.isPending}
                      className="btn btn-primary"
                    >
                      {updateConfigMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Configuração'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <RefreshCw className="h-8 w-8 mx-auto text-gray-400 mb-2 animate-spin" />
                  <p>Carregando configurações...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
