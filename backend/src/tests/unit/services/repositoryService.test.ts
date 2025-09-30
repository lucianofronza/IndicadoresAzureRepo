import { RepositoryService } from '@/services/repositoryService';
import { prisma } from '@/config/database';
import { encrypt, decrypt } from '@/utils/encryption';

// Mock do Prisma
jest.mock('@/config/database', () => ({
  prisma: {
    repository: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock das funções de criptografia
jest.mock('@/utils/encryption');

// Mock do logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('RepositoryService', () => {
  let repositoryService: RepositoryService;
  const mockEncrypt = encrypt as jest.MockedFunction<typeof encrypt>;
  const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Restaurar implementação padrão dos mocks de criptografia
    mockEncrypt.mockImplementation((value: string) => `encrypted_${value}`);
    mockDecrypt.mockImplementation((value: string) => value.replace('encrypted_', ''));
    
    repositoryService = new RepositoryService();
  });

  describe('getAll', () => {
    it('deve retornar lista paginada de repositórios com tokens descriptografados', async () => {
      const params = {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc' as const,
      };

      const repositories = [
        {
          id: 'repo-1',
          name: 'Repo 1',
          organization: 'org1',
          project: 'project1',
          personalAccessToken: 'encrypted_token123',
          team: { id: 'team-1', name: 'Team 1' },
          _count: { pullRequests: 5 },
        },
        {
          id: 'repo-2',
          name: 'Repo 2',
          organization: 'org2',
          project: 'project2',
          personalAccessToken: null,
          team: null,
          _count: { pullRequests: 3 },
        },
      ];

      const total = 2;

      // Mock: Buscar repositórios
      (prisma.repository.findMany as jest.Mock).mockResolvedValue(repositories);
      
      // Mock: Contar total
      (prisma.repository.count as jest.Mock).mockResolvedValue(total);

      const result = await repositoryService.getAll(params);

      // Verificações
      expect(prisma.repository.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { name: 'asc' },
        include: {
          team: true,
          _count: {
            select: { pullRequests: true },
          },
        },
      });

      expect(prisma.repository.count).toHaveBeenCalled();
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted_token123');
      
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'repo-1',
            personalAccessToken: 'token123', // Descriptografado
          }),
          expect.objectContaining({
            id: 'repo-2',
            personalAccessToken: null,
          }),
        ]),
        pagination: {
          page: 1,
          pageSize: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it('deve lidar com erro ao descriptografar token', async () => {
      const params = {
        page: 1,
        pageSize: 10,
      };

      const repositories = [
        {
          id: 'repo-1',
          name: 'Repo 1',
          personalAccessToken: 'corrupted_token',
          _count: { pullRequests: 0 },
        },
      ];

      // Mock: Buscar repositórios
      (prisma.repository.findMany as jest.Mock).mockResolvedValue(repositories);
      (prisma.repository.count as jest.Mock).mockResolvedValue(1);
      
      // Mock: Erro ao descriptografar
      mockDecrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await repositoryService.getAll(params);

      // Token deve ser null em caso de erro
      expect(result.data[0].personalAccessToken).toBeNull();
    });
  });

  describe('getById', () => {
    it('deve retornar repositório por ID com token descriptografado', async () => {
      const repositoryId = 'repo-id-123';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
        organization: 'test-org',
        project: 'test-project',
        personalAccessToken: 'encrypted_token456',
        team: { id: 'team-1', name: 'Team 1' },
        pullRequests: [],
        _count: { pullRequests: 0 },
      };

      // Mock: Encontrar repositório
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);

      const result = await repositoryService.getById(repositoryId);

      // Verificações
      expect(prisma.repository.findUnique).toHaveBeenCalledWith({
        where: { id: repositoryId },
        include: {
          team: true,
          pullRequests: {
            include: {
              createdBy: { select: { id: true, name: true, login: true } },
              reviews: true,
              comments: true,
            },
          },
          _count: {
            select: { pullRequests: true },
          },
        },
      });

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted_token456');
      expect(result.personalAccessToken).toBe('token456');
    });

    it('deve lançar erro se repositório não existir', async () => {
      const repositoryId = 'non-existent-repo';

      // Mock: Repositório não encontrado
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repositoryService.getById(repositoryId)).rejects.toThrow('Repository');
    });
  });

  describe('create', () => {
    it('deve criar repositório com token criptografado', async () => {
      const createDto = {
        name: 'New Repo',
        url: 'https://dev.azure.com/new-org/new-project/_git/New Repo',
        organization: 'new-org',
        project: 'new-project',
        personalAccessToken: 'plain_token_789',
        teamId: 'team-1',
      };

      const createdRepository = {
        id: 'new-repo-id',
        ...createDto,
        personalAccessToken: 'encrypted_plain_token_789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: Criar repositório
      (prisma.repository.create as jest.Mock).mockResolvedValue(createdRepository);

      const result = await repositoryService.create(createDto);

      // Verificações
      expect(mockEncrypt).toHaveBeenCalledWith('plain_token_789');
      expect(prisma.repository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: createDto.name,
          organization: createDto.organization,
          project: createDto.project,
          personalAccessToken: 'encrypted_plain_token_789',
          teamId: createDto.teamId,
        }),
        include: expect.any(Object),
      });

      expect(result.id).toBe('new-repo-id');
    });

    it('deve criar repositório sem token', async () => {
      const createDto = {
        name: 'New Repo',
        url: 'https://dev.azure.com/new-org/new-project/_git/New Repo',
        organization: 'new-org',
        project: 'new-project',
        personalAccessToken: null,
      };

      const createdRepository = {
        id: 'new-repo-id',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: Criar repositório
      (prisma.repository.create as jest.Mock).mockResolvedValue(createdRepository);

      await repositoryService.create(createDto);

      // encrypt NÃO deve ser chamado para token null
      expect(mockEncrypt).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('deve atualizar repositório com novo token criptografado', async () => {
      const repositoryId = 'repo-id-123';
      const updateDto = {
        name: 'Updated Repo',
        personalAccessToken: 'new_plain_token',
      };

      const existingRepository = {
        id: repositoryId,
        name: 'Old Repo',
        personalAccessToken: 'encrypted_old_token',
      };

      const updatedRepository = {
        ...existingRepository,
        ...updateDto,
        personalAccessToken: 'encrypted_new_plain_token',
      };

      // Mock: Encontrar repositório existente
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(existingRepository);
      
      // Mock: Atualizar repositório
      (prisma.repository.update as jest.Mock).mockResolvedValue(updatedRepository);

      const result = await repositoryService.update(repositoryId, updateDto);

      // Verificações
      expect(mockEncrypt).toHaveBeenCalledWith('new_plain_token');
      expect(prisma.repository.update).toHaveBeenCalledWith({
        where: { id: repositoryId },
        data: expect.objectContaining({
          name: updateDto.name,
          personalAccessToken: 'encrypted_new_plain_token',
        }),
        include: expect.any(Object),
      });

      expect(result.name).toBe('Updated Repo');
    });

    it('deve lançar erro se tentar atualizar repositório inexistente', async () => {
      const repositoryId = 'non-existent-repo';
      const updateDto = {
        name: 'Updated Repo',
      };

      // Mock: Repositório não encontrado
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repositoryService.update(repositoryId, updateDto)).rejects.toThrow('Repository');
    });
  });

  describe('delete', () => {
    it('deve deletar repositório existente', async () => {
      const repositoryId = 'repo-id-123';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
      };

      // Mock: Encontrar repositório
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);
      
      // Mock: Deletar repositório
      (prisma.repository.delete as jest.Mock).mockResolvedValue(repository);

      await repositoryService.delete(repositoryId);

      // Verificações
      expect(prisma.repository.findUnique).toHaveBeenCalledWith({
        where: { id: repositoryId },
        include: {
          _count: {
            select: { pullRequests: true },
          },
        },
      });
      expect(prisma.repository.delete).toHaveBeenCalledWith({
        where: { id: repositoryId },
      });
    });

    it('deve lançar erro se tentar deletar repositório inexistente', async () => {
      const repositoryId = 'non-existent-repo';

      // Mock: Repositório não encontrado
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repositoryService.delete(repositoryId)).rejects.toThrow('Repository');
    });
  });

  describe('getRepositoryCredentials', () => {
    it('deve retornar credenciais descriptografadas do repositório', async () => {
      const repositoryId = 'repo-id-123';

      const repository = {
        organization: 'test-org',
        personalAccessToken: 'encrypted_credentials_token',
      };

      // Mock: Encontrar repositório
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);

      const result = await repositoryService.getRepositoryCredentials(repositoryId);

      // Verificações
      expect(prisma.repository.findUnique).toHaveBeenCalledWith({
        where: { id: repositoryId },
        select: { organization: true, personalAccessToken: true },
      });
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted_credentials_token');
      expect(result).toEqual({
        organization: 'test-org',
        personalAccessToken: 'credentials_token',
      });
    });

    it('deve retornar null se repositório não existir', async () => {
      const repositoryId = 'non-existent-repo';

      // Mock: Repositório não encontrado
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repositoryService.getRepositoryCredentials(repositoryId);

      expect(result).toBeNull();
    });

    it('deve retornar null se repositório não tem token', async () => {
      const repositoryId = 'repo-id-123';

      const repository = {
        organization: 'test-org',
        personalAccessToken: null,
      };

      // Mock: Encontrar repositório sem token
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);

      const result = await repositoryService.getRepositoryCredentials(repositoryId);

      expect(result).toBeNull();
    });
  });
});
