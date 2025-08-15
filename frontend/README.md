# Frontend - Indicadores Azure Repos

Aplicação React para o dashboard de indicadores de desenvolvedores do Azure Repos.

## 🚀 Tecnologias

- **React 18** com TypeScript
- **Vite** para build e desenvolvimento
- **Tailwind CSS** para estilização
- **React Query** para gerenciamento de estado
- **React Router** para navegação
- **Recharts** para gráficos
- **Lucide React** para ícones
- **React Hook Form** para formulários
- **Zod** para validação

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações
```

## 🔧 Desenvolvimento

```bash
# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview

# Lint
npm run lint

# Testes
npm run test
```

## 🌐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Azure DevOps OAuth Configuration
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_REDIRECT_URI=http://localhost/login

# API Configuration
VITE_API_URL=http://localhost:8080/api
```

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── Layout.tsx      # Layout principal
│   ├── Sidebar.tsx     # Navegação lateral
│   ├── Header.tsx      # Cabeçalho
│   └── ProtectedRoute.tsx # Rota protegida
├── contexts/           # Contextos React
│   └── AuthContext.tsx # Contexto de autenticação
├── lib/                # Utilitários
│   └── utils.ts        # Funções utilitárias
├── pages/              # Páginas da aplicação
│   ├── Dashboard.tsx   # Dashboard principal
│   ├── Login.tsx       # Página de login
│   ├── Teams.tsx       # Gerenciamento de times
│   ├── Roles.tsx       # Gerenciamento de cargos
│   ├── Stacks.tsx      # Gerenciamento de stacks
│   ├── Developers.tsx  # Gerenciamento de desenvolvedores
│   ├── Repositories.tsx # Gerenciamento de repositórios
│   └── Sync.tsx        # Sincronização
├── services/           # Serviços de API
│   └── api.ts          # Configuração do axios
├── types/              # Definições de tipos TypeScript
│   └── index.ts        # Tipos da aplicação
├── App.tsx             # Componente principal
├── main.tsx            # Ponto de entrada
└── index.css           # Estilos globais
```

## 🔐 Autenticação

A aplicação utiliza OAuth2 com Azure DevOps para autenticação:

1. Usuário clica em "Conectar com Azure DevOps"
2. É redirecionado para Azure DevOps para autorização
3. Retorna com código de autorização
4. Backend troca código por token de acesso
5. Token é armazenado no localStorage
6. Usuário pode acessar as funcionalidades

## 📊 Dashboard

O dashboard inclui:

- **KPIs principais**: Pull Requests, Reviews, Cycle Time, Tempo de Review
- **Gráficos**: PRs por status (pizza), PRs por time (barras)
- **Top desenvolvedores**: Ranking por PRs e reviews
- **Filtros**: Por período, time, cargo, stack

## 🐳 Docker

```bash
# Build da imagem
docker build -t indicadores-frontend .

# Executar container
docker run -p 80:80 indicadores-frontend
```

## 📝 Scripts Disponíveis

- `npm run dev` - Executa em modo desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Preview da build
- `npm run lint` - Executa ESLint
- `npm run test` - Executa testes
- `npm run test:ui` - Interface visual para testes

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request
