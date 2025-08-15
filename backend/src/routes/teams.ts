import { Router } from 'express';
import { validate, createTeamSchema, updateTeamSchema, paginationSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { TeamService } from '@/services/teamService';

const router = Router();
const teamService = new TeamService();

// Get all teams with pagination
router.get('/', 
  validate(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = req.query;
    
    const result = await teamService.getAll({
      page: page as number,
      pageSize: pageSize as number,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

// Get team by ID
router.get('/:id', 
  validate(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const team = await teamService.getById(id);
    
    res.json({
      success: true,
      data: team,
    });
  })
);

// Create new team
router.post('/', 
  validate(createTeamSchema),
  asyncHandler(async (req, res) => {
    const teamData = req.body;
    
    const team = await teamService.create(teamData);
    
    res.status(201).json({
      success: true,
      data: team,
      message: 'Team created successfully',
    });
  })
);

// Update team
router.put('/:id', 
  validate(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    
    const team = await teamService.update(id, updateData);
    
    res.json({
      success: true,
      data: team,
      message: 'Team updated successfully',
    });
  })
);

// Delete team
router.delete('/:id', 
  validate(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    await teamService.delete(id);
    
    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  })
);

// Get team statistics
router.get('/:id/stats', 
  validate(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const stats = await teamService.getStats(id);
    
    res.json({
      success: true,
      data: stats,
    });
  })
);

// Get team developers
router.get('/:id/developers', 
  validate(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, pageSize = 10 } = req.query;
    
    const result = await teamService.getDevelopers(id, {
      page: page as number,
      pageSize: pageSize as number,
    });
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

// Get team repositories
router.get('/:id/repositories', 
  validate(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, pageSize = 10 } = req.query;
    
    const result = await teamService.getRepositories(id, {
      page: page as number,
      pageSize: pageSize as number,
    });
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

export default router;
