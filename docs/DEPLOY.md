# Deploy Guide - Indicadores Azure Repos

## Pré-requisitos

- Docker e Docker Compose
- Node.js 20+
- PostgreSQL (para desenvolvimento local)
- Redis (para desenvolvimento local)
- Kubernetes cluster (para produção)
- Azure DevOps App Registration configurado

## Desenvolvimento Local

### 1. Configuração Inicial

```bash
# Clone o repositório
git clone <repository-url>
cd IndicadoresAzureRepo

# Copie o arquivo de exemplo
cp env.docker.example .env

# Configure as variáveis no .env
# Veja seção "Variáveis de Ambiente" abaixo
```

### 2. Executar com Docker Compose

```bash
# Iniciar ambiente de staging (recomendado para testes)
./scripts/docker-staging.sh

# Ou iniciar ambiente de produção
./scripts/docker-start.sh

# Verificar logs
docker-compose -f docker-compose.staging.yml logs -f

# Parar serviços
docker-compose -f docker-compose.staging.yml down
```

### 3. Executar Localmente (sem Docker)

```bash
# Backend
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev

# Frontend (quando criado)
cd frontend
npm install
npm run dev
```

### 4. Acessar a Aplicação

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/healthz
- **Metrics**: http://localhost:8080/metrics
- **API Docs**: http://localhost:8080/api

## Produção - Kubernetes

### 1. Preparar Imagens

```bash
# Build das imagens
docker build -f backend/Dockerfile -t indicadores-backend:latest backend/
docker build -f frontend/Dockerfile -t indicadores-frontend:latest frontend/

# Push para registry (substitua pelo seu registry)
docker tag indicadores-backend:latest your-registry/indicadores-backend:latest
docker tag indicadores-frontend:latest your-registry/indicadores-frontend:latest
docker push your-registry/indicadores-backend:latest
docker push your-registry/indicadores-frontend:latest
```

### 2. Configurar Secrets

```bash
# Criar secrets no Kubernetes
kubectl create secret generic indicadores-secrets \
  --from-literal=DATABASE_URL="postgresql://user:password@db:5432/indicadores_azure" \
  --from-literal=REDIS_URL="redis://redis:6379" \
  --from-literal=AZURE_CLIENT_ID="your-azure-client-id" \
  --from-literal=AZURE_CLIENT_SECRET="your-azure-client-secret" \
  
  -n indicadores-azure
```

### 3. Deploy no Kubernetes

```bash
# Aplicar namespace
kubectl apply -f infra/k8s/namespace.yaml

# Aplicar secrets e configmaps
kubectl apply -f infra/k8s/secret.yaml
kubectl apply -f infra/k8s/configmap.yaml

# Deploy PostgreSQL (se não usar serviço gerenciado)
kubectl apply -f infra/k8s/statefulset-postgres.yaml

# Deploy Redis
kubectl apply -f infra/k8s/deployment-redis.yaml

# Deploy aplicação
kubectl apply -f infra/k8s/deployment-backend.yaml
kubectl apply -f infra/k8s/deployment-frontend.yaml

# Aplicar serviços
kubectl apply -f infra/k8s/service-backend.yaml
kubectl apply -f infra/k8s/service-frontend.yaml

# Aplicar ingress
kubectl apply -f infra/k8s/ingress.yaml

# Aplicar HPA
kubectl apply -f infra/k8s/hpa-backend.yaml
kubectl apply -f infra/k8s/hpa-frontend.yaml
```

### 4. Verificar Deploy

```bash
# Verificar pods
kubectl get pods -n indicadores-azure

# Verificar serviços
kubectl get svc -n indicadores-azure

# Verificar ingress
kubectl get ingress -n indicadores-azure

# Verificar logs
kubectl logs -f deployment/indicadores-backend -n indicadores-azure
```

## Variáveis de Ambiente

### Desenvolvimento (.env)

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/indicadores_azure"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"

# Azure DevOps OAuth
AZURE_CLIENT_ID="your-azure-client-id"
AZURE_CLIENT_SECRET="your-azure-client-secret"
AZURE_REDIRECT_URI="http://localhost:8080/auth/azure/callback"



