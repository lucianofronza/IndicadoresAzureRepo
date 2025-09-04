import { Request } from 'express';

// Tipos de usuário do banco de dados
export interface DbUser {
  id: string;
  name: string;
  email: string;
  login: string;
  password: string;
  role: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de usuário para a API
export interface User {
  id: string;
  name: string;
  email: string;
  login: string;
  role: 'admin' | 'user';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de entrada para criação de usuário
export interface UserCreateInput {
  name: string;
  email: string;
  login: string;
  password: string;
  role?: 'admin' | 'user';
}

// Tipos de entrada para atualização de usuário
export interface UserUpdateInput {
  name?: string;
  email?: string;
  login?: string;
  password?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
}

// Tipos de requisição de login
export interface LoginRequest {
  email: string;
  password: string;
}

// Tipos de resposta de login
export interface LoginResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Tipos de requisição de refresh token
export interface RefreshTokenRequest {
  refreshToken: string;
}

// Tipos de resposta de refresh token
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Tipos de requisição para alterar senha
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Tipos de requisição para esqueci a senha
export interface ForgotPasswordRequest {
  email: string;
}

// Tipos de requisição para resetar senha
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// Tipo de requisição autenticada
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    login: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
  };
  token?: string;
  requestId?: string;
  log?: any;
}
