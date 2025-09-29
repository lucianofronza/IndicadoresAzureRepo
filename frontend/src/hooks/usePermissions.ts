import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import api from '../services/api';
import { debugLogger } from '../components/DebugLogger';
import { useRef, useCallback } from 'react';

export const usePermissions = () => {
  const { user } = useAuth();
  const requestInProgress = useRef(false);

  // Função debounced para buscar permissões
  const debouncedFetchPermissions = useCallback(async () => {
    if (requestInProgress.current) {
      debugLogger.log('⏳ usePermissions: Requisição já em andamento, aguardando...');
      return [];
    }

    requestInProgress.current = true;
    
    try {
      debugLogger.log('🔍 usePermissions: Iniciando busca de permissões para usuário: ' + user?.id);
      
      if (!user) {
        debugLogger.log('❌ usePermissions: Usuário não encontrado, retornando array vazio');
        return [];
      }
      
      // Aguardar um pouco para garantir que o token esteja disponível
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
    } finally {
      requestInProgress.current = false;
    }
  }, [user?.id]);

  // Buscar permissões do usuário
  const { data: userPermissions = [], isLoading, error } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: debouncedFetchPermissions,
    enabled: !!user,
    retry: (failureCount, error: any) => {
      debugLogger.log(`🔄 usePermissions: Retry ${failureCount + 1}, erro: ${error?.response?.status || error?.message}`, 'warning');
      
      // Se for erro 401 (token inválido), tentar novamente automaticamente
      if (error?.response?.status === 401 && failureCount < 5) {
        debugLogger.log(`🔄 usePermissions: Tentativa automática ${failureCount + 1}/5 após erro 401`, 'warning');
        return true;
      }
      
      // Se for erro de rede ou timeout, tentar mais vezes
      if (error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT') {
        return failureCount < 3;
      }
      
      // Para outros erros, tentar apenas 1 vez
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => {
      // Delay mais rápido para erros 401 (problema de timing)
      const error = (attemptIndex as any)?.error;
      if (error?.response?.status === 401) {
        return Math.min(500 * (attemptIndex + 1), 2000); // 500ms, 1000ms, 1500ms, 2000ms
      }
      // Delay normal para outros erros
      return Math.min(1000 * 2 ** attemptIndex, 30000);
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnWindowFocus: false, // Não refetch quando focar na janela
    refetchOnMount: true, // Refetch quando montar o componente
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
