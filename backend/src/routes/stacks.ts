import { Router } from 'express';
import { validate, createStackSchema, updateStackSchema, paginationSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { StackService } from '@/services/stackService';

const router = Router();
const stackService = new StackService();

router.get('/', validate(paginationSchema), asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = req.query;
  const result = await stackService.getAll({
    page: page as number,
    pageSize: pageSize as number,
    sortBy: sortBy as string,
    sortOrder: sortOrder as 'asc' | 'desc',
  });
  res.json({ success: true, data: result.data, pagination: result.pagination });
}));

router.get('/:id', validate(updateStackSchema), asyncHandler(async (req, res) => {
  const stack = await stackService.getById(req.params.id);
  res.json({ success: true, data: stack });
}));

router.post('/', validate(createStackSchema), asyncHandler(async (req, res) => {
  const stack = await stackService.create(req.body);
  res.status(201).json({ success: true, data: stack, message: 'Stack created successfully' });
}));

router.put('/:id', validate(updateStackSchema), asyncHandler(async (req, res) => {
  const stack = await stackService.update(req.params.id, req.body);
  res.json({ success: true, data: stack, message: 'Stack updated successfully' });
}));

router.delete('/:id', validate(updateStackSchema), asyncHandler(async (req, res) => {
  await stackService.delete(req.params.id);
  res.json({ success: true, message: 'Stack deleted successfully' });
}));

export default router;
