# GitHub Actions Workflows - Documentação

## Sobre os Warnings de "Context access might be invalid"

Você pode ver warnings do tipo `Context access might be invalid: SECRET_NAME` nos arquivos de workflow.

### Por que esses warnings aparecem?

A extensão GitHub Actions do VSCode valida o acesso aos secrets e exibe um warning quando um secret é referenciado mas pode não estar configurado no repositório.

### Isso é um problema?

**NÃO!** Esses warnings são **esperados e intencionais** para secrets opcionais.

### Secrets Opcionais neste Projeto

Os seguintes secrets são **opcionais** e os workflows funcionam corretamente sem eles:

#### CI/CD Pipeline (`ci.yml`)
- `CODECOV_TOKEN`: Para upload de cobertura de código (opcional)
- `DOCKER_USERNAME`: Para push de imagens Docker (opcional)
- `DOCKER_PASSWORD`: Para push de imagens Docker (opcional)

#### Deploy (`deploy.yml`)
- `AWS_ACCESS_KEY_ID`: Para deploy em AWS (configure se usar AWS)
- `AWS_SECRET_ACCESS_KEY`: Para deploy em AWS (configure se usar AWS)
- `DB_HOST`: Para backup de banco de dados (configure se necessário)
- `DB_USER`: Para backup de banco de dados (configure se necessário)
- `DB_PASSWORD`: Para backup de banco de dados (configure se necessário)
- `SLACK_WEBHOOK_URL`: Para notificações no Slack (opcional)

### Como os Workflows Lidam com Secrets Ausentes?

Os workflows foram projetados para **falhar graciosamente** quando secrets não estão configurados:

1. **`continue-on-error: true`**: Steps com secrets opcionais não falham o workflow
2. **Condicionais**: Verificamos se o secret existe antes de usá-lo (`if: env.SECRET != ''`)
3. **Valores padrão**: Usamos `|| ''` para fornecer valores vazios quando o secret não existe

### Como Suprimir os Warnings?

Se os warnings incomodam, você tem algumas opções:

1. **Configurar os secrets no GitHub** (mesmo com valores placeholder)
2. **Ignorar os warnings** - eles são apenas informativos
3. **Desabilitar a extensão GitHub Actions** do VSCode (não recomendado)

### Configurando Secrets no GitHub

Para configurar secrets no seu repositório:

1. Vá em **Settings** → **Secrets and variables** → **Actions**
2. Clique em **New repository secret**
3. Adicione o nome e valor do secret

## Workflows Disponíveis

- **`ci.yml`**: Pipeline de CI/CD principal
- **`pr-checks.yml`**: Validações em Pull Requests
- **`code-quality.yml`**: Análise de qualidade de código
- **`deploy.yml`**: Deploy automatizado para staging/production

Consulte `.github/README.md` para mais detalhes sobre cada workflow.
