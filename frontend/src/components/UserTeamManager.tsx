import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

interface UserTeam {
  id: string;
  userId: string;
  teamId: string;
  role: 'member' | 'coordinator' | 'manager';
  createdAt: string;
  updatedAt: string;
  team: {
    id: string;
    name: string;
  };
}

interface Team {
  id: string;
  name: string;
}

interface UserTeamManagerProps {
  userId: string;
  userName: string;
}

export const UserTeamManager: React.FC<UserTeamManagerProps> = ({ userId, userName }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserTeam, setEditingUserTeam] = useState<UserTeam | null>(null);
  const [formData, setFormData] = useState({
    teamId: '',
    role: 'member' as 'member' | 'coordinator' | 'manager'
  });

  const { canWrite } = usePermissions();
  const queryClient = useQueryClient();

  // Buscar equipes do usuário
  const { data: userTeams = [], isLoading } = useQuery({
    queryKey: ['user-teams', userId],
    queryFn: async () => {
      const response = await api.get(`/user-teams/${userId}`);
      return response.data.data;
    }
  });

  // Buscar equipes disponíveis
  const { data: availableTeams = [] } = useQuery({
    queryKey: ['available-teams'],
    queryFn: async () => {
      const response = await api.get('/user-teams/available/teams');
      return response.data.data;
    }
  });

  // Adicionar usuário à equipe
  const addUserTeamMutation = useMutation({
    mutationFn: async (data: { teamId: string; role: string }) => {
      const response = await api.post('/user-teams', {
        userId,
        teamId: data.teamId,
        role: data.role
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-teams', userId] });
      toast.success('Usuário adicionado à equipe com sucesso');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao adicionar usuário à equipe');
    }
  });

  // Atualizar role do usuário na equipe
  const updateUserTeamMutation = useMutation({
    mutationFn: async ({ userTeamId, role }: { userTeamId: string; role: string }) => {
      const response = await api.put(`/user-teams/${userTeamId}`, { role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-teams', userId] });
      toast.success('Role do usuário atualizado com sucesso');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar role do usuário');
    }
  });

  // Remover usuário da equipe
  const removeUserTeamMutation = useMutation({
    mutationFn: async (userTeamId: string) => {
      const response = await api.delete(`/user-teams/${userTeamId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-teams', userId] });
      toast.success('Usuário removido da equipe com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao remover usuário da equipe');
    }
  });

  const openModal = (userTeam?: UserTeam) => {
    if (userTeam) {
      setEditingUserTeam(userTeam);
      setFormData({
        teamId: userTeam.teamId,
        role: userTeam.role
      });
    } else {
      setEditingUserTeam(null);
      setFormData({
        teamId: '',
        role: 'member'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserTeam(null);
    setFormData({
      teamId: '',
      role: 'member'
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUserTeam) {
      updateUserTeamMutation.mutate({
        userTeamId: editingUserTeam.id,
        role: formData.role
      });
    } else {
      addUserTeamMutation.mutate({
        teamId: formData.teamId,
        role: formData.role
      });
    }
  };

  const handleRemove = (userTeam: UserTeam) => {
    if (window.confirm(`Tem certeza que deseja remover ${userName} da equipe ${userTeam.team.name}?`)) {
      removeUserTeamMutation.mutate(userTeam.id);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'member': return 'Membro';
      case 'coordinator': return 'Coordenador';
      case 'manager': return 'Gerente';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'member': return 'bg-gray-100 text-gray-800';
      case 'coordinator': return 'bg-blue-100 text-blue-800';
      case 'manager': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filtrar equipes já associadas
  const availableTeamsForSelection = availableTeams.filter(
    team => !userTeams.some(ut => ut.teamId === team.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Equipes de {userName}
        </h3>
        {canWrite('users') && (
          <button
            onClick={() => openModal()}
            className="btn btn-primary btn-sm"
            disabled={availableTeamsForSelection.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Equipe
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando equipes...</p>
        </div>
      ) : userTeams.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Nenhuma equipe associada</p>
          {availableTeamsForSelection.length === 0 && (
            <p className="text-sm mt-2">Todas as equipes já estão associadas</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {userTeams.map((userTeam) => (
            <div
              key={userTeam.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div>
                  <p className="font-medium text-gray-900">{userTeam.team.name}</p>
                </div>
              </div>
              {canWrite('users') && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleRemove(userTeam)}
                    className="text-red-600 hover:text-red-900"
                    title="Remover da equipe"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingUserTeam ? 'Editar Role na Equipe' : 'Adicionar Equipe'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingUserTeam ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Equipe <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.teamId}
                      onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Selecione uma equipe</option>
                      {availableTeamsForSelection.map((team: Team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as 'member' | 'coordinator' | 'manager' })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="member">Membro</option>
                      <option value="coordinator">Coordenador</option>
                      <option value="manager">Gerente</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={addUserTeamMutation.isPending || updateUserTeamMutation.isPending}
                    className="btn btn-primary min-w-[80px] px-4"
                  >
                    {addUserTeamMutation.isPending || updateUserTeamMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
