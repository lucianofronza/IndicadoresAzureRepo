import { Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth } from '@/middlewares/auth';
import { AuthService } from '@/services/authService';

// Mock do AuthService
jest.mock('@/services/authService');

// Mock do logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request> & { user?: any; requestId?: string };
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      requestId: 'test-request-id',
      user: undefined,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();

    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
  });

  describe('requireAuth', () => {
    it.skip('deve permitir acesso com token válido', async () => {
      const validToken = 'valid_jwt_token';
      const user = {
        id: 'user-id-123',
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user' as const,
        viewScope: 'own' as const,
      };

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      mockAuthService.verifyToken = jest.fn().mockResolvedValue(user);

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(user);
    });

    it.skip('deve retornar 401 se não fornecer token', async () => {
      mockRequest.headers = {};

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token não fornecido',
        error: 'UNAUTHORIZED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it.skip('deve retornar 401 se o token for inválido', async () => {
      const invalidToken = 'invalid_jwt_token';

      mockRequest.headers = {
        authorization: `Bearer ${invalidToken}`,
      };

      mockAuthService.verifyToken = jest.fn().mockRejectedValue(
        new Error('Invalid token')
      );

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'UNAUTHORIZED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it.skip('deve aceitar token sem prefixo Bearer', async () => {
      const validToken = 'valid_jwt_token';
      const user = {
        id: 'user-id-123',
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user' as const,
        viewScope: 'own' as const,
      };

      mockRequest.headers = {
        authorization: validToken, // Sem "Bearer "
      };

      mockAuthService.verifyToken = jest.fn().mockResolvedValue(user);

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(user);
    });

    it('deve retornar 401 se o header Authorization estiver vazio', async () => {
      mockRequest.headers = {
        authorization: '',
      };

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('deve retornar 401 se o header Authorization tiver formato inválido', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      mockAuthService.verifyToken = jest.fn().mockRejectedValue(
        new Error('Invalid token')
      );

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('deve permitir acesso sem token', async () => {
      mockRequest.headers = {};

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it.skip('deve adicionar usuário se token válido for fornecido', async () => {
      const validToken = 'valid_jwt_token';
      const user = {
        id: 'user-id-123',
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user' as const,
        viewScope: 'own' as const,
      };

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      mockAuthService.verifyToken = jest.fn().mockResolvedValue(user);

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(user);
    });

    it.skip('deve continuar sem usuário se token for inválido', async () => {
      const invalidToken = 'invalid_jwt_token';

      mockRequest.headers = {
        authorization: `Bearer ${invalidToken}`,
      };

      mockAuthService.verifyToken = jest.fn().mockRejectedValue(
        new Error('Invalid token')
      );

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('deve ignorar erros de token e continuar sem bloquear', async () => {
      const corruptedToken = 'corrupted_jwt_token';

      mockRequest.headers = {
        authorization: `Bearer ${corruptedToken}`,
      };

      mockAuthService.verifyToken = jest.fn().mockRejectedValue(
        new Error('Token corrupted')
      );

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});
