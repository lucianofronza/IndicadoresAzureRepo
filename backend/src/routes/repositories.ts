import { Router } from 'express';
import { validate, createRepositorySchema, updateRepositorySchema, paginationSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { RepositoryService } from '@/services/repositoryService';

const router = Router();
const repositoryService = new RepositoryService();

router.get('/', validate(paginationSchema), asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = req.query;
  const result = await repositoryService.getAll({
    page: page as number,
    pageSize: pageSize as number,
    sortBy: sortBy as string,
    sortOrder: sortOrder as 'asc' | 'desc',
  });
  res.json({ success: true, data: result.data, pagination: result.pagination });
}));

router.get('/:id', validate(updateRepositorySchema), asyncHandler(async (req, res) => {
  const repository = await repositoryService.getById(req.params.id);
  res.json({ success: true, data: repository });
}));

router.post('/', validate(createRepositorySchema), asyncHandler(async (req, res) => {
  const repository = await repositoryService.create(req.body);
  res.status(201).json({ success: true, data: repository, message: 'Repository created successfully' });
}));

router.put('/:id', validate(updateRepositorySchema), asyncHandler(async (req, res) => {
  const repository = await repositoryService.update(req.params.id, req.body);
  res.json({ success: true, data: repository, message: 'Repository updated successfully' });
}));

router.delete('/:id', validate(updateRepositorySchema), asyncHandler(async (req, res) => {
  await repositoryService.delete(req.params.id);
  res.json({ success: true, message: 'Repository deleted successfully' });
}));

// Update repository last sync time
router.put('/:id/last-sync', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { lastSyncAt } = req.body;
  
  const repository = await repositoryService.update(id, { lastSyncAt: new Date(lastSyncAt) });
  res.json({ success: true, data: repository, message: 'Repository last sync updated successfully' });
}));

router.get('/:id/stats', validate(updateRepositorySchema), asyncHandler(async (req, res) => {
  const stats = await repositoryService.getStats(req.params.id);
  res.json({ success: true, data: stats });
}));

export default router;
