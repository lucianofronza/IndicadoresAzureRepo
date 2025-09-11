# 🔄 Sync Service Integration Setup

Este documento descreve como configurar e usar o novo sistema de sincronização com microserviço dedicado.

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │    │   Backend API   │    │  Sync Service   │
│                 │    │                 │    │                 │
│ - Dashboard     │◄──►│ - Auth          │◄──►│ - Scheduler     │
│ - Config        │    │ - CRUD          │    │ - Azure Sync    │
│ - Monitoring    │    │ - Permissions   │    │ - Rate Limiting │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                └────────┬───────────────┘
                                         ▼
                                ┌─────────────────┐
                                │   PostgreSQL    │
                                │   + Redis       │
                                └─────────────────┘
```

## 🚀 Setup Rápido

### 1. Configuração Automática

```bash
# Execute o script de setup automático
./scripts/setup-sync-service.sh
```

### 2. Setup Manual

#### Backend
```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:create-roles
npm run db:setup-service-keys
```

#### Sync Service
```bash
cd sync-service
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:setup-service-keys
```

## 🔐 Configuração de Segurança

### 1. API Keys

O sistema gera automaticamente API keys para comunicação entre serviços:

```bash
# Backend
SYNC_SERVICE_API_KEY=<generated-key>
BACKEND_API_KEY=<generated-key>

# Sync Service
SERVICE_API_KEY=<generated-key>
BACKEND_API_KEY=<generated-key>
```

### 2. JWT Secret

Certifique-se de que o `JWT_SECRET` é o mesmo em ambos os serviços:

```bash
JWT_SECRET=your-shared-jwt-secret
```

## 🐳 Execução com Docker

### 1. Configuração

```bash
# Copiar arquivo de ambiente
cp env.docker.example .env.docker

# Editar variáveis (incluir as API keys geradas)
nano .env.docker
```

### 2. Execução

```bash
# Produção
docker-compose up -d

# Desenvolvimento
docker-compose -f docker-compose.dev.yml up -d
```

## 🔧 Execução Local

### 1. Backend

```bash
cd backend
npm run dev
# Roda em http://localhost:8080
```

### 2. Sync Service

```bash
cd sync-service
npm run dev
# Roda em http://localhost:8081
```

### 3. Frontend

```bash
cd frontend
npm run dev
# Roda em http://localhost:5173
```

## 📊 Monitoramento

### 1. Health Checks

```bash
# Backend
curl http://localhost:8080/healthz

# Sync Service
curl http://localhost:8081/healthz
```

### 2. Métricas

```bash
# Métricas do Sync Service
curl http://localhost:8081/metrics
```

### 3. Status do Scheduler

```bash
# Via Backend API
curl http://localhost:8080/api/scheduler/status

# Diretamente do Sync Service
curl http://localhost:8081/api/status/scheduler
```

## 🎛️ Controle do Scheduler

### 1. Iniciar Scheduler

```bash
curl -X POST http://localhost:8080/api/scheduler/start \
  -H "Authorization: Bearer <user-token>"
```

### 2. Parar Scheduler

```bash
curl -X POST http://localhost:8080/api/scheduler/stop \
  -H "Authorization: Bearer <user-token>"
```

### 3. Executar Imediatamente

```bash
curl -X POST http://localhost:8080/api/scheduler/run-now \
  -H "Authorization: Bearer <user-token>"
```

### 4. Configurar Intervalo

```bash
curl -X PUT http://localhost:8080/api/scheduler/config \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 15}'
```

## 🔔 Notificações

### 1. Configurar Email

```bash
curl -X PUT http://localhost:8080/api/scheduler/config \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationEnabled": true,
    "notificationRecipients": ["admin@company.com"]
  }'
```

### 2. Configurar Slack

```bash
curl -X PUT http://localhost:8080/api/scheduler/config \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "slackWebhookUrl": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
  }'
```

## 📈 Métricas e Logs

### 1. Métricas de Sincronização

```bash
curl http://localhost:8080/api/scheduler/metrics?days=7
```

### 2. Estatísticas por Repositório

```bash
curl http://localhost:8080/api/scheduler/repository-stats?days=30
```

### 3. Logs do Sistema

```bash
curl http://localhost:8080/api/scheduler/system-status
```

## 🔍 Troubleshooting

### 1. Scheduler não inicia

```bash
# Verificar status
curl http://localhost:8080/api/scheduler/status

# Verificar logs
docker logs indicadores-sync-service-prod

# Verificar configuração
curl http://localhost:8080/api/scheduler/config
```

### 2. Falhas de sincronização

```bash
# Verificar métricas de falha
curl http://localhost:8080/api/scheduler/metrics

# Verificar status de repositório específico
curl http://localhost:8080/api/sync/REPOSITORY_ID/status
```

### 3. Problemas de conectividade

```bash
# Verificar health do sync-service
curl http://localhost:8080/api/scheduler/health

# Verificar conectividade direta
curl http://localhost:8081/healthz
```

## 🔐 Permissões

### Novas Permissões Adicionadas

- `sync:status:read` - Ver status de sincronização
- `sync:history:read` - Ver histórico de sincronizações
- `sync:manual:execute` - Executar sincronização manual
- `sync:config:read` - Ler configurações do scheduler
- `sync:config:write` - Configurar scheduler
- `sync:scheduler:control` - Controlar scheduler (start/stop)
- `sync:monitor:read` - Acessar monitoramento

### Roles Atualizados

- **Viewer**: `sync:status:read`, `sync:history:read`
- **Admin**: Todas as permissões de sync

## 🚀 Deploy em Produção

### 1. Variáveis de Ambiente

Certifique-se de configurar todas as variáveis necessárias:

```bash
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# Security
JWT_SECRET="your-secure-jwt-secret"
SYNC_SERVICE_API_KEY="your-sync-service-key"
BACKEND_API_KEY="your-backend-key"

# Sync Service
SYNC_SERVICE_URL="http://sync-service:8080"
DEFAULT_SYNC_INTERVAL_MINUTES=30
MAX_CONCURRENT_REPOS=3
AZURE_RATE_LIMIT_PER_MINUTE=60

# Notifications
NOTIFICATION_ENABLED=true
NOTIFICATION_EMAILS="admin@company.com"
```

### 2. Kubernetes

```bash
# Aplicar configurações
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/secret.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/deployment-sync-service.yaml
kubectl apply -f infra/k8s/service-sync-service.yaml
```

## 📚 API Documentation

### Backend API

- **Scheduler**: `/api/scheduler/*`
- **Sync**: `/api/sync/*` (atualizado)

### Sync Service API

- **Config**: `/api/config/*`
- **Status**: `/api/status/*`
- **Control**: `/api/control/*`
- **Monitoring**: `/api/monitoring/*`

## 🆘 Suporte

Para suporte ou dúvidas:

1. Verifique os logs: `docker logs indicadores-sync-service-prod`
2. Consulte a documentação: `/api` endpoint
3. Verifique o status: `/healthz` endpoints
4. Abra uma issue no repositório

---

**🎉 Parabéns! O sistema de sincronização com microserviço está configurado e pronto para uso!**
