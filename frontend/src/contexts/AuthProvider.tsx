import React, { useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthContextType, type RegisterData, type AzureAdLoginData } from './AuthContext';
import { useAzureAd } from '../hooks/useAzureAd';
import api from '../services/api';
import { debugLogger } from '../components/DebugLogger';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { loginWithAzureAd: azureAdLogin, logout: azureAdLogout } = useAzureAd();
  const queryClient = useQueryClient();

  // Verificar se há token salvo no localStorage
  useEffect(() => {
    const checkAuth = async () => {
      debugLogger.log('🔍 AuthProvider: Iniciando verificação de autenticação');
      try {
        const token = localStorage.getItem('accessToken');
        debugLogger.log('🔑 AuthProvider: Token encontrado no localStorage: ' + !!token);
        
        if (token) {
          // Configurar o token no axios
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          debugLogger.log('🔑 AuthProvider: Token configurado no axios para verificação');
          
          // Verificar se o token ainda é válido
          debugLogger.log('🌐 AuthProvider: Fazendo requisição para /auth/me');
          const response = await api.get('/auth/me');
          debugLogger.log('✅ AuthProvider: Resposta recebida: ' + JSON.stringify(response.data));
          
          setUser(response.data.data);
          debugLogger.log('👤 AuthProvider: Usuário definido após verificação');
        } else {
          debugLogger.log('❌ AuthProvider: Nenhum token encontrado');
        }
      } catch (error: any) {
        debugLogger.log('❌ AuthProvider: Erro na verificação de autenticação: ' + error.message, 'error');
        debugLogger.log('❌ AuthProvider: Status do erro: ' + error.response?.status, 'error');
        
        // Token inválido, limpar localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        delete api.defaults.headers.common['Authorization'];
        
        // Limpar cache do React Query para evitar dados antigos
        queryClient.clear();
        debugLogger.log('🧹 AuthProvider: Cache limpo após erro');
      } finally {
        setIsLoading(false);
        debugLogger.log('✅ AuthProvider: Verificação de autenticação concluída');
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data.data;

      // Salvar tokens no localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Configurar token no axios
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao fazer login');
    }
  };

  const loginWithAzureAd = async (azureAdData?: AzureAdLoginData) => {
    debugLogger.log('🚀 AuthProvider: Iniciando login com Azure AD');
    try {
      let userData = azureAdData;
      
      // Se não foi passado dados, fazer login com Azure AD real
      if (!userData) {
        debugLogger.log('🌐 AuthProvider: Fazendo login com Azure AD real');
        userData = await azureAdLogin() as AzureAdLoginData;
        debugLogger.log('✅ AuthProvider: Login com Azure AD concluído: ' + JSON.stringify(userData));
      }
      
      // Se userData já contém os dados processados do callback, usar diretamente
      if (userData && (userData as any).success && (userData as any).data) {
        debugLogger.log('📋 AuthProvider: Usando dados processados do callback');
        const { user, accessToken, refreshToken, requiresApproval, message } = (userData as any).data;

        // Se usuário requer aprovação, mostrar mensagem de erro
        if (requiresApproval) {
          debugLogger.log('❌ AuthProvider: Usuário requer aprovação', 'error');
          throw new Error(message || 'Usuário pendente de aprovação. Entre em contato com o administrador.');
        }

        // Salvar tokens no localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        debugLogger.log('💾 AuthProvider: Tokens salvos no localStorage');

        // Configurar token no axios
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        debugLogger.log('🔑 AuthProvider: Token configurado no axios');

        debugLogger.log('👤 AuthProvider: Definindo usuário: ' + JSON.stringify(user));
        setUser(user);
        debugLogger.log('✅ AuthProvider: Login concluído com sucesso', 'success');
      } else {
        // Se não tem dados processados, fazer chamada para o backend
        debugLogger.log('🌐 AuthProvider: Fazendo chamada para /auth/azure-ad-login');
        const response = await api.post('/auth/azure-ad-login', userData);
        debugLogger.log('✅ AuthProvider: Resposta do backend: ' + JSON.stringify(response.data));
        
        const { user, accessToken, refreshToken, requiresApproval, message } = response.data.data;

        // Se usuário requer aprovação, mostrar mensagem de erro
        if (requiresApproval) {
          debugLogger.log('❌ AuthProvider: Usuário requer aprovação', 'error');
          throw new Error(message || 'Usuário pendente de aprovação. Entre em contato com o administrador.');
        }

        // Salvar tokens no localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        debugLogger.log('💾 AuthProvider: Tokens salvos no localStorage');

        // Configurar token no axios
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        debugLogger.log('🔑 AuthProvider: Token configurado no axios');

        debugLogger.log('👤 AuthProvider: Definindo usuário: ' + JSON.stringify(user));
        
        // Aguardar um pouco para garantir que o token seja propagado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setUser(user);
        debugLogger.log('✅ AuthProvider: Login concluído com sucesso', 'success');
      }
    } catch (error: any) {
      console.error('Azure AD login error:', error);
      throw new Error(error.response?.data?.message || error.message || 'Erro ao fazer login com Azure AD');
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        await api.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      // Logout do Azure AD apenas se o usuário fez login com Azure AD
      if (user?.azureAdId) {
        await azureAdLogout();
      }
    } catch (error) {
      // Ignorar erros no logout
      console.warn('Erro ao fazer logout:', error);
    } finally {
      // Limpar dados locais
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      
      // Limpar cache do React Query para evitar dados antigos
      queryClient.clear();
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { user, accessToken, refreshToken } = response.data.data;

      // Salvar tokens no localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Configurar token no axios
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erro ao registrar usuário');
    }
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('Refresh token não encontrado');
      }

      const response = await api.post('/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data.data;

      // Atualizar tokens no localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Configurar novo token no axios
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } catch (error: any) {
      // Se o refresh falhar, fazer logout
      await logout();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithAzureAd,
    logout,
    register,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
