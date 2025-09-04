import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { Sidebar } from './Sidebar';

export const DynamicSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { canView, isLoading } = usePermissions();

  // Se ainda está carregando as permissões, mostrar loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="text-gray-600">Carregando permissões...</span>
        </div>
      </div>
    );
  }

  return <Sidebar />;
};
