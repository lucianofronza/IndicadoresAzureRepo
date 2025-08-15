# Scripts de Redistribuição de Desenvolvedores

Este diretório contém scripts para testar o comportamento dos gráficos redistribuindo desenvolvedores sem time para times existentes.

## Scripts Disponíveis

### 1. `show-developer-stats.ts`
Mostra estatísticas atuais dos desenvolvedores e times antes de fazer qualquer mudança.

**Uso:**
```bash
cd backend
npx tsx scripts/show-developer-stats.ts
```

**O que mostra:**
- Estatísticas gerais de desenvolvedores
- Distribuição de PRs por time
- Top 10 desenvolvedores sem time
- Estatísticas de arquivos alterados
- Arquivos alterados por time

### 2. `redistribute-developers.ts`
Redistribui aleatoriamente todos os desenvolvedores sem time para times existentes.

**Uso:**
```bash
cd backend
npx tsx scripts/redistribute-developers.ts
```

**O que faz:**
- Busca todos os times existentes
- Busca todos os desenvolvedores sem time
- Distribui aleatoriamente os desenvolvedores entre os times
- Mostra estatísticas antes e depois da redistribuição

### 3. `revert-developer-redistribution.ts`
Reverte a redistribuição, removendo o time de todos os desenvolvedores.

**Uso:**
```bash
cd backend
npx tsx scripts/revert-developer-redistribution.ts
```

**O que faz:**
- Remove o time de todos os desenvolvedores
- Mostra estatísticas após a reversão

## Fluxo Recomendado para Teste

1. **Verificar situação atual:**
   ```bash
   npx tsx scripts/show-developer-stats.ts
   ```

2. **Redistribuir desenvolvedores:**
   ```bash
   npx tsx scripts/redistribute-developers.ts
   ```

3. **Testar o gráfico no frontend:**
   - Acesse o dashboard
   - Verifique como o gráfico "Arquivos alterados por Pull Request" se comporta
   - Compare com o comportamento anterior

4. **Reverter se necessário:**
   ```bash
   npx tsx scripts/revert-developer-redistribution.ts
   ```

## Objetivo

O objetivo é testar como o gráfico se comporta quando:
- A quantidade de PRs está distribuída de forma mais equilibrada entre os times
- Não há uma concentração muito alta de PRs em "Sem time informado"
- Os dados são mais realistas para análise

## Observações

- Os scripts são seguros e podem ser executados múltiplas vezes
- O script de reversão restaura o estado original
- Todos os scripts mostram logs detalhados do que está sendo feito
- Os dados são preservados, apenas o relacionamento `teamId` é alterado

## Estrutura dos Dados

Os scripts trabalham com:
- **Developer**: `id`, `name`, `login`, `teamId`
- **Team**: `id`, `name`
- **PullRequest**: relacionado com `createdById` (Developer)

A redistribuição afeta apenas o campo `teamId` dos desenvolvedores, mantendo todos os outros dados intactos.
