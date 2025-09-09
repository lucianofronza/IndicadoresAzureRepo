import React, { useState } from 'react';
import { Bell, Check, UserCheck, Clock, Filter, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: 'unread' | 'read' | 'action_taken';
  createdAt: string;
  readAt?: string;
  actionTakenAt?: string;
  targetUser?: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
}

type StatusFilter = 'all' | 'unread' | 'read' | 'action_taken';

export const Notifications: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Buscar notificações
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', 'list', page, statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await api.get(`/notifications?${params.toString()}`);
      return response.data;
    },
  });

  // Mutação para marcar como lida
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutação para aprovar usuário
  const approveUserMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await api.post(`/notifications/${notificationId}/approve-user`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleApproveUser = (notificationId: string) => {
    approveUserMutation.mutate(notificationId);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unread':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Não lida
          </span>
        );
      case 'read':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Lida
          </span>
        );
      case 'action_taken':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Ação tomada
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'unread':
        return <div className="w-3 h-3 bg-blue-500 rounded-full" />;
      case 'read':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'action_taken':
        return <UserCheck className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setSearchTerm('');
    setPage(1);
  };

  const notifications = notificationsData?.data || [];
  const pagination = notificationsData?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bell className="w-6 h-6 text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Search className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Todas</option>
              <option value="unread">Não lidas</option>
              <option value="read">Lidas</option>
              <option value="action_taken">Ação tomada</option>
            </select>
          </div>

          {/* Limpar filtros */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="btn btn-secondary w-full px-4"
              style={{ height: '2.6rem' }}
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Lista de notificações */}
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
            <p className="text-gray-500">Carregando notificações...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma notificação encontrada
            </h3>
            <p className="text-gray-500">
              {statusFilter === 'all' 
                ? 'Você não possui notificações ainda.'
                : 'Nenhuma notificação encontrada com os filtros aplicados.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification: Notification) => (
              <div key={notification.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(notification.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {notification.title}
                      </h3>
                      {getStatusBadge(notification.status)}
                    </div>
                    
                    <p className="text-gray-600 mb-3">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Criada em: {formatDateTime(notification.createdAt)}</span>
                        {notification.readAt && (
                          <span>Lida em: {formatDateTime(notification.readAt)}</span>
                        )}
                        {notification.actionTakenAt && (
                          <span>Ação em: {formatDateTime(notification.actionTakenAt)}</span>
                        )}
                      </div>
                      
                      {notification.status === 'unread' && notification.type === 'user_approval' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="btn btn-secondary btn-sm"
                            disabled={markAsReadMutation.isPending}
                          >
                            Marcar como lida
                          </button>
                          <button
                            onClick={() => handleApproveUser(notification.id)}
                            className="btn btn-primary btn-sm"
                            disabled={approveUserMutation.isPending}
                          >
                            Aprovar Usuário
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} a{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} de{' '}
                {pagination.total} notificações
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                  className="btn btn-secondary btn-sm"
                >
                  Anterior
                </button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                  className="btn btn-secondary btn-sm"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
