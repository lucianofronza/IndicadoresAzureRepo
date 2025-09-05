import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserRoleData {
  name: string;
  description: string;
  permissions: string[];
  isDefault?: boolean;
}

interface UpdateUserRoleData {
  name?: string;
  description?: string;
  permissions?: string[];
  isDefault?: boolean;
}

export const UserRoles: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<CreateUserRoleData>({
    name: '',
    description: '',
    permissions: [],
    isDefault: false
  });

  const { canWrite, canDelete } = usePermissions();
  const queryClient = useQueryClient();

  // Buscar roles de usuário
  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const response = await api.get('/auth/roles');
      return response.data.data;
    }
  });

  // Filtrar roles
  const filteredRoles = userRoles.filter((role: UserRole) => {
    return role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           role.description.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: (data: CreateUserRoleData) => api.post('/auth/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Role criado com sucesso!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar role');
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRoleData }) => 
      api.put(`/auth/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Role atualizado com sucesso!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar role');
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Role excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao excluir role');
    }
  });

  const openModal = (role?: UserRole) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isDefault: role.isDefault
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        description: '',
        permissions: [],
        isDefault: false
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: []
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data: formData });
    } else {
      createRoleMutation.mutate(formData);
    }
  };

  const handleDelete = (role: UserRole) => {
    if (role.isSystem) {
      toast.error('Não é possível excluir roles do sistema');
      return;
    }
    
    if (confirm(`Tem certeza que deseja excluir o role "${role.name}"?`)) {
      deleteRoleMutation.mutate(role.id);
    }
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

  const getRoleIcon = (roleName: string) => {
    if (roleName.toLowerCase().includes('admin')) {
      return <Shield className="h-5 w-5 text-red-600" />;
    }
    return <User className="h-5 w-5 text-blue-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles de Usuário</h1>
          <p className="text-gray-600">Gerencie os roles e permissões do sistema</p>
        </div>
        {canWrite('user-roles') && (
          <button
            onClick={() => openModal()}
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4"/>
            Novo
          </button>
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
                placeholder="Buscar por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando roles...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permissões
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Padrão
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
                {filteredRoles.map((role: UserRole) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getRoleIcon(role.name)}
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{role.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {role.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((permission, index) => (
                          <span
                            key={index}
                            className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        role.isSystem 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {role.isSystem ? 'Sistema' : 'Customizado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {role.isDefault ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          ✓ Padrão
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(role.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {canWrite('user-roles') && (
                          <button
                            onClick={() => openModal(role)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete('user-roles') && !role.isSystem && (
                          <button
                            onClick={() => handleDelete(role)}
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
            {filteredRoles.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Nenhum role encontrado
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
                {editingRole ? 'Editar Role' : 'Novo Role'}
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
                    placeholder="Ex: admin, user, manager"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                    placeholder="Descrição do role e suas responsabilidades"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Permissões</label>
                  <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                    {/* Permissões de Usuários */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Usuários</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const userPermissions = ['users:read', 'users:write', 'users:delete'];
                            const hasAllPermissions = userPermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !userPermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...userPermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['users:read', 'users:write', 'users:delete'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['users:read', 'users:write', 'users:delete'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Roles */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Roles</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const rolePermissions = ['roles:read', 'roles:write', 'roles:delete'];
                            const hasAllPermissions = rolePermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !rolePermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...rolePermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['roles:read', 'roles:write', 'roles:delete'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['roles:read', 'roles:write', 'roles:delete'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Dashboard */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Dashboard</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const dashboardPermissions = ['dashboard:read'];
                            const hasAllPermissions = dashboardPermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !dashboardPermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...dashboardPermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['dashboard:read'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['dashboard:read'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Desenvolvedores */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Desenvolvedores</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const developerPermissions = ['developers:read', 'developers:write', 'developers:delete'];
                            const hasAllPermissions = developerPermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !developerPermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...developerPermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['developers:read', 'developers:write', 'developers:delete'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['developers:read', 'developers:write', 'developers:delete'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Times */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Times</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const teamPermissions = ['teams:read', 'teams:write', 'teams:delete'];
                            const hasAllPermissions = teamPermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !teamPermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...teamPermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['teams:read', 'teams:write', 'teams:delete'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['teams:read', 'teams:write', 'teams:delete'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Cargos */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Cargos</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const jobRolePermissions = ['job-roles:read', 'job-roles:write', 'job-roles:delete'];
                            const hasAllPermissions = jobRolePermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !jobRolePermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...jobRolePermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['job-roles:read', 'job-roles:write', 'job-roles:delete'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['job-roles:read', 'job-roles:write', 'job-roles:delete'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Stacks */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Stacks</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const stackPermissions = ['stacks:read', 'stacks:write', 'stacks:delete'];
                            const hasAllPermissions = stackPermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !stackPermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...stackPermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['stacks:read', 'stacks:write', 'stacks:delete'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['stacks:read', 'stacks:write', 'stacks:delete'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Repositórios */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Repositórios</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const repoPermissions = ['repositories:read', 'repositories:write', 'repositories:delete'];
                            const hasAllPermissions = repoPermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !repoPermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...repoPermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['repositories:read', 'repositories:write', 'repositories:delete'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['repositories:read', 'repositories:write', 'repositories:delete'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Sincronização */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Sincronização</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const syncPermissions = ['sync:read', 'sync:write', 'sync:execute'];
                            const hasAllPermissions = syncPermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !syncPermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...syncPermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['sync:read', 'sync:write', 'sync:execute'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['sync:read', 'sync:write', 'sync:execute'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>

                    {/* Permissões de Azure DevOps */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-800">Azure DevOps</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const azurePermissions = ['azure-devops:read', 'azure-devops:write', 'azure-devops:configure'];
                            const hasAllPermissions = azurePermissions.every(p => formData.permissions.includes(p));
                            if (hasAllPermissions) {
                              setFormData({
                                ...formData,
                                permissions: formData.permissions.filter(p => !azurePermissions.includes(p))
                              });
                            } else {
                              setFormData({
                                ...formData,
                                permissions: [...new Set([...formData.permissions, ...azurePermissions])]
                              });
                            }
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {['azure-devops:read', 'azure-devops:write', 'azure-devops:configure'].every(p => formData.permissions.includes(p)) ? 'Deselecionar' : 'Selecionar'} Todos
                        </button>
                      </div>
                      {['azure-devops:read', 'azure-devops:write', 'azure-devops:configure'].map((permission) => (
                        <label key={permission} className="flex items-center mb-1">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, permission]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{permission}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isDefault || false}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Role padrão para novos usuários
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Apenas um role pode ser marcado como padrão
                  </p>
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
                    disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                    className="btn btn-primary min-w-[80px] px-4"
                  >
                    {createRoleMutation.isPending || updateRoleMutation.isPending ? 'Salvando...' : 'Salvar'}
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
