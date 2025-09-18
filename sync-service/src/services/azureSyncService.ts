import axios, { AxiosInstance } from 'axios';
import { logger } from '@/utils/logger';
import { recordAzureApiRequest } from '@/utils/metrics';

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  error?: string;
}

export interface AzureRepository {
  id: string;
  name: string;
  organization: string;
  project: string;
  azureId: string;
  encryptedToken: string;
  lastSyncAt: Date | null;
}

export class AzureSyncService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env['AZURE_DEVOPS_BASE_URL'] || 'https://dev.azure.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Indicadores-Sync-Service/1.0.0'
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Azure API request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        logger.error('Azure API request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and metrics
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config as any).startTime;
        recordAzureApiRequest(
          response.config.url || 'unknown',
          response.status.toString(),
          duration
        );
        return response;
      },
      (error) => {
        const duration = Date.now() - (error.config?.startTime || Date.now());
        recordAzureApiRequest(
          error.config?.url || 'unknown',
          error.response?.status?.toString() || 'error',
          duration
        );
        return Promise.reject(error);
      }
    );
  }

  async syncRepository(
    repositoryId: string,
    syncType: 'full' | 'incremental' = 'incremental'
  ): Promise<SyncResult> {
    try {
      logger.info('Starting Azure sync', { repositoryId, syncType });

      // Get repository configuration
      const repository = await this.getRepository(repositoryId);
      if (!repository) {
        throw new Error('Repository not found');
      }

      logger.info('Repository data retrieved', {
        repositoryId,
        name: repository.name,
        organization: repository.organization,
        project: repository.project,
        hasToken: !!repository.encryptedToken,
        lastSyncAt: repository.lastSyncAt
      });

      // Decrypt token
      const token = await this.decryptToken(repository.encryptedToken);
      if (!token) {
        throw new Error('Invalid or missing Azure DevOps token');
      }

      logger.info('Token decrypted successfully', {
        repositoryId,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 10) + '...'
      });

      // Set up authentication
      this.axiosInstance.defaults.auth = {
        username: '',
        password: token
      };

      // Determine sync parameters
      const since = syncType === 'incremental' && repository.lastSyncAt 
        ? new Date(repository.lastSyncAt).toISOString()
        : undefined;

      logger.info('Sync parameters determined', {
        repositoryId: repository.id,
        syncType,
        lastSyncAt: repository.lastSyncAt,
        since,
        isIncremental: syncType === 'incremental',
        hasLastSyncAt: !!repository.lastSyncAt
      });

      let totalRecordsProcessed = 0;

      // Sync pull requests
      const prRecords = await this.syncPullRequests(repository, since);
      totalRecordsProcessed += prRecords;

      // Sync commits apenas dos PRs completed
      const commitRecords = await this.syncCommitsFromPRs(repository, since);
      totalRecordsProcessed += commitRecords;

      // Sync work items (if needed)
      const workItemRecords = await this.syncWorkItems(repository, since);
      totalRecordsProcessed += workItemRecords;

      logger.info('Azure sync completed', {
        repositoryId,
        syncType,
        recordsProcessed: totalRecordsProcessed
      });

      return {
        success: true,
        recordsProcessed: totalRecordsProcessed
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Azure sync failed', {
        repositoryId,
        syncType,
        error: errorMessage
      });

      return {
        success: false,
        recordsProcessed: 0,
        error: errorMessage
      };
    }
  }

  private async getRepository(repositoryId: string): Promise<AzureRepository | null> {
    try {
      // Fetch repository data from backend API
      const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
      const backendApiKey = process.env['BACKEND_API_KEY'];
      
      if (!backendApiKey) {
        throw new Error('BACKEND_API_KEY not configured');
      }

      const response = await axios.get(`${backendUrl}/api/repositories/${repositoryId}`, {
        headers: {
          'X-API-Key': backendApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.success) {
        const repo = response.data.data;
        return {
          id: repo.id,
          name: repo.name,
          organization: repo.organization,
          project: repo.project,
          azureId: repo.azureId,
          encryptedToken: repo.personalAccessToken,
          lastSyncAt: repo.lastSyncAt ? new Date(repo.lastSyncAt) : null
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to fetch repository from backend:', error);
      return null;
    }
  }

  private async decryptToken(encryptedToken: string): Promise<string | null> {
    try {
      // TODO: Implement proper token decryption
      // For now, return the token as-is (in production, use proper encryption)
      return encryptedToken;
    } catch (error) {
      logger.error('Failed to decrypt token:', error);
      return null;
    }
  }

  private async syncPullRequests(
    repository: AzureRepository,
    _since?: string
  ): Promise<number> {
    try {
      const url = `/${repository.organization}/${repository.project}/_apis/git/pullrequests`;
      const params: any = {
        'api-version': '7.0',
        '$top': 1000, // Aumentar limite para pegar mais PRs
        'searchCriteria.status': 'completed' // 🎯 FILTRAR APENAS PRs COMPLETED
        // Branch filtering será feito no código
      };

      // Remover filtro de data para sincronização completa
      // if (since) {
      //   params.searchCriteria = {
      //     createdDate: since
      //   };
      // }

      const response = await this.makeRequest('GET', url, { params });
      const allPullRequests = response.data.value || [];
      
      // Filter by repository and target branch (master or maintenance)
      const pullRequests = allPullRequests.filter((pr: any) => {
        // Filtro por repositório
        if (!pr.repository || pr.repository.id !== repository.azureId) {
          return false;
        }
        
        // Filtro por branch target (master ou maintenance)
        return this.isValidTargetBranch(pr.targetRefName);
      });

      // Log das branches encontradas para debug
      const branchStats = allPullRequests.reduce((stats: any, pr: any) => {
        const branchName = pr.targetRefName?.replace('refs/heads/', '') || 'unknown';
        stats[branchName] = (stats[branchName] || 0) + 1;
        return stats;
      }, {});

      logger.info('Azure DevOps API response', {
        repositoryId: repository.id,
        azureId: repository.azureId,
        url,
        params,
        allPullRequestsCount: allPullRequests.length,
        filteredPullRequestsCount: pullRequests.length,
        responseStatus: response.status,
        branchStats, // 🎯 Estatísticas das branches encontradas
        sampleFilteredPR: pullRequests[0] ? {
          id: pullRequests[0].pullRequestId,
          targetBranch: pullRequests[0].targetRefName,
          title: pullRequests[0].title
        } : null
      });

      // Log detalhado dos PRs encontrados com status
      if (pullRequests.length > 0) {
        const prStatuses = pullRequests.map((pr: any) => ({
          id: pr.pullRequestId,
          status: pr.status,
          title: pr.title?.substring(0, 50) + '...'
        }));
        logger.info('Pull Requests encontrados:', { prStatuses });
      }

      // Process and save pull requests
      const recordsProcessed = await this.processPullRequests(repository.id, pullRequests);

      logger.info('Pull requests synced', {
        repositoryId: repository.id,
        count: pullRequests.length,
        recordsProcessed
      });

      return recordsProcessed;

    } catch (error) {
      logger.error('Failed to sync pull requests:', error);
      return 0;
    }
  }

  private async syncCommitsFromPRs(
    repository: AzureRepository,
    since?: string
  ): Promise<number> {
    try {
      // 🎯 NOVA ABORDAGEM: Buscar commits apenas dos PRs completed
      
      // 1. Primeiro buscar PRs completed (reutilizar lógica existente)
      const url = `/${repository.organization}/${repository.project}/_apis/git/pullrequests`;
      const params: any = {
        'api-version': '7.0',
        '$top': 1000,
        'searchCriteria.status': 'completed'
      };

      const response = await this.makeRequest('GET', url, { params });
      const allPullRequests = response.data.value || [];
      
      // 2. Filtrar PRs por repositório e branch (master/maintenance)
      const filteredPRs = allPullRequests.filter((pr: any) => {
        if (!pr.repository || pr.repository.id !== repository.azureId) {
          return false;
        }
        return this.isValidTargetBranch(pr.targetRefName);
      });

      logger.info('Fetching commits from completed PRs', {
        repositoryId: repository.id,
        completedPRsCount: filteredPRs.length
      });

      // 3. Buscar commits de cada PR completed
      const allCommits: any[] = [];
      
      for (const pr of filteredPRs) {
        try {
          const prId = pr.pullRequestId;
          const commitsUrl = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/pullRequests/${prId}/commits`;
          const commitsResponse = await this.makeRequest('GET', commitsUrl, { params: { 'api-version': '7.1' } });
          
          if (commitsResponse.data?.value?.length > 0) {
            // Adicionar commits deste PR à lista
            commitsResponse.data.value.forEach((commit: any) => {
              // Evitar duplicatas (mesmo commit pode estar em múltiplos PRs)
              if (!allCommits.find(c => c.commitId === commit.commitId)) {
                allCommits.push(commit);
              }
            });
            
            logger.info('Commits fetched from PR', {
              prId,
              commitsCount: commitsResponse.data.value.length,
              totalUniqueCommits: allCommits.length
            });
          }
        } catch (error) {
          logger.warn('Failed to fetch commits for PR', {
            prId: pr.pullRequestId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('All commits from completed PRs fetched', {
        repositoryId: repository.id,
        totalCommits: allCommits.length
      });

      // 4. Processar commits (usando lógica existente)
      return await this.processCommits(repository.id, allCommits);

    } catch (error) {
      logger.error('Failed to sync commits from PRs:', error);
      return 0;
    }
  }

  private async syncCommits(
    repository: AzureRepository,
    since?: string
  ): Promise<number> {
    try {
      const url = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/commits`;
      const params: any = {
        'api-version': '7.0',
        '$top': 1000 // Aumentar limite para pegar mais commits (vamos filtrar depois)
        // 🎯 REMOVER FILTRO DE BRANCH - vamos buscar de todas e filtrar no código
      };

      if (since) {
        params.fromDate = since;
      }

      const response = await this.makeRequest('GET', url, { params });
      const commits = response.data.value || [];

      logger.info('Azure DevOps commits API response', {
        repositoryId: repository.id,
        url,
        params,
        commitsCount: commits.length,
        responseStatus: response.status
      });

      // Process and save commits
      const recordsProcessed = await this.processCommits(repository.id, commits);

      logger.info('Commits synced', {
        repositoryId: repository.id,
        count: commits.length,
        recordsProcessed
      });

      return recordsProcessed;

    } catch (error) {
      logger.error('Failed to sync commits:', error);
      return 0;
    }
  }

  private async syncWorkItems(
    repository: AzureRepository,
    since?: string
  ): Promise<number> {
    try {
      // Get work items linked to commits/PRs
      const url = `/${repository.organization}/${repository.project}/_apis/wit/wiql`;
      
      const query = {
        query: since 
          ? `SELECT [System.Id] FROM WorkItems WHERE [System.ChangedDate] >= '${since}'`
          : `SELECT [System.Id] FROM WorkItems WHERE [System.ChangedDate] >= @Today - 30`
      };

      const response = await this.makeRequest('POST', url, {
        data: query,
        params: { 'api-version': '7.0' }
      });

      const workItemIds = response.data.workItems?.map((wi: any) => wi.id) || [];
      
      if (workItemIds.length === 0) {
        return 0;
      }

      // Get work item details
      const workItemsUrl = `/${repository.organization}/${repository.project}/_apis/wit/workitems`;
      const workItemsResponse = await this.makeRequest('GET', workItemsUrl, {
        params: {
          ids: workItemIds.join(','),
          'api-version': '7.0',
          '$expand': 'all'
        }
      });

      const workItems = workItemsResponse.data.value || [];

      // Process and save work items
      const recordsProcessed = await this.processWorkItems(repository.id, workItems);

      logger.info('Work items synced', {
        repositoryId: repository.id,
        count: workItems.length,
        recordsProcessed
      });

      return recordsProcessed;

    } catch (error) {
      logger.error('Failed to sync work items:', error);
      return 0;
    }
  }

  private async makeRequest(method: string, url: string, config: any = {}): Promise<any> {
    const startTime = Date.now();
    (config as any).startTime = startTime;

    try {
      const response = await this.axiosInstance.request({
        method: method as any,
        url,
        ...config
      });

      return response;
    } catch (error: any) {
      if (error.response?.status === 429) {
        // Rate limit hit, wait and retry
        const retryAfter = error.response.headers['retry-after'] || 60;
        logger.warn('Rate limit hit, waiting', { retryAfter });
        await this.delay(retryAfter * 1000);
        
        // Retry the request
        return this.makeRequest(method, url, config);
      }
      
      throw error;
    }
  }

  private async getPullRequestDetails(pr: any, repositoryId: string): Promise<any> {
    try {
      // Usar o repositoryId passado como parâmetro em vez de buscar pelo azureId
      const repository = await this.getRepository(repositoryId);
      if (!repository) {
        throw new Error('Repository not found');
      }

      const prId = pr.pullRequestId;
      const baseUrl = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/pullRequests/${prId}`;
      
      // Buscar dados detalhados em paralelo
      logger.info('Fetching detailed PR data', { 
        prId, 
        baseUrl, 
        reviewsUrl: `${baseUrl}/reviews`,
        filesUrl: `${baseUrl}/files`
      });
      
      const [prDetails, reviews, files] = await Promise.allSettled([
        // Detalhes do PR
        this.makeRequest('GET', baseUrl, { params: { 'api-version': '7.0' } }),
        // Reviews (threads)
        this.makeRequest('GET', `${baseUrl}/threads`, { params: { 'api-version': '7.0' } }),
        // Arquivos alterados (iterations)
        this.makeRequest('GET', `${baseUrl}/iterations`, { params: { 'api-version': '7.0' } })
      ]);

      // Log dos erros específicos
      if (files.status === 'rejected') {
        console.log('❌ Files API Error for PR', prId, ':', files.reason);
      }
      if (reviews.status === 'rejected') {
        console.log('❌ Reviews API Error for PR', prId, ':', reviews.reason);
      }

      const details = prDetails.status === 'fulfilled' ? prDetails.value.data : null;
      const iterationsData = files.status === 'fulfilled' ? files.value.data : null;
      const threadsData = reviews.status === 'fulfilled' ? reviews.value.data : null;

      // Log dos resultados das chamadas
      logger.info('PR detailed data results', { 
        prId,
        prDetailsStatus: prDetails.status,
        filesStatus: files.status,
        reviewsStatus: reviews.status,
        iterationsDataLength: iterationsData?.value?.length || 0,
        threadsDataLength: threadsData?.value?.length || 0
      });
      
      // Log adicional para debug
      console.log('🔍 PR Detailed Data Debug:', {
        prId,
        prDetailsStatus: prDetails.status,
        filesStatus: files.status,
        reviewsStatus: reviews.status,
        iterationsDataLength: iterationsData?.value?.length || 0,
        threadsDataLength: threadsData?.value?.length || 0
      });

      // Calcular métricas
      const cycleTimeDays = this.calculateCycleTime(pr, details);
      
      // Para files changed, precisamos buscar os dados da última iteração
      let filesChanged = 0;
      let linesAdded = 0;
      let linesDeleted = 0;
      
      // Sempre tentar buscar dados dos commits do PR, independente das iterations
      try {
        const commitsUrl = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/pullRequests/${prId}/commits`;
        const commitsResponse = await this.makeRequest('GET', commitsUrl, { params: { 'api-version': '7.1' } });
        
        if (commitsResponse.data?.value?.length > 0) {
          logger.info('Processing PR commits for file stats', { prId, commitsCount: commitsResponse.data.value.length });
          
          // Processar todos os commits do PR
          for (const commit of commitsResponse.data.value) {
            if (commit.changeCounts) {
              linesAdded += commit.changeCounts.Add || 0;
              linesDeleted += commit.changeCounts.Delete || 0;
            }
            
            // Buscar changes de cada commit para contar arquivos
            try {
              const changesUrl = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/commits/${commit.commitId}/changes`;
              const changesResponse = await this.makeRequest('GET', changesUrl, { params: { 'api-version': '7.1' } });
              
              if (changesResponse.data?.changes?.length > 0) {
                filesChanged += changesResponse.data.changes.length;
                logger.info('Commit changes processed', { 
                  commitId: commit.commitId.substring(0, 8), 
                  changesCount: changesResponse.data.changes.length 
                });
              }
            } catch (changesError) {
              logger.warn('Failed to get changes for commit', { 
                commitId: commit.commitId, 
                error: changesError instanceof Error ? changesError.message : String(changesError) 
              });
            }
          }
          
          logger.info('PR file stats calculated', { prId, filesChanged, linesAdded, linesDeleted });
        } else {
          logger.warn('No commits found for PR', { prId });
        }
      } catch (error) {
        logger.warn('Failed to get commit details for PR', { prId, error: error instanceof Error ? error.message : String(error) });
        
        // Fallback: tentar usar dados das iterations se disponível
        if (iterationsData?.value?.length > 0) {
          const latestIteration = iterationsData.value[iterationsData.value.length - 1];
          if (latestIteration?.changeEntries?.length > 0) {
            filesChanged = latestIteration.changeEntries.length;
            linesAdded = latestIteration.changeEntries.reduce((sum: number, entry: any) => {
              return sum + (entry.item?.gitObjectType === 'blob' ? 10 : 0); // Estimativa básica
            }, 0);
            logger.info('Using iteration fallback for file stats', { prId, filesChanged, linesAdded });
          }
        }
      }

      return {
        mergedAt: details?.completionOptions?.mergeCommitMessage ? pr.closedDate : null,
        cycleTimeDays,
        leadTimeDays: cycleTimeDays, // Para simplificar, usar cycle time como lead time
        reviewTimeDays: null, // TODO: Calcular baseado nas reviews
        filesChanged,
        linesAdded,
        linesDeleted
      };

    } catch (error) {
      logger.error('Failed to get PR details:', { 
        prId: pr.pullRequestId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        mergedAt: null,
        cycleTimeDays: null,
        leadTimeDays: null,
        reviewTimeDays: null,
        filesChanged: null,
        linesAdded: null,
        linesDeleted: null
      };
    }
  }

  private calculateCycleTime(pr: any, _details: any): number | null {
    try {
      if (pr.status !== 'completed' || !pr.closedDate) {
        return null;
      }

      const createdDate = new Date(pr.creationDate);
      const closedDate = new Date(pr.closedDate);
      const diffTime = Math.abs(closedDate.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      return null;
    }
  }

  private async processPullRequests(repositoryId: string, pullRequests: any[]): Promise<number> {
    if (pullRequests.length === 0) {
      return 0;
    }

    try {
      const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
      const backendApiKey = process.env['BACKEND_API_KEY'];
      
      if (!backendApiKey) {
        throw new Error('BACKEND_API_KEY not configured');
      }

      // Processar PRs em lotes para obter dados detalhados
      const mappedPullRequests = [];
      const batchSize = 10; // Processar 10 PRs por vez para evitar rate limiting
      
      for (let i = 0; i < pullRequests.length; i += batchSize) {
        const batch = pullRequests.slice(i, i + batchSize);
        
        // Processar cada PR do lote para obter dados detalhados
        const batchPromises = batch.map(async (pr: any) => {
          try {
            // Buscar dados detalhados do PR
            const detailedData = await this.getPullRequestDetails(pr, repositoryId);
            
            return {
              azureId: parseInt(pr.pullRequestId),
              title: pr.title || 'Untitled',
              description: pr.description || '',
              status: pr.status || 'unknown',
              sourceBranch: pr.sourceRefName || 'unknown',
              targetBranch: pr.targetRefName || 'unknown',
              createdAt: pr.creationDate,
              updatedAt: pr.creationDate,
              closedAt: pr.closedDate,
              mergedAt: detailedData.mergedAt,
              cycleTimeDays: detailedData.cycleTimeDays,
              leadTimeDays: detailedData.leadTimeDays,
              reviewTimeDays: detailedData.reviewTimeDays,
              filesChanged: detailedData.filesChanged,
              linesAdded: detailedData.linesAdded,
              linesDeleted: detailedData.linesDeleted,
              isDraft: pr.isDraft || false,
              repositoryId: repositoryId,
              createdById: pr.createdBy ? {
                displayName: pr.createdBy.displayName || pr.createdBy.name || 'Unknown',
                uniqueName: pr.createdBy.uniqueName || pr.createdBy.email || pr.createdBy.id || 'unknown'
              } : 'unknown'
            };
          } catch (error) {
            logger.error('Failed to get detailed data for PR:', { 
              prId: pr.pullRequestId, 
              error: error instanceof Error ? error.message : String(error) 
            });
            
            // Retornar dados básicos em caso de erro
            return {
              azureId: parseInt(pr.pullRequestId),
              title: pr.title || 'Untitled',
              description: pr.description || '',
              status: pr.status || 'unknown',
              sourceBranch: pr.sourceRefName || 'unknown',
              targetBranch: pr.targetRefName || 'unknown',
              createdAt: pr.creationDate,
              updatedAt: pr.creationDate,
              closedAt: pr.closedDate,
              mergedAt: null,
              cycleTimeDays: null,
              leadTimeDays: null,
              reviewTimeDays: null,
              filesChanged: null,
              linesAdded: null,
              linesDeleted: null,
              isDraft: pr.isDraft || false,
              repositoryId: repositoryId,
              createdById: pr.createdBy ? {
                displayName: pr.createdBy.displayName || pr.createdBy.name || 'Unknown',
                uniqueName: pr.createdBy.uniqueName || pr.createdBy.email || pr.createdBy.id || 'unknown'
              } : 'unknown'
            };
          }
        });
        
        // Aguardar o processamento do lote
        const batchResults = await Promise.all(batchPromises);
        mappedPullRequests.push(...batchResults);
        
        // Pequena pausa entre lotes para evitar rate limiting
        if (i + batchSize < pullRequests.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const response = await axios.post(`${backendUrl}/api/sync-data/pull-requests`, {
        repositoryId,
        pullRequests: mappedPullRequests
      }, {
        headers: {
          'X-API-Key': backendApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.success) {
        logger.info('Pull requests sent to backend successfully', {
          repositoryId,
          total: pullRequests.length,
          processed: response.data.data.processed
        });
        
        // Processar reviews e comments dos PRs
        // Processar reviews e comments após enviar PRs
        // Primeiro, obter o mapeamento de azureId para databaseId dos PRs enviados
        const prIdMapping = await this.getPullRequestIdMapping(repositoryId, mappedPullRequests);
        await this.processReviewsAndComments(repositoryId, mappedPullRequests, prIdMapping);
        
        return response.data.data.processed;
      } else {
        throw new Error('Backend returned unsuccessful response');
      }
    } catch (error) {
      logger.error('Failed to send pull requests to backend:', error);
      return 0;
    }
  }

  private async processCommits(repositoryId: string, commits: any[]): Promise<number> {
    if (commits.length === 0) {
      return 0;
    }

    try {
      const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
      const backendApiKey = process.env['BACKEND_API_KEY'];
      
      if (!backendApiKey) {
        throw new Error('BACKEND_API_KEY not configured');
      }

      // Mapear dados do Azure DevOps para o formato esperado pelo backend
      const mappedCommits = commits.map((commit: any) => ({
        azureId: commit.commitId,
        message: commit.comment || 'No message',
        hash: commit.commitId, // Using commitId as hash
        createdAt: commit.author?.date || commit.committer?.date || new Date().toISOString(),
        repositoryId: repositoryId,
        authorId: commit.author ? {
          displayName: commit.author.name || 'Unknown',
          uniqueName: commit.author.email || commit.author.name || 'unknown'
        } : 'unknown'
      }));

      const response = await axios.post(`${backendUrl}/api/sync-data/commits`, {
        repositoryId,
        commits: mappedCommits
      }, {
        headers: {
          'X-API-Key': backendApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.success) {
        logger.info('Commits sent to backend successfully', {
          repositoryId,
          total: commits.length,
          processed: response.data.data.processed
        });
        return response.data.data.processed;
      } else {
        throw new Error('Backend returned unsuccessful response');
      }
    } catch (error) {
      logger.error('Failed to send commits to backend:', error);
      return 0;
    }
  }

  private async processWorkItems(_repositoryId: string, workItems: any[]): Promise<number> {
    let processed = 0;

    for (const workItem of workItems) {
      try {
        // For now, just log the work item data since we're not storing in sync-service
        logger.info(`Processing work item: ${workItem.id} - ${workItem.fields['System.Title']}`);
        
        // In a real implementation, this would store the data in the backend database
        // For now, we'll just count the records processed
        processed++;
      } catch (error) {
        logger.error('Failed to process work item:', { workItemId: workItem.id, error });
      }
    }

    return processed;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verifica se a branch target é válida (master ou maintenance)
   * @param targetRefName - Nome da branch target (ex: refs/heads/master, refs/heads/maintenance/1.2.3)
   * @returns true se for master ou maintenance
   */
  private isValidTargetBranch(targetRefName: string): boolean {
    if (!targetRefName) {
      return false;
    }

    // Remover o prefixo refs/heads/ para facilitar a análise
    const branchName = targetRefName.replace('refs/heads/', '');
    
    // Aceitar master
    if (branchName === 'master') {
      return true;
    }
    
    // 🎯 CORREÇÃO: Aceitar branches que começam com maintenance/ (case insensitive)
    const lowerBranchName = branchName.toLowerCase();
    if (lowerBranchName.startsWith('maintenance/')) {
      return true;
    }
    
    return false;
  }

  private async getPullRequestIdMapping(repositoryId: string, pullRequests: any[]): Promise<Map<number, string>> {
    const mapping = new Map<number, string>();
    
    try {
      const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
      const backendApiKey = process.env['BACKEND_API_KEY'];
      
      if (!backendApiKey) {
        throw new Error('BACKEND_API_KEY not configured');
      }

      // Buscar todos os PRs do repositório para criar o mapeamento
      const azureIds = pullRequests.map(pr => pr.azureId);
      
      const response = await axios.post(`${backendUrl}/api/sync-data/pull-requests/ids`, {
        repositoryId,
        azureIds
      }, {
        headers: {
          'X-API-Key': backendApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data?.success && response.data?.data) {
        response.data.data.forEach((pr: any) => {
          mapping.set(pr.azureId, pr.id);
        });
      }
      
      logger.info('PR ID mapping created', { 
        repositoryId, 
        mappingSize: mapping.size 
      });

    } catch (error) {
      logger.error('Failed to get PR ID mapping:', error);
    }

    return mapping;
  }

  private async processReviewsAndComments(repositoryId: string, pullRequests: any[], prIdMapping: Map<number, string>): Promise<void> {
    try {
      const repository = await this.getRepository(repositoryId);
      if (!repository) {
        throw new Error('Repository not found');
      }

      const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
      const backendApiKey = process.env['BACKEND_API_KEY'];
      
      if (!backendApiKey) {
        throw new Error('BACKEND_API_KEY not configured');
      }

      logger.info('Processing reviews and comments', { 
        repositoryId, 
        pullRequestsCount: pullRequests.length 
      });

      const allReviews: any[] = [];
      const allComments: any[] = [];

      // Processar threads (reviews/comments) de cada PR
      for (const pr of pullRequests) {
        try {
          const prId = pr.azureId;
          
          // Buscar o ID do PR no mapeamento
          const dbPRId = prIdMapping.get(prId);
          
          if (!dbPRId) {
            logger.warn('PR not found in ID mapping, skipping threads processing', { prId });
            continue;
          }
          
          const threadsUrl = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/pullRequests/${prId}/threads`;
          const threadsResponse = await this.makeRequest('GET', threadsUrl, { params: { 'api-version': '7.1' } });

          if (threadsResponse.data?.value?.length > 0) {
            logger.info('Processing threads for PR', { 
              prId, 
              threadsCount: threadsResponse.data.value.length,
              sampleThread: threadsResponse.data.value[0] ? {
                id: threadsResponse.data.value[0].id,
                status: threadsResponse.data.value[0].status,
                commentsCount: threadsResponse.data.value[0].comments?.length || 0
              } : null
            });

            for (const thread of threadsResponse.data.value) {
              // Processar comments da thread
              if (thread.comments?.length > 0) {
                for (const comment of thread.comments) {
                  // 🎯 LOGGING DETALHADO: Ver todos os comments, mesmo os filtrados
                  logger.info('Analyzing comment from thread', {
                    threadId: thread.id,
                    commentId: comment.id,
                    hasId: !!comment.id,
                    hasContent: !!comment.content,
                    contentLength: comment.content?.length || 0,
                    author: comment.author?.displayName,
                    commentType: comment.commentType,
                    isDeleted: comment.isDeleted
                  });
                  
                  if (comment.id && comment.content) {
                    logger.info('Creating comment from thread', {
                      threadId: thread.id,
                      commentId: comment.id,
                      author: comment.author?.displayName,
                      contentPreview: comment.content?.substring(0, 50)
                    });
                    
                    allComments.push({
                      azureId: comment.id,
                      content: comment.content,
                      pullRequestId: dbPRId, // ID do PR real no nosso banco
                      authorId: comment.author ? {
                        displayName: comment.author.displayName || comment.author.name || 'Unknown',
                        uniqueName: comment.author.uniqueName || comment.author.email || 'unknown'
                      } : 'unknown',
                      createdAt: comment.publishedDate || comment.lastUpdatedDate || new Date().toISOString(),
                      updatedAt: comment.lastUpdatedDate || comment.publishedDate || new Date().toISOString()
                    });
                  }
                }
              }

              // 🎯 LÓGICA MELHORADA: Processar como review se tem status OU se é um thread com vote
              const shouldCreateReview = (
                (thread.status && thread.status !== 'unknown') || // Thread com status
                (thread.comments?.length > 0 && thread.comments.some((c: any) => c.commentType === 'system' && c.content?.includes('voted'))) // Thread com voto
              );
              
              if (shouldCreateReview && thread.comments?.length > 0) {
                const firstComment = thread.comments[0];
                if (firstComment.author) {
                  logger.info('Creating review from thread', {
                    threadId: thread.id,
                    status: thread.status,
                    vote: this.mapThreadStatusToVote(thread.status),
                    author: firstComment.author.displayName
                  });
                  
                  allReviews.push({
                    azureId: thread.id,
                    status: thread.status || 'active',
                    vote: this.mapThreadStatusToVote(thread.status),
                    pullRequestId: dbPRId, // ID do PR real no nosso banco
                    reviewerId: {
                      displayName: firstComment.author.displayName || firstComment.author.name || 'Unknown',
                      uniqueName: firstComment.author.uniqueName || firstComment.author.email || 'unknown'
                    },
                    createdAt: firstComment.publishedDate || new Date().toISOString(),
                    updatedAt: firstComment.lastUpdatedDate || firstComment.publishedDate || new Date().toISOString()
                  });
                }
              }
            }
          }
        } catch (error) {
          logger.warn('Failed to process threads for PR', { 
            prId: pr.azureId, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      // Enviar reviews para o backend
      if (allReviews.length > 0) {
        try {
          const reviewsResponse = await axios.post(`${backendUrl}/api/sync-data/reviews`, {
            repositoryId,
            reviews: allReviews
          }, {
            headers: {
              'X-API-Key': backendApiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          if (reviewsResponse.data?.success) {
            logger.info('Reviews sent to backend successfully', {
              repositoryId,
              total: allReviews.length,
              processed: reviewsResponse.data.data.processed
            });
          }
        } catch (error) {
          logger.error('Failed to send reviews to backend:', error);
        }
      }

      // Enviar comments para o backend
      if (allComments.length > 0) {
        try {
          const commentsResponse = await axios.post(`${backendUrl}/api/sync-data/comments`, {
            repositoryId,
            comments: allComments
          }, {
            headers: {
              'X-API-Key': backendApiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          if (commentsResponse.data?.success) {
            logger.info('Comments sent to backend successfully', {
              repositoryId,
              total: allComments.length,
              processed: commentsResponse.data.data.processed
            });
          }
        } catch (error) {
          logger.error('Failed to send comments to backend:', error);
        }
      }

      logger.info('Reviews and comments processing completed', {
        repositoryId,
        reviewsCount: allReviews.length,
        commentsCount: allComments.length,
        reviewsSample: allReviews.slice(0, 3).map(r => ({ azureId: r.azureId, status: r.status })),
        commentsSample: allComments.slice(0, 3).map(c => ({ azureId: c.azureId, author: c.authorId?.displayName }))
      });

    } catch (error) {
      logger.error('Failed to process reviews and comments:', error);
    }
  }

  private mapThreadStatusToVote(status: string): number {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 10; // Approved
      case 'rejected':
        return -10; // Rejected
      case 'waiting for author':
        return -5; // Waiting for author
      case 'no vote':
        return 0; // No vote
      default:
        return 0;
    }
  }
}
