import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import api from '../services/api';

export const usePermissions = () => {
  const { user } = useAuth();

  // Buscar permissões do usuário
  const { data: userPermissions = [], isLoading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      try {
        // Buscar permissões do usuário logado
        const response = await api.get('/auth/me');
        return response.data.data.permissions || [];
      } catch (error) {
        console.error('Error fetching user permissions:', error);
        return [];
      }
    },
    enabled: !!user,
  });

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  const hasPermission = (permission: string): boolean => {
    if (!user || isLoading) return false;
    return userPermissions.includes(permission);
  };

  /**
   * Verifica se o usuário tem todas as permissões especificadas
   */
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user || isLoading) return false;
    return permissions.every(permission => userPermissions.includes(permission));
  };

  /**
   * Verifica se o usuário tem pelo menos uma das permissões especificadas
   */
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user || isLoading) return false;
    return permissions.some(permission => userPermissions.includes(permission));
  };

  /**
   * Verifica se o usuário pode acessar um módulo específico
   */
  const canAccessModule = (module: string): boolean => {
    if (!user || isLoading) return false;
    
    const modulePermissions = {
      dashboard: ['dashboard:read'],
      developers: ['developers:read', 'developers:write', 'developers:delete'],
      teams: ['teams:read', 'teams:write', 'teams:delete'],
      roles: ['job-roles:read', 'job-roles:write', 'job-roles:delete'],
      stacks: ['stacks:read', 'stacks:write', 'stacks:delete'],
      repositories: ['repositories:read', 'repositories:write', 'repositories:delete'],
      sync: ['sync:read', 'sync:write', 'sync:execute'],
      'azure-devops': ['azure-devops:read', 'azure-devops:write', 'azure-devops:configure'],
      users: ['users:read', 'users:write', 'users:delete'],
      'user-roles': ['roles:read', 'roles:write', 'roles:delete'],
    };

    const permissions = modulePermissions[module as keyof typeof modulePermissions];
    if (!permissions) return false;

    return hasAnyPermission(permissions);
  };

  /**
   * Verifica se o usuário pode visualizar um módulo
   */
  const canView = (module: string): boolean => {
    if (!user || isLoading) return false;
    
    const viewPermissions = {
      dashboard: 'dashboard:read',
      developers: 'developers:read',
      teams: 'teams:read',
      roles: 'job-roles:read',
      stacks: 'stacks:read',
      repositories: 'repositories:read',
      sync: 'sync:read',
      'azure-devops': 'azure-devops:read',
      users: 'users:read',
      'user-roles': 'roles:read',
    };

    const permission = viewPermissions[module as keyof typeof viewPermissions];
    if (!permission) return false;

    return hasPermission(permission);
  };

  /**
   * Verifica se o usuário pode criar/editar em um módulo
   */
  const canWrite = (module: string): boolean => {
    if (!user || isLoading) return false;
    
    const writePermissions = {
      developers: 'developers:write',
      teams: 'teams:write',
      roles: 'job-roles:write',
      stacks: 'stacks:write',
      repositories: 'repositories:write',
      sync: 'sync:write',
      'azure-devops': 'azure-devops:write',
      users: 'users:write',
      'user-roles': 'roles:write',
    };

    const permission = writePermissions[module as keyof typeof writePermissions];
    if (!permission) return false;

    return hasPermission(permission);
  };

  /**
   * Verifica se o usuário pode excluir em um módulo
   */
  const canDelete = (module: string): boolean => {
    if (!user || isLoading) return false;
    
    const deletePermissions = {
      developers: 'developers:delete',
      teams: 'teams:delete',
      roles: 'job-roles:delete',
      stacks: 'stacks:delete',
      repositories: 'repositories:delete',
      users: 'users:delete',
      'user-roles': 'roles:delete',
    };

    const permission = deletePermissions[module as keyof typeof deletePermissions];
    if (!permission) return false;

    return hasPermission(permission);
  };

  return {
    userPermissions,
    isLoading,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    canAccessModule,
    canView,
    canWrite,
    canDelete,
  };
};
