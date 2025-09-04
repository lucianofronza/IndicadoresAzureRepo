import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PaginatedSelect } from '@/components/PaginatedSelect'
import { DateRangePicker } from '@/components/DateRangePicker'
import ReactApexChart from 'react-apexcharts'
import { 
  GitPullRequest, 
  MessageSquare, 
  Users,
  Filter,
  TrendingUp,
  AlertCircle,
  GitCommit,
  MessageCircle,
  Building2,
  UserCheck,
  Layers
} from 'lucide-react'
import { DashboardFilters, KPI } from '@/types'
import { formatNumber } from '@/lib/utils'
import api from '@/services/api'

// Função para calcular datas padrão de forma mais robusta
const getDefaultDateRange = () => {
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)
  
  return {
    startDate: thirtyDaysAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  }
}

export const Dashboard: React.FC = () => {
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultDateRange())



  const { data: kpis, isLoading, error } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis?${params.toString()}`)
      return response.data.data as KPI
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  // Additional KPI queries
  const { data: prReviewComments } = useQuery({
    queryKey: ['kpis-pr-review-comments', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis/pr-review-comments?${params.toString()}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  const { data: prCommitData } = useQuery({
    queryKey: ['kpis-pr-commit', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis/pr-commit?${params.toString()}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  const { data: prReviewTeamData } = useQuery({
    queryKey: ['kpis-pr-review-team', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis/pr-review-team?${params.toString()}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  const { data: reviewsPerformedData } = useQuery({
    queryKey: ['kpis-reviews-performed-team', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis/reviews-performed-team?${params.toString()}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  const { data: filesChangedData } = useQuery({
    queryKey: ['kpis-files-changed-team', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis/files-changed-team?${params.toString()}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  const { data: cycleTimeByTeamData } = useQuery({
    queryKey: ['kpis-cycle-time-team', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis/cycle-time-team?${params.toString()}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  const { data: topCycleTimePRs } = useQuery({
    queryKey: ['kpis-top-cycle-time-prs', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await api.get(`/kpis/top-cycle-time-prs?${params.toString()}`)
      return response.data.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000
  })

  // Verificar se há algum erro em qualquer uma das queries
  const hasError = error || 
    prReviewComments?.error || 
    prCommitData?.error || 
    prReviewTeamData?.error || 
    reviewsPerformedData?.error || 
    filesChangedData?.error || 
    cycleTimeByTeamData?.error || 
    topCycleTimePRs?.error



  // Verificar se todos os dados necessários estão carregados
  const isDataReady = kpis && 
    (prReviewComments !== undefined) && 
    (prCommitData !== undefined) && 
    (prReviewTeamData !== undefined) && 
    (reviewsPerformedData !== undefined) && 
    (filesChangedData !== undefined) && 
    (cycleTimeByTeamData !== undefined) && 
    (topCycleTimePRs !== undefined)

  // Fallback para dados vazios com verificações de segurança
  const safeKpis = kpis ? {
    totalPullRequests: kpis.totalPullRequests || 0,
    totalReviews: kpis.totalReviews || 0,
    totalComments: kpis.totalComments || 0,
    totalCommits: kpis.totalCommits || 0,
    totalTeams: kpis.totalTeams || 0,
    totalRoles: kpis.totalRoles || 0,
    totalDevelopers: kpis.totalDevelopers || 0,
    totalStacks: kpis.totalStacks || 0,
    averageCycleTime: kpis.averageCycleTime || 0,
    averageReviewTime: kpis.averageReviewTime || 0,
    topDevelopers: Array.isArray(kpis.topDevelopers) ? kpis.topDevelopers : [],
    pullRequestsByStatus: Array.isArray(kpis.pullRequestsByStatus) ? kpis.pullRequestsByStatus : [],
    pullRequestsByTeam: Array.isArray(kpis.pullRequestsByTeam) ? kpis.pullRequestsByTeam : [],
    rolesByTeam: Array.isArray(kpis.rolesByTeam) ? kpis.rolesByTeam : []
  } : {
    totalPullRequests: 0,
    totalReviews: 0,
    totalComments: 0,
    totalCommits: 0,
    totalTeams: 0,
    totalRoles: 0,
    totalDevelopers: 0,
    totalStacks: 0,
    averageCycleTime: 0,
    averageReviewTime: 0,
    topDevelopers: [],
    pullRequestsByStatus: [],
    pullRequestsByTeam: [],
    rolesByTeam: []
  }

  if (isLoading || !isDataReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-500 mb-4">Não foi possível carregar os dados do dashboard.</p>
          <div className="text-sm text-gray-400">
            <p>Verifique se o backend está rodando na porta 8080</p>
            <p>Filtros aplicados: {filters.startDate} até {filters.endDate}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Análise de indicadores de desenvolvedores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500">
            Última atualização: {new Date().toLocaleString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período
            </label>
            <DateRangePicker
              startDate={filters.startDate || ''}
              endDate={filters.endDate || ''}
              onDateChange={(startDate, endDate) => 
                setFilters(prev => ({ ...prev, startDate, endDate }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <PaginatedSelect
              value={filters.teamId || ''}
              onChange={(value) => setFilters(prev => ({ ...prev, teamId: value }))}
              placeholder="Todos os times"
              endpoint="/teams"
              labelKey="name"
              valueKey="id"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cargo
            </label>
            <PaginatedSelect
              value={filters.roleId || ''}
              onChange={(value) => setFilters(prev => ({ ...prev, roleId: value }))}
              placeholder="Todos os cargos"
              endpoint="/roles"
              labelKey="name"
              valueKey="id"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stack
            </label>
            <PaginatedSelect
              value={filters.stackId || ''}
              onChange={(value) => setFilters(prev => ({ ...prev, stackId: value }))}
              placeholder="Todas as stacks"
              endpoint="/stacks"
              labelKey="name"
              valueKey="id"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desenvolvedor
            </label>
            <PaginatedSelect
              value={filters.developerId || ''}
              onChange={(value) => setFilters(prev => ({ ...prev, developerId: value }))}
              placeholder="Todos os desenvolvedores"
              endpoint="/developers"
              labelKey="name"
              valueKey="id"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <GitPullRequest className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Pull Requests</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalPullRequests)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Reviews</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalReviews)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <GitCommit className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Commits</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalCommits)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MessageCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Comments</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalComments)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Building2 className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Times</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalTeams)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserCheck className="h-6 w-6 text-teal-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Cargos</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalRoles)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-6 w-6 text-pink-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Devs</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalDevelopers)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Layers className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Stacks</p>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(safeKpis.totalStacks)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pull Request x Review x Comments */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pull Request x Review x Comments</h3>
        {Array.isArray(prReviewComments) && prReviewComments.length > 0 ? (
          <div style={{ height: '400px' }}>
            <ReactApexChart
              options={{
                chart: { 
                  type: 'line',
                  toolbar: { show: false },
                  zoom: { enabled: false }
                },
                plotOptions: {
                  bar: {
                    horizontal: false,
                    columnWidth: '55%',
                  },
                },
                stroke: {
                  width: [0, 3, 3],
                  curve: 'smooth'
                },
                dataLabels: {
                  enabled: false
                },
                xaxis: {
                  categories: prReviewComments.map((item: any) => item?.developer?.name || 'Desenvolvedor Desconhecido'),
                  labels: {
                    style: { fontSize: '12px' },
                    rotate: -45,
                    rotateAlways: true,
                    hideOverlappingLabels: true,
                    showDuplicates: false,
                    maxHeight: 60,
                    trim: true
                  }
                },
                yaxis: {
                  title: {
                    text: 'Quantidade'
                  }
                },
                tooltip: {
                  y: {
                    formatter: function (val) {
                      return `${val}`;
                    }
                  }
                },
                legend: { 
                  position: 'top',
                  horizontalAlign: 'center'
                },
                colors: ['#10B981', '#F59E0B', '#3B82F6']
              }}
              series={[
                {
                  name: 'Reviews',
                  type: 'column',
                  data: prReviewComments.map((item: any) => item?.reviews || 0)
                },
                {
                  name: 'Pull Requests',
                  type: 'line',
                  data: prReviewComments.map((item: any) => item?.pullRequests || 0)
                },
                {
                  name: 'Comments',
                  type: 'line',
                  data: prReviewComments.map((item: any) => item?.comments || 0)
                }
              ]}
              type="line"
              height={400}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>Nenhum dado disponível para este gráfico</p>
          </div>
        )}
      </div>

      {/* Pull Request x Commit por Time e Pull Request x Review por Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pull Request x Commit por Time */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pull Request x Commit por Time</h3>
          {Array.isArray(prCommitData) && prCommitData.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ReactApexChart
                options={{
                  chart: { type: 'bar', toolbar: { show: false }, stacked: true },
                  plotOptions: { 
                    bar: { 
                      horizontal: true, 
                      dataLabels: { position: 'center' }
                    } 
                  },
                  dataLabels: { 
                    enabled: true,
                    style: {
                      colors: ['#FFFFFF'],
                      fontSize: '12px',
                      fontWeight: 'bold'
                    },
                    background: {
                      enabled: false
                    },
                    formatter: function (_val, opts) {
                      const originalData = prCommitData[opts.dataPointIndex];
                      const originalValue = opts.seriesIndex === 0 ? originalData?.pullRequests : originalData?.commits;
                      return originalValue || 0;
                    }
                  },
                  xaxis: { 
                    categories: prCommitData.map((item: any) => item?.team?.name || 'Sem time informado'),
                    labels: { style: { fontSize: '12px' } },
                    max: 100
                  },
                  yaxis: { 
                    labels: { 
                      formatter: function (val) {
                        const teamNames = prCommitData.map((item: any) => item?.team?.name || 'Time Desconhecido');
                        return teamNames[val as number] || val.toString();
                      }
                    }
                  },
                  tooltip: { 
                    y: { 
                      formatter: function (val, opts) { 
                        const originalData = prCommitData[opts.dataPointIndex];
                        const originalValue = opts.seriesIndex === 0 ? originalData?.pullRequests : originalData?.commits;
                        return `${originalValue || 0} (${(val as number).toFixed(1)}%)`;
                      } 
                    } 
                  },
                  legend: { position: 'top', horizontalAlign: 'left', offsetX: 40 },
                  colors: ['#3B82F6', '#10B981'],
                  fill: { opacity: 1 },
                  states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } }
                }}
                series={[
                  { 
                    name: 'Pull Requests', 
                    data: prCommitData.map((item: any) => {
                      const total = (item?.pullRequests || 0) + (item?.commits || 0);
                      return total > 0 ? ((item?.pullRequests || 0) / total) * 100 : 0;
                    })
                  },
                  { 
                    name: 'Commits', 
                    data: prCommitData.map((item: any) => {
                      const total = (item?.pullRequests || 0) + (item?.commits || 0);
                      return total > 0 ? ((item?.commits || 0) / total) * 100 : 0;
                    })
                  }
                ]}
                type="bar"
                height={300}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Nenhum dado disponível para este gráfico</p>
            </div>
          )}
        </div>

        {/* Pull Request x Review por Time */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pull Request x Review por Time</h3>
          {Array.isArray(prReviewTeamData) && prReviewTeamData.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ReactApexChart
                options={{
                  chart: { type: 'bar', toolbar: { show: false }, stacked: true },
                  plotOptions: { 
                    bar: { 
                      horizontal: true, 
                      dataLabels: { position: 'center' }
                    } 
                  },
                  dataLabels: { 
                    enabled: true,
                    style: {
                      colors: ['#FFFFFF'],
                      fontSize: '12px',
                      fontWeight: 'bold'
                    },
                    background: {
                      enabled: false
                    },
                    formatter: function (_val, opts) {
                      const originalData = prReviewTeamData[opts.dataPointIndex];
                      const originalValue = opts.seriesIndex === 0 ? originalData?.pullRequests : originalData?.reviews;
                      return originalValue || 0;
                    }
                  },
                  xaxis: { 
                    categories: prReviewTeamData.map((item: any) => item?.team?.name || 'Sem time informado'),
                    labels: { style: { fontSize: '12px' } },
                    max: 100
                  },
                  yaxis: { 
                    labels: { 
                      formatter: function (val) {
                        const teamNames = prReviewTeamData.map((item: any) => item?.team?.name || 'Time Desconhecido');
                        return teamNames[val as number] || val.toString();
                      }
                    }
                  },
                  tooltip: { 
                    y: { 
                      formatter: function (val, opts) { 
                        const originalData = prReviewTeamData[opts.dataPointIndex];
                        const originalValue = opts.seriesIndex === 0 ? originalData?.pullRequests : originalData?.reviews;
                        return `${originalValue || 0} (${(val as number).toFixed(1)}%)`;
                      } 
                    } 
                  },
                  legend: { position: 'top', horizontalAlign: 'left', offsetX: 40 },
                  colors: ['#3B82F6', '#10B981'],
                  fill: { opacity: 1 },
                  states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } }
                }}
                series={[
                  { 
                    name: 'Pull Requests', 
                    data: prReviewTeamData.map((item: any) => {
                      const total = (item?.pullRequests || 0) + (item?.reviews || 0);
                      return total > 0 ? ((item?.pullRequests || 0) / total) * 100 : 0;
                    })
                  },
                  { 
                    name: 'Reviews', 
                    data: prReviewTeamData.map((item: any) => {
                      const total = (item?.pullRequests || 0) + (item?.reviews || 0);
                      return total > 0 ? ((item?.reviews || 0) / total) * 100 : 0;
                    })
                  }
                ]}
                type="bar"
                height={300}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Nenhum dado disponível para este gráfico</p>
            </div>
          )}
        </div>
      </div>

      {/* Média Cycle time Pull Request (dias) e Arquivos alterados por Pull Request */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Média Cycle time Pull Request (dias) */}
        <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Média Cycle time Pull Request (dias)</h3>
            {Array.isArray(cycleTimeByTeamData) && cycleTimeByTeamData.length > 0 ? (
              <div style={{ height: '300px' }}>
                <ReactApexChart
                  options={{
                    chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
                    plotOptions: { 
                      bar: { 
                        horizontal: false, 
                        dataLabels: { position: 'top' }
                      } 
                    },
                    dataLabels: {
                      enabled: true,
                      style: {
                        colors: ['#FFFFFF'],
                        fontSize: '12px',
                        fontWeight: 'bold'
                      },
                      background: {
                        enabled: false
                      },
                      formatter: function (val, opts) {
                        // Only show labels for column series (index 0 and 1)
                        if (opts.seriesIndex <= 1) {
                          return (val as number).toFixed(1);
                        }
                        return '';
                      }
                    },
                    xaxis: { 
                      categories: cycleTimeByTeamData.map((item: any) => item?.team?.name || 'Sem time informado'),
                      labels: { 
                        style: { fontSize: '12px' },
                        rotate: -45,
                        rotateAlways: true,
                        hideOverlappingLabels: true,
                        showDuplicates: false,
                        maxHeight: 60,
                        trim: true
                      }                      
                    },
                    yaxis: [
                      {
                        title: { text: 'Dias' },
                        labels: { formatter: function (val) { return (val as number).toFixed(0) } },
                        min: 0,
                        max: function() {
                          const cycleTimeData = cycleTimeByTeamData.map((item: any) => item?.averageCycleTime || 0);
                          const reviewTimeData = cycleTimeByTeamData.map((item: any) => item?.averageReviewTime || 0);
                          const maxTime = Math.max(...cycleTimeData, ...reviewTimeData);
                          // Usar uma escala mais equilibrada para evitar colunas muito pequenas
                          return maxTime * 1.2; // 20% acima do máximo
                        },
                        seriesName: ['Tempo 1ª Review', 'Cycle Time']
                      },
                      {
                        opposite: true,
                        title: { text: 'Quantidade de PRs' },
                        labels: { formatter: function (val) { return (val as number).toFixed(0) } },
                        min: 0,
                        max: function() {
                          const prData = cycleTimeByTeamData.map((item: any) => item?.pullRequests || 0);
                          const maxPRs = Math.max(...prData);
                          return maxPRs * 1.5; // 50% acima do máximo
                        },
                        seriesName: 'Quantidade PRs'
                      }
                    ],
                    tooltip: { 
                      shared: true,
                      y: [
                        {
                          formatter: function (val, opts) { 
                            if (opts.seriesIndex === 0) {
                              return `${(val as number).toFixed(0)}`;
                            } else if (opts.seriesIndex === 1) {
                              return `${(val as number).toFixed(0)}`;
                            } else {
                              return `${(val as number).toFixed(0)}`;
                            }
                          }
                        },
                        {
                          formatter: function (val, opts) { 
                            if (opts.seriesIndex === 0) {
                              return `${(val as number).toFixed(0)}`;
                            } else if (opts.seriesIndex === 1) {
                              return `${(val as number).toFixed(0)}`;
                            } else {
                              return `${(val as number).toFixed(0)}`;
                            }
                          }
                        }
                      ]
                    },
                    legend: { 
                      position: 'top', 
                      horizontalAlign: 'left', 
                      offsetX: 40,
                      showForSingleSeries: false,
                      showForNullSeries: false,
                      showForZeroSeries: false
                    },
                    colors: ['#3B82F6', '#10B981', '#F59E0B'],
                    fill: { opacity: 1 },
                    stroke: { width: [0, 0, 3], curve: 'smooth' },
                    noData: {
                      text: 'Nenhum dado disponível'
                    }
                  }}
                  series={[
                    { 
                      name: 'Tempo 1ª Review', 
                      type: 'column',
                      data: cycleTimeByTeamData.map((item: any) => item?.averageReviewTime || 0)
                    },
                    { 
                      name: 'Cycle Time', 
                      type: 'column',
                      data: cycleTimeByTeamData.map((item: any) => item?.averageCycleTime || 0)
                    },
                    { 
                      name: 'Quantidade PRs', 
                      type: 'line',
                      data: cycleTimeByTeamData.map((item: any) => item?.pullRequests || 0)
                    }
                  ]}
                  type="line"
                  height={300}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <p>Nenhum dado disponível para este gráfico</p>
              </div>
            )}
          </div>

        {/* Arquivos alterados por Pull Request */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Arquivos alterados por Pull Request</h3>
          {Array.isArray(filesChangedData) && filesChangedData.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ReactApexChart
                options={{
                  chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
                  plotOptions: { 
                    bar: { 
                      horizontal: false, 
                      dataLabels: { position: 'top' }
                    } 
                  },
                  dataLabels: {
                    enabled: true,
                    style: {
                      colors: ['#FFFFFF'],
                      fontSize: '12px',
                      fontWeight: 'bold'
                    },
                    background: {
                      enabled: false
                    },
                    formatter: function (val, opts) {
                      // Only show labels for column series (index 0 and 1)
                      if (opts.seriesIndex <= 1) {
                        return (val as number).toFixed(0);
                      }
                      return '';
                    }
                  },
                  xaxis: { 
                    categories: filesChangedData.map((item: any) => item?.team?.name || 'Sem time informado'),
                    labels: { 
                      style: { fontSize: '12px' },
                      rotate: -45,
                      rotateAlways: true,
                      hideOverlappingLabels: true,
                      showDuplicates: false,
                      maxHeight: 60,
                      trim: true
                    }
                  },
                  yaxis: [
                    {
                      title: { text: 'Total de arquivos e PRs' },
                      labels: { formatter: function (val) { return (val as number).toFixed(0) } },
                      min: 0,
                      max: function() {
                        const filesData = filesChangedData.map((item: any) => item?.totalFilesChanged || 0);
                        const prData = filesChangedData.map((item: any) => item?.pullRequests || 0);
                        const maxValue = Math.max(...filesData, ...prData);
                        return maxValue * 1.2; // 20% acima do máximo
                      },
                      seriesName: ['Total de arquivos alterados', 'Pull requests']
                    },
                    {
                      opposite: true,
                      title: { text: 'Média de arquivos' },
                      labels: { formatter: function (val) { return (val as number).toFixed(0) } },
                      min: 0,
                      max: function() {
                        const avgData = filesChangedData.map((item: any) => item?.averageFilesChanged || 0);
                        const maxAvg = Math.max(...avgData);
                        return maxAvg * 1.5; // 50% acima do máximo para melhor visualização
                      },
                      seriesName: 'Média de arquivos alterados'
                    }
                  ],
                  tooltip: { 
                    shared: true,
                    y: [
                      {
                        formatter: function (val, opts) { 
                          if (opts.seriesIndex === 0) {
                            return `${(val as number).toFixed(0)}`;
                          } else if (opts.seriesIndex === 1) {
                            return `${(val as number).toFixed(0)}`;
                          } else {
                            return `${(val as number).toFixed(0)}`;
                          }
                        }
                      },
                      {
                        formatter: function (val, opts) { 
                          if (opts.seriesIndex === 0) {
                            return `${(val as number).toFixed(0)}`;
                          } else if (opts.seriesIndex === 1) {
                            return `${(val as number).toFixed(0)}`;
                          } else {
                            return `${(val as number).toFixed(0)}`;
                          }
                        }
                      }
                    ]
                  },
                  legend: { 
                    position: 'top', 
                    horizontalAlign: 'left', 
                    offsetX: 40,
                    showForSingleSeries: false,
                    showForNullSeries: false,
                    showForZeroSeries: false
                  },                  
                  colors: ['#3B82F6', '#10B981', '#F59E0B'],
                  fill: { opacity: 1 },
                  stroke: { width: [0, 0, 3], curve: 'smooth' },
                  noData: {
                    text: 'Nenhum dado disponível'
                  }
                }}
                series={[
                  { 
                    name: 'Total de arquivos alterados', 
                    type: 'column',
                    data: filesChangedData.map((item: any) => item?.totalFilesChanged || 0)
                  },
                  { 
                    name: 'Pull requests', 
                    type: 'column',
                    data: filesChangedData.map((item: any) => item?.pullRequests || 0)
                  },
                  { 
                    name: 'Média de arquivos alterados', 
                    type: 'line',
                    data: filesChangedData.map((item: any) => item?.averageFilesChanged || 0)
                  }
                ]}
                type="line"
                height={300}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Nenhum dado disponível para este gráfico</p>
            </div>
          )}
        </div>
      </div>

            {/* Reviews realizados e Cargos por Time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reviews realizados */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Reviews realizados</h3>
          {Array.isArray(reviewsPerformedData) && reviewsPerformedData.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ReactApexChart
                options={{
                  chart: { type: 'bar', toolbar: { show: false } },
                  plotOptions: { bar: { horizontal: false, dataLabels: { position: 'top' } } },
                  dataLabels: {
                    enabled: true,
                    style: { colors: ['#ffffff'], fontWeight: 'bold', fontSize: '14px' },
                    background: { enabled: false },
                                          formatter: function (val: any) { return (val as number).toFixed(0) }
                  },
                  xaxis: { 
                    categories: reviewsPerformedData.map((item: any) => item?.team?.name || 'Sem time informado'), 
                    labels: { style: { fontSize: '12px' } } 
                  },
                  yaxis: { title: { text: 'Quantidade de Reviews' } },
                  tooltip: { y: { formatter: function (val) { return val.toString() } } },
                  legend: { position: 'top', horizontalAlign: 'left', offsetX: 40 },
                  colors: ['#3B82F6'],
                  fill: { opacity: 1 }
                }}
                series={[
                  { name: 'Reviews', data: reviewsPerformedData.map((item: any) => item?.count || 0) }
                ]}
                type="bar"
                height={300}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Nenhum dado disponível para este gráfico</p>
            </div>
          )}
        </div>

        {/* Cargos por Time */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cargos por Time</h3>
          {Array.isArray(safeKpis.rolesByTeam) && safeKpis.rolesByTeam.length > 0 ? (
            (() => {
              // Transformar dados para formato de colunas empilhadas
              const teams = [...new Set(safeKpis.rolesByTeam?.map((item: any) => item.team) || [])];
              const roles = [...new Set(safeKpis.rolesByTeam?.map((item: any) => item.role) || [])];
              
                             const series = roles.map(role => ({
                 name: role,
                 data: teams.map(team => {
                   const item = safeKpis.rolesByTeam?.find((r: any) => r.team === team && r.role === role);
                   return item ? item.count : 0;
                 })
               }));

              return (
                <div style={{ height: '300px' }}>
                  <ReactApexChart
                    options={{
                      chart: { 
                        type: 'bar',
                        stacked: true,
                        toolbar: { show: false }
                      },
                      plotOptions: {
                        bar: {
                          horizontal: false,
                          columnWidth: '55%',
                        },
                      },
                      dataLabels: {
                        enabled: true,
                        style: { 
                          colors: ['#ffffff'], 
                          fontWeight: 'bold', 
                          fontSize: '10px' 
                        },
                        background: { enabled: false },
                        formatter: function (val) {
                          return (val as number) > 0 ? (val as number).toString() : '';
                        }
                      },
                      xaxis: {
                        categories: teams,
                        labels: {
                          style: { fontSize: '12px' },
                          rotate: 0,
                          rotateAlways: false,
                          hideOverlappingLabels: true,
                          showDuplicates: false,
                          maxHeight: 60,
                          trim: true
                        }
                      },
                      yaxis: {
                        title: {
                          text: 'Quantidade de Desenvolvedores'
                        }
                      },
                      tooltip: {
                        y: {
                          formatter: function (val) {
                            return `${val} desenvolvedores`;
                          }
                        }
                      },
                      legend: { 
                        show: true,
                        position: 'top',
                        horizontalAlign: 'center'
                      },
                      colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280']
                    }}
                    series={series}
                    type="bar"
                    height={300}
                  />
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Nenhum dado disponível para este gráfico</p>
            </div>
          )}
        </div>
      </div>


      {/* Top 10 - Cycle time Pull Request (dias) */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Top 10 - Cycle time Pull Request (dias)</h3>
          <p className="text-sm text-gray-500 mt-1">
            Pull Requests com maior tempo de ciclo
          </p>
        </div>
        {topCycleTimePRs && topCycleTimePRs.data && Array.isArray(topCycleTimePRs.data) && topCycleTimePRs.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posição</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título do PR</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criação</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">1ª Review</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merge</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cycle Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dias em Review</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desenvolvedor</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topCycleTimePRs.data.map((pr: any) => (
                  <tr key={pr.position} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{pr.position}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pr.team}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={pr.title}>{pr.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        pr.status === 'completed' ? 'bg-green-100 text-green-800' :
                        pr.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {pr.status === 'completed' ? 'Concluído' :
                         pr.status === 'active' ? 'Ativo' : pr.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pr.createdAt ? new Date(pr.createdAt).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pr.reviewTimeDays ? `${pr.reviewTimeDays.toFixed(1)} dias` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pr.mergedAt ? new Date(pr.mergedAt).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {pr.cycleTimeDays ? `${pr.cycleTimeDays.toFixed(1)} dias` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pr.cycleTimeDays && pr.reviewTimeDays ? 
                        `${(pr.cycleTimeDays - pr.reviewTimeDays).toFixed(1)} dias` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pr.developer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>Nenhum dado disponível para esta tabela</p>
          </div>
        )}
      </div>
    </div>
  )
}
