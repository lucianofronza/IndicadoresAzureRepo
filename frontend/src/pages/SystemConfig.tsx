import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Eye, 
  EyeOff, 
  Save, 
  Trash2, 
  Plus,
  Key,
  Shield,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface SystemConfig {
  id: string
  key: string
  value: string
  description?: string
  isEncrypted: boolean
  createdAt: string
  updatedAt: string
}

interface CreateConfigData {
  key: string
  value: string
  description?: string
  isEncrypted?: boolean
}



export const SystemConfig: React.FC = () => {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [newConfig, setNewConfig] = useState<CreateConfigData>({
    key: '',
    value: '',
    description: '',
    isEncrypted: false
  })
  const [showNewForm, setShowNewForm] = useState(false)

  const queryClient = useQueryClient()

  // Fetch all configurations
  const { data: configs, isLoading } = useQuery({
    queryKey: ['system-configs'],
    queryFn: async () => {
      const response = await api.get('/system-config')
      return response.data.data as SystemConfig[]
    },
    refetchOnWindowFocus: false,
  })

  // Fetch Azure DevOps config specifically
  const { data: azureConfig } = useQuery({
    queryKey: ['azure-devops-config'],
    queryFn: async () => {
      const response = await api.get('/system-config/azure-devops/config')
      return response.data.data
    },
    retry: false,
  })

  // Create configuration mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateConfigData) => {
      const response = await api.post('/system-config', data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-configs'] })
      toast.success('Configuração criada com sucesso')
      setNewConfig({ key: '', value: '', description: '', isEncrypted: false })
      setShowNewForm(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar configuração')
    }
  })



  // Delete configuration mutation
  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      await api.delete(`/system-config/${key}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-configs'] })
      queryClient.invalidateQueries({ queryKey: ['azure-devops-config'] })
      toast.success('Configuração removida com sucesso')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao remover configuração')
    }
  })

  // Update Azure DevOps config mutation
  const updateAzureConfigMutation = useMutation({
    mutationFn: async (data: { organization: string; personalAccessToken: string }) => {
      const response = await api.post('/system-config/azure-devops/config', data)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['azure-devops-config'] })
      queryClient.invalidateQueries({ queryKey: ['system-configs'] })
      toast.success('Configuração Azure DevOps atualizada com sucesso')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar configuração Azure DevOps')
    }
  })

  const handleCreateConfig = () => {
    if (!newConfig.key || !newConfig.value) {
      toast.error('Chave e valor são obrigatórios')
      return
    }
    createMutation.mutate(newConfig)
  }



  const handleDeleteConfig = (key: string) => {
    if (confirm('Tem certeza que deseja remover esta configuração?')) {
      deleteMutation.mutate(key)
    }
  }

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const getDisplayValue = (config: SystemConfig) => {
    if (config.isEncrypted) {
      return showPasswords[config.key] ? config.value : '••••••••'
    }
    return config.value
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie as configurações do sistema e integrações
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Configuração
        </button>
      </div>

      {/* Azure DevOps Configuration */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Key className="h-5 w-5 mr-2" />
            Configuração Azure DevOps
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure a organização e token de acesso pessoal do Azure DevOps
          </p>
        </div>
        <div className="p-6">
          <AzureDevOpsConfigForm 
            config={azureConfig}
            onSave={updateAzureConfigMutation.mutate}
            isLoading={updateAzureConfigMutation.isPending}
          />
        </div>
      </div>

      {/* New Configuration Form */}
      {showNewForm && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Nova Configuração</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chave *
              </label>
              <input
                type="text"
                value={newConfig.key}
                onChange={(e) => setNewConfig(prev => ({ ...prev, key: e.target.value }))}
                className="input"
                placeholder="ex: api_key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor *
              </label>
              <input
                type="text"
                value={newConfig.value}
                onChange={(e) => setNewConfig(prev => ({ ...prev, value: e.target.value }))}
                className="input"
                placeholder="Valor da configuração"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <input
                type="text"
                value={newConfig.description}
                onChange={(e) => setNewConfig(prev => ({ ...prev, description: e.target.value }))}
                className="input"
                placeholder="Descrição da configuração"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newConfig.isEncrypted}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, isEncrypted: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  Criptografar valor (para dados sensíveis)
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreateConfig}
              disabled={createMutation.isPending}
              className="btn btn-primary"
            >
              {createMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Configurations List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Todas as Configurações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chave
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Segurança
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {configs?.map((config) => (
                <tr key={config.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {config.key}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900 font-mono">
                        {getDisplayValue(config)}
                      </span>
                      {config.isEncrypted && (
                        <button
                          onClick={() => togglePasswordVisibility(config.key)}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords[config.key] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {config.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {config.isEncrypted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Criptografado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Texto
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingKey(editingKey === config.key ? null : config.key)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(config.key)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Azure DevOps Configuration Form Component
interface AzureDevOpsConfigFormProps {
  config?: any
  onSave: (data: { organization: string; personalAccessToken: string }) => void
  isLoading: boolean
}

const AzureDevOpsConfigForm: React.FC<AzureDevOpsConfigFormProps> = ({ 
  config, 
  onSave, 
  isLoading 
}) => {
  const [formData, setFormData] = useState({
    organization: config?.organization || '',
    personalAccessToken: ''
  })
  const [showToken, setShowToken] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.organization || !formData.personalAccessToken) {
      toast.error('Organização e Token são obrigatórios')
      return
    }
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organização *
          </label>
          <input
            type="text"
            value={formData.organization}
            onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
            className="input"
            placeholder="ex: minha-organizacao"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personal Access Token *
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={formData.personalAccessToken}
              onChange={(e) => setFormData(prev => ({ ...prev, personalAccessToken: e.target.value }))}
              className="input pr-10"
              placeholder="Token de acesso pessoal"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      
      {config && (
        <div className="flex items-center p-3 bg-blue-50 rounded-md">
          <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
          <span className="text-sm text-blue-700">
            Configuração atual: {config.organization} (Token configurado)
          </span>
        </div>
      )}

      <div className="flex items-center p-3 bg-yellow-50 rounded-md">
        <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
        <span className="text-sm text-yellow-700">
          O token será armazenado de forma criptografada no banco de dados para segurança.
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configuração
        </button>
      </div>
    </form>
  )
}
