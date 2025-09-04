import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { AccessDenied } from '../pages/AccessDenied';

interface PermissionRouteProps {
  children: React.ReactNode;
  permission: string;
  fallback?: 'redirect' | 'access-denied';
  redirectTo?: string;
}

export const PermissionRoute: React.FC<PermissionRouteProps> = ({ 
  children, 
  permission, 
  fallback = 'access-denied',
  redirectTo = '/dashboard'
}) => {
  const { hasPermission, isLoading } = usePermissions();

  // Se ainda está carregando, mostrar loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="text-gray-600">Verificando permissões...</span>
        </div>
      </div>
    );
  }

  // Se não tem permissão
  if (!hasPermission(permission)) {
    if (fallback === 'redirect') {
      return <Navigate to={redirectTo} replace />;
    }
    
    return <AccessDenied />;
  }

  // Se tem permissão, mostrar o conteúdo
  return <>{children}</>;
};
