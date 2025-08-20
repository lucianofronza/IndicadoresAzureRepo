import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Search, GitBranch, BarChart3, Eye, EyeOff } from 'lucide-react'
import { Repository, CreateRepositoryData, UpdateRepositoryData } from '@/types'
import api from '@/services/api'

export const Repositories: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false)
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    teamId: '',
    organization: '',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    sortBy: 'name',
    sortOrder: 'asc' as 'asc' | 'desc',
  })

  const queryClient = useQueryClient()

  // Fetch repositories
  const { data: repositoriesData, isLoading } = useQuery({
    queryKey: ['repositories', pagination, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries({ ...pagination, ...filters }).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })
      
      const response = await api.get(`/repositories?${params.toString()}`)
      return response.data
    },
  })

  // Fetch teams for filters
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await api.get('/teams')
      return response.data.data
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateRepositoryData) => {
      const response = await api.post('/repositories', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      setIsCreateModalOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRepositoryData }) => {
      const response = await api.put(`/repositories/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      setIsEditModalOpen(false)
      setSelectedRepository(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/repositories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
    },
  })

  const handleCreate = (data: CreateRepositoryData | UpdateRepositoryData) => {
    createMutation.mutate(data as CreateRepositoryData)
  }

  const handleEdit = (data: CreateRepositoryData | UpdateRepositoryData) => {
    if (selectedRepository) {
      updateMutation.mutate({ id: selectedRepository.id, data: data as UpdateRepositoryData })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este repositório?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleEditClick = (repository: Repository) => {
    setSelectedRepository(repository)
    setIsEditModalOpen(true)
  }

  const handleStatsClick = (repository: Repository) => {
    setSelectedRepository(repository)
    setIsStatsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repositórios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie os repositórios do Azure DevOps
          </p>
        </div>
        <button 
          className="btn btn-primary btn-md"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Novo Repositório
        </button>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nome do repositório..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <select
              value={filters.teamId}
              onChange={(e) => setFilters(prev => ({ ...prev, teamId: e.target.value }))}
              className="select w-full"
            >
              <option value="">Todos os times</option>
              {teams?.map((team: any) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organização
            </label>
            <input
              type="text"
              placeholder="Nome da organização..."
              value={filters.organization}
              onChange={(e) => setFilters(prev => ({ ...prev, organization: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ search: '', teamId: '', organization: '' })}
              className="btn btn-secondary btn-md w-full"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Repositório
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organização/Projeto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pull Requests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : repositoriesData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Nenhum repositório encontrado
                  </td>
                </tr>
              ) : (
                repositoriesData?.data?.map((repository: Repository) => (
                  <tr key={repository.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <GitBranch className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {repository.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{repository.organization}</div>
                        <div className="text-gray-500">{repository.project}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {repository.team?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={repository.url}>
                        <a 
                          href={repository.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 hover:underline"
                        >
                          {repository.url}
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {repository._count?.pullRequests || 0} PRs
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(repository.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleStatsClick(repository)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver estatísticas"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditClick(repository)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Editar repositório"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(repository.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir repositório"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {repositoriesData?.pagination && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!repositoriesData.pagination.hasPrev}
                className="btn btn-secondary btn-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!repositoriesData.pagination.hasNext}
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
                    {(repositoriesData.pagination.page - 1) * repositoriesData.pagination.pageSize + 1}
                  </span>{' '}
                  a{' '}
                  <span className="font-medium">
                    {Math.min(
                      repositoriesData.pagination.page * repositoriesData.pagination.pageSize,
                      repositoriesData.pagination.total
                    )}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium">{repositoriesData.pagination.total}</span>{' '}
                  resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!repositoriesData.pagination.hasPrev}
                    className="btn btn-secondary btn-sm"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!repositoriesData.pagination.hasNext}
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

      {/* Create Modal */}
      {isCreateModalOpen && (
        <RepositoryModal
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setIsCreateModalOpen(false)}
          teams={teams}
        />
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedRepository && (
        <RepositoryModal
          mode="edit"
          repository={selectedRepository}
          onSubmit={handleEdit}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedRepository(null)
          }}
          teams={teams}
        />
      )}

      {/* Stats Modal */}
      {isStatsModalOpen && selectedRepository && (
        <RepositoryStatsModal
          repository={selectedRepository}
          onClose={() => {
            setIsStatsModalOpen(false)
            setSelectedRepository(null)
          }}
        />
      )}
    </div>
  )
}

// Repository Stats Modal Component
interface RepositoryStatsModalProps {
  repository: Repository
  onClose: () => void
}

const RepositoryStatsModal: React.FC<RepositoryStatsModalProps> = ({ repository, onClose }) => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['repository-stats', repository.id],
    queryFn: async () => {
      const response = await api.get(`/repositories/${repository.id}/stats`)
      return response.data.data
    },
    enabled: !!repository.id,
  })

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              📊 Estatísticas - {repository.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Carregando estatísticas...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">Erro ao carregar estatísticas</p>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800">Organização</h4>
                  <p className="text-lg font-semibold text-blue-900">{stats.organization}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800">Projeto</h4>
                  <p className="text-lg font-semibold text-green-900">{stats.project}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-800">Time</h4>
                  <p className="text-lg font-semibold text-purple-900">{stats.team || 'Não atribuído'}</p>
                </div>
              </div>

              {/* Estatísticas Principais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">Pull Requests</h4>
                  <p className="text-2xl font-bold text-gray-900">{stats.totals.pullRequests}</p>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">PRs Mesclados</h4>
                  <p className="text-2xl font-bold text-green-600">{stats.totals.mergedPRs}</p>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">PRs Abertos</h4>
                  <p className="text-2xl font-bold text-blue-600">{stats.totals.openPRs}</p>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">Commits</h4>
                  <p className="text-2xl font-bold text-gray-900">{stats.totals.commits}</p>
                </div>
              </div>

              {/* Estatísticas Secundárias */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">Reviews</h4>
                  <p className="text-2xl font-bold text-gray-900">{stats.totals.reviews}</p>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">Comments</h4>
                  <p className="text-2xl font-bold text-gray-900">{stats.totals.comments}</p>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">Cycle Time (dias)</h4>
                  <p className="text-2xl font-bold text-gray-900">{stats.averages.cycleTimeDays?.toFixed(1) || '0.0'}</p>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg text-center">
                  <h4 className="text-sm font-medium text-gray-600">Arquivos Alterados</h4>
                  <p className="text-2xl font-bold text-gray-900">{stats.totals.filesChanged}</p>
                </div>
              </div>

              {/* Informações Adicionais */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Informações Adicionais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Última Sincronização:</span> {(repository as any).lastSyncAt ? 
                      new Date((repository as any).lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="btn btn-secondary btn-md"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Repository Modal Component
interface RepositoryModalProps {
  mode: 'create' | 'edit'
  repository?: Repository
  onSubmit: (data: CreateRepositoryData | UpdateRepositoryData) => void
  onClose: () => void
  teams: any[]
}

const RepositoryModal: React.FC<RepositoryModalProps> = ({
  mode,
  repository,
  onSubmit,
  onClose,
  teams,
}) => {
  const [formData, setFormData] = useState({
    name: repository?.name || '',
    organization: repository?.organization || '',
    project: repository?.project || '',
    url: repository?.url || '',
    azureId: (repository as any)?.azureId || '',
    personalAccessToken: (repository as any)?.personalAccessToken || '',
    teamId: repository?.teamId || '',
  })
  const [showToken, setShowToken] = useState(false)

  // Atualizar o formulário quando o repositório mudar
  useEffect(() => {
    const newFormData = {
      name: repository?.name || '',
      organization: repository?.organization || '',
      project: repository?.project || '',
      url: repository?.url || '',
      azureId: (repository as any)?.azureId || '',
      personalAccessToken: (repository as any)?.personalAccessToken || '',
      teamId: repository?.teamId || '',
    }
    setFormData(newFormData)
  }, [repository])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {mode === 'create' ? 'Novo Repositório' : 'Editar Repositório'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input w-full"
                placeholder="Nome do repositório"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organização *
              </label>
              <input
                type="text"
                required
                value={formData.organization}
                onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                className="input w-full"
                placeholder="Nome da organização Azure DevOps"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Projeto *
              </label>
              <input
                type="text"
                required
                value={formData.project}
                onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                className="input w-full"
                placeholder="Nome do projeto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL *
              </label>
              <input
                type="url"
                required
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                className="input w-full"
                placeholder="https://dev.azure.com/org/project/_git/repo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Azure ID (GUID)
              </label>
              <input
                type="text"
                value={formData.azureId}
                onChange={(e) => setFormData(prev => ({ ...prev, azureId: e.target.value }))}
                className="input w-full"
                placeholder="1852537c-c6f5-4ae5-bba9-45d9244c736a"
              />
              <p className="text-xs text-gray-500 mt-1">
                GUID do repositório no Azure DevOps (opcional para sincronização manual)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Personal Access Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={formData.personalAccessToken}
                  onChange={(e) => setFormData(prev => ({ ...prev, personalAccessToken: e.target.value }))}
                  className="input w-full pr-10"
                  placeholder="Token de acesso pessoal do Azure DevOps"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Token criptografado para autenticação com Azure DevOps (opcional)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <select
                value={formData.teamId}
                onChange={(e) => setFormData(prev => ({ ...prev, teamId: e.target.value }))}
                className="select w-full"
              >
                <option value="">Nenhum time</option>
                {teams?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
              >
                {mode === 'create' ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
