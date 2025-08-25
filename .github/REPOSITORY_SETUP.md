# 🚀 Configuração do Repositório GitHub

## 📋 Checklist de Configuração

### 🔐 Segurança
- [ ] **2FA habilitado** para todos os usuários
- [ ] **Personal Access Tokens** configurados com escopo mínimo
- [ ] **Secrets** configurados para CI/CD
- [ ] **Branch protection** habilitado para main e develop
- [ ] **Code review** obrigatório para PRs

### 🏷️ Labels
- [ ] **bug** - Problemas e bugs
- [ ] **enhancement** - Melhorias e novas funcionalidades
- [ ] **documentation** - Documentação
- [ ] **good first issue** - Boas para iniciantes
- [ ] **help wanted** - Precisa de ajuda
- [ ] **priority: high** - Alta prioridade
- [ ] **priority: medium** - Média prioridade
- [ ] **priority: low** - Baixa prioridade
- [ ] **status: in progress** - Em desenvolvimento
- [ ] **status: blocked** - Bloqueado
- [ ] **type: frontend** - Mudanças no frontend
- [ ] **type: backend** - Mudanças no backend
- [ ] **type: infrastructure** - Mudanças na infraestrutura

### 📁 Milestones
- [ ] **v1.0.0** - Versão inicial
- [ ] **v1.1.0** - Melhorias e correções
- [ ] **v1.2.0** - Novas funcionalidades
- [ ] **Backlog** - Funcionalidades futuras

### 🔧 Integrações
- [ ] **Dependabot** configurado
- [ ] **CodeQL** habilitado para análise de segurança
- [ ] **GitHub Actions** configurados
- [ ] **Container Registry** configurado
- [ ] **Environments** configurados (staging, production)

### 📊 Insights
- [ ] **Dependency graph** habilitado
- [ ] **Security advisories** habilitado
- [ ] **Code scanning** configurado
- [ ] **Secret scanning** habilitado

## 🚨 Secrets Necessários

### CI/CD
- `KUBE_CONFIG_STAGING` - Configuração do Kubernetes para staging
- `KUBE_CONFIG_PRODUCTION` - Configuração do Kubernetes para produção
- `DOCKER_REGISTRY_TOKEN` - Token para Container Registry

### Azure DevOps
- `AZURE_DEVOPS_TOKEN` - Personal Access Token do Azure DevOps
- `AZURE_DEVOPS_ORG` - Organização do Azure DevOps

## 🔍 Verificações de Status

### Obrigatórias para Main
- ✅ Backend tests pass
- ✅ Frontend tests pass
- ✅ Security scan pass
- ✅ Build images pass

### Obrigatórias para Develop
- ✅ Backend tests pass
- ✅ Frontend tests pass
- ✅ Security scan pass

## 📝 Notas Importantes

- **Main branch**: Sempre protegida, merge apenas via PR
- **Develop branch**: Protegida, merge apenas via PR
- **Feature branches**: Criadas a partir de develop
- **Hotfix branches**: Criadas a partir de main para correções urgentes
- **Releases**: Tagadas com versionamento semântico
