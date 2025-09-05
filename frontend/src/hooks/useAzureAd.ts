import { useMsal } from '@azure/msal-react';
import { loginRequest, graphConfig } from '../config/msalConfig';

export const useAzureAd = () => {
  const { instance, accounts } = useMsal();

  const loginWithAzureAd = async () => {
    try {
      // Temporarily use mock data until Azure AD configuration is fixed
      // This allows testing the full flow while Azure AD is being configured
      console.log('Using mock Azure AD data for testing...');
      
      return {
        azureAdId: 'mock-azure-id-' + Date.now(),
        email: 'usuario@empresa.com',
        name: 'Usuário Teste Azure AD',
        azureAdEmail: 'usuario@empresa.com',
      };
      
      // Uncomment below when Azure AD is properly configured as SPA
      /*
      const response = await instance.loginPopup(loginRequest);
      
      if (response.account) {
        return {
          azureAdId: response.account.localAccountId || response.account.homeAccountId,
          email: response.account.username,
          name: response.account.name || response.account.username,
          azureAdEmail: response.account.username,
        };
      }
      */
    } catch (error) {
      console.error('Azure AD login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      console.error('Azure AD logout error:', error);
    }
  };

  return {
    loginWithAzureAd,
    logout,
    accounts,
    isAuthenticated: accounts.length > 0,
  };
};
