import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Building2, Search } from 'lucide-react'
import { Team, CreateTeamData } from '@/types'
import { formatDate } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import api from '@/services/api'
import toast from 'react-hot-toast'

export const Teams: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [filters, setFilters] = useState({
    search: '',
  })
  const queryClient = useQueryClient()
  const { canWrite, canDelete } = usePermissions()

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await api.get('/teams')
      return response.data.data
    },
  })

  // Filtrar times
  const filteredTeams = teams?.filter((team: Team) => {
    if (filters.search) {
      return team.name.toLowerCase().includes(filters.search.toLowerCase()) ||
             team.description?.toLowerCase().includes(filters.search.toLowerCase())
    }
    return true
  }) || []

  const createMutation = useMutation({
    mutationFn: async (data: CreateTeamData) => {
      const response = await api.post('/teams', data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Time criado com sucesso!')
      setIsModalOpen(false)
    },
    onError: () => {
      toast.error('Erro ao criar time')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateTeamData }) => {
      const response = await api.put(`/teams/${id}`, data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Time atualizado com sucesso!')
      setIsModalOpen(false)
      setEditingTeam(null)
    },
    onError: () => {
      toast.error('Erro ao atualizar time')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teams/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Time excluído com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao excluir time')
    },
  })

  const handleSubmit = (data: CreateTeamData) => {
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (team: Team) => {
    setEditingTeam(team)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este time?')) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Times</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie os times da organização
          </p>
        </div>
        {canWrite('teams') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
        )}
      </div>

      {/* Filtros */}
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
              placeholder="Nome ou descrição..."
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

      {/* Teams List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gerência
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTeams.map((team: Team) => (
                <tr key={team.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                      <div className="text-sm font-medium text-gray-900">
                        {team.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {team.management || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(team.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {canWrite('teams') && (
                        <button
                          onClick={() => handleEdit(team)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete('teams') && (
                        <button
                          onClick={() => handleDelete(team.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <TeamModal
          team={editingTeam}
          onSubmit={handleSubmit}
          onClose={() => {
            setIsModalOpen(false)
            setEditingTeam(null)
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

interface TeamModalProps {
  team: Team | null
  onSubmit: (data: CreateTeamData) => void
  onClose: () => void
  isLoading: boolean
}

const TeamModal: React.FC<TeamModalProps> = ({ team, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState<CreateTeamData>({
    name: team?.name || '',
    management: team?.management || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {team ? 'Editar Time' : 'Novo Time'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gerência
                  </label>
                  <input
                    type="text"
                    value={formData.management}
                    onChange={(e) => setFormData(prev => ({ ...prev, management: e.target.value }))}
                    className="input focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-md sm:ml-3"
              >
                {isLoading ? 'Salvando...' : (team ? 'Atualizar' : 'Criar')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-md"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
