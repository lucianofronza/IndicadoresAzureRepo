import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Search, Filter, Eye } from 'lucide-react'
import { Developer, CreateDeveloperData, UpdateDeveloperData, Stack } from '@/types'
import { Tags } from '@/components/Tags'
import { StackSelector } from '@/components/StackSelector'
import { PaginatedSelect } from '@/components/PaginatedSelect'
import { usePermissions } from '@/hooks/usePermissions'
import api from '@/services/api'

export const Developers: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    teamId: '',
    roleId: '',
    stackId: '',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    sortBy: 'name',
    sortOrder: 'asc' as 'asc' | 'desc',
  })

  const queryClient = useQueryClient()
  const { canWrite, canDelete } = usePermissions()

  // Fetch developers
  const { data: developersData, isLoading } = useQuery({
    queryKey: ['developers', pagination, filters],
    queryFn: async () => {
      console.log('Fetching developers...')
      const params = new URLSearchParams()
      Object.entries({ ...pagination, ...filters }).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })
      
      const response = await api.get(`/developers?${params.toString()}`)
      console.log('Developers response:', response.data)
      return response.data
    },
  })

  // Fetch related data for forms
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await api.get('/teams')
      return response.data.data
    },
  })

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/roles')
      return response.data.data
    },
  })

  const { data: stacks } = useQuery({
    queryKey: ['stacks'],
    queryFn: async () => {
      const response = await api.get('/stacks')
      return response.data.data
    },
  })



  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateDeveloperData) => {
      const response = await api.post('/developers', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developers'] })
      setIsCreateModalOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDeveloperData }) => {
      const response = await api.put(`/developers/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developers'] })
      setIsEditModalOpen(false)
      setSelectedDeveloper(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/developers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developers'] })
    },
  })

  const handleCreate = (data: CreateDeveloperData | UpdateDeveloperData) => {
    createMutation.mutate(data as CreateDeveloperData)
  }

  const handleEdit = (data: CreateDeveloperData | UpdateDeveloperData) => {
    if (selectedDeveloper) {
      updateMutation.mutate({ id: selectedDeveloper.id, data: data as UpdateDeveloperData })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este desenvolvedor?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleView = (developer: Developer) => {
    setSelectedDeveloper(developer)
    setIsViewModalOpen(true)
  }

  const handleEditClick = (developer: Developer) => {
    setSelectedDeveloper(developer)
    setIsEditModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Desenvolvedores</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie os desenvolvedores da organização
          </p>
        </div>
        {canWrite('developers') && (
          <button 
            className="btn btn-primary btn-md"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Nome ou login..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <PaginatedSelect
              value={filters.teamId}
              onChange={(value) => setFilters(prev => ({ ...prev, teamId: value }))}
              placeholder="Todos os times"
              endpoint="/teams"
              labelKey="name"
              valueKey="id"
              className="w-full"
              clearValue=""
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cargo
            </label>
            <PaginatedSelect
              value={filters.roleId}
              onChange={(value) => setFilters(prev => ({ ...prev, roleId: value }))}
              placeholder="Todos os cargos"
              endpoint="/roles"
              labelKey="name"
              valueKey="id"
              className="w-full"
              clearValue=""
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stack
            </label>
            <PaginatedSelect
              value={filters.stackId}
              onChange={(value) => setFilters(prev => ({ ...prev, stackId: value }))}
              placeholder="Todas as stacks"
              endpoint="/stacks"
              labelKey="name"
              valueKey="id"
              className="w-full"
              clearValue=""
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ search: '', teamId: '', roleId: '', stackId: '' })}
              className="btn btn-secondary w-full px-4"
              style={{ height: '2.6rem' }}
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
                  Desenvolvedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stacks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estatísticas
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : developersData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Nenhum desenvolvedor encontrado
                  </td>
                </tr>
              ) : (
                developersData?.data?.map((developer: Developer) => (
                  <tr key={developer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {developer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {developer.login}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {developer.team?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {developer.role?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {developer.stacks && developer.stacks.length > 0 ? (
                        <Tags tags={developer.stacks} />
                      ) : (
                        <span className="text-gray-400">Nenhuma stack</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {developer._count?.pullRequests || 0} PRs
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {developer._count?.reviews || 0} Reviews
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleView(developer)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canWrite('developers') && (
                          <button
                            onClick={() => handleEditClick(developer)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete('developers') && (
                          <button
                            onClick={() => handleDelete(developer.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {developersData?.pagination && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!developersData.pagination.hasPrev}
                className="btn btn-secondary btn-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!developersData.pagination.hasNext}
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
                    {(developersData.pagination.page - 1) * developersData.pagination.pageSize + 1}
                  </span>{' '}
                  a{' '}
                  <span className="font-medium">
                    {Math.min(
                      developersData.pagination.page * developersData.pagination.pageSize,
                      developersData.pagination.total
                    )}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium">{developersData.pagination.total}</span>{' '}
                  resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!developersData.pagination.hasPrev}
                    className="btn btn-secondary btn-sm"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!developersData.pagination.hasNext}
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
        <DeveloperModal
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setIsCreateModalOpen(false)}
          teams={teams}
          roles={roles}
          stacks={stacks}
          developers={developersData?.data}
        />
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedDeveloper && (
        <DeveloperModal
          mode="edit"
          developer={selectedDeveloper}
          onSubmit={handleEdit}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedDeveloper(null)
          }}
          teams={teams}
          roles={roles}
          stacks={stacks}
          developers={developersData?.data}
        />
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedDeveloper && (
        <DeveloperViewModal
          developer={selectedDeveloper}
          onClose={() => {
            setIsViewModalOpen(false)
            setSelectedDeveloper(null)
          }}
        />
      )}
    </div>
  )
}

// Developer Modal Component
interface DeveloperModalProps {
  mode: 'create' | 'edit'
  developer?: Developer
  onSubmit: (data: CreateDeveloperData | UpdateDeveloperData) => void
  onClose: () => void
  teams: any[]
  roles: any[]
  stacks: Stack[]
  developers: Developer[]
}

const DeveloperModal: React.FC<DeveloperModalProps> = ({
  mode,
  developer,
  onSubmit,
  onClose,
  teams,
  roles,
  stacks,
}) => {
  const [formData, setFormData] = useState({
    name: developer?.name || '',
    email: developer?.email || '',
    login: developer?.login || '',
    teamId: developer?.teamId || '',
    roleId: developer?.roleId || '',
    stackIds: developer?.stacks?.map(s => s.id) || [],
  })

  // Update formData when developer changes
  useEffect(() => {
    if (developer) {
      setFormData({
        name: developer.name || '',
        email: developer.email || '',
        login: developer.login || '',
        teamId: developer.teamId || '',
        roleId: developer.roleId || '',
        stackIds: developer.stacks?.map(s => s.id) || [],
      })
    }
  }, [developer])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {mode === 'create' ? 'Novo Desenvolvedor' : 'Editar Desenvolvedor'}
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
                className="input w-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="input w-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                placeholder="exemplo@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Login *
              </label>
              <input
                type="text"
                required
                value={formData.login}
                onChange={(e) => setFormData(prev => ({ ...prev, login: e.target.value }))}
                className="input w-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time *
              </label>
              <select
                required
                value={formData.teamId}
                onChange={(e) => setFormData(prev => ({ ...prev, teamId: e.target.value }))}
                className="select w-full"
              >
                <option value="">Selecione um time</option>
                {teams?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo *
              </label>
              <select
                required
                value={formData.roleId}
                onChange={(e) => setFormData(prev => ({ ...prev, roleId: e.target.value }))}
                className="select w-full"
              >
                <option value="">Selecione um cargo</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stacks
              </label>
              <StackSelector
                stacks={stacks || []}
                selectedStackIds={formData.stackIds}
                onSelectionChange={(stackIds) => setFormData(prev => ({ ...prev, stackIds }))}
                placeholder="Selecione as stacks..."
                className="w-full"
              />
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

// Developer View Modal Component
interface DeveloperViewModalProps {
  developer: Developer
  onClose: () => void
}

const DeveloperViewModal: React.FC<DeveloperViewModalProps> = ({
  developer,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Detalhes do Desenvolvedor
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <p className="text-sm text-gray-900">{developer.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="text-sm text-gray-900">{developer.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Login</label>
              <p className="text-sm text-gray-900">{developer.login}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Time</label>
              <p className="text-sm text-gray-900">{developer.team?.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cargo</label>
              <p className="text-sm text-gray-900">{developer.role?.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stacks</label>
              {developer.stacks && developer.stacks.length > 0 ? (
                <Tags tags={developer.stacks} className="mt-1" />
              ) : (
                <p className="text-sm text-gray-500">Nenhuma stack</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Estatísticas</label>
              <div className="flex gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {developer._count?.pullRequests || 0} PRs
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {developer._count?.reviews || 0} Reviews
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {developer._count?.commits || 0} Commits
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {developer._count?.comments || 0} Comments
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="btn btn-secondary btn-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
