import React, { useEffect } from 'react';
import api from '../services/api';

export const AuthCallback: React.FC = () => {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        console.log('AuthCallback: URL params:', { code: !!code, state: !!state, error, errorDescription });

        // Handle error from Azure AD
        if (error) {
          console.error('Azure AD error:', error, errorDescription);
          window.opener?.postMessage({
            type: 'AZURE_AD_ERROR',
            error: errorDescription || error
          }, window.location.origin);
          window.close();
          return;
        }

        // Validate state parameter
        const storedState = sessionStorage.getItem('azure-ad-state');
        const codeVerifier = sessionStorage.getItem('azure-ad-code-verifier');
        console.log('AuthCallback: Validation params:', { 
          hasCode: !!code, 
          hasState: !!state, 
          hasStoredState: !!storedState, 
          hasCodeVerifier: !!codeVerifier,
          stateMatch: state === storedState
        });
        if (!code || !state || state !== storedState || !codeVerifier) {
          console.error('AuthCallback: Invalid parameters');
          throw new Error('Invalid callback parameters');
        }

        // Send authorization code to backend with PKCE
        console.log('AuthCallback: Sending request to backend...');
        console.log('AuthCallback: Request URL:', '/auth/azure-ad-callback');
        console.log('AuthCallback: Request data:', { code, redirectUri: window.location.origin + '/auth/callback', codeVerifier });
        const response = await api.post('/auth/azure-ad-callback', {
          code,
          redirectUri: window.location.origin + '/auth/callback',
          codeVerifier
        });

        console.log('AuthCallback: Backend response:', response.data);

        // Send success message to parent window
        window.opener?.postMessage({
          type: 'AZURE_AD_SUCCESS',
          userData: response.data
        }, window.location.origin);
        window.close();

      } catch (error: any) {
        console.error('AuthCallback error:', error);
        window.opener?.postMessage({
          type: 'AZURE_AD_ERROR',
          error: error.message || 'Erro no callback do Azure AD'
        }, window.location.origin);
        window.close();
      }
    };

    handleCallback();
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Processando login...</h2>
        <p>Por favor, aguarde enquanto processamos sua autenticação.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
