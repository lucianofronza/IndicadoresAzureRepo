# 🤖 GitHub Workflows - Indicadores Azure Repos

Este diretório contém os workflows de CI/CD e automação do projeto.

## 📋 Workflows Disponíveis

### 1. CI/CD Pipeline (`ci.yml`)

**Trigger**: Push em branches principais e feature branches, Pull Requests

**Jobs:**
1. **Lint Backend**: Executa ESLint no código backend
2. **Lint Frontend**: Executa ESLint no código frontend
3. **Test Backend**: Executa suite de testes com cobertura
4. **Build Backend**: Compila aplicação backend
5. **Build Frontend**: Compila aplicação frontend
6. **Docker Build**: Cria e publica imagens Docker (apenas main/develop)
7. **Notify Success**: Notifica sucesso do pipeline

**Duração Estimada**: 5-10 minutos

**Configuração Necessária:**
- `CODECOV_TOKEN`: Token do Codecov para upload de cobertura
- `DOCKER_USERNAME`: Usuário do Docker Hub
- `DOCKER_PASSWORD`: Senha/token do Docker Hub

---

### 2. Pull Request Checks (`pr-checks.yml`)

**Trigger**: Abertura, sincronização ou reabertura de Pull Requests

**Jobs:**
1. **Validate PR Title**: Valida formato do título (conventional commits)
2. **Check Sensitive Files**: Verifica arquivos sensíveis (.env, secrets)
3. **Analyze PR Size**: Calcula tamanho do PR e emite warnings se muito grande
4. **Test Coverage**: Gera relatório de cobertura e comenta no PR
5. **TypeCheck**: Verifica tipos TypeScript
6. **PR Comment**: Posta resumo automatizado no PR

**Duração Estimada**: 3-5 minutos

**Formato do Título do PR:**
```
<tipo>: <descrição começando com maiúscula>

Tipos válidos:
- feat: Nova funcionalidade
- fix: Correção de bug
- docs: Documentação
- style: Formatação
- refactor: Refatoração
- perf: Performance
- test: Testes
- build: Build
- ci: CI/CD
- chore: Tarefas gerais
- revert: Reverter commit

Exemplo: "feat: Adicionar autenticação OAuth"
```

---

### 3. Code Quality (`code-quality.yml`)

**Trigger**: Push em main/develop, Pull Requests

**Jobs:**
1. **Security Audit**: Auditoria de segurança de dependências
2. **Check Outdated**: Verifica dependências desatualizadas
3. **Complexity Analysis**: Análise de complexidade de código
4. **Check TODOs**: Lista TODOs e FIXMEs no código
5. **Bundle Size**: Analisa tamanho dos bundles frontend
6. **Check Formatting**: Verifica formatação com Prettier
7. **Check Duplication**: Detecta duplicação de código
8. **Quality Report**: Gera relatório consolidado

**Duração Estimada**: 5-7 minutos

**Nota**: Alguns jobs são informativos e não bloqueiam merge

---

### 4. Deploy (`deploy.yml`)

**Trigger**: 
- Push em `main` (produção)
- Push em `develop` (staging)
- Tags `v*` (releases)
- Manual (`workflow_dispatch`)

**Ambientes:**
- **Staging**: `develop` branch
- **Production**: `main` branch ou tags

**Jobs:**
1. **Setup**: Determina ambiente e tag
2. **Backup Database**: Backup antes de deploy (produção)
3. **Deploy Staging**: Deploy para ambiente de staging
4. **Deploy Production**: Deploy para ambiente de produção
5. **Rollback**: Rollback em caso de falha
6. **Notify**: Notificações de status

**Configuração Necessária:**
- `AWS_ACCESS_KEY_ID`: Credenciais AWS (se aplicável)
- `AWS_SECRET_ACCESS_KEY`: Credenciais AWS (se aplicável)
- `SLACK_WEBHOOK_URL`: Webhook para notificações Slack (opcional)
- Secrets de banco de dados para backup

**Nota**: O workflow está configurado como template. Ajuste os comandos de deploy conforme sua infraestrutura (Docker, Kubernetes, etc).

---

### 5. Dependabot (`dependabot.yml`)

**Trigger**: Automático, conforme agendamento

**Funcionalidades:**
- Atualiza dependências npm (backend, frontend, sync-service)
- Atualiza GitHub Actions
- Atualiza imagens Docker
- Abre PRs automaticamente

**Agendamento:**
- **NPM**: Semanalmente, segunda-feira 09:00 (BRT)
- **GitHub Actions**: Mensalmente, dia 1 09:00 (BRT)
- **Docker**: Mensalmente

**Limites:**
- Backend: 5 PRs abertos
- Frontend: 5 PRs abertos
- Sync Service: 3 PRs abertos
- GitHub Actions: 3 PRs abertos
- Docker: 2 PRs abertos

---

## 🎯 Como Usar

### Para Desenvolvedores

#### 1. Trabalhar em Feature Branch
```bash
git checkout -b feature/minha-feature
# ... fazer alterações ...
git commit -m "feat: adicionar nova funcionalidade"
git push origin feature/minha-feature
```

O workflow **CI/CD** será executado automaticamente.

#### 2. Abrir Pull Request
```bash
# No GitHub, abra um PR de feature/minha-feature para develop
```

Os workflows **CI/CD** e **PR Checks** serão executados.

#### 3. Merge após Aprovação
Após revisão e aprovação:
- Todos os checks devem passar (✅)
- Merge para `develop` ativa deploy em **staging**
- Merge para `main` ativa deploy em **produção**

---

### Para Administradores

#### Deploy Manual
```bash
# Via GitHub UI:
# 1. Ir em Actions > Deploy
# 2. Clicar "Run workflow"
# 3. Selecionar ambiente (staging/production)
# 4. Clicar "Run workflow"
```

#### Configurar Secrets
```bash
# No GitHub:
# Settings > Secrets and variables > Actions

# Secrets necessários:
CODECOV_TOKEN=<token_codecov>
DOCKER_USERNAME=<usuario_docker>
DOCKER_PASSWORD=<senha_docker>
AWS_ACCESS_KEY_ID=<aws_key>
AWS_SECRET_ACCESS_KEY=<aws_secret>
SLACK_WEBHOOK_URL=<slack_webhook>
DB_HOST=<database_host>
DB_USER=<database_user>
DB_PASSWORD=<database_password>
```

---

## 📊 Badges para README

Adicione ao README principal:

```markdown
![CI/CD Pipeline](https://github.com/lucianofronza/IndicadoresAzureRepo/workflows/CI%2FCD%20Pipeline/badge.svg)
![Code Quality](https://github.com/lucianofronza/IndicadoresAzureRepo/workflows/Code%20Quality/badge.svg)
[![codecov](https://codecov.io/gh/lucianofronza/IndicadoresAzureRepo/branch/main/graph/badge.svg)](https://codecov.io/gh/lucianofronza/IndicadoresAzureRepo)
```

---

## 🔧 Manutenção

### Atualizar Workflows
```bash
# Editar workflow
nano .github/workflows/ci.yml

# Commit e push
git add .github/workflows/ci.yml
git commit -m "ci: atualizar workflow de CI"
git push
```

### Desabilitar Workflow
```bash
# No GitHub:
# Actions > Selecionar workflow > "..." > Disable workflow
```

### Logs e Debugging
```bash
# No GitHub:
# Actions > Selecionar workflow run > Ver logs de cada job
```

---

## 📚 Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Última Atualização**: 2025-09-29  
**Versão**: 1.0  
**Autor**: Equipe de Desenvolvimento
