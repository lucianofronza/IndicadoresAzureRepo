import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor para adicionar token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config;

    // Se o erro for 401 (não autorizado) e não for uma tentativa de refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Verificar se é um erro de permissão específica ou erro de autenticação geral
      const isPermissionError = error.response?.data?.error === 'INSUFFICIENT_PERMISSIONS' || 
                                error.response?.data?.error === 'ACCESS_DENIED' ||
                                error.response?.data?.message?.includes('permissão') ||
                                error.response?.data?.message?.includes('permission');
      
      // Se for erro de permissão, não tentar refresh - apenas rejeitar a promise
      if (isPermissionError) {
        console.warn('Permission denied for:', originalRequest.url);
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        console.log('🔄 Axios Interceptor: Tentando refresh com token:', refreshToken ? 'Token presente' : 'Token ausente');
        
        if (refreshToken) {
          console.log('🌐 Axios Interceptor: Fazendo requisição para /api/auth/refresh');
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          console.log('✅ Axios Interceptor: Resposta recebida:', response.data);
          
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          console.log('🔑 Axios Interceptor: Tokens extraídos - accessToken:', !!accessToken, ', newRefreshToken:', !!newRefreshToken);
          
          // CRÍTICO: Salvar AMBOS os novos tokens (accessToken E refreshToken)
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          console.log('💾 Axios Interceptor: Tokens salvos no localStorage');
          
          // Retry a requisição original
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          console.log('🔄 Axios Interceptor: Retry da requisição original');
          return api(originalRequest);
        } else {
          console.warn('⚠️ Axios Interceptor: Nenhum refreshToken encontrado, rejeitando');
        }
      } catch (refreshError: any) {
        // Se o refresh falhar, não limpar localStorage imediatamente
        // Deixar para o usePermissions fazer o retry automático
        console.error('❌ Axios Interceptor: Erro ao fazer refresh:', refreshError.message);
        console.error('❌ Axios Interceptor: Response data:', refreshError.response?.data);
        return Promise.reject(refreshError);
      }
    }

    console.error('API Error Interceptor:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    })
    
    if (error.response?.status >= 500) {
      toast.error('Erro interno do servidor. Tente novamente mais tarde.')
    } else if (error.response?.data?.error === 'VALIDATION_ERROR' && error.response?.data?.details) {
      // Mostrar detalhes específicos de validação
      const validationErrors = error.response.data.details.map((detail: any) => detail.msg).join(', ');
      console.error('Validation errors:', error.response.data.details);
      toast.error(`Erro de validação: ${validationErrors}`)
    } else if (error.response?.data?.message) {
      toast.error(error.response.data.message)
    } else {
      toast.error('Erro inesperado. Tente novamente.')
    }
    return Promise.reject(error)
  }
)

export default api
