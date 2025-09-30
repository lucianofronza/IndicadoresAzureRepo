# 🏗️ Arquitetura do Sistema - Indicadores Azure Repos

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura de Alto Nível](#arquitetura-de-alto-nível)
3. [Componentes do Sistema](#componentes-do-sistema)
4. [Fluxos de Dados](#fluxos-de-dados)
5. [Decisões Arquiteturais](#decisões-arquiteturais)
6. [Segurança](#segurança)
7. [Escalabilidade](#escalabilidade)
8. [Monitoramento](#monitoramento)

---

## 🎯 Visão Geral

O **Indicadores Azure Repos** é uma aplicação fullstack para análise de métricas de desenvolvedores baseada em dados do Azure DevOps. O sistema é projetado para ser escalável, seguro e observável.

### Objetivos Principais

- **Coletar** dados de Pull Requests, Commits, Reviews e Comments do Azure DevOps
- **Processar** e agregar métricas individuais de desenvolvedores
- **Visualizar** indicadores através de dashboards interativos
- **Controlar** acesso através de autenticação e permissões granulares

### Stack Tecnológica

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Sync Service**: Node.js + TypeScript (serviço independente)
- **Banco de Dados**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Autenticação**: JWT + Microsoft Entra ID (Azure AD)
- **ORM**: Prisma

---

## 🏗️ Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  React + TypeScript + Vite + React Query + Tailwind        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API (8080)                        │
│  Express + TypeScript + Prisma + JWT Auth                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Routes     │  │ Middlewares  │  │  Services    │     │
│  │              │  │              │  │              │     │
│  │ • Auth       │  │ • Auth       │  │ • AuthSvc    │     │
│  │ • Repos      │  │ • Perms      │  │ • RepoSvc    │     │
│  │ • Sync       │  │ • Errors     │  │ • SyncSvc    │     │
│  │ • KPIs       │  │ • Security   │  │ • KPISvc     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────┬────────────────────────────┬────────────────────┬─────┘
     │                            │                    │
     │ Prisma ORM                 │ Redis              │ HTTP
     ▼                            ▼                    ▼
┌─────────┐              ┌──────────────┐    ┌────────────────┐
│PostgreSQL│              │    Redis     │    │  SYNC SERVICE  │
│  (5432) │              │    (6379)    │    │     (8081)     │
└─────────┘              └──────────────┘    └────────┬───────┘
                                                      │
                                                      │ Azure DevOps API
                                                      ▼
                                             ┌──────────────────┐
                                             │ Azure DevOps API │
                                             │   (External)     │
                                             └──────────────────┘
```

---

## 🔧 Componentes do Sistema

### 1. Frontend (React SPA)

**Responsabilidades:**
- Interface do usuário responsiva
- Gerenciamento de estado com React Query
- Autenticação via JWT e Microsoft Entra ID
- Visualização de dashboards e gráficos

**Estrutura:**
```
frontend/
├── src/
│   ├── components/      # Componentes reutilizáveis
│   ├── pages/          # Páginas da aplicação
│   ├── contexts/       # Contexts (Auth, Theme)
│   ├── hooks/          # Custom hooks
│   ├── services/       # API clients
│   └── types/          # TypeScript types
```

**Principais Tecnologias:**
- **React Query**: Cache, sincronização e gerenciamento de estado servidor
- **Axios**: Cliente HTTP com interceptors para auth
- **Recharts**: Visualizações de dados
- **React Router**: Navegação SPA

### 2. Backend API (Express)

**Responsabilidades:**
- API RESTful para o frontend
- Autenticação e autorização (JWT + RBAC)
- CRUD de entidades (Users, Repos, Teams, etc)
- Proxy para Sync Service
- Agregação de KPIs

**Estrutura:**
```
backend/
├── src/
│   ├── routes/          # Definições de rotas
│   ├── services/        # Lógica de negócio
│   ├── middlewares/     # Auth, perms, errors, security
│   ├── types/           # TypeScript interfaces
│   ├── utils/           # Helpers (encryption, logger)
│   ├── config/          # Configurações
│   └── prisma/          # Schema e migrations
```

**Camadas:**

1. **Routes**: Definição de endpoints e validação de entrada
2. **Middlewares**: 
   - `requireAuth`: Valida JWT e extrai usuário
   - `requirePermission`: Valida permissões RBAC
   - `errorHandler`: Trata erros globalmente
   - `security`: Rate limiting, CORS, Helmet
3. **Services**: Lógica de negócio isolada e testável
4. **Prisma**: ORM para acesso ao banco de dados

**Principais Padrões:**
- **Repository Pattern**: Acesso a dados via Prisma
- **Service Layer**: Lógica de negócio isolada
- **Middleware Chain**: Processamento modular de requisições
- **Error Handling**: Centralizado e consistente

### 3. Sync Service (Microserviço)

**Responsabilidades:**
- Sincronização com Azure DevOps API
- Scheduler automático (cron)
- Rate limiting para API externa
- Processamento de dados em batch
- Idempotência de sincronização

**Estrutura:**
```
sync-service/
├── src/
│   ├── services/
│   │   ├── azureSyncService.ts    # Integração Azure DevOps
│   │   ├── schedulerService.ts    # Cron scheduler
│   │   └── RedisStorageService.ts # Cache e logs
│   ├── routes/
│   │   ├── sync.ts               # Endpoints manuais
│   │   ├── scheduler.ts          # Controle do scheduler
│   │   └── status.ts             # Status e logs
│   └── config/
│       └── sync-config.yaml      # Configurações
```

**Características:**
- **Sincronização Incremental**: Apenas dados novos desde `lastSyncAt`
- **Sincronização Completa**: Todos os dados (inicial ou forçada)
- **Rate Limiting**: Respeita limites da API Azure (X requisições/minuto)
- **Retry Logic**: Tentativas automáticas em caso de falha
- **Logging em Redis**: Histórico de execuções persistido

**Fluxo de Sincronização:**
```
1. Scheduler trigger (cron) ou Manual trigger
2. Buscar repositórios ativos do Backend
3. Para cada repositório:
   a. Determinar tipo (full ou incremental)
   b. Buscar PRs do Azure DevOps
   c. Buscar Commits dos PRs
   d. Enviar dados para Backend (batch)
   e. Backend processa e salva no PostgreSQL
4. Atualizar lastSyncAt do repositório
5. Salvar log de execução no Redis
```

### 4. Banco de Dados (PostgreSQL)

**Entidades Principais:**

```
User (Usuários do sistema)
├── id, name, email, login, password
├── roleId → Role
├── azureAdId (opcional)
└── viewScope (own/teams/all)

Role (Perfis de acesso)
├── id, name, description
├── permissions (JSON array)
└── isSystem, isDefault

Repository (Repositórios Azure)
├── id, name, url, organization, project
├── personalAccessToken (encrypted)
├── teamId → Team
└── lastSyncAt

Team (Times de desenvolvimento)
├── id, name, description
└── UserTeam (many-to-many)

Developer (Desenvolvedores Azure)
├── id, name, email, azureId
└── teamId → Team

PullRequest (Pull Requests)
├── id, title, status, azureId
├── repositoryId → Repository
├── createdById → Developer
├── createdAt, closedAt, mergedAt
├── cycleTimeDays, filesChanged
└── Reviews, Comments

Commit (Commits)
├── id, sha, message, author
├── repositoryId → Repository
├── pullRequestId → PullRequest
└── createdAt

SyncJob (Histórico de sincronizações)
├── id, repositoryId, status
├── syncType (full/incremental)
├── startedAt, completedAt
└── error
```

**Índices Importantes:**
- `Repository.azureId` (unique)
- `PullRequest.azureId` (unique por repositório)
- `Commit.sha` (unique por repositório)
- `Developer.azureId` (unique)
- `User.email` (unique)
- `User.login` (unique)

### 5. Cache (Redis)

**Uso Atual:**
- **Scheduler Logs**: Histórico de execuções do scheduler
- **Sync Status**: Status atual de sincronizações em andamento
- **Session Storage**: (futuro) Sessões de usuários

**Estrutura de Chaves:**
```
scheduler:execution:logs     # Lista de logs de execução
sync:status:{repoId}        # Status de sync por repositório
sync:config                 # Configurações do scheduler
```

**Uso Futuro (Planejado):**
- Cache de KPIs agregados (5-10 min TTL)
- Cache de listas de repositórios
- Cache de listas de desenvolvedores
- Cache de permissões de usuários

---

## 🔄 Fluxos de Dados

### Fluxo 1: Autenticação de Usuário

```
1. Frontend → POST /api/auth/login (email + password)
2. Backend → AuthService.login()
3. Buscar usuário no PostgreSQL
4. Validar senha (bcrypt)
5. Gerar JWT (access + refresh tokens)
6. Salvar refresh token no PostgreSQL
7. Retornar tokens + dados do usuário
8. Frontend armazena em localStorage
9. Frontend inclui Authorization: Bearer {token} em requisições
```

### Fluxo 2: Autenticação Azure AD

```
1. Frontend → Redirecionar para Microsoft Entra ID
2. Usuário autentica na Microsoft
3. Callback com código de autorização
4. Frontend → POST /api/auth/azure-ad-callback
5. Backend troca código por tokens (Azure)
6. Extrai informações do usuário (id_token)
7. Busca ou cria usuário no PostgreSQL
8. Gera JWT próprio
9. Retorna tokens + dados do usuário
```

### Fluxo 3: Sincronização Manual

```
1. Frontend → POST /api/sync/{repositoryId}
2. Backend → SyncService.startSync()
3. Backend → SyncServiceClient.isHealthy()
4. Backend → SyncServiceClient.startManualSync()
5. Sync Service busca dados do Azure DevOps
6. Sync Service → POST /api/sync-data/pull-requests (batch)
7. Backend processa e salva PRs no PostgreSQL
8. Sync Service → POST /api/sync-data/commits (batch)
9. Backend processa e salva Commits no PostgreSQL
10. Sync Service retorna resultado (success + recordsProcessed)
11. Backend atualiza Repository.lastSyncAt
12. Backend cria SyncJob com status completed
13. Retorna resultado para Frontend
```

### Fluxo 4: Sincronização Automática (Scheduler)

```
1. Scheduler (cron) trigger a cada X minutos
2. Sync Service → GET /api/repositories (busca do Backend)
3. Para cada repositório ativo:
   a. Determina tipo de sync (full se lastSyncAt=null, senão incremental)
   b. Executa fluxo de sincronização (mesmos passos do manual)
   c. Atualiza lastSyncAt se sucesso
4. Salva log de execução no Redis
5. Agenda próxima execução
```

### Fluxo 5: Consulta de KPIs

```
1. Frontend → GET /api/kpis/dashboard?startDate&endDate&teamId
2. Backend → requireAuth middleware (valida JWT)
3. Backend → requirePermission('kpi:read') middleware
4. Backend → KPIService.getDashboard()
5. Aplicar filtros de viewScope do usuário
6. Executar queries agregadas no PostgreSQL
7. Calcular métricas (avg, sum, count)
8. Retornar JSON com KPIs
9. Frontend renderiza gráficos (Recharts)
```

---

## 🎯 Decisões Arquiteturais

### 1. Separação do Sync Service

**Decisão**: Criar microserviço independente para sincronização

**Razões:**
- ✅ **Isolamento**: Falhas no sync não afetam o backend principal
- ✅ **Escalabilidade**: Pode escalar independentemente
- ✅ **Rate Limiting**: Controle fino sobre chamadas à API externa
- ✅ **Long-running**: Sincronizações longas não bloqueiam o backend
- ✅ **Scheduler Dedicado**: Cron sem interferir no backend

**Trade-offs:**
- ❌ Complexidade de deploy aumentada
- ❌ Comunicação HTTP entre serviços
- ✅ Mitigado: Backend proxy endpoints do sync service

### 2. Criptografia de Tokens

**Decisão**: Criptografar Personal Access Tokens no banco

**Razões:**
- ✅ **Segurança**: Tokens não ficam em plain text
- ✅ **Compliance**: Proteção de credenciais sensíveis
- ✅ **Auditoria**: Logs não expõem tokens

**Implementação:**
```typescript
// backend/src/utils/encryption.ts
import crypto from 'crypto';

export function encrypt(text: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

export function decrypt(encrypted: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

### 3. JWT + Refresh Tokens

**Decisão**: Usar JWT para access token e refresh token separado

**Razões:**
- ✅ **Stateless**: Access token não precisa de consulta ao banco
- ✅ **Segurança**: Access token expira rápido (24h)
- ✅ **Revogação**: Refresh tokens podem ser revogados no banco
- ✅ **Performance**: Validação rápida de access token

**Fluxo:**
```
Access Token (JWT): 24h de validade, stateless
Refresh Token: 7 dias, armazenado no PostgreSQL
Quando access expira → usar refresh para obter novo par
```

### 4. View Scope (Controle de Visibilidade)

**Decisão**: Implementar 3 níveis de visibilidade de dados

**Níveis:**
- **own**: Usuário vê apenas seus próprios dados
- **teams**: Usuário vê dados dos seus times
- **all**: Usuário vê todos os dados (admin)

**Aplicação:**
```typescript
// backend/src/services/kpiService.ts
applyViewScopeFilter(userId: string, userViewScope: string) {
  if (userViewScope === 'own') {
    return { developerId: userId };
  }
  if (userViewScope === 'teams') {
    return { developer: { team: { users: { some: { userId } } } } };
  }
  return {}; // 'all' - sem filtro
}
```

### 5. Sincronização Incremental

**Decisão**: Sincronizar apenas dados novos desde `lastSyncAt`

**Razões:**
- ✅ **Performance**: Reduz drasticamente a carga
- ✅ **API Limits**: Menos requisições à API Azure
- ✅ **Velocidade**: Syncs subsequentes são muito mais rápidos

**Implementação:**
```typescript
const since = repository.lastSyncAt 
  ? new Date(repository.lastSyncAt) 
  : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 dias atrás

const pullRequests = await azureApi.getPullRequests({
  repositoryId,
  searchCriteria: {
    status: 'all',
    minTime: since.toISOString()
  }
});
```

### 6. Idempotência de Sync

**Decisão**: Permitir reprocessamento seguro de dados

**Implementação:**
- PRs identificados por `azureId` único
- Commits identificados por `sha` único
- `upsert` ao invés de `create`: update se existe, create se não

**Benefícios:**
- ✅ Pode reprocessar dados sem duplicação
- ✅ Permite correção de dados inconsistentes
- ✅ Sincronização full sobrescreve dados antigos

---

## 🔒 Segurança

### Autenticação

1. **JWT Tokens**
   - Assinados com `JWT_SECRET`
   - Algoritmo: HS256
   - Access token: 24h
   - Refresh token: 7 dias

2. **Password Hashing**
   - bcrypt com 12 salt rounds
   - Timing-safe comparison

3. **Token Revogation**
   - Refresh tokens armazenados no banco
   - Campo `isRevoked` para invalidação
   - Logout revoga todos os tokens do usuário

### Autorização (RBAC)

```typescript
// Exemplo de permissões
{
  "admin": [
    "user:read", "user:write", "user:delete",
    "repo:read", "repo:write", "repo:delete",
    "sync:manual", "sync:scheduler:control",
    "kpi:read", "kpi:export"
  ],
  "manager": [
    "user:read", "repo:read", "repo:write",
    "sync:manual", "kpi:read", "kpi:export"
  ],
  "user": [
    "repo:read", "kpi:read"
  ]
}
```

### Proteções

1. **Rate Limiting**
   - Sync endpoints: 10 req/min por IP
   - Auth endpoints: 5 req/min por IP (proteção brute-force)

2. **CORS**
   - Whitelist de origens permitidas
   - Credentials: true

3. **Helmet**
   - Headers de segurança HTTP
   - XSS Protection
   - Content Security Policy

4. **Input Validation**
   - express-validator para sanitização
   - Zod para validação de tipos
   - Prisma para SQL injection protection

5. **Encryption**
   - Personal Access Tokens: AES-256-CBC
   - HTTPS em produção (TLS 1.2+)

---

## 📈 Escalabilidade

### Estratégias Implementadas

1. **Horizontal Scaling (Backend)**
   - Stateless API (JWT)
   - Múltiplas instâncias atrás de load balancer
   - Session storage em Redis (futuro)

2. **Database Optimization**
   - Índices em campos de busca frequente
   - Queries otimizadas com Prisma
   - Connection pooling

3. **Caching Strategy (Planejado)**
   - Redis cache para KPIs agregados (5-10 min TTL)
   - Invalidação após sync
   - Cache de listagens (repos, devs)

4. **Async Processing**
   - Sync service independente
   - Jobs em background via scheduler
   - Rate limiting inteligente

### Gargalos Identificados

1. **Dashboard KPIs**
   - Queries agregadas pesadas
   - **Solução**: Cache Redis (planejado)

2. **Sincronização de Grandes Repos**
   - Muitos PRs = muitas requisições
   - **Solução**: Batch processing + rate limiting

3. **Lista de Repositórios**
   - Join com múltiplas tabelas
   - **Solução**: Cache + paginação

---

## 📊 Monitoramento

### Logs

**Estrutura (Pino):**
```json
{
  "level": "info",
  "time": 1234567890,
  "msg": "User authenticated",
  "userId": "user-id-123",
  "email": "user@example.com",
  "requestId": "req-abc-123"
}
```

**Níveis:**
- `error`: Erros que precisam atenção
- `warn`: Avisos (token inválido, rate limit)
- `info`: Operações importantes (login, sync)
- `debug`: Detalhes de debug (desabilitado em prod)

### Métricas (Futuro)

**Health Checks:**
- `GET /healthz`: Liveness probe
- `GET /readyz`: Readiness probe
- `GET /metrics`: Prometheus metrics

**Métricas Planejadas:**
- Request duration (P50, P95, P99)
- Request count por endpoint
- Error rate
- Sync job duration
- Database query duration

---

## 🚀 Deploy

### Ambientes

1. **Desenvolvimento Local**
   - Docker Compose para banco + Redis
   - Apps rodando localmente (hot-reload)

2. **Staging** (Docker Compose)
   - Todas as aplicações containerizadas
   - Dados de teste

3. **Produção** (Kubernetes)
   - Múltiplas réplicas do backend
   - 1 instância do sync service
   - PostgreSQL gerenciado
   - Redis gerenciado

### CI/CD Pipeline (Planejado)

```
1. Push para branch
2. GitHub Actions trigger
3. Run linter (ESLint)
4. Run tests (Jest) ← ATUAL
5. Build Docker images
6. Push to registry
7. Deploy to staging
8. Run integration tests
9. Deploy to production (manual approval)
```

---

## 📚 Referências

- [Prisma Docs](https://www.prisma.io/docs)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Azure DevOps API](https://docs.microsoft.com/en-us/rest/api/azure/devops)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Última Atualização**: 2025-09-29  
**Versão**: 1.0  
**Autor**: Equipe de Desenvolvimento
