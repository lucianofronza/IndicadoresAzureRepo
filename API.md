# 📡 API Documentation - Indicadores Azure Repos

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Formato de Resposta](#formato-de-resposta)
4. [Endpoints](#endpoints)
   - [Auth](#auth)
   - [Repositories](#repositories)
   - [Sync](#sync)
   - [KPIs](#kpis)
   - [Users](#users)
5. [Códigos de Erro](#códigos-de-erro)
6. [Rate Limiting](#rate-limiting)

---

## 🎯 Visão Geral

### Base URL

```
Desenvolvimento: http://localhost:8080
Produção:       https://api.indicadores.example.com
```

### Versão da API

**Atual**: `v1` (sem versionamento explícito na URL)

### Content-Type

Todas as requisições e respostas utilizam:

```
Content-Type: application/json
```

---

## 🔐 Autenticação

### JWT Authentication

A API utiliza **JWT (JSON Web Tokens)** para autenticação.

#### Como Autenticar

1. **Obter Token**:
   ```http
   POST /api/auth/login
   Content-Type: application/json

   {
     "email": "user@example.com",
     "password": "Password123!"
   }
   ```

2. **Incluir Token nas Requisições**:
   ```http
   GET /api/repositories
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

#### Tipos de Token

| Token         | Validade | Armazenamento | Uso                           |
|---------------|----------|---------------|-------------------------------|
| Access Token  | 24 horas | localStorage  | Requisições à API             |
| Refresh Token | 7 dias   | localStorage  | Renovar access token expirado |

#### Renovar Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token_here"
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token",
    "expiresAt": "2025-09-30T12:00:00Z"
  }
}
```

---

## 📦 Formato de Resposta

### Sucesso

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Erro

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": { ... } // Optional
}
```

### Paginação

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 🛣️ Endpoints

### Auth

#### 1. Registrar Usuário

```http
POST /api/auth/register
Content-Type: application/json
```

**Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "login": "johndoe",
  "password": "SecurePassword123!",
  "roleId": "user-role-id"
}
```

**Validação**:
- `name`: 2-100 caracteres
- `email`: Email válido
- `login`: 3-50 caracteres (letras, números, `-`, `_`)
- `password`: Mínimo 6 caracteres
- `roleId`: UUID válido (opcional, default: role "user")

**Resposta**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "login": "johndoe",
    "roleId": "user-role-id"
  }
}
```

---

#### 2. Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Body**:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "login": "johndoe",
      "role": "user",
      "viewScope": "teams"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR...",
    "refreshToken": "refresh_token_here",
    "expiresAt": "2025-09-30T12:00:00Z"
  }
}
```

**Erros**:
- `401`: Credenciais inválidas
- `401`: Usuário inativo ou pendente

---

#### 3. Login com Azure AD

```http
POST /api/auth/azure-ad-callback
Content-Type: application/json
```

**Body**:
```json
{
  "code": "azure_authorization_code"
}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "..."
  }
}
```

---

#### 4. Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json
```

**Body**:
```json
{
  "refreshToken": "your_refresh_token"
}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token",
    "expiresAt": "2025-09-30T12:00:00Z"
  }
}
```

---

#### 5. Logout

```http
POST /api/auth/logout
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

---

#### 6. Obter Usuário Autenticado

```http
GET /api/auth/me
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "login": "johndoe",
    "role": "user",
    "viewScope": "teams",
    "permissions": ["repo:read", "kpi:read"]
  }
}
```

---

### Repositories

#### 1. Listar Repositórios

```http
GET /api/repositories?page=1&pageSize=10&sortBy=name&sortOrder=asc
Authorization: Bearer {access_token}
```

**Query Params**:
- `page`: Número da página (default: 1)
- `pageSize`: Itens por página (default: 10)
- `sortBy`: Campo de ordenação (default: `name`)
- `sortOrder`: `asc` ou `desc` (default: `asc`)

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "repo-uuid",
      "name": "MyProject",
      "url": "https://dev.azure.com/org/project/_git/MyProject",
      "organization": "org",
      "project": "project",
      "lastSyncAt": "2025-09-29T10:00:00Z",
      "team": {
        "id": "team-uuid",
        "name": "Team A"
      },
      "_count": {
        "pullRequests": 150
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### 2. Obter Repositório por ID

```http
GET /api/repositories/:id
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "repo-uuid",
    "name": "MyProject",
    "url": "https://dev.azure.com/...",
    "organization": "org",
    "project": "project",
    "personalAccessToken": "decrypted_token",
    "lastSyncAt": "2025-09-29T10:00:00Z",
    "team": { ... },
    "pullRequests": [ ... ],
    "_count": {
      "pullRequests": 150
    }
  }
}
```

**Erros**:
- `404`: Repositório não encontrado

---

#### 3. Criar Repositório

```http
POST /api/repositories
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Body**:
```json
{
  "name": "NewProject",
  "url": "https://dev.azure.com/org/project/_git/NewProject",
  "organization": "org",
  "project": "project",
  "personalAccessToken": "azure_pat_token",
  "teamId": "team-uuid"
}
```

**Validação**:
- `name`: 1-100 caracteres, obrigatório
- `url`: URL válida, obrigatório
- `organization`: 1-100 caracteres, obrigatório
- `project`: 1-100 caracteres, obrigatório
- `personalAccessToken`: String, opcional (será criptografado)
- `teamId`: UUID, opcional

**Resposta**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "new-repo-uuid",
    "name": "NewProject",
    ...
  },
  "message": "Repository created successfully"
}
```

**Permissão Necessária**: `repo:write`

---

#### 4. Atualizar Repositório

```http
PUT /api/repositories/:id
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Body** (todos os campos opcionais):
```json
{
  "name": "UpdatedName",
  "url": "https://...",
  "personalAccessToken": "new_token",
  "teamId": "new-team-uuid"
}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": { ... },
  "message": "Repository updated successfully"
}
```

**Permissão Necessária**: `repo:write`

---

#### 5. Deletar Repositório

```http
DELETE /api/repositories/:id
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "message": "Repository deleted successfully"
}
```

**Permissão Necessária**: `repo:delete`

---

#### 6. Obter Estatísticas do Repositório

```http
GET /api/repositories/:id/stats
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "totalPullRequests": 150,
    "openPullRequests": 10,
    "mergedPullRequests": 130,
    "closedPullRequests": 10,
    "avgCycleTimeDays": 3.5,
    "totalCommits": 1500,
    "contributors": 12
  }
}
```

---

### Sync

#### 1. Status do Scheduler

```http
GET /api/sync/scheduler/status
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "isRunning": false,
    "lastRunAt": "2025-09-29T08:00:00Z",
    "nextRunAt": "2025-09-29T09:00:00Z",
    "intervalMinutes": 60
  }
}
```

**Permissão Necessária**: `sync:status:read`

---

#### 2. Iniciar Scheduler

```http
POST /api/sync/scheduler/start
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "message": "Scheduler started successfully"
}
```

**Permissão Necessária**: `sync:scheduler:control`

---

#### 3. Parar Scheduler

```http
POST /api/sync/scheduler/stop
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "message": "Scheduler stopped successfully"
}
```

**Permissão Necessária**: `sync:scheduler:control`

---

#### 4. Obter Configuração do Scheduler

```http
GET /api/sync/scheduler/config
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "intervalMinutes": 60,
    "cronExpression": "0 * * * *",
    "batchSize": 10
  }
}
```

**Permissão Necessária**: `sync:config:read`

---

#### 5. Atualizar Configuração do Scheduler

```http
PUT /api/sync/scheduler/config
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Body**:
```json
{
  "enabled": true,
  "intervalMinutes": 120
}
```

