import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Palette } from 'lucide-react'
import { Stack, CreateStackData, UpdateStackData } from '@/types'
import { usePermissions } from '@/hooks/usePermissions'
import api from '@/services/api'

export const Stacks: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedStack, setSelectedStack] = useState<Stack | null>(null)
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

  // Fetch stacks
  const { data: stacksData, isLoading } = useQuery({
    queryKey: ['stacks', pagination, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries({ ...pagination, ...filters }).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })
      
      const response = await api.get(`/stacks?${params.toString()}`)
      return response.data
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateStackData) => {
      const response = await api.post('/stacks', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] })
      setIsCreateModalOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStackData }) => {
      const response = await api.put(`/stacks/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] })
      setIsEditModalOpen(false)
      setSelectedStack(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/stacks/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] })
    },
  })

  const handleCreate = (data: CreateStackData | UpdateStackData) => {
    createMutation.mutate(data as CreateStackData)
  }

  const handleEdit = (data: CreateStackData | UpdateStackData) => {
    if (selectedStack) {
      updateMutation.mutate({ id: selectedStack.id, data: data as UpdateStackData })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta stack?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleEditClick = (stack: Stack) => {
    setSelectedStack(stack)
    setIsEditModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stacks</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie as stacks tecnológicas da organização
          </p>
        </div>
        {canWrite('stacks') && (
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
          <Palette className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nome da stack..."
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
                  Nome / Cor
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
              ) : stacksData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    Nenhuma stack encontrada
                  </td>
                </tr>
              ) : (
                stacksData?.data?.map((stack: Stack) => (
                  <tr key={stack.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: stack.color }}
                        />
                        <div className="text-sm font-medium text-gray-900">
                          {stack.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {stack._count?.developers || 0} desenvolvedores
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(stack.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {canWrite('stacks') && (
                          <button
                            onClick={() => handleEditClick(stack)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete('stacks') && (
                          <button
                            onClick={() => handleDelete(stack.id)}
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
        {stacksData?.pagination && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!stacksData.pagination.hasPrev}
                className="btn btn-secondary btn-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!stacksData.pagination.hasNext}
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
                    {(stacksData.pagination.page - 1) * stacksData.pagination.pageSize + 1}
                  </span>{' '}
                  a{' '}
                  <span className="font-medium">
                    {Math.min(
                      stacksData.pagination.page * stacksData.pagination.pageSize,
                      stacksData.pagination.total
                    )}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium">{stacksData.pagination.total}</span>{' '}
                  resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!stacksData.pagination.hasPrev}
                    className="btn btn-secondary btn-sm"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={!stacksData.pagination.hasNext}
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
        <StackModal
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedStack && (
        <StackModal
          mode="edit"
          stack={selectedStack}
          onSubmit={handleEdit}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedStack(null)
          }}
        />
      )}
    </div>
  )
}

// Stack Modal Component
interface StackModalProps {
  mode: 'create' | 'edit'
  stack?: Stack
  onSubmit: (data: CreateStackData | UpdateStackData) => void
  onClose: () => void
}

const StackModal: React.FC<StackModalProps> = ({
  mode,
  stack,
  onSubmit,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    name: stack?.name || '',
    color: stack?.color || '#3b82f6',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {mode === 'create' ? 'Nova Stack' : 'Editar Stack'}
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
                placeholder="Ex: React/Node.js"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cor
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="input flex-1"
                  placeholder="#3b82f6"
                />
              </div>
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
