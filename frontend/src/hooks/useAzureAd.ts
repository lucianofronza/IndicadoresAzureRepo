import { useMsal } from '@azure/msal-react';
import { loginRequest, graphConfig } from '../config/msalConfig';
import { PublicClientApplication } from '@azure/msal-browser';

export const useAzureAd = () => {
  const { instance, accounts } = useMsal();

  const loginWithAzureAd = async () => {
    try {
      const response = await instance.loginPopup(loginRequest);
      
      if (response.account) {
        // Get user info from Microsoft Graph
        const graphResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account: response.account,
        });

        const userInfoResponse = await fetch(graphConfig.graphMeEndpoint, {
          headers: {
            Authorization: `Bearer ${graphResponse.accessToken}`,
          },
        });

        const userInfo = await userInfoResponse.json();

        return {
          azureAdId: userInfo.id,
          email: userInfo.mail || userInfo.userPrincipalName,
          name: userInfo.displayName,
          azureAdEmail: userInfo.userPrincipalName,
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
