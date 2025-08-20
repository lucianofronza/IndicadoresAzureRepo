# 📊 Indicadores Azure Repos

Uma aplicação web fullstack para análise de indicadores individuais de desenvolvedores a partir do Azure Repos (Azure DevOps), com foco em observabilidade, segurança e escalabilidade horizontal.

## 🚀 Funcionalidades

### 📈 Dashboard de Indicadores
- **Pull Requests**: Análise de status, cycle time, tempo de review
- **Commits**: Contagem e análise por desenvolvedor
- **Reviews**: Métricas de reviews realizados e recebidos
- **Comments**: Análise de interações e feedback
- **Files Changed**: Estatísticas de alterações de arquivos
- **Cycle Time**: Tempo médio de abertura até merge
- **Lead Time**: Tempo para primeira review

### 🔧 Configuração
- **CRUD de Desenvolvedores**: Gerenciamento completo de desenvolvedores
- **CRUD de Times**: Organização por equipes
- **CRUD de Cargos**: Definição de roles e responsabilidades
- **CRUD de Stacks**: Tecnologias utilizadas
- **CRUD de Repositórios**: Configuração de fontes Azure DevOps

### 🔄 Sincronização
- **Sincronização Manual**: Botão "Sync now" para cada repositório
- **Sincronização Automática**: Jobs agendados para atualização periódica
- **Idempotência**: Processamento seguro sem duplicação
- **Paginação**: Suporte a grandes volumes de dados
- **Rate Limiting**: Respeito aos limites da API Azure DevOps

### 🔐 Integração Azure DevOps
- **Personal Access Token**: Autenticação simplificada com PAT
- **Configuração Centralizada**: Token configurado no arquivo .env
- **Acesso a Repositórios**: Leitura de dados de múltiplos projetos
- **Validação de Conexão**: Verificação automática de credenciais

## 🏗️ Arquitetura

### Frontend
- **React 18** com TypeScript
- **Vite** para build e desenvolvimento
- **Tailwind CSS** para estilização
- **React Query** para gerenciamento de estado
- **Recharts** para visualizações
- **React Router** para navegação
- **Lucide React** para ícones

### Backend
- **Node.js** com TypeScript
- **Express.js** como framework web
- **Prisma ORM** para acesso ao banco
- **PostgreSQL** como banco de dados
- **Redis** para cache e sessões
- **Zod** para validação

### Infraestrutura
- **Docker** para containerização
- **Kubernetes** para orquestração
- **Prometheus** para métricas
- **Grafana** para dashboards
- **OpenTelemetry** para tracing
- **Helm** para deployment (opcional)

## 📋 Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- PostgreSQL 14+
- Redis 7+
- Azure DevOps Personal Access Token
- Kubernetes cluster (para produção)

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/indicadores-azure-repos.git
cd indicadores-azure-repos
```

### 2. Configuração do Ambiente

#### Backend
```bash
cd backend
# Para desenvolvimento local, use as mesmas variáveis do Docker
# Copie o arquivo de exemplo e configure conforme necessário
cp ../env.docker.example .env
```

#### Frontend
```bash
cd frontend
cp .env.example .env
```

Edite o arquivo `.env`:
```env
VITE_API_URL="http://localhost:8080/api"
```

### 3. Instalação das Dependências

#### Backend
```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

#### Frontend
```bash
cd frontend
npm install
```

### 4. Execução com Docker Compose

#### Configuração Inicial
```bash
# Copiar arquivo de exemplo de variáveis de ambiente
cp env.docker.example .env.docker

# Editar as variáveis obrigatórias
nano .env.docker
```

**Variáveis obrigatórias no `.env.docker`:**
```env
POSTGRES_PASSWORD=your_secure_password_here
ENCRYPTION_KEY=your_32_character_encryption_key
```

#### Ambientes Disponíveis

**🛠️ Desenvolvimento (Recomendado para desenvolvedores):**
```bash
# Ambiente com hot-reload e volumes montados
./scripts/docker-dev.sh
```

**🧪 Staging/Homologação:**
```bash
# Ambiente de teste similar à produção
./scripts/docker-staging.sh
```

**🚀 Produção:**
```bash
# Ambiente de produção otimizado
./scripts/docker-start.sh
```

#### Estrutura dos Arquivos Docker Compose

Todos os arquivos Docker Compose estão organizados na raiz do projeto:

| Arquivo | Ambiente | Propósito |
|---------|----------|-----------|
| `docker-compose.yml` | Produção | Ambiente de produção otimizado |
| `docker-compose.dev.yml` | Desenvolvimento | Hot-reload e volumes montados |
| `docker-compose.staging.yml` | Staging | Ambiente de teste similar à produção |

#### Execução Manual (Produção)
```bash
# Validar variáveis de ambiente
./scripts/validate-env.sh

# Iniciar serviços de produção
docker-compose up -d
```

