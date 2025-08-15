import { Router } from 'express';
import { validate, kpiFiltersSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { KpiService } from '@/services/kpiService';

const router = Router();
const kpiService = new KpiService();

// Get all KPIs for dashboard
router.get('/', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getDashboardSummary(req.query);
    res.json({ success: true, data });
  })
);

// Get PR x Review x Comments chart
router.get('/pr-review-comments', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getPrReviewComments(req.query);
    res.json({ success: true, data });
  })
);

// Get PR x Commit chart
router.get('/pr-commit', 
  validate(kpiFiltersSchema),
  asyncHandler(async (req, res) => {
    const data = await kpiService.getPrCommit(req.query);
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
