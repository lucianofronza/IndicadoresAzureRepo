import { Router } from 'express';
import { validate, createDeveloperSchema, updateDeveloperSchema, developerListSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { DeveloperService } from '@/services/developerService';

const router = Router();
const developerService = new DeveloperService();

router.get('/', validate(developerListSchema), asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc', search, teamId, roleId, stackId } = req.query;
  const result = await developerService.getAll({
    page: page as number,
    pageSize: pageSize as number,
    sortBy: sortBy as string,
    sortOrder: sortOrder as 'asc' | 'desc',
    search: search as string,
    teamId: teamId as string,
    roleId: roleId as string,
    stackId: stackId as string,
  });
  res.json({ success: true, data: result.data, pagination: result.pagination });
}));

/**
 * @route GET /developers/search
 * @desc Buscar desenvolvedores para seleção (apenas campos essenciais)
 * @access Public
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { search = '', limit = 50 } = req.query;
  const developers = await developerService.searchForSelection({
    search: search as string,
    limit: limit as number
  });
  res.json({ success: true, data: developers });
}));

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
