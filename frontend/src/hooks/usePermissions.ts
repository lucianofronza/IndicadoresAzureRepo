import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import api from '../services/api';
import { debugLogger } from '../components/DebugLogger';

export const usePermissions = () => {
  const { user } = useAuth();

  // Buscar permissões do usuário
  const { data: userPermissions = [], isLoading, error } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      debugLogger.log('🔍 usePermissions: Iniciando busca de permissões para usuário: ' + user?.id);
      
      if (!user) {
        debugLogger.log('❌ usePermissions: Usuário não encontrado, retornando array vazio');
        return [];
      }
      
      try {
        debugLogger.log('🌐 usePermissions: Fazendo requisição para /auth/me');
        debugLogger.log('🔑 usePermissions: Token configurado: ' + !!api.defaults.headers.common['Authorization']);
        
        // Buscar permissões do usuário logado
        const response = await api.get('/auth/me');
        debugLogger.log('✅ usePermissions: Resposta recebida: ' + JSON.stringify(response.data));
        
        const permissions = response.data.data.permissions || [];
        debugLogger.log('📋 usePermissions: Permissões extraídas: ' + JSON.stringify(permissions));
        
        return permissions;
      } catch (error) {
        debugLogger.log('❌ usePermissions: Erro ao buscar permissões: ' + error.message, 'error');
        debugLogger.log('❌ usePermissions: Status do erro: ' + error.response?.status, 'error');
        debugLogger.log('❌ usePermissions: Dados do erro: ' + JSON.stringify(error.response?.data), 'error');
        // Se houver erro de autenticação, não retornar array vazio
        // para evitar que o usuário seja considerado sem permissões
        throw error;
      }
    },
    enabled: !!user,
    retry: 3, // Tentar 3 vezes em caso de erro
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponencial
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  const hasPermission = (permission: string): boolean => {
    debugLogger.log('🔐 hasPermission: Verificando permissão: ' + permission);
    debugLogger.log('👤 hasPermission: Usuário: ' + !!user);
    debugLogger.log('⏳ hasPermission: Carregando: ' + isLoading);
    debugLogger.log('❌ hasPermission: Erro: ' + !!error);
    debugLogger.log('📋 hasPermission: Permissões do usuário: ' + JSON.stringify(userPermissions));
    
    if (!user || isLoading) {
      debugLogger.log('🚫 hasPermission: Usuário não encontrado ou carregando, retornando false');
      return false;
    }
    
    // Se houver erro ao buscar permissões, bloquear acesso
    // Isso força uma nova tentativa de autenticação
    if (error) {
      debugLogger.log('❌ hasPermission: Erro ao carregar permissões, bloqueando acesso: ' + error.message, 'error');
      return false; // Bloquear acesso para forçar nova autenticação
    }
    
    const hasAccess = userPermissions.includes(permission);
    debugLogger.log('✅ hasPermission: Resultado: ' + hasAccess);
    return hasAccess;
  };

  /**
   * Verifica se o usuário tem todas as permissões especificadas
   */
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user || isLoading) return false;
    if (error) return false; // Bloquear acesso em caso de erro
    return permissions.every(permission => userPermissions.includes(permission));
  };

  /**
   * Verifica se o usuário tem pelo menos uma das permissões especificadas
   */
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user || isLoading) return false;
    if (error) return false; // Bloquear acesso em caso de erro
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
    if (error) return false; // Bloquear acesso em caso de erro
    
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
    if (error) return false; // Bloquear acesso em caso de erro
    
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
    if (error) return false; // Bloquear acesso em caso de erro
    
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
