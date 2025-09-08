import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Eye, EyeOff, Search, CheckCircle, Link, Unlink, Users as UsersIcon } from 'lucide-react';
import { PaginatedSelect } from '../components/PaginatedSelect';
import { UserTeamManager } from '../components/UserTeamManager';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

interface User {
  id: string;
  name: string;
  email: string;
  login: string;
  roleId?: string;
  role?: {
    id: string;
    name: string;
    description: string;
  };
  isActive: boolean;
  status: 'active' | 'pending' | 'inactive';
  azureAdId?: string;
  azureAdEmail?: string;
  developerId?: string;
  viewScope: 'own' | 'teams' | 'all';
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}


interface CreateUserData {
  name: string;
  email: string;
  login: string;
  password: string;
  roleId?: string;
  viewScope?: 'own' | 'teams' | 'all';
}

interface UpdateUserData {
  name?: string;
  email?: string;
  login?: string;
  roleId?: string;
  isActive?: boolean;
  viewScope?: 'own' | 'teams' | 'all';
}

export const Users: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [linkingUser, setLinkingUser] = useState<User | null>(null);
  const [selectedDeveloperId, setSelectedDeveloperId] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    email: '',
    login: '',
    password: '',
    roleId: '', // Será preenchido com o primeiro role disponível
    viewScope: 'own' // Default para 'own'
  });

  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { canWrite, canDelete } = usePermissions();

  // Buscar usuários
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/auth/users');
      return response.data.data;
    }
  });

  // Buscar cargos


  // Definir role padrão quando roles são carregados
  useEffect(() => {
    // Role padrão será definido quando o usuário selecionar no formulário
  }, []);


  // Filtrar usuários
  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.login.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role?.name === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserData) => api.post('/auth/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar usuário');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) => 
      api.put(`/auth/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado com sucesso!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar usuário');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao excluir usuário');
    }
  });

  const activateUserMutation = useMutation({
    mutationFn: (id: string) => api.post(`/auth/users/${id}/activate`, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário ativado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao ativar usuário');
    }
  });

  const linkDeveloperMutation = useMutation({
    mutationFn: ({ userId, developerId }: { userId: string; developerId: string }) => 
      api.post(`/auth/users/${userId}/link-developer`, { developerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário vinculado com desenvolvedor!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao vincular desenvolvedor');
    }
  });

  const unlinkDeveloperMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/auth/users/${userId}/unlink-developer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário desvinculado do desenvolvedor!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao desvincular desenvolvedor');
    }
  });

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        login: user.login,
        password: '',
        roleId: user.roleId,
        viewScope: user.viewScope
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        login: '',
        password: '',
        roleId: '', // Resetar para vazio ao abrir modal de novo usuário
        viewScope: 'own' // Default para 'own'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      login: '',
      password: '',
      roleId: '' // Resetar para vazio ao fechar modal
    });
    setShowPassword(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
      const updateData: UpdateUserData = {
        name: formData.name,
        email: formData.email,
        login: formData.login,
        viewScope: formData.viewScope
      };
      
      // Só incluir roleId se não estiver vazio
      if (formData.roleId && formData.roleId.trim() !== '') {
        updateData.roleId = formData.roleId;
      }
      
      console.log('Updating user with data:', updateData);
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('Você não pode excluir seu próprio usuário');
      return;
    }
    
    if (confirm(`Tem certeza que deseja excluir o usuário "${user.name}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleActivate = (user: User) => {
    if (confirm(`Tem certeza que deseja ativar o usuário "${user.name}"?`)) {
      activateUserMutation.mutate(user.id);
    }
  };

  const handleUnlinkDeveloper = (user: User) => {
    if (confirm(`Tem certeza que deseja desvincular o usuário "${user.name}" do desenvolvedor?`)) {
      unlinkDeveloperMutation.mutate(user.id);
    }
  };

  const openLinkModal = (user: User) => {
    setLinkingUser(user);
    setSelectedDeveloperId('');
    setIsLinkModalOpen(true);
  };

  const openTeamModal = (user: User) => {
    setEditingUser(user);
    setIsTeamModalOpen(true);
  };

  const handleLinkDeveloper = () => {
    if (!linkingUser || !selectedDeveloperId) return;
    
    linkDeveloperMutation.mutate({
      userId: linkingUser.id,
      developerId: selectedDeveloperId
    });
    setIsLinkModalOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-600">Gerencie os usuários do sistema</p>
        </div>
        {canWrite('users') && (
          <button
            onClick={() => openModal()}
            className="btn btn-primary btn-md"
          ><Plus className="h-4 w-4"/>Novo</button>
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
              placeholder="Nome, email ou login..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grupo
            </label>
            <PaginatedSelect
              value={roleFilter}
              onChange={(value) => setRoleFilter(value)}
              placeholder="Todos os grupos"
              endpoint="/auth/roles"
              labelKey="name"
              valueKey="name"
              className="w-full"
              clearValue="all"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setRoleFilter('all')
              }}
              className="btn btn-secondary w-full px-4"
              style={{ height: '2.6rem' }}
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando usuários...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grupo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Último Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criado em
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Desenvolvedor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.login}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {user.role?.name ? user.role.name.toUpperCase() : 'Sem role'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.status === 'active' ? 'Ativo' : 
                         user.status === 'pending' ? 'Pendente' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? formatDate(user.lastLogin) : 'Nunca'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.developerId ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Vinculado
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Não vinculado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {user.status === 'pending' && canWrite('users') && (
                          <button
                            onClick={() => handleActivate(user)}
                            className="text-green-600 hover:text-green-900"
                            title="Ativar usuário"
                            disabled={activateUserMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {!user.developerId && canWrite('users') && user.viewScope === 'own' && (
                          <button
                            onClick={() => openLinkModal(user)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Vincular desenvolvedor"
                          >
                            <Link className="h-4 w-4" />
                          </button>
                        )}
                        {user.developerId && canWrite('users') && user.viewScope === 'own' && (
                          <button
                            onClick={() => handleUnlinkDeveloper(user)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Desvincular desenvolvedor"
                            disabled={unlinkDeveloperMutation.isPending}
                          >
                            <Unlink className="h-4 w-4" />
                          </button>
                        )}
                        {canWrite('users') && (
                          <button
                            onClick={() => openModal(user)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canWrite('users') && user.viewScope === 'teams' && (
                          <button
                            onClick={() => openTeamModal(user)}
                            className="text-green-600 hover:text-green-900"
                            title="Gerenciar Equipes"
                          >
                            <UsersIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete('users') && user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(user)}
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
            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Nenhum usuário encontrado
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Login</label>
                  <input
                    type="text"
                    required
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <PaginatedSelect
                    value={formData.roleId || ''}
                    onChange={(value) => setFormData({ ...formData, roleId: value })}
                    placeholder="Selecione um grupo"
                    endpoint="/auth/roles"
                    labelKey="name"
                    valueKey="id"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Escopo de Visualização <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.viewScope}
                    onChange={(e) => setFormData({ ...formData, viewScope: e.target.value as 'own' | 'teams' | 'all' })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="own">Apenas seus dados</option>
                    <option value="teams">Dados das suas equipes</option>
                    <option value="all">Todos os dados</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Define quais dados o usuário pode visualizar no dashboard
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    className="btn btn-primary min-w-[80px] px-4"
                  >
                    {createUserMutation.isPending || updateUserMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vínculo com Desenvolvedor */}
      {isLinkModalOpen && linkingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Vincular Desenvolvedor
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Vincular usuário <strong>{linkingUser.name}</strong> com um desenvolvedor:
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecionar Desenvolvedor
                  </label>
                  <PaginatedSelect
                    value={selectedDeveloperId}
                    onChange={setSelectedDeveloperId}
                    placeholder="Selecione um desenvolvedor"
                    endpoint="/developers"
                    labelKey="name"
                    valueKey="id"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleLinkDeveloper}
                  disabled={!selectedDeveloperId || linkDeveloperMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {linkDeveloperMutation.isPending ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Equipes */}
      {isTeamModalOpen && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Gerenciar Equipes - {editingUser.name}
                </h3>
                <button
                  onClick={() => setIsTeamModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <UserTeamManager 
                userId={editingUser.id} 
                userName={editingUser.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
