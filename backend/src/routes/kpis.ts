import { Router } from 'express';
import { validate, kpiFiltersSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { requireAuth } from '@/middlewares/auth';
import { KpiService } from '@/services/kpiService';

const router = Router();
const kpiService = new KpiService();

// Helper function to apply user-based team filtering
async function applyUserTeamFiltering(user: any, query: any) {
  if (user.viewScope === 'teams') {
    const { prisma } = await import('@/config/database');
    const userTeams = await prisma.userTeam.findMany({
      where: { userId: user.id },
      select: { teamId: true }
    });
    
    if (userTeams.length === 0) {
      return null; // No teams associated
    }
    
    const userTeamIds = userTeams.map(ut => ut.teamId);
    
    if (!query.teamId || query.teamId === '') {
      // No specific team selected, use all user's teams
      query.teamId = userTeamIds.join(',');
    } else {
      // Specific team selected, validate if user has access to it
      const requestedTeamIds = query.teamId.split(',').filter(id => id.trim() !== '');
      const validTeamIds = requestedTeamIds.filter(id => userTeamIds.includes(id));
      
      if (validTeamIds.length === 0) {
        return null; // User doesn't have access to any of the requested teams
      }
      
      query.teamId = validTeamIds.join(',');
    }
  } else if (user.viewScope === 'own') {
    const { prisma } = await import('@/config/database');
    const developer = await prisma.developer.findUnique({
      where: { userId: user.id },
      select: { teamId: true }
    });
    
    if (!developer?.teamId) {
      return null; // No developer association
    }
    
    // For 'own' scope, always force the team to be the user's team
    query.teamId = developer.teamId;
  }
  
  return query;
}

// Get all KPIs for dashboard (with user-based filtering)
router.get('/', 
  requireAuth,
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const user = req.user;
    const query = { ...req.query };
    
    const filteredQuery = await applyUserTeamFiltering(user, query);
    if (!filteredQuery) {
      return res.json({ success: true, data: {} });
    }
    
    const data = await kpiService.getDashboardSummary(filteredQuery);
    res.json({ success: true, data });
  })
);

// Get PR x Review x Comments chart (with user-based filtering)
router.get('/pr-review-comments', 
  requireAuth,
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const user = req.user;
    const query = { ...req.query };
    
    const filteredQuery = await applyUserTeamFiltering(user, query);
    if (!filteredQuery) {
      return res.json({ success: true, data: {} });
    }
    
    const data = await kpiService.getPrReviewComments(filteredQuery);
    res.json({ success: true, data });
  })
);

// Get PR x Commit chart (with user-based filtering)
router.get('/pr-commit', 
  requireAuth,
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const user = req.user;
    const query = { ...req.query };
    
    const filteredQuery = await applyUserTeamFiltering(user, query);
    if (!filteredQuery) {
      return res.json({ success: true, data: {} });
    }
    
    const data = await kpiService.getPrCommit(filteredQuery);
    res.json({ success: true, data });
  })
);

// Get PR x Review chart
router.get('/pr-review', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getPrReview(req.query);
    res.json({ success: true, data });
  })
);

// Get PR x Review by Team chart
router.get('/pr-review-team', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getPrReviewByTeam(req.query);
    res.json({ success: true, data });
  })
);

// Get Reviews performed by Team chart
router.get('/reviews-performed-team', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getReviewsPerformedByTeam(req.query);
    res.json({ success: true, data });
  })
);

// Get Files Changed by Team chart
router.get('/files-changed-team', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getFilesChangedByTeam(req.query);
    res.json({ success: true, data });
  })
);

// Get Cycle Time by Team chart
router.get('/cycle-time-team', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getCycleTimeByTeam(req.query);
    res.json({ success: true, data });
  })
);

// Get Top 10 Cycle Time PRs
router.get('/top-cycle-time-prs', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10 } = req.query;
    const data = await kpiService.getTopCycleTimePRs(req.query, {
      page: Number(page),
      pageSize: Number(pageSize)
    });
    res.json({ success: true, data });
  })
);

// Get Reviews performed chart
router.get('/reviews-performed', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getReviewsPerformed(req.query);
    res.json({ success: true, data });
  })
);

// Get Roles by Team chart
router.get('/roles-by-team', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getRolesByTeam(req.query);
    res.json({ success: true, data });
  })
);



// Get Cycle Time PR chart
router.get('/cycle-time', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getCycleTime(req.query);
    res.json({ success: true, data });
  })
);

// Get Time to First Review chart
router.get('/time-to-first-review', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getTimeToFirstReview(req.query);
    res.json({ success: true, data });
  })
);

// Get Top 10 Cycle Time PR list
router.get('/top-cycle-time', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10 } = req.query;
    const data = await kpiService.getTopCycleTime(req.query, {
      page: page as number,
      pageSize: pageSize as number,
    });
    res.json({ success: true, data: data.data, pagination: data.pagination });
  })
);

// Get Top 10 Time to Review list
router.get('/top-time-to-review', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10 } = req.query;
    const data = await kpiService.getTopTimeToReview(req.query, {
      page: page as number,
      pageSize: pageSize as number,
    });
    res.json({ success: true, data: data.data, pagination: data.pagination });
  })
);

// Get dashboard summary
router.get('/dashboard-summary', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getDashboardSummary(req.query);
    res.json({ success: true, data });
  })
);

export default router;
