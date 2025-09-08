import { Request } from 'express';

// Tipos de usuário do banco de dados
export interface DbUser {
  id: string;
  name: string;
  email: string;
  login: string;
  password?: string; // Opcional para usuários Azure AD
  role: string;
  isActive: boolean;
  status: 'active' | 'pending' | 'inactive'; // Novo campo para status
  azureAdId?: string; // ID do usuário no Azure AD
  azureAdEmail?: string; // Email do Azure AD (pode ser diferente do email principal)
  developerId?: string; // Vínculo com cadastro de desenvolvedor
  viewScope: 'own' | 'teams' | 'all'; // Controle de visualização de dados
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
  status: 'active' | 'pending' | 'inactive';
  azureAdId?: string;
  azureAdEmail?: string;
  developerId?: string;
  viewScope: 'own' | 'teams' | 'all';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de entrada para criação de usuário
export interface UserCreateInput {
  name: string;
  email: string;
  login: string;
  password?: string; // Opcional para usuários Azure AD
  roleId: string; // Obrigatório
  azureAdId?: string;
  azureAdEmail?: string;
  developerId?: string;
  viewScope?: 'own' | 'teams' | 'all'; // Opcional, default 'own'
}

// Tipos de entrada para atualização de usuário
export interface UserUpdateInput {
  name?: string;
  email?: string;
  login?: string;
  password?: string;
  roleId?: string;
  isActive?: boolean;
  status?: 'active' | 'pending' | 'inactive';
  azureAdId?: string;
  azureAdEmail?: string;
  developerId?: string;
  viewScope?: 'own' | 'teams' | 'all';
}

// Tipos de role de usuário
export interface UserRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de entrada para criação de role
export interface UserRoleCreateInput {
  name: string;
  description?: string;
  permissions: string[];
  isSystem?: boolean;
  isDefault?: boolean;
}

// Tipos de entrada para atualização de role
export interface UserRoleUpdateInput {
  name?: string;
  description?: string;
  permissions?: string[];
  isSystem?: boolean;
  isDefault?: boolean;
}

// Tipos de associação usuário-equipe
export interface UserTeam {
  id: string;
  userId: string;
  teamId: string;
  role: 'member' | 'coordinator' | 'manager';
  createdAt: Date;
  updatedAt: Date;
  team?: {
    id: string;
    name: string;
  };
}

// Tipos de entrada para criação de associação usuário-equipe
export interface UserTeamCreateInput {
  userId: string;
  teamId: string;
  role?: 'member' | 'coordinator' | 'manager';
}

// Tipos de entrada para atualização de associação usuário-equipe
export interface UserTeamUpdateInput {
  role?: 'member' | 'coordinator' | 'manager';
}

// Tipos de requisição de login
export interface LoginRequest {
  email: string;
  password: string;
}

// Tipos de requisição de login Azure AD
export interface AzureAdLoginRequest {
  azureAdId: string;
  email: string;
  name: string;
  azureAdEmail?: string;
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
    viewScope: 'own' | 'teams' | 'all';
  };
  userPermissions?: string[];
  token?: string;
  requestId?: string;
  log?: any;
}
