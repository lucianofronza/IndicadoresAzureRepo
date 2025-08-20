import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  GitPullRequest, 
  GitCommit, 
  FolderGit2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Plus,
  CheckCircle,
  Key,
  Building2,
  Eye,
  EyeOff
} from 'lucide-react'
import { azureDevOpsApi } from '@/services/azureDevOpsApi'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface AzureConfig {
  organization: string
  personalAccessToken: string
}

export const RepositoryConfiguration: React.FC = () => {
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({
    organization: '',
    personalAccessToken: ''
  })
  const [showToken, setShowToken] = useState(false)
  const [isConfigValid, setIsConfigValid] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedRepository, setSelectedRepository] = useState<string>('')
  const [addingRepositories, setAddingRepositories] = useState<Set<string>>(new Set())
  
  const queryClient = useQueryClient()

  // Validate Azure DevOps connection
  const validateConnectionMutation = useMutation({
    mutationFn: async (config: AzureConfig) => {
      const result = await azureDevOpsApi.validateConnection(config)
      return result
    },
    onSuccess: (result) => {
      if (result.success) {
        setIsConfigValid(true)
        setIsValidating(false)
        // Store sessionId if provided
        if (result.sessionId) {
          setSessionId(result.sessionId)
        }
        toast.success(result.message || 'Conexão com Azure DevOps validada com sucesso!')
      } else {
        setIsConfigValid(false)
        setIsValidating(false)
        toast.error(result.message || 'Erro ao validar conexão. Verifique a organização e o token.')
      }
    },
    onError: () => {
      setIsConfigValid(false)
      setIsValidating(false)
      toast.error('Erro ao validar conexão. Verifique a organização e o token.')
    }
  })

  // Fetch repositories for selected project
  const { data: repositories, isLoading: reposLoading, error: reposError } = useQuery({
    queryKey: ['azure-devops-repositories', selectedProject, sessionId],
    queryFn: () => azureDevOpsApi.getRepositories(selectedProject, sessionId),
    enabled: !!selectedProject && isConfigValid && !!sessionId,
    retry: 1,
  })

  // Fetch projects with session credentials
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['azure-devops-projects', sessionId],
    queryFn: () => azureDevOpsApi.getProjects(sessionId),
    enabled: isConfigValid && !!sessionId,
    retry: 1,
  })

  // Fetch pull requests for selected repository
  const { data: pullRequests, isLoading: prsLoading } = useQuery({
    queryKey: ['azure-devops-pullrequests', selectedRepository, sessionId],
    queryFn: () => azureDevOpsApi.getPullRequests(selectedRepository, 50, sessionId),
    enabled: !!selectedRepository && isConfigValid && !!sessionId,
  })

  // Fetch commits for selected repository
  const { data: commits, isLoading: commitsLoading } = useQuery({
    queryKey: ['azure-devops-commits', selectedRepository, sessionId],
    queryFn: () => azureDevOpsApi.getCommits(selectedRepository, 50, sessionId),
    enabled: !!selectedRepository && isConfigValid && !!sessionId,
  })

  // Fetch configured repositories to check if already monitored
  const { data: configuredRepositories } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const response = await api.get('/repositories')
      return response.data.data
    },
  })

  // Add repository to monitoring mutation
  const addRepositoryMutation = useMutation({
    mutationFn: async (repository: any) => {
      const response = await api.post('/repositories', {
        name: repository.name,
        organization: azureConfig.organization,
        project: repository.project?.name || '',
        url: repository.url,
        azureId: repository.id,
        personalAccessToken: azureConfig.personalAccessToken, // Adicionar o token criptografado
      })
      return response.data
    },
    onSuccess: (_data, repository) => {
      toast.success(`Repositório "${repository.name}" adicionado ao monitoramento!`)
      setAddingRepositories(prev => {
        const newSet = new Set(prev)
        newSet.delete(repository.id)
        return newSet
      })
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
    },
    onError: (error: any, repository) => {
      toast.error(`Erro ao adicionar repositório "${repository.name}": ${error.response?.data?.message || 'Erro desconhecido'}`)
      setAddingRepositories(prev => {
        const newSet = new Set(prev)
        newSet.delete(repository.id)
        return newSet
      })
    }
  })

  const handleValidateConnection = () => {
    if (!azureConfig.organization || !azureConfig.personalAccessToken) {
      toast.error('Por favor, preencha a organização e o token de acesso pessoal.')
      return
    }

    setIsValidating(true)
    validateConnectionMutation.mutate(azureConfig)
  }

  const handleConfigChange = (field: keyof AzureConfig, value: string) => {
    setAzureConfig(prev => ({ ...prev, [field]: value }))
    // Reset validation when config changes
    if (isConfigValid) {
      setIsConfigValid(false)
      setSelectedProject('')
      setSelectedRepository('')
    }
  }

  if (reposError || projectsError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Erro ao conectar com Azure DevOps
              </h3>
              <div className="mt-2 text-sm text-red-700">
                Verifique se suas credenciais estão corretas.
              </div>
              {reposError && (
                <div className="mt-2 text-xs text-red-600">
                  Erro: {JSON.stringify(reposError)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleAddToMonitoring = (repository: any) => {
    setAddingRepositories(prev => new Set(prev).add(repository.id))
    addRepositoryMutation.mutate(repository)
  }

  const isRepositoryMonitored = (repository: any) => {
    if (!configuredRepositories) return false
    return configuredRepositories.some((configuredRepo: any) => 
      configuredRepo.url === repository.url || 
      (configuredRepo.name === repository.name && configuredRepo.project === repository.project?.name)
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Repositórios Azure DevOps
        </h1>
        <p className="text-gray-600">
          Configure sua conexão com Azure DevOps e inclua repositórios para monitoramento
        </p>
      </div>

      {/* Azure DevOps Configuration Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Key className="h-5 w-5 mr-2" />
          Configuração Azure DevOps
        </h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organização *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={azureConfig.organization}
                  onChange={(e) => handleConfigChange('organization', e.target.value)}
                  placeholder="ex: minha-empresa"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Nome da sua organização no Azure DevOps
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal Access Token *
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showToken ? 'text' : 'password'}
                  value={azureConfig.personalAccessToken}
                  onChange={(e) => handleConfigChange('personalAccessToken', e.target.value)}
                  placeholder="Seu token de acesso pessoal"
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Token com permissões de leitura para Code e Work Items
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-4">
              {isConfigValid && (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">Conexão válida</span>
                </div>
              )}
            </div>
            
            <button
              onClick={handleValidateConnection}
              disabled={isValidating || !azureConfig.organization || !azureConfig.personalAccessToken}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${
                isValidating || !azureConfig.organization || !azureConfig.personalAccessToken
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
              }`}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                'Validar Conexão'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Projects Section - Only show if config is valid */}
      {isConfigValid && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FolderGit2 className="h-5 w-5 mr-2" />
            Projetos
          </h2>
          
          {projectsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione um projeto para ver os repositórios:
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => {
                    setSelectedProject(e.target.value)
                    setSelectedRepository('') // Reset selected repository
                  }}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Selecione um projeto...</option>
                  {projects?.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedProject && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">
                    Projeto Selecionado: {projects?.find(p => p.id === selectedProject)?.name}
                  </h3>
                  <p className="text-sm text-blue-700">
                    Agora você pode ver os repositórios deste projeto na seção abaixo.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Repositories Section - Only show if project is selected */}
      {isConfigValid && selectedProject && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <GitCommit className="h-5 w-5 mr-2" />
            Repositórios
          </h2>
          
          {reposLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              <span className="ml-2">Carregando repositórios...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {repositories && repositories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {repositories.map((repo) => (
                    <div 
                      key={repo.id} 
                      className={`border rounded-lg p-4 transition-colors ${
                        selectedRepository === repo.id 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div 
                        className="cursor-pointer"
                        onClick={() => setSelectedRepository(repo.id)}
                      >
                        <h3 className="font-medium text-gray-900">{repo.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Projeto: {typeof repo.project === 'object' && repo.project ? (repo.project as any).name : repo.project}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <a 
                          href={repo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver no Azure DevOps
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                        
                        {isRepositoryMonitored(repo) ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Já Monitorado
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddToMonitoring(repo)
                            }}
                            disabled={addingRepositories.has(repo.id)}
                            className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                              addingRepositories.has(repo.id)
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {addingRepositories.has(repo.id) ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Adicionando...
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Adicionar ao Monitoramento
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhum repositório encontrado para este projeto</p>
                  {repositories && repositories.length === 0 && (
                    <p className="text-xs text-gray-400 mt-2">Array vazio retornado</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pull Requests Section */}
      {selectedRepository && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <GitPullRequest className="h-5 w-5 mr-2" />
            Pull Requests
          </h2>
          
          {prsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {pullRequests?.map((pr) => (
                <div key={pr.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{pr.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Criado por: {pr.createdBy.displayName}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>Status: {pr.status}</span>
                        <span>Merge: {pr.mergeStatus}</span>
                        <span>Criado: {new Date(pr.creationDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pr.status === 'active' ? 'bg-green-100 text-green-800' :
                        pr.status === 'abandoned' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {pr.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commits Section */}
      {selectedRepository && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <GitCommit className="h-5 w-5 mr-2" />
            Commits Recentes
          </h2>
          
          {commitsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {commits?.slice(0, 10).map((commit) => (
                <div key={commit.commitId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{commit.comment}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Autor: {commit.author.name} ({commit.author.email})
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Data: {new Date(commit.author.date).toLocaleString()}
                      </p>
                    </div>
                    <div className="ml-4">
                      <span className="text-xs text-gray-500 font-mono">
                        {commit.commitId.substring(0, 8)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
