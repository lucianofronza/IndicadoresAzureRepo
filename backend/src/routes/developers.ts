import { Router } from 'express';
import { validate, createDeveloperSchema, updateDeveloperSchema, developerListSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { requireAuth } from '@/middlewares/auth';
import { DeveloperService } from '@/services/developerService';

const router = Router();
const developerService = new DeveloperService();

router.get('/', 
  requireAuth,
  validate(developerListSchema), 
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc', search, teamId, roleId, stackId } = req.query;
    
    // Apply user-based filtering
    let filteredTeamId = teamId as string;
    
    if (user.viewScope === 'teams') {
      // Get user's teams from UserTeam table
      const { prisma } = await import('@/config/database');
      const userTeams = await prisma.userTeam.findMany({
        where: { userId: user.id },
        select: { teamId: true }
      });
      
      if (userTeams.length === 0) {
        // No teams associated, return empty result
        return res.json({ success: true, data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
      }
      
      const userTeamIds = userTeams.map(ut => ut.teamId);
      
      if (!filteredTeamId || filteredTeamId === '') {
        // No specific team selected, use all user's teams
        filteredTeamId = userTeamIds.join(',');
      } else {
        // Specific team selected, validate if user has access to it
        const requestedTeamIds = filteredTeamId.split(',').filter(id => id.trim() !== '');
        const validTeamIds = requestedTeamIds.filter(id => userTeamIds.includes(id));
        
        if (validTeamIds.length === 0) {
          // User doesn't have access to any of the requested teams
          return res.json({ success: true, data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
        }
        
        filteredTeamId = validTeamIds.join(',');
      }
    } else if (user.viewScope === 'own') {
      // For 'own' scope, get team where user is a developer
      const { prisma } = await import('@/config/database');
      const developer = await prisma.developer.findUnique({
        where: { userId: user.id },
        select: { teamId: true }
      });
      
      if (!developer?.teamId) {
        // No developer association, return empty result
        return res.json({ success: true, data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
      }
      
      // Force the team to be the user's team
      filteredTeamId = developer.teamId;
    }
    // For 'all' scope, no filtering needed
    
    const result = await developerService.getAll({
      page: page as number,
      pageSize: pageSize as number,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      search: search as string,
      teamId: filteredTeamId,
      roleId: roleId as string,
      stackId: stackId as string,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  })
);


router.get('/:id', validate(updateDeveloperSchema), asyncHandler(async (req, res) => {
  const developer = await developerService.getById(req.params.id);
  res.json({ success: true, data: developer });
}));

router.post('/', validate(createDeveloperSchema), asyncHandler(async (req, res) => {
  const developer = await developerService.create(req.body);
  res.status(201).json({ success: true, data: developer, message: 'Developer created successfully' });
}));

router.put('/:id', validate(updateDeveloperSchema), asyncHandler(async (req, res) => {
  const developer = await developerService.update(req.params.id, req.body);
  res.json({ success: true, data: developer, message: 'Developer updated successfully' });
}));

router.delete('/:id', validate(updateDeveloperSchema), asyncHandler(async (req, res) => {
  await developerService.delete(req.params.id);
  res.json({ success: true, message: 'Developer deleted successfully' });
}));

router.get('/:id/stats', validate(updateDeveloperSchema), asyncHandler(async (req, res) => {
  const stats = await developerService.getStats(req.params.id);
  res.json({ success: true, data: stats });
}));

export default router;
