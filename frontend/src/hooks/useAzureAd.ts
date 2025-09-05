import { useMsal } from '@azure/msal-react';
import { loginRequest, graphConfig } from '../config/msalConfig';

export const useAzureAd = () => {
  const { instance, accounts } = useMsal();

  const loginWithAzureAd = async () => {
    try {
      const response = await instance.loginPopup(loginRequest);
      
      if (response.account) {
        // Use the account info directly from the login response
        // This avoids the need for acquireTokenSilent which requires SPA configuration
        return {
          azureAdId: response.account.localAccountId || response.account.homeAccountId,
          email: response.account.username,
          name: response.account.name || response.account.username,
          azureAdEmail: response.account.username,
        };
      }
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