**Validação**:
- `enabled`: Boolean, obrigatório
- `intervalMinutes`: Número > 0, obrigatório

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "intervalMinutes": 120
  }
}
```

**Permissão Necessária**: `sync:config:write`

---

#### 6. Logs do Scheduler

```http
GET /api/sync/scheduler/logs?page=1&pageSize=10
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "executedAt": "2025-09-29T08:00:00Z",
      "status": "completed",
      "repositoriesProcessed": 10,
      "totalRecordsProcessed": 150,
      "duration": 45000,
      "error": null
    }
  ],
  "pagination": { ... }
}
```

**Permissão Necessária**: `sync:logs:read`

---

#### 7. Iniciar Sincronização Manual

```http
POST /api/sync/:repositoryId/start
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Body** (opcional):
```json
{
  "syncType": "incremental"
}
```

**Validação**:
- `syncType`: `full` ou `incremental` (default: `incremental`)

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "job-uuid",
    "repositoryId": "repo-uuid",
    "status": "running",
    "syncType": "incremental",
    "startedAt": "2025-09-29T12:00:00Z",
    "result": {
      "success": true,
      "hasNewData": true,
      "recordsProcessed": 25,
      "duration": 5000
    }
  }
}
```

**Permissão Necessária**: `sync:manual`

**Rate Limit**: 10 requisições/minuto

---

#### 8. Status da Sincronização

```http
GET /api/sync/:repositoryId/status
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "repositoryId": "repo-uuid",
    "jobId": "job-uuid",
    "status": "completed",
    "startedAt": "2025-09-29T12:00:00Z",
    "completedAt": "2025-09-29T12:05:00Z",
    "error": null,
    "syncService": {
      "isRunning": false
    }
  }
}
```

**Permissão Necessária**: `sync:status:read`

---

#### 9. Histórico de Sincronizações

```http
GET /api/sync/:repositoryId/history?page=1&pageSize=5
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "job-uuid",
      "repositoryId": "repo-uuid",
      "status": "completed",
      "syncType": "incremental",
      "startedAt": "2025-09-29T12:00:00Z",
      "completedAt": "2025-09-29T12:05:00Z",
      "error": null
    }
  ],
  "pagination": { ... }
}
```

**Permissão Necessária**: `sync:history:read`

---

### KPIs

#### 1. Dashboard de KPIs

```http
GET /api/kpis/dashboard?startDate=2025-01-01&endDate=2025-09-29&teamId=team-uuid
Authorization: Bearer {access_token}
```

**Query Params**:
- `startDate`: ISO 8601 date (obrigatório)
- `endDate`: ISO 8601 date (obrigatório)
- `teamId`: UUID (opcional, para filtrar por time)
- `developerId`: UUID (opcional, para filtrar por desenvolvedor)

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalPullRequests": 500,
      "totalCommits": 5000,
      "totalDevelopers": 15,
      "avgCycleTimeDays": 2.8
    },
    "developers": [
      {
        "id": "dev-uuid",
        "name": "John Doe",
        "pullRequestsCreated": 45,
        "commitsAuthored": 320,
        "avgCycleTimeDays": 2.5
      }
    ],
    "timeline": [
      {
        "date": "2025-09-01",
        "pullRequests": 25,
        "commits": 200
      }
    ]
  }
}
```

