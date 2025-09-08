import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { Role, CreateRoleData, UpdateRoleData } from '@/types'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { usePermissions } from '@/hooks/usePermissions'

export const Roles: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [filters, setFilters] = useState({
    search: '',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    sortBy: 'name',
    sortOrder: 'asc' as 'asc' | 'desc',
  })

  const queryClient = useQueryClient()
  const { canWrite, canDelete } = usePermissions()

  // Fetch roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles', pagination, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries({ ...pagination, ...filters }).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })
      
      const response = await api.get(`/roles?${params.toString()}`)
      return response.data
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateRoleData) => {
      const response = await api.post('/roles', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setIsCreateModalOpen(false)
      toast.success('Cargo criado com sucesso!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar cargo')
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRoleData }) => {
      const response = await api.put(`/roles/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setIsEditModalOpen(false)
      setSelectedRole(null)
      toast.success('Cargo atualizado com sucesso!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar cargo')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/roles/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Cargo excluído com sucesso!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao excluir cargo')
    }
  })

  const handleCreate = (data: CreateRoleData | UpdateRoleData) => {
    createMutation.mutate(data as CreateRoleData)
  }

  const handleEdit = (data: CreateRoleData | UpdateRoleData) => {
    if (selectedRole) {
      updateMutation.mutate({ id: selectedRole.id, data: data as UpdateRoleData })
    }
  }

  const handleDelete = (role: Role) => {
    if (confirm(`Tem certeza que deseja excluir o cargo "${role.name}"?`)) {
      deleteMutation.mutate(role.id)
    }
  }

  const handleEditClick = (role: Role) => {
    setSelectedRole(role)
    setIsEditModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
                <h1 className="text-2xl font-bold text-gray-900">Cargos</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Gerencie os cargos da organização
                </p>
        </div>
        {canWrite('roles') && (
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
          <Search className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nome do cargo..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="px-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ search: '' })}
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
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Desenvolvedores
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
                  <td colSpan={4} className="px-6 py-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : rolesData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    Nenhum cargo encontrado
                  </td>
                </tr>
              ) : (
                rolesData?.data?.map((role: Role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {role.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {role._count?.developers || 0} desenvolvedores
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(role.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {canWrite('roles') && (
                          <button
                            onClick={() => handleEditClick(role)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete('roles') && (
                          <button
                            onClick={() => handleDelete(role)}
                            className="text-red-600 hover:text-red-900"
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
        {rolesData?.pagination && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!rolesData.pagination.hasPrev}
                className="btn btn-secondary btn-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!rolesData.pagination.hasNext}
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
                    {(rolesData.pagination.page - 1) * rolesData.pagination.pageSize + 1}
                  </span>{' '}
                  a{' '}
                  <span className="font-medium">
                    {Math.min(
                      rolesData.pagination.page * rolesData.pagination.pageSize,
                      rolesData.pagination.total
                    )}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium">{rolesData.pagination.total}</span>{' '}
                  resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!rolesData.pagination.hasPrev}
                    className="btn btn-secondary btn-sm"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!rolesData.pagination.hasNext}
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
        <RoleModal
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedRole && (
        <RoleModal
          mode="edit"
          role={selectedRole}
          onSubmit={handleEdit}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedRole(null)
          }}
        />
      )}
    </div>
  )
}

// Role Modal Component
interface RoleModalProps {
  mode: 'create' | 'edit'
  role?: Role
  onSubmit: (data: CreateRoleData | UpdateRoleData) => void
  onClose: () => void
}

const RoleModal: React.FC<RoleModalProps> = ({
  mode,
  role,
  onSubmit,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    name: role?.name || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {mode === 'create' ? 'Novo Cargo' : 'Editar Cargo'}
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
                placeholder="Ex: Desenvolvedor Senior"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-secondary btn-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-sm"
              >
                {isSubmitting ? 'Salvando...' : (mode === 'create' ? 'Criar' : 'Salvar')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
