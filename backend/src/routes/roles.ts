import { Router } from 'express';
import { validate, createRoleSchema, updateRoleSchema, paginationSchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { RoleService } from '@/services/roleService';

const router = Router();
const roleService = new RoleService();

// Get all roles with pagination
router.get('/', 
  validate(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = req.query;
    
    const result = await roleService.getAll({
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

// Get role by ID
router.get('/:id', 
  validate(updateRoleSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const role = await roleService.getById(id);
    
    res.json({
      success: true,
      data: role,
    });
  })
);

// Create new role
router.post('/', 
  validate(createRoleSchema),
  asyncHandler(async (req, res) => {
    const roleData = req.body;
    const role = await roleService.create(roleData);
    
    res.status(201).json({
      success: true,
      data: role,
      message: 'Role created successfully',
    });
  })
);

// Update role
router.put('/:id', 
  validate(updateRoleSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const role = await roleService.update(id, updateData);
    
    res.json({
      success: true,
      data: role,
      message: 'Role updated successfully',
    });
  })
);

// Delete role
router.delete('/:id', 
  validate(updateRoleSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await roleService.delete(id);
    
    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  })
);

export default router;
