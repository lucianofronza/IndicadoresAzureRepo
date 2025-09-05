# Configuração Azure AD - Microsoft Entra

## 1. Criar App Registration no Azure Portal

1. Acesse [Azure Portal](https://portal.azure.com)
2. Vá para **Azure Active Directory** > **App registrations**
3. Clique em **New registration**
4. Configure:
   - **Name**: `IndicadoresAzureRepo`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `Single-page application (SPA)` - `http://localhost:5173/auth/callback`

## 2. Configurar Permissões

1. Na sua App Registration, vá para **API permissions**
2. Adicione as seguintes permissões:
   - **Microsoft Graph** > **User.Read** (Delegated)
   - **Microsoft Graph** > **User.ReadBasic.All** (Delegated)

## 3. Configurar Autenticação

1. Vá para **Authentication**
2. Configure:
   - **Platform configurations**: SPA
   - **Redirect URIs**: `http://localhost:5173/auth/callback`
   - **Front-channel logout URL**: `http://localhost:5173`
   - **Implicit grant**: Marque **Access tokens** e **ID tokens**

## 4. Obter Credenciais

1. Vá para **Overview** da sua App Registration
2. Copie:
   - **Application (client) ID**
   - **Directory (tenant) ID**

## 5. Configurar Variáveis de Ambiente

### Arquivo Centralizado (.env.docker)
```bash
# Copiar arquivo de exemplo
cp env.docker.example .env.docker
```

Edite o arquivo `.env.docker` com suas credenciais:
```env
# Azure AD Configuration
AZURE_CLIENT_ID="seu-client-id-aqui"
AZURE_CLIENT_SECRET="seu-client-secret-aqui"
AZURE_TENANT_ID="seu-tenant-id-aqui"
AZURE_REDIRECT_URI="http://localhost:5173/auth/callback"

# Frontend Azure AD Configuration
VITE_AZURE_CLIENT_ID="seu-client-id-aqui"
VITE_AZURE_TENANT_ID="seu-tenant-id-aqui"
VITE_AZURE_REDIRECT_URI="http://localhost:5173/auth/callback"

# API Configuration
VITE_API_URL="http://localhost:8080/api"
```

## 6. Instalar Dependências MSAL

### Frontend
```bash
cd frontend
npm install @azure/msal-browser @azure/msal-react
```

### Backend
```bash
cd backend
npm install @azure/msal-node
```

## 7. Testar Configuração

1. Configure as variáveis de ambiente
2. Reinicie os serviços
3. Teste o login com Microsoft Entra
4. Verifique se o usuário é criado com status "pending"
5. Ative o usuário como admin
6. Teste o vínculo com desenvolvedor

## Troubleshooting

- **Erro de redirect URI**: Verifique se a URI está configurada corretamente no Azure
- **Permissões insuficientes**: Adicione as permissões necessárias no Azure Portal
- **CORS**: Configure as URLs permitidas no backend
- **Token inválido**: Verifique se o tenant ID está correto
