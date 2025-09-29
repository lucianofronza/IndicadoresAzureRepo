# 📊 Indicadores Azure Repos

[![CI/CD Pipeline](https://github.com/lucianofronza/IndicadoresAzureRepo/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/lucianofronza/IndicadoresAzureRepo/actions/workflows/ci.yml)
[![Code Quality](https://github.com/lucianofronza/IndicadoresAzureRepo/workflows/Code%20Quality/badge.svg)](https://github.com/lucianofronza/IndicadoresAzureRepo/actions/workflows/code-quality.yml)
[![Tests](https://img.shields.io/badge/tests-51%20passing-brightgreen)](./TESTING.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Uma aplicação web fullstack para análise de indicadores individuais de desenvolvedores a partir do Azure Repos (Azure DevOps), com foco em observabilidade, segurança e escalabilidade horizontal.

## 📖 Índice

- [🚀 Funcionalidades](#-funcionalidades)
- [🏗️ Arquitetura](#️-arquitetura)
- [📋 Pré-requisitos](#-pré-requisitos)
- [🛠️ Instalação](#️-instalação)
- [🔐 Configuração Azure DevOps](#-configuração-azure-devops)
- [🚀 Deploy em Produção](#-deploy-em-produção)
- [📊 Uso da Aplicação](#-uso-da-aplicação)
- [🧪 Testes e Qualidade](#-testes-e-qualidade)
- [📚 Documentação Técnica](#-documentação-técnica)
- [🔧 Desenvolvimento](#-desenvolvimento)
- [📈 Monitoramento](#-monitoramento)
- [🤝 Contribuição](#-contribuição)
- [📄 Licença](#-licença)

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
- **Sincronização Inteligente**: Completa para repositórios nunca sincronizados, incremental para os demais
- **Idempotência**: Processamento seguro sem duplicação
- **Paginação**: Suporte a grandes volumes de dados
- **Rate Limiting**: Respeito aos limites da API Azure DevOps

### 🔐 Integração Azure DevOps
- **Personal Access Token**: Autenticação por repositório com PAT criptografado
- **Configuração por Repositório**: Cada repositório pode ter seu próprio token
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
git clone https://github.com/lucianofronza/IndicadoresAzureRepo.git
cd IndicadoresAzureRepo
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
# O frontend não precisa de arquivo .env para desenvolvimento local
# O Vite configura automaticamente o proxy para /api -> http://localhost:8080/api
# A aplicação roda em http://localhost:5173 por padrão
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

**Geração da ENCRYPTION_KEY:**
```bash
# Gerar chave de 32 caracteres
openssl rand -base64 24
```

#### Ambientes Disponíveis

**🛠️ Desenvolvimento Local (Recomendado):**
```bash
# Apenas banco em containers, apps rodam localmente
./scripts/dev-local.sh
```
*Ideal para desenvolvimento: máximo performance e hot-reload*

**🐳 Desenvolvimento com Containers (Legado):**
```bash
# Tudo em containers (mais lento para desenvolvimento)
./scripts/docker-dev.sh
```
*Útil para testar configurações de containers*

**🧪 Staging/Homologação:**
```bash
# Ambiente de teste similar à produção
./scripts/docker-staging.sh
```
*Para testes de integração e homologação*

**🚀 Produção:**
```bash
# Ambiente de produção otimizado
./scripts/docker-start.sh
```
*Para deploy em produção*

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

### 5. Desenvolvimento Local (Recomendado)

Para desenvolvimento, recomendamos usar apenas os serviços de banco em containers e rodar as aplicações localmente para máxima performance.

#### Configuração Rápida
```bash
# 1. Subir apenas banco de dados
./scripts/dev-local.sh

# 2. Em terminal separado - Backend
cd backend && npm run dev

# 3. Em terminal separado - Frontend
cd frontend && npm run dev
```

#### Vantagens do Desenvolvimento Local
- **⚡ Velocidade**: Hot-reload instantâneo sem rebuild de containers
- **🐛 Debugging**: Logs diretos e breakpoints funcionais
- **🔧 Flexibilidade**: Fácil de parar/iniciar apenas as aplicações
- **💾 Persistência**: Dados do banco preservados entre restarts

#### Execução Manual (Alternativa)
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
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

1. **Acesse a aplicação**: http://localhost:5173
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

## 🧪 Testes e Qualidade

### Visão Geral dos Testes

Este projeto possui uma suite abrangente de testes para garantir qualidade e confiabilidade:

```
✅ Testes Unitários:      33 testes (100% passando)
⚠️  Testes de Integração:  8 testes (estrutura criada)
⚠️  Testes de Middleware:  10 testes (50% passando)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL:                51 testes
```

### Executar Testes

#### Todos os Testes
```bash
cd backend
npm test
```

#### Testes Específicos
```bash
# Por arquivo
npm test -- authService.test.ts

# Por padrão
npm test -- --testPathPattern=services

# Por nome
npm test -- --testNamePattern="deve criar usuário"
```

#### Modo Watch (Desenvolvimento)
```bash
npm test -- --watch
```

#### Cobertura de Código
```bash
npm test -- --coverage

# Abrir relatório HTML
open coverage/lcov-report/index.html
```

### Estrutura de Testes

```
backend/src/tests/
├── unit/
│   ├── services/
│   │   ├── authService.test.ts       # ✅ 13 testes
│   │   ├── syncService.test.ts       # ✅ 7 testes
│   │   └── repositoryService.test.ts # ✅ 13 testes
│   └── middlewares/
│       └── auth.test.ts              # ⚠️ 10 testes (5/10)
├── integration/
│   ├── auth.test.ts                  # ⚠️ 6 testes
│   └── sync.test.ts                  # ⚠️ 2 testes
└── setup.ts
```

### Tipos de Testes

#### 1. Testes Unitários
Testam funções e métodos isoladamente com mocks de dependências.

**Exemplo:**
```typescript
describe('AuthService', () => {
  it('deve criar um novo usuário com sucesso', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!'
    };
    
    const result = await authService.register(userData);
    
    expect(result).toHaveProperty('id');
    expect(result.email).toBe(userData.email);
  });
});
```

#### 2. Testes de Integração
Testam a integração entre componentes (rotas + middlewares + serviços).

**Exemplo:**
```typescript
describe('POST /api/auth/register', () => {
  it('deve registrar um novo usuário', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);
    
    expect(response.body.success).toBe(true);
  });
});
```

#### 3. Testes de Middleware
Testam a lógica de middlewares (autenticação, permissões, erros).

**Exemplo:**
```typescript
describe('requireAuth', () => {
  it('deve retornar 401 sem token', async () => {
    await requireAuth(mockRequest, mockResponse, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });
});
```

### Cobertura de Código

**Metas de Cobertura:**
- Services: ≥ 80%
- Middlewares: ≥ 70%
- Routes: ≥ 60%

**Visualizar Cobertura:**
```bash
npm test -- --coverage
```

### CI/CD (Planejado)

Os testes serão executados automaticamente em:
- ✅ Push para qualquer branch
- ✅ Pull Requests
- ✅ Deploy para staging/produção

### Documentação de Testes

Para mais detalhes sobre como escrever e executar testes, consulte:
- 📖 [TESTING.md](./TESTING.md) - Guia completo de testes
- 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura do sistema
- 📡 [API.md](./API.md) - Documentação da API

## 📚 Documentação Técnica

Este projeto possui documentação técnica abrangente para facilitar o entendimento, desenvolvimento e manutenção:

### 📋 Documentos Disponíveis

#### 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
Documentação completa da arquitetura do sistema:
- **Visão Geral**: Stack tecnológica e objetivos
- **Arquitetura de Alto Nível**: Diagramas e componentes
- **Componentes Detalhados**: Frontend, Backend, Sync Service
- **Fluxos de Dados**: 5 fluxos principais documentados
  - Autenticação de usuário
  - Autenticação Azure AD
  - Sincronização manual
  - Sincronização automática (scheduler)
  - Consulta de KPIs
- **Decisões Arquiteturais**: 6 decisões importantes explicadas
  - Separação do Sync Service
  - Criptografia de tokens
  - JWT + Refresh tokens
  - View Scope (visibilidade de dados)
  - Sincronização incremental
  - Idempotência de sync
- **Segurança**: Autenticação, autorização e proteções
- **Escalabilidade**: Estratégias e gargalos identificados
- **Monitoramento**: Logs, métricas e health checks

#### 🧪 [TESTING.md](./TESTING.md)
Guia completo de testes do projeto:
- **Estrutura de Testes**: Organização e tipos
- **Como Executar**: Comandos e opções
- **Escrevendo Testes**: Padrões e melhores práticas
  - Testes unitários (33 testes)
  - Testes de integração (8 testes)
  - Testes de middleware (10 testes)
- **Mocking Strategies**: Como usar Jest mocks
- **Cobertura de Código**: Relatórios e metas
- **Debugging**: Ferramentas e técnicas
- **CI/CD**: Integração contínua (planejado)

#### 📡 [API.md](./API.md)
Documentação completa da API REST:
- **Autenticação**: JWT e refresh tokens
- **Formato de Resposta**: Padrões e estrutura
- **Endpoints Completos**:
  - 🔐 Auth (6 endpoints)
  - 📦 Repositories (6 endpoints)
  - 🔄 Sync (9 endpoints)
  - 📊 KPIs (1 endpoint)
  - 👥 Users (1+ endpoints)
- **Códigos de Erro**: Tabela completa
- **Rate Limiting**: Limites e headers
- **Exemplos**: Requisições e respostas

### 🎯 Como Usar a Documentação

**Para Novos Desenvolvedores:**
1. Comece com [ARCHITECTURE.md](./ARCHITECTURE.md) para entender o sistema
2. Leia [TESTING.md](./TESTING.md) para contribuir com testes
3. Consulte [API.md](./API.md) para integração

**Para Desenvolvimento:**
1. Use [API.md](./API.md) como referência de endpoints
2. Siga [TESTING.md](./TESTING.md) ao escrever novos testes
3. Consulte [ARCHITECTURE.md](./ARCHITECTURE.md) para decisões arquiteturais

**Para Deploy:**
1. Revise [ARCHITECTURE.md](./ARCHITECTURE.md) seção de Deploy
2. Configure conforme [instalação](#️-instalação)
3. Implemente [monitoramento](#-monitoramento)

## 🔧 Desenvolvimento

### Troubleshooting de Desenvolvimento

#### Problemas Comuns

**Backend não conecta ao banco:**
```bash
# Verificar se PostgreSQL está rodando
docker-compose --env-file .env.docker -f docker-compose.dev.yml ps

# Verificar logs do PostgreSQL
docker-compose --env-file .env.docker -f docker-compose.dev.yml logs postgres
```

**Frontend não conecta ao backend:**
```bash
# Verificar se backend está rodando na porta 8080
curl http://localhost:8080/healthz

# Verificar se proxy está configurado no Vite
# O frontend deve fazer proxy de /api para http://localhost:8080/api
```

**Dependências desatualizadas:**
```bash
# Backend
cd backend && rm -rf node_modules package-lock.json && npm install

# Frontend
cd frontend && rm -rf node_modules package-lock.json && npm install
```

**Reset completo do ambiente:**
```bash
# Parar todos os serviços
docker-compose --env-file .env.docker -f docker-compose.dev.yml down -v

# Remover volumes (cuidado: perde dados)
docker volume rm indicadoresazurerepo_postgres_data_dev indicadoresazurerepo_redis_data_dev

# Reiniciar
./scripts/dev-local.sh
```

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
├── scripts/            # Scripts de automação
├── docker-compose.yml  # Orquestração de produção
├── docker-compose.dev.yml  # Orquestração de desenvolvimento
└── docker-compose.staging.yml  # Orquestração de staging
```

### Fluxo de Desenvolvimento

#### 1. Configuração Inicial
```bash
# Clone e configure o ambiente
git clone <repository>
cd indicadores-azure-repos
cp env.docker.example .env.docker
# Edite .env.docker com suas configurações

# Suba apenas os serviços de banco
./scripts/dev-local.sh
```

#### 2. Desenvolvimento Diário
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Logs do banco (opcional)
docker-compose --env-file .env.docker -f docker-compose.dev.yml logs -f
```

#### 3. Testes e Dados
```bash
# Popular banco com dados de teste
cd backend && npm run db:seed

# Popular banco com dados completos
cd backend && npm run db:seed:demo
```

### Scripts Úteis

#### 🚀 Scripts de Desenvolvimento
```bash
# Backend
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run db:migrate   # Executar migrações
npm run db:seed      # Popular banco com dados básicos
npm run db:seed:demo # Popular banco com dados completos de demonstração

# Frontend
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview da build
```

#### 🛠️ Scripts de Manutenção (Backend)

**População de Dados:**
```bash
# Seed básico (estrutura mínima)
cd backend && npm run db:seed

# Seed completo com dados de demonstração
cd backend && npm run db:seed:demo

# Executar seed dentro do container Docker
docker-compose --env-file .env.docker -f docker-compose.dev.yml exec backend npm run db:seed
docker-compose --env-file .env.docker -f docker-compose.dev.yml exec backend npm run db:seed:demo
```

**Análise de Desenvolvedores:**
```bash
# Mostrar estatísticas atuais
cd backend && npx tsx scripts/show-developer-stats.ts

# Redistribuir desenvolvedores sem time
cd backend && npx tsx scripts/redistribute-developers.ts

# Reverter redistribuição
cd backend && npx tsx scripts/revert-developer-redistribution.ts

# Normalizar nomes de desenvolvedores
cd backend && npx tsx scripts/normalize-developer-names.ts
```

#### 📊 Scripts de Docker
```bash
# Produção
./scripts/docker-start.sh

# Desenvolvimento (recomendado)
./scripts/dev-local.sh

# Desenvolvimento (legado - tudo em containers)
./scripts/docker-dev.sh

# Staging/Homologação
./scripts/docker-staging.sh
```

#### 🎯 Casos de Uso dos Scripts

**1. Configuração Inicial:**
```bash
# Popular banco com dados de demonstração
cd backend && npm run db:seed:demo
```

**2. Análise de Dados:**
```bash
# Ver estatísticas dos desenvolvedores
cd backend && npx tsx scripts/show-developer-stats.ts
```

**3. Teste de Gráficos:**
```bash
# Redistribuir desenvolvedores para testar gráficos
cd backend && npx tsx scripts/redistribute-developers.ts

# Reverter após teste
cd backend && npx tsx scripts/revert-developer-redistribution.ts
```

**4. Limpeza de Dados:**
```bash
# Normalizar nomes de desenvolvedores
cd backend && npx tsx scripts/normalize-developer-names.ts
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
