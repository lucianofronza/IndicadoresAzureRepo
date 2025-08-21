import { AuthService } from '@/services/authService';
import { prisma } from '@/config/database';
import { NotFoundError, UnauthorizedError } from '@/middlewares/errorHandler';
import jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('@/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userToken: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock axios
jest.mock('axios');
const axios = require('axios');

// Mock encryption
jest.mock('@/utils/encryption', () => ({
  encrypt: jest.fn((text: string) => `encrypted_${text}`),
  decrypt: jest.fn((text: string) => text.replace('encrypted_', '')),
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should return correct authorization URL', () => {
      const state = 'test-state';
      const redirectUri = 'http://localhost:5173/callback';

      const url = authService.getAuthorizationUrl(state, redirectUri);

      expect(url).toContain('https://app.vssps.visualstudio.com/oauth2/authorize');
      expect(url).toContain('client_id=');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=vso.code%20vso.work%20vso.profile');
      expect(url).toContain('state=test-state');
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback successfully', async () => {
      const code = 'test-code';
      const state = 'test-state';
      const mockTokenResponse = {
        data: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        },
      };
      const mockUserInfo = {
        data: {
          id: 'user-id',
          displayName: 'John Doe',
          publicAlias: 'johndoe',
          emailAddress: 'john@example.com',
        },
      };

      axios.post.mockResolvedValue(mockTokenResponse);
      axios.get.mockResolvedValue(mockUserInfo);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-id',
        azureId: 'user-id',
        name: 'John Doe',
        email: 'john@example.com',
        login: 'johndoe',
      });
      (prisma.userToken.upsert as jest.Mock).mockResolvedValue({});

      const result = await authService.handleCallback(code, state);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('userId');
      expect(axios.post).toHaveBeenCalledWith(
        'https://app.vssps.visualstudio.com/oauth2/token',
        expect.any(URLSearchParams),
        expect.any(Object)
      );
    });

    it('should throw UnauthorizedError on callback failure', async () => {
      const code = 'invalid-code';
      const state = 'test-state';

      axios.post.mockRejectedValue(new Error('Invalid code'));

      await expect(authService.handleCallback(code, state)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'refresh-token';
      const userId = 'user-id';
      const mockTokenResponse = {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
      };

      (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-id',
        refreshToken: 'encrypted_refresh-token',
        user: {
          id: 'user-id',
          azureId: 'azure-id',
          name: 'John Doe',
          email: 'john@example.com',
        },
      });

      axios.post.mockResolvedValue(mockTokenResponse);
      (prisma.userToken.update as jest.Mock).mockResolvedValue({});

      const result = await authService.refreshToken(refreshToken, userId);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('userId');
    });

    it('should throw NotFoundError when user token not found', async () => {
      const refreshToken = 'refresh-token';
      const userId = 'user-id';

      (prisma.userToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken, userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      const accessToken = 'access-token';
      const userId = 'user-id';

      (prisma.userToken.delete as jest.Mock).mockResolvedValue({});

      await authService.revokeToken(accessToken, userId);

      expect(prisma.userToken.delete).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('getUserInfo', () => {
    it('should get user info successfully', async () => {
      const token = 'access-token';
      const mockUserInfo = {
        data: {
          id: 'user-id',
          displayName: 'John Doe',
          publicAlias: 'johndoe',
          emailAddress: 'john@example.com',
        },
      };

      axios.get.mockResolvedValue(mockUserInfo);

      const result = await authService.getUserInfo(token);

      expect(result).toEqual({
        id: 'user-id',
        displayName: 'John Doe',
        uniqueName: 'johndoe',
        emailAddress: 'john@example.com',
      });
      expect(axios.get).toHaveBeenCalledWith(
        'https://app.vssps.visualstudio.com/_apis/profile/profiles/me',
        expect.any(Object)
      );
    });

    it('should throw UnauthorizedError on API failure', async () => {
      const token = 'invalid-token';

      axios.get.mockRejectedValue(new Error('Unauthorized'));

      await expect(authService.getUserInfo(token)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const token = 'valid-token';
      const mockUser = { id: 'user-id' };

      jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 'user-id' } as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.validateToken(token);

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const token = 'invalid-token';

      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.validateToken(token);

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      const token = 'valid-token';

      jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 'user-id' } as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await authService.validateToken(token);

      expect(result).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const token = 'valid-token';
      const mockUser = {
        id: 'user-id',
        name: 'John Doe',
        email: 'john@example.com',
        login: 'johndoe',
        azureId: 'azure-id',
        createdAt: new Date(),
      };

      jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 'user-id' } as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(token);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedError for invalid token', async () => {
      const token = 'invalid-token';

      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.getCurrentUser(token)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw NotFoundError when user not found', async () => {
      const token = 'valid-token';

      jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 'user-id' } as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.getCurrentUser(token)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAzureAccessToken', () => {
    it('should get Azure access token successfully', async () => {
      const userId = 'user-id';
      const mockUserToken = {
        userId: 'user-id',
        accessToken: 'encrypted_access-token',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      (prisma.userToken.findUnique as jest.Mock).mockResolvedValue(mockUserToken);

      const result = await authService.getAzureAccessToken(userId);

      expect(result).toBe('access-token');
    });

    it('should refresh token when expired', async () => {
      const userId = 'user-id';
      const mockUserToken = {
        userId: 'user-id',
        accessToken: 'encrypted_access-token',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      (prisma.userToken.findUnique as jest.Mock).mockResolvedValue(mockUserToken);

      // Mock the refreshToken method
      const refreshSpy = jest.spyOn(authService, 'refreshToken').mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
        userId: 'user-id',
      });

      const result = await authService.getAzureAccessToken(userId);

      expect(refreshSpy).toHaveBeenCalledWith('', userId);
      expect(result).toBe('new-access-token');
    });

    it('should throw NotFoundError when user token not found', async () => {
      const userId = 'user-id';

      (prisma.userToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.getAzureAccessToken(userId)).rejects.toThrow(NotFoundError);
    });
  });
});
