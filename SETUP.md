# 🚀 Setup da Aplicação - Indicadores Azure

Este documento descreve o processo completo de configuração da aplicação em um ambiente novo.

## 📋 Pré-requisitos

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- Docker e Docker Compose (opcional)

## 🗄️ Configuração da Base de Dados

### 1. Configuração do PostgreSQL

```bash
# Criar banco de dados
createdb indicadores_azure

# Ou via SQL
psql -c "CREATE DATABASE indicadores_azure;"
```

### 2. Configuração do Redis

```bash
# Iniciar Redis (se não estiver rodando)
redis-server
```

## 🔧 Setup da Aplicação

### 1. Instalar Dependências

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Sync Service
cd ../sync-service
npm install
```

### 2. Configurar Variáveis de Ambiente

#### Backend
```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/indicadores_azure"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
AZURE_CLIENT_ID="your-azure-client-id"
AZURE_CLIENT_SECRET="your-azure-client-secret"
AZURE_TENANT_ID="your-azure-tenant-id"
AZURE_REDIRECT_URI="http://localhost:5173/auth/callback"
```

#### Frontend
```bash
cd frontend
cp .env.example .env
```

Edite o arquivo `.env`:
```env
VITE_AZURE_CLIENT_ID="your-azure-client-id"
VITE_AZURE_TENANT_ID="your-azure-tenant-id"
VITE_AZURE_REDIRECT_URI="http://localhost:5173/auth/callback"
VITE_API_URL="http://localhost:8080/api"
```

#### Sync Service
```bash
cd sync-service
cp env.example .env
```

Edite o arquivo `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/indicadores_azure"
REDIS_URL="redis://localhost:6379"
SERVICE_API_KEY="your-service-api-key"
BACKEND_API_KEY="your-backend-api-key"
BACKEND_URL="http://localhost:8080"
```

### 3. Configurar Base de Dados

#### Opção A: Setup Automático (Recomendado)
```bash
cd backend
npm run db:init
```

Este comando irá:
- ✅ Criar roles padrão (user, admin)
- ✅ Criar usuário administrador padrão
- ✅ Configurar sync-service
- ✅ Marcar role "user" como padrão

#### Opção B: Setup Manual
```bash
cd backend

# 1. Executar migrações
npm run db:migrate

# 2. Criar roles padrão
npm run db:create-roles

# 3. Criar usuário administrador
npm run db:create-admin

# 4. Configurar API keys para serviços
npm run db:setup-service-keys
```

### 4. Iniciar Serviços

#### Desenvolvimento
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Sync Service
cd sync-service
npm run dev

# Terminal 3 - Frontend
cd frontend
npm run dev
```

#### Produção (Docker)
```bash
# Configurar variáveis de ambiente
cp env.docker.example .env.docker
# Editar .env.docker com suas configurações

# Iniciar todos os serviços
docker-compose up -d
```

## 🔐 Credenciais Padrão

Após executar o setup, você terá:

### Usuário Administrador
- **Email**: `admin@indicadores.com`
- **Senha**: `admin123`
- **Role**: Administrador completo

⚠️ **IMPORTANTE**: Altere a senha após o primeiro login!

### Roles Disponíveis
- **user**: Usuário padrão (marcado como padrão para novos usuários)
- **admin**: Administrador do sistema

## 🌐 URLs dos Serviços

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8080
- **Sync Service**: http://localhost:8081
- **Health Check Backend**: http://localhost:8080/healthz
- **Health Check Sync Service**: http://localhost:8081/healthz

## 🔧 Comandos Úteis

### Backend
```bash
npm run db:migrate          # Executar migrações
npm run db:generate         # Gerar cliente Prisma
npm run db:init            # Setup completo da base
npm run db:create-admin    # Criar usuário admin
npm run db:create-roles    # Criar roles padrão
npm run db:studio          # Abrir Prisma Studio
```

### Sync Service
```bash
npm run dev                # Modo desenvolvimento
npm run build              # Build para produção
npm run start              # Iniciar em produção
```

## 🚨 Solução de Problemas

### Erro: "Nenhum role padrão encontrado"
```bash
cd backend
npm run db:init
```

### Erro: "Usuário não autenticado"
Verifique se o JWT_SECRET está configurado corretamente.

### Erro: "Azure AD callback failed"
Verifique se as configurações do Azure AD estão corretas:
- Client ID
- Client Secret
- Tenant ID
- Redirect URI

### Erro: "Database connection failed"
Verifique se:
- PostgreSQL está rodando
- DATABASE_URL está correto
- Banco de dados existe

## 📚 Próximos Passos

1. **Alterar senha do administrador**
2. **Configurar notificações** (se necessário)
3. **Ajustar configurações do sync-service**
4. **Configurar repositórios Azure DevOps**
5. **Testar sincronização**

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs dos serviços
2. Confirme se todas as dependências estão instaladas
3. Verifique as configurações de ambiente
4. Execute `npm run db:init` para resetar a base de dados
