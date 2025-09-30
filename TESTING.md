# 🧪 Guia de Testes - Indicadores Azure Repos

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura de Testes](#estrutura-de-testes)
3. [Tipos de Testes](#tipos-de-testes)
4. [Como Executar](#como-executar)
5. [Escrevendo Testes](#escrevendo-testes)
6. [Melhores Práticas](#melhores-práticas)
7. [Cobertura](#cobertura)
8. [CI/CD](#cicd)

---

## 🎯 Visão Geral

Este projeto utiliza uma estratégia de testes em múltiplas camadas para garantir qualidade e confiabilidade do código.

### Stack de Testes

- **Framework**: Jest 29+
- **Assertions**: Jest Matchers
- **Mocks**: Jest Mock Functions
- **HTTP Testing**: Supertest
- **Coverage**: Istanbul (integrado ao Jest)

### Estatísticas Atuais

```
✅ Testes Unitários:      33 testes (100% passando)
⚠️  Testes de Integração:  8 testes (estrutura criada)
⚠️  Testes de Middleware:  10 testes (50% passando)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL:                51 testes
```

---

## 📁 Estrutura de Testes

```
backend/
├── src/
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── services/
│   │   │   │   ├── authService.test.ts       ✅ 13 testes
│   │   │   │   ├── syncService.test.ts       ✅ 7 testes
│   │   │   │   └── repositoryService.test.ts ✅ 13 testes
│   │   │   └── middlewares/
│   │   │       └── auth.test.ts              ⚠️ 10 testes (5/10)
│   │   ├── integration/
│   │   │   ├── auth.test.ts                  ⚠️ 6 testes
│   │   │   └── sync.test.ts                  ⚠️ 2 testes
│   │   └── setup.ts                          # Configuração global
│   └── ...
├── jest.config.js                             # Configuração Jest
└── package.json
```

---

## 🧪 Tipos de Testes

### 1. Testes Unitários

**Objetivo**: Testar unidades individuais de código (funções, métodos) de forma isolada.

**Características:**
- ✅ Rápidos (< 1s cada)
- ✅ Isolados (sem dependências externas)
- ✅ Determinísticos (mesmo resultado sempre)
- ✅ Usam mocks para dependências

**Exemplo:**

```typescript
// src/tests/unit/services/authService.test.ts
import { AuthService } from '@/services/authService';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock de dependências
jest.mock('@prisma/client');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('register', () => {
    it('deve criar um novo usuário com sucesso', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        login: 'testuser',
        password: 'Password123!',
        roleId: 'user-role-id',
      };

      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id-123',
        ...userData,
        password: 'hashed_password',
      });

      const result = await authService.register(userData);

      expect(result).toHaveProperty('id', 'user-id-123');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('deve lançar erro se email já existir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ /* existing user */ });

      await expect(authService.register(userData))
        .rejects.toThrow('EMAIL_ALREADY_EXISTS');
    });
  });
});
```

### 2. Testes de Integração

**Objetivo**: Testar a integração entre componentes (rotas, middlewares, serviços).

**Características:**
- ⏱️ Mais lentos (1-5s cada)
- 🔗 Testam fluxos completos
- 🎭 Usam mocks parciais
- 🌐 Fazem requisições HTTP reais (Supertest)

**Exemplo:**

```typescript
// src/tests/integration/auth.test.ts
import request from 'supertest';
import app from '@/app';
import { AuthService } from '@/services/authService';

// Mock apenas do serviço, não das rotas/middlewares
jest.mock('@/services/authService');

describe('Auth Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('deve registrar um novo usuário com sucesso', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        login: 'testuser',
        password: 'Password123!',
        roleId: 'user-role-id',
      };

      (AuthService.prototype.register as jest.Mock).mockResolvedValue({
        id: 'user-id-123',
        ...userData,
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
    });

    it('deve retornar 400 para dados inválidos', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'T', // Muito curto
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });
});
```

### 3. Testes de Middleware

**Objetivo**: Testar lógica de middlewares (auth, permissions, error handling).

**Características:**
- ⚡ Rápidos
- 🎯 Focados em lógica específica
- 🧩 Testam em isolamento

**Exemplo:**

```typescript
// src/tests/unit/middlewares/auth.test.ts
import { Request, Response, NextFunction } from 'express';
import { requireAuth } from '@/middlewares/auth';
import { AuthService } from '@/services/authService';

jest.mock('@/services/authService');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = { headers: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('requireAuth', () => {
    it('deve permitir acesso com token válido', async () => {
      mockRequest.headers = { authorization: 'Bearer valid_token' };
      
      AuthService.prototype.verifyToken = jest.fn().mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
      });

      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
    });

    it('deve retornar 401 sem token', async () => {
      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
```

---

## ▶️ Como Executar

### Executar Todos os Testes

```bash
cd backend
npm test
```

### Executar Testes Específicos

```bash
# Por arquivo
npm test -- authService.test.ts

# Por padrão
npm test -- --testPathPattern=services

# Por describe/it
npm test -- --testNamePattern="deve criar usuário"
```

### Modo Watch (Desenvolvimento)

```bash
npm test -- --watch
```

### Cobertura de Código

```bash
npm test -- --coverage
```

### Executar com Verbose

```bash
npm test -- --verbose
```

---

## ✍️ Escrevendo Testes

### Estrutura AAA (Arrange-Act-Assert)

```typescript
it('deve retornar usuário por ID', async () => {
  // 1. ARRANGE: Preparar dados e mocks
  const userId = 'user-123';
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId,
    name: 'Test User',
    email: 'test@example.com',
  });

  // 2. ACT: Executar a ação
  const result = await userService.getById(userId);

  // 3. ASSERT: Verificar resultado
  expect(result).toHaveProperty('id', userId);
  expect(result).toHaveProperty('name', 'Test User');
  expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
    where: { id: userId },
  });
});
```

### Mocking com Jest

#### 1. Mock de Módulos

```typescript
// Mock completo do módulo
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  })),
}));
```

#### 2. Mock de Funções

```typescript
// Mock de função específica
const mockEncrypt = jest.fn((value) => `encrypted_${value}`);
jest.mock('@/utils/encryption', () => ({
  encrypt: mockEncrypt,
  decrypt: jest.fn((value) => value.replace('encrypted_', '')),
}));
```

#### 3. Mock de Implementações

```typescript
mockPrisma.user.findUnique.mockImplementation((args) => {
  if (args.where.id === 'user-123') {
    return Promise.resolve({ id: 'user-123', name: 'User' });
  }
  return Promise.resolve(null);
});
```

#### 4. Mock Parcial

```typescript
jest.mock('@/services/authService', () => ({
  ...jest.requireActual('@/services/authService'),
  verifyToken: jest.fn(), // Só mocka esta função
}));
```

### Testando Erros

```typescript
it('deve lançar erro se usuário não existir', async () => {
  mockPrisma.user.findUnique.mockResolvedValue(null);

  await expect(userService.getById('invalid-id'))
    .rejects.toThrow(NotFoundError);
  
  await expect(userService.getById('invalid-id'))
    .rejects.toThrow('User not found');
});
```

### Testando Código Assíncrono

```typescript
// Com async/await
it('deve retornar dados', async () => {
  const result = await asyncFunction();
  expect(result).toBe('data');
});

// Com Promises
it('deve retornar dados', () => {
  return asyncFunction().then(result => {
    expect(result).toBe('data');
  });
});

// Com resolves/rejects
it('deve resolver com dados', async () => {
  await expect(asyncFunction()).resolves.toBe('data');
});

it('deve rejeitar com erro', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error');
});
```

### Testando Timers

```typescript
it('deve executar após timeout', () => {
  jest.useFakeTimers();
  
  const callback = jest.fn();
  setTimeout(callback, 1000);
  
  expect(callback).not.toHaveBeenCalled();
  
  jest.advanceTimersByTime(1000);
  
  expect(callback).toHaveBeenCalled();
  
  jest.useRealTimers();
});
```

---

## 📏 Melhores Práticas

### ✅ DO (Faça)

1. **Nomes Descritivos**
   ```typescript
   ✅ it('deve retornar 401 quando token está ausente', ...)
   ❌ it('test auth', ...)
   ```

2. **Um Assertion por Conceito**
   ```typescript
   ✅ 
   it('deve criar usuário com dados corretos', ...)
   it('deve hash da senha', ...)
   
   ❌
   it('deve criar usuário e fazer hash da senha e enviar email', ...)
   ```

3. **Isolar Testes**
   ```typescript
   ✅ beforeEach(() => jest.clearAllMocks())
   ❌ Deixar estado compartilhado entre testes
   ```

4. **Testar Casos de Erro**
   ```typescript
   ✅ 
   it('deve retornar usuário quando ID existe', ...)
   it('deve lançar erro quando ID não existe', ...)
   ```

5. **Usar Mocks para Dependências**
   ```typescript
   ✅ jest.mock('@prisma/client')
   ❌ Usar banco de dados real em testes unitários
   ```

### ❌ DON'T (Não Faça)

1. **Não Teste Implementação**
   ```typescript
   ❌ expect(myFunction.callCount).toBe(1) // Detalhe de implementação
   ✅ expect(result).toBe(expectedValue)    // Comportamento
   ```

2. **Não Ignore Testes Falhando**
   ```typescript
   ❌ it.skip('test that fails', ...)
   ✅ Corrija ou remova o teste
   ```

3. **Não Use Dados Reais/Sensíveis**
   ```typescript
   ❌ password: 'myRealPassword123'
   ✅ password: 'Test123!@#'
   ```

4. **Não Teste Código de Terceiros**
   ```typescript
   ❌ Testar se bcrypt.hash funciona
   ✅ Testar se SEU código chama bcrypt.hash corretamente
   ```

---

## 📊 Cobertura

### Executar Relatório

```bash
npm test -- --coverage
```

### Saída Esperada

```
------------------|---------|----------|---------|---------|
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
All files         |   78.5  |   65.3   |   82.1  |   77.9  |
 services/        |   85.2  |   72.4   |   90.5  |   84.8  |
  authService.ts  |   92.1  |   80.5   |   95.0  |   91.7  |
  syncService.ts  |   88.3  |   75.2   |   92.0  |   87.9  |
 middlewares/     |   70.5  |   58.1   |   75.0  |   69.8  |
  auth.ts         |   75.2  |   62.5   |   80.0  |   74.5  |
------------------|---------|----------|---------|---------|
```

### Metas de Cobertura

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};
```

### Visualizar HTML

```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```

---

## 🚀 CI/CD

### GitHub Actions (Planejado)

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
```

### Pre-commit Hook (Husky)

```bash
# Instalar Husky
npm install --save-dev husky

# Configurar pre-commit
npx husky install
npx husky add .husky/pre-commit "cd backend && npm test"
```

---

## 🐛 Debugging Testes

### Executar com Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### VSCode Debug Configuration

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Logs em Testes

```typescript
// Desabilitar logs durante testes
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Ou verificar se foi logado
it('deve logar erro', () => {
  const consoleSpy = jest.spyOn(console, 'error');
  
  myFunction();
  
  expect(consoleSpy).toHaveBeenCalledWith('Error message');
});
```

---

## 📚 Recursos Adicionais

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing TypeScript](https://jestjs.io/docs/getting-started#using-typescript)

---

## 🔄 Próximos Passos

### Expansão de Testes

- [ ] Completar testes de integração (auth + sync)
- [ ] Testes de middleware (permissions, errorHandler)
- [ ] Testes de endpoints (repositories, kpis)
- [ ] Testes E2E com Cypress/Playwright

### Melhoria de Cobertura

- [ ] Atingir 80%+ de cobertura em services
- [ ] Atingir 70%+ de cobertura em middlewares
- [ ] Atingir 60%+ de cobertura em routes

### Automação

- [ ] Configurar GitHub Actions
- [ ] Configurar Codecov para relatórios
- [ ] Adicionar badge de cobertura no README
- [ ] Configurar Husky para pre-commit hooks

---

**Última Atualização**: 2025-09-29  
**Versão**: 1.0  
**Autor**: Equipe de Desenvolvimento
