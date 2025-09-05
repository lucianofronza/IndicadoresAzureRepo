import React, { useState, useEffect, ReactNode } from 'react';
import { AuthContext, type AuthContextType, type RegisterData, type AzureAdLoginData } from './AuthContext';
import { useAzureAd } from '../hooks/useAzureAd';
import api from '../services/api';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { loginWithAzureAd: azureAdLogin, logout: azureAdLogout } = useAzureAd();

  // Verificar se há token salvo no localStorage
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          // Configurar o token no axios
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verificar se o token ainda é válido
          const response = await api.get('/auth/me');
          setUser(response.data.data);
        }
      } catch (error) {
        // Token inválido, limpar localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        delete api.defaults.headers.common['Authorization'];
      } finally {
        setIsLoading(false);
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
    try {
      let userData = azureAdData;
      
      // Se não foi passado dados, fazer login com Azure AD real
      if (!userData) {
        userData = await azureAdLogin();
      }
      
      // Se userData já contém os dados processados do callback, usar diretamente
      if (userData && userData.success && userData.data) {
        const { user, accessToken, refreshToken, requiresApproval, message } = userData.data;

        // Se usuário requer aprovação, mostrar mensagem de erro
        if (requiresApproval) {
          throw new Error(message || 'Usuário pendente de aprovação. Entre em contato com o administrador.');
        }

        // Salvar tokens no localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        // Configurar token no axios
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        setUser(user);
      } else {
        // Se não tem dados processados, fazer chamada para o backend
        const response = await api.post('/auth/azure-ad-login', userData);
        const { user, accessToken, refreshToken, requiresApproval, message } = response.data.data;

        // Se usuário requer aprovação, mostrar mensagem de erro
        if (requiresApproval) {
          throw new Error(message || 'Usuário pendente de aprovação. Entre em contato com o administrador.');
        }

        // Salvar tokens no localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        // Configurar token no axios
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        setUser(user);
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
