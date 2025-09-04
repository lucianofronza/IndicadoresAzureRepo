import React, { createContext } from 'react';

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
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  refreshToken: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  login: string;
  password: string;
  roleId?: string;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export type { User, AuthContextType, RegisterData };
