import React, { createContext, useContext } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  login: string;
  role?: {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
  } | string;
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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithAzureAd: (azureAdData: AzureAdLoginData) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  refreshToken: () => Promise<void>;
}

interface AzureAdLoginData {
  azureAdId: string;
  email: string;
  name: string;
  azureAdEmail?: string;
}

interface RegisterData {
  name: string;
  email: string;
  login: string;
  password: string;
  roleId?: string;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export type { User, AuthContextType, RegisterData, AzureAdLoginData };
