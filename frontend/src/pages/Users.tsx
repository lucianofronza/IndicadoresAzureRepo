import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Eye, EyeOff, Search, CheckCircle, Link, Unlink } from 'lucide-react';
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
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserData {
  name: string;
  email: string;
  login: string;
  password: string;
  roleId?: string;
}

interface UpdateUserData {
  name?: string;
  email?: string;
  login?: string;
  roleId?: string;
  isActive?: boolean;
}

export const Users: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkingUser, setLinkingUser] = useState<User | null>(null);
  const [selectedDeveloperId, setSelectedDeveloperId] = useState('');
  const [developerSearch, setDeveloperSearch] = useState('');
  const [developerSearchInput, setDeveloperSearchInput] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user' | 'gerente'>('all');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    email: '',
    login: '',
    password: '',
    roleId: '' // Será preenchido com o primeiro role disponível
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

  // Buscar roles de usuário
  const { data: userRoles = [] } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const response = await api.get('/auth/roles');
      return response.data.data;
    }
  });

  // Buscar desenvolvedores com busca otimizada
  const { data: developers = [], isLoading: developersLoading } = useQuery({
    queryKey: ['developers-search', developerSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (developerSearch) params.append('search', developerSearch);
      params.append('limit', '50');
      
      const response = await api.get(`/developers/search?${params.toString()}`);
      return response.data.data;
    },
    enabled: isLinkModalOpen, // Só busca quando o modal está aberto
    staleTime: 30000, // Cache por 30 segundos
  });

  // Definir role padrão quando roles são carregados
  useEffect(() => {
    if (userRoles.length > 0 && !formData.roleId) {
      const defaultRole = userRoles[0]; // Usar a primeira role disponível
      setFormData(prev => ({ ...prev, roleId: defaultRole.id }));
    }
  }, [userRoles, formData.roleId]);

  // Debounce para busca de desenvolvedores
  useEffect(() => {
    const timer = setTimeout(() => {
      setDeveloperSearch(developerSearchInput);
    }, 300); // 300ms de delay

    return () => clearTimeout(timer);
  }, [developerSearchInput]);

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
        roleId: user.roleId
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        login: '',
        password: '',
        roleId: '' // Resetar para vazio ao abrir modal de novo usuário
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
        roleId: formData.roleId
      };
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
    setDeveloperSearch('');
    setDeveloperSearchInput('');
    setIsLinkModalOpen(true);
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
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou login..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'user' | 'gerente')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Todos os roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="gerente">Gerente</option>
            </select>
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
                    Role
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
                        {!user.developerId && canWrite('users') && (
                          <button
                            onClick={() => openLinkModal(user)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Vincular desenvolvedor"
                          >
                            <Link className="h-4 w-4" />
                          </button>
                        )}
                        {user.developerId && canWrite('users') && (
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
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Login</label>
                  <input
                    type="text"
                    required
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Selecione um role</option>
                    {userRoles.map((role: UserRole) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>

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
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    className="btn btn-primary"
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
                    Buscar Desenvolvedor
                  </label>
                  <input
                    type="text"
                    value={developerSearchInput}
                    onChange={(e) => setDeveloperSearchInput(e.target.value)}
                    placeholder="Digite nome ou email do desenvolvedor..."
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecionar Desenvolvedor
                  </label>
                  {developersLoading ? (
                    <div className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                      <span className="text-gray-500">Carregando desenvolvedores...</span>
                    </div>
                  ) : (
                    <select
                      value={selectedDeveloperId}
                      onChange={(e) => setSelectedDeveloperId(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Selecione um desenvolvedor</option>
                      {developers.map((dev: any) => (
                        <option key={dev.id} value={dev.id}>
                          {dev.name} ({dev.email})
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {!developersLoading && developers.length === 0 && developerSearch && (
                    <p className="mt-1 text-sm text-gray-500">
                      Nenhum desenvolvedor encontrado para "{developerSearch}"
                    </p>
                  )}
                  
                  {!developersLoading && developers.length > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      {developers.length} desenvolvedor(es) encontrado(s)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleLinkDeveloper}
                  disabled={!selectedDeveloperId || linkDeveloperMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {linkDeveloperMutation.isPending ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
