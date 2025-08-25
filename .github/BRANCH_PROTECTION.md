# 🛡️ Branch Protection Rules

## 📋 Configurações Recomendadas

### Main Branch
- ✅ **Require a pull request before merging**
- ✅ **Require approvals**: 1 (ou mais conforme necessário)
- ✅ **Dismiss stale PR approvals when new commits are pushed**
- ✅ **Require status checks to pass before merging**
  - Backend tests
  - Frontend tests
  - Security scan
  - Build check
- ✅ **Require branches to be up to date before merging**
- ✅ **Include administrators**
- ✅ **Restrict pushes that create files**
- ✅ **Restrict deletions**

### Develop Branch
- ✅ **Require a pull request before merging**
- ✅ **Require approvals**: 1
- ✅ **Require status checks to pass before merging**
  - Backend tests
  - Frontend tests
  - Security scan
- ✅ **Require branches to be up to date before merging**
- ✅ **Include administrators**

### Feature Branches
- ✅ **Require a pull request before merging**
- ✅ **Require approvals**: 1
- ✅ **Require status checks to pass before merging**
  - Backend tests
  - Frontend tests

## 🔧 Como Configurar

1. Vá para **Settings** > **Branches**
2. Clique em **Add rule**
3. Configure conforme as regras acima
4. Salve as configurações

## 🚨 Status Checks Obrigatórios

- `backend-test` - Testes do backend
- `frontend-test` - Testes do frontend  
- `security-scan` - Verificação de segurança
- `build-images` - Build das imagens Docker (apenas para main)

## 📝 Notas Importantes

- **Main**: Branch de produção, sempre deve estar estável
- **Develop**: Branch de desenvolvimento, deve estar funcional
- **Feature**: Branches temporárias para desenvolvimento
- **Hotfix**: Branches para correções urgentes em produção
