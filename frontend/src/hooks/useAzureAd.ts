import api from '../services/api';

export const useAzureAd = () => {

  const loginWithAzureAd = async () => {
    try {
      // Generate a random state parameter for security
      const state = Math.random().toString(36).substring(2, 15);
      
      // Generate PKCE code verifier and challenge
      const codeVerifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const codeChallenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
        .then(hash => btoa(String.fromCharCode(...new Uint8Array(hash))))
        .then(base64 => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''));
      
      // Store PKCE parameters
      sessionStorage.setItem('azure-ad-state', state);
      sessionStorage.setItem('azure-ad-code-verifier', codeVerifier);
      
      // Build the Azure AD authorization URL with PKCE
      const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
      const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
      const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
      const scope = encodeURIComponent('openid profile email');
      
      const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scope}&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256&` +
        `response_mode=query`;
      
      console.log('Opening Azure AD popup with URL:', authUrl);
      
      // Open popup window for Azure AD login
      const popup = window.open(
        authUrl,
        'azure-ad-login',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        throw new Error('Popup bloqueado pelo navegador. Permita popups para este site.');
      }
      
      // Wait for popup to close or receive message
      return new Promise((resolve, reject) => {
        let resolved = false;
        let checkClosed: NodeJS.Timeout | null = null;
        
        const messageListener = (event: MessageEvent) => {
          console.log('Message received:', event.data, 'from origin:', event.origin);
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'AZURE_AD_SUCCESS') {
            console.log('Azure AD success message received');
            resolved = true;
            if (checkClosed) clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            popup.close();
            resolve(event.data.userData);
          } else if (event.data.type === 'AZURE_AD_ERROR') {
            console.log('Azure AD error message received:', event.data.error);
            resolved = true;
            if (checkClosed) clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            popup.close();
            reject(new Error(event.data.error));
          }
        };
        
        window.addEventListener('message', messageListener);
        
        // Check if popup was closed manually (with delay to avoid false positives)
        setTimeout(() => {
          console.log('Starting popup closed check...');
          checkClosed = setInterval(() => {
            if (popup.closed && !resolved) {
              console.log('Popup was closed by user');
              clearInterval(checkClosed!);
              window.removeEventListener('message', messageListener);
              reject(new Error('Login cancelado pelo usuário'));
            }
          }, 1000);
        }, 5000); // Increased delay to 5 seconds
        
        // Timeout after 10 minutes
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (checkClosed) clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            popup.close();
            reject(new Error('Timeout no login Azure AD'));
          }
        }, 600000); // 10 minutes
      });
    } catch (error) {
      console.error('Azure AD login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear any stored Azure AD data
      sessionStorage.removeItem('azure-ad-state');
      sessionStorage.removeItem('azure-ad-code-verifier');
      
      // Para evitar logout global da Microsoft, vamos apenas limpar os dados locais
      // e redirecionar para a página de login, sem fazer logout do Azure AD
      // Isso preserva a sessão SSO para outras aplicações
      console.log('Azure AD logout: Limpando dados locais apenas');
      
    } catch (error) {
      console.error('Azure AD logout error:', error);
    }
  };

  return {
    loginWithAzureAd,
    logout,
    accounts: [], // Não usamos mais MSAL accounts
    isAuthenticated: false, // Será determinado pelo AuthProvider
  };
};