**Permissão Necessária**: `kpi:read`

**View Scope**: Respeita o `viewScope` do usuário (`own`, `teams`, `all`)

---

### Users

#### 1. Listar Usuários

```http
GET /api/users?page=1&pageSize=10
Authorization: Bearer {access_token}
```

**Resposta**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "login": "johndoe",
      "role": "user",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Permissão Necessária**: `user:read`

---

## ⚠️ Códigos de Erro

| Código HTTP | Error Code             | Descrição                                      |
|-------------|------------------------|------------------------------------------------|
| 400         | `VALIDATION_ERROR`     | Dados de entrada inválidos                     |
| 400         | `BAD_REQUEST`          | Requisição mal formada                         |
| 401         | `UNAUTHORIZED`         | Token ausente, inválido ou expirado            |
| 401         | `INVALID_CREDENTIALS`  | Email ou senha incorretos                      |
| 401         | `INVALID_REFRESH_TOKEN`| Refresh token inválido ou expirado             |
| 403         | `FORBIDDEN`            | Sem permissão para acessar o recurso           |
| 404         | `NOT_FOUND`            | Recurso não encontrado                         |
| 409         | `CONFLICT`             | Conflito (ex: email já cadastrado)             |
| 429         | `RATE_LIMIT_EXCEEDED`  | Limite de requisições excedido                 |
| 500         | `INTERNAL_ERROR`       | Erro interno do servidor                       |
| 503         | `SERVICE_UNAVAILABLE`  | Serviço temporariamente indisponível           |

### Exemplo de Resposta de Erro

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Dados de entrada inválidos",
  "details": [
    {
      "field": "email",
      "message": "Email inválido"
    },
    {
      "field": "password",
      "message": "Senha deve ter pelo menos 6 caracteres"
    }
  ]
}
```

---

## 🚦 Rate Limiting

### Limites por Endpoint

| Endpoint              | Limite                | Janela  |
|-----------------------|-----------------------|---------|
| `/api/auth/login`     | 5 requisições/IP      | 1 min   |
| `/api/auth/register`  | 3 requisições/IP      | 1 min   |
| `/api/sync/**`        | 10 requisições/IP     | 1 min   |
| Outros endpoints      | 100 requisições/IP    | 1 min   |

### Headers de Rate Limit

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633024800
```

### Resposta ao Exceder Limite

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Muitas requisições. Tente novamente em 60 segundos.",
  "retryAfter": 60
}
```

---

## 📚 Recursos Adicionais

- **Swagger UI** (planejado): `http://localhost:8080/api-docs`
- **Postman Collection**: `/docs/postman/collection.json`
- **GitHub**: [Link para repositório]

---

**Última Atualização**: 2025-09-29  
**Versão**: 1.0  
**Autor**: Equipe de Desenvolvimento
