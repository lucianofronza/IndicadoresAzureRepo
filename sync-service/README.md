# 🔄 Sync Service

Microserviço dedicado para sincronização automática de repositórios Azure DevOps no sistema de Indicadores.

## 🚀 Funcionalidades

### ⏰ Agendamento Automático
- Sincronização incremental a cada 30 minutos (configurável)
- Controle de concorrência (máximo 3 repositórios simultâneos)
- Rate limiting para Azure DevOps API
- Sincronização completa apenas manual

### 🔐 Segurança
- Autenticação JWT entre serviços
- API Keys para comunicação interna
- Validação de permissões
- Logs de auditoria

### 📊 Monitoramento
- Métricas Prometheus
- Logs estruturados
- WebSocket para updates em tempo real
- Dashboard de monitoramento

### 🔔 Notificações
- Email para falhas críticas
- Slack webhook (opcional)
- Configuração de thresholds
- Notificações de sucesso (opcional)

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

## 📋 Pré-requisitos

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- Docker e Docker Compose

## 🛠️ Instalação

### 1. Configuração do Ambiente

```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar variáveis de ambiente
nano .env
```

### 2. Variáveis de Ambiente

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/indicadores_azure_repos"

# Redis
REDIS_URL="redis://localhost:6379"

# Security
JWT_SECRET="your-jwt-secret-key-here"
SERVICE_API_KEY="your-service-api-key-here"
BACKEND_API_KEY="your-backend-api-key-here"

# Backend Integration
BACKEND_URL="http://localhost:8080"

# Rate Limiting
AZURE_RATE_LIMIT_PER_MINUTE=60
AZURE_BURST_LIMIT=10
MAX_CONCURRENT_REPOS=3
DELAY_BETWEEN_REPOS_SECONDS=30

# Scheduler
DEFAULT_SYNC_INTERVAL_MINUTES=30
MAX_RETRIES=3
RETRY_DELAY_MINUTES=5

# Notifications
NOTIFICATION_ENABLED=true
NOTIFICATION_EMAILS="admin@company.com,devops@company.com"
```

### 3. Instalação das Dependências

```bash
npm install
```

### 4. Configuração do Banco de Dados

```bash
# Gerar cliente Prisma
npx prisma generate

# Executar migrações
npx prisma migrate dev

# Popular dados iniciais
npx prisma db seed
```

### 5. Execução

#### Desenvolvimento
```bash
npm run dev
```

#### Produção com Docker
```bash
# Build e execução
docker-compose up -d

# Logs
docker-compose logs -f sync-service
```

## 🔧 API Endpoints

### Configuração
- `GET /api/config` - Buscar configuração global
- `PUT /api/config` - Atualizar configuração global
- `GET /api/config/notifications` - Buscar configuração de notificações
- `PUT /api/config/notifications` - Atualizar configuração de notificações

### Status e Monitoramento
- `GET /api/status/scheduler` - Status do scheduler
- `GET /api/status/sync/:repositoryId` - Status de sincronização
- `GET /api/status/system` - Status geral do sistema
- `GET /api/monitoring/metrics` - Métricas Prometheus
- `GET /api/monitoring/logs` - Logs recentes
- `GET /api/monitoring/health` - Health check

### Controle
- `POST /api/control/scheduler/start` - Iniciar scheduler
- `POST /api/control/scheduler/stop` - Parar scheduler
- `POST /api/control/scheduler/run-now` - Executar imediatamente
- `POST /api/control/sync/:repositoryId` - Sincronização manual
- `DELETE /api/control/sync/:repositoryId` - Cancelar sincronização

## 📊 Monitoramento

### Métricas Prometheus

```bash
# Acessar métricas
curl http://localhost:8081/metrics

# Métricas principais
sync_scheduler_running{status="active|inactive"}
sync_jobs_total{repository_id, sync_type, status}
sync_job_duration_seconds{repository_id, sync_type}
sync_rate_limit_hits_total{type, repository_id}
sync_azure_api_requests_total{endpoint, status}
```

### WebSocket Events

```javascript
// Conectar ao WebSocket
const socket = io('ws://localhost:8081');

// Escutar eventos
socket.on('scheduler:started', (data) => {
  console.log('Scheduler started:', data);
});

socket.on('sync:completed', (data) => {
  console.log('Sync completed:', data);
});

socket.on('sync:failed', (data) => {
  console.log('Sync failed:', data);
});
```

## 🔔 Notificações

### Configuração de Email

```bash
# Variáveis de ambiente
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
NOTIFICATION_EMAILS="admin@company.com,devops@company.com"
```

### Configuração de Slack

```bash
# Webhook URL do Slack
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
```

## 🚀 Deploy

### Docker Compose

```bash
# Produção
docker-compose -f docker-compose.yml up -d

# Desenvolvimento
docker-compose -f docker-compose.dev.yml up -d
```

### Kubernetes

```bash
# Aplicar configurações
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 🔍 Troubleshooting

### Logs

```bash
# Logs do container
docker logs indicadores-sync-service

# Logs em tempo real
docker logs -f indicadores-sync-service

# Logs do sistema
tail -f logs/sync-service.log
```

### Health Checks

```bash
# Health check
curl http://localhost:8081/healthz

# Readiness check
curl http://localhost:8081/readyz

# Métricas
curl http://localhost:8081/metrics
```

### Problemas Comuns

**Scheduler não inicia:**
```bash
# Verificar configuração
curl http://localhost:8081/api/status/scheduler

# Verificar logs
docker logs indicadores-sync-service | grep scheduler
```

**Rate limit atingido:**
```bash
# Verificar status do rate limit
curl http://localhost:8081/api/status/rate-limit/REPOSITORY_ID

# Ajustar configuração
curl -X PUT http://localhost:8081/api/config \
  -H "Content-Type: application/json" \
  -d '{"azureRateLimitPerMinute": 30}'
```

**Falhas de sincronização:**
```bash
# Verificar logs de erro
curl http://localhost:8081/api/monitoring/logs?level=error

# Verificar métricas de falha
curl http://localhost:8081/api/monitoring/sync-metrics
```

## 📈 Performance

### Otimizações

- **Rate Limiting**: Controle de requisições para Azure DevOps
- **Concorrência**: Máximo 3 repositórios simultâneos
- **Cache**: Redis para locks e filas
- **Batch Processing**: Processamento em lotes
- **Connection Pooling**: Pool de conexões PostgreSQL

### Monitoramento

- **Métricas**: Prometheus + Grafana
- **Logs**: Estruturados com Pino
- **Tracing**: OpenTelemetry (futuro)
- **Alertas**: Configuráveis via Prometheus

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