# App
NODE_ENV="development"
PORT=8080
LOG_LEVEL="debug"
FRONTEND_URL="http://localhost:5173"
```

### Produção (Kubernetes Secrets)

```yaml
# infra/k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: indicadores-secrets
  namespace: indicadores-azure
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
  AZURE_CLIENT_ID: <base64-encoded-azure-client-id>
  AZURE_CLIENT_SECRET: <base64-encoded-azure-client-secret>
  
```

## Configuração Azure DevOps

### 1. Criar App Registration

1. Acesse [Azure DevOps](https://dev.azure.com)
2. Vá em **Organization Settings** > **Developer** > **Personal access tokens**
3. Clique em **New Token**
4. Configure as permissões:
   - Code (Read)
   - Work Items (Read)
   - Project and Team (Read)

### 2. Configurar OAuth

1. Vá em **Organization Settings** > **Developer** > **OAuth**
2. Clique em **New OAuth Application**
3. Configure:
   - **Name**: Indicadores Azure Repos
   - **Website**: http://localhost:5173 (dev) / https://indicadores.example.com (prod)
   - **Callback URL**: http://localhost:8080/auth/azure/callback (dev) / https://api.indicadores.example.com/auth/azure/callback (prod)
   - **Scopes**: vso.code, vso.work, vso.project

## Banco de Dados

### Migrações

```bash
# Desenvolvimento
cd backend
npm run db:migrate

# Produção (via job)
kubectl create job --from=cronjob/migrate-db migrate-db-manual -n indicadores-azure
```

### Seed

```bash
# Desenvolvimento
cd backend
npm run db:seed

# Produção
kubectl exec -it deployment/indicadores-backend -n indicadores-azure -- npm run db:seed
```

## Monitoramento

### Health Checks

- **Liveness**: `GET /healthz`
- **Readiness**: `GET /readyz`
- **Metrics**: `GET /metrics`

### Logs

```bash
# Ver logs do backend
kubectl logs -f deployment/indicadores-backend -n indicadores-azure

# Ver logs do frontend
kubectl logs -f deployment/indicadores-frontend -n indicadores-azure
```

### Métricas Prometheus

```bash
# Verificar métricas
curl http://localhost:8080/metrics

# Configurar Prometheus para coletar métricas
# Adicionar job no prometheus.yml:
- job_name: 'indicadores-backend'
  static_configs:
    - targets: ['indicadores-backend-service:9090']
```

## Troubleshooting

### Problemas Comuns

1. **Database connection failed**
   - Verificar DATABASE_URL
   - Verificar se PostgreSQL está rodando
   - Verificar credenciais

2. **Redis connection failed**
   - Verificar REDIS_URL
   - Verificar se Redis está rodando

3. **Azure OAuth failed**
   - Verificar AZURE_CLIENT_ID e AZURE_CLIENT_SECRET
   - Verificar AZURE_REDIRECT_URI
   - Verificar permissões no Azure DevOps

4. **Pods não iniciam**
   - Verificar logs: `kubectl logs <pod-name> -n indicadores-azure`
   - Verificar health checks
   - Verificar recursos disponíveis

### Comandos Úteis

```bash
# Reiniciar deployment
kubectl rollout restart deployment/indicadores-backend -n indicadores-azure

# Escalar deployment
kubectl scale deployment/indicadores-backend --replicas=3 -n indicadores-azure

# Ver eventos
kubectl get events -n indicadores-azure

# Port forward para debug
kubectl port-forward svc/indicadores-backend-service 8080:80 -n indicadores-azure
```

## Backup e Restore

### Backup do Banco

```bash
# Backup
pg_dump -h localhost -U user -d indicadores_azure > backup.sql

# Restore
psql -h localhost -U user -d indicadores_azure < backup.sql
```

### Backup do Redis

```bash
# Backup
redis-cli BGSAVE

# Restore (se necessário)
redis-cli FLUSHALL
# Copiar dump.rdb para diretório do Redis
```
