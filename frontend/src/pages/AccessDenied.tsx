import React from 'react';
import { Shield } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Ícone */}
        <div className="mx-auto h-24 w-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <Shield className="h-12 w-12 text-red-600" />
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Acesso Negado
        </h1>

        {/* Descrição */}
        <p className="text-lg text-gray-600 mb-8">
          Você não tem permissão para acessar esta página. 
          Entre em contato com o administrador do sistema se acredita que isso é um erro.
        </p>

        {/* Código de erro */}
        <div className="bg-white rounded-lg p-4 mb-8 border border-red-200">
          <p className="text-sm text-gray-500 mb-2">Código de Erro:</p>
          <p className="text-sm font-mono text-red-600 bg-red-50 px-3 py-1 rounded">
            INSUFFICIENT_PERMISSIONS
          </p>
        </div>

        {/* Informações adicionais */}
        <div className="mt-8 text-sm text-gray-500">
          <p>
            Se você acredita que deveria ter acesso a esta funcionalidade, 
            verifique suas permissões na seção &quot;Grupos de Segurança&quot; do sistema.
          </p>
        </div>
      </div>
    </div>
  );
};