A aplicação estará disponível em:
- Frontend: http://localhost:5173 (configurável via FRONTEND_PORT)
- Backend API: http://localhost:8080 (configurável via BACKEND_PORT)
- Health Check: http://localhost:8080/healthz

### 5. Execução Local

#### Backend
```bash
cd backend
npm run dev
```

#### Frontend
```bash
cd frontend
npm run dev
```

## 🔐 Configuração Azure DevOps

### 1. Criar Personal Access Token

1. Acesse [Azure DevOps](https://dev.azure.com)
2. Vá em **User Settings** (canto superior direito) > **Personal access tokens**
3. Clique em **New Token**
4. Configure as permissões:
   - **Code (Read)**: Para acessar repositórios e pull requests
   - **Work Items (Read)**: Para acessar work items relacionados
   - **Project and Team (Read)**: Para acessar informações de projetos e times
5. Defina o escopo para sua organização
6. Copie o token gerado

### 2. Configurar na Aplicação

**IMPORTANTE**: As credenciais do Azure DevOps agora são configuradas por repositório na aplicação, não mais via variáveis de ambiente.

1. **Acesse**: http://localhost:5173/azure-devops
2. **Configure**: Informe a organização e token para cada repositório
3. **Adicione**: Selecione os repositórios para monitorar

### 3. Configuração de Repositórios

1. **Vá em**: http://localhost:5173/repositories
2. **Edite**: Cada repositório pode ter seu próprio token
3. **Gerencie**: Tokens são criptografados no banco de dados

## 🚀 Deploy em Produção

### 1. Configuração do Kubernetes

```bash
# Aplicar namespace
kubectl apply -f infra/k8s/namespace.yaml

# Aplicar secrets (configure os valores primeiro)
kubectl apply -f infra/k8s/secret.yaml

# Aplicar configmap
kubectl apply -f infra/k8s/configmap.yaml

# Aplicar deployments
kubectl apply -f infra/k8s/deployment-backend.yaml
kubectl apply -f infra/k8s/deployment-frontend.yaml
kubectl apply -f infra/k8s/deployment-redis.yaml

# Aplicar services
kubectl apply -f infra/k8s/service-backend.yaml
kubectl apply -f infra/k8s/service-frontend.yaml
kubectl apply -f infra/k8s/service-redis.yaml

# Aplicar ingress
kubectl apply -f infra/k8s/ingress.yaml

# Aplicar HPA (Horizontal Pod Autoscaler)
kubectl apply -f infra/k8s/hpa-backend.yaml
kubectl apply -f infra/k8s/hpa-frontend.yaml
```

## 📊 Uso da Aplicação

### 1. Configuração Inicial

1. **Acesse a aplicação**: http://localhost:3000
2. **Configure Times**: Vá em "Times" e adicione suas equipes
3. **Configure Cargos**: Vá em "Cargos" e adicione os roles da empresa
4. **Configure Stacks**: Vá em "Stacks" e adicione as tecnologias utilizadas
5. **Configure Repositórios**: Vá em "Repositórios" e adicione os repositórios Azure DevOps

### 2. Sincronização de Dados

1. **Sincronização Manual**: Vá em "Sincronização" e clique em "Sync now" para cada repositório
2. **Verificação**: Os dados aparecerão no Dashboard após a sincronização

### 3. Análise de Indicadores

1. **Dashboard**: Visualize métricas gerais e gráficos
2. **Filtros**: Use os filtros por data, time, cargo, etc.
3. **Detalhamento**: Clique nos gráficos para mais detalhes

## 🔧 Desenvolvimento

### Estrutura do Projeto

```
├── frontend/           # Aplicação React
│   ├── src/
│   │   ├── components/ # Componentes reutilizáveis
│   │   ├── pages/      # Páginas da aplicação
│   │   ├── services/   # Serviços de API
│   │   └── types/      # Definições de tipos
│   └── package.json
├── backend/            # API Node.js
│   ├── src/
│   │   ├── routes/     # Rotas da API
│   │   ├── services/   # Lógica de negócio
│   │   ├── middlewares/ # Middlewares
│   │   └── config/     # Configurações
│   └── package.json
├── infra/              # Configurações de infraestrutura
├── docs/               # Documentação
└── docker-compose.yml  # Orquestração local
```

### Scripts Úteis

```bash
# Backend
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run db:migrate   # Executar migrações
npm run db:seed      # Popular banco com dados de teste

# Frontend
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview da build
```

## 📈 Monitoramento

### Health Checks

- **Liveness**: `GET /healthz`
- **Readiness**: `GET /readyz`
- **Metrics**: `GET /metrics`

### Logs

```bash
# Ver logs do backend
docker logs indicadores-backend-new

# Ver logs do frontend
docker logs indicadores-frontend
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

Para suporte, envie um email para suporte@exemplo.com ou abra uma issue no GitHub.
