import { DeveloperService } from '@/services/developerService';
import { prisma } from '@/config/database';
import { NotFoundError, ConflictError } from '@/middlewares/errorHandler';

// Mock Prisma
jest.mock('@/config/database', () => ({
  prisma: {
    developer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    pullRequest: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    commit: {
      count: jest.fn(),
    },
    review: {
      count: jest.fn(),
    },
    comment: {
      count: jest.fn(),
    },
  },
}));

describe('DeveloperService', () => {
  let developerService: DeveloperService;

  beforeEach(() => {
    developerService = new DeveloperService();
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return developers with pagination', async () => {
      const mockDevelopers = [
        {
          id: '1',
          name: 'John Doe',
          login: 'johndoe',
          team: { name: 'Team A' },
          role: { name: 'Developer' },
          stack: { name: 'React' },
          _count: {
            pullRequests: 10,
            commits: 50,
            reviews: 20,
            comments: 30,
          },
        },
      ];

      (prisma.developer.findMany as jest.Mock).mockResolvedValue(mockDevelopers);
      (prisma.developer.count as jest.Mock).mockResolvedValue(1);

      const result = await developerService.getAll({
        page: 1,
        pageSize: 10,
        search: 'john',
        teamId: 'team1',
        roleId: 'role1',
        stackId: 'stack1',
      });

      expect(result.data).toEqual(mockDevelopers);
      expect(result.pagination.total).toBe(1);
      expect(prisma.developer.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { login: { contains: 'john', mode: 'insensitive' } },
          ],
          teamId: 'team1',
          roleId: 'role1',
          stackId: 'stack1',
        },
        include: {
          team: true,
          role: true,
          stack: true,
          _count: {
            select: {
              pullRequests: true,
              commits: true,
              reviews: true,
              comments: true,
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getById', () => {
    it('should return developer by id', async () => {
      const mockDeveloper = {
        id: '1',
        name: 'John Doe',
        login: 'johndoe',
        team: { name: 'Team A' },
        role: { name: 'Developer' },
        stack: { name: 'React' },
      };

      (prisma.developer.findUnique as jest.Mock).mockResolvedValue(mockDeveloper);

      const result = await developerService.getById('1');

      expect(result).toEqual(mockDeveloper);
      expect(prisma.developer.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          team: true,
          role: true,
          stack: true,
          lead: true,
          manager: true,
        },
      });
    });

    it('should throw NotFoundError when developer not found', async () => {
      (prisma.developer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(developerService.getById('1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('should create developer successfully', async () => {
      const createData = {
        name: 'John Doe',
        login: 'johndoe',
        teamId: 'team1',
        roleId: 'role1',
        stackId: 'stack1',
      };

      const mockDeveloper = { id: '1', ...createData };

      (prisma.developer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.developer.create as jest.Mock).mockResolvedValue(mockDeveloper);

      const result = await developerService.create(createData);

      expect(result).toEqual(mockDeveloper);
      expect(prisma.developer.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          team: true,
          role: true,
          stack: true,
        },
      });
    });

    it('should throw ConflictError when login already exists', async () => {
      const createData = {
        name: 'John Doe',
        login: 'johndoe',
        teamId: 'team1',
        roleId: 'role1',
        stackId: 'stack1',
      };

      (prisma.developer.findUnique as jest.Mock).mockResolvedValue({ id: '1' });

      await expect(developerService.create(createData)).rejects.toThrow(ConflictError);
    });
  });

  describe('update', () => {
    it('should update developer successfully', async () => {
      const updateData = {
        name: 'John Updated',
        login: 'johnupdated',
      };

      const mockDeveloper = { id: '1', ...updateData };

      (prisma.developer.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: '1' }) // Check if exists
        .mockResolvedValueOnce(null); // Check for login conflict
      (prisma.developer.update as jest.Mock).mockResolvedValue(mockDeveloper);

      const result = await developerService.update('1', updateData);

      expect(result).toEqual(mockDeveloper);
      expect(prisma.developer.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        include: {
          team: true,
          role: true,
          stack: true,
        },
      });
    });

    it('should throw NotFoundError when developer not found', async () => {
      (prisma.developer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(developerService.update('1', { name: 'John' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when login already exists', async () => {
      (prisma.developer.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: '1' }) // Check if exists
        .mockResolvedValueOnce({ id: '2' }); // Login conflict

      await expect(developerService.update('1', { login: 'existing' })).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    it('should delete developer successfully', async () => {
      (prisma.developer.findUnique as jest.Mock).mockResolvedValue({ id: '1' });
      (prisma.developer.delete as jest.Mock).mockResolvedValue({ id: '1' });

      await developerService.delete('1');

      expect(prisma.developer.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundError when developer not found', async () => {
      (prisma.developer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(developerService.delete('1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getStats', () => {
    it('should return developer statistics', async () => {
      const mockStats = {
        totalPRs: 10,
        openPRs: 3,
        mergedPRs: 7,
        totalCommits: 50,
        totalReviews: 20,
        totalComments: 30,
        averageCycleTime: 2.5,
      };

      (prisma.pullRequest.findMany as jest.Mock).mockResolvedValue([
        { status: 'open' },
        { status: 'open' },
        { status: 'open' },
        { status: 'merged' },
        { status: 'merged' },
        { status: 'merged' },
        { status: 'merged' },
        { status: 'merged' },
        { status: 'merged' },
        { status: 'merged' },
      ]);

      (prisma.commit.count as jest.Mock).mockResolvedValue(50);
      (prisma.review.count as jest.Mock).mockResolvedValue(20);
      (prisma.comment.count as jest.Mock).mockResolvedValue(30);
      (prisma.pullRequest.aggregate as jest.Mock).mockResolvedValue({
        _avg: { cycleTimeDays: 2.5 },
      });

      const result = await developerService.getStats('1');

      expect(result).toEqual(mockStats);
    });
  });
});
